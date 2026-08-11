# 💬 LINE OA — Feature Ideas for JaiKrajok

> **ใจกระจก (JaiKrajok)** — LINE Official Account improvement roadmap  
> Team 07 · AI4Thai Hackathon

---

## สถานะปัจจุบัน (Current State)

| Feature | Status |
|---|---|
| Text → Sentiment + LLM reply | ✅ Done |
| Image → Face detection / OCR | ✅ Done |
| Audio → Speech-to-Text → LLM | ✅ Done |
| Sticker fallback | ✅ Done |
| Crisis detection + 1323 | ✅ Done |
| Menu shortcuts (1/2/3) | ✅ Done |

---

## 🟢 Easy Wins (1–2 ชั่วโมง)

### 1. Daily Check-in Push (เช็คอิน Morning Nudge)

ส่ง push message ทุกเช้า 8:00 น. ให้ผู้ใช้บอกอารมณ์ก่อนเริ่มวัน

**ตัวอย่างข้อความ:**
```
🌅 เช้านี้รู้สึกยังไงบ้าง?

1️⃣  😊 ดี / มีความสุข
2️⃣  😐 ปกติ
3️⃣  😣 เครียด / กังวล
4️⃣  😢 เศร้า / ท้อแท้
5️⃣  😴 เหนื่อยล้า

พิมพ์ตัวเลข 1-5 ได้เลย
```

**วิธี implement:**
- เพิ่ม scheduled task (cron) เรียก LINE Broadcast API ตี 8 เช้า
- Handle reply เป็น mood record ใน store.py

---

### 2. Rich Menu (ปุ่มเมนูด้านล่าง)

ทำ Rich Menu ติดอยู่ด้านล่าง LINE chat ผู้ใช้กดได้เลยโดยไม่ต้องพิมพ์

**Layout แนะนำ (2 แถว × 3 ปุ่ม):**

| 😊 เช็คอารมณ์ | 📷 ส่งรูป | 🎤 ส่งเสียง |
|---|---|---|
| 📊 ดูแนวโน้ม | ❓ ช่วยเรียน | 📋 เมนูหลัก |

**วิธี implement:**
- สร้าง Rich Menu ผ่าน LINE API ครั้งเดียว (ไม่ต้องแก้ backend)
- ใช้ LINE Official Account Manager หรือ API เพื่อ upload

---

### 3. Mood Summary Report (สรุปอารมณ์รายสัปดาห์)

เพิ่ม command `สรุป` หรือ `ดูอารมณ์ฉัน` ดึงข้อมูลจาก store.py มาสรุป

**ตัวอย่างข้อความ:**
```
📊 สรุปอารมณ์ของคุณ (7 วันที่ผ่านมา)
━━━━━━━━━━━━━━━
😊 สดใส        3 ครั้ง  ██████░░░░
😐 ปกติ        2 ครั้ง  ████░░░░░░
😣 เครียด      1 ครั้ง  ██░░░░░░░░
😢 เศร้า       0 ครั้ง  ░░░░░░░░░░
━━━━━━━━━━━━━━━
แนวโน้มโดยรวม: ดี 👍
รวมทั้งหมด 6 ครั้ง
```

**วิธี implement:**
- เพิ่ม keyword handler ใน `conversation.py`
- ดึงข้อมูลจาก `store.user_trend(user_id)`
- Format เป็น ASCII bar chart

---

### 4. Breathing Exercise (แบบฝึกหายใจผ่าน Text)

เพิ่ม command `หายใจ` หรือ `ลดเครียด` ส่งขั้นตอน 4-4-4

**ตัวอย่างข้อความ:**
```
🌬️ หายใจคลายเครียด 4-4-4
━━━━━━━━━━━━━━━
ทำช้า ๆ พร้อมกับกระจกนะ

สูดลมเข้า... 1 - 2 - 3 - 4
กลั้นไว้....  1 - 2 - 3 - 4
ผ่อนออก...   1 - 2 - 3 - 4

ทำซ้ำ 4 รอบ 🔄
รู้สึกดีขึ้นไหม? 😊

พิมพ์ "อีกรอบ" เพื่อทำซ้ำ
```

**วิธี implement:**
- เพิ่ม keyword handler ใน `conversation.py`
- ไม่ต้องแก้อะไร backend เพิ่ม

---

## 🟡 Medium (ครึ่งวัน)

### 5. Homework Photo → Formatted Step-by-Step Answer

ตอนนี้ OCR คืน raw text กลับ ปรับ LLM prompt ให้ format คำตอบเป็นขั้นตอนชัดขึ้น

**Before (ตอนนี้):**
```
อ่านข้อความจากภาพได้แล้ว:
[raw text block]
```

**After (เป้าหมาย):**
```
📚 กระจกอ่านโจทย์ได้แล้ว!
━━━━━━━━━━━━━━━
โจทย์: [สรุปโจทย์สั้น ๆ]

💡 แนวทางทำ:
ขั้นที่ 1: ...
ขั้นที่ 2: ...
ขั้นที่ 3: ...

❓ ลองทำดูก่อนนะ ถ้าติดตรงไหนพิมพ์ถามได้เลย
```

**วิธี implement:**
- แก้ `_OCR_PROMPT` ใน `line.py` ให้ระบุ format ชัดขึ้น

---

### 6. Concern Streak Alert (แจ้งเตือนเมื่อเครียดต่อเนื่อง)

ถ้า user ส่ง mood เชิงลบติดกัน 3 ครั้งขึ้นไป บอตส่ง proactive message

**ตัวอย่างข้อความ:**
```
🔔 กระจกสังเกตว่าช่วงนี้คุณดูหนักใจอยู่นิดหน่อย
ไม่เป็นไรนะ ทุกคนผ่านช่วงแบบนี้กันได้

อยากระบายอะไรไหม?
หรือลองโทร 1323 คุยกับผู้เชี่ยวชาญก็ได้นะ
📞 ฟรี 24 ชั่วโมง
```

**วิธี implement:**
- ดึง `store.concern_streak(user_id)` หลัง record mood
- ถ้า streak ≥ 3 append alert ต่อท้าย reply

---

### 7. Link to Web App (ปุ่มเปิดเว็บ)

ท้ายทุก reply เพิ่มลิงก์ไปหน้าเว็บสำหรับดู trend และ school view

**ตัวอย่าง:**
```
[LLM reply text]

─────────────────
🌐 ดูแนวโน้มอารมณ์แบบกราฟได้ที่:
https://team07.aiforthai.in.th
```

**วิธี implement:**
- เพิ่ม footer ใน `handle_text()` ใน `conversation.py`

---

## 🔵 Bigger Features (ต้องใช้เวลาและ LINE OA settings)

### 8. Flex Message — Menu หน้าตาสวย

แทนที่ text menu ด้วย Flex Message มีรูป สี ปุ่ม คล้าย web app

**วิธี implement:**
- ใช้ `FlexMessage` + `BubbleContainer` จาก linebot v3
- ออกแบบ JSON layout ผ่าน [LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/)

---

### 9. Carousel — เลือกวิธีเช็คอารมณ์

เมื่อ user พิมพ์ `อารมณ์` แสดง carousel 3 card:

| Card 1 | Card 2 | Card 3 |
|---|---|---|
| 💬 พิมพ์ข้อความ | 📷 ส่งเซลฟี่ | 🎤 ส่งเสียง |
| วิเคราะห์ sentiment | วิเคราะห์ใบหน้า | Speech-to-Text |
| [เลือก] | [เลือก] | [เลือก] |

---

### 10. Liff Mini App (Web ใน LINE)

เปิด web app ของทีมตรงใน LINE โดยไม่ต้องออกจากแอป

**วิธี implement:**
- Register LIFF app ใน LINE Developer Console
- ตั้ง endpoint ไปที่ `https://team07.aiforthai.in.th`
- เพิ่มปุ่ม LIFF ใน Rich Menu

---

## Priority สำหรับ Hackathon Demo

| Priority | Feature | Impact | Effort |
|---|---|---|---|
| 🥇 1 | Rich Menu (ปุ่มเมนู) | สูงมาก | ต่ำ |
| 🥈 2 | Mood Summary Report | สูง | ต่ำ |
| 🥉 3 | Breathing Exercise | กลาง | ต่ำมาก |
| 4 | Concern Streak Alert | สูง | ต่ำ |
| 5 | Homework Formatted Answer | กลาง | ต่ำ |
| 6 | Daily Check-in Push | สูง | กลาง |
| 7 | Flex Message | สูงมาก (visual) | กลาง |

---

*อัปเดต: 2026-08-11 · Team 07 JaiKrajok*
