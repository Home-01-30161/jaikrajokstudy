// Run: k6 run load-test.js -e THAILLM_API_KEY=your-key
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '60s', target: 10 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.05'],
  },
}

export default function () {
  const r1 = http.get('https://jaikrajokstudy.vercel.app/')
  check(r1, { 'site status 200': (r) => r.status === 200 })

  const r2 = http.post(
    'http://thaillm.or.th/api/v1/chat/completions',
    JSON.stringify({
      model: 'pathumma-thaillm-qwen3-8b-think-3.0.0',
      messages: [{ role: 'user', content: 'สวัสดี' }],
      max_tokens: 20,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + __ENV.THAILLM_API_KEY,
      },
    }
  )
  check(r2, { 'ThaiLLM status 200': (r) => r.status === 200 })

  sleep(1)
}
