import express from "express";
import webhookHandler from "./webhook.js";
import historyHandler from "./history.js";
import ssenseHandler from "./ssense.js";
import tavilyHandler from "./tavily.js";
import pathummaHandler from "./pathumma.js";
import typhoonHandler from "./typhoon.js";
import thaillmHandler from "./thaillm.js";
import ptmAsrHandler from "./ptm-asr.js";
import lineTokenHandler from "./line-token.js";
import sendOtpHandler from "./send-otp.js";
import guardianEmailHandler from "./guardian-email.js";
import adminDbHandler from "./admin-db.js";
import { runMigrations } from "./migrate.js";

// Strip APP_ prefix injected by CI so handlers read env vars normally
// e.g. APP_DATABASE_URL → DATABASE_URL
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("APP_")) {
    const unprefixed = key.slice(4);
    if (!process.env[unprefixed]) process.env[unprefixed] = value;
  }
}

const app = express();

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

// ── Health check (required by CI pipeline) ──────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Raw-body handlers — register BEFORE express.json() ───────────────────────
// webhook reads raw body itself for LINE signature verification
app.post("/webhook", webhookHandler);

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

// ── JSON-body handlers ────────────────────────────────────────────────────────
app.all("/history", historyHandler);
app.post("/ssense", ssenseHandler);
app.post("/tavily", tavilyHandler);
app.all(["/thaillm", "/thaillm/*"], thaillmHandler);

app.post("/send-otp", sendOtpHandler);
app.post("/guardian-email", guardianEmailHandler);

// ── Admin DB inspection (read-only, secret-protected) ────────────────────────
app.get("/admin-db", adminDbHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8000;

runMigrations()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`JaiKraJok API listening on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Startup migration failed — aborting:", err.message);
    process.exit(1);
  });
