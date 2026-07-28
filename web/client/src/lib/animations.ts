/**
 * Animation utilities for JaiKrajok.
 *
 * Lightweight, zero-dependency animation hooks using IntersectionObserver
 * and requestAnimationFrame for buttery-smooth transitions.
 */

import { useEffect, useRef, useState, useCallback, type RefObject } from "react";

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
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

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
    if (!startOnMount || target === 0) {
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
   useStaggerDelay -- returns incrementing delays for list items
   ================================================================ */
export function useStaggerDelay(count: number, baseDelay = 60): number[] {
  return Array.from({ length: count }, (_, i) => i * baseDelay);
}

/* ================================================================
   useSmoothProgress -- animates a progress bar from 0 to target %
   ================================================================ */
export function useSmoothProgress(target: number, duration = 600, trigger = true): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!trigger) return;

    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, trigger]);

  return value;
}

/* ================================================================
   useTypewriter -- types text character by character
   ================================================================ */
export function useTypewriter(text: string, speed = 30, trigger = true): string {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!trigger) {
      setDisplayed("");
      return;
    }

    let i = 0;
    setDisplayed("");

    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, trigger]);

  return displayed;
}

/* ================================================================
   usePageTransition -- manages enter/exit animation states
   ================================================================ */
export type TransitionState = "entering" | "entered" | "exiting" | "exited";

export function usePageTransition(isVisible: boolean, duration = 300): TransitionState {
  const [state, setState] = useState<TransitionState>(isVisible ? "entered" : "exited");

  useEffect(() => {
    if (isVisible) {
      setState("entering");
      const timer = setTimeout(() => setState("entered"), duration);
      return () => clearTimeout(timer);
    } else {
      setState("exiting");
      const timer = setTimeout(() => setState("exited"), duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  return state;
}

/* ================================================================
   useSpring -- spring-physics-based animation
   ================================================================ */
export function useSpring(
  target: number,
  config: { stiffness?: number; damping?: number; mass?: number } = {},
): number {
  const { stiffness = 170, damping = 26, mass = 1 } = config;
  const [value, setValue] = useState(target);
  const velocityRef = useRef(0);
  const currentRef = useRef(target);
  const targetRef = useRef(target);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    targetRef.current = target;

    function tick(time: number) {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.064); // cap at ~15fps min
      lastTimeRef.current = time;

      const displacement = currentRef.current - targetRef.current;
      const springForce = -stiffness * displacement;
      const dampingForce = -damping * velocityRef.current;
      const acceleration = (springForce + dampingForce) / mass;

      velocityRef.current += acceleration * dt;
      currentRef.current += velocityRef.current * dt;

      setValue(currentRef.current);

      // Stop when settled
      if (Math.abs(velocityRef.current) < 0.01 && Math.abs(displacement) < 0.01) {
        currentRef.current = targetRef.current;
        setValue(targetRef.current);
        velocityRef.current = 0;
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, stiffness, damping, mass]);

  return value;
}

/* ================================================================
   Scroll-triggered class toggler (vanilla, for non-React elements)
   ================================================================ */
export function initScrollAnimations(): () => void {
  const elements = document.querySelectorAll("[data-animate]");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const animation = el.dataset.animate || "fade-in";
          el.classList.add(`animate-${animation}`);
          el.style.opacity = "1";
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -30px 0px" },
  );

  elements.forEach((el) => {
    (el as HTMLElement).style.opacity = "0";
    observer.observe(el);
  });

  return () => observer.disconnect();
}

/* ================================================================
   Smooth scroll to element
   ================================================================ */
export function smoothScrollTo(elementId: string, offset = 80): void {
  const el = document.getElementById(elementId);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

/* ================================================================
   Parallax hook -- subtle y-offset based on scroll position
   ================================================================ */
export function useParallax(speed = 0.3): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let ticking = false;

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          setOffset(window.scrollY * speed);
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [speed]);

  return offset;
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
