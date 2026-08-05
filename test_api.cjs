const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = "AxWkjqnznABZt1yPSsvEVveqIEibC48k";

async function fetchPathumma(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function testTextQA() {
  console.log("--- Testing TextQA ---");
  const data = new URLSearchParams({
    instruction: "สวัสดี",
    system_prompt: "คุณคือผู้ช่วย",
    max_new_tokens: "50",
    temperature: "0.4"
  }).toString();

  try {
    const res = await fetchPathumma('https://api.aiforthai.in.th/textqa/completion', {
      method: 'POST',
      headers: {
        'Apikey': API_KEY,
        'X-lib': 'jaikrajok-web',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
      },
      body: data
    });
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${res.data.substring(0, 200)}`);
  } catch (e) {
    console.error("TextQA Error:", e.message);
  }
}

async function runTests() {
  await testTextQA();
}

runTests();
