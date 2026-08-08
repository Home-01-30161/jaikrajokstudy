#!/usr/bin/env node
/**
 * run-tests.mjs — run all project tests and print a summary table.
 * Usage:  node run-tests.mjs
 * Reads API keys from .env automatically.
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

// ── helpers ──────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, cwd: ROOT, encoding: "utf8", timeout: 120_000, ...opts });
}

async function httpCheck(url, opts = {}) {
  const { method = "GET", headers = {}, body, timeoutMs = 15_000 } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: ctrl.signal,
    });
    const ms = Date.now() - t0;
    return { status: res.status, ms };
  } catch (e) {
    return { status: "ERR", ms: Date.now() - t0, err: e.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── result store ─────────────────────────────────────────────────────────────

const results = [];

function record(name, status, detail = "") {
  results.push({ name, status, detail });
  const icon = status === "PASS" ? "+" : status === "FAIL" ? "X" : status === "SKIP" ? "-" : "~";
  const pad = name.padEnd(28);
  process.stdout.write(`  [${icon}] ${pad} ${detail}\n`);
}

// ── tests ────────────────────────────────────────────────────────────────────

loadEnv();

console.log("\n=== JaiKraJok Test Suite ===\n");

// 1. TypeScript
process.stdout.write("Running TypeScript...\n");
{
  const r = run("npx tsc --noEmit");
  const errors = (r.stdout + r.stderr).split("\n").filter(l => l.includes("error TS")).length;
  if (errors === 0) record("TypeScript", "PASS", "0 type errors");
  else record("TypeScript", "FAIL", `${errors} type error(s)`);
}

// 2. ESLint
process.stdout.write("Running ESLint...\n");
{
  const r = run("npx eslint client/src --ext .ts,.tsx --format json");
  try {
    const out = (r.stdout || "").trim();
    const json = JSON.parse(out.slice(out.indexOf("[")));
    const errors = json.reduce((s, f) => s + f.errorCount, 0);
    const warns  = json.reduce((s, f) => s + f.warningCount, 0);
    record("ESLint", errors === 0 ? "PASS" : "FAIL", `${errors} errors, ${warns} warnings`);
  } catch {
    const clean = (r.stdout + r.stderr).replace(/npm warn[^\n]*/g, "").trim();
    record("ESLint", clean === "" ? "PASS" : "FAIL", clean === "" ? "0 errors" : "parse error — see output");
  }
}

// 3. Vitest
process.stdout.write("Running Vitest...\n");
{
  const r = run("npx vitest run --reporter=verbose", { timeout: 60_000 });
  const out = r.stdout + r.stderr;
  const passed = (out.match(/✓|passed/g) || []).length;
  const failed = (out.match(/✗|failed/g) || []).length;
  const mPassed = out.match(/Tests\s+(\d+) passed/);
  const mFailed = out.match(/(\d+) failed/);
  const p = mPassed ? +mPassed[1] : passed;
  const f = mFailed ? +mFailed[1] : 0;
  record("Vitest", f === 0 ? "PASS" : "FAIL", `${p} passed, ${f} failed`);
}

// 4. npm audit
process.stdout.write("Running npm audit...\n");
{
  const r = run("npm audit --json");
  try {
    const out = (r.stdout || "").trim();
    const json = JSON.parse(out.slice(out.indexOf("{")));
    const v = json?.metadata?.vulnerabilities ?? {};
    const total = (v.total ?? 0);
    const critical = v.critical ?? 0;
    const high = v.high ?? 0;
    const status = critical > 0 ? "FAIL" : high > 0 ? "WARN" : "PASS";
    record("npm audit", status,
      `total ${total} (critical ${critical}, high ${high}, moderate ${v.moderate ?? 0}, low ${v.low ?? 0}) — dev only`);
  } catch {
    record("npm audit", "WARN", "could not parse output");
  }
}

// 5. Playwright E2E + axe
process.stdout.write("Running Playwright + axe...\n");
{
  // line reporter gives clean stdout; capture stderr separately for axe console.log output
  const r = run("npx playwright test tests/app.spec.ts --reporter=line 2>&1", { timeout: 90_000 });
  const out = r.stdout + r.stderr;

  // axe violation count from console output
  const mViol = out.match(/Total violations:\s*(\d+)/);
  const violations = mViol ? +mViol[1] : null;

  // critical axe violations
  const criticals = (out.match(/\[critical\]/g) || []).length;

  // playwright pass/fail from line reporter summary "N passed"
  const mPass = out.match(/(\d+) passed/);
  const mFail = out.match(/(\d+) failed/);
  const passed = mPass ? +mPass[1] : 0;
  const failed = mFail ? +mFail[1] : 0;

  const e2eStatus = failed === 0 ? "PASS" : "FAIL";
  record("Playwright E2E", e2eStatus, `${passed} passed, ${failed} failed`);

  if (violations !== null) {
    const axeStatus = criticals > 0 ? "FAIL" : violations === 0 ? "PASS" : "WARN";
    record("axe a11y (WCAG 2.2)", axeStatus, `${violations} violation(s) — ${criticals} critical`);
  } else {
    record("axe a11y (WCAG 2.2)", "WARN", "could not parse violation count");
  }
}

// 6–11. API latency
process.stdout.write("Checking APIs...\n");
{
  const thaillmKey  = process.env.THAILLM_API_KEY  ?? "";
  const geminiKey   = process.env.GEMINI_API_KEY   ?? "";
  const tavilyKey   = process.env.TAVILY_API_KEY   ?? "";
  const typhoonKey  = process.env.TYPHOON_ASR_KEY  ?? process.env.TYPHOON_API_KEY ?? "";
  const pathummaKey = process.env.PATHUMMA_API_KEY ?? "";

  // ThaiLLM — 3 requests, avg
  const thaiBody = JSON.stringify({
    model: "pathumma-thaillm-qwen3-8b-think-3.0.0",
    messages: [{ role: "user", content: "1+1=?" }],
    max_tokens: 20,
    stream: false,
  });
  const thaiTimes = [];
  let thaiStatus = 0;
  for (let i = 0; i < 3; i++) {
    const res = await httpCheck("http://thaillm.or.th/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${thaillmKey}` },
      body: thaiBody,
      timeoutMs: 30_000,
    });
    thaiStatus = res.status;
    thaiTimes.push(res.ms);
  }
  const avg = Math.round(thaiTimes.reduce((a, b) => a + b, 0) / thaiTimes.length);
  record("ThaiLLM API", thaiStatus === 200 ? "PASS" : "FAIL",
    `HTTP ${thaiStatus} | avg ${avg} ms (${thaiTimes.map(t => t + "ms").join(", ")})`);

  // Gemini — 3 requests via Vercel proxy (key stored server-side)
  const geminiBody = JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] });
  const geminiTimes = [];
  let geminiStatus = 0;
  for (let i = 0; i < 3; i++) {
    const res = await httpCheck(
      `https://jaikrajokstudy.vercel.app/api/gemini/v1beta/models/gemini-2.0-flash-lite:generateContent`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: geminiBody }
    );
    geminiStatus = res.status;
    geminiTimes.push(res.ms);
  }
  const geminiAvg = Math.round(geminiTimes.reduce((a, b) => a + b, 0) / geminiTimes.length);
  record("Gemini API", geminiStatus === 200 ? "PASS" : "FAIL",
    `HTTP ${geminiStatus} | avg ${geminiAvg} ms (${geminiTimes.map(t => t + "ms").join(", ")})`);

  // Tavily — 3 requests, avg
  const tavilyBody = JSON.stringify({ query: "test", max_results: 1 });
  const tavilyTimes = [];
  let tavilyStatus = 0;
  for (let i = 0; i < 3; i++) {
    const res = await httpCheck("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tavilyKey}` },
      body: tavilyBody,
    });
    tavilyStatus = res.status;
    tavilyTimes.push(res.ms);
  }
  const tavilyAvg = Math.round(tavilyTimes.reduce((a, b) => a + b, 0) / tavilyTimes.length);
  record("Tavily API", tavilyStatus === 200 ? "PASS" : "FAIL",
    `HTTP ${tavilyStatus} | avg ${tavilyAvg} ms (${tavilyTimes.map(t => t + "ms").join(", ")})`);

  // Typhoon — 3 requests, avg
  const typhoonTimes = [];
  let typhoonStatus = 0;
  for (let i = 0; i < 3; i++) {
    const res = await httpCheck("https://api.opentyphoon.ai/v1/models", {
      headers: { Authorization: `Bearer ${typhoonKey}` },
    });
    typhoonStatus = res.status;
    typhoonTimes.push(res.ms);
  }
  const typhoonAvg = Math.round(typhoonTimes.reduce((a, b) => a + b, 0) / typhoonTimes.length);
  record("Typhoon ASR API", typhoonStatus === 200 ? "PASS" : "FAIL",
    `HTTP ${typhoonStatus} | avg ${typhoonAvg} ms (${typhoonTimes.map(t => t + "ms").join(", ")})`);

  // Pathumma VQA — 3 requests, avg (422 = alive, no image sent — expected)
  const pathuTimes = [];
  let pathuStatus = 0;
  for (let i = 0; i < 3; i++) {
    const res = await httpCheck("https://api.aiforthai.in.th/vqa/inference/", {
      method: "POST",
      headers: { Apikey: pathummaKey },
    });
    pathuStatus = res.status;
    pathuTimes.push(res.ms);
  }
  const pathuAvg = Math.round(pathuTimes.reduce((a, b) => a + b, 0) / pathuTimes.length);
  const pathuOk = pathuStatus === 422 || pathuStatus === 200;
  record("Pathumma VQA API", pathuOk ? "PASS" : "FAIL",
    `HTTP ${pathuStatus} | avg ${pathuAvg} ms (${pathuTimes.map(t => t + "ms").join(", ")})`);

  // Vercel site — 3 requests, avg
  const vercelTimes = [];
  let vercelStatus = 0;
  for (let i = 0; i < 3; i++) {
    const res = await httpCheck("https://jaikrajokstudy.vercel.app/");
    vercelStatus = res.status;
    vercelTimes.push(res.ms);
  }
  const vercelAvg = Math.round(vercelTimes.reduce((a, b) => a + b, 0) / vercelTimes.length);
  record("Vercel site (TTFB)", vercelStatus === 200 ? "PASS" : "FAIL",
    `HTTP ${vercelStatus} | avg ${vercelAvg} ms (${vercelTimes.map(t => t + "ms").join(", ")})`);
}

// 12. Promptfoo LLM eval
process.stdout.write("Running Promptfoo...\n");
{
  const thaillmKey = process.env.THAILLM_API_KEY ?? "";
  if (!thaillmKey) {
    record("Promptfoo LLM eval", "SKIP", "VITE_THAILLM_API_KEY not set");
  } else {
    const tmpConfig = resolve(ROOT, ".promptfoo_run_tmp.yaml");
    const base = readFileSync(resolve(ROOT, "promptfoo.yaml"), "utf8");
    writeFileSync(tmpConfig, base.replace("${THAILLM_API_KEY}", thaillmKey));
    const r = run(`npx promptfoo eval -c ${tmpConfig} --no-cache`, { timeout: 120_000 });
    unlinkSync(tmpConfig);
    const out = r.stdout + r.stderr;
    const mPass = out.match(/(\d+) passed/);
    const mFail = out.match(/(\d+) failed/);
    const mErr  = out.match(/(\d+) errors/);
    const passed = mPass ? +mPass[1] : 0;
    const failed = mFail ? +mFail[1] : 0;
    const errors = mErr  ? +mErr[1]  : 0;
    const pct = mPass ? out.match(/(\d+)%/)?.[1] : "?";
    record("Promptfoo LLM eval", failed === 0 && errors === 0 ? "PASS" : "FAIL",
      `${passed} passed, ${failed} failed, ${errors} errors (${pct}%)`);
  }
}

// 13. k6
process.stdout.write("Checking k6...\n");
{
  const r = run("k6 version");
  if (r.status !== 0) {
    record("k6 load test", "SKIP", "k6 not found — install with: winget install k6");
  } else {
    const ver = (r.stdout || "").split("\n")[0].trim();
    const r2 = run(`k6 run ${resolve(ROOT, "load-test.js")} -e THAILLM_API_KEY=${process.env.THAILLM_API_KEY ?? ""}`, { timeout: 120_000 });
    const out = r2.stdout + r2.stderr;
    const mReqs = out.match(/http_reqs[^\d]+(\d[\d,]+)/);
    const mP95  = out.match(/p\(95\)=([^\s]+)/);
    const mFail = out.match(/checks[^\d]+(\d+\.\d+)%/);
    const failed = r2.status !== 0;
    record("k6 load test", failed ? "FAIL" : "PASS",
      `reqs ${mReqs?.[1] ?? "?"} | p95 ${mP95?.[1] ?? "?"} | ${ver}`);
  }
}

// 14. OWASP ZAP
process.stdout.write("Checking OWASP ZAP (Docker)...\n");
{
  const dockerCheck = run("docker info");
  if (dockerCheck.status !== 0) {
    record("OWASP ZAP", "SKIP", "Docker not running — start Docker Desktop and re-run");
  } else {
    const r = run(
      "docker run --rm ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://jaikrajokstudy.vercel.app/ -I",
      { timeout: 300_000 }
    );
    const out = r.stdout + r.stderr;
    const mWarn = out.match(/WARN-NEW:\s*(\d+)/);
    const mPass = out.match(/PASS:\s*(\d+)/);
    const mHigh = out.match(/FAIL-NEW:\s*(\d+)/);
    const high  = mHigh  ? +mHigh[1]  : 0;
    const warns = mWarn  ? +mWarn[1]  : "?";
    const pass  = mPass  ? +mPass[1]  : "?";
    record("OWASP ZAP", high === 0 ? "PASS" : "FAIL",
      `${high} high | ${warns} warn | ${pass} pass`);
  }
}

// ── summary table ─────────────────────────────────────────────────────────────

const PASS   = results.filter(r => r.status === "PASS").length;
const FAIL   = results.filter(r => r.status === "FAIL").length;
const WARN   = results.filter(r => r.status === "WARN").length;
const SKIP   = results.filter(r => r.status === "SKIP").length;
const WIDTH  = 80;
const SEP    = "─".repeat(WIDTH);

console.log(`\n${"═".repeat(WIDTH)}`);
console.log(" TEST RESULTS SUMMARY");
console.log(`${"═".repeat(WIDTH)}`);
console.log(` ${"Test".padEnd(28)} ${"Status".padEnd(8)} Detail`);
console.log(` ${SEP}`);

for (const { name, status, detail } of results) {
  const icon = { PASS: "PASS", FAIL: "FAIL", WARN: "WARN", SKIP: "SKIP" }[status] ?? status;
  console.log(` ${name.padEnd(28)} ${icon.padEnd(8)} ${detail}`);
}

console.log(` ${SEP}`);
console.log(` Total: ${results.length}  |  PASS ${PASS}  FAIL ${FAIL}  WARN ${WARN}  SKIP ${SKIP}`);
console.log(`${"═".repeat(WIDTH)}\n`);

process.exit(FAIL > 0 ? 1 : 0);
