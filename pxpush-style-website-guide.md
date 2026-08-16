# Building a Website Like PX PUSH

Analysis of [pxpush.com](https://pxpush.com/) (a design-subscription agency site) and a practical guide to building something similar.

## 1. What Kind of Site This Is

PX PUSH is a **single-long-scroll marketing/sales site** for a "design subscription" service (unlimited design requests for a flat monthly fee — the Design Joy / DesignPad / Superside style of business). The whole site is built to do one job: convert visitors into "Get Started" clicks. Everything — copy, layout, animation — is in service of that.

Site map is intentionally tiny:
- `/` — Home (does 90% of the selling)
- `/about`
- `/journal` (blog)
- `/start` — signup/CTA landing page
- `/terms`, `/privacy`

## 2. Visual & Interaction Style

**Aesthetic:** dark, minimal, editorial/"studio" branding — closer to a design portfolio than a typical SaaS landing page.

Key style traits:
- **Near-black background** (`#1a1a1a`) with light text — high contrast, moody.
- **Oversized, repeated headline typography.** Section titles (e.g. "On-Demand Design Department", "PX PUSH", "Packages") repeat the same line 6–8 times stacked/marqueeing — a classic scrolling-marquee effect used purely for visual rhythm, not literal reading.
- **Numbered section labels** ("Nº001 / Intro", "Nº002 / Works") — gives an editorial, catalog/index feel.
- **Bullet dots (●)** used as a recurring graphic motif before headings/nav items.
- **Full-bleed autoplay looping video** as the hero background.
- **Horizontal/looping image marquees** for the portfolio ("Works") and brand-asset galleries — rows of images scrolling continuously.
- **"Hold to skim" / "Click to close"** micro-interactions — suggests a custom scroll-progress or page-preview interaction layer, plus a full-screen overlay menu.
- **Sparse copy, short punchy paragraphs**, lots of white space, arrows (↗) on every CTA link to signal "external/forward action."
- **Pricing displayed like a menu card** — strikethrough price + discounted price, feature bullet list, single CTA per plan.

**Feel in one sentence:** editorial studio meets SaaS pricing page — bold display type, cinematic dark palette, continuous horizontal motion, minimal chrome.

## 3. Page Structure (Home)

| # | Section | Purpose |
|---|---|---|
| 1 | Hero (video bg + big repeating headline) | Hook + positioning statement |
| 2 | Intro / "Nº001" | Problem → solution narrative, primary CTA + pricing anchor |
| 3 | Works / "Nº002" | Looping image marquee, social proof via portfolio |
| 4 | Benefits / "Nº003" | 5 numbered value props, each with a small illustration |
| 5 | Packages / "Nº004" | Pricing cards (Standard / Pro) |
| 6 | Brand Sprint | Upsell / secondary offer (fixed-scope package) |
| 7 | Footer | Company/legal info, socials, secondary CTA |

This is a proven long-form SaaS-agency structure: **Hook → Problem/Solution → Proof → Value props → Pricing → Upsell → Footer.**

## 4. Recommended Tech Stack

You don't need anything exotic — the effects are all achievable with a modern front-end stack:

**Option A — fastest to ship (recommended for most people)**
- **Framer** or **Webflow** — both handle scroll-based animation, marquees, and CMS (for the Journal/blog) with no code. This is very likely what PX PUSH is close to conceptually, given they literally sell "Framer/Webflow Development" as part of their Pro package.

**Option B — custom code (more control, more work)**
- **Next.js** (React) or plain **Vite + HTML/CSS/JS** for structure
- **GSAP + ScrollTrigger** for scroll-driven headline reveals, section pinning, and the horizontal marquee loops
- **Lenis** (or Locomotive Scroll) for the smooth/inertia scrolling feel
- **Tailwind CSS** for styling velocity
- **CMS**: Sanity, Contentful, or a simple MDX/Markdown blog (via Next.js) for the Journal section
- **Video**: compressed `.mp4`/`.webm` hero background, muted/loop/autoplay, poster image fallback for mobile

## 5. Building Each Section

### Hero
- Full-viewport `<video>` (muted, autoplay, loop, playsinline) as background, dark overlay for contrast.
- Repeating `<h1>` lines using a CSS/JS marquee (duplicate the text, animate `translateX` on an infinite loop) — this is a cheap but high-impact effect.
- Scroll-cue text ("Scroll Down to Access...").

### Intro / Problem-Solution
- Two-column or single-column narrative copy: problem statement → reframe → offer.
- Anchor pricing early ("starting at $X/mo") to qualify visitors before they scroll further.
- Two CTAs: primary ("Get Started") + secondary anchor link to pricing (`#pricing`).

### Works (Portfolio Marquee)
- Row(s) of project thumbnails in a flex/grid container wider than the viewport, animated with `translateX` on a seamless loop (duplicate the image set so the loop is invisible).
- Optional: pause on hover, drag-to-scroll for touch/mobile.
- Use `loading="lazy"` and modern formats (`.webp/.avif`) — this site uses `.webp` throughout, which you should too for performance.

### Benefits
- Numbered list (Nº001–Nº005), each with a short headline, 1–2 sentence description, and small custom illustration/icon.
- Simple CSS grid or stacked layout with scroll-triggered fade/slide-in per item.

### Pricing / Packages
- Card layout: plan name, strikethrough original price + discounted price, short one-liner, bullet feature list, single CTA button.
- Mark one plan "Popular" with a badge for anchoring bias.
- Keep to 2–3 tiers max — more choice reduces conversion.

### Upsell (Brand Sprint)
- Same card pattern as pricing, but framed as a fixed-scope, fixed-price project rather than a subscription — good pattern for capturing leads not ready to commit monthly.

### Footer
- Legal entity/address (builds trust — many "subscription design" sites are scrutinized for legitimacy, so showing a registered company + address matters), social links, secondary CTA, legal page links.

## 6. Copywriting Patterns to Reuse

- **Problem → reframe → offer** structure in the intro (name the pain of hiring designers/freelancers/agencies, then position the subscription as the fix).
- **Short sentences, active voice**, sales-page rhythm — avoid long paragraphs.
- **Concrete numbers** everywhere: "$4,000/mo", "72 hour delivery", "4 weeks" — specificity builds trust more than vague claims.
- **Every CTA uses an arrow (↗)** and action verbs ("Get Started", "View Pricing") — consistent micro-branding.

## 7. Performance & Technical Notes

- Compress hero video aggressively (target < 3–5MB) and provide a poster frame for slow connections.
- Use `.webp`/`.avif` for all imagery (this site does).
- Lazy-load below-the-fold marquee images.
- If using GSAP/Lenis, load them deferred/async so they don't block first paint.
- Respect `prefers-reduced-motion` — disable/soften marquees and scroll-jacking for users who request it.
- Keep the whole thing to essentially one route (`/`) with anchor links — reduces build complexity and keeps the funnel linear.

## 8. Minimal Build Checklist

1. Set up Next.js/Vite (or Framer/Webflow) project, dark theme tokens (`#1a1a1a` bg, off-white text).
2. Build hero: video bg + marquee headline component (reusable — you'll use it 3x on the page).
3. Build reusable "Section" wrapper with the "Nº00X / Label" eyebrow pattern.
4. Build horizontal image-marquee component (reuse for Works + Brand assets).
5. Build Benefits list component (icon + numbered title + copy).
6. Build Pricing card component (reuse for Standard/Pro/Brand Sprint).
7. Wire up scroll animations (GSAP ScrollTrigger or Framer's native scroll triggers) for fade/slide-ins.
8. Add smooth scroll (Lenis) if going custom-code.
9. Build footer with legal entity info + socials.
10. Add `/about`, `/journal`, `/start`, `/terms`, `/privacy` as simpler secondary pages.
11. Optimize media, test `prefers-reduced-motion`, test mobile (marquees often need simplifying on small screens).

---

**Note on originals:** This guide describes the *pattern language* of the site (layout, structure, motion, copy strategy) so you can build your own original design in the same genre — copying PX PUSH's actual logo, exact copy, photography, or brand assets would be a trademark/copyright issue.
