/**
 * Animation utilities for JaiKrajok.
 *
 * Lightweight, zero-dependency animation hooks using IntersectionObserver
 * and requestAnimationFrame for buttery-smooth transitions.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * True when the OS asks for reduced motion.
 *
 * Read once at module load rather than via a hook: the value is stable for the
 * life of a page view, and the JS-driven animations below need to skip
 * entirely, not fade faster. The CSS side is handled by the
 * prefers-reduced-motion block in index.css.
 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ================================================================
   useInView -- triggers when an element scrolls into the viewport
   ================================================================ */
// The ref is typed RefObject<T> rather than RefObject<T | null> so it can be
// passed straight to a JSX ref prop. React 18's types reserve the nullable form
// for MutableRefObject, which the ref prop does not accept.
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  // Start visible when motion is reduced, so content is never gated behind a
  // reveal animation that will not run.
  const [inView, setInView] = useState(prefersReducedMotion);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // IntersectionObserver is missing in some older in-app browsers; showing the
    // content is the safe failure mode.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.unobserve(el); // only trigger once
      }
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, inView];
}

/* ================================================================
   useCountUp -- smoothly counts from 0 to a target number
   ================================================================ */
export function useCountUp(target: number, duration = 800, startOnMount = true): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!startOnMount || target === 0 || prefersReducedMotion()) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, startOnMount]);

  return value;
}

/* ================================================================
   Ripple effect for buttons
   ================================================================ */
export function createRipple(event: React.MouseEvent<HTMLElement>): void {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  const ripple = document.createElement("span");
  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    background: rgba(255,255,255,0.3);
    border-radius: 50%;
    transform: scale(0);
    animation: ripple-expand 0.5s ease-out;
    pointer-events: none;
  `;

  button.style.position = "relative";
  button.style.overflow = "hidden";
  button.appendChild(ripple);

  setTimeout(() => ripple.remove(), 600);
}
