import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

function vitePluginStorageProxy(): Plugin {
  return {
    name: "manus-storage-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/manus-storage", async (req, res) => {
        const key = req.url?.replace(/^\//, "");
        if (!key) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing storage key");
          return;
        }

        const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
        const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

        if (!forgeBaseUrl || !forgeKey) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Storage proxy not configured");
          return;
        }

        try {
          const forgeUrl = new URL("v1/storage/presign/get", forgeBaseUrl + "/");
          forgeUrl.searchParams.set("path", key);

          const forgeResp = await fetch(forgeUrl, {
            headers: { Authorization: `Bearer ${forgeKey}` },
          });

          if (!forgeResp.ok) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Storage backend error");
            return;
          }

          const { url } = (await forgeResp.json()) as { url: string };
          if (!url) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Empty signed URL");
            return;
          }

          res.writeHead(307, { Location: url, "Cache-Control": "no-store" });
          res.end();
        } catch {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Storage proxy error");
        }
      });
    },
  };
}

/* Copy CollagePics into the built bundle so /collage/* resolves in production */
function vitePluginCollageBuild(): Plugin {
  const collagePicsDir = path.resolve(PROJECT_ROOT, "CollagePics");
  return {
    name: "collage-pics-build",
    closeBundle() {
      const outDir = path.resolve(PROJECT_ROOT, "dist", "public", "collage");
      fs.mkdirSync(outDir, { recursive: true });
      for (const f of fs.readdirSync(collagePicsDir)) {
        const src = path.join(collagePicsDir, f);
        if (!fs.statSync(src).isFile()) continue;
        fs.copyFileSync(src, path.join(outDir, f));
      }
    },
  };
}

/* Serve CollagePics directory at /collage/ */
function vitePluginCollagePics(): Plugin {
  const collagePicsDir = path.resolve(PROJECT_ROOT, "CollagePics");
  return {
    name: "collage-pics-serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/collage", (req, res, next) => {
        const filename = req.url?.replace(/^\//, "") ?? "";
        const filePath = path.join(collagePicsDir, filename);
        if (!filePath.startsWith(collagePicsDir)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }
        if (!fs.existsSync(filePath)) {
          return next();
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime: Record<string, string> = {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".webp": "image/webp",
          ".gif": "image/gif",
        };
        res.writeHead(200, {
          "Content-Type": mime[ext] ?? "application/octet-stream",
          "Cache-Control": "public, max-age=86400",
        });
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

import nodemailer from "nodemailer";

function vitePluginOtpEmail(): Plugin {
  return {
    name: "otp-email-sender",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/send-otp", async (req, res, next) => {
        if (req.method !== "POST") return next();

        let bodyStr = "";
        req.on("data", (chunk) => { bodyStr += chunk.toString(); });
        req.on("end", async () => {
          try {
            const { email, otp } = JSON.parse(bodyStr);
            if (!email || !otp) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: false, error: "Missing email or otp" }));
              return;
            }

            console.log(`[OTP Mailer] Sending OTP ${otp} to ${email}`);

            let transporter: nodemailer.Transporter;
            let fromEmail = "JaiKraJok <noreply@jaikrajok.app>";

            const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
            const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASS;

            if (smtpUser && smtpPass) {
              transporter = nodemailer.createTransport({
                service: "gmail",
                auth: { user: smtpUser, pass: smtpPass },
              });
              fromEmail = smtpUser;
            } else {
              // Create dynamic Ethereal test account for real SMTP message delivery & link generation
              const testAccount = await nodemailer.createTestAccount();
              transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                  user: testAccount.user,
                  pass: testAccount.pass,
                },
              });
              fromEmail = testAccount.user;
            }

            const info = await transporter.sendMail({
              from: fromEmail,
              to: email,
              subject: `[JaiKraJok] รหัสยืนยันตัวตนของคุณคือ ${otp}`,
              text: `สวัสดีครับ/ค่ะ\n\nรหัสยืนยันตัวตน 6 หลักของคุณสำหรับสมัครใช้งาน JaiKraJok คือ: ${otp}\n\nหากคุณไม่ได้ทำการสมัครกรุณาเพิกเฉยข้อความนี้\n\nขอบคุณครับ\nทีมงาน JaiKraJok`,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #F9F9F9; border-radius: 16px; max-width: 480px; margin: 0 auto; border: 1px solid #EBE5DC;">
                  <h2 style="color: #FF3366; margin-bottom: 8px;">JaiKraJok (กระจกสะท้อนใจ)</h2>
                  <p style="color: #333333; font-size: 14px;">สวัสดีครับ/ค่ะ,</p>
                  <p style="color: #555555; font-size: 14px;">รหัสยืนยัน 6 หลักสำหรับการสมัครสมาชิกของคุณคือ:</p>
                  <div style="background-color: #FFFFFF; border: 2px solid #FF3366; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #FF3366;">${otp}</span>
                  </div>
                  <p style="color: #888888; font-size: 12px;">รหัสนี้มีอายุใช้งาน 10 นาที หากคุณไม่ได้ส่งคำขอ กรุณาเพิกเฉยอีเมลฉบับนี้</p>
                </div>
              `,
            });

            const previewUrl = nodemailer.getTestMessageUrl(info) || null;
            console.log(`[OTP Mailer] Sent successfully to ${email}. MessageId: ${info.messageId}`);
            if (previewUrl) console.log(`[OTP Mailer] Preview URL: ${previewUrl}`);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, messageId: info.messageId, previewUrl }));
          } catch (err: any) {
            console.error("[OTP Mailer] Error sending mail:", err);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: err.message || String(err) }));
          }
        });
      });
    },
  };
}

function vitePluginSsenseDev(): Plugin {
  return {
    name: "ssense-dev-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/ssense", async (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (chunk) => { body += chunk.toString(); });
        req.on("end", async () => {
          try {
            const { text } = JSON.parse(body);
            if (!text) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing text" }));
              return;
            }
            const params = new URLSearchParams({ text });
            const upstream = await fetch("https://api.aiforthai.in.th/ssense", {
              method: "POST",
              headers: {
                "Apikey": process.env.PATHUMMA_API_KEY ?? "",
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: params.toString(),
            });
            const data = await upstream.json().catch(() => ({}));
            res.writeHead(upstream.status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(data));
          } catch (e: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // loadEnv with prefix='' loads ALL vars (not just VITE_) into process.env
  const env = loadEnv(mode, path.resolve(import.meta.dirname), '');
  // Explicitly populate process.env so proxy configure callbacks can read them
  Object.assign(process.env, env);

  const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector(), vitePluginStorageProxy(), vitePluginCollagePics(), vitePluginCollageBuild(), vitePluginOtpEmail(), vitePluginSsenseDev()];

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    envDir: path.resolve(import.meta.dirname),
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      strictPort: false,
      host: true,
      proxy: {
        '/api/pathumma': {
          target: 'https://api.aiforthai.in.th',
          changeOrigin: true,
          secure: true,
          rewrite: (path: string) => path.replace(/^\/api\/pathumma/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Apikey', env.PATHUMMA_API_KEY ?? '');
            });
          },
        },
        '/api/thaillm': {
          target: 'http://thaillm.or.th',
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path.replace(/^\/api\/thaillm/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.THAILLM_API_KEY ?? ''}`);
            });
          },
        },
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path: string) => {
            const stripped = path.replace(/^\/api\/gemini/, '');
            const sep = stripped.includes('?') ? '&' : '?';
            return `${stripped}${sep}key=${env.GEMINI_API_KEY ?? ''}`;
          },
        },
        '/api/typhoon': {
          target: 'https://api.opentyphoon.ai',
          changeOrigin: true,
          secure: true,
          rewrite: (path: string) => path.replace(/^\/api\/typhoon/, ''),
        },
        '/api/tavily': {
          target: 'https://api.tavily.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path: string) => path.replace(/^\/api\/tavily/, ''),
        },
      },
      allowedHosts: [
        ".manuspre.computer",
        ".manus.computer",
        ".manus-asia.computer",
        ".manuscomputer.ai",
        ".manusvm.computer",
        "localhost",
        "127.0.0.1",
      ],
      fs: {
        strict: false,
        deny: ["**/.*"],
      },
    },
  };
});
