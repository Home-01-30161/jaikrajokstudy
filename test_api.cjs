const fs = require('fs');
const path = require('path');
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

async function testThaiLLM() {
  console.log("--- Testing ThaiLLM (New API) ---");
  const data = JSON.stringify({
    model: THAILLM_MODEL,
    messages: [
      {"role": "system", "content": "คุณคือผู้ช่วยสอนเรียน"},
      {"role": "user", "content": "สวัสดี"}
    ],
    max_tokens: 2048,
    temperature: 0.3
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
    console.log(`Response: ${res.data.substring(0, 500)}`);
  } catch (e) {
    console.error("ThaiLLM Error:", e.message);
  }
}

async function runTests() {
  await testThaiLLM();
}

runTests();