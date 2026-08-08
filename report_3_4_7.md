## 3.4.7 Sentiment Analysis และ Emotion Dashboard

ระบบวิเคราะห์อารมณ์ (Sentiment Analysis) ของแอปพลิเคชันประมวลผลแบบ 3 ชั้น (3-Layer Pipeline) ดังนี้

**ชั้นที่ 1 — Vision LLM Tag Parsing**
หากข้อความที่ได้รับมาจากการวิเคราะห์ภาพด้วย Pathumma VQA จะมีแท็ก `[อารมณ์: ...]` ฝังมาด้วย ระบบจะดึงค่าอารมณ์จากแท็กนี้โดยตรงโดยไม่เรียก API เพิ่มเติม

**ชั้นที่ 2 — SSense API (Primary)**
หากไม่มีแท็กจาก Vision LLM ระบบจะส่งข้อความ (ไม่เกิน 500 ตัวอักษร) ไปยัง SSense API จากแพลตฟอร์ม AI For Thai ซึ่งพัฒนาโดย NECTEC ผ่าน Vercel Serverless Function (`/api/ssense`) SSense API รับข้อความภาษาไทยเป็น Input ในรูปแบบ `application/x-www-form-urlencoded` และส่งคืนผลลัพธ์เป็น JSON ที่มีโครงสร้างดังนี้

```json
{
  "sentiment": {
    "polarity": "positive",
    "score": "75"
  }
}
```

โดย `polarity` มี 3 ค่า ได้แก่ `positive`, `negative` และ `neutral` และ `score` คือค่าความเชื่อมั่น (Confidence Score) เป็นเปอร์เซ็นต์ในรูปแบบ String

การส่งคำขอดำเนินการผ่าน Vercel Serverless Function เพื่อปกป้อง API Key ไม่ให้ปรากฏในฝั่ง Client โดย API Key จะถูกเก็บไว้ใน Environment Variable ฝั่ง Server (`PATHUMMA_API_KEY`) และแนบไปใน Request Header `Apikey` ก่อนส่งต่อไปยัง Endpoint `https://api.aiforthai.in.th/ssense`

**ชั้นที่ 3 — Local Keyword Fallback**
หาก SSense API ไม่สามารถเชื่อมต่อได้หรือส่งคืนผลลัพธ์ที่ไม่ถูกต้อง ระบบจะใช้ฟังก์ชัน `classifyMoodFromText()` ซึ่งตรวจสอบ Keyword ภาษาไทยในข้อความเพื่อจำแนกอารมณ์ในระดับ Positive, Negative หรือ Neutral แทน

---

ผลลัพธ์จากการวิเคราะห์อารมณ์ทั้ง 3 ช่องทางข้างต้นจะถูกบันทึกลงใน Local Storage ของผู้ใช้พร้อม Timestamp และนำไปแสดงผลใน Emotion Dashboard ซึ่งรวบรวมข้อมูลอารมณ์จากทุกช่องทางการสื่อสารในระบบ ไม่ว่าจะเป็นข้อความสนทนา รูปภาพ Selfie หรือเสียงพูด

Dashboard แสดงผลในรูปแบบกราฟแนวโน้ม (Trend View) บนแกน Y ที่กำหนดค่าด้วย Valence Score ในช่วง 0.0 ถึง 1.0 โดยอ้างอิงแนวคิด Valence Dimension จากแบบจำลอง Russell's Circumplex Model of Affect (Russell, 1980) ที่อธิบายอารมณ์ความรู้สึกตามมิติเชิงบวก–เชิงลบ ระบบกำหนดค่า Valence Score คงที่ให้กับแต่ละอารมณ์ 4 ระดับ ดังนี้

| อารมณ์ | Valence Score |
|--------|:------------:|
| เชิงลบ (Negative) | 0.20 |
| ปกติ (Neutral) | 0.55 |
| ผ่อนคลาย (Calm) | 0.72 |
| สดใส / มีความสุข (Positive) | 0.90 |

การกำหนดค่าดังกล่าวทำให้ผู้ใช้และผู้ปกครองสามารถสังเกตแนวโน้มอารมณ์ในช่วงเวลาที่ผ่านมาได้อย่างเป็นรูปธรรม และช่วยส่งเสริมการตระหนักรู้ด้านสุขภาพจิต (Emotional Self-Awareness) ในระยะยาว

---

**อ้างอิง**

Russell, J. A. (1980). A circumplex model of affect. *Journal of Personality and Social Psychology, 39*(6), 1161–1178. https://doi.org/10.1037/h0077714
