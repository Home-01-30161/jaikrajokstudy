## Context

This is **JaiKrajok ("Mirror of the Heart")** — an AI Emotion-Aware Study Buddy for Thai high school students (ages 15–18), built for the AI for Thai Service Onboarding competition. It combines Face Recognition, Sentiment Analysis, Speech-to-Text, OCR, and the Pathumma LLM to help students notice their emotional state, get personalized encouragement, and access a safe space to vent — alongside light academic help. It runs as a LINE Official Account bot and a Web Application, is aimed at a stressed, exam-pressured, sometimes reluctant-to-ask-for-help audience, and handles sensitive data under PDPA (anonymized storage, AES-256, no face images retained).

## Step 1 — Critique the current site (do this first, before changing anything)

Audit the existing webapp and report back before redesigning:
- List every screen/section currently in the app and what it's for.
- Flag any content, copy, imagery, or components that **don't match the actual product** (e.g. leftover placeholder text, generic template copy, features described that aren't implemented, or implemented features with no UI).
- Flag anything that undermines trust or safety for a teen mental-health context (clinical/cold language, anything that could read as judgmental, anything that implies diagnosis).
- Note technical debt: unused components, inconsistent spacing/type scale, missing responsive behavior, missing accessibility (contrast, focus states, motion-reduction support).
- Summarize this audit in a short list before proceeding to the redesign.

## Step 2 — Remove mismatched content

- Strip any copy/UI that doesn't reflect the real feature set: face-emotion check-in, text/voice check-in, homework photo help, personalized encouragement + advice from Pathumma LLM, emotion trend history, LINE OA + Web access.
- Remove generic stock phrasing ("empowering students," "revolutionary AI," etc.) in favor of specific, honest descriptions of what the tool does.
- Remove any component that isn't wired to a real function — no decorative fake dashboards, no invented stats.
- Keep the safety/trust content (data privacy, "not a diagnosis," escalation to a real counselor or the 1323 mental health hotline) — this should be *visible*, not hidden in fine print.

## Step 3 — Redesign direction: match pxpush.com's structure section-by-section

Primary reference: **pxpush.com**. Its "alive" feeling comes from almost every section having its own animation, not just the hero. Rebuild the Landing page following this exact section map, substituting JaiKrajok's actual content:

| pxpush section | What's animated there | Technique | JaiKrajok equivalent |
|---|---|---|---|
| Hero | Full-bleed looping video behind headline | `<video autoplay loop muted playsinline>` + dark gradient overlay for text contrast | Soft ripple/mirror-light loop behind "JaiKrajok — กระจกสะท้อนใจ" headline |
| Repeated headline ("On–Demand Design Department" x8) | Large text repeated stacked, scrolling/kinetic on scroll | CSS marquee, or scroll-linked horizontal translate | Repeat the product name or a one-line tagline (e.g. "เพื่อนคู่ใจที่เข้าใจอารมณ์คุณ") |
| Nº-labeled intro ("Nº001 / Intro") | Small eyebrow label + fade/slide-in on scroll | Scroll-triggered reveal (GSAP ScrollTrigger or Framer Motion `whileInView`) | "Nº01 / เกี่ยวกับ" — short honest description of what the tool actually does |
| "Our Works" gallery — two rows scrolling opposite directions | Horizontal auto-scroll image strips | CSS marquee on flex row, duplicated content for seamless loop, pause on hover | Replace with anonymized app screenshots (check-in screen, reflection screen, trend chart) — **not fabricated portfolio images** |
| Benefits (Nº001–Nº005, each with a small illustration) | Looping icon animation next to each benefit line | Lottie or lightweight SVG loop | Your 4–5 feature icons: face check-in, text/voice check-in, homework photo, encouragement, trend history — see Step 3a prompts below |
| Second image strip near pricing/packages | Another horizontal scrolling row | Same CSS marquee technique | If you have a pricing/service-tier model (school vs. individual), a similar horizontal strip of what's included |
| Nav / menu | Fullscreen overlay transition on open | JS-driven overlay animation (height/opacity transition) | Same pattern, but menu items go to Check-in, History, Safety & Resources — not sales pages |
| Buttons/links ("Get Started ↗") | Hover state, sometimes magnetic cursor pull | JS `mousemove` + spring easing (Framer Motion `useSpring` or GSAP `quickTo`) | Apply to primary CTAs like "เริ่มเช็คอิน" (Start Check-in) — keep subtle, never delay the click |

**Typography & palette**, adapted from pxpush's stark black/white to fit a teen mental-health context:
- Oversized, expressive headline type (serif or bold sans, tight letter-spacing) — same *scale* of confidence as pxpush, different *warmth*
- Deep indigo/charcoal base instead of pure black, with a warm amber/gold accent instead of stark white-on-black — think dusk, not corporate noir
- Numbered section labels throughout ("Nº01," "Nº02"...) exactly like pxpush's "Nº001 / Intro" pattern, used consistently across the whole page, not just once

**Rule for this whole page:** if a section on pxpush.com moves, fades, or loops, the equivalent JaiKrajok section should too — the goal is that nothing on the landing page sits completely static except body copy paragraphs.

## Step 3a — Generation prompts for the animated assets

Use these to generate the assets referenced in the table above (Runway/Kling/Pika for video, LottieFiles/Fiverr/After Effects for icons). Append **"calm, soft, minimal, no sharp edges, no fast motion"** to every prompt to keep the register appropriate for stressed teenage users.

**Hero video:**
> A slow-motion close-up of gentle ripples spreading across a still, dark indigo water surface, catching soft warm golden light from above. Calm, minimal, cinematic shallow depth of field. No people, no text, no logos. Continuous seamless loop, 6–8 seconds, 4K.

**Benefit icons (Lottie, one per feature):**
- *Face check-in*: Simple line-art face outline with a soft light sweeping across it left to right, like a gentle scan. Calm blue/indigo tones. Loops smoothly.
- *Text check-in*: A speech bubble with a soft pulsing glow, like a slow heartbeat. Warm, reassuring color.
- *Voice check-in*: A minimal soundwave line gently rising and falling, soft glow, slow tempo, no sharp peaks.
- *Homework photo*: A notebook page with a thin light line slowly scanning top to bottom. Minimal, clean.
- *Emotion trend*: A simple line graph drawing itself upward left to right, ending with a soft bounce on the last point, then looping.

## Step 3b — Pages that should *not* get this treatment

Only the **Landing page** should be built to this pxpush density of motion. The Check-in, Reflection/Result, and Consent/Onboarding screens should stay calm and fast — a student mid-stress needs to complete those quickly, not scroll through a marquee. Carry over the palette and type system for brand consistency, but drop the marquees, cursor effects, and stacked scroll reveals on those screens.

## Step 4 — Content & tone constraints (non-negotiable, override style if they conflict)

- Never let animation delay or obscure the crisis-resource link (1323 hotline) or the "talk to a real counselor" path — these must stay fast to find and legible even before animations finish.
- Avoid imagery/language that could feel like surveillance ("we're watching your face") — frame check-ins as something the student initiates and controls.
- Keep copy in plain, warm Thai/English (whichever the UI is in) — no jargon, no diagnostic language, no false promises of "fixing" feelings.
- Motion should respect `prefers-reduced-motion`.

## Step 5 — Deliverable

1. The audit from Step 1.
2. A section-by-section rebuild plan for the Landing page following the pxpush.com section map in Step 3, plus a lighter plan for Check-in, Reflection, Trend History, Safety & Resources, and Consent (per Step 3b).
3. Implementation using [React/Tailwind/Framer Motion — specify your actual stack], matching the current tech stack rather than introducing a new one.
4. A short before/after rationale for each major change, tying it back to the specific pxpush section it's modeled on.

## Step 6 — Tell me what you can't do and what you need from me

Before and during the rebuild, stop and flag anything you can't resolve on your own instead of guessing or inventing a placeholder. Specifically call out:

- **Missing access** — if you can't see the real codebase, API keys/env config, design tokens, or brand assets (logo files, existing color values, fonts already licensed), say so and list exactly what's needed instead of fabricating them.
- **Real content you can't generate** — anonymized student testimonials, actual emotion-trend sample data, real screenshots/photos for the hero, and any legal-review copy (PDPA consent language, Terms of Service, Privacy Policy wording) must come from me or a human reviewer, not be invented. Draft placeholders clearly marked `[NEEDS REVIEW: ...]` rather than presenting them as final.
- **Decisions only I can make** — final palette/tone calls if the "premium but warm" balance in Step 3 is ambiguous, which crisis-resource wording is approved for use, whether the LINE OA and Web App should look identical or diverge, and what the actual current tech stack is if I haven't told you.
- **Things outside a coding assistant's ability** — real user testing with students, accessibility audits requiring assistive-tech hardware, legal/compliance sign-off on PDPA handling, and any claims about the AI's accuracy or safety that need verification against actual model behavior rather than assumed from the spec.
- **Ambiguity in this brief itself** — if the reference-site direction conflicts with the tone constraints in Step 4 in a specific instance, don't silently resolve it in favor of either — surface the conflict and ask.
- **Image/video generation** — you cannot generate the hero video or Lottie icon animations yourself. For each one listed in Step 3a, give me clear step-by-step instructions instead: which tool to use (e.g. Runway, Kling, LottieFiles), the exact prompt to paste in, what file format/dimensions to export, and where to save the file in the project so you can wire it in once I provide it. Write these as a numbered checklist I can follow without guessing.

End your response with a short **"Needs from you"** checklist so nothing gets silently assumed or fabricated.

---

*Fill in your actual current stack (framework, styling library, animation library) before sending this to your coding assistant — it will produce far more usable code if it knows what it's building on top of.*
