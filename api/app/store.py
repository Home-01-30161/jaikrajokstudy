"""SQLite store for mood history and aggregate stats.

Phase 1 had no persistence, so the trend and school views had nothing real to
show. This adds the minimum needed: one row per mood reading, plus counters.

Design notes:
- SQLite file lives under /app/uploads, the only writable volume the compose
  file mounts, so data survives container restarts.
- User ids are hashed before storage. The school view is described in the UI as
  anonymised, and that has to be true at rest, not just in the response.
- All writes go through a lock because SQLite's default threading mode plus a
  single shared connection is not safe for concurrent writers.
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

_DEFAULT_DIR = Path("/app/data")
_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def _db_path() -> Path:
    """Resolve a writable location for the database file.

    Resolution order:
    1. JAIKRAJOK_DB_PATH env var — explicit override (e.g. for testing)
    2. /app/data — the bind-mount declared in docker-compose.yml that
       maps to /data/hack/teamNN/data on the host, so data survives redeploy
    3. Local dev fallback: <repo>/api/data/jaikrajok.db
    """
    override = os.getenv("JAIKRAJOK_DB_PATH")
    if override:
        return Path(override)
    if _DEFAULT_DIR.is_dir() and os.access(_DEFAULT_DIR, os.W_OK):
        return _DEFAULT_DIR / "jaikrajok.db"
    # Local dev / CI where /app/data does not exist.
    return Path(__file__).resolve().parent.parent / "data" / "jaikrajok.db"


def _hash_user(user_id: str) -> str:
    """One-way user id so stored rows cannot be traced back to a person."""
    return hashlib.sha256(f"jaikrajok:{user_id}".encode()).hexdigest()[:32]


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is not None:
        return _conn
    with _lock:
        if _conn is not None:
            return _conn
        path = _db_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS mood_events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_hash   TEXT    NOT NULL,
                mood        TEXT    NOT NULL,
                source      TEXT    NOT NULL,
                confidence  REAL,
                created_at  TEXT    NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_mood_user
                ON mood_events(user_hash, created_at);
            CREATE INDEX IF NOT EXISTS idx_mood_created
                ON mood_events(created_at);

            CREATE TABLE IF NOT EXISTS message_counts (
                user_hash   TEXT PRIMARY KEY,
                messages    INTEGER NOT NULL DEFAULT 0,
                first_seen  TEXT    NOT NULL,
                last_seen   TEXT    NOT NULL
            );
            """
        )
        conn.commit()
        logger.info("Store ready at %s", path)
        _conn = conn
        return _conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def record_mood(
    user_id: str,
    mood: str,
    *,
    source: str = "text",
    confidence: float | None = None,
) -> None:
    """Persist one mood reading. Never raises: a store failure must not break chat."""
    try:
        conn = get_conn()
        uh = _hash_user(user_id)
        now = _now()
        with _lock:
            conn.execute(
                "INSERT INTO mood_events (user_hash, mood, source, confidence, created_at)"
                " VALUES (?, ?, ?, ?, ?)",
                (uh, mood, source, confidence, now),
            )
            conn.execute(
                "INSERT INTO message_counts (user_hash, messages, first_seen, last_seen)"
                " VALUES (?, 1, ?, ?)"
                " ON CONFLICT(user_hash) DO UPDATE SET"
                "   messages = messages + 1, last_seen = excluded.last_seen",
                (uh, now, now),
            )
            conn.commit()
    except Exception:  # noqa: BLE001
        logger.exception("record_mood failed (continuing without persistence)")


def user_trend(user_id: str, days: int = 7) -> dict:
    """Per-day dominant mood for one user, plus their usage counters."""
    try:
        conn = get_conn()
        uh = _hash_user(user_id)
        since = (datetime.now(timezone.utc) - timedelta(days=days - 1)).date().isoformat()
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
            prev = by_day.get(r["day"])
            if prev is None or r["n"] > prev[1]:
                by_day[r["day"]] = (r["mood"], r["n"])

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
    except Exception:  # noqa: BLE001
        logger.exception("user_trend failed")
        return {"days": [], "messages": 0, "active_days": 0, "dominant_mood": None}


def school_overview() -> dict:
    """Anonymous aggregate across all users. Empty until real traffic exists."""
    try:
        conn = get_conn()
        with _lock:
            users = conn.execute("SELECT COUNT(*) AS n FROM message_counts").fetchone()["n"]
            total = conn.execute("SELECT COUNT(*) AS n FROM mood_events").fetchone()["n"]
            if users < _MIN_SCHOOL_USERS:
                return {
                    "users": 0,
                    "readings": 0,
                    "distribution": {},
                    "stress_ratio": None,
                    "regular_ratio": None,
                    "suppressed": True,
                }
            rows = conn.execute(
                "SELECT mood, COUNT(*) AS n FROM mood_events GROUP BY mood"
            ).fetchall()
            distribution = {r["mood"]: r["n"] for r in rows}

            stressed = distribution.get("stressed", 0) + distribution.get("sad", 0)
            # Users with more than a handful of readings count as regulars.
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
    except Exception:  # noqa: BLE001
        logger.exception("school_overview failed")
        return {
            "users": 0,
            "readings": 0,
            "distribution": {},
            "stress_ratio": 0.0,
            "regular_ratio": 0.0,
            "suppressed": True,
        }


def concern_streak(user_id: str, window: int = 3) -> int:
    """Return the number of consecutive negative moods at the end of the user's history.

    A 'concerning' mood is stressed or sad. Used to surface a wellbeing nudge
    in the UI after several consecutive low readings — matching the proposal's
    'concern streak alert' requirement (proposal p.9-11).

    Returns 0 if the last `window` readings are not all negative, or if there
    are fewer than `window` readings.
    """
    try:
        conn = get_conn()
        uh = _hash_user(user_id)
        with _lock:
            rows = conn.execute(
                "SELECT mood FROM mood_events WHERE user_hash = ?"
                " ORDER BY created_at DESC LIMIT ?",
                (uh, window),
            ).fetchall()
        if len(rows) < window:
            return 0
        negative = {"stressed", "sad"}
        streak = sum(1 for r in rows if r["mood"] in negative)
        return streak if all(r["mood"] in negative for r in rows) else 0
    except Exception:  # noqa: BLE001
        logger.exception("concern_streak failed")
        return 0



    """PDPA data-access for the current signed session.

    Only mood readings and usage counters exist to hand back. Chat text, images
    and audio are never written to disk, so there is no message body to export.
    """
    try:
        conn = get_conn()
        uh = _hash_user(user_id)
        with _lock:
            rows = conn.execute(
                "SELECT mood, source, confidence, created_at FROM mood_events"
                " WHERE user_hash = ? ORDER BY created_at",
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
                    "at": r["created_at"],
                    "mood": r["mood"],
                    "source": r["source"],
                    "confidence": r["confidence"],
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
    except Exception:  # noqa: BLE001
        logger.exception("export_user failed")
        raise


def delete_user(user_id: str) -> int:
    """PDPA erasure for the current signed session. Returns rows removed."""
    try:
        conn = get_conn()
        uh = _hash_user(user_id)
        with _lock:
            deleted = conn.execute(
                "DELETE FROM mood_events WHERE user_hash = ?", (uh,)
            ).rowcount
            deleted += conn.execute(
                "DELETE FROM message_counts WHERE user_hash = ?", (uh,)
            ).rowcount
            conn.commit()
        return max(deleted, 0)
    except Exception:  # noqa: BLE001
        logger.exception("delete_user failed")
        raise
