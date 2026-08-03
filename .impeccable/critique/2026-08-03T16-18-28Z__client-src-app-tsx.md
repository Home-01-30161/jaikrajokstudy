---
target: client/src/App.tsx
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
run_date: "2026-08-03T15:46:46Z"
timestamp: 2026-08-03T16-18-28Z
slug: client-src-app-tsx
---
# Design Critique — JaiKraJok กระจกสะท้อนใจ · Main pages after login (Run 2, post-polish)

Method: dual-agent (A: ses_0379bf4e1ffemqi5DfrY6bNO2F · B: ses_0379be02cffekvFRb1iFTKgL3e)

## Design Health Score — 19/40 (Poor)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Toasts announce actions nothing performed; no status on canned analysis |
| 2 | Match System / Real World | 2 | English login, "Face Recognition API" subtitles, miscounted "เช็คอิน" |
| 3 | User Control and Freedom | 1 | Reset chat silently destroys all logs; no undo anywhere |
| 4 | Consistency and Standards | 2 | Counselor toasts differ (demo label on one, not the other); red = brand+hotline+destructive |
| 5 | Error Prevention | 2 | Unguarded destructive reset; fake successes; inert LINE toggle |
| 6 | Recognition Rather Than Recall | 3 | Timestamp-less transparency logs; unexplained "โหมดที่ใช้ได้" |
| 7 | Flexibility and Efficiency of Use | 1 | Enter-to-send only; quick-log UI computed but never rendered |
| 8 | Aesthetic and Minimalist Design | 2 | Distinctive shell; dense meta sidebar, B2B strip, 9-10px type, emoji soup, ripple on every click |
| 9 | Error Recognition and Recovery | 1 | No error states post-login; storage failures swallowed; data loss unrecoverable |
| 10 | Help and Documentation | 2 | Safety view rich; no in-chat help; dead mood-selector hints at unshipped guidance |
| **Total** | | **19/40** | **Poor — core interaction layers need work** |

Note on the score drop (23 → 19): the polish pass fixed correctness items (production assets, mobile layout, escalation cooldown, support strip, persistence, honest labels) — all verified working in-browser. Run 2's reviewer scored the interaction layers the pass did not touch: reset-destroys-data, fake results stated as fact, no error states, and the drawer's new keyboard gap. Lower score reflects stricter coverage, not regression in the fixed items.

## Design Specificity Verdict

**LLM: roughly 70% authored, 30% interchangeable.** The shell system (checkerboard top bar + salmon page tab, curved black sidebar, graph paper, taped rotated cards, Thai empathy copy, layered safety flow) is genuinely authored. The interchangeable 30%: English login, API-jargon card subtitles, the B2B channel strip, the entire SchoolView sales page, and emoji-as-icons. Five authored collage components (BrainCloud, RedDotCross, HalftoneField, OnbCard, TealBadge) are defined and never used.

**Deterministic scan: regex engine clean (0 findings).** Static: 18/18 imgs alt="" but all decorative/paired (justified); 3 interactive elements with NO accessible name (send ⬆️ App.tsx:1643, speak 🔊 1556, delete 🗑️ 1766); ~30 emoji-as-icon instances; 2 window.confirm (1147, 1174); 11 setTimeouts — the escalation timer is cleaned up and fires once (verified).

**Browser (headless Chromium, 390×844 + 1440×900):** 0 app errors. All polish fixes confirmed live: no overflow (390=390, 1440=1440), drawer slides to left=0 with scrim and Escape close, support strip appears after first concern, escalation modal fires once per session, localStorage persists across reload. One 404 (favicon.ico only). Confirmed NEW issues: drawer is not inert when closed (Tab from hamburger lands focus on an invisible off-screen nav button, rect left -210); escalation modal has no role="dialog"/aria-modal/focus trap/Escape.

## Overall Impression

The correctness work from the polish pass is real and verified — the app no longer breaks in production, no longer overflows a phone, and the escalation flow behaves. What remains is the trust-and-control layer: a reset button that silently deletes the whole diary, AI results presented as confident fact, and keyboard accessibility gaps that the drawer fix introduced. The emotional architecture is the product's best work; the demo scaffolding around it is still competing for attention.

## What's Working

1. **The collage shell system** — checker top bar with salmon page tab, curved black sidebar, graph paper, taped rotated cards: coherent, repeated, product-specific.
2. **Layered safety architecture** — quiet strip → concern card → once-per-session modal, with warm Thai copy and tel:1323 reachable from four surfaces; streak resets on positivity.
3. **Real data ownership** — localStorage persistence, per-entry delete, confirmed bulk clear, JSON export, honest demo labels where applied.

## Priority Issues

1. **[P0] Reset button silently deletes the entire diary** (App.tsx:1510-1516, resetChat 858-862) — one tap on the header 🔄 wipes trend, logs, streak, modes, no confirmation, no undo, while the same bulk delete in TrendView properly confirms (1146-1150). Data-loss inconsistency at the most prominent spot in chat. Fix: confirm + undo. → $impeccable harden
2. **[P0] Fabricated clinical results stated as fact; demo honesty inconsistent** — selfie result is a random pick (826) rendered as confident observation ("สีหน้าดูเกร็งบริเวณคิ้วและรอบดวงตา..."); the modal's "แจ้งครูที่ปรึกษา" toast (1199) lacks the "(โหมดสาธิต)" label its sidebar twin has (1134). Fix: possibility language ("อาจ", "ดูเหมือน"), unify demo labels. → $impeccable harden
3. **[P1] Drawer keyboard gap (introduced by the polish pass)** — drawer has no inert/aria-hidden when closed; Tab from the hamburger lands focus on invisible nav buttons (confirmed rect left -210); no focus trap or focus restore on open/close. Fix: inert + role="dialog" + focus management. → $impeccable harden
4. **[P1] Escalation modal a11y** — no role="dialog", no aria-modal, no focus trap, no Escape, no initial focus (1187-1222). → $impeccable harden
5. **[P1] Salmon tab overflows at narrow widths** — minWidth 120px + 13px bold Thai + no nowrap: "ความปลอดภัย & ข้อมูล" wraps inside the 36px bar (914-927). Fix: nowrap + flexible min-width. → $impeccable adapt
6. **[P2] Brand fonts referenced, never loaded** — Taviraj (972) + IBM Plex Mono (9 sites) absent from index.html:12; wordmark silently renders Georgia, mono chrome falls back to system font. → $impeccable typeset

## Persona Red Flags

**Jordan (13, exam stress)** — taps "ถ่ายเซลฟี่" → ripple + pop → auto-navigates → 1.2s dots → an emotion card that may declare "เครียด" for a face that felt fine. Doubts the app or her own feeling — exactly when trust matters. If this was her 3rd concern, a modal interrupts 1.2s later whose primary button promises a real counselor notification.

**Casey (15, privacy-aware)** — reads "กำลังวิเคราะห์ข้อมูลด้วย Pathumma LLM" in transparency logs, opens SchoolView and sees "9 กรณีที่ส่งต่อครูที่ปรึกษา" and "ค่าบริการรายเดือน", toggles LINE notifications and gets "เปิดการแจ้งเตือนผ่าน LINE แล้ว" while nothing subscribes. Every step confirms the trust worry.

**Sam (16, wants a 30-second check-in)** — the hero mood bubble invites a tap that does nothing (onMoodTap wired at 1072-1111, never rendered); the promised quick-log UI (streakLabel, historyDots) is computed and hidden; every log costs a fake ≥1s analysis.

## Minor Observations

- Duplicated 'Inter','Inter' font stacks in ~40 style objects; five authored collage components dead.
- Trend legend colors don't match data colors ("tired" renders #887F9E, legend says #6F6389).
- Privacy page has no explicit consent checkbox — the CTA is the consent signal.
- Chat meta sidebar below the fold on mobile, burying the 1323 concern card.
- Support-strip dismiss target ≈26px (passes 24px, under the 44px recommendation for stress moments).
- speakText toasts with emoji, no stop control; guardian success uses a dingbat.
- escalationShownRef never reset by resetChat — cooldown is permanent per session.

## Questions to Consider

1. All four "AI" modes return canned random results dressed in confident clinical wording — when a user catches the contradiction (a smiling selfie diagnosed as "เครียด"), which kills trust faster: the fake analysis, or the genuine 1323 next to it?
2. SchoolView sells aggregate data and pricing tiers inside a diary promising "พื้นที่ปลอดภัย" — who is that page for, and what does showing it to a 14-year-old cost?
3. The quick-mood feature is fully wired but never rendered — cut for scope, or judged too dangerous to ship? If the latter, why did a zero-friction fake selfie analysis ship instead?
