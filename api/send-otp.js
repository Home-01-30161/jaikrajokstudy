import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, otp } = req.body ?? {};
  if (!email || !otp) return res.status(400).json({ error: "Missing email or otp" });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"JaiKraJok" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "รหัส OTP สำหรับ JaiKraJok",
    text: `รหัส OTP ของคุณคือ: ${otp}\n\nรหัสนี้จะหมดอายุใน 10 นาที`,
    html: `<p>รหัส OTP ของคุณคือ: <strong>${otp}</strong></p><p>รหัสนี้จะหมดอายุใน 10 นาที</p>`,
  });

  res.status(200).json({ ok: true });
}
