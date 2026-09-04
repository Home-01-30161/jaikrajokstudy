// rich-menu.js — Register the JaiKrajok LINE Rich Menu via Messaging API
// Run once: node api/rich-menu.js
// Requires: LINE_CHANNEL_ACCESS_TOKEN in environment

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("❌  LINE_CHANNEL_ACCESS_TOKEN not set");
  process.exit(1);
}

const BASE = "https://api.line.me";

// ── 1. Create rich menu ───────────────────────────────────────────────────────
// Image is 1343×810px (actual image dimensions — 3×2 grid)
// LINE requires width: 2500 or 1200, height must be ≤ 1686
// We declare 2500×1500 and LINE will scale our image to fit.

const richMenuBody = {
  size: { width: 2500, height: 1500 },
  selected: true,
  name: "JaiKrajok Main Menu",
  chatBarText: "เมนู",
  areas: [
    // Row 1 — top half (y 0..750)
    {
      // ส่งรูป (camera)
      bounds: { x: 0,    y: 0, width: 833, height: 750 },
      action: { type: "uri", uri: "https://line.me/R/nv/camera/" },
    },
    {
      // ส่งเสียง (voice)
      bounds: { x: 833,  y: 0, width: 834, height: 750 },
      action: { type: "message", text: "อยากส่งเสียง" },
    },
    {
      // การบ้าน (camera for homework)
      bounds: { x: 1667, y: 0, width: 833, height: 750 },
      action: { type: "uri", uri: "https://line.me/R/nv/camera/" },
    },
    // Row 2 — bottom half (y 750..1500)
    {
      // แนวโน้ม
      bounds: { x: 0,    y: 750, width: 833, height: 750 },
      action: { type: "message", text: "แนวโน้ม" },
    },
    {
      // ช่วยเหลือ
      bounds: { x: 833,  y: 750, width: 834, height: 750 },
      action: { type: "message", text: "ช่วยเหลือ" },
    },
    {
      // สายด่วน 1323
      bounds: { x: 1667, y: 750, width: 833, height: 750 },
      action: { type: "uri", uri: "tel:1323" },
    },
  ],
};

async function createRichMenu() {
  const res = await fetch(`${BASE}/v2/bot/richmenu`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(richMenuBody),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Create rich menu failed ${res.status}: ${err}`);
  }
  const { richMenuId } = await res.json();
  console.log("✅  Rich menu created:", richMenuId);
  return richMenuId;
}

// ── 2. Upload image ───────────────────────────────────────────────────────────

async function uploadImage(richMenuId, imagePath) {
  const imageBuffer = readFileSync(imagePath);
  const res = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "image/jpeg",
      },
      body: imageBuffer,
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload image failed ${res.status}: ${err}`);
  }
  console.log("✅  Image uploaded");
}

// ── 3. Set as default rich menu ───────────────────────────────────────────────

async function setDefault(richMenuId) {
  const res = await fetch(
    `${BASE}/v2/bot/user/all/richmenu/${richMenuId}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Set default failed ${res.status}: ${err}`);
  }
  console.log("✅  Set as default rich menu for all users");
}

// ── 4. Delete old rich menus (cleanup) ───────────────────────────────────────

async function deleteOldMenus(keepId) {
  const res = await fetch(`${BASE}/v2/bot/richmenu/list`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) return;
  const { richmenus } = await res.json();
  for (const m of richmenus) {
    if (m.richMenuId === keepId) continue;
    await fetch(`${BASE}/v2/bot/richmenu/${m.richMenuId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    console.log("🗑️   Deleted old menu:", m.richMenuId);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGE_PATH = join(__dirname, "../client/public/collage/rich_menu.jpg");

try {
  const richMenuId = await createRichMenu();
  await uploadImage(richMenuId, IMAGE_PATH);
  await setDefault(richMenuId);
  await deleteOldMenus(richMenuId);
  console.log("\n🎉  Rich menu is live! Users will see it in LINE.");
} catch (err) {
  console.error("❌ ", err.message);
  process.exit(1);
}
