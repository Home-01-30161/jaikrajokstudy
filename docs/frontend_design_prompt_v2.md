# JaiKrajok (กระจกสะท้อนใจ) — Frontend Design Prompt

## Project Overview
AI Emotion-Aware Study Buddy for Thai students (15-22). A web app that detects emotions from text, face, and voice — then responds with empathy + study help. Like a friend who studies with you at 2 AM and knows when you're burnt out.

---

## Core Visual Concept: "The Mirror That Feels"

The name "JaiKrajok" means "mirror heart." The interface = a mirror. Not literal glass, but the feeling of:

- **Reflection** — surfaces that shimmer, subtle glass edges, reflections that react to emotion
- **Depth** — layers of depth like looking into a mirror (parallax, floating elements, frosted layers)
- **Light** — the mirror catches light; the accent color glows like reflected light on glass
- **Warmth** — not cold glass; warm like a handheld mirror worn smooth by use

**Emotional metaphor:** When you're stressed → the mirror dims warm amber. When you're calm → it glows soft cyan. When positive → mint. The interface *breathes* with you.

---

## Color System

### Base: Deep indigo-violet (5 surfaces)
Like looking into a mirror in a dimly lit room at midnight.

```
--surface-1: #08090E     (deepest — background)
--surface-2: #0E0F16     (cards)
--surface-3: #15171F     (bubbles, panels)
--surface-4: #1C1F2B     (hover states)
--surface-5: #252938     (input bar, active elements)
```

### Glass surfaces
Use `backdrop-filter: blur()` and subtle borders on panels to create "mirror glass" effect — but sparingly. Only 2-3 layers deep.

### Accent: Luminous cyan `#52C4F5`
This is the "light reflecting off the mirror." Used for:
- Active state on buttons
- Bot message left border (the "mirror edge" catching light)
- Focus rings
- Emotion neutral/calm state

### Emotion colors (glowing, not saturated)
```
--emotion-calm:    #52C4F5  (cyan — breath, clarity)
--emotion-stressed:#E0A76F  (amber — warm, like a dim lamp)
--emotion-positive:#7BCCB5  (mint — fresh, relief)
```

These should appear as **glowing orbs** — CSS radial gradients that pulse gently. Never as flat backgrounds.

---

## Typography — Fluid, Thai-First

```
--font-display: 'Noto Sans Thai Looped', 'Noto Sans Thai', 'Inter', system-ui;
--font-body:    'Sarabun', 'Inter', system-ui;
--font-mono:    'IBM Plex Mono', 'Courier New', monospace;
```

**Why Noto Sans Thai Looped for display:** The looped Thai script feels warmer, more handwritten, more personal — perfect for a "mirror that reflects emotion." Sarabun (looped-less) for body for readability.

Scale: All `clamp()`. No fixed px values.
- Brand/logo: `clamp(1.8rem, 4vw, 2.8rem)` — tracking `-0.03em`
- Page titles: `clamp(1.4rem, 3vw, 2rem)`
- Body: `clamp(1rem, 2vw, 1.125rem)` — line-height `1.7` (Thai needs space)
- Small/timestamps: `clamp(0.8rem, 1.5vw, 0.9rem)` — `--font-mono`

---

## Signature Visual Elements (Make These Memorable)

### 1. The Mirror Orb (Top-Right Emotion Indicator)
A floating glass sphere. Not just a card — an actual glowing orb.
- Size: ~56px diameter
- Inner gradient: radial, shifts with emotion state
- Outer glow: `box-shadow: 0 0 20px rgba(82, 196, 245, 0.3)` (color matches emotion)
- Float animation: gentle `translateY` bob, 4s ease-in-out infinite
- On emotion change: color transitions over 600ms, and the orb does a subtle "pulse" (scale to 1.15 then back)
- Label slides in beside it: "รู้สึก [calm]" with a mount effect

### 2. The Glass Chat Panel
Chat area has a **subtle glass border effect**:
```
border: 1px solid rgba(82, 196, 245, 0.08);
box-shadow: 
  0 0 0 1px rgba(82, 196, 245, 0.04) inset,
  0 8px 32px rgba(0, 0, 0, 0.4);
```
Gives the chat area a "mirror frame" feeling — like a floating window into the conversation.

### 3. Emotion Wave (Background Micro-Animation)
A very subtle, slow-moving gradient wave at the bottom of the screen — like light reflecting off water. This wave shifts color based on the current overall emotion:
- Neutral: cyan-tinged dark
- Stressed: warm amber-tinged
- Positive: mint-tinged

Implementation: CSS `@keyframes` with `background-position` shift on a gradient. Opacity max 0.06 — barely perceptible, only adding atmosphere.

### 4. The Mirror Ripple (Send Button)
When user sends a message, the send button creates a **ripple ring** animation — like dropping a stone into a mirror pool. The ring expands from the button and fades. This is the "mirror reflects your voice" moment.

### 5. Typing Indicator — "Thought Bubbles"
Instead of boring dots, use 3 circles that:
- Light up sequentially from left to right (like thoughts forming)
- Each circle is the current emotion color
- They float upward slightly as they appear (like thoughts rising)
- When the bot responds, the last dot expands into the message bubble

---

## Layout

### Desktop (centered, max 42rem)
- Chat area: centered column, feels like reading a letter / looking into a mirror
- Emotion orb: fixed top-right, slightly overlapping the edge (like a reflection catching your eye)
- Sidebar rail: no! Use a hamburger + overlay drawer. Keep the chat pure and focused.

### Mobile (<768px)
- Full width, single column
- Bottom tab bar with 3 tabs: Chat | Trend | Profile
- Emotion orb: smaller, top-right with less margin
- Glass input bar: sticky bottom, full width

**Core principle:** The chat page should feel like a quiet, focused space. Not a dashboard. Not an app. A mirror.

---

## Component Specifications

### ChatBubble (User)
```
Align: right
Background: --surface-5
Border-radius: 1.25rem 1.25rem 0.25rem 1.25rem
Max-width: 75%
Slide-in: translateX(20px) → 0, 300ms ease-out
```

### ChatBubble (Bot)
```
Align: left  
Background: --surface-3
Left border: 2px solid var(--accent-cyan) (emotion color for crisis -> amber)
Border-radius: 1.25rem 1.25rem 1.25rem 0.25rem
Icon: small mirror glyph (SVG, not emoji) — like a tiny mirror catching light
Slide-in: translateX(-20px) → 0, 300ms ease-out, 100ms delay per consecutive bot msg
```

Crisis messages: amber left border, warm amber tint background `rgba(224, 167, 111, 0.08)`, phone icon, larger text. Not alarming red.

### InputBar (Glass Mirror Surface)
```
Sticky bottom
Background: rgba(14, 15, 22, 0.85)
Backdrop-filter: blur(16px) saturate(1.2)
Border-top: 1px solid rgba(255, 255, 255, 0.04)
Grid: auto / 1fr auto
— left: expandable textarea (max 5 lines)
— right: send button
```

**Send button:**
- Circle, 40px
- When empty: `--surface-5` bg, `--text-secondary` mic icon
- When has text: `--accent-cyan` bg with white arrow icon, and a **ripple ring** animation plays on click

**Mode switcher** (icons above input):
- 4 small circle buttons: text ⌨️, camera 📷, mic 🎤, photo 📸
- Active mode has subtle glow ring
- Camera mode: shows live preview thumbnail inline before sending

### Emotion Indicator (Mirror Orb)
```
Position: fixed top-right
Margin: 1rem 1.5rem
Width: 56px, Height: 56px
Border-radius: 50%
Background: radial-gradient(circle at 35% 30%, rgba(82, 196, 245, 0.4), rgba(8, 9, 14, 0.6))
Box-shadow: 0 0 24px rgba(82, 196, 245, 0.2)
Animation: float 4s ease-in-out infinite
```

On emotion change:
1. Orb color transitions 600ms
2. Outer glow color transitions 600ms
3. Orb does a "heartbeat" pulse (scale 1 → 1.12 → 1)
4. Small label fades in beside it: "รู้สึก [emotion]"

### Buttons
```
Border-radius: 999px (pill)
Transition: all 200ms ease-out
Hover: transform: scale(1.03)
Focus: 2px solid --accent-cyan, outline-offset: 2px
Touch target: min 44px

Primary: bg --accent-cyan, text white
Secondary: border 1px solid --accent-cyan, text --accent-cyan, bg transparent
Danger: transparent, border --emotion-stressed, text --emotion-stressed
```

### Skeleton Loading (Never spinners)
When waiting for AI response:
- Bot bubble placeholder: same shape as a bot message, `--surface-3` with pulse animation (opacity 0.5 ↔ 0.7)
- Inside: the 3-dot typing indicator with bounce
- No circular spinners anywhere

---

## Micro-Interactions (The "Interesting" Part)

1. **Message send:** Ripple animates from send button + message slides in from the side
2. **Emotion detected:** Orb pulses + a faint colored "wave" ripples across the top of chat area
3. **Crisis detected:** Amber glow slowly pulses around the orb + message bubble gets warm border
4. **Scroll:** Chat scroll has a subtle reflection gradient at top (like mirror fog)
5. **First visit:** Mirror orb does a slow "reveal" animation — fades in from translucent to visible over 2s
6. **Photo upload:** Image appears inside bubble with a polaroid-style shadow, like a memory pinned to the mirror
7. **Empty state:** A soft pulsing cyan glow in the center of the chat, text "ส่งข้อความมาได้เลย พร้อมฟังอยู่" — like the mirror waiting for you

---

## What NOT to Do

- ❌ Pastel gradients (purple-to-pink) — NOT a cute app
- ❌ Corporate blue (#0066FF) — NOT a SaaS dashboard
- ❌ Chatbot mascots (no cartoon cats, no friendly blobs) — NOT for kids
- ❌ Geometric patterns / mesh gradients — NOT "modern" for the sake of it
- ❌ Loading spinners — use skeletons
- ❌ Modal pop-ups for everything — keep flow in the conversation
- ❌ Desktop-first — design for phone in one hand at night
- ❌ Default Tailwind/MUI/Bootstrap styling

---

## Reference Vibe (feeling, not copying)

- The quiet intimacy of **Obsidian** (dark, focused, token-based)
- The glass depth of **visionOS** (subtle layers, not literal)
- The warmth of a **late-night Discord call** with a close friend
- The calm of **looking at your reflection in a dark window** on a bus at night
- The texture of **aged glass** — not perfectly smooth, has character

---

## Copy Voice (Thai)

| Context | Thai | Tone |
|---------|------|------|
| Greeting | "สวัสดี ใจกระจกพร้อมช่วยเรื่องเรียนแล้วนะ 💙" | Warm, friendly |
| Empty chat | "ส่งข้อความมาได้เลย พร้อมฟังอยู่" | Inviting, quiet |
| Emotion detected | "ดูเหมือนตอนนี้คุณรู้สึก [เครียด] อยู่นะ" | Gentle, observant |
| Error | "ตอนนี้สมองเราสับสนอยู่หน่อย ลองใหม่ได้ไหม" | Playful, self-deprecating |
| Crisis detected | "ใจกระจกเป็นห่วงคุณนะ..." + 1323 | Warm, serious, caring |
| After crisis msg | "ไม่ว่าอะไรจะเกิดขึ้น ใจกระจกจะอยู่ตรงนี้นะ" | Supportive, constant |

---

## Deliverable Structure

```
frontend/
├── index.html              # Single file SPA (all CSS/JS inline for hackathon)
├── tokens.css              # All CSS custom properties
├── components/
│   ├── ChatBubble.js       # User + Bot variants
│   ├── InputBar.js         # With mode switcher
│   ├── EmotionOrb.js       # The mirror sphere
│   ├── MirrorRipple.js     # Send animation
│   └── TypingIndicator.js  # Thought bubbles
├── api.js                  # API client (chat/send, emotion/analyze)
└── assets/
    └── mirror-icon.svg     # Custom mirror glyph
```

Or simpler: single `index.html` with modular `<template>` tags and `<script type="module">`.

---

## Success Criteria (Hackathon Judging)

The app should make a judge think within 5 seconds:
1. "Wow, this looks **nothing like** a typical hackathon project" — the dark glass aesthetic is unique
2. "This feels **professional**" — fluid animations, consistent tokens, no rough edges
3. "I understand what it does **instinctively**" — the orb mirrors emotion, the chat is obvious
4. "This is **thoughtfully designed** for Thai users" — typography, copy, cultural context all fit
5. "I want to **keep talking to it**" — the interaction feels responsive, human, warm

---

## Technical Notes

- Backend: `POST https://team07.aiforthai.in.th/api/chat/send` and `/api/emotion/analyze`
- Framework: Vanilla JS with `<script type="module">` for simplicity (no build step needed)
- Hosting: Served as static files via FastAPI (already set up at `api/app/frontend/`)
- Thai fonts: Google Fonts (Noto Sans Thai Looped, Sarabun, IBM Plex Sans Thai)
- Icons: Tabler Icons (consistent, monochrome)
- Mobile: Test on 375px viewport first, then adapt up
- No external dependencies besides fonts + icons
- Reduced motion: `prefers-reduced-motion: reduce` support
- No data persistence: Everything in-memory (Phase 1)
