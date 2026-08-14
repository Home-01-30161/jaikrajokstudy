# Database Command Reference — JaiKraJok (team07)

> ไม่มีสิทธิ์ SSH เข้าเซิร์ฟเวอร์ — ใช้ `shell-cmd` manual job แทนทั้งหมด
>
> **GitLab → Build → Pipelines → เลือก pipeline → stage `ops` → กด ▶ บน `shell-cmd`**
>
> ตั้งค่า 2 ตัวแปร: `SERVICE` และ `CMD` แล้วกด Run

---

## Connection Info

| Field    | Value                                      |
|----------|--------------------------------------------|
| Host     | `db` (Docker service name)                 |
| Port     | `5432`                                     |
| User     | `app`                                      |
| Password | `team07pass`                               |
| Database | `app`                                      |
| Data dir | `/data/hack/team07/pgdata` (bind mount)    |

---

## shell-cmd Settings

Set `SERVICE=db` for all commands below.

---

## 1. Schema Inspection

### List all tables
```
SERVICE=db
CMD=psql -U app -d app -c "\dt"
```

### Describe table structure
```
SERVICE=db
CMD=psql -U app -d app -c "\d chat_messages"
```

### List all tables with sizes
```
SERVICE=db
CMD=psql -U app -d app -c "\dt+"
```

### List all indexes
```
SERVICE=db
CMD=psql -U app -d app -c "\di"
```

---

## 2. Row Counts & Health

### Total messages in chat_messages
```
SERVICE=db
CMD=psql -U app -d app -c "SELECT COUNT(*) FROM chat_messages;"
```

### Rows per user
```
SERVICE=db
CMD=psql -U app -d app -c "SELECT line_user_id, COUNT(*) FROM chat_messages GROUP BY line_user_id ORDER BY count DESC LIMIT 20;"
```

### Rows per source (web vs LINE)
```
SERVICE=db
CMD=psql -U app -d app -c "SELECT source, COUNT(*) FROM chat_messages GROUP BY source;"
```

### Most recent 10 messages
```
SERVICE=db
CMD=psql -U app -d app -c "SELECT id, line_user_id, role, source, created_at, LEFT(text,60) AS preview FROM chat_messages ORDER BY created_at DESC LIMIT 10;"
```

---

## 3. Database Size

### Total database size
```
SERVICE=db
CMD=psql -U app -d app -c "SELECT pg_size_pretty(pg_database_size('app'));"
```

### Size per table
```
SERVICE=db
CMD=psql -U app -d app -c "SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS size FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;"
```

---

## 4. Session History

### List all sessions
```
SERVICE=db
CMD=psql -U app -d app -c "SELECT session_id, session_title, COUNT(*) AS messages FROM chat_messages WHERE session_id IS NOT NULL GROUP BY session_id, session_title ORDER BY messages DESC LIMIT 20;"
```

### Messages in a specific session
```
SERVICE=db
CMD=psql -U app -d app -c "SELECT role, source, created_at, LEFT(text,80) AS preview FROM chat_messages WHERE session_id = '<SESSION_ID>' ORDER BY created_at ASC;"
```

---

## 5. Connectivity Test

### Check db is reachable (from api container)
```
SERVICE=api
CMD=node -e "import('pg').then(({default:pg})=>{const p=new pg.Pool({connectionString:process.env.DATABASE_URL});p.query('SELECT NOW()').then(r=>{console.log('DB OK',r.rows[0]);p.end()}).catch(e=>{console.error(e);p.end()})})"
```

### pg_isready from db container
```
SERVICE=db
CMD=pg_isready -U app -d app
```

---

## 6. Maintenance

### Vacuum & analyze (reclaim space)
```
SERVICE=db
CMD=psql -U app -d app -c "VACUUM ANALYZE chat_messages;"
```

### Delete messages older than 30 days
```
SERVICE=db
CMD=psql -U app -d app -c "DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '30 days';"
```

### Truncate all messages (⚠️ irreversible)
```
SERVICE=db
CMD=psql -U app -d app -c "TRUNCATE chat_messages RESTART IDENTITY;"
```

---

## 7. Full Reset

Use the dedicated **`reset-db`** manual job (not shell-cmd).

> ⚠️ **ลบข้อมูลถาวร กู้ไม่ได้** — ใช้ตอนแน่ใจเท่านั้น

`reset-db` จะ:
1. Stop และ remove `db` container
2. ลบ `/data/hack/team07/pgdata/*` (bind mount)
3. `docker compose up -d` สร้าง db ใหม่เปล่า

---

## Table Schema Reference

```sql
-- api/history.js สร้างตาราง auto ตอนเรียกใช้งานครั้งแรก
CREATE TABLE IF NOT EXISTS chat_messages (
  id            SERIAL PRIMARY KEY,
  line_user_id  TEXT        NOT NULL,
  role          TEXT        NOT NULL,       -- 'user' | 'bot'
  text          TEXT        NOT NULL,
  source        TEXT        NOT NULL DEFAULT 'web',  -- 'web' | 'line'
  session_id    TEXT,
  session_title TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user
  ON chat_messages (line_user_id, created_at ASC);
```
