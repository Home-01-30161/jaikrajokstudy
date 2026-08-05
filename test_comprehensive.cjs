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
    temperature: 0.4
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
    console.log(`Response:\n${content.substring(0, 2000)}`);
    console.log("---END---\n");
  } catch (e) {
    console.error("Error:", e.message);
  }
}

const JAIKRAJOK_SYSTEM_PROMPT =
  "คุณคือ กระจก (JaiKraJok) ผู้ช่วยสอนเรียนและเพื่อนคู่คิดอัจฉริยะ สร้างโดยทีม JaiKraJok " +
  "ตอบเป็นภาษาไทยอย่างสุภาพ อบอุ่น ชัดเจน ครอบคลุม ละเอียดลึกซึ้งในระดับมืออาชีพ " +
  "📐 กฎการจัดรูปแบบคำตอบ (Output Formatting Rules) — **บังคับปฏิบัติตลอด**: " +
  "1. **LaTeX Math**: ใช้ `$...$` สำหรับ inline math และ `$$...$$` สำหรับ display math ทุกสูตรสมการ " +
  "2. **Code Blocks**: ใช้ ```language\ncode\n``` พร้อมระบุภาษา (python, cpp, javascript, typescript, java, go, rust, sql, bash, json, yaml, markdown, html, css) " +
  "3. **Tables**: สร้างตาราง markdown เมื่อเปรียบเทียบข้อมูล หรือแสดงขั้นตอนคำนวณ `| Header1 | Header2 |\n|---|---|\n| A | B |` " +
  "4. **Task Lists**: ใช้ `- [ ]` และ `- [x]` สำหรับขั้นตอนหรือรายการตรวจสอบ " +
  "5. **Blockquotes**: ใช้ `> quote` สำหรับข้อความสำคัญ คำพูด หรือคำแนะนำ " +
  "6. **Headers**: ใช้ `##` `###` จัดโครงสร้างคำตอบเป็นหัวข้อย่อย " +
  "7. **Bold/Italic**: ใช้ `**bold**` และ `*italic*` เน้นจุดสำคัญ " +
  "8. **Links**: ใช้ `[text](url)` สำหรับอ้างอิงแหล่งข้อมูล " +
  "9. **Horizontal Rules**: ใช้ `---` แยกส่วนที่เกี่ยวข้อง " +
  "10. **Mermaid**: ใช้ ```mermaid\n...``` สำหรับแผนภาพ กราฟ หรือลำดับขั้นตอน ";

async function runTests() {
  // Test 1: Math problem
  await testThaiLLM(
    "แก้สมการ x^2 - 5x + 6 = 0 หาค่า x",
    JAIKRAJOK_SYSTEM_PROMPT
  );

  // Test 2: Programming tutorial
  await testThaiLLM(
    "สอน Python พื้นฐาน 5 หัวข้อ",
    JAIKRAJOK_SYSTEM_PROMPT
  );

  // Test 3: General question with formatting
  await testThaiLLM(
    "อธิบายความแตกต่างระหว่าง array และ linked list",
    JAIKRAJOK_SYSTEM_PROMPT
  );
}

runTests();