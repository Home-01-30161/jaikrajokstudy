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
import geminiHandler from "./gemini.js";
import sendOtpHandler from "./send-otp.js";
import guardianEmailHandler from "./guardian-email.js";
import adminDbHandler from "./admin-db.js";
import dbSeedTestHandler from "./db-seed-test.js";
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

// gemini uses req.url for path + req.body for JSON payload
app.all(["/gemini", "/gemini/*"], (req, res) => {
  req.url = "/api" + req.url;
  geminiHandler(req, res);
});

app.post("/send-otp", sendOtpHandler);
app.post("/guardian-email", guardianEmailHandler);

// ── Admin DB inspection (read-only, secret-protected) ────────────────────────
app.get("/admin-db", adminDbHandler);

// ── DB seed test (temp — remove after confirming tables work) ────────────────
app.get("/db-seed-test", dbSeedTestHandler);

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
