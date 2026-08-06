import { useState, useRef, useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { gsap } from "gsap";
import {
  hasApiKey,
  chat,
  analyzeSelfie,
  analyzeHomework,
  analyzeAudio,
  classifyMoodFromText,
} from "./pathummaApi";
import MathText from "./MathText";

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
  cream: "#F5F0E8",
  black: "#08090A",
  salmon: "#FF3366",
  teal: "#FF3366",
  red: "#C41E3A",
  white: "#F0EFE9",
  gridLine: "rgba(26,20,10,0.08)",
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
  stressed: "กระจกสังเกตสีหน้าดูเกร็งบริเวณคิ้วและรอบดวงตา อาจมีสัญญาณของความเครียดสะสม",
  tired: "กระจกสังเกตสีหน้าดูเหนื่อยล้า อาจกำลังพักผ่อนไม่เพียงพอ",
  neutral: "สีหน้าอยู่ในเกณฑ์ปกติ ไม่พบสัญญาณผิดปกติชัดเจน",
  calm: "สีหน้าดูผ่อนคลาย แววตาสดใส",
};

type Page = "login" | "onb1" | "onb2" | "guardian" | "privacy" | "app";
type AppView = "home" | "chat" | "trend" | "safety";

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
          [32, 8], [40, 8], [48, 8],
          [24, 16], [32, 16], [40, 16], [48, 16], [56, 16],
          [16, 24], [24, 24], [32, 24], [40, 24], [48, 24], [56, 24], [64, 24],
          [8, 32], [16, 32], [24, 32], [32, 32], [40, 32], [48, 32], [56, 32], [64, 32], [72, 32],
          [8, 40], [16, 40], [24, 40], [32, 40], [40, 40], [48, 40], [56, 40], [64, 40], [72, 40],
          [16, 48], [24, 48], [32, 48], [40, 48], [48, 48], [56, 48], [64, 48],
          [24, 56], [32, 56], [40, 56], [48, 56], [56, 56],
          [32, 64], [40, 64], [48, 64],
          [40, 72],
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
    // Title screen entrance
    gsap.fromTo(".login-img", { x: -30 }, { x: 0, duration: 1.0, ease: "power3.out" });
    gsap.fromTo(".login-form", { y: 20 }, { y: 0, duration: 0.8, ease: "back.out(1.2)", delay: 0.2 });
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: T.black }}>
      <CheckerStrip className="fixed top-0 left-0 right-0 z-50" />

      {/* LEFT: collage only (no grid) */}
      <div
        className="absolute left-0 top-0 bottom-0 z-0 login-img"
        style={{
          width: "55%",
          backgroundColor: "#E5E0D8", // Light background for collage visibility
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
  // Keep a ref that always reflects the latest messages — used to read history
  // synchronously inside async sendMessage without relying on stale closure.
  const messagesRef = useRef<ChatMsg[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [trendData, setTrendData] = useState<TrendPoint[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("jaikrajok:trend") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [logEntries, setLogEntries] = useState<LogEntry[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("jaikrajok:logs") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [concernStreak, setConcernStreak] = useState(0);
  const [modesUsed, setModesUsed] = useState<Set<string>>(new Set());
  const [transparencyLogs, setTransparencyLogs] = useState<string[]>([]);
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const escalationShownRef = useRef(false);
  const [showSupportStrip, setShowSupportStrip] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const escalationRef = useRef<HTMLDivElement>(null);
  // Pathumma API — file input refs
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const homeworkInputRef = useRef<HTMLInputElement>(null);
  // Mic recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("jaikrajok:trend", JSON.stringify(trendData)); } catch { /* storage full or blocked */ }
  }, [trendData]);

  useEffect(() => {
    try { localStorage.setItem("jaikrajok:logs", JSON.stringify(logEntries)); } catch { /* storage full or blocked */ }
  }, [logEntries]);

  useEffect(() => {
    if (concernStreak >= 3 && !escalationShownRef.current) {
      escalationShownRef.current = true;
      const t = setTimeout(() => setShowEscalationModal(true), 1200);
      return () => clearTimeout(t);
    }
  }, [concernStreak]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const closeDrawer = useCallback(() => {
    setSidebarOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!sidebarOpen || isDesktop) return;
    const firstNav = drawerRef.current?.querySelector("nav button");
    if (firstNav instanceof HTMLElement) firstNav.focus();
  }, [sidebarOpen, isDesktop]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, closeDrawer]);

  useEffect(() => {
    if (showEscalationModal) {
      escalationRef.current?.focus();
    } else {
      document.getElementById("chat-input")?.focus();
    }
  }, [showEscalationModal]);

  useEffect(() => {
    if (!showEscalationModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setShowEscalationModal(false); return; }
      if (e.key !== "Tab") return;
      const el = escalationRef.current;
      if (!el) return;
      const focusables = Array.from(el.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEscalationModal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    setConcernStreak((prevStreak) => (info.concern ? prevStreak + 1 : 0));
    if (info.concern) setShowSupportStrip(true);
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

  const sendMessage = useCallback(async (overrideText?: string, sourceLabel: string = "ข้อความ") => {
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    if (!textToSend.trim()) return;
    if (overrideText === undefined) setInputText("");

    // Read history from ref — always up-to-date, no closure timing issues
    const currentHistory = messagesRef.current
      .filter((m) => m.role === "user" || m.role === "bot")
      .slice(-8)  // keep last 8 for context
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, { id: Math.random().toString(), role: "user", text: textToSend, timestamp: Date.now(), sourceTag: sourceLabel !== "ข้อความ" ? sourceLabel : undefined }]);
    noteMultimodal(sourceLabel);
    setIsAnalyzing(true);

    if (hasApiKey()) {
      // ── Real Pathumma Text LLM ──
      try {
        const { emotionKey, reply, searchUsed } = await chat(textToSend, currentHistory);
        if (searchUsed) {
          toast.info("🌐 ค้นหาข้อมูลล่าสุดจากเว็บสำเร็จ (Tavily Search)");
        }
        setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: reply, timestamp: Date.now() }]);
        pushTrend(emotionKey, sourceLabel);
      } catch (err) {
        console.error("Pathumma Text LLM error:", err);
        toast("ไม่สามารถเชื่อมต่อ Pathumma LLM ได้ ใช้การตอบสนองในเครื่องแทน");
        // Fallback to local mock
        const key = detectEmotion(textToSend);
        const list = RESPONSES[key] || RESPONSES.neutral;
        setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: list[Math.floor(Math.random() * list.length)], timestamp: Date.now() }]);
        pushTrend(key, sourceLabel);
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      // ── Local mock (no API key) ──
      setTimeout(() => {
        const key = detectEmotion(textToSend);
        const list = RESPONSES[key] || RESPONSES.neutral;
        setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: list[Math.floor(Math.random() * list.length)], timestamp: Date.now() }]);
        setIsAnalyzing(false);
        pushTrend(key, sourceLabel);
      }, 1000);
    }
  }, [inputText, noteMultimodal, pushTrend]);

  const handleSelfie = () => {
    if (hasApiKey()) {
      // Open native camera/file picker
      selfieInputRef.current?.click();
    } else {
      // Mock fallback
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
    }
  };

  const handleSelfieFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setMessages((prev) => [...prev, { id: Math.random().toString(), role: "user", text: `📷 ถ่ายเซลฟี่: ${file.name}`, timestamp: Date.now(), sourceTag: "เซลฟี่" }]);
    noteMultimodal("เซลฟี่");
    setIsAnalyzing(true);
    try {
      const { answer, llmReply, emotionKey: returnedKey } = await analyzeSelfie(file);
      // Classify emotion from returned key or robust fallback
      const emotionKey = returnedKey || classifyMoodFromText(answer) || "positive";
      const info = EMO[emotionKey] || EMO.positive;
      setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: answer, timestamp: Date.now(), cardType: "emotion", emotionData: { label: info.label, note: answer, color: info.color, bg: info.bg, text: info.text } }]);
      setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: llmReply, timestamp: Date.now() }]);
      pushTrend(emotionKey, "เซลฟี่");
    } catch (err) {
      console.error("Vision LLM selfie error:", err);
      toast("วิเคราะห์รูปไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleVoice = async () => {
    if (!hasApiKey()) {
      // Mock fallback
      const samples = ["วันนี้เหนื่อยมากเลย อ่านหนังสือทั้งวัน", "พรุ่งนี้สอบแล้วรู้สึกกังวลนิดหน่อย", "วันนี้โอเคดี สบายใจ", "เครียดมาก ทำโจทย์ไม่ได้เลย"];
      await sendMessage(`🎤 (เสียงพูด): "${samples[Math.floor(Math.random() * samples.length)]}"`, "เสียงพูด");
      return;
    }

    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported MIME type — prefer wav/ogg for AudioQA compatibility
      const preferredTypes = [
        "audio/wav",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/webm;codecs=opus",
        "audio/webm",
      ];
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        // Use the recorder's actual MIME type for the blob
        const blobType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });

        const userMsgId = Math.random().toString();
        setMessages((prev) => [...prev, {
          id: userMsgId,
          role: "user",
          text: "🎤 บันทึกเสียงเรียบร้อยแล้ว กำลังวิเคราะห์เสียง...",
          timestamp: Date.now(),
          sourceTag: "เสียงพูด"
        }]);
        noteMultimodal("เสียงพูด");
        setIsAnalyzing(true);
        try {
          const { transcription, emotionKey, llmReply } = await analyzeAudio(audioBlob);
          // Update the user message to show what was transcribed
          const displayText = transcription
            ? `🎤 (เสียงพูด): "${transcription}"`
            : "🎤 บันทึกเสียงแล้ว";
          setMessages((prev) => prev.map((m) =>
            m.id === userMsgId ? { ...m, text: displayText } : m
          ));
          setMessages((prev) => [...prev, {
            id: Math.random().toString(),
            role: "bot",
            text: llmReply,
            timestamp: Date.now()
          }]);
          pushTrend(emotionKey, "เสียงพูด");
        } catch (err) {
          console.error("Audio LLM error:", err);
          setMessages((prev) => prev.map((m) =>
            m.id === userMsgId ? { ...m, text: "🎤 บันทึกเสียงแล้ว (วิเคราะห์ไม่สำเร็จ)" } : m
          ));
          setMessages((prev) => [...prev, {
            id: Math.random().toString(),
            role: "bot",
            text: "ขอโทษนะคะ กระจกวิเคราะห์เสียงไม่สำเร็จ ลองพูดอีกครั้งหรือพิมพ์ข้อความแทนได้ค่ะ",
            timestamp: Date.now()
          }]);
          pushTrend("neutral", "เสียงพูด");
        } finally {
          setIsAnalyzing(false);
        }
      };

      recorder.start(100); // timeslice for faster data chunks
      setIsRecording(true);
      toast("🎙️ กำลังบันทึกเสียง... กดอีกครั้งเพื่อหยุด");
      // Auto-stop after 30 seconds
      setTimeout(() => { if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop(); }, 30000);
    } catch (err) {
      console.error("Mic access error:", err);
      toast("ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตการเข้าถึง");
    }
  };

  const handleHomeworkPhoto = () => {
    if (hasApiKey()) {
      homeworkInputRef.current?.click();
    } else {
      // Mock fallback
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
    }
  };

  const handleHomeworkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setMessages((prev) => [...prev, { id: Math.random().toString(), role: "user", text: `🖼️ แนบรูปถ่ายการบ้าน: ${file.name}`, timestamp: Date.now(), sourceTag: "รูปการบ้าน" }]);
    noteMultimodal("รูปการบ้าน");
    setIsAnalyzing(true);
    try {
      const { answer, llmReply } = await analyzeHomework(file);
      setMessages((prev) => [...prev,
      { id: Math.random().toString(), role: "bot", text: "อ่านโจทย์เรียบร้อยแล้ว", timestamp: Date.now(), cardType: "ocr", ocrText: `"${answer}"` },
      { id: Math.random().toString(), role: "bot", text: llmReply, timestamp: Date.now() + 50 },
      ]);
      pushTrend("neutral", "รูปการบ้าน");
    } catch (err) {
      console.error("Vision LLM homework error:", err);
      toast("อ่านรูปการบ้านไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetChat = () => {
    if (!window.confirm("ยืนยันเริ่มการสนทนาใหม่? บันทึกแนวโน้มอารมณ์และรายการของคุณจะถูกลบออกจากอุปกรณ์นี้")) return;
    setMessages([{ id: "init_" + Date.now(), role: "bot", text: "สวัสดีค่ะ วันนี้อยากเล่าอะไรให้กระจกฟังไหม จะพิมพ์ พูด ถ่ายเซลฟี่ หรือถ่ายรูปการบ้านก็ได้นะ", timestamp: Date.now() }]);
    setTrendData([]); setLogEntries([]); setConcernStreak(0); setModesUsed(new Set()); setTransparencyLogs([]); setMood("calm"); setShowSupportStrip(false);
    escalationShownRef.current = false;
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
    { id: "safety", label: "ความปลอดภัย & ข้อมูล", iconSrc: IMG.shieldLockNoBg },
  ];

  const pageLabel: Record<AppView, string> = {
    home: "หน้าหลัก",
    chat: "คุยกับกระจก",
    trend: "แนวโน้มของฉัน",
    safety: "ความปลอดภัย & ข้อมูล",
  };

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: T.cream }}>

      {/* TOP CHECKERBOARD with salmon tab break */}
      <div className="fixed top-0 left-0 right-0 z-50 flex" style={{ height: "36px" }}>
        {/* Checker left of active tab */}
        <div className="relative flex overflow-hidden w-12 md:w-[230px]">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} style={{ flex: 1, background: i % 2 === 0 ? T.black : T.white }} />
          ))}
          {/* Mobile menu button */}
          <button
            ref={menuButtonRef}
            onClick={() => setSidebarOpen(true)}
            aria-label="เปิดเมนู"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            className="md:hidden absolute inset-y-0 left-0 w-12 flex items-center justify-center transition-colors hover:bg-black/15"
            style={{ color: T.salmon }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
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
        {/* Mobile drawer scrim */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/45 md:hidden"
            onClick={closeDrawer}
            aria-hidden="true"
          />
        )}

        {/* LEFT SIDEBAR — pure black, curved right edge; drawer on mobile */}
        <div
          ref={drawerRef}
          id="app-sidebar"
          role={isDesktop ? undefined : "dialog"}
          aria-modal={isDesktop ? undefined : sidebarOpen}
          aria-hidden={!isDesktop && !sidebarOpen}
          className={`fixed left-0 z-40 flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
          style={{ top: "36px", bottom: 0, width: "230px" }}
        >
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
                <path d="M32,0 L32,100 C20,80 0,60 0,35 C0,20 12,8 32,0 Z" fill="#F5F0E8" />
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
                        closeDrawer();
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
        <div className="flex-1 min-h-screen md:ml-[230px]">
          {/* Graph paper background */}
          <div
            className="fixed pointer-events-none left-0 md:left-[230px]"
            style={{
              top: "36px", right: 0, bottom: 0,
              background: `linear-gradient(${T.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${T.gridLine} 1px, transparent 1px)`,
              backgroundSize: "28px 28px",
              backgroundColor: T.cream,
              zIndex: 0,
            }}
          />

          <div className="relative z-10 px-5 py-6 md:px-8 md:py-7">
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
                  trendData={trendData}
                  onMoodTap={(key: string) => {
                    const info = EMO[key] || EMO.neutral;
                    setMood(key);
                    const openingLines: Record<string, string> = {
                      stressed: "วันนี้รู้สึกเครียด / กังวลอยู่นิดหน่อยค่ะ",
                      sad: "วันนี้ใจมันท้อแท้อยู่เลยค่ะ",
                      tired: "วันนี้รู้สึกเหนื่อยล้ามากค่ะ",
                      neutral: "วันนี้รู้สึกปกติดีค่ะ",
                      calm: "วันนี้ใจสงบผ่อนคลายค่ะ",
                      positive: "วันนี้รู้สึกสดใส มีความสุขมากค่ะ",
                    };
                    const openingText = openingLines[key] || "วันนี้เป็นยังไงบ้าง";
                    const fullText = `${info.emoji} ${openingText}`;
                    // Route through sendMessage so the real LLM handles the response
                    sendMessage(fullText, "อารมณ์แท็บ");
                    setCurrentView("chat");
                  }}
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
                  supportStrip={showSupportStrip}
                  onDismissSupport={() => setShowSupportStrip(false)}
                  onNotifyCounselor={() => {
                    toast("ส่งการแจ้งเตือนถึงครูที่ปรึกษาแล้ว (โหมดสาธิต)");
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
        <div
          ref={escalationRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="escalation-title"
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl" style={{ border: `2px solid ${T.salmon}` }}>
            <div className="text-4xl mb-3">🤝</div>
            <h3 id="escalation-title" className="text-xl font-bold mb-2" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
              เราสังเกตว่าช่วงนี้ใจคุณหนักอยู่หลายครั้ง
            </h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
              ไม่เป็นไรนะ ความรู้สึกแบบนี้ไม่ผิดเลย กระจกอยากชวนคุณลองพูดคุยกับคนที่ไว้ใจได้ สายด่วนสุขภาพจิต 1323
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { toast("ส่งการแจ้งเตือนถึงครูที่ปรึกษาแล้ว (โหมดสาธิต)"); setShowEscalationModal(false); }}
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

      {/* ── Hidden file inputs for Pathumma Vision LLM ── */}
      <input
        ref={selfieInputRef}
        type="file"
        accept="image/*"
        capture="user"
        style={{ display: "none" }}
        onChange={handleSelfieFile}
        aria-hidden="true"
      />
      <input
        ref={homeworkInputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: "none" }}
        onChange={handleHomeworkFile}
        aria-hidden="true"
      />

      {/* ── Mic recording indicator pill ── */}
      {isRecording && (
        <div
          onClick={handleVoice}
          style={{
            position: "fixed", bottom: "96px", left: "50%", transform: "translateX(-50%)",
            zIndex: 999, background: "#FF3366", color: "#fff",
            borderRadius: "999px", padding: "10px 24px",
            display: "flex", alignItems: "center", gap: "10px",
            fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
            fontSize: "14px", fontWeight: 700,
            boxShadow: "0 4px 24px rgba(255,51,102,0.45)",
            cursor: "pointer", userSelect: "none",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          🎙️ กำลังบันทึก — แตะเพื่อหยุด
        </div>
      )}

      {/* ── Pathumma API status badge ── */}
      <div
        style={{
          position: "fixed", bottom: "12px", right: "12px", zIndex: 500,
          display: "flex", alignItems: "center", gap: "6px",
          background: hasApiKey() ? "rgba(10,10,10,0.85)" : "rgba(180,40,40,0.9)",
          backdropFilter: "blur(8px)",
          borderRadius: "999px", padding: "5px 12px",
          fontFamily: "'Inter', monospace", fontSize: "11px",
          color: "#fff", letterSpacing: "0.04em",
          boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          pointerEvents: "none",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: hasApiKey() ? "#39FF14" : "#FF4444", flexShrink: 0 }} />
        {hasApiKey() ? "Pathumma LLM — เชื่อมต่อแล้ว" : "Pathumma LLM — ยังไม่ได้ตั้งค่า API Key"}
      </div>
    </div>
  );
}

function HomeView({
  mood, setMood, onGoChat, onGoTrend, tryMode, lineNotify, setLineNotify, trendData, onMoodTap,
}: {
  mood: string;
  setMood: (v: string) => void;
  onGoChat: () => void;
  onGoTrend: () => void;
  tryMode: (mode: "camera" | "keyboard" | "mic" | "photo") => void;
  lineNotify: boolean;
  setLineNotify: (v: boolean) => void;
  trendData: TrendPoint[];
  onMoodTap: (key: string) => void;
}) {
  const [hoveredMode, setHoveredMode] = useState<string | null>(null);

  useEffect(() => {
    // Hero entrance animation
    gsap.fromTo("#hv-kicker", { y: 20 }, { y: 0, duration: 0.7, ease: "power3.out" });
    gsap.fromTo("#hv-headline", { y: 30 }, { y: 0, duration: 0.9, ease: "power3.out", delay: 0.1 });
    gsap.fromTo("#hv-body", { y: 20 }, { y: 0, duration: 0.7, ease: "power3.out", delay: 0.2 });
    gsap.fromTo("#hv-ctas", { y: 20 }, { y: 0, duration: 0.7, ease: "power3.out", delay: 0.3 });
    gsap.fromTo("#hv-img", { scale: 0.95 }, { scale: 1, duration: 1.0, ease: "power2.out", delay: 0.2 });
    gsap.fromTo(".hv-strip", { y: 30 }, { y: 0, duration: 0.8, stagger: 0.1, ease: "power3.out", delay: 0.4 });
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "อรุณสวัสดิ์" : hour < 18 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";
  const todayThai = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });

  const SF = "'Plus Jakarta Sans', 'Inter', 'Noto Sans Thai', sans-serif";

  const modes = [
    { id: "camera" as const, th: "ถ่ายเซลฟี่", sub: "บอกเราผ่านรูป", img: IMG.origamiStars },
    { id: "keyboard" as const, th: "พิมพ์ความรู้สึก", sub: "ระบายความในใจ", img: IMG.handPen },
    { id: "mic" as const, th: "พูดระบาย", sub: "ให้เราฟัง", img: IMG.megaphone },
    { id: "photo" as const, th: "ถ่ายรูปการบ้าน", sub: "ให้เราช่วยดู", img: IMG.booksStack }
  ];

  const PINK = "#FF3366";
  const BLACK = "#08090A";
  const CREAM = "#F5F0E8";
  const INK = "#1A140A";            // Deep warm ink for text on cream
  const INK_MUTED = "rgba(26,20,10,0.45)";
  const GRID = "rgba(26,20,10,0.07)";
  const SERIF = "'Playfair Display', 'Noto Serif Thai', Georgia, serif";

  return (
    <div style={{ margin: "-1.75rem -1.25rem", marginTop: "-1.5rem", backgroundColor: CREAM }} className="md:!-mx-8 md:!-my-7 overflow-x-hidden">

      {/* HERO: Aardvark editorial cream warmth + Pieter typography scale */}
      <section
        id="hv-hero"
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundColor: CREAM,
          backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      >
        {/* Top metadata strip */}
        <div
          id="hv-kicker"
          style={{
            position: "relative", zIndex: 2,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "1.5rem clamp(1.5rem, 5vw, 4rem)",
            borderBottom: `1px solid rgba(26,20,10,0.1)`,
          }}
        >
          <span style={{ fontFamily: SF, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: INK_MUTED }}>{todayThai}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: PINK, boxShadow: `0 0 8px ${PINK}` }} />
            <span style={{ fontFamily: SF, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: INK_MUTED }}>กำลังทำงาน</span>
          </div>
        </div>

        {/* Main hero: big type left, collage right */}
        <div style={{ display: "flex", flexWrap: "wrap", minHeight: "clamp(460px, 68vh, 740px)", position: "relative", zIndex: 2 }}>

          {/* LEFT column: display typography */}
          <div style={{
            flex: "1 1 420px",
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "3rem clamp(1.5rem, 5vw, 4rem) 4rem",
          }}>
            <p style={{
              fontFamily: SF, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.2em",
              textTransform: "uppercase", color: PINK, margin: "0 0 1.5rem",
              display: "flex", alignItems: "center", gap: "0.5rem"
            }}>
              <span style={{ display: "inline-block", width: "28px", height: "2px", background: PINK, borderRadius: "2px" }} />
              {greeting}
            </p>

            <h1
              id="hv-headline"
              style={{
                fontFamily: SF,
                fontSize: "clamp(4rem, 9vw, 9.5rem)",
                fontWeight: 900,
                lineHeight: 0.9,
                letterSpacing: "-0.04em",
                color: INK,
                margin: "0 0 1.75rem",
                maxWidth: "12ch",
              }}
            >
              กระจก
              <br />
              <span style={{ color: PINK }}>สะท้อนใจ</span>
            </h1>

            <p style={{
              fontFamily: SF,
              fontSize: "clamp(0.9rem, 1.6vw, 1.05rem)",
              lineHeight: 1.7,
              color: INK_MUTED,
              margin: "0 0 2.5rem",
              maxWidth: "36ch",
              borderLeft: `3px solid ${PINK}`,
              paddingLeft: "1rem",
            }}>
              พื้นที่ส่วนตัวเพื่อบันทึกความรู้สึก — พิมพ์ พูด หรือถ่ายภาพ กระจกรับฟังทุกอย่าง
            </p>

            <div id="hv-ctas" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                onClick={onGoChat}
                style={{
                  fontFamily: SF, fontWeight: 800, fontSize: "0.9rem",
                  background: INK, color: CREAM,
                  border: "none", borderRadius: "9999px",
                  padding: "0.9rem 2rem", cursor: "pointer",
                  letterSpacing: "-0.01em",
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  transition: "background 0.2s, transform 0.2s",
                  boxShadow: "0 4px 20px rgba(26,20,10,0.15)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = PINK; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.03)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = INK; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              >
                เริ่มคุยกับกระจก
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
              <button
                onClick={onGoTrend}
                style={{
                  fontFamily: SF, fontWeight: 700, fontSize: "0.9rem",
                  background: "transparent", color: INK,
                  border: `2px solid rgba(26,20,10,0.22)`, borderRadius: "9999px",
                  padding: "0.88rem 2rem", cursor: "pointer",
                  letterSpacing: "-0.01em",
                  transition: "border-color 0.2s, color 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = PINK; (e.currentTarget as HTMLButtonElement).style.color = PINK; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(26,20,10,0.22)"; (e.currentTarget as HTMLButtonElement).style.color = INK; }}
              >
                ดูแนวโน้มของฉัน
              </button>
            </div>
          </div>

          {/* RIGHT column: collage editorial */}
          <div
            id="hv-img"
            style={{
              flex: "0 1 400px",
              position: "relative",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              overflow: "hidden",
              minHeight: "320px",
            }}
          >
            <div style={{
              position: "absolute",
              bottom: "-80px", right: "-80px",
              width: "420px", height: "420px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${PINK}12 0%, transparent 65%)`,
              zIndex: 0,
            }} />
            <div style={{
              position: "absolute", top: "2rem", left: "2.5rem",
              fontFamily: SERIF, fontSize: "6rem", fontWeight: 900,
              color: PINK, opacity: 0.1, lineHeight: 1, zIndex: 0, userSelect: "none",
            }}>✦</div>
            <img
              src={IMG.glasses}
              alt=""
              aria-hidden="true"
              style={{
                width: "clamp(200px, 30vw, 400px)",
                objectFit: "contain",
                zIndex: 1,
                position: "relative",
                filter: "drop-shadow(0 24px 48px rgba(26,20,10,0.16))",
                mixBlendMode: "multiply",
                opacity: 0.9,
              }}
            />
            <div style={{
              position: "absolute", bottom: "2.5rem", right: "1.5rem",
              fontFamily: `'Mali', 'Noto Sans Thai', cursive`,
              fontSize: "0.78rem", color: INK_MUTED,
              transform: "rotate(-8deg)", zIndex: 2,
              opacity: 0.6,
            }}>กระจกของฉัน ↗</div>
          </div>
        </div>

        <div style={{ height: "1px", background: `rgba(26,20,10,0.1)` }} />
      </section>

      {/* MODE GALLERY HEADER — cream editorial strip */}
      <div className="hv-strip" style={{
        background: CREAM,
        backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        borderBottom: `1px solid rgba(26,20,10,0.1)`,
        padding: "1.5rem clamp(1.5rem, 5vw, 4rem)",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <span style={{ fontFamily: SF, fontSize: "1.35rem", fontWeight: 800, color: INK, letterSpacing: "-0.03em" }}>เลือกวิธีบอกเรา</span>
          <span style={{ fontFamily: SF, fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.16em", color: INK_MUTED, textTransform: "uppercase" }}>04 โหมด</span>
        </div>
        <svg width="60" height="12" viewBox="0 0 60 12" fill="none" style={{ opacity: 0.4 }}>
          <path d="M0 6 Q7.5 0 15 6 Q22.5 12 30 6 Q37.5 0 45 6 Q52.5 12 60 6" stroke={PINK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      {/* MODE GALLERY: Accordion in black — dramatic cream-to-black contrast */}
      <div
        className="hv-strip"
        style={{
          display: "flex",
          flexDirection: "row",
          height: "clamp(500px, 68vh, 740px)",
          background: BLACK,
          overflow: "hidden"
        }}
      >
        {modes.map((item, idx) => {
          const isHovered = hoveredMode === item.id;
          const isAnyHovered = hoveredMode !== null;
          const flexGrow = isHovered ? 3.5 : isAnyHovered ? 0.4 : 1;

          return (
            <button
              key={item.id}
              onClick={() => tryMode(item.id)}
              onMouseEnter={() => setHoveredMode(item.id)}
              onMouseLeave={() => setHoveredMode(null)}
              onFocus={() => setHoveredMode(item.id)}
              onBlur={() => setHoveredMode(null)}
              aria-label={`${item.th} \u2014 ${item.sub}`}
              style={{
                flex: flexGrow,
                transition: "flex 0.65s cubic-bezier(0.25, 1, 0.25, 1)",
                background: "transparent",
                position: "relative",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                minWidth: 0,
                border: "none",
                outline: "none",
                borderRight: idx < 3 ? "1px solid rgba(240,239,233,0.06)" : "none",
              }}
            >
              <div style={{
                position: "absolute", inset: 0,
                background: `radial-gradient(ellipse at 50% 70%, ${PINK}15 0%, transparent 65%)`,
                opacity: isHovered ? 1 : 0,
                transition: "opacity 0.5s ease",
                zIndex: 0
              }} />
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(8,9,10,0.62)",
                opacity: isAnyHovered && !isHovered ? 1 : 0,
                transition: "opacity 0.55s ease",
                zIndex: 1
              }} />
              <div style={{
                position: "absolute", top: "1.25rem", left: "1.5rem",
                fontFamily: SF, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.16em",
                color: isHovered ? PINK : "rgba(245,240,232,0.9)",
                opacity: isAnyHovered && !isHovered ? 0.15 : isHovered ? 1 : 0.4,
                transition: "all 0.45s ease",
                zIndex: 5
              }}>{String(idx + 1).padStart(2, "0")}</div>

              <img
                src={item.img}
                alt={item.th}
                style={{
                  width: "clamp(120px, 18vw, 240px)",
                  height: "clamp(120px, 18vw, 240px)",
                  objectFit: "contain",
                  transition: "all 0.65s cubic-bezier(0.25, 1, 0.25, 1)",
                  transform: isHovered ? "scale(1.14) translateY(-8px)" : "scale(1)",
                  filter: isHovered
                    ? `drop-shadow(0 28px 44px rgba(0,0,0,0.8)) drop-shadow(0 0 30px ${PINK}44) brightness(1.08)`
                    : "drop-shadow(0 10px 22px rgba(0,0,0,0.55)) brightness(0.92) grayscale(0.12)",
                  zIndex: 2,
                  position: "relative",
                  flexShrink: 0
                }}
              />

              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "2.5rem 1.5rem 1.5rem",
                background: "linear-gradient(to top, rgba(8,9,10,0.95) 0%, transparent 100%)",
                transition: "all 0.45s ease",
                opacity: isHovered ? 0 : 1,
                transform: isHovered ? "translateY(8px)" : "translateY(0)",
                zIndex: 3,
                textAlign: "center"
              }}>
                <p style={{ fontFamily: SF, fontSize: "clamp(0.65rem, 1.4vw, 0.82rem)", fontWeight: 700, color: "rgba(245,240,232,0.95)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>
                  {item.th}
                </p>
              </div>

              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "3rem 2rem 2rem",
                background: "linear-gradient(to top, rgba(8,9,10,0.98) 0%, rgba(8,9,10,0.6) 55%, transparent 100%)",
                transition: "all 0.6s cubic-bezier(0.25, 1, 0.25, 1)",
                opacity: isHovered ? 1 : 0,
                transform: isHovered ? "translateY(0)" : "translateY(20px)",
                pointerEvents: "none",
                zIndex: 4,
                textAlign: "left"
              }}>
                <p style={{ fontFamily: SF, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: PINK, margin: "0 0 0.5rem" }}>
                  {item.sub}
                </p>
                <h2 style={{ fontFamily: SF, fontSize: "clamp(1.5rem, 3.5vw, 3rem)", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.035em", color: CREAM, margin: "0 0 1rem" }}>
                  {item.th}
                </h2>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: PINK, color: BLACK, borderRadius: "9999px", padding: "0.4rem 1.1rem", fontSize: "0.78rem", fontWeight: 800, fontFamily: SF }}>
                  เริ่มเลย
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </div>
              </div>

              {idx < 3 && (
                <div style={{
                  position: "absolute", right: 0, top: "10%", height: "80%", width: "1px",
                  background: "rgba(240,239,233,0.06)",
                  zIndex: 5
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* FOOTER: LINE Notify — cream editorial strip */}
      <div className="hv-strip" style={{
        background: CREAM,
        backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        borderTop: `1px solid rgba(26,20,10,0.1)`,
        padding: "1.75rem clamp(1.5rem, 5vw, 4rem)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap"
      }}>
        <div>
          <p style={{ fontFamily: SF, fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: INK_MUTED, margin: "0 0 0.3rem" }}>การแจ้งเตือน</p>
          <p style={{ fontFamily: SF, fontSize: "1rem", fontWeight: 700, color: INK, margin: 0 }}>รับการแจ้งเตือนผ่าน LINE</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontFamily: SF, fontSize: "0.82rem", fontWeight: 700, color: lineNotify ? PINK : INK_MUTED }}>
            {lineNotify ? "เปิดอยู่" : "ปิดอยู่"}
          </span>
          <button
            onClick={() => { setLineNotify(!lineNotify); toast(lineNotify ? "ปิดการแจ้งเตือน LINE แล้ว" : "เปิดการแจ้งเตือน LINE แล้ว"); }}
            aria-label="สลับการแจ้งเตือน LINE"
            style={{
              width: "52px", height: "28px", borderRadius: "9999px", border: "none",
              background: lineNotify ? PINK : "rgba(26,20,10,0.12)",
              cursor: "pointer", position: "relative", transition: "background 0.3s ease",
            }}
          >
            <div style={{
              width: "20px", height: "20px", borderRadius: "50%", background: lineNotify ? BLACK : "rgba(26,20,10,0.35)",
              position: "absolute", top: "4px", transition: "left 0.3s ease",
              left: lineNotify ? "28px" : "4px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            }} />
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
  mood, concernStreak, transparencyLogs, supportStrip, onDismissSupport, onNotifyCounselor,
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
  supportStrip: boolean;
  onDismissSupport: () => void;
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
                    ผลการประเมินเบื้องต้นจากใบหน้า · {msg.emotionData.label}
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
                  <MathText text={msg.text} />
                  {msg.role === "bot" && (
                    <button onClick={() => speakText(msg.text)} className="mt-1 text-xs opacity-50 hover:opacity-100 transition-opacity">🔊 ฟังเสียง</button>
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

        {/* Support strip — appears after the first concern log, stays quiet */}
        {supportStrip && (
          <div className="px-4 pt-3">
            <div
              className="flex items-center justify-between gap-3 p-3.5 rounded-2xl text-xs leading-relaxed"
              style={{ backgroundColor: "#FFF3EE", border: "1.5px dashed #E3A48E" }}
            >
              <p style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#6E3826" }}>
                รู้สึกหนักใจอยู่ใช่ไหม? กระจกอยู่ตรงนี้เสมอ — มีคนที่พร้อมฟังคุณตลอด 24 ชม. ด้วยนะ
              </p>
              <a
                href="tel:1323"
                className="flex-shrink-0 px-3 py-2 rounded-full font-bold text-[11px] flex items-center gap-1.5 transition-all active:scale-[0.97]"
                style={{ backgroundColor: T.red, color: T.white, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                โทร 1323
              </a>
              <button
                onClick={onDismissSupport}
                aria-label="ปิดข้อความนี้"
                className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-black/5"
                style={{ color: "#A85F73" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        )}

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
              id="chat-input"
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
            <h3 className="font-bold text-base" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>แนวโน้มอารมณ์ของคุณ</h3>
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
              <div className="text-center text-xs text-gray-400 py-8" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>ยังไม่มีประวัติการเช็คอิน</div>
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
const PageWrapper = ({ children }: { children: React.ReactNode, pageKey: string }) => {
  return <div className="h-full w-full">{children}</div>;
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
        { scale: maxR / 6, opacity: 0, duration: 1.2, ease: "expo.out", onComplete: () => drop.remove() }
      );

      // Some micro droplets
      for (let i = 0; i < 3; i++) {
        const micro = document.createElement("div");
        const angle = Math.random() * Math.PI * 2;
        const dist = maxR * (0.3 + Math.random() * 0.5);
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist;
        micro.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:3px;height:3px;border-radius:50%;background:${col};pointer-events:none;z-index:9999;transform:translate(-50%,-50%)`;
        document.body.appendChild(micro);
        gsap.to(micro, {
          x: tx, y: ty, scale: 0, opacity: 0, duration: 0.6 + Math.random() * 0.4, ease: "power2.out",
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
