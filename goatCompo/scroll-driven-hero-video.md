# Scroll-Driven Hero Video (Frame Scrubbing)

## Goal
Hero background video (`kling_20260816_VIDEO_Seamless_l_4624_0.mp4`) stays paused by default. Instead of playing on a timer, it advances **frame-by-frame tied to scroll position** — scroll down = video moves forward, scroll up = video moves backward, no scroll = video freezes.

## Logic
```
if userScroll == True:
    advance video by 1 frame (mapped to scroll delta)
else:
    hold current frame
```

## Implementation (vanilla JS)

```html
<video id="heroVideo" src="/assets/kling_20260816_VIDEO_Seamless_l_4624_0.mp4"
       muted playsinline preload="auto"></video>
```

```javascript
const video = document.getElementById('heroVideo');
let scrollProgress = 0;   // 0 to 1, mapped from page scroll
let targetTime = 0;
let currentTime = 0;

// Wait for metadata so we know video duration
video.addEventListener('loadedmetadata', () => {
  video.pause();          // never autoplay normally
  video.currentTime = 0;
});

// Update target scrub position on scroll
function onScroll() {
  const heroHeight = document.getElementById('hero').offsetHeight;
  const scrollY = window.scrollY;

  // Clamp scroll progress within hero section only
  scrollProgress = Math.min(Math.max(scrollY / heroHeight, 0), 1);
  targetTime = scrollProgress * video.duration;
}

window.addEventListener('scroll', onScroll, { passive: true });

// Smoothly step currentTime toward targetTime, 1 "frame" at a time
function tick() {
  const frameStep = 1 / 30; // assume 30fps source; adjust to actual fps

  if (Math.abs(targetTime - currentTime) > 0.001) {
    // Move exactly one frame per tick toward target (scroll-linked, not time-linked)
    currentTime += Math.sign(targetTime - currentTime) * frameStep;
    currentTime = Math.min(Math.max(currentTime, 0), video.duration);
    video.currentTime = currentTime;
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
```

## Notes
- **No scroll → no movement**: video only updates `currentTime` when `targetTime` differs from `currentTime`, so it's inert at rest.
- **Frame-accurate stepping**: `frameStep = 1 / fps` ensures each tick advances by exactly one frame's worth of time rather than jumping.
- **Looping feel**: since the source video is already a seamless loop, scrubbing past `video.duration` can wrap back to `0` if you want infinite scroll-linked looping — add a modulo check on `targetTime`.
- **Smoothing option**: for a less mechanical feel, lerp `currentTime` toward `targetTime` (e.g. `currentTime += (targetTime - currentTime) * 0.1`) instead of fixed frame steps — trade-off is less literal "1 frame per scroll tick" but smoother motion.
- **Performance**: seeking video via `currentTime` on every scroll event can be jank-prone on some browsers/codecs. For production-grade smoothness (Awwwards-tier), consider:
  - Pre-decoding frames to a `<canvas>` sprite sequence and drawing the correct frame per scroll position, or
  - Using GSAP's `ScrollTrigger` with `video.currentTime` as the animated property (`gsap.to(video, { currentTime: video.duration, scrollTrigger: {...} })`), which handles throttling/easing for you.
- **Mobile**: iOS Safari has quirks with programmatic `currentTime` seeking on `<video>` — test on-device; fallback to the canvas sprite-sequence approach if seeking feels unresponsive.
