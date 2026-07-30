import { useState, useRef, useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { gsap } from "gsap";

/* ============ IMAGE PATHS ============ */
const IMG = {
    loginCollage: "/collage/login_collage_ffaf73f0.png",
    grid: "/collage/grid.png",
    handPen: "/collage/hand_pen_b35a681f.png",
    origamiStars: "/collage/origami_stars_0584c42e.png",
    megaphone: "/collage/megaphone_halftone_f526c4ce.png",
    booksStack: "/collage/books_stack_435c2b81.png",
    chatBubbles: "/collage/chat_bubbles_77801543.png",
    chartGraph: "/collage/chart_graph_a92a34b6.png",
    schoolBuilding: "/collage/school_building_8cd04dbb.png",
    shieldLock: "/collage/shield_lock_6bc87c75.png",
    hand: "/collage/hand.png",
    booksStackNoBg: "/collage/books_stack_435c2b81-removebg-preview.png",
    chartGraphNoBg: "/collage/chart_graph_a92a34b6-removebg-preview.png",
    chatBubblesNoBg: "/collage/chat_bubbles_77801543-removebg-preview.png",
    origamiStarsNoBg: "/collage/origami_stars_0584c42e-removebg-preview.png",
    schoolBuildingNoBg: "/collage/school_building_8cd04dbb-removebg-preview.png",
    shieldLockNoBg: "/collage/shield_lock_6bc87c75-removebg-preview.png",
    amplifier: "/collage/amplifier.png",
    bulb: "/collage/bulb.png",
    dots: "/collage/dots.png",
    glasses: "/collage/glasses.png",
    redstar: "/collage/redstar.png",
    star: "/collage/star.png",
};

/* ============ DESIGN TOKENS ============ */
const T = {
  cream: "#F3EEE1",
  black: "#1A1A1A",
  salmon: "#FFB5A7",
  teal: "#2D6A6F",
  red: "#C41E3A",
  white: "#FFFFFF",
  gridLine: "rgba(160,150,130,0.14)",
};

/* ============ EMOJI / MOOD DATA ============ */
interface MoodInfo {
  label: string;
  emoji: string;
  valence: number;
  color: string;
  bg: string;
  text: string;
  edge: string;
  mid: string;
  concern: boolean;
}

const EMO: Record<string, MoodInfo> = {
  stressed: {
    label: "เครียด / กังวล",
    emoji: "😣",
    valence: 0.18,
    color: "#A85F73",
    bg: "#F1DEE3",
    text: "#6B3B49",
    edge: "#A85F73",
    mid: "#F1DEE3",
    concern: true,
  },
  sad: {
    label: "ท้อแท้ / เศร้า",
    emoji: "😢",
    valence: 0.28,
    color: "#6F6389",
    bg: "#E7E3EF",
    text: "#423A56",
    edge: "#6F6389",
    mid: "#E7E3EF",
    concern: true,
  },
  tired: {
    label: "เหนื่อยล้า",
    emoji: "😴",
    valence: 0.35,
    color: "#887F9E",
    bg: "#E7E3EF",
    text: "#423A56",
    edge: "#6F6389",
    mid: "#E7E3EF",
    concern: false,
  },
  neutral: {
    label: "ปกติ",
    emoji: "😐",
    valence: 0.55,
    color: "#2F5D62",
    bg: "#E3EAE0",
    text: "#3C5137",
    edge: "#6C8C64",
    mid: "#E3EAE0",
    concern: false,
  },
  calm: {
    label: "ผ่อนคลาย",
    emoji: "😌",
    valence: 0.72,
    color: "#2F5D62",
    bg: "#E3EAE0",
    text: "#3C5137",
    edge: "#6C8C64",
    mid: "#E3EAE0",
    concern: false,
  },
  positive: {
    label: "สดใส / มีความสุข",
    emoji: "😊",
    valence: 0.9,
    color: "#2F5D62",
    bg: "#E3EAE0",
    text: "#3C5137",
    edge: "#6C8C64",
    mid: "#E3EAE0",
    concern: false,
  },
};

const KEYWORDS: Record<string, string[]> = {
  stressed: ["เครียด", "กังวล", "กลัว", "สอบ", "ทำไม่ทัน", "หนัก", "กดดัน", "วิตก", "แย่แล้ว", "ไม่ทัน"],
  sad: ["เศร้า", "ท้อ", "ผิดหวัง", "ร้องไห้", "แย่", "เบื่อ", "หมดหวัง", "น้อยใจ"],
  tired: ["เหนื่อย", "ง่วง", "หมดแรง", "ไม่มีแรง", "อ่อนเพลีย", "นอนไม่พอ", "ล้า", "หมดไฟ"],
  positive: ["ดีใจ", "สนุก", "มีความสุข", "โล่งใจ", "ผ่านไปได้", "ภูมิใจ", "สำเร็จ", "ทำได้แล้ว"],
  calm: ["สงบ", "โอเค", "ปกติ", "สบายใจ", "ผ่อนคลาย"],
};

const RESPONSES: Record<string, string[]> = {
  stressed: [
    "เข้าใจนะ ความกดดันแบบนี้เป็นเรื่องปกติมากสำหรับช่วงใกล้สอบ ลองพักสายตาสัก 5 นาที แล้วเลือกทำโจทย์ที่มั่นใจที่สุดก่อนได้ไหม กระจกอยู่เป็นเพื่อนด้วยนะ",
    "ฟังดูหนักใจไม่น้อยเลย ลองหายใจเข้าลึกๆ ช้าๆ สัก 3 ครั้ง แล้วค่อยแบ่งงานเป็นชิ้นเล็กๆ ทีละอย่างนะ",
  ],
  sad: [
    "ขอบคุณที่กล้าเล่าให้ฟังนะ ความรู้สึกแบบนี้ไม่ผิดเลย อยากให้รู้ว่ามีที่นี่ให้ระบายได้เสมอ",
    "บางวันก็เป็นแบบนี้แหละ ให้ตัวเองได้เศร้าได้บ้างก็ได้ ลองเล่าเพิ่มได้ไหมว่าเกิดอะไรขึ้น",
  ],
  tired: [
    "ร่างกายกำลังบอกว่าต้องการพักนะ ลองงีบสัก 20 นาที หรือลุกไปเดินยืดเส้นยืดสายก่อนได้ไหม",
    "เหนื่อยล้าสะสมแบบนี้ ถ้าฝืนต่อไปสมองจะจำเนื้อหาได้ยากขึ้นนะ ลองพักจริงจังสักครู่กัน",
  ],
  neutral: [
    "รับทราบนะ ถ้ามีอะไรอยากเล่าเพิ่มเติม หรืออยากให้ช่วยดูการบ้านก็บอกกระจกได้เลย",
    "โอเคเลย กระจกอยู่ตรงนี้ พร้อมฟังทุกเรื่องไม่ว่าจะเรื่องเรียนหรือเรื่องทั่วไป",
  ],
  calm: [
    "ดีใจที่วันนี้ใจสงบนะ รักษาจังหวะแบบนี้ไว้แล้วค่อยๆ ทบทวนบทเรียนไปทีละนิดได้เลย",
    "สบายใจแบบนี้ดีมากเลย ถ้าพร้อมแล้วอยากให้กระจกช่วยทบทวนเรื่องไหนก่อนไหม",
  ],
  positive: [
    "เก่งมากเลย! ความรู้สึกดีๆ แบบนี้ให้ตัวเองได้ภูมิใจไปกับมันเต็มที่นะ",
    "สุดยอดเลย กระจกดีใจไปด้วยนะ ลองเก็บความรู้สึกนี้ไว้เป็นกำลังใจสำหรับตอนที่เหนื่อยด้วย",
  ],
};

const TRANSPARENCY: Record<string, string> = {
  เซลฟี่: "กำลังวิเคราะห์อารมณ์จากใบหน้าของคุณ (Face Recognition API)",
  ข้อความ: "กำลังวิเคราะห์น้ำเสียงจากข้อความ (Sentiment Analysis API)",
  เสียงพูด: "กำลังแปลงเสียงพูดเป็นข้อความ (Speech-to-Text API)",
  รูปการบ้าน: "กำลังอ่านข้อความจากภาพ (OCR API)",
};

const SELFIE_RESULTS = ["stressed", "tired", "neutral", "calm"];
const SELFIE_NOTES: Record<string, string> = {
  stressed: "สีหน้าดูเกร็งบริเวณคิ้วและรอบดวงตา มีสัญญาณของความเครียดสะสม",
  tired: "สีหน้าดูเหนื่อยล้า มีร่องรอยของการพักผ่อนไม่เพียงพอ",
  neutral: "สีหน้าอยู่ในเกณฑ์ปกติ ไม่พบสัญญาณผิดปกติชัดเจน",
  calm: "สีหน้าดูผ่อนคลาย แววตาสดใส",
};

type Page = "login" | "onb1" | "onb2" | "guardian" | "privacy" | "app";
type AppView = "home" | "chat" | "trend" | "school" | "safety";

interface ChatMsg {
  id: string;
  role: "user" | "bot" | "system";
  text: string;
  timestamp: number;
  cardType?: "emotion" | "ocr";
  emotionData?: { label: string; note: string; color: string; bg: string; text: string };
  ocrText?: string;
  sourceTag?: string;
}

interface TrendPoint {
  id: number;
  valence: number;
  color: string;
  key: string;
  label: string;
}

interface LogEntry {
  id: string;
  time: string;
  label: string;
  source: string;
  key: string;
}

/* ============ CHECKERSTRIP ============ */
function CheckerStrip({ className = "" }: { className?: string }) {
  return (
    <div className={`flex overflow-hidden ${className}`} style={{ height: "36px", flexShrink: 0 }}>
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} style={{ flex: 1, background: i % 2 === 0 ? T.black : T.white }} />
      ))}
    </div>
  );
}

/* ============ GRAPH PAPER GRID ============ */
function GraphPaper({ showDots = false, children }: { showDots?: boolean; children?: React.ReactNode }) {
  return (
    <div
      className="relative"
      style={{
        background: `
          linear-gradient(${T.gridLine} 1px, transparent 1px),
          linear-gradient(90deg, ${T.gridLine} 1px, transparent 1px)
        `,
        backgroundSize: "28px 28px",
        backgroundColor: T.cream,
      }}
    >
      {showDots && (
        <div
          className="absolute left-0 top-0 bottom-0 pointer-events-none"
          style={{
            width: "36%",
            backgroundImage: `radial-gradient(circle, rgba(60,60,60,0.45) 2.5px, transparent 2.5px)`,
            backgroundSize: "22px 22px",
            zIndex: 0,
          }}
        />
      )}
      {children}
    </div>
  );
}

/* ============ BRAIN CLOUD SVG ============ */
function BrainCloud({ className = "", size = 200 }: { className?: string; size?: number }) {
  const h = Math.round(size * 0.8);
  return (
    <div className={`absolute pointer-events-none ${className}`} style={{ width: size, height: h }}>
      <svg viewBox="0 0 200 160" width={size} height={h} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="brainBlur2">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <clipPath id="brainClip2">
            <ellipse cx="100" cy="80" rx="85" ry="65" />
          </clipPath>
        </defs>
        <g clipPath="url(#brainClip2)" filter="url(#brainBlur2)">
          {Array.from({ length: 12 }).map((_, row) =>
            Array.from({ length: 16 }).map((_, col) => {
              const x = col * 13 + 5;
              const y = row * 13 + 5;
              const dist = Math.sqrt((x - 100) ** 2 + (y - 80) ** 2);
              const r = Math.max(0, 5.5 - dist * 0.045);
              return r >= 0.5 ? <circle key={`${row}-${col}`} cx={x} cy={y} r={r} fill="#444" opacity="0.9" /> : null;
            })
          )}
        </g>
      </svg>
    </div>
  );
}

/* ============ RED DOT CROSS ============ */
function RedDotCross({ className = "", color = T.red }: { className?: string; color?: string }) {
  return (
    <div className={`absolute pointer-events-none ${className}`}>
      <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
        {[
          [32,8],[40,8],[48,8],
          [24,16],[32,16],[40,16],[48,16],[56,16],
          [16,24],[24,24],[32,24],[40,24],[48,24],[56,24],[64,24],
          [8,32],[16,32],[24,32],[32,32],[40,32],[48,32],[56,32],[64,32],[72,32],
          [8,40],[16,40],[24,40],[32,40],[40,40],[48,40],[56,40],[64,40],[72,40],
          [16,48],[24,48],[32,48],[40,48],[48,48],[56,48],[64,48],
          [24,56],[32,56],[40,56],[48,56],[56,56],
          [32,64],[40,64],[48,64],
          [40,72],
        ].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="3.2" fill={color} opacity="0.9" />)}
      </svg>
    </div>
  );
}

/* ============ HALFTONE DOT FIELD ============ */
function HalftoneField({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute pointer-events-none ${className}`}
      style={{
        backgroundImage: `radial-gradient(circle, rgba(50,50,50,0.5) 2.5px, transparent 2.5px)`,
        backgroundSize: "22px 22px",
      }}
    />
  );
}

/* ============ ONBOARDING CARD SHELL ============ */
function OnbCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative z-10 ${className}`}
      style={{
        background: T.white,
        borderRadius: "20px",
        padding: "44px 48px",
        maxWidth: "560px",
        width: "100%",
        boxShadow: "0 4px 32px rgba(0,0,0,0.07)",
        border: "1.5px solid rgba(200,195,185,0.45)",
      }}
    >
      {children}
    </div>
  );
}

/* ============ TEAL BADGE ============ */
function TealBadge({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="inline-block px-4 py-1.5 rounded-full text-sm mb-5"
      style={{
        border: `1.5px solid ${T.teal}`,
        color: T.teal,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "12px",
        backgroundColor: "rgba(45,106,111,0.07)",
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </div>
  );
}

/* ============ TEAL BUTTON ============ */
function TealBtn({ children, onClick, disabled = false, fullWidth = false }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-8 py-3.5 rounded-full font-bold text-white transition-all active:scale-[0.97] ${fullWidth ? "w-full" : ""}`}
      style={{
        backgroundColor: disabled ? "#a0b8bb" : T.teal,
        fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif",
        fontSize: "15px",
        cursor: disabled ? "default" : "pointer",
        boxShadow: disabled ? "none" : "0 2px 14px rgba(45,106,111,0.28)",
      }}
    >
      {children}
    </button>
  );
}

/* ============ SALMON BUTTON (login) ============ */
function SalmonBtn({ children, onClick, fullWidth = false }: {
  children: React.ReactNode;
  onClick?: () => void;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-8 py-3.5 rounded-full font-bold text-white transition-all active:scale-[0.97] ${fullWidth ? "w-full" : ""}`}
      style={{
        backgroundColor: T.red,
        fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif",
        fontSize: "15px",
        boxShadow: "0 2px 14px rgba(196,30,58,0.3)",
      }}
    >
      {children}
    </button>
  );
}

/* ============ LOGIN PAGE ============ */
function LoginPage({ onNext }: { onNext: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    // Title screen stagger in
    gsap.fromTo(".login-img", { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 1.2, ease: "power3.out" });
    gsap.fromTo(".login-form", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "back.out(1.2)", delay: 0.3 });
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: T.black }}>
      <CheckerStrip className="fixed top-0 left-0 right-0 z-50" />
      
      {/* LEFT: collage only (no grid) */}
      <div
        className="absolute left-0 top-0 bottom-0 z-0 login-img"
        style={{
          width: "55%",
          backgroundColor: T.cream,
        }}
      >
        <img
          src={IMG.loginCollage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-left-top"
          style={{ mixBlendMode: "multiply", opacity: 0.88 }}
        />
        
        {/* Black curved divider sweeping right fully connected */}
        <div className="absolute inset-y-0 right-0 z-10" style={{ width: "25%" }}>
          <svg viewBox="0 0 120 100" preserveAspectRatio="none" className="w-full h-full block">
            <path d="M120,0 C60,20 20,50 20,100 L120,100 Z" fill={T.black} />
          </svg>
        </div>
      </div>

      {/* RIGHT: black panel with form card */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-8 z-10 pointer-events-none" style={{ width: "45%" }}>
        {/* Hand-pen collage */}
        <div className="fixed bottom-0 right-0 z-10 pointer-events-none" style={{ width: "150px" }}>
          <img src={IMG.hand} alt="" className="w-full h-auto opacity-80" />
        </div>
      </div>
      
      <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-8 z-30 login-form" style={{ width: "50%" }}>
        {/* Form card */}
        <div
          style={{
            width: "100%",
            maxWidth: "380px",
            background: "linear-gradient(150deg, #FBCFCA 0%, #FCD5CF 55%, #FDDDD9 100%)",
            borderRadius: "24px",
            padding: "36px 32px",
            boxShadow: "0 12px 60px rgba(0,0,0,0.4)",
            position: "relative",
          }}
        >
          <p className="text-xl font-semibold mb-1" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>Welcome To</p>
          <h1 className="text-5xl font-black mb-6" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.red, lineHeight: 1.1 }}>JaiKraJok</h1>

          <div
            className="flex mb-5 rounded-2xl overflow-hidden"
            style={{ border: "1.5px solid rgba(26,26,26,0.12)", background: "rgba(255,255,255,0.55)" }}
          >
            <button
              onClick={() => setMode("login")}
              className="flex-1 py-2.5 text-sm font-semibold transition-all"
              style={{
                background: mode === "login" ? T.white : "transparent",
                color: T.black,
                fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
                borderRight: "1.5px solid rgba(26,26,26,0.12)",
              }}
            >
              Log In
            </button>
            <button
              onClick={() => setMode("signup")}
              className="flex-1 py-2.5 text-sm font-semibold transition-all"
              style={{
                background: mode === "signup" ? T.white : "transparent",
                color: T.black,
                fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
              }}
            >
              Sign Up
            </button>
          </div>

          <label className="block text-sm font-bold mb-1.5" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.red }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl mb-4 outline-none transition-all focus:ring-2"
            style={{
              backgroundColor: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(0,0,0,0.05)",
              color: T.black,
              fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
            }}
          />

          <label className="block text-sm font-bold mb-1.5" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.red }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl mb-6 outline-none transition-all focus:ring-2"
            style={{
              backgroundColor: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(0,0,0,0.05)",
              color: T.black,
              fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
            }}
          />

          <button
            onClick={() => {
              if (!email || !password) { toast("กรุณากรอกอีเมลและรหัสผ่าน"); return; }
              onNext();
            }}
            className="w-full py-3.5 rounded-full font-bold text-white text-base mb-3 transition-all active:scale-[0.97]"
            style={{ backgroundColor: T.red, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", boxShadow: "0 2px 12px rgba(196,30,58,0.3)" }}
          >
            {mode === "login" ? "Log In" : "Sign Up"}
          </button>

          <div className="text-center text-xs mb-3" style={{ color: "rgba(26,26,26,0.6)", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>or</div>

          <button
            className="w-full py-3 rounded-full font-bold text-base mb-3 transition-all active:scale-[0.97] bg-white flex items-center justify-center"
            style={{ color: T.black, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}
          >
            Sign Up
          </button>

          <button
            onClick={() => toast("ฟีเจอร์ Google Login กำลังพัฒนา")}
            className="w-full py-3 rounded-full font-bold text-white text-base transition-all active:scale-[0.97] flex items-center justify-center gap-2"
            style={{ backgroundColor: T.red, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", boxShadow: "0 2px 12px rgba(196,30,58,0.3)" }}
          >
            Log In With Google
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function OnbWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>
        <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-60" alt="" />
        <img src={IMG.origamiStarsNoBg} className="absolute bottom-10 left-10 w-96 h-auto pointer-events-none z-0" alt="" />
        <img src={IMG.hand} className="absolute bottom-[-40px] right-[-40px] w-[420px] h-auto pointer-events-none z-0 opacity-70" alt="" />
        <img src={IMG.redstar} className="absolute top-16 right-24 w-16 h-auto pointer-events-none z-0" alt="" />
        <div className="relative mx-auto z-10" style={{ background: "#ffffff", borderRadius: "20px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.05)" }}>
        <h2 className="text-[2.2rem] font-black mb-4" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          ยินดีต้อนรับสู่ JaiKraJok
        </h2>
        <p className="text-base mb-12" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#4a4a4a" }}>
          พื้นที่ปลอดภัยสำหรับแชร์ความรู้สึกของคุณ เราพร้อมรับฟังและเคียงข้างเสมอ
        </p>
        <button onClick={onNext} className="px-8 py-3 rounded-full transition-all active:scale-[0.97]" style={{ backgroundColor: "#2D6A6F" }}>
          <span style={{ color: "#ffffff", fontWeight: "bold", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>เริ่มกันเลย</span>
        </button>
      </div>
    </div>
  );
}

function OnbAge({ age, setAge, onNext }: { age: string; setAge: (v: string) => void; onNext: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>
        <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-60" alt="" />
        <img src={IMG.booksStackNoBg} className="absolute bottom-0 left-0 w-80 h-auto pointer-events-none z-0" alt="" />
        <img src={IMG.glasses} className="absolute top-4 right-10 w-96 h-auto pointer-events-none z-0 opacity-80" alt="" />
        <div className="relative mx-auto z-10" style={{ background: "#ffffff", borderRadius: "20px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.05)" }}>
        <h2 className="text-[2.2rem] font-black mb-4" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          คุณอายุเท่าไหร่?
        </h2>
        <p className="text-base mb-10" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#4a4a4a" }}>
          เพื่อประสบการณ์ที่เหมาะสมกับคุณ
        </p>
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="ระบุอายุของคุณ"
          className="w-full px-5 py-4 rounded-2xl mb-10 outline-none focus:ring-2 text-lg text-center"
          style={{ backgroundColor: "#EBE5DC", border: "2px solid #1a1a1a", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}
        />
        <button onClick={() => { if (!age || parseInt(age) <= 0) return; onNext(); }} className="px-8 py-3 rounded-full transition-all active:scale-[0.97]" style={{ backgroundColor: "#2D6A6F" }}>
          <span style={{ color: "#ffffff", fontWeight: "bold", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>ถัดไป</span>
        </button>
      </div>
    </div>
  );
}

function GuardianPage({ approved, onSend, onNext, guardianEmail, setGuardianEmail }: any) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>
        <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-60" alt="" />
        <img src={IMG.shieldLockNoBg} className="absolute top-10 right-10 w-64 h-auto pointer-events-none z-0" alt="" />
        <img src={IMG.bulb} className="absolute bottom-16 left-16 w-32 h-auto pointer-events-none z-0 " alt="" />
        <div className="relative mx-auto z-10" style={{ background: "#ffffff", borderRadius: "20px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.05)" }}>
        <h2 className="text-[2.2rem] font-black mb-4" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          ขอความยินยอมจากผู้ปกครอง
        </h2>
        <p className="text-base mb-8 leading-relaxed" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#4a4a4a" }}>
          เนื่องจากคุณอายุต่ำกว่า 13 ปี เราจำเป็นต้องได้รับความยินยอมจากผู้ปกครองของคุณ
        </p>
        {!approved ? (
          <div className="flex flex-col gap-6">
            <input
              type="email"
              placeholder="อีเมลผู้ปกครอง"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl outline-none focus:ring-2 text-base"
              style={{ backgroundColor: "#EBE5DC", border: "2px solid #1a1a1a", color: "#1a1a1a", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}
            />
            <button onClick={onSend} className="w-full py-4 rounded-full font-bold text-white text-base transition-all active:scale-[0.97]" style={{ backgroundColor: "#1a1a1a", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
              ส่งคำขอความยินยอม
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="p-5 rounded-2xl text-center" style={{ backgroundColor: "#E8F5E9", border: "2px solid #4CAF50", color: "#2E7D32", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", fontWeight: "bold" }}>
              ✓ ได้รับความยินยอมแล้ว
            </div>
            <button onClick={onNext} className="w-full py-4 rounded-full font-bold text-white text-base transition-all active:scale-[0.97]" style={{ backgroundColor: "#2D6A6F", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
              ถัดไป
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PrivacyPage({ onNext }: { onNext: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>
        <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-60" alt="" />
        <img src={IMG.chartGraphNoBg} className="absolute bottom-10 left-10 w-96 h-auto pointer-events-none z-0" alt="" />
        <img src={IMG.dots} className="absolute top-16 right-16 w-32 h-auto pointer-events-none z-0 " alt="" />
        <div className="relative mx-auto z-10" style={{ background: "#ffffff", borderRadius: "20px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.05)" }}>
        <h2 className="text-[2.2rem] font-black mb-4" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          นโยบายความเป็นส่วนตัว
        </h2>
        <div
          className="mb-8 p-6 rounded-2xl text-sm leading-relaxed overflow-y-auto"
          style={{
            backgroundColor: "#EBE5DC",
            border: "2px solid #1a1a1a",
            height: "220px",
            color: "#4a4a4a",
            fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif",
          }}
        >
          <p className="mb-4">เราให้ความสำคัญกับความเป็นส่วนตัวของคุณ ข้อมูลทั้งหมดที่คุณแชร์ใน JaiKraJok จะถูกเก็บรักษาเป็นความลับและปลอดภัย</p>
          <p className="mb-4">1. ข้อมูลส่วนบุคคลจะถูกใช้เพื่อปรับปรุงประสบการณ์ของคุณเท่านั้น</p>
          <p className="mb-4">2. เราไม่มีนโยบายส่งต่อข้อมูลของคุณให้กับบุคคลที่สาม</p>
          <p>3. คุณสามารถขอลบข้อมูลของคุณได้ตลอดเวลาผ่านเมนูตั้งค่า</p>
        </div>
        <button onClick={onNext} className="px-8 py-3 rounded-full transition-all active:scale-[0.97]" style={{ backgroundColor: "#2D6A6F" }}>
          <span style={{ color: "#ffffff", fontWeight: "bold", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>ยอมรับและเข้าสู่ระบบ</span>
        </button>
      </div>
    </div>
  );
}

/* ============ MAIN APP SHELL ============ */
function AppShell() {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [age] = useState("16");
  const [guardianConsent] = useState(true);
  const [mood, setMood] = useState<string>("calm");
  const [lineNotify, setLineNotify] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "init",
      role: "bot",
      text: "สวัสดีค่ะ วันนี้อยากเล่าอะไรให้กระจกฟังไหม จะพิมพ์ พูด ถ่ายเซลฟี่ หรือถ่ายรูปการบ้านก็ได้นะ",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [concernStreak, setConcernStreak] = useState(0);
  const [modesUsed, setModesUsed] = useState<Set<string>>(new Set());
  const [transparencyLogs, setTransparencyLogs] = useState<string[]>([]);
  const [showEscalationModal, setShowEscalationModal] = useState(false);

  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) { toast("เบราว์เซอร์นี้ไม่รองรับ Text-to-Speech"); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    u.rate = 0.98;
    window.speechSynthesis.speak(u);
    toast("🔊 กำลังอ่านข้อความเสียง...");
  };

  const pushTrend = useCallback((key: string, sourceLabel: string) => {
    const info = EMO[key] || EMO.neutral;
    setMood(key);
    setTrendData((prev) => {
      const nextId = prev.length > 0 ? prev[prev.length - 1].id + 1 : 1;
      return [...prev, { id: nextId, valence: info.valence, color: info.color, key, label: info.label }].slice(-9);
    });
    const nowStr = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    setLogEntries((prev) => [{ id: Math.random().toString(), time: nowStr, label: info.label, source: sourceLabel, key }, ...prev.slice(0, 19)]);
    setConcernStreak((prevStreak) => {
      const newStreak = info.concern ? prevStreak + 1 : 0;
      if (newStreak >= 3) setTimeout(() => setShowEscalationModal(true), 1200);
      return newStreak;
    });
  }, []);

  const noteMultimodal = useCallback((sourceLabel: string) => {
    setModesUsed((prev) => {
      const nextSet = new Set(prev).add(sourceLabel);
      if (nextSet.size === 2 && !prev.has(sourceLabel)) {
        setTimeout(() => {
          setMessages((msgs) => [...msgs, {
            id: Math.random().toString(),
            role: "system",
            text: `Pathumma LLM กำลังรวมข้อมูลจากหลายแหล่ง (${Array.from(nextSet).join(" + ")}) เพื่อให้คำแนะนำที่แม่นยำขึ้น`,
            timestamp: Date.now(),
          }]);
        }, 600);
      }
      return nextSet;
    });
    const transNote = TRANSPARENCY[sourceLabel] || "กำลังวิเคราะห์ข้อมูลด้วย Pathumma LLM";
    setTransparencyLogs((prev) => [transNote, ...prev.slice(0, 4)]);
  }, []);

  const detectEmotion = (text: string) => {
    const t = text.toLowerCase();
    const scores: Record<string, number> = {};
    for (const key in KEYWORDS) {
      scores[key] = KEYWORDS[key].reduce((acc, word) => acc + (t.includes(word) ? 1 : 0), 0);
    }
    let bestKey = "neutral", bestScore = 0;
    for (const key in scores) { if (scores[key] > bestScore) { bestKey = key; bestScore = scores[key]; } }
    return bestScore === 0 ? "neutral" : bestKey;
  };

  const sendMessage = useCallback((overrideText?: string, sourceLabel: string = "ข้อความ") => {
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    if (!textToSend.trim()) return;
    if (overrideText === undefined) setInputText("");
    setMessages((prev) => [...prev, { id: Math.random().toString(), role: "user", text: textToSend, timestamp: Date.now(), sourceTag: sourceLabel !== "ข้อความ" ? sourceLabel : undefined }]);
    noteMultimodal(sourceLabel);
    setIsAnalyzing(true);
    const key = detectEmotion(textToSend);
    setTimeout(() => {
      const list = RESPONSES[key] || RESPONSES.neutral;
      setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: list[Math.floor(Math.random() * list.length)], timestamp: Date.now() }]);
      setIsAnalyzing(false);
      pushTrend(key, sourceLabel);
    }, 1000);
  }, [inputText, noteMultimodal, pushTrend]);

  const handleSelfie = () => {
    setMessages((prev) => [...prev, { id: Math.random().toString(), role: "user", text: "📷 ถ่ายเซลฟี่เพื่อวิเคราะห์สีหน้า", timestamp: Date.now(), sourceTag: "เซลฟี่" }]);
    noteMultimodal("เซลฟี่");
    setIsAnalyzing(true);
    setTimeout(() => {
      const key = SELFIE_RESULTS[Math.floor(Math.random() * SELFIE_RESULTS.length)];
      const info = EMO[key];
      const note = SELFIE_NOTES[key];
      setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: note, timestamp: Date.now(), cardType: "emotion", emotionData: { label: info.label, note, color: info.color, bg: info.bg, text: info.text } }]);
      setIsAnalyzing(false);
      pushTrend(key, "เซลฟี่");
      setTimeout(() => {
        const list = RESPONSES[key];
        setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: list[Math.floor(Math.random() * list.length)], timestamp: Date.now() }]);
      }, 700);
    }, 1200);
  };

  const handleVoice = () => {
    const samples = ["วันนี้เหนื่อยมากเลย อ่านหนังสือทั้งวัน", "พรุ่งนี้สอบแล้วรู้สึกกังวลนิดหน่อย", "วันนี้โอเคดี สบายใจ", "เครียดมาก ทำโจทย์ไม่ได้เลย"];
    sendMessage(`🎤 (เสียงพูด): "${samples[Math.floor(Math.random() * samples.length)]}"`, "เสียงพูด");
  };

  const handleHomeworkPhoto = () => {
    setMessages((prev) => [...prev, { id: Math.random().toString(), role: "user", text: "🖼️ แนบรูปถ่ายการบ้าน (Homework.jpg)", timestamp: Date.now(), sourceTag: "รูปการบ้าน" }]);
    noteMultimodal("รูปการบ้าน");
    setIsAnalyzing(true);
    setTimeout(() => {
      setMessages((prev) => [...prev,
        { id: Math.random().toString(), role: "bot", text: "อ่านโจทย์สมการเชิงเส้นเรียบร้อยแล้ว", timestamp: Date.now(), cardType: "ocr", ocrText: '"...จงหาค่า x จากสมการ 2x + 5 = 17 พร้อมแสดงวิธีทำ..."' },
        { id: Math.random().toString(), role: "bot", text: "กระจกอ่านโจทย์แล้วนะ ดูเหมือนเป็นโจทย์สมการเชิงเส้น ลองบอกกระจกได้ไหมว่าติดขั้นตอนไหนอยู่", timestamp: Date.now() + 50 },
      ]);
      setIsAnalyzing(false);
      pushTrend("neutral", "รูปการบ้าน");
    }, 1300);
  };

  const resetChat = () => {
    setMessages([{ id: "init_" + Date.now(), role: "bot", text: "สวัสดีค่ะ วันนี้อยากเล่าอะไรให้กระจกฟังไหม จะพิมพ์ พูด ถ่ายเซลฟี่ หรือถ่ายรูปการบ้านก็ได้นะ", timestamp: Date.now() }]);
    setTrendData([]); setLogEntries([]); setConcernStreak(0); setModesUsed(new Set()); setTransparencyLogs([]); setMood("calm");
    toast("เริ่มการสนทนาใหม่แล้ว");
  };

  const tryMode = (mode: "camera" | "keyboard" | "mic" | "photo") => {
    setCurrentView("chat");
    setTimeout(() => {
      if (mode === "camera") handleSelfie();
      else if (mode === "mic") handleVoice();
      else if (mode === "photo") handleHomeworkPhoto();
    }, 300);
  };

  const navItems: { id: AppView; label: string; iconSrc: string }[] = [
    { id: "home", label: "หน้าหลัก", iconSrc: IMG.redstar },
    { id: "chat", label: "แชท", iconSrc: IMG.chatBubblesNoBg },
    { id: "trend", label: "แนวโน้มของฉัน", iconSrc: IMG.chartGraphNoBg },
    { id: "school", label: "ภาพรวมโรงเรียน", iconSrc: IMG.schoolBuildingNoBg },
    { id: "safety", label: "ความปลอดภัย & ข้อมูล", iconSrc: IMG.shieldLockNoBg },
  ];

  const pageLabel: Record<AppView, string> = {
    home: "หน้าหลัก",
    chat: "คุยกับกระจก",
    trend: "แนวโน้มของฉัน",
    school: "ภาพรวมโรงเรียน",
    safety: "ความปลอดภัย & ข้อมูล",
  };

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: T.cream }}>

      {/* TOP CHECKERBOARD with salmon tab break */}
      <div className="fixed top-0 left-0 right-0 z-50 flex" style={{ height: "36px" }}>
        {/* Checker left of active tab */}
        <div className="flex overflow-hidden" style={{ flex: "0 0 230px" }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} style={{ flex: 1, background: i % 2 === 0 ? T.black : T.white }} />
          ))}
        </div>
        {/* Active page label tab (salmon) */}
        <div
          className="flex items-center justify-center px-6 flex-shrink-0"
          style={{
            background: T.salmon,
            fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif",
            fontWeight: 700,
            fontSize: "13px",
            color: T.black,
            minWidth: "120px",
          }}
        >
          {pageLabel[currentView]}
        </div>
        {/* Checker right */}
        <div className="flex overflow-hidden flex-1">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} style={{ flex: 1, background: i % 2 === 0 ? T.black : T.white }} />
          ))}
        </div>
      </div>

      <div className="flex flex-1" style={{ paddingTop: "36px" }}>
        {/* LEFT SIDEBAR — pure black, curved right edge */}
        <div className="fixed left-0 z-40 flex flex-col overflow-hidden" style={{ top: "36px", bottom: 0, width: "230px" }}>
          {/* Black body */}
          <div
            className="relative flex flex-col h-full"
            style={{ backgroundColor: T.black }}
          >
            {/* Curved right edge mask */}
            <div
              className="absolute right-0 top-0 bottom-0 pointer-events-none"
              style={{ width: "32px", zIndex: 1 }}
            >
              <svg viewBox="0 0 32 100" preserveAspectRatio="none" className="w-full h-full block">
                <path d="M32,0 L32,100 C20,80 0,60 0,35 C0,20 12,8 32,0 Z" fill={T.cream} />
              </svg>
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full px-5 py-6" style={{ paddingRight: "28px" }}>
              {/* Brand */}
              <div className="mb-8">
                <h1
                  className="font-black leading-tight"
                  style={{ fontFamily: "'Taviraj', Georgia, serif", color: T.salmon, fontSize: "1.7rem" }}
                >
                  JaiKraJok
                </h1>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,181,167,0.6)", fontSize: "10px", letterSpacing: "0.08em" }}>
                  กระจกสะท้อนใจ
                </p>
              </div>

              {/* Nav */}
              <nav className="flex-1 flex flex-col gap-1">
                {navItems.map((item) => {
                  const active = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentView(item.id);
                        // GSAP pop animation on click
                        const el = document.getElementById(`nav-icon-${item.id}`);
                        if (el) gsap.fromTo(el, { scale: 0.7, rotate: -15 }, { scale: 1, rotate: 0, duration: 0.5, ease: "elastic.out(1.2, 0.5)" });
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget.querySelector(`#nav-icon-${item.id}`);
                        if (el && !active) gsap.to(el, { scale: 1.2, rotate: 8, duration: 0.3, ease: "back.out(2)" });
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget.querySelector(`#nav-icon-${item.id}`);
                        if (el && !active) gsap.to(el, { scale: 1, rotate: 0, duration: 0.25, ease: "power2.out" });
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl transition-colors duration-150 flex items-center gap-3"
                      style={{
                        backgroundColor: active ? "rgba(255,181,167,0.18)" : "transparent",
                        color: active ? T.salmon : "rgba(255,181,167,0.6)",
                        fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
                        fontWeight: active ? 700 : 500,
                        fontSize: "13px",
                        border: active ? `1px solid rgba(255,181,167,0.3)` : "1px solid transparent",
                      }}
                    >
                      <img
                        id={`nav-icon-${item.id}`}
                        src={item.iconSrc}
                        alt=""
                        style={{
                          width: "22px",
                          height: "22px",
                          objectFit: "contain",
                          flexShrink: 0,
                          filter: active ? "none" : "brightness(0) invert(0.8) sepia(1) hue-rotate(300deg) saturate(0.5)",
                          transition: "filter 0.2s",
                        }}
                      />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              {/* Status */}
              <div className="mt-auto pt-4" style={{ borderTop: "1px solid rgba(255,181,167,0.15)" }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,181,167,0.5)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>
                  สภาวะล่าสุด
                </p>
                <p className="flex items-center gap-2" style={{ color: T.salmon, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", fontSize: "13px", fontWeight: 600 }}>
                  <span>{EMO[mood]?.emoji}</span>
                  {EMO[mood]?.label || "ปกติ"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 min-h-screen" style={{ marginLeft: "230px" }}>
          {/* Graph paper background */}
          <div
            className="fixed pointer-events-none"
            style={{
              left: "230px", top: "36px", right: 0, bottom: 0,
              background: `linear-gradient(${T.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${T.gridLine} 1px, transparent 1px)`,
              backgroundSize: "28px 28px",
              backgroundColor: T.cream,
              zIndex: 0,
            }}
          />

          <div className="relative z-10 px-8 py-7">
            {currentView === "home" && (
              <PageWrapper pageKey="home">
                <HomeView
                  mood={mood}
                  setMood={setMood}
                  onGoChat={() => setCurrentView("chat")}
                  onGoTrend={() => setCurrentView("trend")}
                  tryMode={tryMode}
                  lineNotify={lineNotify}
                  setLineNotify={setLineNotify}
                />
              </PageWrapper>
            )}
            {currentView === "chat" && (
              <PageWrapper pageKey="chat">
                <ChatView
                  messages={messages}
                  inputText={inputText}
                  setInputText={setInputText}
                  sendMessage={() => sendMessage()}
                  isAnalyzing={isAnalyzing}
                  handleSelfie={handleSelfie}
                  handleVoice={handleVoice}
                  handleHomeworkPhoto={handleHomeworkPhoto}
                  resetChat={resetChat}
                  speakText={speakText}
                  mood={mood}
                  concernStreak={concernStreak}
                  transparencyLogs={transparencyLogs}
                  onNotifyCounselor={() => {
                    toast("แจ้งครูที่ปรึกษาเรียบร้อยแล้ว ครูจะติดต่อกลับภายในวันนี้");
                    setShowEscalationModal(false);
                  }}
                />
              </PageWrapper>
            )}
            {currentView === "trend" && (
              <PageWrapper pageKey="trend">
                <TrendView
                  trendData={trendData}
                  logEntries={logEntries}
                  onDeleteEntry={(id) => { setLogEntries((prev) => prev.filter((e) => e.id !== id)); toast("ลบรายการแล้ว"); }}
                  onClearAll={() => {
                    if (window.confirm("ยืนยันลบข้อมูลแนวโน้มอารมณ์ทั้งหมดของคุณ?")) {
                      setTrendData([]); setLogEntries([]); setConcernStreak(0);
                      toast("ลบข้อมูลทั้งหมดเรียบร้อยแล้ว");
                    }
                  }}
                  onExport={() => {
                    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), trendData, logEntries }, null, 2)], { type: "application/json" });
                    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "jaikrajok-my-data.json" });
                    a.click(); URL.revokeObjectURL(a.href);
                    toast("ส่งออกข้อมูลของฉันเรียบร้อยแล้ว");
                  }}
                />
              </PageWrapper>
            )}
            {currentView === "school" && <PageWrapper pageKey="school"><SchoolView /></PageWrapper>}
            {currentView === "safety" && (
              <PageWrapper pageKey="safety">
                <SafetyView
                  age={age}
                  guardianConsent={guardianConsent}
                  onExport={() => {
                    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), trendData, logEntries }, null, 2)], { type: "application/json" });
                    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "jaikrajok-my-data.json" });
                    a.click(); URL.revokeObjectURL(a.href);
                    toast("ส่งออกข้อมูลของฉันเรียบร้อยแล้ว");
                  }}
                  onClearAll={() => {
                    if (window.confirm("ยืนยันลบข้อมูลทั้งหมดของคุณ?")) {
                      setTrendData([]); setLogEntries([]);
                      toast("ลบข้อมูลทั้งหมดเรียบร้อยแล้ว");
                    }
                  }}
                />
              </PageWrapper>
            )}
          </div>
        </div>
      </div>

      {/* ESCALATION MODAL */}
      {showEscalationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl" style={{ border: `2px solid ${T.salmon}` }}>
            <div className="text-4xl mb-3">🤝</div>
            <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
              เราสังเกตว่าช่วงนี้ใจคุณหนักอยู่หลายครั้ง
            </h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
              ไม่เป็นไรนะ ความรู้สึกแบบนี้ไม่ผิดเลย กระจกอยากชวนคุณลองพูดคุยกับคนที่ไว้ใจได้ สายด่วนสุขภาพจิต 1323
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { toast("แจ้งครูที่ปรึกษาเรียบร้อยแล้ว"); setShowEscalationModal(false); }}
                className="w-full py-3 rounded-2xl text-white font-bold transition-all active:scale-[0.97]"
                style={{ backgroundColor: T.teal, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}
              >
                แจ้งครูที่ปรึกษา
              </button>
              <a
                href="tel:1323"
                className="block text-center w-full py-3 rounded-2xl font-bold transition-all"
                style={{ color: T.red, border: `2px solid ${T.red}`, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}
              >
                📞 โทรสายด่วน 1323
              </a>
              <button
                onClick={() => setShowEscalationModal(false)}
                className="w-full py-2.5 rounded-2xl text-gray-500 font-medium text-sm hover:bg-gray-100"
                style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}
              >
                ยังไม่พร้อมตอนนี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ HOME VIEW ============ */
function HomeView({
  mood, setMood, onGoChat, onGoTrend, tryMode, lineNotify, setLineNotify,
}: {
  mood: string;
  setMood: (v: string) => void;
  onGoChat: () => void;
  onGoTrend: () => void;
  tryMode: (mode: "camera" | "keyboard" | "mic" | "photo") => void;
  lineNotify: boolean;
  setLineNotify: (v: boolean) => void;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "อรุณสวัสดิ์ค่ะ" : hour < 18 ? "สวัสดีตอนบ่ายค่ะ" : "สวัสดีตอนเย็นค่ะ";
  const moods = Object.entries(EMO);

  return (
    <div className="space-y-7 max-w-4xl">
      {/* HERO CARD */}
      <div
        className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden"
        style={{
          background: "#fefdfa",
          backgroundImage: "radial-gradient(#e0d6c8 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          borderRadius: "16px",
          border: "2px solid #DED3C1",
          boxShadow: "4px 8px 0px rgba(222,211,193,0.4), 0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center gap-5 z-10">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl flex-shrink-0 -mt-2 -ml-2 shadow-lg z-10 relative"
            style={{ backgroundColor: EMO[mood]?.bg || "#E3EAE0", border: `3px solid ${T.white}` }}
          >
            {EMO[mood]?.emoji || "😌"}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] pointer-events-none"></div>
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
              {greeting}
            </h2>
            <p className="text-sm mt-1" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#666" }}>
              วันนี้อยากให้กระจกฟังอะไรบ้าง จะพิมพ์ พูด ถ่ายเซลฟี่ หรือถ่ายรูปการบ้านก็ได้นะ
            </p>
          </div>
        </div>
        <div className="flex gap-3 flex-shrink-0 z-10">
          <button
            onClick={onGoChat}
            className="px-5 py-2.5 rounded-full text-white font-bold text-sm transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: T.teal, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", boxShadow: "0 4px 12px rgba(45,106,111,0.3)" }}
          >
            💬 เริ่มคุยกับกระจก
          </button>
          <button
            onClick={onGoTrend}
            className="px-4 py-2.5 rounded-full font-semibold text-sm transition-all hover:bg-gray-50 active:scale-95"
            style={{ color: T.black, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", backgroundColor: T.white, border: "2px solid #E2D9C2" }}
          >
            📈 ดูแนวโน้มของฉัน
          </button>
        </div>
      </div>

      {/* QUICK MOOD PICKER */}
      <div>
        <h3 className="text-base font-bold mb-3" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
          วันนี้รู้สึกยังไง?
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {moods.map(([key, emo], idx) => {
            const rotations = ["rotate-[-2deg]", "rotate-[1deg]", "rotate-[-1deg]", "rotate-[2deg]", "rotate-[0deg]", "rotate-[-3deg]"];
            const rot = rotations[idx % rotations.length];
            return (
            <button
              key={key}
              onClick={() => setMood(key)}
              className={`p-4 rounded-xl text-center transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl active:scale-95 ${rot}`}
              style={{
                backgroundColor: mood === key ? "#DCEAE8" : T.white,
                border: mood === key ? `3px solid ${T.teal}` : "1px solid #EDE6D3",
                boxShadow: mood === key ? "0 8px 0px rgba(45,106,111,0.2)" : "0 4px 10px rgba(0,0,0,0.05)",
                fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif",
              }}
            >
              <span className="text-4xl block mb-2 drop-shadow-sm">{emo.emoji}</span>
              <span className="text-[11px] font-bold block uppercase tracking-wide" style={{ color: mood === key ? T.teal : T.black }}>{emo.label}</span>
            </button>
          )})}
        </div>
      </div>

      {/* 4 MODE CARDS */}
      <div>
        <h3 className="text-base font-bold mb-3" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
          วิธีระบายความรู้สึก · เลือกวิธีที่ถนัดได้เลย
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { id: "camera" as const, title: "ถ่ายเซลฟี่", desc: "Face Recognition API", iconSrc: IMG.bulb, bg: "#FDF5E6", border: "#F0E1C8" },
            { id: "keyboard" as const, title: "พิมพ์ความรู้สึก", desc: "Sentiment Analysis API", iconSrc: IMG.handPen, bg: "#F2F5E9", border: "#E0E8D3" },
            { id: "mic" as const, title: "พูดระบาย", desc: "Speech-to-Text API", iconSrc: IMG.amplifier, bg: "#FFF0F4", border: "#F5DBE4" },
            { id: "photo" as const, title: "ถ่ายรูปการบ้าน", desc: "OCR API", iconSrc: IMG.origamiStarsNoBg, bg: "#EBF3F5", border: "#D4E5E8" },
          ].map((item, idx) => {
            const rots = ["rotate-[1deg]", "rotate-[-1deg]", "rotate-[2deg]", "rotate-[-2deg]"];
            const r = rots[idx % rots.length];
            const cardId = `action-card-${item.id}`;
            const imgId = `action-img-${item.id}`;
            return (
            <button
              key={item.id}
              id={cardId}
              onClick={(e) => {
                tryMode(item.id);
                // GSAP burst ripple on click
                const rect = e.currentTarget.getBoundingClientRect();
                const ripple = document.createElement("div");
                ripple.style.cssText = `position:fixed;left:${rect.left + rect.width/2}px;top:${rect.top + rect.height/2}px;width:12px;height:12px;border-radius:50%;background:${item.border};pointer-events:none;z-index:9999;transform:translate(-50%,-50%)`;
                document.body.appendChild(ripple);
                gsap.fromTo(ripple,
                  { scale: 0, opacity: 0.8 },
                  { scale: 9, opacity: 0, duration: 0.7, ease: "expo.out", onComplete: () => ripple.remove() }
                );
                // GSAP pop the image
                const imgEl = document.getElementById(imgId);
                if (imgEl) gsap.fromTo(imgEl, { scale: 0.8, rotate: -10 }, { scale: 1, rotate: 0, duration: 0.6, ease: "elastic.out(1.3, 0.4)" });
              }}
              onMouseEnter={() => {
                const imgEl = document.getElementById(imgId);
                if (imgEl) gsap.to(imgEl, { y: -8, rotate: 5, duration: 0.4, ease: "power2.out" });
                const card = document.getElementById(cardId);
                if (card) gsap.to(card, { y: -6, duration: 0.3, ease: "power2.out" });
              }}
              onMouseLeave={() => {
                const imgEl = document.getElementById(imgId);
                if (imgEl) gsap.to(imgEl, { y: 0, rotate: 0, duration: 0.4, ease: "elastic.out(1, 0.5)" });
                const card = document.getElementById(cardId);
                if (card) gsap.to(card, { y: 0, duration: 0.35, ease: "power2.inOut" });
              }}
              className={`p-6 rounded-none text-center group transition-colors duration-200 ${r}`}
              style={{
                backgroundColor: item.bg,
                border: `1px solid ${item.border}`,
                boxShadow: `4px 4px 0px ${item.border}, 0 10px 20px rgba(0,0,0,0.05)`,
                position: "relative",
                willChange: "transform",
              }}
            >
              {/* Tape visual */}
              <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 w-12 h-6 bg-white/40 border border-white/60 shadow-sm rotate-[-2deg]" style={{backdropFilter: "blur(2px)"}}></div>
              
              <div className="bg-white rounded-sm aspect-square flex items-center justify-center mb-4 shadow-inner overflow-hidden" style={{ border: `1px solid ${item.border}` }}>
                <img
                  id={imgId}
                  src={item.iconSrc}
                  alt=""
                  style={{
                    width: "85%",
                    height: "85%",
                    objectFit: "contain",
                    display: "block",
                    willChange: "transform",
                  }}
                />
              </div>
              <h4 className="font-bold text-sm mb-1" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
                {item.title}
              </h4>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#888" }}>
                {item.desc}
              </p>
            </button>
          )})}
        </div>
      </div>

      {/* CHANNEL ACCESS & NOTIFICATION TOGGLE */}
      {/* CHANNEL ACCESS & NOTIFICATION TOGGLE */}
      <div
        className="p-6 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative mt-4"
        style={{ 
          backgroundColor: "#F9F8F5", 
          border: "2px dashed #C8BEAC",
          backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(200, 190, 172, 0.05) 10px, rgba(200, 190, 172, 0.05) 20px)"
        }}
      >
        {/* Pin visual */}
        <div className="absolute top-3 right-5 w-3 h-3 rounded-full bg-[#A85F73] shadow-[0_2px_4px_rgba(0,0,0,0.3)] z-10">
          <div className="w-1 h-1 bg-white/60 rounded-full absolute top-[1px] left-[1px]"></div>
        </div>

        <div>
          <h4 className="font-bold text-sm mb-1" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
            ช่องทางการเข้าถึง
          </h4>
          <div className="flex gap-3 mt-3 flex-wrap">
            <span className="px-4 py-1.5 text-[#00B900] text-xs font-bold rounded-sm border border-[#00B900] bg-white shadow-sm" style={{transform: "rotate(-1deg)"}}>
              💚 LINE Official Account
            </span>
            <span className="px-4 py-1.5 text-blue-600 text-xs font-bold rounded-sm border border-blue-600 bg-white shadow-sm" style={{transform: "rotate(1deg)"}}>
              🌐 Web Application (หน้านี้)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 px-4 rounded-full border border-[#E2D9C2] shadow-sm z-10">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
            รับการแจ้งเตือนผ่าน LINE
          </span>
          <button
            onClick={() => { setLineNotify(!lineNotify); toast(lineNotify ? "ปิดการแจ้งเตือนผ่าน LINE แล้ว" : "เปิดการแจ้งเตือนผ่าน LINE แล้ว"); }}
            className="w-10 h-5 rounded-full flex items-center transition-colors px-0.5 relative"
            style={{ backgroundColor: lineNotify ? "#00B900" : "#D1D5DB", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)" }}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-all absolute top-0.5`} style={{ left: lineNotify ? "22px" : "2px" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ CHAT VIEW ============ */
function ChatView({
  messages, inputText, setInputText, sendMessage, isAnalyzing,
  handleSelfie, handleVoice, handleHomeworkPhoto, resetChat, speakText,
  mood, concernStreak, transparencyLogs, onNotifyCounselor,
}: {
  messages: ChatMsg[];
  inputText: string;
  setInputText: (v: string) => void;
  sendMessage: () => void;
  isAnalyzing: boolean;
  handleSelfie: () => void;
  handleVoice: () => void;
  handleHomeworkPhoto: () => void;
  resetChat: () => void;
  speakText: (t: string) => void;
  mood: string;
  concernStreak: number;
  transparencyLogs: string[];
  onNotifyCounselor: () => void;
}) {
  const chatBodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [messages, isAnalyzing]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: "calc(100vh - 100px)" }}>
      {/* LEFT CHAT PANEL */}
      <div
        className="lg:col-span-2 flex flex-col overflow-hidden"
        style={{ backgroundColor: T.white, borderRadius: "20px", border: "1.5px solid #E2D9C2", boxShadow: "0 2px 18px rgba(26,26,26,0.07)" }}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1.5px solid #EDE6D3" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
              style={{ backgroundColor: EMO[mood]?.bg || "#E3EAE0", border: `2px solid ${T.teal}` }}
            >
              {EMO[mood]?.emoji || "😌"}
            </div>
            <div>
              <p className="font-bold text-sm" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
                กระจกสะท้อนใจ
              </p>
              <p className="text-xs flex items-center gap-1 font-semibold" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.teal }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: T.teal }} />
                สภาวะล่าสุด: {EMO[mood]?.label || "ปกติ"}
              </p>
            </div>
          </div>
          <button
            onClick={resetChat}
            className="p-2 rounded-xl hover:bg-gray-100 transition-all text-gray-500"
            title="เริ่มการสนทนาใหม่"
          >
            🔄
          </button>
        </div>

        {/* Messages */}
        <div ref={chatBodyRef} className="flex-1 overflow-y-auto p-5 space-y-4" style={{ scrollbarWidth: "thin" }}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "system" ? (
                <div className="w-full px-4 py-2 rounded-2xl text-xs font-mono text-center" style={{ backgroundColor: "#F3E6C8", color: "#6E4F1F" }}>
                  💡 {msg.text}
                </div>
              ) : msg.cardType === "emotion" && msg.emotionData ? (
                <div
                  className="max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed"
                  style={{ backgroundColor: msg.emotionData.bg, border: `1.5px solid ${msg.emotionData.color}`, color: msg.emotionData.text, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}
                >
                  <p className="font-bold text-xs uppercase tracking-wider mb-1 opacity-75" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    ผลการสะท้อนจากใบหน้า · {msg.emotionData.label}
                  </p>
                  <p>{msg.emotionData.note}</p>
                </div>
              ) : msg.cardType === "ocr" ? (
                <div className="max-w-[85%] p-4 rounded-2xl text-sm" style={{ backgroundColor: T.cream, border: "1.5px dashed #aaa" }}>
                  <p className="font-bold text-xs text-gray-500 mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>📷 ผลจาก OCR API</p>
                  <p className="text-xs text-gray-500 italic border-l-2 pl-3 py-1 my-1" style={{ borderColor: T.teal }}>{msg.ocrText}</p>
                </div>
              ) : (
                <div
                  className="max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm"
                  style={{
                    backgroundColor: msg.role === "user" ? T.teal : T.white,
                    color: msg.role === "user" ? T.white : T.black,
                    border: msg.role === "user" ? "none" : "1.5px solid #EDE6D3",
                    borderBottomRightRadius: msg.role === "user" ? "6px" : "20px",
                    borderBottomLeftRadius: msg.role === "bot" ? "6px" : "20px",
                    fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif",
                  }}
                >
                  {msg.text}
                  {msg.role === "bot" && (
                    <button onClick={() => speakText(msg.text)} className="ml-2 text-xs opacity-50 hover:opacity-100 transition-opacity">🔊</button>
                  )}
                </div>
              )}
            </div>
          ))}
          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="px-5 py-3 rounded-2xl" style={{ backgroundColor: T.white, border: `2px solid ${T.teal}` }}>
                <div className="flex gap-1.5">
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="w-2.5 h-2.5 rounded-full " style={{ backgroundColor: T.teal, animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input toolbar */}
        <div className="p-4 space-y-3" style={{ borderTop: `2px solid ${T.teal}`, backgroundColor: T.white }}>
          <div className="flex items-center gap-2">
            {[
              { handler: handleSelfie, icon: "📷", title: "ถ่ายเซลฟี่" },
              { handler: handleVoice, icon: "🎤", title: "พูดระบาย" },
              { handler: handleHomeworkPhoto, icon: "🖼️", title: "แนบรูปการบ้าน" },
            ].map(({ handler, icon, title }) => (
              <button
                key={title}
                onClick={handler}
                title={title}
                className="p-2.5 rounded-full text-sm font-bold transition-all hover:text-white"
                style={{ border: `2px solid ${T.teal}`, backgroundColor: "#E3EAE0", color: T.teal }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = T.teal; e.currentTarget.style.color = T.white; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#E3EAE0"; e.currentTarget.style.color = T.teal; }}
              >
                {icon}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="พิมพ์ความรู้สึกของคุณ..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 px-5 py-3 rounded-full outline-none text-sm"
              style={{ backgroundColor: T.cream, border: "1.5px solid transparent", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}
              onFocus={(e) => (e.target.style.borderColor = T.teal)}
              onBlur={(e) => (e.target.style.borderColor = "transparent")}
            />
            <button
              onClick={sendMessage}
              className="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center transition-all active:scale-[0.95]"
              style={{ backgroundColor: T.teal }}
            >
              ⬆️
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 100px)", scrollbarWidth: "thin" }}>
        {/* Modes info */}
        <div className="p-5 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
          <h4 className="font-bold text-sm mb-2" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>โหมดที่ใช้ได้</h4>
          <p className="text-xs leading-relaxed" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#666" }}>
            Face Recognition · Sentiment Analysis · Speech-to-Text · OCR ถูกส่งต่อให้ Pathumma LLM สังเคราะห์คำแนะนำเฉพาะบุคคล
          </p>
        </div>

        {/* Concern card */}
        <div className="p-5 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
          <h4 className="font-bold text-sm mb-2" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>สถานะการดูแล</h4>
          {concernStreak >= 2 ? (
            <div className="p-3.5 rounded-xl space-y-2" style={{ backgroundColor: "#F1DEE3", border: "1.5px solid #A85F73" }}>
              <p className="font-bold text-xs" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#6B3B49" }}>⚠️ สังเกตแนวโน้มเชิงลบต่อเนื่อง</p>
              <p className="text-xs" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#6B3B49" }}>อยากชวนคุยกับครูที่ปรึกษาหรือสายด่วน 1323 ไหม</p>
              <div className="flex gap-2 pt-1">
                <button onClick={onNotifyCounselor} className="px-3 py-1.5 rounded-xl text-white text-xs font-bold" style={{ backgroundColor: T.teal, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
                  แจ้งครูที่ปรึกษา
                </button>
                <a href="tel:1323" className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ border: "1.5px solid #A85F73", color: "#6B3B49", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
                  โทร 1323
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs leading-relaxed" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#666" }}>
              ยังไม่พบสัญญาณที่น่าเป็นห่วง ระบบจะแจ้งเตือนอัตโนมัติหากพบแนวโน้มต่อเนื่อง
            </p>
          )}
        </div>

        {/* Transparency logs */}
        <div className="p-5 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
          <h4 className="font-bold text-sm mb-3" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>บันทึกความโปร่งใส</h4>
          {transparencyLogs.length === 0 ? (
            <p className="text-xs text-gray-400" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>ยังไม่มีการเรียกใช้ API</p>
          ) : (
            <div className="space-y-2">
              {transparencyLogs.map((log, i) => (
                <div key={i} className="text-xs font-mono text-gray-600 p-2 rounded-xl flex items-center gap-2" style={{ backgroundColor: "#f5f5f5", border: "1px solid #e5e5e5" }}>
                  <span>👁️</span><span>{log}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ TREND VIEW ============ */
function TrendView({ trendData, logEntries, onDeleteEntry, onClearAll, onExport }: {
  trendData: TrendPoint[];
  logEntries: LogEntry[];
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
  onExport: () => void;
}) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SVG trend chart */}
        <div className="p-6 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>แนวโน้มอารมณ์ในเซสชันนี้</h3>
            <span className="text-xs font-mono text-gray-500">{trendData.length === 0 ? "ยังไม่มีข้อมูล" : `${trendData.length} จุดข้อมูล`}</span>
          </div>
          <div className="relative h-44 w-full my-2">
            <svg viewBox="0 0 500 160" className="w-full h-full overflow-visible">
              <line x1="0" y1="140" x2="500" y2="140" stroke="#EDE6D3" strokeWidth="1" />
              <text x="0" y="18" fontFamily="'IBM Plex Mono', monospace" fontSize="10" fill="#888">ผ่อนคลาย</text>
              <text x="0" y="150" fontFamily="'IBM Plex Mono', monospace" fontSize="10" fill="#888">ตึงเครียด</text>
              {trendData.length > 0 && (
                <>
                  <polyline fill="none" stroke="#6F6389" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    points={trendData.map((d, idx) => {
                      const stepX = trendData.length > 1 ? 460 / (trendData.length - 1) : 0;
                      return `${30 + idx * stepX},${140 - d.valence * 110}`;
                    }).join(" ")}
                  />
                  {trendData.map((d, idx) => {
                    const stepX = trendData.length > 1 ? 460 / (trendData.length - 1) : 0;
                    return <circle key={d.id} cx={30 + idx * stepX} cy={140 - d.valence * 110} r="5.5" fill={d.color} stroke="#fff" strokeWidth="1.5" />;
                  })}
                </>
              )}
            </svg>
          </div>
          <div className="flex gap-4 pt-3 text-xs font-semibold text-gray-600" style={{ borderTop: "1px solid #EDE6D3" }}>
            {[["#2F5D62", "ผ่อนคลาย / ดี"], ["#6F6389", "ปกติ / เหนื่อยล้า"], ["#A85F73", "เครียด / กังวล"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} /> {l}
              </span>
            ))}
          </div>
        </div>

        {/* Check-in history */}
        <div className="p-6 rounded-2xl flex flex-col" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
          <h3 className="font-bold text-base mb-3" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>ประวัติการเช็คอิน</h3>
          <div className="flex-1 overflow-y-auto max-h-48 space-y-2 pr-1" style={{ scrollbarWidth: "thin" }}>
            {logEntries.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-8" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>ยังไม่มีประวัติการเช็คอินในเซสชันนี้</div>
            ) : (
              logEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-xl text-xs" style={{ backgroundColor: T.cream, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
                  <span className="font-semibold text-gray-800">{e.label} · {e.source}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-400">{e.time}</span>
                    <button onClick={() => onDeleteEntry(e.id)} className="text-gray-400 hover:text-red-500">🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 pt-4 mt-auto" style={{ borderTop: "1px solid #EDE6D3" }}>
            <button onClick={onExport} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all" style={{ border: `2px solid ${T.teal}`, color: T.teal, backgroundColor: "#E3EAE0", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
              📥 ส่งออกข้อมูลของฉัน
            </button>
            <button onClick={onClearAll} className="px-4 py-2.5 rounded-xl text-white text-xs font-bold transition-all" style={{ backgroundColor: "#A85F73", border: "2px solid #A85F73", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
              🗑️ ลบข้อมูลทั้งหมด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ SCHOOL VIEW ============ */
function SchoolView() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="inline-block px-4 py-1.5 rounded-full text-xs font-mono font-bold" style={{ backgroundColor: "#F3E6C8", color: "#6E4F1F" }}>
        🧪 ข้อมูลตัวอย่างเพื่อสาธิต (Demo aggregate data)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { num: "312", label: "การเช็คอินสัปดาห์นี้" },
          { num: "24%", label: "มีแนวโน้มเครียด/กังวลต่อเนื่อง" },
          { num: "58%", label: "อยู่ในเกณฑ์ปกติ-ผ่อนคลาย" },
          { num: "9", label: "กรณีที่ส่งต่อครูที่ปรึกษา" },
        ].map((stat, i) => (
          <div key={i} className="p-5 rounded-2xl" style={{ backgroundColor: T.white, border: `2px solid ${T.teal}`, boxShadow: "0 2px 12px rgba(26,26,26,0.07)" }}>
            <span className="text-3xl font-black block" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.teal }}>{stat.num}</span>
            <span className="text-xs text-gray-700 mt-1 block font-semibold" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>{stat.label}</span>
          </div>
        ))}
      </div>
      <div className="p-6 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
        <h4 className="font-bold text-base mb-4" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>แนวโน้มรายสัปดาห์ (ระดับความเครียดเฉลี่ย)</h4>
        <div className="flex items-end gap-6 h-40 pt-4">
          {[["52%", "สัปดาห์ 1", T.teal], ["61%", "สัปดาห์ 2", T.teal], ["74%", "สัปดาห์ 3", "#A85F73"], ["66%", "สัปดาห์ 4", "#6F6389"], ["48%", "สัปดาห์นี้", T.teal]].map(([h, l, c], i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full rounded-t-xl" style={{ height: h, backgroundColor: c }} />
              <span className="text-xs font-mono text-gray-500">{l}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "บริการฟรี", desc: "นักเรียนใช้งานรายบุคคลผ่าน LINE Official Account ได้ฟรีเสมอ" },
          { title: "แพ็กเกจโรงเรียน", desc: "ค่าบริการรายเดือนสำหรับภาพรวมสถิติระดับสถาบัน ไม่ระบุตัวตนนักเรียน" },
          { title: "บริการวิเคราะห์ข้อมูล", desc: "สำหรับหน่วยงานด้านการศึกษาที่ต้องการข้อมูลเชิงลึกระดับภาพรวม" },
        ].map((plan, i) => (
          <div key={i} className="p-5 rounded-2xl" style={{ backgroundColor: T.white, border: `2px solid ${T.teal}`, boxShadow: "0 2px 12px rgba(26,26,26,0.07)" }}>
            <h5 className="font-bold text-sm mb-2" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.teal }}>{plan.title}</h5>
            <p className="text-xs text-gray-700 leading-relaxed font-medium" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>{plan.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ SAFETY & PRIVACY VIEW ============ */
function SafetyView({ age, guardianConsent, onExport, onClearAll }: {
  age: string; guardianConsent: boolean; onExport: () => void; onClearAll: () => void;
}) {
  const [subTab, setSubTab] = useState<"privacy" | "ethics" | "arch" | "limits">("privacy");

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {[
          { id: "privacy" as const, label: "ข้อมูลของฉัน" },
          { id: "ethics" as const, label: "การใช้ AI อย่างรับผิดชอบ" },
          { id: "arch" as const, label: "สถาปัตยกรรมระบบ" },
          { id: "limits" as const, label: "ข้อจำกัดที่ควรทราบ" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className="px-5 py-2.5 rounded-full text-xs font-bold transition-all active:scale-[0.97] whitespace-nowrap"
            style={{
              backgroundColor: subTab === t.id ? T.teal : T.white,
              color: subTab === t.id ? T.white : T.black,
              border: subTab === t.id ? `2px solid ${T.teal}` : "2px solid #EDE6D3",
              fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "privacy" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "อายุที่ยืนยัน", value: age ? `${age} ปี` : "16 ปี" },
              { label: "ความยินยอมผู้ปกครอง", value: guardianConsent ? "ได้รับความยินยอมแล้ว" : "รอดำเนินการ" },
              { label: "เงื่อนไขการใช้งาน", value: "ยอมรับแล้ว" },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: "#E3EAE0", color: "#3C5137" }}>
                <h5 className="font-bold text-xs mb-1" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>{item.label}</h5>
                <p className="text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="p-6 rounded-2xl space-y-4" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2" }}>
            <h4 className="font-bold text-base" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>การควบคุมข้อมูลของฉัน</h4>
            <p className="text-xs text-gray-600" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>คุณสามารถเข้าถึง ส่งออก หรือลบข้อมูลของตนเองได้ทุกเมื่อ</p>
            <div className="flex gap-3">
              <button onClick={onExport} className="px-5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-xs font-bold" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
                📥 ส่งออกข้อมูลของฉัน
              </button>
              <button onClick={onClearAll} className="px-5 py-2.5 rounded-xl text-xs font-bold" style={{ border: "1.5px solid #A85F73", color: "#A85F73", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
                🗑️ ลบข้อมูลทั้งหมด
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { title: "พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)", content: "ระบบปฏิบัติตาม PDPA อย่างเคร่งครัด ภาพใบหน้าประมวลผลแบบเรียลไทม์และไม่ถูกจัดเก็บลงเซิร์ฟเวอร์ ข้อมูลแนวโน้มอารมณ์จัดเก็บแบบไม่ระบุตัวตนโดยใช้รหัสแทนชื่อ และเข้ารหัสตามมาตรฐาน AES-256" },
              { title: "นโยบายความเป็นส่วนตัว (สรุป)", content: "ข้อมูลที่เก็บมีเพียงแนวโน้มอารมณ์แบบไม่ระบุตัวตนเพื่อแสดงพัฒนาการของผู้ใช้เท่านั้น ไม่มีการขายหรือแบ่งปันข้อมูลส่วนบุคคลให้บุคคลที่สาม" },
              { title: "ข้อกำหนดการใช้งาน (สรุป)", content: "ผู้ใช้อายุต่ำกว่า 13 ปีต้องได้รับความยินยอมจากผู้ปกครองก่อนใช้งาน ผู้ใช้อายุต่ำกว่า 20 ปีต้องได้รับความยินยอมจากผู้ปกครองก่อนเก็บข้อมูล ระบบมีการจำกัดอัตราการใช้งาน" },
            ].map((acc, i) => (
              <details key={i} className="p-4 rounded-2xl group" style={{ backgroundColor: T.white, border: "1.5px solid #EDE6D3" }}>
                <summary className="font-bold text-sm cursor-pointer list-none flex justify-between items-center" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
                  <span>{acc.title}</span>
                  <span className="text-gray-400 font-mono text-base group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="text-xs text-gray-600 mt-3 pt-3 leading-relaxed" style={{ borderTop: "1px solid #f0f0f0", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>{acc.content}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {subTab === "ethics" && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl space-y-3" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2" }}>
            {["👁️ ระบบแสดงข้อความแจ้งเตือนทุกครั้งที่กำลังวิเคราะห์ข้อมูล (Transparent AI)", "🩺 AI ไม่มีหน้าที่วินิจฉัยโรคซึมเศร้าหรือโรคทางจิตเวชไม่ว่ากรณีใดๆ", "👥 มี Human-in-the-loop — กรณีฉุกเฉินจะแจ้งเตือนไปยังผู้ดูแลระบบที่เป็นมนุษย์แบบไม่ระบุตัวตน", "💖 ผลลัพธ์จากการวิเคราะห์เป็นข้อเสนอแนะเชิงบวก ไม่ใช่การตัดสิน ตีตรา หรือประเมินค่า", "🛡️ มี Rate Limiting และระบบตรวจจับกรองเนื้อหาที่ไม่เหมาะสม เพื่อป้องกันการใช้งานในทางที่ผิด"].map((text, i) => (
              <div key={i} className="p-3.5 rounded-xl text-xs font-semibold text-gray-800" style={{ backgroundColor: T.cream, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>{text}</div>
            ))}
          </div>
          <div className="p-6 rounded-2xl flex items-center justify-between gap-4" style={{ backgroundColor: T.black }}>
            <div>
              <h4 className="font-bold text-lg mb-1" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.salmon }}>📞 สายด่วนสุขภาพจิต 1323</h4>
              <p className="text-xs text-gray-300" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>หากพบสัญญาณน่าเป็นห่วงต่อเนื่อง กระจกจะแนะนำให้ปรึกษาครูที่ปรึกษา ผู้ปกครอง หรือสายด่วนนี้</p>
            </div>
            <a href="tel:1323" className="px-6 py-3 rounded-full text-white font-bold text-sm shrink-0 transition-all" style={{ backgroundColor: T.red, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
              โทร 1323
            </a>
          </div>
        </div>
      )}

      {subTab === "arch" && (
        <div className="space-y-3">
          {[
            { layer: "ชั้น 1", title: "User Interface", desc: "LINE Official Account และ Web Application — พิมพ์ ถ่ายเซลฟี่ พูด หรือถ่ายรูปการบ้าน" },
            { layer: "ชั้น 2", title: "API Gateway", desc: "ตรวจสอบสิทธิ์ กระจายคำขอไปยังบริการที่ถูกต้อง บันทึก Log แบบไม่ระบุตัวตน" },
            { layer: "ชั้น 3", title: "AI Services · AI for Thai", desc: "Face Recognition · Sentiment Analysis · Speech-to-Text · OCR · Pathumma LLM (โมเดลหลัก)" },
            { layer: "ชั้น 4", title: "Data Storage", desc: "เก็บประวัติแนวโน้มอารมณ์แบบไม่ระบุตัวตน เข้ารหัส AES-256 ปฏิบัติตาม PDPA" },
          ].map((item, i) => (
            <div key={i} className="p-5 rounded-2xl flex items-center gap-4" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2" }}>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold text-white shrink-0" style={{ backgroundColor: T.teal }}>{item.layer}</span>
              <div>
                <h5 className="font-bold text-sm text-gray-900" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>{item.title}</h5>
                <p className="text-xs text-gray-600 mt-0.5" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === "limits" && (
        <div className="p-6 rounded-2xl space-y-3" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2" }}>
          {["⚠️ การวิเคราะห์อารมณ์จากใบหน้าอาจคลาดเคลื่อนในสภาพแสงน้อย หรือเมื่อใส่หน้ากากอนามัย", "⚠️ การวิเคราะห์ความรู้สึกจากข้อความอาจไม่ครอบคลุมภาษาเฉพาะกลุ่มหรือภาษาถิ่นบางรูปแบบ", "⚠️ ระบบนี้เป็นเครื่องมือเสริม ไม่สามารถแทนที่การปรึกษาจิตแพทย์หรือนักจิตวิทยา", "⚠️ อาจยังไม่สามารถตรวจจับอารมณ์เชิงซ้อนที่เกิดจากหลายสาเหตุพร้อมกันได้อย่างแม่นยำ", "⚠️ ประสิทธิภาพขึ้นอยู่กับคุณภาพการเชื่อมต่ออินเทอร์เน็ต เนื่องจากเรียกใช้ API แบบเรียลไทม์"].map((text, i) => (
            <div key={i} className="p-3.5 rounded-xl text-xs font-semibold" style={{ backgroundColor: "#F3E6C8", color: "#6E4F1F", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>{text}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ MAIN APP ============ */
// Page transition wipe effect wrapper
const PageWrapper = ({ children, pageKey }: { children: React.ReactNode, pageKey: string }) => {
  const elRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (elRef.current) {
      gsap.fromTo(elRef.current,
        { clipPath: "inset(0 100% 0 0)" },
        { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "power3.inOut" }
      );
    }
  }, [pageKey]);
  return <div ref={elRef} className="h-full w-full">{children}</div>;
};

export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [age, setAge] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianApproved, setGuardianApproved] = useState(false);

  // Global click ripple effect
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Don't ripple if clicking inside a modal or explicitly prevented
      if ((e.target as HTMLElement).closest(".no-ripple")) return;
      
      const colors = ["#2D6A6F", "#1A1A1A", "#FFB5A7", "#A85F73", "#6C8C64"];
      const col = colors[Math.floor(Math.random() * colors.length)];
      const maxR = 40 + Math.random() * 60;
      
      const drop = document.createElement("div");
      drop.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:12px;height:12px;border-radius:50%;background:${col};pointer-events:none;z-index:9999;transform:translate(-50%,-50%)`;
      document.body.appendChild(drop);
      
      gsap.fromTo(drop,
        { scale: 0, opacity: 0.35 },
        { scale: maxR/6, opacity: 0, duration: 1.2, ease: "expo.out", onComplete: () => drop.remove() }
      );
      
      // Some micro droplets
      for(let i=0; i<3; i++) {
        const micro = document.createElement("div");
        const angle = Math.random() * Math.PI * 2;
        const dist = maxR * (0.3 + Math.random() * 0.5);
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist;
        micro.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:3px;height:3px;border-radius:50%;background:${col};pointer-events:none;z-index:9999;transform:translate(-50%,-50%)`;
        document.body.appendChild(micro);
        gsap.to(micro, {
          x: tx, y: ty, scale: 0, opacity: 0, duration: 0.6 + Math.random()*0.4, ease: "power2.out",
          onComplete: () => micro.remove()
        });
      }
    };
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  return (
    <div className="font-sans">
      <Toaster richColors position="top-center" />
      {page === "login" && <PageWrapper pageKey="login"><LoginPage onNext={() => setPage("onb1")} /></PageWrapper>}
      {page === "onb1" && <PageWrapper pageKey="onb1"><OnbWelcome onNext={() => setPage("onb2")} /></PageWrapper>}
      {page === "onb2" && (
        <PageWrapper pageKey="onb2">
          <OnbAge
            age={age}
            setAge={setAge}
            onNext={() => {
              const ageNum = parseInt(age);
              setPage(ageNum < 13 ? "guardian" : "privacy");
            }}
          />
        </PageWrapper>
      )}
      {page === "guardian" && (
        <PageWrapper pageKey="guardian">
          <GuardianPage
            approved={guardianApproved}
            onSend={() => {
              if (!guardianEmail || !guardianEmail.includes("@")) { toast("กรุณากรอกอีเมลที่ถูกต้อง"); return; }
              setTimeout(() => setGuardianApproved(true), 1200);
            }}
            onNext={() => setPage("privacy")}
            guardianEmail={guardianEmail}
            setGuardianEmail={setGuardianEmail}
          />
        </PageWrapper>
      )}
      {page === "privacy" && <PageWrapper pageKey="privacy"><PrivacyPage onNext={() => setPage("app")} /></PageWrapper>}
      {page === "app" && <PageWrapper pageKey="app"><AppShell /></PageWrapper>}
    </div>
  );
}
