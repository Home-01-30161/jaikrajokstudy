import nodemailer from "nodemailer";
import { isSmtpConfigured } from "./notify.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { to_email, child_name, approval_link } = req.body ?? {};
  if (!to_email || !approval_link) return res.status(400).json({ error: "Missing fields" });

  if (!isSmtpConfigured()) {
    return res.status(503).json({
      error: "SMTP not configured",
      hint: "Admin must set APP_SMTP_USER + APP_SMTP_PASS (Gmail app password) in GitLab CI/CD variables.",
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"JaiKraJok" <${process.env.SMTP_USER}>`,
      to: to_email,
      subject: "ขอความยินยอมผู้ปกครอง — JaiKraJok",
      html: `
        <p>สวัสดีครับ/ค่ะ ผู้ปกครองของ <strong>${child_name ?? "บุตรหลานของคุณ"}</strong></p>
        <p>บุตรหลานของคุณต้องการใช้งาน JaiKraJok กรุณากดลิงก์ด้านล่างเพื่ออนุมัติ</p>
        <p><a href="${approval_link}">อนุมัติการใช้งาน</a></p>
        <p>หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้</p>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[guardian-email] send failed:", err.message);
    res.status(502).json({ error: "Email send failed", detail: err.message });
  }
}