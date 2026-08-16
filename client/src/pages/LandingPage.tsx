import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const LP = {
  bg: "#0D0D18",
  surface: "#121220",
  fg: "#F4F0E8",
  fgMuted: "#8A8A9A",
  amber: "#E8A020",
  amberHover: "#F0B840",
  teal: "#5BBE9C",
  red: "#FF6464",
  border: "#22223A",
} as const;

const CHAPTERS = [
  {
    n: "02",
    title: "เช็คอินด้วยใบหน้า",
    sub: "FACE CHECK-IN",
    desc: "สแกนสีหน้าผ่านกล้องเพื่อสำรวจอารมณ์ปัจจุบัน ไม่จำเป็นต้องพิมพ์",
    video: "/videos/face-checkin.mp4",
    featured: false,
  },
  {
    n: "03",
    title: "พิมพ์ความรู้สึก",
    sub: "TEXT CHECK-IN",
    desc: "เขียนระบายทุกวัน AI รับฟังและสะท้อนมุมมองใหม่กลับมาให้ เริ่มต้นได้ทุกเวลา ไม่มีขั้นต่ำ",
    video: "/videos/text-checkin.mp4",
    featured: true,
  },
  {
    n: "04",
    title: "พูดระบาย",
    sub: "VOICE CHECK-IN",
    desc: "อัดเสียงพูดคุย AI วิเคราะห์น้ำเสียงและความหมาย เหมือนมีเพื่อนฟัง",
    video: "/videos/voice-checkin.mp4",
    featured: false,
  },
  {
    n: "05",
    title: "สะท้อนจากการบ้าน",
    sub: "HOMEWORK SNAPSHOT",
    desc: "ถ่ายรูปโน้ตหรือการบ้าน AI สังเกตสัญญาณความเครียดที่ซ่อนอยู่",
    video: "/videos/homework-photo.mp4",
    featured: false,
  },
  {
    n: "06",
    title: "กราฟแนวโน้มอารมณ์",
    sub: "EMOTION TREND",
    desc: "ดูแนวโน้มอารมณ์ 7–30 วัน เข้าใจตัวเองดีขึ้นทีละวัน",
    video: "/videos/emotion-trend.mp4",
    featured: false,
  },
] as const;
const STRIP_ITEMS = [
  "เช็คอินด้วยใบหน้า", "พิมพ์ความรู้สึก", "พูดระบาย",
  "สะท้อนจากการบ้าน", "แนวโน้มอารมณ์",
  "Face Check-In", "Text Check-In", "Voice Check-In",
  "Homework Snapshot", "Emotion Trend",
];

const LAND_STYLE = `
  * { box-sizing: border-box; }
  @media (prefers-reduced-motion: reduce) {
    .lp-word { opacity: 1 !important; transform: none !important; filter: none !important; }
    .lp-reveal { opacity: 1 !important; transform: none !important; filter: none !important; }
    .lp-strip-inner { animation-play-state: paused !important; }
  }
  .lp-cta-btn { transition: background 0.18s; }
  .lp-cta-btn:hover { background: #F0B840 !important; }
  .lp-hotline { text-decoration: none; position: relative; }
  .lp-hotline::after {
    content: ''; position: absolute; bottom: -1px; left: 0;
    width: 100%; height: 1px; background: currentColor;
    transform: scaleX(0); transform-origin: left;
    transition: transform 0.35s cubic-bezier(0.22,1,0.36,1);
  }
  .lp-hotline:hover::after { transform: scaleX(1); }
  .lp-strip { overflow: hidden; white-space: nowrap; user-select: none; }
  .lp-strip-inner {
    display: inline-flex; gap: 0;
    animation: lpStripLeft 22s linear infinite;
  }
  .lp-strip-inner.rev { animation-name: lpStripRight; animation-duration: 28s; }
  @keyframes lpStripLeft {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes lpStripRight {
    from { transform: translateX(-50%); }
    to   { transform: translateX(0); }
  }
  .lp-chapter-track {
    position: sticky; top: 0; height: 100svh; overflow: hidden; display: flex;
  }
  .lp-chapter-panels { display: flex; flex-shrink: 0; will-change: transform; }
  .lp-chapter-panel {
    flex-shrink: 0; width: 100vw; height: 100svh;
    display: grid; grid-template-columns: 1fr 1fr;
    align-items: center; padding: 0 8vw; gap: 6vw;
  }
  .lp-chapter-panel.rev { direction: rtl; }
  .lp-chapter-panel.rev > * { direction: ltr; }
  .lp-line-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5vw; align-items: center; }
  .lp-progress-bar {
    position: fixed; top: 0; left: 0; height: 2px; width: 100%;
    background: #5BBE9C; transform-origin: left;
    transform: scaleX(0); z-index: 200;
  }
  @media (max-width: 768px) {
    .lp-chapter-panel {
      grid-template-columns: 1fr !important; direction: ltr !important;
      padding: 5rem 6vw 4rem; gap: 2rem; overflow-y: auto; align-content: center;
    }
    .lp-chapter-panel.rev { direction: ltr !important; }
    .lp-line-grid { grid-template-columns: 1fr !important; }
    .lp-hero-headline { font-size: clamp(2.4rem, 11vw, 5rem) !important; }
  }
`;
function MagneticBtn({ children, onClick, large }: {
  children: React.ReactNode; onClick?: () => void; large?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.22, y: (e.clientY - r.top - r.height / 2) * 0.22, duration: 0.4, ease: "power2.out" });
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.background = LP.amber;
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.6, ease: "expo.out" });
  };
  return (
    <button ref={ref} onClick={onClick} onMouseMove={onMove}
      onMouseEnter={(e) => { e.currentTarget.style.background = LP.amberHover; }}
      onMouseLeave={onLeave} className="lp-cta-btn"
      style={{ display: "inline-block", padding: large ? "1.1rem 2.8rem" : "0.7rem 1.8rem",
        background: LP.amber, color: LP.bg, fontWeight: 800,
        fontSize: large ? "1rem" : "0.825rem", fontFamily: "'Noto Sans Thai', sans-serif",
        letterSpacing: "0.025em", border: "none", cursor: "pointer", borderRadius: 0 }}>
      {children}
    </button>
  );
}

function LPNav({ onEnter }: { onEnter: () => void }) {
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex",
      alignItems: "center", justifyContent: "space-between", padding: "1.25rem 2rem",
      background: `linear-gradient(to bottom, ${LP.bg}F0, transparent)`, backdropFilter: "blur(6px)" }}>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.65rem",
        letterSpacing: "0.14em", textTransform: "uppercase", color: LP.fg, opacity: 0.75 }}>
        JaiKrajok — กระจกสะท้อนใจ
      </span>
      <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
        <a href="tel:1323" className="lp-hotline"
          style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.65rem", color: LP.red,
            letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6.62 10.79c1.44 1.44 3.08 2.79 4.4 3.47l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
          1323
        </a>
        <MagneticBtn onClick={onEnter}>เข้าสู่ระบบ</MagneticBtn>
      </div>
    </nav>
  );
}

function KineticStrip({ rev }: { rev?: boolean }) {
  const doubled = [...STRIP_ITEMS, ...STRIP_ITEMS];
  return (
    <div className="lp-strip" style={{ padding: "0.85rem 0", borderBottom: `1px solid ${LP.border}` }}>
      <div className={`lp-strip-inner${rev ? " rev" : ""}`}>
        {doubled.map((item, i) => (
          <span key={i} style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.7rem",
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: rev ? LP.teal : LP.fgMuted, padding: "0 2.5rem", opacity: 0.75 }}>
            {item} /
          </span>
        ))}
      </div>
    </div>
  );
}
export default function LandingPage({ onEnter }: { onEnter: () => void }) {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const chaptersRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // progress bar scrub
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: (self) => {
        if (progressRef.current)
          progressRef.current.style.transform = `scaleX(${self.progress})`;
      },
    });

    // hero: per-character blur-rise
    if (heroRef.current) {
      const words = heroRef.current.querySelectorAll(".lp-word");
      gsap.fromTo(words,
        { y: 55, opacity: 0, filter: "blur(10px)" },
        { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.0, ease: "expo.out", stagger: 0.045, delay: 0.1 }
      );
    }

    // hero video: subtle parallax
    if (heroVideoRef.current) {
      gsap.to(heroVideoRef.current, {
        yPercent: 14, ease: "none",
        scrollTrigger: { start: "top top", end: "bottom top", scrub: true },
      });
    }

    // pinned horizontal chapter scrub
    if (chaptersRef.current && panelsRef.current) {
      const totalWidth = (CHAPTERS.length - 1) * window.innerWidth;
      gsap.to(panelsRef.current, {
        x: -totalWidth, ease: "none",
        scrollTrigger: {
          trigger: chaptersRef.current,
          start: "top top",
          end: () => `+=${totalWidth}`,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          snap: {
            snapTo: 1 / (CHAPTERS.length - 1),
            duration: { min: 0.2, max: 0.45 },
            delay: 0.05,
            ease: "power1.inOut",
          },
        },
      });
    }

    // LINE section scroll reveal
    const lineSec = document.querySelector(".lp-line-sec");
    if (lineSec) {
      gsap.fromTo(
        lineSec.querySelectorAll(".lp-reveal"),
        { opacity: 0, y: 48, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.88, ease: "expo.out", stagger: 0.1,
          scrollTrigger: { trigger: lineSec, start: "top 80%", once: true } }
      );
    }

    return () => { ScrollTrigger.getAll().forEach((t) => t.kill()); };
  }, []);
  return (
    <div style={{ background: LP.bg, color: LP.fg, fontFamily: "'Noto Sans Thai', sans-serif", overflowX: "hidden" }}>
      <style>{LAND_STYLE}</style>
      <div ref={progressRef} className="lp-progress-bar" aria-hidden="true" />
      <LPNav onEnter={onEnter} />

      {/* ── HERO ── */}
      <section style={{ position: "relative", height: "100svh", minHeight: 640, overflow: "hidden" }}>
        <video ref={heroVideoRef} src="/videos/hero.mp4" autoPlay loop muted playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "110%", objectFit: "cover", opacity: 0.38, top: "-5%" }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, ${LP.bg}80 0%, ${LP.bg}20 35%, ${LP.bg}D8 82%, ${LP.bg} 100%)` }} />
        <div ref={heroRef} style={{ position: "relative", zIndex: 1, height: "100%", display: "flex",
          flexDirection: "column", justifyContent: "flex-end", padding: "0 8vw 8vh" }}>
          <h1 className="lp-hero-headline" style={{ fontFamily: "'Noto Sans Thai', sans-serif",
            fontWeight: 900, fontSize: "clamp(3rem, 10vw, 9rem)", lineHeight: 1.0,
            margin: "0 0 1.5rem", color: LP.fg, letterSpacing: "-0.03em" }}>
            {"ทุกความรู้สึก".split("").map((ch, i) => (
              <span key={i} className="lp-word" style={{ display: "inline-block" }}>{ch}</span>
            ))}
            <br />
            {"มีความหมาย".split("").map((ch, i) => (
              <span key={i + 30} className="lp-word" style={{ display: "inline-block" }}>{ch}</span>
            ))}
          </h1>
          <p className="lp-word" style={{ fontSize: "clamp(0.9rem,1.6vw,1.05rem)", color: LP.fgMuted,
            marginBottom: "2.5rem", maxWidth: "44ch", lineHeight: 1.75 }}>
            AI ผู้ฟังที่เข้าใจอารมณ์ สำหรับนักเรียนไทยชั้น ม.4–ม.6<br />
            สำรวจความรู้สึกทุกวัน ไม่มีการวินิจฉัย เป็นส่วนตัว ๑๐๐%
          </p>
          <div className="lp-word" style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <MagneticBtn onClick={onEnter} large>เริ่มเช็คอิน ↗</MagneticBtn>
            <a href="tel:1323" className="lp-hotline"
              style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.7rem", color: LP.red, letterSpacing: "0.1em" }}>
              วิกฤต? โทร 1323
            </a>
          </div>
          <span className="lp-word" style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.55rem",
            letterSpacing: "0.2em", textTransform: "uppercase", color: LP.fgMuted, opacity: 0.4, marginTop: "3.5rem" }}>
            SCROLL ↓
          </span>
        </div>
      </section>

      {/* ── KINETIC STRIP ── */}
      <div style={{ borderTop: `1px solid ${LP.border}` }}>
        <KineticStrip />
        <KineticStrip rev />
      </div>

      {/* ── SAFETY STRIP ── */}
      <div style={{ position: "relative", overflow: "hidden", padding: "1.5rem 2rem",
        background: `${LP.red}10`, borderTop: `1px solid ${LP.red}35`, borderBottom: `1px solid ${LP.red}35`,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <video src="/videos/safety-hotline.mp4" autoPlay loop muted playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.07 }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "1rem" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={LP.red}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <a href="tel:1323" className="lp-hotline"
              style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.85rem", fontWeight: 700, color: LP.red, letterSpacing: "0.06em" }}>
              สายด่วนสุขภาพจิต 1323
            </a>
            <span style={{ display: "block", fontSize: "0.7rem", color: LP.fgMuted, marginTop: "0.2rem" }}>
              โทรฟรี ตลอด 24 ชั่วโมง
            </span>
          </div>
        </div>
        <span style={{ position: "relative", zIndex: 1, fontSize: "0.72rem", color: LP.fgMuted,
          maxWidth: "48ch", lineHeight: 1.6, fontStyle: "italic" }}>
          JaiKrajok ไม่ใช่บริการสุขภาพจิต ไม่มีการวินิจฉัยโรค หากต้องการความช่วยเหลือเร่งด่วน กรุณาโทร 1323
        </span>
      </div>

      {/* ── SCROLL-DRIVEN CHAPTER STORY ── */}
      <div ref={chaptersRef} style={{ height: `${CHAPTERS.length * 100}svh` }}>
        <div className="lp-chapter-track">
          <div ref={panelsRef} className="lp-chapter-panels">
            {CHAPTERS.map((ch, i) => (
              <div key={ch.n}
                className={`lp-chapter-panel${i % 2 !== 0 ? " rev" : ""}`}
                style={{ borderLeft: i > 0 ? `1px solid ${LP.border}` : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.6rem",
                    color: LP.teal, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "1rem" }}>
                    Nº {ch.n} / {ch.sub}
                  </span>
                  <h2 style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 900,
                    fontSize: ch.featured ? "clamp(2rem,4vw,3.5rem)" : "clamp(1.5rem,2.8vw,2.5rem)",
                    color: LP.fg, margin: "0 0 1.25rem", lineHeight: 1.05, letterSpacing: "-0.025em" }}>
                    {ch.title}
                  </h2>
                  {ch.featured && (
                    <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.58rem",
                      color: LP.teal, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                      — จุดเริ่มต้นที่แนะนำ
                    </p>
                  )}
                  <p style={{ fontSize: "0.9rem", color: LP.fgMuted, lineHeight: 1.8, maxWidth: "44ch" }}>
                    {ch.desc}
                  </p>
                </div>
                <div style={{ overflow: "hidden", background: LP.surface, aspectRatio: "16 / 10", width: "100%" }}>
                  <video src={ch.video} autoPlay loop muted playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Nº07 LINE SECTION ── */}
      <section className="lp-line-sec" style={{ padding: "12vh 8vw", background: LP.surface,
        borderTop: `1px solid ${LP.border}`, borderBottom: `1px solid ${LP.border}` }}>
        <div className="lp-line-grid">
          <div>
            <span className="lp-reveal" style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.6rem",
              color: LP.teal, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Nº 07 / LINE OA
            </span>
            <h2 className="lp-reveal" style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 900,
              fontSize: "clamp(1.6rem,3.5vw,3rem)", color: LP.fg, margin: "1.25rem 0 1.5rem",
              lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              เชื่อมต่อ LINE<br />ของโรงเรียน
            </h2>
            <div className="lp-reveal" style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "44ch" }}>
              {["รับการแจ้งเตือนเช็คอินทาง LINE", "ส่งผลสรุปรายสัปดาห์ให้ครูที่ปรึกษา", "เพิ่มเพื่อนผ่าน QR Code ได้เลย"].map((item) => (
                <div key={item} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <span style={{ color: LP.teal, fontWeight: 700, marginTop: "0.1rem" }}>—</span>
                  <span style={{ fontSize: "0.9rem", color: LP.fgMuted, lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-reveal" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <img src="/line-qr.jpg" alt="LINE QR Code — เพิ่มเพื่อน JaiKrajok"
              style={{ width: "clamp(140px,22vw,220px)", height: "auto", imageRendering: "crisp-edges" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.65rem",
              color: LP.fgMuted, letterSpacing: "0.08em" }}>@jaik-oa</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <footer style={{ padding: "14vh 8vw 10vh", textAlign: "center", borderTop: `1px solid ${LP.border}` }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.6rem",
          color: LP.fgMuted, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          — ทดลองใช้งานฟรี —
        </span>
        <h2 style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 900,
          fontSize: "clamp(2rem,5vw,4.5rem)", color: LP.fg, margin: "1.25rem 0 2.5rem",
          lineHeight: 1.05, letterSpacing: "-0.03em" }}>
          พร้อมเริ่มต้นแล้วหรือยัง?
        </h2>
        <MagneticBtn onClick={onEnter} large>เริ่มเช็คอิน ↗</MagneticBtn>
        <div style={{ marginTop: "2.5rem", display: "flex", gap: "2rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onEnter}
            style={{ background: "none", border: "none", color: LP.fgMuted, fontSize: "0.8rem",
              cursor: "pointer", fontFamily: "'Noto Sans Thai', sans-serif",
              textDecoration: "underline", textUnderlineOffset: "3px" }}>
            มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
          </button>
          <a href="tel:1323" className="lp-hotline"
            style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.65rem",
              color: LP.red, letterSpacing: "0.08em" }}>
            สายด่วน 1323
          </a>
        </div>
        <p style={{ marginTop: "4rem", fontSize: "0.7rem", color: LP.fgMuted, opacity: 0.55, lineHeight: 1.6 }}>
          ข้อมูลส่วนตัวถูกปกป้องตาม PDPA • ไม่มีการเก็บข้อมูลชีวมาตร • ลบข้อมูลได้ตลอดเวลา
        </p>
      </footer>
    </div>
  );
}