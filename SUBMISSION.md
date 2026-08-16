# 📋 เอกสารยืนยันครบ 8 ข้อ — JaiKraJok (ทีม 07)

> เพื่อนช่วยเรียนบน LINE ที่เข้าใจอารมณ์นักเรียน — AI for Thai Hackathon 2026

---

## (1/8) ✅ Service ถูก deploy บน infra ของ AI for Thai แล้ว

| รายการ | ข้อมูล |
|---|---|
| **เว็บแอปพลิเคชัน** | https://team07.aiforthai.in.th |
| **GitLab Repository** | https://gitlab.nectec.or.th/ai4thai-service-hackathon/07/jaikrajok.git |
| **Pipeline ล่าสุด (Active)** | Commit `4a39935` — "Re-trigger GitLab CI build and deployment for image attachment fix" |
| **ระบบ CI/CD** | GitLab CI Runner `team-07` — push `main` → deploy อัตโนมัติ |

**Pipeline อัตโนมัติ:**
```
check  → ตรวจสอบ docker-compose.yml (พอร์ต, healthcheck, memory limit)
deploy → docker compose up -d --build (อัตโนมัติเมื่อ push main)
smoke  → ทดสอบ AI ทุกตัวผ่าน URL สาธารณะจริง
ops    → คำสั่งดูแลระบบแบบ manual (logs / restart / migrate / reset-db)
```

---

## (2/8) ✅ เรียกใช้งานผ่าน Endpoint / API สาธารณะได้จริง

**Base URL:** `https://team07.aiforthai.in.th/api`

| Endpoint | ใช้ทำอะไร |
|---|---|
| `GET /health` | เช็คว่าระบบ + ฐานข้อมูลทำงาน |
| `GET /db-health` | เช็คฐานข้อมูล + migration สำเร็จ |
| `POST /webhooks/line` | Webhook ของ LINE Bot (ข้อความ/รูป/เสียง) |
| `POST /thaillm/v1/chat/completions` | แชทด้วย ThaiLLM-8b |
| `POST /typhoon/v1/chat/completions` | Typhoon (OCR / ข้อความสำรอง) |
| `POST /ptm-asr/audio/transcriptions` | แปลงเสียงเป็นข้อความ (ptm-asr-1) |
| `POST /ssense` | วิเคราะห์อารมณ์ข้อความ |
| `POST /vaja` | Text-to-Speech เสียงไทย (Vaja9) |
| `POST /search` | ค้นหาเว็บ (SearXNG) |
| `POST /history` | ประวัติการสนทนา |
| `GET /user-data/export` | ส่งออกข้อมูลผู้ใช้ (PDPA) |
| `DELETE /user-data` | ลบข้อมูลผู้ใช้ (PDPA) |

**ตัวอย่างการเรียกใช้:**
```bash
# เช็คสถานะระบบ
curl https://team07.aiforthai.in.th/api/health
# → {"status":"ok","db":"ok"}

# แชทกับ ThaiLLM-8b
curl -X POST https://team07.aiforthai.in.th/api/thaillm/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"thaillm-8b","messages":[{"role":"user","content":"ตอบว่า ok"}]}'
```

---

## (3/8) ✅ ใช้ Pathumma LLM และบริการ AI for Thai

| บริการ AI for Thai | ใช้ในระบบ |
|---|---|
| **Pathumma LLM** (`api.aiforthai.in.th`) | Proxy สำหรับเรียก Pathumma |
| **ThaiLLM-8b** (`tokenmind.pathumma.in.th`) | LLM หลักของบอทแชท |
| **ptm-asr-1** (`tokenmind.pathumma.in.th`) | แปลงเสียงพูดเป็นข้อความ |
| **ssense** (`api.aiforthai.in.th/ssense`) | วิเคราะห์อารมณ์/ความรู้สึกข้อความ |
| **Vaja9** (`api.aiforthai.in.th/vaja9`) | สังเคราะห์เสียงพูดภาษาไทย |

นอกจากนี้ใช้ **Typhoon** (`api.opentyphoon.ai`) สำหรับ OCR รูปการบ้านและการวิเคราะห์ภาพ — ทั้งหมดเชื่อมต่อผ่านคีย์ที่เก็บใน GitLab CI/CD Variables อย่างปลอดภัย

---

## (4/8) ✅ ผ่านการทดสอบ Smoke Test / ใช้งาน end-to-end

Pipeline มี job `smoke-test` รันอัตโนมัติหลัง deploy ทุกครั้ง และ**ผ่านทั้งหมด**:

```
── /health ──────────────────────────────────────────  ✅ health
── thaillm-8b (primary text LLM) ────────────────────  ✅ thaillm-8b
── typhoon-v2.5-30b-a3b-instruct (text fallback) ────  ✅ typhoon-text
── ssense (sentiment analysis) ──────────────────────  ✅ ssense
── typhoon-ocr (vision/OCR) — 64×64 white PNG ───────  ✅ typhoon-ocr
── ptm-asr-1 (speech-to-text) — silent WAV ──────────  ✅ ptm-asr-1
── /api/search (SearXNG web search) ─────────────────  ✅ search (SearXNG)
✅  All smoke tests passed
```

**การทดสอบเพิ่มเติมที่ pipeline ตรวจ (เวอร์ชันล่าสุด):**
- `GET /db-health` — ตรวจว่า migration สำเร็จจริง (ไม่ใช่แค่เว็บขึ้น)
- `POST /webhooks/line` ด้วย signature ปลอม → ต้องตอบ `401` (ตรวจ route + การยืนยันตัวตน)
- ทุกคำสั่งมี `--max-time` กันค้าง และตรวจผลลัพธ์จริง (`"role":"assistant"`) ไม่ใช่แค่ HTTP 200

**ทดสอบ end-to-end จริง:** ส่งข้อความ / รูปถ่ายการบ้าน / เสียง ผ่าน LINE Bot → ระบบตอบกลับบน LINE ได้จริง (แชท, เฉลยการบ้านจากรูป, วิเคราะห์อารมณ์, แปลงเสียง)

---

## (5/8) ✅ มี API Key/Auth และตั้งค่า Security เรียบร้อย

| มาตรการ | รายละเอียด |
|---|---|
| **LINE Signature Verification** | ตรวจ `x-line-signature` ด้วย HMAC-SHA256 ก่อนประมวลผล webhook → signature ผิดตอบ 401 ทันที |
| **Rate Limiting** | 120 requests/15 นาที/IP ทั่วไป, 10/15 นาที สำหรับ endpoint ที่แพง |
| **Admin Dashboard ล็อก** | `/admin-db` ต้องมี `ADMIN_SECRET` ถึงดูได้ |
| **เข้ารหัสข้อมูลผู้ใช้** | AES-256-GCM (iv + authTag + salt) — ข้อมูลละเอียดอ่อนไม่อยู่ในรูปข้อความเปล่า |
| **ไม่เก็บข้อมูลระบุตัวตนตรง ๆ** | `line_user_id` ถูก hash (SHA-256) ในตารางวิเคราะห์อารมณ์ |
| **PDPA / สิทธิ์ผู้ใช้** | endpoint ส่งออกข้อมูล (`/user-data/export`) และลบข้อมูล (`DELETE /user-data`) |
| **Security Headers** | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy |
| **Keys ไม่รั่วไหล** | API keys ทั้งหมดอยู่ใน GitLab CI/CD Variables (`APP_*`) — `.env` ถูก gitignore |

---

## (6/8) ✅ มีเอกสาร Deploy + วิธีเรียกใช้ API

เอกสารทั้งหมดอยู่ใน repository:

| ไฟล์ | เนื้อหา |
|---|---|
| `README.md` | ภาพรวมโปรเจกต์: ฟีเจอร์, สถาปัตยกรรม, วิธีรันในเครื่อง, การ deploy, API, ความปลอดภัย |
| `.gitlab-ci.yml` | Pipeline ครบถ้วน: check → deploy → smoke → ops (อ่านว่า deploy อย่างไร) |
| `docker-compose.yml` | 3 services: web, api, db (postgres 16) + healthcheck + restart policy |
| `SUBMISSION.md` | เอกสารฉบับนี้ — ยืนยันครบ 8 ข้อ |
| `api/` | โค้ด API ทั้งหมด — แต่ละไฟล์มี comment อธิบาย endpoint และการเรียกใช้ |

**วิธีเรียกใช้ API:** ดูตารางในข้อ (2/8) — REST ปกติ ใช้ `curl` หรือ Postman ได้ทันที

---

## (7/8) ✅ ระบบเสถียร ไม่ล่มระหว่างทดสอบ

| มาตรการ | รายละเอียด |
|---|---|
| **Healthcheck อัตโนมัติ** | Docker ตรวจ `/health` ทุก 15 วินาที — ถ้าไม่ healthy จะ restart เอง (`restart: unless-stopped`) |
| **ตรวจฐานข้อมูลด้วย** | `/health` เช็ค DB ด้วย (`SELECT 1`) — migration พังหรือ DB ตายจะถูกจับได้ทันที |
| **Resilience ต่อ API ล่ม** | Typhoon OCR/วิเคราะห์ภาพมี retry + backoff (2 ครั้ง), timeout 30–40 วิ |
| **Retry การเชื่อมต่อ** | ThaiLLM retry อัตโนมัติเมื่อเจอ 502/503 |
| **Log จำกัดขนาด** | `max-size: 50m` ป้องกัน disk เต็ม |
| **Smoke test หลัง deploy ทุกครั้ง** | จับปัญหาก่อนผู้ใช้เจอ |
| **การ migrate ปลอดภัย** | migration แบบ guarded (`IF NOT EXISTS`, ตรวจ column) รันใน transaction |

**หลักฐานการดูแลจริง:** ระหว่างพัฒนาเคยพบปัญหา 2 จุดที่ทำให้ระบบล่ม (migration 002 อ้าง column ผิด / API timeout ระหว่างวิเคราะห์รูป) — ทั้งคู่ถูกพบโดย pipeline/local test แก้และ deploy แล้ว พร้อมบันทึกใน commit history

---

## (8/8) ✅ มีผู้รับผิดชอบดูแลระบบหลัง Deploy

| ช่องทางดูแล | รายละเอียด |
|---|---|
| **GitLab CI/CD — Job กลุ่ม ops** (manual) | `logs`, `ps`, `restart`, `migrate`, `shell-cmd`, `reset-db` |
| **Dozzle ดู Log เรียลไทม์** | https://team07.aiforthai.in.th/logs/ — ดู log ทุก container ผ่านเว็บ |
| **Admin Dashboard** | https://team07.aiforthai.in.th/api/admin-db — ดูข้อความ, สัญญาณเตือนอารมณ์, แนวโน้มรายวัน |
| **แจ้งเตือนอีเมลอัตโนมัติ** | เมื่อนักเรียนมีอารมณ์เชิงลบต่อเนื่องหรือเสี่ยงวิกฤต → ส่งอีเมลแจ้งผู้ดูแล (human-in-the-loop) |
| **ผู้รับผิดชอบหลัก** | ทีม 07 — ผู้ดูแลระบบและผู้พัฒนา repository (จัดการผ่าน GitLab) |

---

### 📌 สรุป

**ครบ 8 ข้อ:** ✅ Deploy บน infra AI for Thai → ✅ ใช้งานผ่าน URL สาธารณะ → ✅ ใช้ Pathumma/AI for Thai หลายบริการ → ✅ Smoke test ผ่านอัตโนมัติทุก deploy → ✅ มี auth + security ครบ → ✅ มีเอกสาร deploy/API → ✅ เสถียร (healthcheck + retry + guarded migrations) → ✅ มีทีมดูแล (GitLab ops + Dozzle + email alert)