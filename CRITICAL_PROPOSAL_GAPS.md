# 🚨 CRITICAL PROPOSAL-IMPLEMENTATION GAPS
**Team:** team07 JaiKraJok  
**Analysis Date:** 2026-08-16  
**Severity:** HIGH - Multiple claimed features are non-functional or missing

---

## ✅ FIX STATUS — 2026-08-16 (All 6 Gaps Implemented)

| # | Gap | Status | Implementation |
|---|-----|--------|----------------|
| 1 | AES-256 encryption | ✅ **FIXED** | `api/privacy.js` wraps `api/encryption.js`; `webhook.js` + `history.js` encrypt chat text at write, decrypt at read (legacy rows pass through) |
| 2 | Anonymous storage | ✅ **FIXED** | All LINE/web user IDs stored as SHA-256 hash (`hashId`); `004_anonymize_existing.sql` converts existing rows; lookups use `ANY([hash, raw])` fallback |
| 3 | Rate limiting | ✅ **FIXED** | `api/rate-limit.js` + `express-rate-limit@7.5.1`; global 120/15min, strict 10/15min on OTP/guardian/token routes; `/health`, `/webhook`, `/webhooks/line`, `/admin-db` exempt; `trust proxy = true` (real client IPs behind 2 proxies) |
| 4 | Email alerts | ✅ **FIXED** | `api/notify.js` (`recordAlert` + `sendAdminEmail`); webhook triggers on crisis or streak ≥ 3; SMTP placeholder detected → graceful skip + console warning; needs real `APP_SMTP_PASS` to deliver |
| 5 | PDPA delete/export API | ✅ **FIXED** | `api/user-data.js`: `GET /api/user-data/export?line_user_id=…` + `DELETE /api/user-data`; web UI delete/export now calls the API too |
| 6 | Age consent 18 → 20 | ✅ **FIXED** | `App.tsx` threshold `< 20` + guardian text "อายุต่ำกว่า 20 ปี" |

**Verified locally:** `node --check` all API files, `tsc --noEmit` clean, `vite build` clean, live endpoint tests (rate limit → 429, health exempt, encrypt/decrypt round-trip).

**Still required at deploy time:**
1. GitLab masked variable `APP_ENCRYPTION_KEY` (≥ 32 random chars) — else app degrades to plaintext with a console warning.
2. Real `APP_SMTP_PASS` (Gmail App Password) + `APP_ADMIN_EMAIL` — else alerts are recorded in DB but email is skipped.
3. Migrations `002_production_ready.sql` (enabled) + `004_anonymize_existing.sql` run automatically at API startup via `migrate.js`.

---

## EXECUTIVE SUMMARY

The project claims PDPA compliance and safety features in the proposal but **critical components are either missing, broken, or never applied**. This creates legal liability and safety gaps.

**Status:** ✅ **FIXED — all 6 gaps implemented (see table above)**

---

## 🔴 CRITICAL GAP #1: AES-256 Encryption - BUILT BUT NEVER APPLIED

### Proposal Claim (หน้า 11)
> "ข้อมูลทั้งหมดถูกเข้ารหัสตามมาตรฐาน AES-256"  
> "All data is encrypted with AES-256 standard"

### Reality
**Status:** ❌ **Code exists but is NEVER imported or used**

**Evidence:**
```bash
# encryption.js exists with full AES-256-GCM implementation
api/encryption.js:1-88  ✅ encrypt(), decrypt(), anonymize() functions present

# But ZERO imports found across entire codebase
grep -r "import.*encryption" api/
# Result: No matches found

grep -r "require.*encryption" api/
# Result: No matches found
```

**Database stores everything in plaintext:**
```javascript
// api/history.js:43-50 — Saves raw text with NO encryption
await pool.query(
  `INSERT INTO chat_messages (line_user_id, role, text, ...)
   VALUES ($1, $2, $3, ...)`,
  [line_user_id, role, String(text).slice(0, 4000), ...]
);
```

**Impact:**
- All chat messages stored in plaintext in PostgreSQL
- Sensitive student conversations readable by anyone with database access
- Violates PDPA data protection requirements
- **LEGAL RISK:** False claim in proposal document

---

## 🔴 CRITICAL GAP #2: Anonymous Storage - LINE USER IDs STORED RAW

### Proposal Claim
> "จัดเก็บแบบไม่ระบุตัวตน โดยใช้การ hash แทนการเก็บ LINE User ID โดยตรง"  
> "Anonymous storage using hash instead of storing LINE User ID directly"

### Reality
**Status:** ❌ **LINE User IDs stored in plaintext**

**Evidence:**
```sql
-- api/history.js:11-13 — Table schema stores raw LINE ID
CREATE TABLE IF NOT EXISTS chat_messages (
  id           SERIAL PRIMARY KEY,
  line_user_id TEXT NOT NULL,  -- ❌ STORES RAW: "U7768d4..." not hashed
  role         TEXT NOT NULL,
  text         TEXT NOT NULL,
  ...
);
```

**Database has anonymization schema ready but disabled:**
```sql
-- api/migrations/001_new_schema.sql:28-33 — PREPARED BUT NOT USED
CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  anon_id               UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  line_user_id_hash     TEXT NOT NULL UNIQUE,  -- ✅ Designed for hashed IDs
  ...
);
```

**Why it's not anonymous:**
- Real LINE User IDs like `U7768d4c3f1e2a9b8` stored directly
- Can be cross-referenced with LINE Platform to identify real users
- `encryption.js` has `anonymize()` function but never called

**Impact:**
- Not truly anonymous as claimed
- Re-identification possible via LINE User ID
- False claim in proposal

---

## 🔴 CRITICAL GAP #3: Rate Limiting - CLAIMED BUT NOT IMPLEMENTED

### Proposal Claim (หน้า 11)
> "มีระบบ Rate Limiting ป้องกันการใช้งานเกินขีดจำกัด"  
> "Rate limiting system to prevent excessive usage"

### Reality
**Status:** ❌ **Zero rate limiting implementation**

**Evidence:**
```bash
# Search entire API codebase
grep -r "rate.?limit\|express-rate-limit\|rate_limit" api/
# Result: No files found

# api/index.js has NO rate limiting middleware
# Lines 28-99: Only express.json() and security headers, no rate limiter
```

**Current state:**
```javascript
// api/index.js — No rate limiting at all
const app = express();
app.use(express.json({ limit: "10mb" }));  // ❌ Only body size limit
// Missing: app.use(rateLimit({ ... }))
```

**Impact:**
- API vulnerable to abuse (spam, DoS)
- No protection against excessive AI API costs
- Single user can exhaust team's API quotas
- False claim in proposal

**Fix Required:**
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // 100 requests per window
  message: 'Too many requests, please try again later.'
});

app.use('/api/', limiter);
```

---

## 🔴 CRITICAL GAP #4: Human-in-the-Loop Email Alert - BROKEN

### Proposal Claim (หน้า 11)
> "มี Human-in-the-loop — กรณีฉุกเฉินจะมีการแจ้งเตือนไปยังผู้ดูแลระบบที่เป็นมนุษย์"  
> "Human-in-the-loop — emergency cases trigger alerts to human administrators"

### Reality
**Status:** 🔴 **BROKEN - Email system non-functional, 2 alerts never sent**

**Evidence from Database Schema:**
```sql
-- api/migrations/001_new_schema.sql:87-97
CREATE TABLE IF NOT EXISTS emotion_alerts (
  id                      SERIAL PRIMARY KEY,
  anon_user_id            INT REFERENCES users(id) ON DELETE SET NULL,
  triggered_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alert_type              TEXT NOT NULL,   -- 'continuous_negative' | 'crisis_signal'
  consecutive_negative    INT,
  message_shown_to_user   TEXT,
  admin_notified          BOOLEAN NOT NULL DEFAULT FALSE,  -- ⚠️ Tracks notification
  resolved_at             TIMESTAMPTZ,
  resolution_note         TEXT
);
```

**Admin Dashboard Shows Unnotified Alerts:**
```javascript
// api/admin-db.js:122-200
SELECT id, alert_type, consecutive_negative, admin_notified, ...
FROM emotion_alerts;

// Display template line 200:
<td>${r.admin_notified ? "✅" : "—"}</td>  // ❌ Shows "—" for unnotified
```

**Root Cause - Email Configuration Broken:**
```bash
# .env line 23 — Placeholder password, never updated
SMTP_USER=h63966239@gmail.com
SMTP_PASS=your-gmail-app-password  # ❌ PLACEHOLDER - won't work
```

**Current State:**
- ✅ Crisis detection works (`CRISIS_KEYWORDS` in webhook.js)
- ✅ Alert rows created in `emotion_alerts` table
- ❌ **Email sending fails** due to invalid SMTP credentials
- ❌ **`admin_notified` stays FALSE** — admins never receive alerts
- ❌ Teachers/guardians never know about at-risk students

**Impact:**
- Students in crisis detected but no human notified
- False sense of security ("system will alert someone")
- Potential safety incident if student needs immediate help
- Violates proposal's human-in-the-loop promise

**Fix Required:**
```bash
# GitLab CI/CD Variables (masked):
APP_SMTP_USER=actual_email@gmail.com
APP_SMTP_PASS=actual_gmail_app_password_16chars

# Also need to implement actual email sending in crisis handler
```

---

## ⚠️ GAP #5: PDPA Delete/Export Data API - MISSING

### Proposal Claim (หน้า 11)
> "ผู้ใช้สามารถขอเข้าถึง แก้ไข หรือลบข้อมูลของตนเองได้ทุกเมื่อ"  
> "Users can request to access, edit, or delete their data at any time"

### Reality
**Status:** ⚠️ **Partial - Web UI only, no API endpoint**

**What Exists:**
```javascript
// client/src/App.tsx — Web app has delete button
window.confirm("ยืนยันลบข้อมูลแนวโน้มอารมณ์...")
// But only clears localStorage, not database
```

**What's Missing:**
- ❌ No API endpoint: `DELETE /api/user-data?line_user_id=...`
- ❌ No API endpoint: `GET /api/user-data/export?line_user_id=...`
- ❌ LINE Bot users cannot delete their data
- ❌ No data export in JSON format for portability

**PDPA Requirements (PDPA §33-34):**
- Right to access (เข้าถึงข้อมูล)
- Right to portability (ขอรับข้อมูล)
- Right to deletion (ขอลบข้อมูล)

**Impact:**
- Not PDPA compliant
- Users cannot exercise their data rights
- Only web users can partially clear data

**Fix Required:**
```javascript
// api/user-data.js — NEW FILE NEEDED
app.delete('/api/user-data', async (req, res) => {
  const { line_user_id } = req.body;
  // Delete from: chat_messages, emotion_alerts, sessions, etc.
});

app.get('/api/user-data/export', async (req, res) => {
  const { line_user_id } = req.query;
  // Return JSON with all user data
});
```

---

## 🔶 GAP #6: Age Consent Mismatch - Proposal vs Implementation

### Proposal Claim (หน้า 5, 11)
> "ได้รับความยินยอมจากผู้ปกครองก่อนการเก็บรวบรวมข้อมูลของนักเรียน**อายุต่ำกว่า 20 ปี**"  
> "Parental consent required for students **under 20 years old**"

### Implementation Reality
**Status:** ⚠️ **Age threshold mismatch: <18 instead of <20**

**Evidence:**
```tsx
// client/src/App.tsx:1107 — Guardian consent page
เนื่องจากคุณอายุต่ำกว่า 18 ปี เราจำเป็นต้องได้รับความยินยอมจากผู้ปกครอง
// ❌ Says "under 18" but proposal says "under 20"
```

**Database Schema Follows Proposal Correctly:**
```sql
-- api/migrations/001_new_schema.sql:36
parental_consent_at TIMESTAMPTZ,  -- required for under-20
-- ✅ Comment says "under-20" (matches proposal)
```

**Legal Context:**
- **PDPA Section 26:** Children = under 20 years old (ผู้เยาว์ = อายุต่ำกว่า 20 ปี)
- **Proposal follows PDPA:** "under 20" is correct
- **Implementation uses 18:** Incorrect threshold

**Impact:**
- Students aged 18-19 not asked for parental consent
- Technically non-compliant with proposal's PDPA interpretation
- Inconsistency between claimed and actual age policy

**Fix Required:**
```tsx
// client/src/App.tsx:1107 — Change threshold
- เนื่องจากคุณอายุต่ำกว่า 18 ปี
+ เนื่องจากคุณอายุต่ำกว่า 20 ปี

// Also update guardian check logic
- if (parseInt(age) < 18) {
+ if (parseInt(age) < 20) {
```

---

## 📊 DATABASE ARCHITECTURE - READY BUT NOT ACTIVATED

### What's Built (But Not Used)

The team has **excellent database architecture prepared** in migration files:

**001_new_schema.sql (179 lines):**
- ✅ Anonymous user registry with UUID + hashed LINE IDs
- ✅ Emotion events tracking with source types
- ✅ Crisis alert system with `admin_notified` flag
- ✅ Homework events tracking
- ✅ Schools table for org subscriptions
- ✅ Daily emotion summary aggregation
- ✅ PDPA consent tracking fields

**002_production_ready.sql (now enabled, 383 lines):**
- ✅ Performance indexes for scale
- ✅ Data integrity constraints
- ✅ Soft delete support
- ✅ API latency tracking
- ✅ Data retention cleanup function (90-day PDPA compliance)
- ✅ Database health monitoring views

**Why It Was Disabled (and now fixed):**
```bash
# Original 002 referenced non-existent columns (user_id/content) and ran
# top-level statements on chat_messages, which is created lazily at runtime —
# so it failed on a fresh database and was renamed .disabled.
# Rewritten 2026-08-16: every chat_messages touch is guarded by DO $$ +
# to_regclass/information_schema checks; views created via EXECUTE $v$.
# Re-enabled as 002_production_ready.sql — runs automatically via migrate.js.
```

**Current State:**
- `001_new_schema.sql` — active (guarded chat_messages ALTER added)
- `002_production_ready.sql` — ✅ **enabled** (rewritten, guarded)
- `003_scheduled_cleanup.sql.disabled` — stays disabled (pg_cron needs superuser); use `SELECT * FROM cleanup_old_data(90)` manually
- `004_anonymize_existing.sql` — ✅ **added** (hashes existing raw IDs at next deploy)

**Why This Matters:**
The team clearly **understands PDPA requirements** and built proper architecture, but:
1. Didn't activate it before deployment
2. Claims in proposal assume this schema is active
3. Gap between "ready to deploy" and "actually deployed"

---

## 📋 SUMMARY TABLE

| Issue | Proposal Claim | Implementation Reality | Severity | Fix Effort |
|-------|----------------|------------------------|----------|------------|
| **AES-256 Encryption** | "ข้อมูลถูกเข้ารหัส AES-256" | Code exists, never used | 🔴 CRITICAL | 2 hours |
| **Anonymous Storage** | "ใช้ hash แทน LINE ID" | Stores raw LINE IDs | 🔴 CRITICAL | 4 hours |
| **Rate Limiting** | "มีระบบ Rate Limiting" | Not implemented at all | 🔴 CRITICAL | 1 hour |
| **Email Alerts** | "แจ้งเตือนผู้ดูแล" | SMTP broken, alerts unsent | 🔴 CRITICAL | 30 mins |
| **PDPA Delete API** | "ลบข้อมูลได้ทุกเมื่อ" | No API endpoint | ⚠️ HIGH | 3 hours |
| **Age Consent** | "ต่ำกว่า 20 ปี" | Checks <18 instead | ⚠️ MEDIUM | 15 mins |

> **Post-fix status (2026-08-16):** all six rows above are now **fixed in code** — see the ✅ FIX STATUS table at the top of this document. Remaining risk is deployment-side only (GitLab variables + SMTP credentials).

**Total Fix Effort:** ~10.75 hours to bring implementation in line with proposal

---

## 🔧 RECOMMENDED ACTIONS

### ✅ Already Implemented (2026-08-16)
1. `api/privacy.js` — AES-256-GCM encrypt/decrypt + SHA-256 hashId, wired into `webhook.js`, `history.js`, `admin-db.js`, `guardian-email.js`, `send-otp.js`
2. `api/notify.js` — crisis alerts recorded in `emotion_alerts` + admin email
3. `api/rate-limit.js` — global + strict limiters mounted in `index.js`
4. `api/user-data.js` — PDPA export/delete endpoints mounted in `index.js`
5. Migrations: `002_production_ready.sql` enabled (rewritten, all guards fixed), `004_anonymize_existing.sql` added
6. Age threshold `< 20` + web UI delete/export wired to the API

### ⏳ Remaining at Deploy Time
1. Set real `APP_SMTP_PASS` in GitLab CI/CD Variables (masked) — alerts currently skip email if placeholder detected
2. Set `APP_ENCRYPTION_KEY` (≥ 32 chars, masked) — without it the app stores plaintext with a startup warning
3. Set `APP_ADMIN_EMAIL` (defaults to `SMTP_USER`)
4. Deploy; verify migrations 002 + 004 applied (check `schema_migrations`)

---

## 💡 WHY THIS HAPPENED (Hypothesis)

Looking at the code structure:

1. **Time Pressure:** Advanced features built but not integrated before hackathon deadline
2. **Migration Strategy:** Team prepared production-ready schema but didn't migrate from MVP schema
3. **Environment Setup:** SMTP credentials placeholder never updated for production
4. **Dual Schema:** Old `history.js` (active) vs new `001_new_schema.sql` (prepared but unused)

The team has **strong engineering skills** (excellent migration architecture, proper PDPA design), but **deployment execution** didn't match proposal claims.

---

## ✅ VERIFICATION CHECKLIST

**Done (verified locally, 2026-08-16):**
- [x] `encryptText`/`decryptText` round-trip works (`api/privacy.js` test)
- [x] Legacy plaintext rows pass through `decryptText` unchanged
- [x] `hashId` produces 64-char SHA-256 hex
- [x] `node --check` passes on all modified API files
- [x] `tsc --noEmit` clean (client)
- [x] `vite build` clean
- [x] Global + strict rate limiters active (13× POST /send-otp → 10× 503, 3× 429)
- [x] `/health` exempt from rate limiting (8× → all 200)
- [x] App boots with DB absent (health 200)
- [x] Client age threshold now `< 20`; web delete/export call the new API

**Still to verify at deploy/staging:**
- [ ] `chat_messages.text` — should be AES-GCM ciphertext (after setting `APP_ENCRYPTION_KEY`)
- [ ] `line_user_id` columns contain only 64-char hashes (after `004_anonymize_existing` runs)
- [ ] `emotion_alerts WHERE admin_notified = FALSE` — 0 rows once SMTP works
- [ ] Test `DELETE /api/user-data` — verify data deleted server-side
- [ ] Test `GET /api/user-data/export` — verify JSON export works
- [ ] Send 121 requests in 15 mins — verify global rate limit triggers
- [ ] Enter age 19 in web app — verify guardian consent requested
- [ ] Check GitLab CI/CD Variables — verify `APP_ENCRYPTION_KEY`, `APP_SMTP_PASS`, `APP_ADMIN_EMAIL` set & masked

---

## 📞 SUPPORT CONTACTS

If questions about PDPA compliance:
- **PDPC Thailand:** https://www.pdpc.or.th
- **Hackathon Organizers:** Check guide for contact info

**Estimated Time to Full Compliance:** 1-2 working days

---

**Report Generated:** 2026-08-16  
**Reviewed By:** Claude Code (Deep Review Analysis)  
**Methodology:** Line-by-line code verification + database schema analysis + proposal cross-reference
