import nodemailer from "nodemailer";
import { isSmtpConfigured, getSmtpCredentials } from "./notify.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { to_email, child_name, approval_link, verification_code } = req.body ?? {};
  if (!to_email || !approval_link) return res.status(400).json({ error: "Missing fields" });

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
      to: to_email,
      subject: "ขอความยินยอมผู้ปกครอง — JaiKraJok",
      html: `
        <div style="font-family: 'Noto Sans Thai', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1A1208; border-bottom: 2px solid #FF3366; padding-bottom: 10px;">ขอความยินยอมผู้ปกครอง</h2>

          <p>สวัสดีครับ/ค่ะ ผู้ปกครองของ <strong>${child_name ?? "บุตรหลานของคุณ"}</strong></p>

          <p>บุตรหลานของคุณต้องการใช้งาน <strong>JaiKraJok</strong> ซึ่งเป็นแอปพลิเคชันสุขภาพจิตสำหรับนักเรียน</p>

          <div style="background-color: #E3F2FD; border: 2px solid #2196F3; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; color: #1565C0; font-weight: 600;">รหัสยืนยันของคุณคือ:</p>
            <div style="font-family: monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #1A1208; background: white; padding: 15px; border: 2px solid #2196F3; border-radius: 4px; margin: 10px 0;">
              ${verification_code}
            </div>
            <p style="margin: 10px 0 0 0; color: #1565C0; font-size: 12px;">กรุณาบอกรหัสนี้กับบุตรหลานเพื่อยืนยันการใช้งาน</p>
          </div>

          <p style="margin: 20px 0;">กรุณากดปุ่มด้านล่างเพื่ออนุมัติการใช้งาน:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${approval_link}" style="display: inline-block; background-color: #2E7D32; color: white; padding: 15px 40px; text-decoration: none; font-weight: 700; border-radius: 4px; font-size: 16px;">
              อนุมัติการใช้งาน JaiKraJok
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #E0E0E0; margin: 30px 0;">

          <p style="color: #666; font-size: 13px; line-height: 1.6;">
            <strong>เกี่ยวกับ JaiKraJok:</strong><br>
            ข้อมูลทั้งหมดจัดเก็บในอุปกรณ์ของผู้ใช้เท่านั้น ไม่มีการส่งข้อมูลส่วนบุคคลออกนอกระบบ
            ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
          </p>

          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้
          </p>
        </div>
      `,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[guardian-email] send failed:", err.message);
    res.status(502).json({ error: "Email send failed", detail: err.message });
  }
}
