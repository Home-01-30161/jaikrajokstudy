const fs = require('fs');
const https = require('https');

const API_KEY = "AxWkjqnznABZt1yPSsvEVveqIEibC48k";

async function testVQA() {
  return new Promise((resolve) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
    const imageBuffer = fs.readFileSync('face.jpg');
    const query = "บรรยายรูปภาพนี้เป็นภาษาไทย";

    let data = '';
    data += `--${boundary}\r\n`;
    data += `Content-Disposition: form-data; name="query"\r\n\r\n`;
    data += `${query}\r\n`;
    data += `--${boundary}\r\n`;
    data += `Content-Disposition: form-data; name="file"; filename="face.jpg"\r\n`;
    data += `Content-Type: image/jpeg\r\n\r\n`;

    const payloadEnd = `\r\n--${boundary}--\r\n`;

    const req = https.request('https://api.aiforthai.in.th/vqa/inference/', {
      method: 'POST',
      headers: {
        'Apikey': API_KEY,
        'X-lib': 'jaikrajok-web',
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      }
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${resData}`);
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(e);
      resolve();
    });
    
    req.write(data);
    req.write(imageBuffer);
    req.write(payloadEnd);
    req.end();
  });
}

testVQA();
