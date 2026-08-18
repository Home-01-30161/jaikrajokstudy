import nodemailer from "nodemailer";
import { isSmtpConfigured, getSmtpCredentials } from "./notify.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, otp } = req.body ?? {};
  if (!email || !otp) return res.status(400).json({ error: "Missing email or otp" });

  if (!isSmtpConfigured()) {
    return res.status(503).json({
      error: "SMTP not configured",
      hint: "Admin must set APP_SMTP_USER + APP_SMTP_PASS (Gmail app password) in GitLab CI/CD variables.",
    });
  }

  const { user, pass } = getSmtpCredentials();

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"JaiKraJok" <${user}>`,
      to: email,
      subject: "รหัส OTP สำหรับ JaiKraJok",
      text: `รหัส OTP ของคุณคือ: ${otp}\n\nรหัสนี้จะหมดอายุใน 10 นาที`,
      html: `<p>รหัส OTP ของคุณคือ: <strong>${otp}</strong></p><p>รหัสนี้จะหมดอายุใน 10 นาที</p>`,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[send-otp] send failed:", err.message);
    res.status(502).json({ error: "Email send failed", detail: err.message });
  }
}