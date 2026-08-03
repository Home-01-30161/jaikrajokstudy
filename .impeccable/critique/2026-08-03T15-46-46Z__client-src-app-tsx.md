---
target: main pages after login (Home/Chat/Trend/School/Safety)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-03T15-46-46Z
slug: client-src-app-tsx
---
# Design Critique — JaiKraJok กระจกสะท้อนใจ · Main pages after login

Method: dual-agent (A: ses_037c0fd4fffeVMtvub6RvSVaEw · B: ses_037b8f34fffelCkQTsEelKDOUk)

## Design Health Score — 23/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Typing dots are static (App.tsx:1491-1493); analyses are silent in sidebar |
| 2 | Match System / Real World | 2 | API jargon on mode cards, "Pathumma LLM" in chat, "Demo aggregate data" badge |
| 3 | User Control and Freedom | 3 | No undo for entry deletion; no cancel while analyzing |
| 4 | Consistency and Standards | 2 | 5 card dialects in chat alone; emoji vs collage icon systems; border radii without system |
| 5 | Error Prevention | 2 | Keyword detection logs unconfirmed moods; selfie "analysis" is a random pick presented as facial evidence |
| 6 | Recognition Rather Than Recall | 3 | Trend legend buckets don't match mood labels user saw |
| 7 | Flexibility and Efficiency of Use | 2 | Forced 1-1.3s fake delays on every action; no fast path |
| 8 | Aesthetic and Minimalist Design | 3 | Rich shell; minus points for global click ripple, boilerplate channel strip, school pricing page |
| 9 | Error Recognition and Recovery | 2 | Nothing can fail so nothing recovers; no "analysis failed" state |
| 10 | Help and Documentation | 2 | No contextual help at decision points (what happens to data before tapping selfie?) |
| **Total** | | **23/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment — partially authored.** The frame is bespoke: curved-edge black sidebar, checkerboard top bar with in-strip page tab, graph paper, taped rotated polaroid cards, elastic GSAP pops. That is genuinely authored for a Thai-student analog diary. But the world breaks at the shell edge: every content panel is the same rounded-2xl white B2B card; two conflicting icon systems (collage PNGs vs emoji); API names as card subtitles; a school pricing page inside a kid's private diary.

**Deterministic scan — regex engine clean (0 findings)** on the .tsx file (only the regex engine runs on .tsx; HTML/CSS-cascade and Puppeteer engines don't apply). Static evidence: 18 imgs all `alt=""` (13 decorative — defensible), 4 interactive elements with NO accessible name (LINE toggle at 1370 is also 20px tall < WCAG 2.5.8's 24px), 3 more title-only, 9 emoji-as-icon slots, 2 `window.confirm`, 9 hardcoded setTimeouts never cleared, Taviraj + IBM Plex Mono referenced but never loaded.

**Visual overlays** — no browser overlay injection; browser pass executed instead (headless Chromium + Playwright against the dev server): 0 console errors across all 5 views, but a **measured 488px horizontal overflow at 390px viewport** (scrollWidth 878 vs innerWidth 390), driven by the fixed 230px sidebar + 230px margin-left.

## Overall Impression

The emotional architecture (escalation flow, transparency, warm bot voice) is the real product and it's good. The visual world is genuinely authored at the shell. But two P0s make the whole thing fragile: the collage brand 404s in any production build (images are only served by dev middleware), and the app is desktop-locked while its users are Thai students on phones. The biggest opportunity: make the first negative log the most supported moment in the product — right now it's the least.

## What's Working

1. **The concern/escalation system** — progressive thresholds (sidebar card at streak 2, modal at 3), non-judgmental copy, real `tel:1323`, an escape hatch. The product's heart, and the best-designed flow in the file.
2. **The shell worldbuilding** — checkerboard strip, graph paper, curved black sidebar, taped rotated cards. Delivers "real diary, not sterile app."
3. **Honest transparency** — logs, ethics tab, limitations, PDPA accordions, honest empty states, demo data badged. Rare.

## Priority Issues

1. **[P0] Collage brand 404s in production** — all 22 images in the IMG table are served only by dev middleware (`vitePluginCollagePics`, vite.config.ts:207-239, configureServer-only). `dist/public` has no `collage/` folder; a built deployment renders every nav icon and mode-card image broken. *Fix: copy CollagePics/ into client/public/collage/ or add a production static handler in server/index.ts.* → $impeccable harden
2. **[P0] Desktop-locked layout** — fixed 230px sidebar + marginLeft 230px, no breakpoint. Measured 488px overflow at 390px viewport. The primary audience is mobile-first. *Fix: collapsible drawer / bottom nav below md.* → $impeccable adapt
3. **[P1] First negative log receives zero support** — brand principle "make 1323 highly visible when negative emotions are logged" is unmet until streak 2; the most vulnerable moment is the least resourced. *Fix: quiet inline support strip (not a modal) after any concern:true log.* → $impeccable harden / onboard
4. **[P1] Escalation modal re-fires without cooldown** — streak never resets on modal show, so the 4th/5th concern log re-triggers the crisis prompt at the worst moment. *Fix: modalShownAt/cooldown + "คุณเห็นข้อความนี้แล้ว" acknowledgment.* → $impeccable harden
5. **[P1] Trust is simulated where it must be real** — trend data is session-scoped (gone on reload) while Home promises "ดูแนวโน้มของฉัน"; the selfie "analysis" is a random pick from 4 results presented as facial evidence; "แจ้งครูที่ปรึกษาเรียบร้อยแล้ว ครูจะติดต่อกลับภายในวันนี้" promises a call no backend will make. *Fix: persist to localStorage; label selfie result as estimate; soften the counselor promise.* → $impeccable harden
6. **[P2] Brand fonts unloaded, motion uncontrolled** — Taviraj + IBM Plex Mono referenced, never loaded (fallback to Georgia/monospace); Space Mono loaded unused; global click ripple with 3 droplets on every click with no prefers-reduced-motion guard; static typing dots. *Fix: load Taviraj, drop Space Mono, guard GSAP behind reduced-motion, animate dots.* → $impeccable typeset / quiet

## Persona Red Flags

**Jordan (first-timer)** — taps "ถ่ายเซลฟี่" and 300ms later the app silently switches to Chat and fires camera analysis with a random verdict in a colored card; no permission prompt, no confirmation; sidebar now shows a mood she never consciously chose.

**Casey (mobile)** — ~145px usable content width at 390px viewport, 22px nav icons, 9-10px text, pinch-zoom blocked (`maximum-scale=1`), emoji-only toolbar buttons, global ink ripple spraying droplets on every thumb tap.

**Sam (accessibility)** — no reduced-motion support while GSAP wipes/pops/ripples; zoom blocked; contrast fails (10px #888 on pastel at 1330, 9px 0.5-alpha salmon at 971); unlabeled speak/send/delete buttons; native window.confirm for deletes.

**Riley (stress tester)** — logs "เครียด" 3 times → modal fires; 4th log → modal again, no cooldown; "แจ้งครูที่ปรึกษา" promise is unbacked; 1323 link is a 12px bordered link inside a pastel panel — easy to miss exactly when it matters.

## Minor Observations

- Duplicated "CHANNEL ACCESS" comment (1338-1339); duplicated `'Inter', 'Inter'` font strings throughout.
- Icon-action mismatches: lightbulb for "ถ่ายเซลฟี่", origami stars for "ถ่ายรูปการบ้าน" — decorative assets repurposed as function icons.
- Login "Sign Up" button has no onClick (dead control); Google login advertises then toasts "กำลังพัฒนา".
- Mood circle on Home is display-only while setMood prop is passed but never used.
- "เช็คอิน N ครั้ง" counts trend points (max 9), not sessions — can inflate.
- Trend legend merges 6 moods into 3 buckets that don't match logging labels.
- `closest('.no-ripple')` is dead code — no element ever gets that class.

## Questions to Consider

1. What if there were no mode cards at all — one continuous conversation with the mirror, and the cards' API-jargon subtitles disappeared?
2. Who is "ภาพรวมโรงเรียน" for, and can a student's private diary afford to host pricing plans and aggregate stress stats?
3. What if the escalation flow asked "อยากให้ใครรู้ไหม?" instead of deciding when a child is in trouble?
