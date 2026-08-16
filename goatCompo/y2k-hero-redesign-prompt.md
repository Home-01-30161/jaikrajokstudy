# Y2K Sky — Award-Winning Animated Web Redesign Prompt

## Reference
Interaction/motion patterns inspired by **PX PUSH** (Awwwards SOTD, Aug 2026 — [pxpush.com](https://pxpush.com/) / [Awwwards listing](https://www.awwwards.com/sites/px-push)):
interactive WebGL background, rotating 3D element, animated pricing/WebGL section, mouse-reactive FAQ interaction, footer logo trails. Built with GSAP + WebGL/Three.js on a deep-blue/near-black palette (`#03049C`, `#1a1a1a`).

**Hero assets:**
- `kling_20260816_VIDEO_Seamless_l_4624_0.mp4` — seamless looping Y2K sky/clouds animation (landing state)
- `studyroom.png` — warm, retro CRT-lit study room (end-of-scroll resting state; nostalgic Y2K desk-setup reference)

## Prompt

Design and build an award-winning, Y2K-themed animated website with a bold 3D interactive hero section, inspired by the interaction design of pxpush.com (Awwwards SOTD).

**Overall Art Direction**
- Y2K / Frutiger Aero aesthetic: glossy chrome, iridescent gradients, translucent glass panels, bubble UI, cyber-optimism
- Color palette: cerulean-to-royal-blue gradient (`#3A8DDE → #03049C`), chrome silver, pearlescent pink/lilac accents, near-black (`#1a1a1a`) for contrast panels
- Typography: bold, rounded, slightly futuristic sans-serif for headlines (Y2K bubble/chrome text style); clean minimal sans for body copy
- Background: scroll-driven hero background that transitions from an animated sky-clouds video to a nostalgic Y2K studyroom scene (see **Hero Scroll Workflow** below)

**Hero Section**
- Full-viewport 3D hero built in WebGL/Three.js (or Spline) — a floating chrome/glass 3D object (sphere, blob, or Y2K-style orb) that responds to mouse movement with subtle rotation and parallax
- Scroll-driven background sequence (sky video → studyroom) plays behind the 3D object, choreographed with GSAP ScrollTrigger (see workflow below)
- Large kinetic headline text with a soft chrome/liquid-metal shader or gradient fill, animated in on load (GSAP timeline, staggered reveal)
- Scroll-cue element (bouncing chevron or animated orb) styled to match the Y2K glass/chrome theme

**Hero Scroll Workflow**
```
[Sky Background Video: kling_20260816_VIDEO_Seamless_l_4624_0.mp4]
            │
            │  user scroll (scroll-linked video scrub, frame-by-frame)
            ▼
[Studyroom Background: studyroom.png]
```
- **State 1 — Landing (no scroll):** hero loads on the looping sky/clouds video (glossy blue sky, chrome-edged clouds, soft bloom) as a static-feeling ambient loop
- **State 2 — On scroll:** the sky video scrubs forward frame-by-frame tied to scroll position (see companion doc `scroll-driven-hero-video.md` for implementation — GSAP `ScrollTrigger` driving `video.currentTime`), rather than autoplaying on a timer
- **State 3 — End of hero scroll:** video reaches its final frame and crossfades into the `studyroom.png` still image — a warm, lived-in late-90s/early-2000s bedroom desk setup (CRT monitor glow, bookshelves, desk lamp) — as the resting background for the next section
- **Transition treatment:** crossfade + slight chromatic/glow "flash" at the handoff point (reference pxpush.com's WebGL background transitions) so the cut from cool blue sky to warm amber studyroom feels intentional, not abrupt
- **Reverse scroll:** scrolling back up reverses the sequence (studyroom fades back to sky, video scrubs backward) for a seamless two-way experience

**Interactive Components (reference: pxpush.com elements)**
1. **Interactive Background** — hero sky/clouds react subtly to cursor position (parallax shift, light glow following mouse)
2. **Rotating 3D Showcase** — a circular/orbit layout (team, features, or product cards) that rotates continuously and highlights the item nearest the cursor, similar to "Rotating Founders"
3. **Animated Pricing/Feature Panels** — glass-morphic cards with WebGL shader borders (chrome sheen, animated gradient outline) that lift/tilt on hover
4. **Mouse-Reactive FAQ/Accordion** — smooth GSAP expand/collapse with cursor-following glow or magnetic hover effect
5. **Footer Trails** — logo or icon leaves a soft holographic trail as the cursor moves across the footer

**Motion & Tech**
- GSAP for scroll-triggered reveals, timeline choreography, and magnetic/hover micro-interactions
- GSAP `ScrollTrigger` driving hero video `currentTime` (frame-accurate scroll scrub) + crossfade handoff to `studyroom.png`
- Three.js or WebGL shaders for the 3D hero object and glass/chrome material effects
- Smooth 60fps performance, seamless looping background at rest, no jump cuts during scroll-scrub or crossfade
- Scroll-linked parallax between sky/studyroom background, 3D object, and foreground content layers
- Subtle grain/sheen overlay across the whole site for a glossy Y2K UI feel

**Deliverable**
- Fully responsive (desktop-first, graceful mobile fallback — reduce 3D complexity on mobile for performance)
- Should read as a modern, high-production Y2K revival: nostalgic but polished, award-submission quality (Awwwards/CSS Design Awards tier)
