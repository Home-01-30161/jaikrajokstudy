# How to Run All Tests — JaiKraJok

All commands run from the project root (`D:\JaiKraJokNECTEC`) unless noted.
Prerequisites: Node.js 18+, pnpm, a terminal, internet connection.

Before running API tests, set your keys as environment variables:

```powershell
# PowerShell
$env:THAILLM_API_KEY  = "your-thaillm-key"
$env:GEMINI_API_KEY   = "your-gemini-key"
$env:TAVILY_API_KEY   = "your-tavily-key"
$env:TYPHOON_API_KEY  = "your-typhoon-key"
$env:PATHUMMA_API_KEY = "your-pathumma-key"
```

```bash
# Bash / Git Bash
export THAILLM_API_KEY="your-thaillm-key"
export GEMINI_API_KEY="your-gemini-key"
export TAVILY_API_KEY="your-tavily-key"
export TYPHOON_API_KEY="your-typhoon-key"
export PATHUMMA_API_KEY="your-pathumma-key"
```

The actual key values are in your `.env` file (not committed to git).

---

## Quick reference

| # | Tool | Command | Measures |
|---|------|---------|----------|
| 1 | TypeScript | `npx tsc --noEmit` | Type errors |
| 2 | ESLint | `npx eslint client/src --ext .ts,.tsx` | Code quality, lint warnings |
| 3 | Vitest | `npx vitest run --reporter=verbose` | Unit test pass/fail, coverage |
| 4 | Playwright E2E + axe | `npx playwright test` | E2E flows, WCAG a11y violations |
| 5 | Lighthouse | `npx lighthouse https://jaikrajokstudy.vercel.app/ ...` | Performance, SEO, best practices |
| 6 | API latency | `curl` (Section 6) | Response time per external API |
| 7 | k6 load test | `k6 run load-test.js` | RPS, p95 latency, error rate |
| 8 | Promptfoo LLM eval | `npx promptfoo eval` | ThaiLLM response correctness % |
| 9 | OWASP ZAP | Docker (Section 9) | Security vulnerability count |
| 10 | npm audit | `npm audit` | Known CVEs in dependencies |
| 11 | Bundle size | `npm run build` | Output JS size |

---

## 1. TypeScript Type-Check

```powershell
npx tsc --noEmit
```

**What it reports:** Type error count. No output = 0 errors = pass.
**Last result:** 0 errors.

---

## 2. ESLint — Code Quality

Config is already set up (`eslint.config.js` at project root).

```powershell
npx eslint client/src --ext .ts,.tsx
```

**What it reports:** Error and warning count with file:line references.
**Last result:** 0 errors, 0 warnings.

To get a JSON report for your research data:
```powershell
npx eslint client/src --ext .ts,.tsx --format json --output-file eslint-report.json
```

---

## 3. Unit Tests — Vitest

```powershell
npx vitest run --reporter=verbose
```

With line/branch coverage:
```powershell
npx vitest run --coverage
```

Test file is at `client/src/pathummaApi.test.ts` — tests `hasApiKey()` and `classifyMoodFromText()`.

**What it reports:** Pass/fail per test, coverage % per file (lines / branches / functions).

---

## 4. E2E + Accessibility — Playwright + axe-core

Browsers are already installed. Two test files exist:

- `tests/app.spec.ts` — homepage load, title, body visibility, broken images, axe audit
- `tests/contrast.spec.ts` — detailed contrast violation data (selectors, fg/bg, ratios)

Run all tests:
```powershell
npx playwright test
```

Run only accessibility:
```powershell
npx playwright test tests/app.spec.ts
```

Run only contrast details:
```powershell
npx playwright test tests/contrast.spec.ts
```

View HTML report after a run:
```powershell
npx playwright show-report
```

**What it reports:**
- `app.spec.ts`: total axe violation count, severity (critical/serious/moderate/minor), WCAG criterion
- `contrast.spec.ts`: per-element selector, foreground color, background color, actual contrast ratio

**Note:** Tests run against the **live deployed site** (`https://jaikrajokstudy.vercel.app/`). After each Vercel deploy, re-run to confirm fixes are live.

---

## 5. Lighthouse — Performance, Accessibility, SEO

```powershell
npx lighthouse https://jaikrajokstudy.vercel.app/ `
  --output=json `
  --output-path=./lighthouse-report.json `
  --chrome-flags="--headless --no-sandbox --disable-gpu" `
  --only-categories=performance,accessibility,best-practices,seo
```

Read scores from the JSON:
```powershell
node -e "
const r = JSON.parse(require('fs').readFileSync('./lighthouse-report.json','utf8'));
Object.entries(r.categories).forEach(([k,v]) => console.log(k+':', Math.round(v.score*100)));
const a = r.audits;
['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','interactive'].forEach(k => {
  if(a[k]) console.log(a[k].title+':', a[k].displayValue);
});
"
```

**What it reports:** Scores 0–100 + Core Web Vitals (LCP, CLS, TBT, FCP, TTI).

To run against a local dev server instead:
```powershell
# Terminal 1
npm run dev

# Terminal 2
npx lighthouse http://localhost:5173 --output=html --output-path=./lighthouse-local.html --chrome-flags="--headless --no-sandbox"
```

---

## 6. API Response Time — All External APIs

Run each block and record the HTTP status and time for your report table.

### Site TTFB (5 requests)
```bash
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "Request $i: HTTP %{http_code} | TTFB: %{time_starttransfer}s | Total: %{time_total}s\n" \
    "https://jaikrajokstudy.vercel.app/" --max-time 15
done
```

### ThaiLLM (5 requests — record each)
```bash
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "Request $i: HTTP %{http_code} | %{time_total}s\n" \
    -X POST "http://thaillm.or.th/api/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $THAILLM_API_KEY" \
    -d '{"model":"pathumma-thaillm-qwen3-8b-think-3.0.0","messages":[{"role":"user","content":"1+1=?"}],"max_tokens":20,"stream":false}' \
    --max-time 30
done
```

### Gemini (expected 429 — free quota exhausted, no billing)
```bash
curl -s -o /dev/null -w "HTTP: %{http_code} | Time: %{time_total}s\n" \
  -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"hi"}]}]}' --max-time 15
```

### Tavily Search
```bash
curl -s -w "\nHTTP: %{http_code} | Time: %{time_total}s\n" \
  -X POST "https://api.tavily.com/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{"query":"test","max_results":1}' --max-time 15
```

### Typhoon ASR — models list (validates API key)
```bash
curl -s -o /dev/null -w "HTTP: %{http_code} | Time: %{time_total}s\n" \
  "https://api.opentyphoon.ai/v1/models" \
  -H "Authorization: Bearer $TYPHOON_API_KEY"
```

### Pathumma VQA — reachability check
422 = server alive, auth OK, no image payload sent. That is expected.
```bash
curl -s -o /dev/null -w "HTTP: %{http_code} | Time: %{time_total}s\n" \
  -X POST "https://api.aiforthai.in.th/vqa/inference/" \
  -H "Apikey: $PATHUMMA_API_KEY" \
  --max-time 10
```

---

## 7. Load Test — k6

`load-test.js` is already at the project root. It ramps to 10 virtual users over 100 seconds and hits both the site and ThaiLLM API.

If k6 is not installed:
```powershell
winget install k6
# Then restart your terminal, or add to PATH:
$env:PATH = $env:PATH + ";C:\Program Files\k6"
```

Run:
```powershell
k6 run load-test.js -e THAILLM_API_KEY=$env:THAILLM_API_KEY
```

**What it reports:** RPS, p50/p95/p99 latency per endpoint, error rate, total requests. Thresholds fail the test if p95 > 2 s or error rate > 1%.

---

## 8. LLM Quality — Promptfoo

`promptfoo.yaml` is already at the project root. It tests 4 Thai-language prompts against the ThaiLLM API.

```powershell
npx promptfoo eval
```

View results in browser:
```powershell
npx promptfoo view
```

**What it reports:** Pass/fail % per test case, actual model response vs expected assertion, response time.

---

## 9. Security Scan — OWASP ZAP

Requires Docker Desktop running.

```powershell
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py `
  -t https://jaikrajokstudy.vercel.app/ `
  -I
```

To save an HTML report:
```powershell
docker run --rm -v "${PWD}:/zap/wrk" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py `
  -t https://jaikrajokstudy.vercel.app/ `
  -r zap-report.html `
  -I
```

Report file appears at `zap-report.html` in the project root after the scan.

**What it reports:** Vulnerability count by risk level (High / Medium / Low / Informational) with CWE references.

**Last result:** 0 High, 0 Medium, 13 Warn (informational), 54 Pass. All critical security headers are now set in `vercel.json`.

---

## 10. Dependency Vulnerability Audit

```powershell
npm audit
```

Production-only (excludes devDependencies):
```powershell
npm audit --omit=dev
```

**What it reports:** CVE count by severity. Dev-only vulnerabilities do not affect the deployed site.

---

## 11. Bundle Size

```powershell
npm run build
```

**What it reports:** Each output file's raw size and gzip size. Look for `assets/index-*.js`. Vite warns when any chunk exceeds 500 KB.

---

## Results log — last full run

| # | Tool | Last result |
|---|------|-------------|
| 1 | TypeScript | 0 errors |
| 2 | ESLint | 0 errors, 0 warnings |
| 3 | Vitest | tests in `pathummaApi.test.ts` |
| 4 | Playwright + axe | 3 violations on old deploy (contrast, landmark, region) — fixed in code, re-run after next deploy |
| 5 | Lighthouse | Performance 61, A11y 95, SEO 83, Best Practices 96 |
| 6 | ThaiLLM API | HTTP 200, avg 354 ms |
| 6 | Gemini API | HTTP 429 — quota exhausted |
| 6 | Tavily API | HTTP 200, 1.29 s |
| 6 | Typhoon ASR | HTTP 200, 393 ms |
| 6 | Pathumma VQA | HTTP 422 (expected — no image sent) |
| 6 | Vercel TTFB | avg 145 ms |
| 7 | k6 load test | 10 VUs, 100 s — site + ThaiLLM |
| 8 | Promptfoo | 4 Thai-language test cases |
| 9 | OWASP ZAP | 0 High, 0 Medium, 13 Warn, 54 Pass |
| 10 | npm audit | 9 vulns — dev-only, not in production build |
| 11 | Bundle size | 746 KB raw / 222 KB gzip |

---

## After the next Vercel deploy

Re-run these two to verify all fixes are live:

```powershell
# Accessibility — should show 0 violations
npx playwright test tests/app.spec.ts

# Security headers — should show 0 missing-header alerts
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://jaikrajokstudy.vercel.app/ -I
```
