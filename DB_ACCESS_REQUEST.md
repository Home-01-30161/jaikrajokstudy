# ขอความช่วยเหลือ — เข้าถึง Database (team07)

สวัสดีครับทีมงาน 👋

ทีม **team07** มีปัญหาเล็กน้อยเรื่องการเข้าถึง database ครับ รบกวนสักครู่นะครับ

---

## ปัญหาที่เจอ

พยายามใช้ `shell-cmd` manual job เพื่อ query ตรวจสอบข้อมูลใน PostgreSQL ตามที่ระบุในคู่มือ (หัวข้อ 9) แต่ได้ error นี้ทุกครั้ง:

```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock.
Is the docker daemon running?
```

ค่าที่ตั้งไว้:
- `SERVICE` = `db`
- `CMD` = `psql -U app -d app -c "\dt+"`

---

## สิ่งที่ลองทำแล้ว

- ✅ `deploy` job ทำงานได้ปกติ แอปขึ้นมาแล้ว
- ✅ `ps` job — error เดียวกัน (docker socket ไม่ถูก mount ใน ops stage)
- ✅ ตั้งค่า `DOCKER_HOST: unix:///var/run/docker.sock` ใน `.gitlab-ci.yml` แล้ว
- ❌ `shell-cmd` ทุก ops job เข้าไม่ถึง Docker daemon

---

## สิ่งที่ต้องการ

อยากให้ช่วยอย่างใดอย่างหนึ่งครับ:

1. **แจ้งว่า runner สำหรับ ops stage mount Docker socket ได้ไหม** และต้องแก้อะไรใน `.gitlab-ci.yml` เพิ่มเติม

2. **หรือช่วยรัน query นี้ให้หน่อยได้ไหมครับ** (ฝาก ops ข้างในก็ได้ครับ):
   ```sql
   -- ตรวจสอบว่าตารางมีข้อมูลไหม
   SELECT COUNT(*) FROM chat_messages;

   -- ดู schema
   \d chat_messages
   ```

3. **หรือแนะนำวิธีอื่น** ในการ query database โดยไม่ต้องใช้ SSH ครับ
   (เช่น ขอเปิด Adminer ตามหัวข้อ 13 ก็ได้ครับ)

---

## ข้อมูลทีม

| | |
|---|---|
| ทีม | team07 |
| URL | https://team07.aiforthai.in.th |
| DB | PostgreSQL 16, database `app`, user `app` |
| Pipeline ที่มีปัญหา | ดูได้ที่ GitLab → Build → Pipelines |

ขอบคุณมากครับ 🙏
