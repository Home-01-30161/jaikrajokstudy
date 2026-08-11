"""Persistent store for mood history and aggregate stats.

Production uses PostgreSQL at /data/hack/teamNN/pgdata (per hackathon guide
section 11).  Local dev falls back to SQLite at api/data/jaikrajok.db when
DATABASE_URL is not set.

Design notes:
- User ids are SHA-256 hashed before storage (PDPA pseudonymisation).
- PostgreSQL handles concurrency natively; the SQLite fallback keeps the
  threading lock from the original implementation.
"""

from __future__ import annotations

import hashlib
import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.utils.logging import get_logger

logger = get_logger(__name__)
_MIN_SCHOOL_USERS = 5

# ---------------------------------------------------------------------------
# Connection management
# ---------------------------------------------------------------------------
_lock = threading.Lock()
_pg_pool = None          # psycopg pool (PostgreSQL)
_sqlite_conn = None      # sqlite3 connection (local dev fallback)
_use_pg: bool | None = None  # resolved on first call


def _database_url() -> str:
    """Return DATABASE_URL from settings / env, or empty string."""
    try:
        from app.config import get_settings
        return get_settings().database_url or ""
    except Exception:
        return os.getenv("DATABASE_URL", "")


def _init_pg(dsn: str):
    """Create a PostgreSQL connection pool and ensure tables exist."""
    global _pg_pool
    import psycopg
    from psycopg.rows import dict_row
    from psycopg_pool import ConnectionPool

    # Convert SQLAlchemy-style URL to psycopg-style if needed
    dsn = dsn.replace("postgresql+psycopg://", "postgresql://")

    _pg_pool = ConnectionPool(dsn, min_size=1, max_size=5, kwargs={"row_factory": dict_row})

    with _pg_pool.connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS mood_events (
                id                SERIAL PRIMARY KEY,
                user_hash         TEXT    NOT NULL,
                mood              TEXT    NOT NULL,
                source            TEXT    NOT NULL,
                channel           TEXT    NOT NULL DEFAULT 'web',
                confidence        REAL,
                face_confidence   REAL,
                text_confidence   REAL,
                audio_confidence  REAL,
                created_at        TEXT    NOT NULL
            )
        """)
        # Migrate existing tables — safe on both fresh and existing DBs
        for col, typedef in [
            ("channel",          "TEXT NOT NULL DEFAULT 'web'"),
            ("face_confidence",  "REAL"),
            ("text_confidence",  "REAL"),
            ("audio_confidence", "REAL"),
        ]:
            try:
                conn.execute(f"ALTER TABLE mood_events ADD COLUMN {col} {typedef}")
            except Exception:
                pass  # column already exists — fine
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_mood_user
                ON mood_events(user_hash, created_at)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_mood_created
                ON mood_events(created_at)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_mood_channel
                ON mood_events(channel, created_at)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS message_counts (
                user_hash   TEXT PRIMARY KEY,
                messages    INTEGER NOT NULL DEFAULT 0,
                first_seen  TEXT    NOT NULL,
                last_seen   TEXT    NOT NULL
            )
        """)
        conn.commit()
    logger.info("Store ready (PostgreSQL)")


def _init_sqlite():
    """Open SQLite connection for local dev."""
    global _sqlite_conn
    db_dir = Path(__file__).resolve().parent.parent / "data"
    db_dir.mkdir(parents=True, exist_ok=True)
    path = db_dir / "jaikrajok.db"
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS mood_events (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            user_hash         TEXT    NOT NULL,
            mood              TEXT    NOT NULL,
            source            TEXT    NOT NULL,
            channel           TEXT    NOT NULL DEFAULT 'web',
            confidence        REAL,
            face_confidence   REAL,
            text_confidence   REAL,
            audio_confidence  REAL,
            created_at        TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_mood_user
            ON mood_events(user_hash, created_at);
        CREATE INDEX IF NOT EXISTS idx_mood_created
            ON mood_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_mood_channel
            ON mood_events(channel, created_at);

        CREATE TABLE IF NOT EXISTS message_counts (
            user_hash   TEXT PRIMARY KEY,
            messages    INTEGER NOT NULL DEFAULT 0,
            first_seen  TEXT    NOT NULL,
            last_seen   TEXT    NOT NULL
        );
    """)
    # Migrate existing SQLite tables safely
    for col, typedef in [
        ("channel",          "TEXT NOT NULL DEFAULT 'web'"),
        ("face_confidence",  "REAL"),
        ("text_confidence",  "REAL"),
        ("audio_confidence", "REAL"),
    ]:
        try:
            conn.execute(f"ALTER TABLE mood_events ADD COLUMN {col} {typedef}")
        except Exception:
            pass  # already exists
    conn.commit()
    _sqlite_conn = conn
    logger.info("Store ready (SQLite) at %s", path)


def _ensure_init():
    """Lazy-initialise the right backend on first use."""
    global _use_pg
    if _use_pg is not None:
        return
    with _lock:
        if _use_pg is not None:
            return
        dsn = _database_url()
        if dsn and dsn.startswith("postgresql"):
            _init_pg(dsn)
            _use_pg = True
        else:
            _init_sqlite()
            _use_pg = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash_user(user_id: str) -> str:
    """One-way user id so stored rows cannot be traced back to a person."""
    return hashlib.sha256(f"jaikrajok:{user_id}".encode()).hexdigest()[:32]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# PostgreSQL helpers
# ---------------------------------------------------------------------------

def _pg_execute(query: str, params: tuple = (), *, fetch: str = "none"):
    """Run a query via the pg pool. fetch: 'none' | 'one' | 'all'."""
    with _pg_pool.connection() as conn:
        cur = conn.execute(query, params)
        if fetch == "one":
            return cur.fetchone()
        if fetch == "all":
            return cur.fetchall()
        conn.commit()
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def record_mood(
    user_id: str,
    mood: str,
    *,
    source: str = "text",
    channel: str = "web",
    confidence: float | None = None,
    face_confidence: float | None = None,
    text_confidence: float | None = None,
    audio_confidence: float | None = None,
) -> None:
    """Persist one mood reading. Never raises: a store failure must not break chat.

    Args:
        user_id:          Raw LINE/web user id (will be hashed before storage).
        mood:             One of stressed/sad/tired/neutral/calm/positive.
        source:           Sub-source label e.g. 'line_text', 'web_chat', 'crisis'.
        channel:          Top-level channel: 'web' | 'line' | 'voice' | 'image'.
        confidence:       Overall sentiment confidence [0–1].
        face_confidence:  Face Recognition API confidence (image channel).
        text_confidence:  Sentiment Analysis API confidence (text channel).
        audio_confidence: STT → sentiment confidence (voice channel).
    """
    try:
        _ensure_init()
        uh = _hash_user(user_id)
        now = _now()

        if _use_pg:
            with _pg_pool.connection() as conn:
                conn.execute(
                    "INSERT INTO mood_events"
                    " (user_hash, mood, source, channel, confidence,"
                    "  face_confidence, text_confidence, audio_confidence, created_at)"
                    " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                    (uh, mood, source, channel, confidence,
                     face_confidence, text_confidence, audio_confidence, now),
                )
                conn.execute(
                    "INSERT INTO message_counts (user_hash, messages, first_seen, last_seen)"
                    " VALUES (%s, 1, %s, %s)"
                    " ON CONFLICT(user_hash) DO UPDATE SET"
                    "   messages = message_counts.messages + 1,"
                    "   last_seen = EXCLUDED.last_seen",
                    (uh, now, now),
                )
                conn.commit()
        else:
            conn = _sqlite_conn
            with _lock:
                conn.execute(
                    "INSERT INTO mood_events"
                    " (user_hash, mood, source, channel, confidence,"
                    "  face_confidence, text_confidence, audio_confidence, created_at)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (uh, mood, source, channel, confidence,
                     face_confidence, text_confidence, audio_confidence, now),
                )
                conn.execute(
                    "INSERT INTO message_counts (user_hash, messages, first_seen, last_seen)"
                    " VALUES (?, 1, ?, ?)"
                    " ON CONFLICT(user_hash) DO UPDATE SET"
                    "   messages = messages + 1, last_seen = excluded.last_seen",
                    (uh, now, now),
                )
                conn.commit()
    except Exception:
        logger.exception("record_mood failed (continuing without persistence)")


def user_trend(user_id: str, days: int = 7) -> dict:
    """Per-day dominant mood for one user, plus their usage counters."""
    try:
        _ensure_init()
        uh = _hash_user(user_id)
        since = (datetime.now(timezone.utc) - timedelta(days=days - 1)).date().isoformat()

        if _use_pg:
            rows = _pg_execute(
                "SELECT LEFT(created_at, 10) AS day, mood, COUNT(*) AS n"
                " FROM mood_events WHERE user_hash = %s AND LEFT(created_at, 10) >= %s"
                " GROUP BY day, mood ORDER BY day",
                (uh, since), fetch="all",
            )
            counters = _pg_execute(
                "SELECT messages, first_seen FROM message_counts WHERE user_hash = %s",
                (uh,), fetch="one",
            )
            overall = _pg_execute(
                "SELECT mood, COUNT(*) AS n FROM mood_events WHERE user_hash = %s"
                " GROUP BY mood ORDER BY n DESC LIMIT 1",
                (uh,), fetch="one",
            )
            active_days = _pg_execute(
                "SELECT COUNT(DISTINCT LEFT(created_at, 10)) AS d"
                " FROM mood_events WHERE user_hash = %s",
                (uh,), fetch="one",
            )
        else:
            conn = _sqlite_conn
            with _lock:
                rows = conn.execute(
                    "SELECT substr(created_at, 1, 10) AS day, mood, COUNT(*) AS n"
                    " FROM mood_events WHERE user_hash = ? AND substr(created_at, 1, 10) >= ?"
                    " GROUP BY day, mood ORDER BY day",
                    (uh, since),
                ).fetchall()
                counters = conn.execute(
                    "SELECT messages, first_seen FROM message_counts WHERE user_hash = ?",
                    (uh,),
                ).fetchone()
                overall = conn.execute(
                    "SELECT mood, COUNT(*) AS n FROM mood_events WHERE user_hash = ?"
                    " GROUP BY mood ORDER BY n DESC LIMIT 1",
                    (uh,),
                ).fetchone()
                active_days = conn.execute(
                    "SELECT COUNT(DISTINCT substr(created_at, 1, 10)) AS d"
                    " FROM mood_events WHERE user_hash = ?",
                    (uh,),
                ).fetchone()

        by_day: dict[str, tuple[str, int]] = {}
        for r in rows:
            day = r["day"]
            n = r["n"]
            prev = by_day.get(day)
            if prev is None or n > prev[1]:
                by_day[day] = (r["mood"], n)

        return {
            "days": [
                {"date": day, "mood": mood}
                for day, (mood, _) in sorted(by_day.items())
            ],
            "messages": counters["messages"] if counters else 0,
            "active_days": active_days["d"] if active_days else 0,
            "dominant_mood": overall["mood"] if overall else None,
            "first_seen": counters["first_seen"] if counters else None,
        }
    except Exception:
        logger.exception("user_trend failed")
        return {"days": [], "messages": 0, "active_days": 0, "dominant_mood": None}


def school_overview() -> dict:
    """Anonymous aggregate across all users. Empty until real traffic exists."""
    try:
        _ensure_init()

        if _use_pg:
            users = _pg_execute("SELECT COUNT(*) AS n FROM message_counts", fetch="one")["n"]
            total = _pg_execute("SELECT COUNT(*) AS n FROM mood_events", fetch="one")["n"]
            if users < _MIN_SCHOOL_USERS:
                return {
                    "users": 0, "readings": 0, "distribution": {},
                    "stress_ratio": None, "regular_ratio": None, "suppressed": True,
                }
            rows = _pg_execute(
                "SELECT mood, COUNT(*) AS n FROM mood_events GROUP BY mood",
                fetch="all",
            )
            distribution = {r["mood"]: r["n"] for r in rows}
            stressed = distribution.get("stressed", 0) + distribution.get("sad", 0)
            regulars = _pg_execute(
                "SELECT COUNT(*) AS n FROM message_counts WHERE messages >= 5",
                fetch="one",
            )["n"]
        else:
            conn = _sqlite_conn
            with _lock:
                users = conn.execute("SELECT COUNT(*) AS n FROM message_counts").fetchone()["n"]
                total = conn.execute("SELECT COUNT(*) AS n FROM mood_events").fetchone()["n"]
                if users < _MIN_SCHOOL_USERS:
                    return {
                        "users": 0, "readings": 0, "distribution": {},
                        "stress_ratio": None, "regular_ratio": None, "suppressed": True,
                    }
                rows = conn.execute(
                    "SELECT mood, COUNT(*) AS n FROM mood_events GROUP BY mood"
                ).fetchall()
                distribution = {r["mood"]: r["n"] for r in rows}
                stressed = distribution.get("stressed", 0) + distribution.get("sad", 0)
                regulars = conn.execute(
                    "SELECT COUNT(*) AS n FROM message_counts WHERE messages >= 5"
                ).fetchone()["n"]

        return {
            "users": users,
            "readings": total,
            "distribution": distribution,
            "stress_ratio": round(stressed / total, 3) if total else 0.0,
            "regular_ratio": round(regulars / users, 3) if users else 0.0,
            "suppressed": False,
        }
    except Exception:
        logger.exception("school_overview failed")
        return {
            "users": 0, "readings": 0, "distribution": {},
            "stress_ratio": 0.0, "regular_ratio": 0.0, "suppressed": True,
        }


def concern_streak(user_id: str, window: int = 3) -> int:
    """Return consecutive negative mood count at end of history."""
    try:
        _ensure_init()
        uh = _hash_user(user_id)

        if _use_pg:
            rows = _pg_execute(
                "SELECT mood FROM mood_events WHERE user_hash = %s"
                " ORDER BY created_at DESC LIMIT %s",
                (uh, window), fetch="all",
            )
        else:
            conn = _sqlite_conn
            with _lock:
                rows = conn.execute(
                    "SELECT mood FROM mood_events WHERE user_hash = ?"
                    " ORDER BY created_at DESC LIMIT ?",
                    (uh, window),
                ).fetchall()

        if len(rows) < window:
            return 0
        negative = {"stressed", "sad"}
        return sum(1 for r in rows if r["mood"] in negative) if all(r["mood"] in negative for r in rows) else 0
    except Exception:
        logger.exception("concern_streak failed")
        return 0


def export_user(user_id: str) -> dict:
    """PDPA data-access for the current signed session.

    Only mood readings and usage counters exist to hand back. Chat text, images
    and audio are never written to disk, so there is no message body to export.
    """
    try:
        _ensure_init()
        uh = _hash_user(user_id)

        if _use_pg:
            rows = _pg_execute(
                "SELECT mood, source, channel, confidence,"
                " face_confidence, text_confidence, audio_confidence, created_at"
                " FROM mood_events WHERE user_hash = %s ORDER BY created_at",
                (uh,), fetch="all",
            )
            counters = _pg_execute(
                "SELECT messages, first_seen, last_seen FROM message_counts WHERE user_hash = %s",
                (uh,), fetch="one",
            )
        else:
            conn = _sqlite_conn
            with _lock:
                rows = conn.execute(
                    "SELECT mood, source, channel, confidence,"
                    " face_confidence, text_confidence, audio_confidence, created_at"
                    " FROM mood_events WHERE user_hash = ? ORDER BY created_at",
                    (uh,),
                ).fetchall()
                counters = conn.execute(
                    "SELECT messages, first_seen, last_seen FROM message_counts WHERE user_hash = ?",
                    (uh,),
                ).fetchone()

        return {
            "exported_at": _now(),
            "readings": [
                {
                    "at":               r["created_at"],
                    "mood":             r["mood"],
                    "source":           r["source"],
                    "channel":          r["channel"],
                    "confidence":       r["confidence"],
                    "face_confidence":  r["face_confidence"],
                    "text_confidence":  r["text_confidence"],
                    "audio_confidence": r["audio_confidence"],
                }
                for r in rows
            ],
            "messages": counters["messages"] if counters else 0,
            "first_seen": counters["first_seen"] if counters else None,
            "last_seen": counters["last_seen"] if counters else None,
            "note": (
                "เก็บเฉพาะผลอารมณ์และจำนวนครั้งที่ใช้งาน "
                "ไม่มีการเก็บข้อความ ภาพ หรือเสียงไว้บนเซิร์ฟเวอร์"
            ),
        }
    except Exception:
        logger.exception("export_user failed")
        raise


def delete_user(user_id: str) -> int:
    """PDPA erasure for the current signed session. Returns rows removed."""
    try:
        _ensure_init()
        uh = _hash_user(user_id)

        if _use_pg:
            with _pg_pool.connection() as conn:
                d1 = conn.execute(
                    "DELETE FROM mood_events WHERE user_hash = %s", (uh,)
                ).rowcount
                d2 = conn.execute(
                    "DELETE FROM message_counts WHERE user_hash = %s", (uh,)
                ).rowcount
                conn.commit()
            return max(d1 + d2, 0)
        else:
            conn = _sqlite_conn
            with _lock:
                d1 = conn.execute(
                    "DELETE FROM mood_events WHERE user_hash = ?", (uh,)
                ).rowcount
                d2 = conn.execute(
                    "DELETE FROM message_counts WHERE user_hash = ?", (uh,)
                ).rowcount
                conn.commit()
            return max(d1 + d2, 0)
    except Exception:
        logger.exception("delete_user failed")
        raise
