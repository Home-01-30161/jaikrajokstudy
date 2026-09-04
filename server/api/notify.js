// ─────────────────────────────────────────────────────────────────────────────
// notify.js — Human-in-the-loop: emotion alert recording + admin email
//
// 1. recordAlert() inserts a row into emotion_alerts (anonymized user id).
// 2. Sends an email to ADMIN_EMAIL when SMTP is configured, then marks
//    admin_notified = TRUE.
//
// If SMTP is not configured (placeholder/missing creds), the alert is STILL
// recorded in the DB and a clear warning is logged — the chat flow must never
// break because email fails.
// ─────────────────────────────────────────────────────────────────────────────
import nodemailer from "nodemailer";
import { hashId } from "./privacy.js";

const sbUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || "";
const PLACEHOLDER_PASS = /^(your-|changeme|xxxx|replace)/i;
let warnedSmtp = false;

export function getSmtpCredentials() {
  const user = process.env.APP_SMTP_USER || process.env.SMTP_USER;
  const pass = process.env.APP_SMTP_PASS || process.env.SMTP_PASS;
  return { user, pass };
}

/** True when SMTP credentials are real (not placeholders). */
export function isSmtpConfigured() {
  const { user, pass } = getSmtpCredentials();
  if (!user || !pass) return false;
  if (PLACEHOLDER_PASS.test(pass) || pass.includes("your-gmail-app-password")) return false;
  return true;
}

/**
 * Record a crisis / continuous-negative alert and notify the human admin.
 * Never throws — failures are logged so the LINE chat keeps working.
 */
export async function recordAlert({ userId, alert_type, consecutive_negative, message_shown_to_user }) {
  const lineUserIdHash = hashId(userId);
  let alertId = null;

  if (sbUrl() && sbKey()) {
    try {
      const res = await fetch(`${sbUrl()}/rest/v1/emotion_alerts`, {
        method: "POST",
        headers: {
          apikey:         sbKey(),
          Authorization:  `Bearer ${sbKey()}`,
          "Content-Type": "application/json",
          Prefer:         "return=representation",
        },
        body: JSON.stringify({
          line_user_id_hash:      lineUserIdHash,
          alert_type,
          consecutive_negative:   consecutive_negative ?? null,
          message_shown_to_user:  String(message_shown_to_user ?? "").slice(0, 500),
        }),
      });
      if (res.ok) {
        const rows = await res.json();
        alertId = Array.isArray(rows) ? rows[0]?.id ?? null : null;
      } else {
        console.warn("[notify] Supabase alert insert failed:", res.status);
      }
    } catch (err) {
      console.warn("[notify] Supabase alert record failed:", err.message);
    }
  } else {
    console.warn("[notify] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — DB record skipped");
  }

  const sent = await sendAdminEmail({
    alert_type,
    line_user_id_hash: lineUserIdHash,
    consecutive_negative,
    message_shown_to_user,
  });

  if (sent && alertId && sbUrl() && sbKey()) {
    await fetch(`${sbUrl()}/rest/v1/emotion_alerts?id=eq.${alertId}`, {
      method: "PATCH",
      headers: { apikey: sbKey(), Authorization: `Bearer ${sbKey()}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ admin_notified: true }),
    }).catch(() => {});
  }

  return { id: alertId, admin_notified: sent };
}

/** Send the admin alert email. Returns true on success, false otherwise. */
export async function sendAdminEmail({ alert_type, line_user_id_hash, consecutive_negative, message_shown_to_user }) {
  if (!isSmtpConfigured()) {
    if (!warnedSmtp) {
      console.warn(
        "[notify] SMTP not configured or password is a placeholder — " +
        "admin email NOT sent. Set APP_SMTP_USER + APP_SMTP_PASS (Gmail app password) in GitLab CI/CD variables."
      );
      warnedSmtp = true;
    }
    return false;
  }

  const { user, pass } = getSmtpCredentials();
  const adminEmail = process.env.ADMIN_EMAIL || process.env.APP_ADMIN_EMAIL || user;
  if (!adminEmail) {
    console.warn("[notify] no ADMIN_EMAIL set — falling back to SMTP user");
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    const alertLabel = alert_type === "crisis_signal" ? "🔴 สัญญาณวิกฤต (crisis)" : "⚠️ อารมณ์เชิงลบต่อเนื่อง (continuous_negative)";
    await transporter.sendMail({
      from: `"JaiKraJok" <${user}>`,
      to: adminEmail,
      subject: `${alertLabel} — JaiKraJok (user ${line_user_id_hash.slice(0, 12)}…)`,
      text: [
        `JaiKraJok — Human-in-the-loop alert`,
        ``,
        `Alert type:        ${alertLabel}`,
        `Anonymized user:   ${line_user_id_hash}`,
        `Consecutive:       ${consecutive_negative ?? "-"}`,
        `Message shown:     ${message_shown_to_user ?? "-"}`,
        ``,
        `กรุณาตรวจสอบที่ https://team07.aiforthai.in.th/api/admin-db (tab ⚠️ Alerts)`,
      ].join("\n"),
    });
    console.log(`[notify] admin email sent for alert (${alert_type})`);
    return true;
  } catch (err) {
    console.error("[notify] admin email failed:", err.message);
    return false;
  }
}