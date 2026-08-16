# JaiKraJok (ใจกระจก)

เพื่อนช่วยเรียนบน LINE ที่เข้าใจอารมณ์นักเรียน — AI for Thai Hackathon 2026 (ทีม 07)

## ระบบที่ deploy

| รายการ | ที่อยู่ |
|---|---|
| เว็บแอปพลิเคชัน | https://team07.aiforthai.in.th |
| API | https://team07.aiforthai.in.th/api |
| ดู Log เรียลไทม์ (Dozzle) | https://team07.aiforthai.in.th/logs/ |
| GitLab Repository | https://gitlab.nectec.or.th/ai4thai-service-hackathon/07/jaikrajok.git |

## ฟีเจอร์

- 💬 แชทกับ LLM (ThaiLLM-8b) เข้าใจอารมณ์ — ตอบด้วยน้ำเสียงอบอุ่นเป็นภาษาไทย
- 📸 ส่งรูปถ่ายการบ้าน → ระบบ OCR + เฉลยทีละขั้นตอน
- 📸 ส่งเซลฟี่ → วิเคราะห์อารมณ์จากใบหน้า และติดตามแนวโน้มอารมณ์รายวัน
- 🎙️ ส่งข้อความเสียง → แปลงเสียงเป็นข้อความ (ptm-asr-1) แล้วตอบกลับ
- 📊 ดูกราฟแนวโน้มอารมณ์ย้อนหลัง
- 🔔 ระบบแจ้งเตือนผู้ดูแลอัตโนมัติเมื่อนักเรียนมีอารมณ์เชิงลบต่อเนื่องหรือเสี่ยงวิกฤต (human-in-the-loop + อีเมลแจ้งเตือน)
- 🔐 PDPA — ผู้ใช้ส่งออก / ลบข้อมูลตนเองได้

## สถาปัตยกรรม

```
LINE / ผู้ใช้ → nginx → web (React + Vite) ──┐
                                          ├─► api (Node/Express) ──► PostgreSQL 16
                       LINE Webhook ───────┘          │
                                                      ├─► ThaiLLM-8b (tokenmind.pathumma.in.th)
                                                      ├─► Pathumma (api.aiforthai.in.th)
                                                      ├─► ptm-asr-1 (Speech-to-Text)
                                                      ├─► ssense (Sentiment)
                                                      ├─► Vaja9 (Text-to-Speech)
                                                      ├─► Typhoon (OCR / วิเคราะห์ภาพ)
                                                      └─► SearXNG (ค้นหาเว็บ)
```

## โครงสร้างโปรเจกต์

```
├── api/                 # Backend API (Node.js + Express)
│   ├── index.js         # ทางเข้าหลัก + health check + rate limiting
│   ├── webhook.js       # LINE Bot webhook (ข้อความ/รูป/เสียง)
│   ├── migrations/      # SQL migrations (001–004)
│   └── *.js             # Proxy แต่ละ AI service
├── client/              # Web frontend (React + Vite + shadcn/ui)
├── server/              # Node server สำหรับเว็บ (SSE, session)
├── components/          # UI components
├── docker-compose.yml   # web + api + db (postgres:16)
├── .gitlab-ci.yml       # Pipeline: check → deploy → smoke → ops
└── SUBMISSION.md        # เอกสารยืนยันครบ 8 ข้อสำหรับการส่งงาน
```

## การพัฒนาในเครื่อง

```bash
# ติดตั้ง dependencies
pnpm install

# รัน frontend dev
pnpm dev

# ตรวจ type
pnpm check

# ทดสอบ AI ทั้งหมด (ต้องมี api/.env)
pnpm test:ai
```

## การ Deploy

Deploy อัตโนมัติผ่าน GitLab CI/CD ทุกครั้งที่ push `main`:

1. **check** — ตรวจสอบ docker-compose.yml (พอร์ต, healthcheck, memory limit)
2. **deploy** — `docker compose up -d --build` บน runner ของทีม
3. **smoke** — ทดสอบ AI ทุกตัวผ่าน URL สาธารณะ (health, db-health, webhook signature, LLM, OCR, ASR, sentiment, search)

Secrets ทั้งหมด (API keys, LINE tokens, database URL) เก็บใน GitLab CI/CD Variables (`APP_*` prefix) และ `.env` ในเครื่อง — ไม่มีใน repository

## API หลัก

| Endpoint | ใช้ทำอะไร |
|---|---|
| `GET /health` | สถานะระบบ + ฐานข้อมูล |
| `GET /db-health` | สถานะ migration / ตาราง |
| `POST /webhooks/line` | Webhook LINE Bot |
| `POST /thaillm/v1/chat/completions` | แชท ThaiLLM-8b |
| `POST /typhoon/v1/chat/completions` | Typhoon (OCR / fallback) |
| `POST /ptm-asr/audio/transcriptions` | เสียง → ข้อความ |
| `POST /ssense` | วิเคราะห์อารมณ์ |
| `POST /vaja` | Text-to-Speech |
| `POST /search` | ค้นหาเว็บ |
| `POST /history` | ประวัติการสนทนา |
| `GET /user-data/export` | ส่งออกข้อมูล (PDPA) |
| `DELETE /user-data` | ลบข้อมูล (PDPA) |

## ความปลอดภัย

- LINE signature verification (HMAC-SHA256) ทุก webhook
- Rate limiting (120/15 นาที/IP, 10/15 นาทีสำหรับ endpoint แพง)
- Admin dashboard ป้องกันด้วย secret
- เข้ารหัสข้อมูลผู้ใช้ AES-256-GCM, hash line_user_id
- Security headers (CSP, HSTS, nosniff, frame-ancestors)
- Healthcheck + auto-restart + retry/backoff สำหรับ AI upstream

## ผู้ดูแลระบบ

- GitLab CI/CD job กลุ่ม ops: `logs`, `ps`, `restart`, `migrate`, `shell-cmd`, `reset-db`
- Dozzle ดู log: https://team07.aiforthai.in.th/logs/
- Admin dashboard: https://team07.aiforthai.in.th/api/admin-db
- อีเมลแจ้งเตือนอัตโนมัติเมื่อมีสัญญาณวิกฤต/อารมณ์เชิงลบต่อเนื่อง

## เอกสารเพิ่มเติม

- [SUBMISSION.md](SUBMISSION.md) — เอกสารยืนยันครบ 8 ข้อสำหรับการส่งงาน