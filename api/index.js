import "dotenv/config";
import express from "express";
import webhookHandler from "./webhook.js";
import historyHandler from "./history.js";
import ssenseHandler from "./ssense.js";
import vajaHandler from "./vaja.js";
import tavilyHandler from "./tavily.js";
import searchHandler from "./search.js";
import pathummaHandler from "./pathumma.js";
import typhoonHandler from "./typhoon.js";
import thaillmHandler from "./thaillm.js";
import ptmAsrHandler from "./ptm-asr.js";
import lineTokenHandler from "./line-token.js";
import sendOtpHandler from "./send-otp.js";
import guardianEmailHandler from "./guardian-email.js";
import adminDbHandler from "./admin-db.js";
import { exportUserData, deleteUserData } from "./user-data.js";
import { globalLimiter, strictLimiter } from "./rate-limit.js";


// Strip APP_ prefix injected by CI so handlers read env vars normally
// e.g. APP_DATABASE_URL → DATABASE_URL
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("APP_")) {
    const unprefixed = key.slice(4);
    if (!process.env[unprefixed]) process.env[unprefixed] = value;
  }
}


const app = express();

// Rate limiting counts real client IPs. The api sits behind two proxies
// (hackathon reverse proxy → nginx container), so trust 2 proxy hops:
// req.ip = left-most X-Forwarded-For entry = the real client.
app.set("trust proxy", 2);
app.use(globalLimiter);

// ── Security headers (applied to every API response) ─────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // Narrow CSP for API — JSON/HTML responses only, no asset loading
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  try {
    if (supabaseUrl && serviceKey) {
      const r = await fetch(`${supabaseUrl}/rest/v1/chat_messages?limit=1`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        signal: AbortSignal.timeout(3000),
      });
      if (!r.ok) return res.status(503).json({ status: "degraded", db: "error" });
    }
    return res.json({ status: "ok", db: supabaseUrl ? "ok" : "not-configured" });
  } catch {
    return res.status(503).json({ status: "degraded", db: "error" });
  }
});

// ── Raw-body handlers — register BEFORE express.json() ───────────────────────
// webhook reads raw body itself for LINE signature verification
app.post("/webhook", webhookHandler);
app.post("/webhooks/line", webhookHandler);  // canonical URL: /api/webhooks/line

// line-token reads raw body manually via req.on("data")
app.post("/line-token", lineTokenHandler);

// ── Streaming proxy handlers — pipe req body directly, BEFORE json parser ────
app.all(["/pathumma", "/pathumma/*"], (req, res) => {
  req.url = "/api" + req.url;
  pathummaHandler(req, res);
});

app.all(["/typhoon", "/typhoon/*"], (req, res) => {
  req.url = "/api" + req.url;
  typhoonHandler(req, res);
});

app.all(["/ptm-asr", "/ptm-asr/*"], (req, res) => {
  req.url = "/api" + req.url;
  ptmAsrHandler(req, res);
});

// ── JSON body parser ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Stricter limits on abuse-prone / expensive endpoints ──────────────────────
app.use(["/send-otp", "/guardian-email", "/line-token"], strictLimiter);

// ── JSON-body handlers ────────────────────────────────────────────────────────
app.all("/history", historyHandler);
app.post("/ssense", ssenseHandler);
app.post("/vaja", vajaHandler);
app.post("/tavily", tavilyHandler);       // kept for backward compat
app.post("/search", searchHandler);       // SearXNG primary + Tavily fallback
app.all(["/thaillm", "/thaillm/*"], thaillmHandler);

app.post("/send-otp", sendOtpHandler);
app.post("/guardian-email", guardianEmailHandler);

// ── Admin DB inspection (read-only, secret-protected) ────────────────────────
app.get("/admin-db", adminDbHandler);

// ── PDPA data rights: export / erasure ───────────────────────────────────────
app.get("/user-data/export", exportUserData);
app.delete("/user-data", deleteUserData);

// Vercel serverless entry-point.
// All /api/* traffic is rewritten to this single function.
// Vercel strips the /api prefix before calling the handler,
// so we restore it so Express routes (e.g. "/webhook") match.
export default function handler(req, res) {
  // req.url comes in as the path AFTER /api, e.g. "/webhook"
  // Express routes are registered without /api prefix → works as-is.
  return app(req, res);
}
