const http = require('http');

const THAILLM_API_KEY = "CkAPIGzjpSP7jgLmbrlD4P8yJ9SuOb4T";
const THAILLM_MODEL = "pathumma-thaillm-qwen3-8b-think-3.0.0";

async function fetchThaiLLM(url, options) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function testThaiLLM(message, systemPrompt) {
  console.log(`--- Testing: ${message.substring(0, 50)}... ---`);
  const data = JSON.stringify({
    model: THAILLM_MODEL,
    messages: [
      {"role": "system", "content": systemPrompt},
      {"role": "user", "content": message}
    ],
    max_tokens: 3072,
    temperature: 0.05
  });

  try {
    const res = await fetchThaiLLM('http://thaillm.or.th/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${THAILLM_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      body: data
    });
    console.log(`Status: ${res.status}`);
    const parsed = JSON.parse(res.data);
    const content = parsed.choices?.[0]?.message?.content || "";
    console.log(`Response:\n${content.substring(0, 3000)}`);
    console.log("---END---\n");
    return content;
  } catch (e) {
    console.error("Error:", e.message);
    return "";
  }
}

const MATH_SYSTEM_PROMPT =
  "คุณคือครูสอนพิเศษคณิตศาสตร์และวิทยาศาสตร์ผู้เชี่ยวชาญระดับสูง สร้างโดยทีม JaiKraJok " +
  "📐 กฎการจัดรูปแบบคำตอบ (Output Formatting Rules) — **บังคับปฏิบัติตลอด**: " +
  "1. **LaTeX Math**: ใช้ `$...$` สำหรับ inline math และ `$$...$$` สำหรับ display math **ทุกสูตรสมการ** " +
  "2. **Code Blocks**: ใช้ ```language\ncode\n``` พร้อมระบุภาษา " +
  "3. **Tables**: สร้างตาราง markdown แสดงขั้นตอนคำนวณ เปรียบเทียบตัวเลือก หรือสรุปผล " +
  "4. **Task Lists**: ใช้ `- [ ]` สำหรับขั้นตอนการแก้โจทย์ `- [x]` สำหรับขั้นตอนที่ทำเสร็จ " +
  "5. **Blockquotes**: ใช้ `> **คำแนะนำ**` เน้นเคล็ดลับ สูตรสำคัญ หรือข้อระวัง " +
  "6. **Headers**: ใช้ `##` `###` จัดโครงสร้าง: ## วิธีแก้, ## การคำนวณ, ## สรุปคำตอบ " +
  "7. **Bold**: ใช้ `**คำตอบสุดท้าย**` เน้นผลลัพธ์ " +
  "8. **Horizontal Rules**: ใช้ `---` แยกแต่ละขั้นตอนหลัก " +
  "กฎการตอบ (ห้ามเดาตัวเลข คำนวณจริงทีละขั้น): " +
  "1. ตอบเป็นภาษาไทย อธิบายละเอียด ทุกขั้นตอน ห้ามสุ่มหรือเดาคำตอบเด็ดขาด " +
  "2. สำหรับโจทย์เศษเหลือและการหาร: คำนวณ ค.ร.น. (LCM) ให้แม่นยำ บวกเศษกลับเข้าไป แล้วตรวจสอบเงื่อนไขขอบเขต " +
  "3. หากมีตัวเลือก ก. ข. ค. ง. ให้ตรวจทานคำตอบที่คำนวณได้กับตัวเลือกอย่างระมัดระวัง แล้วระบุข้อที่ถูกต้อง " +
  "4. แสดงสูตรและสมการด้วย LaTeX: inline ใช้ $...$ และ block ใช้ $$...$$ " +
  "5. สรุปคำตอบสุดท้ายในกรอบ $$...$$ และให้กำลังใจผู้เรียนเสมอ";

async function runTests() {
  // Test the exact problem from user
  await testThaiLLM(
    "หาผลบวกของจำนวนเต็มบวก n ที่ 1 < n < 1000 โดยที่ n ≡ 1 (mod 7), n ≡ 1 (mod 10), n ≡ 1 (mod 13)",
    MATH_SYSTEM_PROMPT
  );
}

runTests();