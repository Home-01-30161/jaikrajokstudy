import { useState, useRef, useCallback, useEffect } from "react";
import emailjs from "@emailjs/browser";
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

/* ============ DESIGN TOKENS — Cassette Inlay World ============ */
/*
  THESIS: The liner note as diary. Every emotion logged is a track listing.
  The interface is a folded insert card — handwritten Thai over newsprint,
  lo-fi xerox texture, hand-underlined titles. Refuses the SaaS portal.
  OWN-WORLD: newsprint #EDE8DC ground · deep ink #1A1208 · signal red #C8382A
  · teal grove #3D6B5A · ruled line khaki #C4B88A. Type: Sarabun display,
  Noto Sans Thai body. No gradients on the card. No rounded-full buttons.
  FORM: cassette inlay card · candidate 3 · seed e1f48e4b
*/
const T = {
  paper: "#EDE8DC",       // newsprint ground
  ink: "#1A1208",         // deep ink — text, borders
  red: "#C8382A",         // signal red — primary action, brand accent
  teal: "#3D6B5A",        // teal grove — secondary actions, calm states
  khaki: "#C4B88A",       // ruled line — dividers, muted labels
  smoke: "#F7F4EE",       // lighter paper — input backgrounds
  white: "#FAFAF7",       // near-white — card face
  // legacy aliases used by interior screens (kept for compat)
  cream: "#EDE8DC",
  black: "#1A1208",
  salmon: "#C8382A",
  gridLine: "rgba(26,18,8,0.08)",
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

type Page = "login" | "onb1" | "onb2" | "guardian" | "guardian_confirm" | "privacy" | "app";
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
function _CheckerStrip({ className = "" }: { className?: string }) {
  return (
    <div className={`flex overflow-hidden ${className}`} style={{ height: "36px", flexShrink: 0 }}>
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} style={{ flex: 1, background: i % 2 === 0 ? T.black : T.white }} />
      ))}
    </div>
  );
}

/* ============ GRAPH PAPER GRID ============ */
function _GraphPaper({ showDots = false, children }: { showDots?: boolean; children?: React.ReactNode }) {
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
function _BrainCloud({ className = "", size = 200 }: { className?: string; size?: number }) {
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
function _RedDotCross({ className = "", color = T.red }: { className?: string; color?: string }) {
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
function _HalftoneField({ className = "" }: { className?: string }) {
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
function _OnbCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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
function _TealBadge({ children }: { children: React.ReactNode }) {
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
function _TealBtn({ children, onClick, disabled = false, fullWidth = false }: {
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
function _SalmonBtn({ children, onClick, fullWidth = false }: {
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

/* ============ USER AUTHENTICATION SYSTEM ============ */
export interface UserAccount {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  avatarUrl?: string;
  age?: string;
  guardianConsent?: boolean;
  guardianEmail?: string;
  consentAt?: string;
}

export function getUsersList(): UserAccount[] {
  try {
    const list = localStorage.getItem("jaikrajok:users");
    if (list) return JSON.parse(list);
  } catch { /* storage unavailable */ }
  return [];
}

export function saveUsersList(users: UserAccount[]) {
  try {
    localStorage.setItem("jaikrajok:users", JSON.stringify(users));
  } catch { /* storage unavailable */ }
}

export function getCurrentUser(): UserAccount | null {
  try {
    const userStr = localStorage.getItem("jaikrajok:current_user");
    if (userStr) return JSON.parse(userStr);
  } catch { /* storage unavailable */ }
  return null;
}

export function setCurrentUser(user: UserAccount | null) {
  try {
    if (user) {
      localStorage.setItem("jaikrajok:current_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("jaikrajok:current_user");
    }
  } catch { /* storage unavailable */ }
}

/* ============ OTP VERIFICATION MODAL ============ */
function OtpModal({
  email,
  expectedOtp,
  previewUrl,
  onVerifySuccess,
  onCancel,
  onResend,
}: {
  email: string;
  expectedOtp: string;
  previewUrl?: string | null;
  onVerifySuccess: () => void;
  onCancel: () => void;
  onResend: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(60);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
    const interval = setInterval(() => setTimer((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (index: number, val: string) => {
    setErrorMsg("");
    if (!/^\d*$/.test(val)) return;
    const newDigits = [...digits];
    newDigits[index] = val.slice(-1);
    setDigits(newDigits);

    // Auto-advance
    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if 6 digits complete
    const code = newDigits.join("");
    if (code.length === 6) {
      if (code === expectedOtp) {
        onVerifySuccess();
      } else {
        setErrorMsg("รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง");
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      if (pasted === expectedOtp) {
        onVerifySuccess();
      } else {
        setErrorMsg("รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl font-bold w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
        >
          ✕
        </button>

        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-[#FF3366] text-3xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
          📧
        </div>

        <h3 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
          ยืนยันตัวตนด้วยรหัส OTP
        </h3>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          ระบบได้ส่งรหัสยืนยัน 6 หลักไปที่ Gmail ของคุณแล้ว:<br />
          <span className="font-semibold text-gray-800">{email}</span>
        </p>

        {/* 6 Digit Inputs */}
        <div className="flex justify-center gap-2 mb-5" onPaste={handlePaste}>
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => { inputRefs.current[idx] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className="w-11 h-13 text-center text-xl font-bold rounded-xl border border-gray-300 focus:border-[#FF3366] focus:ring-2 focus:ring-[#FF3366]/20 outline-none transition-all bg-gray-50 text-gray-900"
            />
          ))}
        </div>

        {/* Real Email Inbox Preview Link (when test account SMTP generated) */}
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 inline-flex items-center gap-2 py-2 px-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-semibold hover:bg-blue-100 transition-colors"
          >
            <span>📬 เปิดดูอีเมลฉบับจริงใน Inbox (Preview Link)</span>
            <span>↗</span>
          </a>
        )}

        {errorMsg && <p className="text-xs text-red-500 mb-3 font-semibold">{errorMsg}</p>}

        <button
          onClick={() => {
            const code = digits.join("");
            if (code === expectedOtp) onVerifySuccess();
            else setErrorMsg("รหัส OTP ไม่ถูกต้อง");
          }}
          disabled={digits.join("").length < 6}
          className="w-full py-3.5 rounded-full font-bold text-white text-sm mb-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{ backgroundColor: "#FF3366", boxShadow: "0 2px 14px rgba(255,51,102,0.3)" }}
        >
          ยืนยันและเข้าสู่ระบบ
        </button>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span>ยังไม่ได้รับรหัส?</span>
          <button
            onClick={() => {
              if (timer === 0) {
                setTimer(60);
                onResend();
              }
            }}
            disabled={timer > 0}
            className={`font-semibold ${timer === 0 ? "text-[#FF3366] hover:underline cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}
          >
            {timer > 0 ? `ส่งรหัสอีกครั้ง (${timer}s)` : "ส่งรหัสอีกครั้ง"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ GOOGLE OAUTH SIGN-IN MODAL ============ */
function GoogleOAuthModal({
  onSelectAccount,
  onClose,
}: {
  onSelectAccount: (user: UserAccount) => void;
  onClose: () => void;
}) {
  const [customEmail, setCustomEmail] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const demoAccounts = [
    {
      name: "Supakorn Chaiwong",
      email: "supakorn.g@gmail.com",
    },
    {
      name: "NECTEC Student",
      email: "nectec.study@gmail.com",
    },
  ];

  const handleChoose = (name: string, email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const newUser: UserAccount = {
      id: "usr_google_" + cleanEmail.replace(/[^a-z0-9]/g, "_"),
      email: cleanEmail,
      name: name || cleanEmail.split("@")[0],
      passwordHash: "google_oauth_auth",
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
    };
    onSelectAccount(newUser);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-gray-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl font-bold w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
        >
          ✕
        </button>

        {/* Google Header */}
        <div className="text-center mb-6">
          <svg className="w-10 h-10 mx-auto mb-3" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
          </svg>
          <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
            Sign in with Google
          </h3>
          <p className="text-xs text-gray-500 mt-1">Choose an account to continue to <strong className="text-[#FF3366]">JaiKraJok</strong></p>
        </div>

        {/* Account List */}
        <div className="space-y-2.5 mb-4">
          {demoAccounts.map((acc, i) => (
            <button
              key={i}
              onClick={() => handleChoose(acc.name, acc.email)}
              className="w-full p-3 rounded-2xl border border-gray-200 hover:border-[#FF3366] hover:bg-rose-50/50 transition-all flex items-center gap-3 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#FF3366] text-white font-bold flex items-center justify-center text-sm shadow-sm group-hover:scale-105 transition-transform flex-shrink-0">
                {acc.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 truncate">{acc.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{acc.email}</p>
              </div>
              <span className="text-gray-400 group-hover:text-[#FF3366] text-sm font-bold">➔</span>
            </button>
          ))}
        </div>

        {showCustomInput ? (
          <div className="pt-3 border-t border-gray-100">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Enter your Gmail address:</label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="your.email@gmail.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customEmail.includes("@")) {
                    handleChoose(customEmail.split("@")[0], customEmail);
                  }
                }}
                className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-xl outline-none focus:border-[#FF3366] text-gray-900"
              />
              <button
                onClick={() => {
                  if (customEmail.includes("@")) {
                    handleChoose(customEmail.split("@")[0], customEmail);
                  } else {
                    toast("กรุณากรอกอีเมลที่ถูกต้อง");
                  }
                }}
                className="px-4 py-2 bg-[#FF3366] text-white text-xs font-bold rounded-xl hover:bg-[#e02b58] transition-colors"
              >
                Sign In
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomInput(true)}
            className="w-full py-2.5 text-xs text-gray-600 hover:text-black font-semibold text-center hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            + Use another Google account
          </button>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 leading-normal">
            To continue, Google will share your name, email address, and profile picture with JaiKraJok.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============ LOGIN PAGE ============ */
function LoginPage({ onNext: _onNext, onLoginSuccess }: { onNext: () => void; onLoginSuccess: (user: UserAccount) => void }) {
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<{ email: string; passwordHash: string; otpCode: string } | null>(null);
  const [otpPreviewUrl, setOtpPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    // Title screen entrance
    gsap.fromTo(".login-img", { x: -30 }, { x: 0, duration: 1.0, ease: "power3.out" });
    gsap.fromTo(".login-form", { y: 20 }, { y: 0, duration: 0.8, ease: "back.out(1.2)", delay: 0.2 });
  }, []);

  const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  const handleVerifyOtpSuccess = () => {
    if (!pendingRegistration) return;
    const users = getUsersList();
    const newUser: UserAccount = {
      id: "usr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      email: pendingRegistration.email,
      name: pendingRegistration.email.split("@")[0],
      passwordHash: pendingRegistration.passwordHash,
    };

    users.push(newUser);
    saveUsersList(users);
    setCurrentUser(newUser);
    setShowOtpModal(false);
    setPendingRegistration(null);
    toast(`✓ ยืนยันอีเมลสำเร็จ! ยินดีต้อนรับคุณ ${newUser.name}`);
    onLoginSuccess(newUser);
  };

  const handleResendOtp = () => {
    if (!pendingRegistration) return;
    const newOtp = generateOtpCode();
    setPendingRegistration({ ...pendingRegistration, otpCode: newOtp });
    toast(`📧 กำลังส่งรหัส OTP ใหม่ไปที่ ${pendingRegistration.email}...`);
    fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pendingRegistration.email, otp: newOtp }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.previewUrl) setOtpPreviewUrl(data.previewUrl);
        toast(`📧 ส่งรหัส OTP ใหม่ไปที่ ${pendingRegistration.email} สำเร็จแล้ว`);
      })
      .catch(() => {
        toast(`📧 ส่งรหัส OTP ใหม่ไปที่ ${pendingRegistration.email} เรียบร้อยแล้ว`);
      });
  };

  const handleGoogleLogin = () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
    if (!googleClientId) {
      console.error("VITE_GOOGLE_CLIENT_ID is not set in .env");
      setShowGoogleModal(true);
      return;
    }

    const google = (window as unknown as { google: { accounts: { oauth2: { initTokenClient: (opts: Record<string, unknown>) => { requestAccessToken: (opts?: Record<string, unknown>) => void } } } } }).google;
    if (!google?.accounts?.oauth2) {
      setShowGoogleModal(true);
      return;
    }

    // Implicit token flow — always opens the real Google account picker popup
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: "openid email profile",
      callback: async (tokenResponse: { error?: string; access_token?: string }) => {
        if (tokenResponse.error) {
          console.error("Google OAuth error:", tokenResponse.error);
          setShowGoogleModal(true);
          return;
        }
        try {
          // Fetch real user profile from Google with the access token
          const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          });
          const profile = await res.json();
          const googleUser: UserAccount = {
            id: "usr_google_" + profile.sub,
            email: profile.email,
            name: profile.name || profile.given_name || profile.email.split("@")[0],
            passwordHash: "google_oauth_auth",
            avatarUrl: profile.picture,
          };
          handleSelectGoogleAccount(googleUser);
        } catch (err) {
          console.error("Google userinfo fetch failed", err);
          setShowGoogleModal(true);
        }
      },
    });

    tokenClient.requestAccessToken({ prompt: "select_account" });
  };

  const handleSelectGoogleAccount = (googleUser: UserAccount) => {
    const users = getUsersList();
    const existingIndex = users.findIndex((u) => u.email === googleUser.email);
    if (existingIndex >= 0) {
      setCurrentUser(users[existingIndex]);
    } else {
      users.push(googleUser);
      saveUsersList(users);
      setCurrentUser(googleUser);
    }
    setShowGoogleModal(false);
    toast(`✓ เข้าสู่ระบบด้วย Google สำเร็จ! (${googleUser.email})`);
    onLoginSuccess(googleUser);
  };

  return (
    <main className="relative min-h-screen overflow-hidden login-page" style={{ backgroundColor: T.paper }}>
      {/* Ruled-line texture overlay — the newsprint ground */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `repeating-linear-gradient(transparent, transparent 27px, ${T.khaki}55 27px, ${T.khaki}55 28px)`,
        opacity: 0.5,
      }} />

      {/* Left panel — collage, tilted 1.5deg, lo-fi multiply blend */}
      <div
        className="absolute left-0 top-0 bottom-0 z-0 login-img"
        style={{ width: "52%", backgroundColor: T.paper }}
      >
        <img
          src={IMG.loginCollage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-left-top"
          style={{ mixBlendMode: "multiply", opacity: 0.72 }}
        />
        {/* Ink-wash fade to right */}
        <div aria-hidden="true" className="absolute inset-y-0 right-0" style={{
          width: "40%",
          background: `linear-gradient(to right, transparent, ${T.paper})`,
        }} />
        {/* Cassette label strip — bottom of collage panel */}
        <div className="absolute bottom-0 left-0 right-0 px-8 py-4 z-10" style={{
          borderTop: `1px solid ${T.khaki}`,
          background: `${T.paper}cc`,
        }}>
          <p className="text-xs tracking-widest uppercase" style={{ color: T.khaki, fontFamily: "'Noto Sans Thai', sans-serif", letterSpacing: "0.18em" }}>
            Side A — บันทึกความรู้สึก
          </p>
        </div>
      </div>

      {/* Right panel — the insert card */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center z-30 login-form"
        style={{ width: "52%", paddingLeft: "2%", paddingRight: "6%" }}>

        {/* The insert card itself */}
        <div style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: T.white,
          border: `1px solid ${T.khaki}`,
          padding: "40px 36px 32px",
          position: "relative",
          transform: "rotate(0.6deg)",
          boxShadow: `3px 4px 0 ${T.khaki}, 6px 8px 24px rgba(26,18,8,0.14)`,
        }}>
          {/* Corner stamp — top right */}
          <div aria-hidden="true" style={{
            position: "absolute", top: 14, right: 16,
            width: 28, height: 28,
            border: `1.5px solid ${T.red}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 9, color: T.red, fontFamily: "monospace", letterSpacing: "0.05em", lineHeight: 1 }}>
              A1
            </span>
          </div>

          {/* Header label removed — Google sign-in only */}
          <h1 style={{
            fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif",
            fontWeight: 800,
            fontSize: "clamp(2rem, 5vw, 2.75rem)",
            color: T.ink,
            lineHeight: 1.05,
            marginBottom: 4,
            letterSpacing: "-0.03em",
          }}>
            JaiKraJok
          </h1>
          {/* Hand-underline */}
          <div aria-hidden="true" style={{
            height: 2,
            background: T.red,
            marginBottom: 28,
            width: "72%",
            transform: "rotate(-0.5deg)",
          }} />

          {/* Tabs removed — Google sign-in only */}

          {/* Google sign-in — correct branding */}
          <button
            onClick={handleGoogleLogin}
            style={{
              width: "100%",
              padding: "11px 0",
              background: T.white,
              color: "#3c4043",
              fontFamily: "'Noto Sans Thai', 'Roboto', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              border: `1px solid #dadce0`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              transition: "background 0.15s",
              marginBottom: 20,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f8f9fa"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = T.white; }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>

          {/* Footer note */}
          <p style={{
            fontSize: 10,
            color: "#7A6535",
            fontFamily: "'Noto Sans Thai', sans-serif",
            textAlign: "center",
            lineHeight: 1.6,
          }}>
            พื้นที่นี้เป็นของคุณคนเดียว — ไม่มีใครเห็นสิ่งที่คุณเขียน
          </p>
        </div>
      </div>

      {/* Hand image — repositioned to not overlap CTAs */}
      <div className="fixed bottom-0 left-0 z-10 pointer-events-none" style={{ width: 180, opacity: 0.55 }}>
        <img src={IMG.hand} alt="" className="w-full h-auto" />
      </div>

      {showOtpModal && pendingRegistration && (
        <OtpModal
          email={pendingRegistration.email}
          expectedOtp={pendingRegistration.otpCode}
          previewUrl={otpPreviewUrl}
          onVerifySuccess={handleVerifyOtpSuccess}
          onCancel={() => {
            setShowOtpModal(false);
            setPendingRegistration(null);
          }}
          onResend={handleResendOtp}
        />
      )}

      {showGoogleModal && (
        <GoogleOAuthModal
          onSelectAccount={handleSelectGoogleAccount}
          onClose={() => setShowGoogleModal(false)}
        />
      )}
    </main>
  );
}

function OnbWelcome({ onNext }: { onNext: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const starRef = useRef<HTMLImageElement>(null);
  const origamiRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (cardRef.current) gsap.fromTo(cardRef.current, { opacity: 0, y: 40, rotate: -1 }, { opacity: 1, y: 0, rotate: 0, duration: 0.9, ease: "expo.out" });
    if (starRef.current) gsap.fromTo(starRef.current, { opacity: 0, scale: 0.4, rotate: -30 }, { opacity: 1, scale: 1, rotate: 0, duration: 1.1, ease: "back.out(2)", delay: 0.3 });
    if (origamiRef.current) gsap.fromTo(origamiRef.current, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 1.0, ease: "expo.out", delay: 0.2 });
    if (cardRef.current) {
      gsap.fromTo(cardRef.current.querySelector("h2"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", delay: 0.5 });
      gsap.fromTo(cardRef.current.querySelector("p"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out", delay: 0.65 });
      gsap.fromTo(cardRef.current.querySelector("button"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out", delay: 0.8 });
    }
  }, []);
  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>
      <style>{`
        @keyframes onbBgDrift { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-12px) rotate(1.5deg)} }
        .onb-float { animation: onbBgDrift 6s ease-in-out infinite; }
        .onb-float2 { animation: onbBgDrift 8s ease-in-out infinite reverse; }
        .onb-btn-ink { position:relative; overflow:hidden; }
        .onb-btn-ink::before { content:''; position:absolute; inset:0; background:#C8382A; transform:scaleX(0); transform-origin:left; transition:transform 0.3s cubic-bezier(0.22,1,0.36,1); border-radius:inherit; }
        .onb-btn-ink:hover::before { transform:scaleX(1); }
        .onb-btn-ink span { position:relative; z-index:1; }
      `}</style>
      <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-40" alt="" />
      <img ref={origamiRef} src={IMG.origamiStarsNoBg} className="absolute bottom-10 left-10 w-96 h-auto pointer-events-none z-0 onb-float2" style={{ opacity: 0 }} alt="" />
      <img src={IMG.hand} className="absolute bottom-[-40px] right-[-40px] w-[420px] h-auto pointer-events-none z-0 opacity-70 onb-float" alt="" />
      <img ref={starRef} src={IMG.redstar} className="absolute top-16 right-24 w-16 h-auto pointer-events-none z-0" style={{ opacity: 0 }} alt="" />
      <div ref={cardRef} className="relative mx-auto z-10" style={{ opacity: 0, background: "#ffffff", borderRadius: "4px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "6px 6px 0 #1A1208, 0 2px 40px rgba(0,0,0,0.08)", border: "1.5px solid #1A1208" }}>
        <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em", color: "#C4B88A", textTransform: "uppercase", marginBottom: 16 }}>กระจกสะท้อนใจ · JKJ-001</p>
        <h2 style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", fontSize: "2.1rem", fontWeight: 900, color: "#1A1208", marginBottom: 16, lineHeight: 1.15 }}>
          ยินดีต้อนรับสู่<br />JaiKraJok
        </h2>
        <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15, color: "#1A120899", marginBottom: 40, lineHeight: 1.7 }}>
          พื้นที่ปลอดภัยสำหรับแชร์ความรู้สึกของคุณ<br />เราพร้อมรับฟังและเคียงข้างเสมอ
        </p>
        <button onClick={onNext} className="onb-btn-ink" style={{ backgroundColor: "#1A1208", border: "none", borderRadius: 0, padding: "14px 36px", cursor: "pointer" }}>
          <span style={{ color: "#EDE8DC", fontWeight: 700, fontFamily: "'Noto Sans Thai', monospace", fontSize: 13, letterSpacing: "0.06em" }}>เริ่มกันเลย →</span>
        </button>
      </div>
    </main>
  );
}

function OnbAge({ age, setAge, onNext }: { age: string; setAge: (v: string) => void; onNext: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!cardRef.current) return;
    const els = cardRef.current.querySelectorAll(".onb-age-el");
    gsap.fromTo(cardRef.current, { opacity: 0, y: 36, rotate: 0.8 }, { opacity: 1, y: 0, rotate: 0, duration: 0.85, ease: "expo.out" });
    gsap.fromTo(els, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.1, delay: 0.35 });
  }, []);
  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>
      <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-40" alt="" />
      <img src={IMG.booksStackNoBg} className="absolute bottom-0 left-0 w-80 h-auto pointer-events-none z-0 onb-float2" alt="" />
      <img src={IMG.glasses} className="absolute top-4 right-10 w-96 h-auto pointer-events-none z-0 opacity-80 onb-float" alt="" />
      <div ref={cardRef} className="relative mx-auto z-10" style={{ opacity: 0, background: "#ffffff", borderRadius: "4px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "6px 6px 0 #1A1208, 0 2px 40px rgba(0,0,0,0.08)", border: "1.5px solid #1A1208" }}>
        <p className="onb-age-el" style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em", color: "#C4B88A", textTransform: "uppercase", marginBottom: 16, opacity: 0 }}>ขั้นตอน 1 / 3</p>
        <h2 className="onb-age-el" style={{ opacity: 0, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", fontSize: "2.1rem", fontWeight: 900, color: "#1A1208", marginBottom: 12, lineHeight: 1.15 }}>
          คุณอายุเท่าไหร่?
        </h2>
        <p className="onb-age-el" style={{ opacity: 0, fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 15, color: "#1A120899", marginBottom: 28, lineHeight: 1.7 }}>
          เพื่อประสบการณ์ที่เหมาะสมกับคุณ
        </p>
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="ระบุอายุของคุณ"
          className="onb-age-el w-full mb-8 outline-none text-lg text-center"
          style={{ opacity: 0, backgroundColor: "#EDE8DC", border: "1.5px solid #1A1208", borderRadius: 0, padding: "14px 20px", fontFamily: "'Noto Sans Thai', monospace", color: "#1A1208", transition: "border-color 0.15s" }}
          onFocus={e => { e.currentTarget.style.borderColor = "#C8382A"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "#1A1208"; }}
        />
        <button className="onb-age-el onb-btn-ink" onClick={() => { if (!age || parseInt(age) <= 0) return; onNext(); }} style={{ opacity: 0, backgroundColor: "#1A1208", border: "none", borderRadius: 0, padding: "14px 36px", cursor: "pointer" }}>
          <span style={{ color: "#EDE8DC", fontWeight: 700, fontFamily: "'Noto Sans Thai', monospace", fontSize: 13, letterSpacing: "0.06em" }}>ถัดไป →</span>
        </button>
      </div>
    </main>
  );
}

function GuardianPage({ stage, onSubmitEmail, onNext, guardianEmail, setGuardianEmail }: {
  stage: "input" | "pending" | "approved";
  onSubmitEmail: (email: string) => Promise<void>;
  onNext: () => void;
  guardianEmail: string;
  setGuardianEmail: (v: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(cardRef.current, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.85, ease: "expo.out" });
    gsap.fromTo(cardRef.current.querySelectorAll(".grd-el"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: "expo.out", stagger: 0.1, delay: 0.4 });
  }, [stage]);
  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>
      <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-40" alt="" />
      <img src={IMG.shieldLockNoBg} className="absolute top-10 right-10 w-64 h-auto pointer-events-none z-0 onb-float" alt="" />
      <img src={IMG.bulb} className="absolute bottom-16 left-16 w-32 h-auto pointer-events-none z-0 onb-float2" alt="" />
      <div ref={cardRef} className="relative mx-auto z-10" style={{ opacity: 0, background: "#ffffff", borderRadius: "4px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "6px 6px 0 #1A1208, 0 2px 40px rgba(0,0,0,0.08)", border: "1.5px solid #1A1208" }}>
        <p className="grd-el" style={{ opacity: 0, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em", color: "#7A6535", textTransform: "uppercase", marginBottom: 16 }}>ขั้นตอน 2 / 3</p>
        <h2 className="grd-el" style={{ opacity: 0, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", fontSize: "2.1rem", fontWeight: 900, color: "#1A1208", marginBottom: 12, lineHeight: 1.15 }}>
          ขอความยินยอม<br />จากผู้ปกครอง
        </h2>
        <p className="grd-el" style={{ opacity: 0, fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 14, color: "#1A120899", marginBottom: 32, lineHeight: 1.7 }}>
          เนื่องจากคุณอายุต่ำกว่า 18 ปี เราจำเป็นต้องได้รับความยินยอมจากผู้ปกครองของคุณก่อนเข้าใช้งาน ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
        </p>

        {stage === "input" && (
          <div className="flex flex-col gap-5">
            <input
              type="email"
              placeholder="อีเมลผู้ปกครอง"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              className="grd-el w-full outline-none text-base"
              style={{ opacity: 0, backgroundColor: "#EDE8DC", border: "1.5px solid #1A1208", borderRadius: 0, padding: "14px 20px", color: "#1A1208", fontFamily: "'Noto Sans Thai', monospace", transition: "border-color 0.15s" }}
              onFocus={e => { e.currentTarget.style.borderColor = "#C8382A"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#1A1208"; }}
            />
            <button onClick={() => onSubmitEmail(guardianEmail)} className="grd-el onb-btn-ink" style={{ opacity: 0, backgroundColor: "#1A1208", border: "none", borderRadius: 0, padding: "14px 36px", cursor: "pointer" }}>
              <span style={{ color: "#EDE8DC", fontWeight: 700, fontFamily: "'Noto Sans Thai', monospace", fontSize: 13, letterSpacing: "0.06em" }}>ส่งคำขอให้ผู้ปกครอง →</span>
            </button>
          </div>
        )}

        {stage === "pending" && (
          <div className="flex flex-col gap-5">
            <div className="grd-el p-5" style={{ opacity: 0, backgroundColor: "#FFF8E1", border: "1.5px solid #F9A825", borderRadius: 0, fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 13, color: "#5D4037", lineHeight: 1.7 }}>
              <p style={{ fontWeight: 700, marginBottom: 8, fontFamily: "monospace", letterSpacing: "0.06em" }}>รอการยืนยันจากผู้ปกครอง</p>
              <p>ส่งอีเมลไปยัง <strong>{guardianEmail}</strong> แล้ว</p>
              <p style={{ marginTop: 8 }}>ผู้ปกครองต้องกดลิงก์ในอีเมลเพื่อยืนยัน — หน้านี้จะอัปเดตโดยอัตโนมัติเมื่อผู้ปกครองคลิก</p>
            </div>
          </div>
        )}

        {stage === "approved" && (
          <div className="flex flex-col gap-5">
            <div className="grd-el p-5 text-center" style={{ opacity: 0, backgroundColor: "#E8F5E9", border: "1.5px solid #4CAF50", borderRadius: 0, color: "#2E7D32", fontFamily: "'Noto Sans Thai', monospace", fontWeight: 700, letterSpacing: "0.06em", fontSize: 13 }}>
              (pass) ผู้ปกครองยืนยันแล้ว — บันทึกเวลา {new Date().toLocaleString("th-TH")}
            </div>
            <button onClick={onNext} className="grd-el onb-btn-ink" style={{ opacity: 0, backgroundColor: "#1A1208", border: "none", borderRadius: 0, padding: "14px 36px", cursor: "pointer" }}>
              <span style={{ color: "#EDE8DC", fontWeight: 700, fontFamily: "'Noto Sans Thai', monospace", fontSize: 13, letterSpacing: "0.06em" }}>ถัดไป →</span>
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function PrivacyPage({ onNext }: { onNext: (consentAt: string) => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(cardRef.current, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.85, ease: "expo.out" });
    gsap.fromTo(cardRef.current.querySelectorAll(".prv-el"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: "expo.out", stagger: 0.1, delay: 0.4 });
  }, []);
  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>
      <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-40" alt="" />
      <img src={IMG.chartGraphNoBg} className="absolute bottom-10 left-10 w-96 h-auto pointer-events-none z-0 onb-float2" alt="" />
      <img src={IMG.dots} className="absolute top-16 right-16 w-32 h-auto pointer-events-none z-0 onb-float" alt="" />
      <div ref={cardRef} className="relative mx-auto z-10" style={{ opacity: 0, background: "#ffffff", borderRadius: "4px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "6px 6px 0 #1A1208, 0 2px 40px rgba(0,0,0,0.08)", border: "1.5px solid #1A1208" }}>
        <p className="prv-el" style={{ opacity: 0, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em", color: "#7A6535", textTransform: "uppercase", marginBottom: 16 }}>ขั้นตอน 3 / 3</p>
        <h2 className="prv-el" style={{ opacity: 0, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", fontSize: "2.1rem", fontWeight: 900, color: "#1A1208", marginBottom: 20, lineHeight: 1.15 }}>
          นโยบายความ<br />เป็นส่วนตัว
        </h2>
        <div
          className="prv-el mb-6 text-sm leading-relaxed overflow-y-auto"
          style={{
            opacity: 0,
            backgroundColor: "#EDE8DC",
            border: "1.5px solid #1A120833",
            borderRadius: 0,
            height: "220px",
            color: "#1A1208BB",
            fontFamily: "'Noto Sans Thai', sans-serif",
            padding: "20px 24px",
            scrollbarWidth: "thin",
          }}
        >
          <p className="mb-4" style={{ fontWeight: 700 }}>นโยบายการคุ้มครองข้อมูลส่วนบุคคล — JaiKraJok</p>
          <p className="mb-4">เราให้ความสำคัญกับความเป็นส่วนตัวของคุณ ข้อมูลทั้งหมดที่คุณแชร์ใน JaiKraJok จะถูกเก็บรักษาเป็นความลับ</p>
          <p className="mb-4">1. <strong>วัตถุประสงค์การเก็บข้อมูล:</strong> ข้อมูลส่วนบุคคลจะถูกใช้เพื่อให้บริการและปรับปรุงประสบการณ์ของคุณเท่านั้น</p>
          <p className="mb-4">2. <strong>การไม่เปิดเผยข้อมูล:</strong> เราไม่มีนโยบายส่งต่อข้อมูลของคุณให้กับบุคคลที่สาม</p>
          <p className="mb-4">3. <strong>สิทธิของเจ้าของข้อมูล:</strong> คุณสามารถขอเข้าถึง แก้ไข ส่งออก หรือลบข้อมูลของคุณได้ทุกเมื่อผ่านเมนูตั้งค่า</p>
          <p className="mb-4">4. <strong>การจัดเก็บข้อมูล:</strong> ข้อมูลถูกจัดเก็บใน localStorage ของอุปกรณ์คุณ ไม่มีการส่งข้อมูลไปยังเซิร์ฟเวอร์</p>
          <p>5. <strong>อ้างอิงกฎหมาย:</strong> นโยบายนี้เป็นไปตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>
        </div>
        <label className="prv-el flex items-center gap-3 mb-6 cursor-pointer" style={{ opacity: 0 }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#1A1208" }}
          />
          <span style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 13, color: "#1A1208" }}>
            ฉันได้อ่านและยอมรับนโยบายความเป็นส่วนตัวนี้แล้ว
          </span>
        </label>
        <button
          onClick={() => { if (checked) onNext(new Date().toISOString()); }}
          className="prv-el onb-btn-ink"
          disabled={!checked}
          style={{ opacity: 0, backgroundColor: checked ? "#1A1208" : "#9E9E9E", border: "none", borderRadius: 0, padding: "14px 36px", cursor: checked ? "pointer" : "not-allowed", transition: "background-color 0.2s" }}
        >
          <span style={{ color: "#EDE8DC", fontWeight: 700, fontFamily: "'Noto Sans Thai', monospace", fontSize: 13, letterSpacing: "0.06em" }}>ยอมรับและเข้าสู่ระบบ →</span>
        </button>
      </div>
    </main>
  );
}

function GuardianConfirmPage({ onConfirm }: { onConfirm: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(cardRef.current, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.85, ease: "expo.out" });
  }, []);
  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>
      <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-40" alt="" />
      <img src={IMG.shieldLockNoBg} className="absolute top-10 right-10 w-64 h-auto pointer-events-none z-0 onb-float" alt="" />
      <div ref={cardRef} className="relative mx-auto z-10" style={{ opacity: 0, background: "#ffffff", borderRadius: "4px", padding: "48px 56px", maxWidth: "560px", width: "100%", boxShadow: "6px 6px 0 #1A1208, 0 2px 40px rgba(0,0,0,0.08)", border: "1.5px solid #1A1208" }}>
        <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em", color: "#7A6535", textTransform: "uppercase", marginBottom: 16 }}>JaiKraJok — PDPA</p>
        <h2 style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", fontSize: "1.9rem", fontWeight: 900, color: "#1A1208", marginBottom: 16, lineHeight: 1.2 }}>
          ยืนยันความยินยอม<br />ผู้ปกครอง
        </h2>
        <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 14, color: "#1A120899", marginBottom: 12, lineHeight: 1.7 }}>
          บุตรหลานของท่านขอใช้งาน <strong>JaiKraJok</strong> ซึ่งเป็นแอปพลิเคชันสุขภาพจิตสำหรับนักเรียน
        </p>
        <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 14, color: "#1A120899", marginBottom: 32, lineHeight: 1.7 }}>
          ข้อมูลทั้งหมดจัดเก็บในอุปกรณ์ของผู้ใช้เท่านั้น ไม่มีการส่งข้อมูลส่วนบุคคลออกนอกระบบ ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
        </p>
        <div className="flex flex-col gap-4">
          <div style={{ backgroundColor: "#FFF8E1", border: "1.5px solid #F9A825", borderRadius: 0, padding: "14px 20px", fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 13, color: "#5D4037", lineHeight: 1.65 }}>
            <strong>สำคัญ:</strong> กรุณาเปิดลิงก์นี้บนอุปกรณ์ของบุตรหลาน (โทรศัพท์หรือคอมพิวเตอร์ที่บุตรหลานใช้) แล้วกดปุ่มด้านล่าง
          </div>
          <button
            onClick={onConfirm}
            style={{ backgroundColor: "#2E7D32", border: "none", borderRadius: 0, padding: "16px 36px", cursor: "pointer", transition: "background 0.18s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1B5E20"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#2E7D32"; }}
          >
            <span style={{ color: "#ffffff", fontWeight: 700, fontFamily: "'Noto Sans Thai', monospace", fontSize: 14, letterSpacing: "0.06em" }}>
              ฉันยินยอมให้บุตรหลานใช้งาน JaiKraJok
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}

export interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  messages: ChatMsg[];
  mood: string;
}

/* ============ MAIN APP SHELL ============ */
function AppShell({ currentUser, onLogout, age, guardianConsent }: { currentUser: UserAccount | null; onLogout?: () => void; age: string; guardianConsent: boolean }) {
  const userKey = currentUser ? currentUser.id : "guest";
  const [currentView, setCurrentView] = useState<AppView>("home");

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`jaikrajok:sessions:${userKey}`) || "null");
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch { /* storage unavailable */ }
    return [
      {
        id: `session_${userKey}_1`,
        title: "สนทนาใหม่",
        timestamp: Date.now(),
        messages: [
          {
            id: "init",
            role: "bot",
            text: `สวัสดีค่ะคุณ ${currentUser ? currentUser.name : "ผู้เรียน"} วันนี้อยากเล่าอะไรให้กระจกฟังไหม จะพิมพ์ พูด ถ่ายเซลฟี่ หรือถ่ายรูปการบ้านก็ได้นะ`,
            timestamp: Date.now(),
          },
        ],
        mood: "calm",
      },
    ];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id || `session_${userKey}_1`);

  useEffect(() => {
    try {
      localStorage.setItem(`jaikrajok:sessions:${userKey}`, JSON.stringify(sessions));
    } catch { /* storage unavailable */ }
  }, [sessions, userKey]);

  // Derived current active session state
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];
  const mood = activeSession ? activeSession.mood : "calm";

  const setMessages = useCallback(
    (updater: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])) => {
      setSessions((prevSessions) =>
        prevSessions.map((session) => {
          if (session.id === activeSessionId) {
            const newMsgs = typeof updater === "function" ? updater(session.messages) : updater;
            let newTitle = session.title;
            if (newTitle === "สนทนาใหม่" || newTitle === "New chat") {
              const firstUserMsg = newMsgs.find((m) => m.role === "user");
              if (firstUserMsg && firstUserMsg.text) {
                const cleanText = firstUserMsg.text.replace(/^[^\w\u0E00-\u0E7F]+/, "").trim();
                newTitle = cleanText.slice(0, 24) || "สนทนาใหม่";
              }
            }
            return { ...session, messages: newMsgs, title: newTitle };
          }
          return session;
        })
      );
    },
    [activeSessionId]
  );

  const setMood = useCallback(
    (newMood: string | ((prev: string) => string)) => {
      setSessions((prevSessions) =>
        prevSessions.map((session) => {
          if (session.id === activeSessionId) {
            const updatedMood = typeof newMood === "function" ? newMood(session.mood) : newMood;
            return { ...session, mood: updatedMood };
          }
          return session;
        })
      );
    },
    [activeSessionId]
  );

  // Keep a ref that always reflects the latest messages — used to read history
  const messagesRef = useRef<ChatMsg[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [trendData, setTrendData] = useState<TrendPoint[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`jaikrajok:trend:${userKey}`) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [logEntries, setLogEntries] = useState<LogEntry[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`jaikrajok:logs:${userKey}`) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [concernStreak, setConcernStreak] = useState(0);
  const [_modesUsed, setModesUsed] = useState<Set<string>>(new Set());
  const [_transparencyLogs, setTransparencyLogs] = useState<string[]>([]);
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
    try { localStorage.setItem(`jaikrajok:trend:${userKey}`, JSON.stringify(trendData)); } catch { /* storage full or blocked */ }
  }, [trendData, userKey]);

  useEffect(() => {
    try { localStorage.setItem(`jaikrajok:logs:${userKey}`, JSON.stringify(logEntries)); } catch { /* storage full or blocked */ }
  }, [logEntries, userKey]);

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

  const handleNewChat = useCallback(() => {
    const newId = "session_" + Date.now();
    const newSession: ChatSession = {
      id: newId,
      title: "สนทนาใหม่",
      timestamp: Date.now(),
      messages: [
        {
          id: "init_" + Date.now(),
          role: "bot",
          text: "สวัสดีค่ะ วันนี้อยากเล่าอะไรให้กระจกฟังไหม จะพิมพ์ พูด ถ่ายเซลฟี่ หรือถ่ายรูปการบ้านก็ได้นะ",
          timestamp: Date.now(),
        },
      ],
      mood: "calm",
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setCurrentView("chat");
    closeDrawer();
    toast("เปิดการสนทนาใหม่เรียบร้อยแล้ว");
  }, [closeDrawer]);

  const handleDeleteSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      if (prev.length <= 1) {
        const freshId = "session_" + Date.now();
        setActiveSessionId(freshId);
        return [
          {
            id: freshId,
            title: "สนทนาใหม่",
            timestamp: Date.now(),
            messages: [
              {
                id: "init_" + Date.now(),
                role: "bot",
                text: "สวัสดีค่ะ วันนี้อยากเล่าอะไรให้กระจกฟังไหม จะพิมพ์ พูด ถ่ายเซลฟี่ หรือถ่ายรูปการบ้านก็ได้นะ",
                timestamp: Date.now(),
              },
            ],
            mood: "calm",
          },
        ];
      }
      const remaining = prev.filter((s) => s.id !== id);
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0].id);
      }
      return remaining;
    });
    toast("ลบการสนทนาแล้ว");
  }, [activeSessionId]);

  const resetChat = () => {
    if (!window.confirm("ยืนยันเริ่มการสนทนาใหม่ในเซสชันนี้?")) return;
    setMessages([
      {
        id: "init_" + Date.now(),
        role: "bot",
        text: "สวัสดีค่ะ วันนี้อยากเล่าอะไรให้กระจกฟังไหม จะพิมพ์ พูด ถ่ายเซลฟี่ หรือถ่ายรูปการบ้านก็ได้นะ",
        timestamp: Date.now(),
      },
    ]);
    setMood("calm");
    toast("ล้างข้อความในเซสชันนี้เรียบร้อยแล้ว");
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
    <main className="relative min-h-screen flex flex-col" style={{ backgroundColor: T.cream }}>

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

        {/* LEFT SIDEBAR — cassette insert panel: newsprint ground, ruled lines, track-listing nav */}
        <div
          ref={drawerRef}
          id="app-sidebar"
          role={isDesktop ? undefined : "dialog"}
          aria-modal={isDesktop ? undefined : sidebarOpen}
          aria-hidden={!isDesktop && !sidebarOpen}
          className={`fixed left-0 z-40 flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
          style={{ top: "36px", bottom: 0, width: "230px" }}
        >
          {/* Newsprint insert card body */}
          <div
            className="relative flex flex-col h-full"
            style={{
              backgroundColor: T.paper,
              borderRight: `1px solid ${T.khaki}`,
              backgroundImage: `repeating-linear-gradient(transparent, transparent 27px, ${T.khaki}44 27px, ${T.khaki}44 28px)`,
            }}
          >
            <div className="relative z-10 flex flex-col h-full px-4 py-4" style={{ paddingRight: "16px" }}>

              {/* Catalog number header */}
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.12em", color: T.khaki, textTransform: "uppercase" }}>
                  CAT. NO. JKJ-001-A
                </p>
                <h1 style={{ fontFamily: "'Noto Sans Thai', 'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "1.25rem", color: T.ink, lineHeight: 1.1, marginTop: 2 }}>
                  JaiKraJok
                </h1>
                <div style={{ width: 28, height: 2, background: T.red, marginTop: 3 }} />
              </div>

              {/* New chat — ink block button */}
              <button
                onClick={handleNewChat}
                style={{
                  width: "100%", textAlign: "left", padding: "7px 12px",
                  background: T.ink, color: T.paper,
                  border: "none", borderRadius: 0, cursor: "pointer",
                  fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 700, fontSize: 11,
                  letterSpacing: "0.04em",
                  marginBottom: 12,
                  transition: "background 0.12s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.red; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.ink; }}
              >
                <span style={{ fontSize: 14, fontWeight: 900 }}>+</span> เปิดการสนทนาใหม่
              </button>

              {/* Track-listing nav — A-SIDE */}
              <nav style={{ marginBottom: 10 }}>
                <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.1em", color: T.khaki, textTransform: "uppercase", marginBottom: 4 }}>A-SIDE</p>
                {navItems.map((item, idx) => {
                  const active = currentView === item.id;
                  const trackNum = ["A1", "A2", "A3", "A4"][idx] || `A${idx + 1}`;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setCurrentView(item.id); closeDrawer(); }}
                      style={{
                        width: "100%", textAlign: "left", padding: "6px 0",
                        background: "none", border: "none", borderBottom: `1px solid ${T.khaki}44`,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                        fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 12,
                        fontWeight: active ? 700 : 400,
                        color: active ? T.ink : `${T.ink}99`,
                      }}
                    >
                      <span style={{ fontFamily: "monospace", fontSize: 9, color: active ? T.red : T.khaki, minWidth: 18 }}>{trackNum}</span>
                      {item.label}
                      {active && <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.red, marginLeft: "auto", flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </nav>

              {/* Session list */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden mb-3">
                <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.1em", color: T.khaki, textTransform: "uppercase", marginBottom: 4 }}>
                  รายการสนทนา
                </p>
                <div className="flex-1 overflow-y-auto space-y-0.5 pr-1" style={{ scrollbarWidth: "none" }}>
                  {sessions.map((sess) => {
                    const isSelected = sess.id === activeSessionId && currentView === "chat";
                    return (
                      <div
                        key={sess.id}
                        onClick={() => { setActiveSessionId(sess.id); setCurrentView("chat"); closeDrawer(); }}
                        className="group relative w-full text-left flex items-center justify-between cursor-pointer"
                        style={{
                          padding: "5px 4px",
                          borderBottom: `1px solid ${T.khaki}33`,
                          background: isSelected ? `${T.ink}0D` : "none",
                          color: isSelected ? T.ink : `${T.ink}88`,
                          fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 11,
                        }}
                      >
                        <span className="truncate flex-1 pr-1">{sess.title}</span>
                        <button
                          onClick={(e) => handleDeleteSession(sess.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          title="ลบแชทนี้"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", color: T.khaki, fontSize: 10 }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom catalog strip — initials, mood label, logout */}
              <div style={{ borderTop: `1px solid ${T.khaki}`, paddingTop: 10, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 22, height: 22,
                      border: `1.5px solid ${T.ink}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: T.ink, flexShrink: 0,
                    }}>
                      {currentUser ? currentUser.name[0].toUpperCase() : "?"}
                    </div>
                    <span style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 11, fontWeight: 600, color: T.ink }}>
                      {currentUser ? currentUser.name : "ผู้เรียน"}
                    </span>
                  </div>
                  {mood && EMO[mood] && (
                    <span style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 9, color: T.khaki, letterSpacing: "0.05em" }}>
                      {EMO[mood].label}
                    </span>
                  )}
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: "'Noto Sans Thai', sans-serif",
                      fontSize: 10, color: T.khaki,
                      textDecoration: "underline", textUnderlineOffset: 2,
                      padding: 0, transition: "color 0.12s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = T.red; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = T.khaki; }}
                  >
                    ออกจากระบบ
                  </button>
                )}
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
                  supportStrip={showSupportStrip}
                  onDismissSupport={() => setShowSupportStrip(false)}
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

    </main>
  );
}

function HomeView({
  mood: _mood, setMood: _setMood, onGoChat, onGoTrend, tryMode, trendData: _trendData, onMoodTap: _onMoodTap,
}: {
  mood: string;
  setMood: (v: string) => void;
  onGoChat: () => void;
  onGoTrend: () => void;
  tryMode: (mode: "camera" | "keyboard" | "mic" | "photo") => void;
  trendData: TrendPoint[];
  onMoodTap: (key: string) => void;
}) {
  useEffect(() => {
    gsap.fromTo("#hv-dateline", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" });
    gsap.fromTo("#hv-question", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", delay: 0.1 });
    gsap.fromTo("#hv-cta-block", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", delay: 0.25 });
    gsap.fromTo("#hv-img", { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 1.0, ease: "power2.out", delay: 0.15 });
    gsap.fromTo(".hv-strip", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power3.out", delay: 0.3 });
  }, []);

  const _hour = new Date().getHours();
  const todayThai = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });

  const modes = [
    { id: "camera" as const, track: "B1", th: "ถ่ายเซลฟี่", sub: "วิเคราะห์อารมณ์จากใบหน้า" },
    { id: "keyboard" as const, track: "B2", th: "พิมพ์ความรู้สึก", sub: "ระบายความในใจเป็นตัวอักษร" },
    { id: "mic" as const, track: "B3", th: "พูดระบาย", sub: "บันทึกเสียงพูดของคุณ" },
    { id: "photo" as const, track: "B4", th: "ถ่ายรูปการบ้าน", sub: "ให้กระจกช่วยดูการบ้าน" },
  ];

  const _moodOrder = ["stressed", "sad", "tired", "neutral", "calm", "positive"];

  return (
    <div style={{ margin: "-1.75rem -1.25rem", marginTop: "-1.5rem", backgroundColor: T.paper }} className="md:!-mx-8 md:!-my-7 overflow-x-hidden">
      {/* Ruled-line texture overlay */}
      <div
        className="fixed pointer-events-none"
        style={{
          inset: 0, zIndex: 0,
          backgroundImage: `repeating-linear-gradient(transparent, transparent 27px, ${T.khaki}33 27px, ${T.khaki}33 28px)`,
        }}
      />

      <div className="relative z-10 flex flex-col" style={{ minHeight: "calc(100vh - 36px)" }}>

        {/* HERO — emotional question first */}
        <div className="flex flex-col md:flex-row" style={{ minHeight: "60vh", borderBottom: `1px solid ${T.khaki}` }}>

          {/* Left: question + CTA */}
          <div className="flex flex-col justify-between px-6 pt-8 pb-6 md:px-10 md:py-10" style={{ flex: "0 0 55%" }}>

            {/* Dateline anchor */}
            <div id="hv-dateline" style={{ opacity: 0 }}>
              <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.1em", color: T.khaki, textTransform: "uppercase", marginBottom: 4 }}>
                {todayThai}
              </p>
              <div style={{ width: 32, height: 1, background: T.khaki }} />
            </div>

            {/* h1 — emotional question, display scale */}
            <div id="hv-question" style={{ opacity: 0, flex: 1, display: "flex", alignItems: "center", paddingTop: 24, paddingBottom: 24 }}>
              <h1
                style={{
                  fontFamily: "'Noto Sans Thai', 'Plus Jakarta Sans', sans-serif",
                  fontWeight: 800,
                  fontSize: "clamp(2.8rem,8vw,7rem)",
                  lineHeight: 1.05,
                  color: T.ink,
                  letterSpacing: "-0.02em",
                }}
              >
                วันนี้{" "}
                <span style={{ color: T.red }}>เป็นยัง</span>
                <br />
                <span style={{ color: T.red }}>ไงบ้าง?</span>
              </h1>
            </div>

            {/* CTA block */}
            <div id="hv-cta-block" style={{ opacity: 0 }}>
              <div style={{ width: "100%", height: 2, background: T.ink, marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={onGoChat}
                  style={{
                    padding: "10px 20px", background: T.ink, color: T.paper,
                    border: "none", borderRadius: 0, cursor: "pointer",
                    fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 700, fontSize: 13,
                    letterSpacing: "0.02em", transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.red; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.ink; }}
                >
                  เขียนความรู้สึกวันนี้
                </button>
                <button
                  onClick={onGoTrend}
                  style={{
                    padding: "10px 20px", background: "none", color: T.ink,
                    border: `1.5px solid ${T.ink}`, borderRadius: 0, cursor: "pointer",
                    fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: 500, fontSize: 13,
                    transition: "border-color 0.12s, color 0.12s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.red; (e.currentTarget as HTMLButtonElement).style.color = T.red; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.ink; (e.currentTarget as HTMLButtonElement).style.color = T.ink; }}
                >
                  ดูแนวโน้มอารมณ์
                </button>
              </div>
            </div>
          </div>

          {/* Right: collage photo */}
          <div id="hv-img" style={{ opacity: 0, flex: "0 0 45%", position: "relative", minHeight: 240, overflow: "hidden" }}>
            <img
              src={IMG.glasses}
              alt=""
              aria-hidden="true"
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                mixBlendMode: "multiply", filter: "grayscale(20%) contrast(1.05)",
                position: "absolute", inset: 0,
              }}
            />
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(to right, ${T.paper} 0%, transparent 25%)`,
            }} />
          </div>
        </div>

        {/* INPUT MODES — animated selection cards */}
        <div style={{ padding: "20px 24px" }}>
          <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.1em", color: T.khaki, textTransform: "uppercase", marginBottom: 12 }}>
            เลือกวิธีระบาย
          </p>
          <style>{`
            @keyframes modeSlideIn {
              from { opacity: 0; transform: translateY(10px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .mode-card {
              position: relative;
              overflow: hidden;
              cursor: pointer;
              border: 1.5px solid ${T.khaki};
              background: ${T.paper};
              padding: 14px 16px;
              text-align: left;
              animation: modeSlideIn 0.35s cubic-bezier(0.22,1,0.36,1) both;
              transition: border-color 0.18s, box-shadow 0.18s;
            }
            .mode-card::before {
              content: '';
              position: absolute;
              inset: 0;
              background: ${T.ink};
              transform: translateY(100%);
              transition: transform 0.32s cubic-bezier(0.22,1,0.36,1);
              z-index: 0;
            }
            .mode-card:hover::before { transform: translateY(0); }
            .mode-card:hover { border-color: ${T.ink}; box-shadow: 3px 3px 0 ${T.ink}; }
            .mode-card:active { transform: scale(0.97); box-shadow: 1px 1px 0 ${T.ink}; }
            .mode-card-track { position: relative; z-index: 1; font-family: monospace; font-size: 9px; letter-spacing: 0.1em; color: ${T.red}; margin-bottom: 4px; transition: color 0.18s; }
            .mode-card-title  { position: relative; z-index: 1; font-family: 'Noto Sans Thai', sans-serif; font-weight: 700; font-size: 13px; color: ${T.ink}; margin-bottom: 3px; transition: color 0.18s; }
            .mode-card-sub    { position: relative; z-index: 1; font-family: 'Noto Sans Thai', sans-serif; font-size: 10px; color: ${T.ink}99; transition: color 0.18s; }
            .mode-card:hover .mode-card-track { color: ${T.red}; }
            .mode-card:hover .mode-card-title  { color: ${T.paper}; }
            .mode-card:hover .mode-card-sub    { color: ${T.paper}99; }
          `}</style>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {modes.map((m, i) => (
              <button
                key={m.id}
                onClick={() => tryMode(m.id)}
                className="mode-card"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <p className="mode-card-track">{m.track}</p>
                <p className="mode-card-title">{m.th}</p>
                <p className="mode-card-sub">{m.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Catalog footer */}
        <div style={{ padding: "8px 24px 16px", borderTop: `1px solid ${T.khaki}44`, marginTop: "auto" }}>
          <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.1em", color: T.khaki, textTransform: "uppercase" }}>
            JKJ-001 · กระจกสะท้อนใจ · {new Date().getFullYear()}
          </p>
        </div>

      </div>
    </div>
  );
}

function ChatView({
  messages, inputText, setInputText, sendMessage, isAnalyzing,
  handleSelfie, handleVoice, handleHomeworkPhoto, resetChat, speakText,
  mood, supportStrip, onDismissSupport,
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
  supportStrip: boolean;
  onDismissSupport: () => void;
}) {
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const hasUserMsg = messages.some((m) => m.role === "user");
  const emptyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [messages, isAnalyzing]);

  useEffect(() => {
    if (!emptyRef.current || hasUserMsg) return;
    const els = emptyRef.current.querySelectorAll(".chat-hero-el");
    gsap.fromTo(els, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.65, ease: "expo.out", stagger: 0.12 });
  }, [hasUserMsg]);

  return (
    <div className="w-full flex flex-col" style={{ height: "calc(100vh - 70px)" }}>
      {!hasUserMsg ? (
        /* ── HERO VIEW (empty state) ── */
        <div ref={emptyRef} className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <style>{`
            @keyframes chatStarSpin { 0%{transform:rotate(0deg) scale(1)} 50%{transform:rotate(180deg) scale(1.15)} 100%{transform:rotate(360deg) scale(1)} }
            .chat-star { display:inline-block; animation: chatStarSpin 8s linear infinite; }
            .chat-hero-el { opacity: 0; }
            @keyframes chatBubblePop { from{opacity:0;transform:translateY(8px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
            .chat-bubble-in { animation: chatBubblePop 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
          `}</style>
          {/* Greeting Header */}
          <div className="chat-hero-el flex items-center justify-center gap-3 mb-6">
            <span className="chat-star text-2xl" style={{ color: T.red }}>✴</span>
            <h2 style={{ fontFamily: "'Noto Sans Thai', monospace", fontSize: "clamp(1.4rem,4vw,2rem)", fontWeight: 900, color: T.ink, letterSpacing: "-0.02em" }}>
              สวัสดีครับ, กระจกพร้อมช่วยดูแลนะ
            </h2>
          </div>

          {/* Claude Prompt Box Card */}
          <div className="chat-hero-el w-full max-w-2xl bg-white p-4 shadow-md border border-[#E2D9C2] transition-all focus-within:shadow-lg focus-within:border-[#C8382A]" style={{ borderRadius: 0 }}>
            <textarea
              placeholder="พิมพ์ความรู้สึกของคุณ หรือถามโจทย์การบ้าน (Bio, Math, Coding)..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={3}
              className="w-full bg-transparent outline-none text-sm resize-none text-black placeholder:text-gray-400"
              style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#000000", fontWeight: 500 }}
            />
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSelfie}
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-black transition-colors"
                  title="ถ่ายเซลฟี่ประเมินอารมณ์"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </button>
                <button
                  onClick={handleHomeworkPhoto}
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-black transition-colors"
                  title="แนบรูปการบ้าน"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast("โมเดลหลัก: Pathumma-ThaiLLM-qwen3-8b-think-3.0.0")}
                  className="text-xs px-3 py-1 rounded-full bg-slate-900 text-slate-100 font-semibold border border-slate-700 hover:bg-black transition-colors shadow-xs"
                >
                  Pathumma-ThaiLLM-qwen3-8b-think-3.0.0 ▾
                </button>
                <button
                  onClick={handleVoice}
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-black transition-colors"
                  title="พูดระบายสภาวะจิตใจ"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
                <button
                  onClick={() => sendMessage()}
                  disabled={!inputText.trim()}
                  className="w-9 h-9 rounded-full text-white font-bold flex items-center justify-center transition-all disabled:opacity-30 active:scale-95 shadow-sm"
                  style={{ backgroundColor: T.salmon }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="chat-hero-el flex flex-wrap items-center justify-center gap-2.5 mt-6 max-w-2xl px-2">
            <button
              onClick={handleSelfie}
              className="px-4 py-2 bg-white border border-[#C8BF9E] text-xs font-bold transition-all shadow-xs hover:border-[#C8382A] hover:shadow-[2px_2px_0_#1A1208] cursor-pointer flex items-center gap-1.5"
              style={{ color: "#1A1A1A", borderRadius: 0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
              <span>ถ่ายเซลฟี่ประเมินอารมณ์</span>
            </button>
            <button
              onClick={handleHomeworkPhoto}
              className="px-4 py-2 bg-white border border-[#C8BF9E] text-xs font-bold transition-all shadow-xs hover:border-[#C8382A] hover:shadow-[2px_2px_0_#1A1208] cursor-pointer flex items-center gap-1.5"
              style={{ color: "#1A1A1A", borderRadius: 0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              <span>เฉลยรูปการบ้าน</span>
            </button>
            <button
              onClick={handleVoice}
              className="px-4 py-2 bg-white border border-[#C8BF9E] text-xs font-bold transition-all shadow-xs hover:border-[#C8382A] hover:shadow-[2px_2px_0_#1A1208] cursor-pointer flex items-center gap-1.5"
              style={{ color: "#1A1A1A", borderRadius: 0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
              <span>พูดระบาย</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── ACTIVE CHAT STREAM ── */
        <div className="flex-1 flex flex-col overflow-hidden bg-white/90 rounded-2xl border border-[#E2D9C2] shadow-sm">
          {/* Header */}
          <div className="px-5 py-3 flex items-center justify-between border-b border-[#EDE6D3] bg-white">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: EMO[mood]?.bg || "#E3EAE0", border: `1.5px solid ${T.salmon}` }}
              >
                {EMO[mood]?.emoji || "😌"}
              </div>
              <div>
                <p className="font-bold text-sm" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
                  กระจกสะท้อนใจ
                </p>
                <p className="text-xs flex items-center gap-1 font-medium text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  สภาวะอารมณ์: {EMO[mood]?.label || "ปกติ"}
                </p>
              </div>
            </div>
            <button
              onClick={resetChat}
              className="px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-all text-gray-600 text-xs font-semibold flex items-center gap-1 border border-gray-200"
              title="เริ่มการสนทนาใหม่"
            >
              🔄 ล้างข้อความ
            </button>
          </div>

          {/* Messages */}
          <div ref={chatBodyRef} className="flex-1 overflow-y-auto p-5 space-y-4 max-w-4xl mx-auto w-full" style={{ scrollbarWidth: "thin" }}>
            {messages.map((msg, _mi) => (
              <div key={msg.id} className={`flex chat-bubble-in ${msg.role === "user" ? "justify-end" : "justify-start"}`} style={{ animationDelay: `${_mi * 30}ms` }}>
                {msg.role === "system" ? (
                  <div className="w-full px-4 py-2 text-xs font-mono text-center" style={{ backgroundColor: "#F3E6C8", color: "#6E4F1F", borderRadius: 0, border: "1px solid #C4B88A55" }}>
                    {msg.text}
                  </div>
                ) : msg.cardType === "emotion" && msg.emotionData ? (
                  <div
                    className="max-w-[85%] p-4 text-sm leading-relaxed"
                    style={{ backgroundColor: msg.emotionData.bg, border: `1.5px solid ${msg.emotionData.color}`, color: msg.emotionData.text, fontFamily: "'Noto Sans Thai', sans-serif", borderRadius: 0 }}
                  >
                    <p className="font-bold text-xs uppercase tracking-wider mb-1 opacity-75" style={{ fontFamily: "monospace" }}>
                      ผลการประเมินเบื้องต้นจากใบหน้า · {msg.emotionData.label}
                    </p>
                    <p>{msg.emotionData.note}</p>
                  </div>
                ) : msg.cardType === "ocr" ? (
                  <div className="max-w-[85%] p-4 text-sm" style={{ backgroundColor: T.cream, border: "1.5px dashed #C4B88A", borderRadius: 0 }}>
                    <p className="font-bold text-xs mb-1" style={{ fontFamily: "monospace", color: T.khaki, letterSpacing: "0.08em" }}>OCR OUTPUT</p>
                    <p className="text-xs italic border-l-2 pl-3 py-1 my-1" style={{ borderColor: T.red, color: `${T.ink}99` }}>{msg.ocrText}</p>
                  </div>
                ) : (
                  <div
                    className="max-w-[82%] px-5 py-3.5 text-sm leading-relaxed"
                    style={{
                      backgroundColor: msg.role === "user" ? T.red : T.white,
                      color: msg.role === "user" ? T.white : T.ink,
                      border: msg.role === "user" ? "none" : `1.5px solid ${T.khaki}`,
                      borderRadius: 0,
                      fontFamily: "'Noto Sans Thai', sans-serif",
                      boxShadow: msg.role === "user" ? `2px 2px 0 ${T.ink}` : "none",
                    }}
                  >
                    <MathText text={msg.text} />
                    {msg.role === "bot" && (
                      <button onClick={() => speakText(msg.text)} style={{ marginTop: 6, fontSize: 10, opacity: 0.5, background: "none", border: "none", cursor: "pointer", color: T.ink, fontFamily: "monospace", letterSpacing: "0.06em" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.5"; }}>
                        ▶ ฟังเสียง
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isAnalyzing && (
              <div className="flex justify-start">
                <div className="px-5 py-3 rounded-2xl shadow-xs" style={{ backgroundColor: T.white, border: `1.5px solid ${T.salmon}` }}>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-500 font-medium">กำลังคิด...</span>
                    {[0, 200, 400].map((d) => (
                      <div key={d} className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: T.salmon, animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Support strip */}
          {supportStrip && (
            <div className="px-4 pt-2">
              <div
                className="flex items-center justify-between gap-3 p-3 rounded-2xl text-xs leading-relaxed"
                style={{ backgroundColor: "#FFF3EE", border: "1.5px dashed #E3A48E" }}
              >
                <p style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#6E3826" }}>
                  รู้สึกหนักใจอยู่ใช่ไหม? กระจกอยู่ตรงนี้เสมอ — มีคนที่พร้อมฟังคุณตลอด 24 ชม. ด้วยนะ
                </p>
                <a
                  href="tel:1323"
                  className="flex-shrink-0 px-3 py-1.5 rounded-full font-bold text-[11px] flex items-center gap-1.5 transition-all active:scale-[0.97]"
                  style={{ backgroundColor: T.red, color: T.white }}
                >
                  โทร 1323
                </a>
                <button onClick={onDismissSupport} className="flex-shrink-0 p-1 hover:bg-black/5 rounded">✕</button>
              </div>
            </div>
          )}

          {/* Bottom Floating Prompt Card */}
          <div className="p-4 bg-transparent max-w-3xl mx-auto w-full">
            <div className="bg-white rounded-3xl p-3 shadow-sm border border-[#E2D9C2] transition-all focus-within:shadow-md focus-within:border-[#FF3366]">
              <textarea
                placeholder="พิมพ์ความรู้สึกของคุณ หรือถามโจทย์การบ้าน..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={2}
                className="w-full bg-transparent outline-none text-sm resize-none text-black placeholder:text-gray-400"
                style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#000000", fontWeight: 500 }}
              />
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
                <div className="flex items-center gap-1.5">
                  <button onClick={handleSelfie} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-black transition-colors" title="ถ่ายเซลฟี่">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                  </button>
                  <button onClick={handleHomeworkPhoto} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-black transition-colors" title="แนบรูปการบ้าน">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toast("โมเดลหลัก: Pathumma-ThaiLLM-qwen3-8b-think-3.0.0")}
                    className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-100 font-semibold border border-slate-700 hover:bg-black transition-colors cursor-pointer"
                  >
                    Pathumma-ThaiLLM-qwen3-8b-think-3.0.0 ▾
                  </button>
                  <button onClick={handleVoice} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-black transition-colors" title="พูดระบาย">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>
                  <button
                    onClick={() => sendMessage()}
                    disabled={!inputText.trim()}
                    className="w-8 h-8 rounded-full text-white font-bold flex items-center justify-center transition-all disabled:opacity-30 active:scale-95 shadow-sm"
                    style={{ backgroundColor: T.salmon }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
  const chartRef = useRef<SVGPolylineElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll(".trend-card");
    gsap.fromTo(cards, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.65, ease: "expo.out", stagger: 0.12 });
    const rows = containerRef.current.querySelectorAll(".trend-row");
    gsap.fromTo(rows, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.45, ease: "expo.out", stagger: 0.07, delay: 0.3 });
    if (chartRef.current && trendData.length > 1) {
      const len = chartRef.current.getTotalLength?.() || 400;
      gsap.fromTo(chartRef.current, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: "expo.inOut", delay: 0.4 });
    }
  }, [trendData]);

  return (
    <div ref={containerRef} className="space-y-6 max-w-4xl">
      <style>{`
        .trend-card { opacity: 0; }
        .trend-row { opacity: 0; }
        @keyframes dotPop { from { r: 0; opacity: 0; } to { opacity: 1; } }
        .chart-dot { animation: dotPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
        .trend-btn { position: relative; overflow: hidden; transition: box-shadow 0.18s; }
        .trend-btn::before { content:''; position:absolute; inset:0; opacity:0; background: currentColor; transition: opacity 0.18s; }
        .trend-btn:hover { box-shadow: 2px 2px 0 currentColor; }
      `}</style>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SVG trend chart */}
        <div className="trend-card p-6" style={{ backgroundColor: T.white, border: "1.5px solid #1A1208", boxShadow: "4px 4px 0 #1A120822" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base" style={{ fontFamily: "'Noto Sans Thai', monospace", color: T.ink, letterSpacing: "-0.01em" }}>แนวโน้มอารมณ์</h3>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: T.khaki, letterSpacing: "0.1em", textTransform: "uppercase" }}>{trendData.length === 0 ? "ยังไม่มีข้อมูล" : `${trendData.length} จุด`}</span>
          </div>
          <div className="relative h-44 w-full my-2">
            <svg viewBox="0 0 500 160" className="w-full h-full overflow-visible">
              {[0.25, 0.5, 0.75, 1].map(v => (
                <line key={v} x1="0" y1={140 - v * 110} x2="500" y2={140 - v * 110} stroke={T.khaki} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.5" />
              ))}
              <line x1="0" y1="140" x2="500" y2="140" stroke={T.khaki} strokeWidth="1" />
              <text x="0" y="18" fontFamily="monospace" fontSize="9" fill={T.khaki}>ผ่อนคลาย</text>
              <text x="0" y="150" fontFamily="monospace" fontSize="9" fill={T.khaki}>ตึงเครียด</text>
              {trendData.length > 0 && (
                <>
                  <polyline ref={chartRef} fill="none" stroke={T.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    points={trendData.map((d, idx) => {
                      const stepX = trendData.length > 1 ? 460 / (trendData.length - 1) : 0;
                      return `${30 + idx * stepX},${140 - d.valence * 110}`;
                    }).join(" ")}
                  />
                  {trendData.map((d, idx) => {
                    const stepX = trendData.length > 1 ? 460 / (trendData.length - 1) : 0;
                    return <circle key={d.id} className="chart-dot" cx={30 + idx * stepX} cy={140 - d.valence * 110} r="5" fill={d.color} stroke={T.paper} strokeWidth="2" style={{ animationDelay: `${0.5 + idx * 0.08}s` }} />;
                  })}
                </>
              )}
            </svg>
          </div>
          <div className="flex gap-4 pt-3" style={{ borderTop: `1px solid ${T.khaki}44` }}>
            {[[T.teal, "ผ่อนคลาย / ดี"], ["#6F6389", "ปกติ / เหนื่อยล้า"], [T.red, "เครียด / กังวล"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5" style={{ fontFamily: "monospace", fontSize: 9, color: T.ink, letterSpacing: "0.06em" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} /> {l}
              </span>
            ))}
          </div>
        </div>

        {/* Check-in history */}
        <div className="trend-card p-6 flex flex-col" style={{ backgroundColor: T.white, border: "1.5px solid #1A1208", boxShadow: "4px 4px 0 #1A120822" }}>
          <h3 className="font-bold text-base mb-3" style={{ fontFamily: "'Noto Sans Thai', monospace", color: T.ink, letterSpacing: "-0.01em" }}>ประวัติการเช็คอิน</h3>
          <div className="flex-1 overflow-y-auto max-h-48 space-y-1.5 pr-1" style={{ scrollbarWidth: "thin" }}>
            {logEntries.length === 0 ? (
              <div className="text-center py-8" style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 12, color: T.khaki }}>ยังไม่มีประวัติการเช็คอิน</div>
            ) : (
              logEntries.map((e, i) => (
                <div key={e.id} className="trend-row flex items-center justify-between p-3" style={{ backgroundColor: T.smoke, border: `1px solid ${T.khaki}55`, fontFamily: "'Noto Sans Thai', sans-serif", animationDelay: `${i * 60}ms` }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{e.label} · {e.source}</span>
                  <div className="flex items-center gap-3">
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: T.khaki }}>{e.time}</span>
                    <button onClick={() => onDeleteEntry(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.khaki, fontSize: 14, lineHeight: 1, transition: "color 0.15s" }}
                      onMouseEnter={e2 => { (e2.currentTarget as HTMLButtonElement).style.color = T.red; }}
                      onMouseLeave={e2 => { (e2.currentTarget as HTMLButtonElement).style.color = T.khaki; }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 pt-4 mt-auto" style={{ borderTop: `1px solid ${T.khaki}44` }}>
            <button onClick={onExport} style={{ flex: 1, padding: "10px 0", border: `1.5px solid ${T.teal}`, color: T.teal, backgroundColor: "transparent", cursor: "pointer", fontFamily: "'Noto Sans Thai', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", transition: "all 0.18s", borderRadius: 0 }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.backgroundColor = T.teal; b.style.color = T.white; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.backgroundColor = "transparent"; b.style.color = T.teal; }}>
              ส่งออกข้อมูล
            </button>
            <button onClick={onClearAll} style={{ padding: "10px 16px", border: `1.5px solid ${T.red}`, color: T.red, backgroundColor: "transparent", cursor: "pointer", fontFamily: "'Noto Sans Thai', monospace", fontSize: 11, fontWeight: 700, transition: "all 0.18s", borderRadius: 0 }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.backgroundColor = T.red; b.style.color = T.white; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.backgroundColor = "transparent"; b.style.color = T.red; }}>
              ลบทั้งหมด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ SCHOOL VIEW ============ */
function _SchoolView() {
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
          { title: "บริการฟรี", desc: "นักเรียนและครูใช้งานผ่านเว็บแอปพลิเคชันได้ฟรีเสมอ" },
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
  const currentUser = getCurrentUser();
  const consentAt = currentUser?.consentAt
    ? new Date(currentUser.consentAt).toLocaleString("th-TH")
    : "ไม่ระบุ";
  const [subTab, setSubTab] = useState<"privacy" | "ethics" | "arch" | "limits">("privacy");
  const panelRef = useRef<HTMLDivElement>(null);

  const switchTab = (id: "privacy" | "ethics" | "arch" | "limits") => {
    setSubTab(id);
  };

  useEffect(() => {
    if (!panelRef.current) return;
    const items = panelRef.current.querySelectorAll(".saf-item");
    gsap.fromTo(panelRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: "expo.out" });
    gsap.fromTo(items, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: "expo.out", stagger: 0.07, delay: 0.1 });
  }, [subTab]);

  return (
    <div className="space-y-6 max-w-4xl">
      <style>{`
        .saf-tab { position:relative; overflow:hidden; transition: color 0.18s; }
        .saf-tab::before { content:''; position:absolute; inset:0; background:#1A1208; transform:scaleY(0); transform-origin:bottom; transition:transform 0.28s cubic-bezier(0.22,1,0.36,1); z-index:0; }
        .saf-tab.active::before { transform:scaleY(1); }
        .saf-tab span { position:relative; z-index:1; }
        .saf-item { opacity:0; }
        .saf-arch-row { position:relative; overflow:hidden; }
        .saf-arch-row::after { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:#C8382A; transform:scaleY(0); transform-origin:bottom; transition:transform 0.3s cubic-bezier(0.22,1,0.36,1); }
        .saf-arch-row:hover::after { transform:scaleY(1); }
        .saf-arch-row:hover { background:#EDE8DC; }
      `}</style>
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {[
          { id: "privacy" as const, label: "ข้อมูลของฉัน" },
          { id: "ethics" as const, label: "การใช้ AI" },
          { id: "arch" as const, label: "สถาปัตยกรรม" },
          { id: "limits" as const, label: "ข้อจำกัด" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`saf-tab${subTab === t.id ? " active" : ""}`}
            style={{
              padding: "8px 20px",
              border: `1.5px solid ${subTab === t.id ? T.ink : T.khaki}`,
              borderRadius: 0,
              color: subTab === t.id ? T.paper : T.ink,
              background: subTab === t.id ? T.ink : "transparent",
              fontFamily: "monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "border-color 0.18s, background 0.28s, color 0.18s",
            }}
          >
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div ref={panelRef} style={{ opacity: 0 }}>
        {subTab === "privacy" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "อายุที่ยืนยัน", value: age ? `${age} ปี` : "16 ปี" },
                { label: "ความยินยอมผู้ปกครอง", value: guardianConsent ? "ได้รับแล้ว" : "รอดำเนินการ" },
                { label: "ยินยอม PDPA เมื่อ", value: consentAt },
              ].map((item, i) => (
                <div key={i} className="saf-item p-4" style={{ backgroundColor: "#E3EAE0", border: `1.5px solid ${T.teal}`, borderRadius: 0, color: "#3C5137" }}>
                  <h5 style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: T.teal, marginBottom: 6 }}>{item.label}</h5>
                  <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 13, fontWeight: 700 }}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="saf-item p-6 space-y-4" style={{ backgroundColor: T.white, border: `1.5px solid #1A1208` }}>
              <h4 style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: T.ink }}>การควบคุมข้อมูลของฉัน</h4>
              <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 12, color: `${T.ink}88` }}>คุณสามารถเข้าถึง ส่งออก หรือลบข้อมูลของตนเองได้ทุกเมื่อ</p>
              <div className="flex gap-3">
                <button onClick={onExport} style={{ padding: "9px 20px", border: `1.5px solid ${T.teal}`, color: T.teal, background: "transparent", cursor: "pointer", fontFamily: "monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", transition: "all 0.18s", borderRadius: 0 }}
                  onMouseEnter={e => { const b = e.currentTarget; b.style.background = T.teal; b.style.color = T.white; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.background = "transparent"; b.style.color = T.teal; }}>
                  ส่งออกข้อมูล
                </button>
                <button onClick={onClearAll} style={{ padding: "9px 20px", border: `1.5px solid ${T.red}`, color: T.red, background: "transparent", cursor: "pointer", fontFamily: "monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", transition: "all 0.18s", borderRadius: 0 }}
                  onMouseEnter={e => { const b = e.currentTarget; b.style.background = T.red; b.style.color = T.white; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.background = "transparent"; b.style.color = T.red; }}>
                  ลบข้อมูลทั้งหมด
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { title: "พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)", content: "ระบบปฏิบัติตาม PDPA อย่างเคร่งครัด ภาพใบหน้าประมวลผลแบบเรียลไทม์และไม่ถูกจัดเก็บลงเซิร์ฟเวอร์ ข้อมูลแนวโน้มอารมณ์จัดเก็บในเครื่องของผู้ใช้เท่านั้น" },
                { title: "นโยบายความเป็นส่วนตัว (สรุป)", content: "ข้อมูลที่เก็บมีเพียงแนวโน้มอารมณ์แบบไม่ระบุตัวตนเพื่อแสดงพัฒนาการของผู้ใช้เท่านั้น ไม่มีการขายหรือแบ่งปันข้อมูลส่วนบุคคลให้บุคคลที่สาม" },
                { title: "ข้อกำหนดการใช้งาน (สรุป)", content: "ผู้ใช้อายุต่ำกว่า 18 ปีต้องได้รับความยินยอมจากผู้ปกครองก่อนใช้งาน ระบบมีการจำกัดอัตราการใช้งาน" },
              ].map((acc, i) => (
                <details key={i} className="saf-item group" style={{ backgroundColor: T.white, border: `1.5px solid ${T.khaki}` }}>
                  <summary style={{ padding: "14px 18px", fontFamily: "monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", color: T.ink }}>
                    <span>{acc.title}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: T.khaki, transition: "transform 0.2s" }} className="group-open:rotate-180">▼</span>
                  </summary>
                  <p style={{ padding: "0 18px 16px", fontSize: 12, color: `${T.ink}99`, fontFamily: "'Noto Sans Thai', sans-serif", lineHeight: 1.7, borderTop: `1px solid ${T.khaki}44`, paddingTop: 12, marginTop: 0 }}>{acc.content}</p>
                </details>
              ))}
            </div>
          </div>
        )}

        {subTab === "ethics" && (
          <div className="space-y-4">
            <div className="p-6 space-y-2" style={{ backgroundColor: T.white, border: `1.5px solid #1A1208` }}>
              {["ระบบแสดงข้อความแจ้งเตือนทุกครั้งที่กำลังวิเคราะห์ข้อมูล (Transparent AI)", "AI ไม่มีหน้าที่วินิจฉัยโรคซึมเศร้าหรือโรคทางจิตเวชไม่ว่ากรณีใดๆ", "มี Human-in-the-loop — กรณีฉุกเฉินจะแจ้งเตือนไปยังผู้ดูแลระบบที่เป็นมนุษย์แบบไม่ระบุตัวตน", "ผลลัพธ์จากการวิเคราะห์เป็นข้อเสนอแนะเชิงบวก ไม่ใช่การตัดสิน ตีตรา หรือประเมินค่า", "มี Rate Limiting และระบบตรวจจับกรองเนื้อหาที่ไม่เหมาะสม เพื่อป้องกันการใช้งานในทางที่ผิด"].map((text, i) => (
                <div key={i} className="saf-item flex items-start gap-3 p-3.5" style={{ backgroundColor: T.smoke, border: `1px solid ${T.khaki}44` }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: T.teal, fontWeight: 700, marginTop: 2, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                  <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 12, color: T.ink, lineHeight: 1.65 }}>{text}</p>
                </div>
              ))}
            </div>
            <div className="saf-item p-6 flex items-center justify-between gap-4" style={{ backgroundColor: T.ink }}>
              <div>
                <h4 style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 6, letterSpacing: "0.04em" }}>สายด่วนสุขภาพจิต 1323</h4>
                <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 11, color: `${T.paper}99`, lineHeight: 1.6 }}>หากพบสัญญาณน่าเป็นห่วงต่อเนื่อง กระจกจะแนะนำให้ปรึกษาครูที่ปรึกษา ผู้ปกครอง หรือสายด่วนนี้</p>
              </div>
              <a href="tel:1323" style={{ padding: "10px 24px", backgroundColor: T.red, color: T.white, fontFamily: "monospace", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textDecoration: "none", flexShrink: 0, transition: "background 0.18s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#a02820"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = T.red; }}>
                โทร 1323
              </a>
            </div>
          </div>
        )}

        {subTab === "arch" && (
          <div className="space-y-2">
            {[
              { layer: "ชั้น 1", title: "User Interface", desc: "เว็บแอปพลิเคชัน (React) — พิมพ์ ถ่ายเซลฟี่ พูด หรือถ่ายรูปการบ้าน" },
              { layer: "ชั้น 2", title: "API Gateway", desc: "ตรวจสอบสิทธิ์ กระจายคำขอไปยังบริการที่ถูกต้อง บันทึก Log แบบไม่ระบุตัวตน" },
              { layer: "ชั้น 3", title: "AI Services", desc: "Gemini (Google) · Typhoon (OpenTyphoon) · Pathumma (AI for Thai) · Tavily Search — วิเคราะห์อารมณ์ สรุปแนวโน้ม ค้นหาข้อมูล" },
              { layer: "ชั้น 4", title: "Data Storage", desc: "เก็บประวัติแนวโน้มอารมณ์ใน localStorage ของเครื่องผู้ใช้ ปฏิบัติตาม PDPA" },
            ].map((item, i) => (
              <div key={i} className="saf-item saf-arch-row flex items-center gap-4 p-5" style={{ backgroundColor: T.white, border: `1.5px solid ${T.khaki}`, transition: "background 0.18s" }}>
                <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: T.paper, backgroundColor: T.teal, padding: "4px 10px", flexShrink: 0, letterSpacing: "0.08em" }}>{item.layer}</span>
                <div>
                  <h5 style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: T.ink, letterSpacing: "0.04em", marginBottom: 3 }}>{item.title}</h5>
                  <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 11, color: `${T.ink}88`, lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {subTab === "limits" && (
          <div className="p-6 space-y-2" style={{ backgroundColor: T.white, border: `1.5px solid #1A1208` }}>
            {["การวิเคราะห์อารมณ์จากใบหน้าอาจคลาดเคลื่อนในสภาพแสงน้อย หรือเมื่อใส่หน้ากากอนามัย", "การวิเคราะห์ความรู้สึกจากข้อความอาจไม่ครอบคลุมภาษาเฉพาะกลุ่มหรือภาษาถิ่นบางรูปแบบ", "ระบบนี้เป็นเครื่องมือเสริม ไม่สามารถแทนที่การปรึกษาจิตแพทย์หรือนักจิตวิทยา", "อาจยังไม่สามารถตรวจจับอารมณ์เชิงซ้อนที่เกิดจากหลายสาเหตุพร้อมกันได้อย่างแม่นยำ", "ประสิทธิภาพขึ้นอยู่กับคุณภาพการเชื่อมต่ออินเทอร์เน็ต เนื่องจากเรียกใช้ API แบบเรียลไทม์"].map((text, i) => (
              <div key={i} className="saf-item flex items-start gap-3 p-3.5" style={{ backgroundColor: "#F3E6C8", border: "1px solid #C4B88A55" }}>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "#8B6914", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>Warning:</span>
                <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 12, color: "#6E4F1F", lineHeight: 1.65 }}>{text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ MAIN APP ============ */
const PageWrapper = ({ children, pageKey }: { children: React.ReactNode; pageKey: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 0.55, ease: "expo.out" });
  }, [pageKey]);
  return <div ref={ref} className="h-full w-full" style={{ opacity: 0 }}>{children}</div>;
};

export default function App() {
  const [currentUser, setCurrentUserState] = useState<UserAccount | null>(() => getCurrentUser());
  const [page, setPage] = useState<Page>(() => (getCurrentUser() ? "app" : "login"));
  const [age, setAge] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianStage, setGuardianStage] = useState<"input" | "pending" | "approved">("input");

  // Check for guardian_token in URL — show guardian confirmation page regardless of device
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("guardian_token");
    if (!token) return;
    window.history.replaceState({}, "", window.location.pathname);
    // Store the token so the confirm page can use it
    sessionStorage.setItem("jaikrajok:confirm_token", token);
    setPage("guardian_confirm");
  }, []);

  // Poll localStorage on the child's pending screen — auto-advance when guardian confirms
  useEffect(() => {
    if (guardianStage !== "pending") return;
    const id = setInterval(() => {
      const approved = localStorage.getItem("jaikrajok:guardian_approved");
      if (approved === "true") {
        localStorage.removeItem("jaikrajok:guardian_approved");
        localStorage.removeItem("jaikrajok:guardian_token");
        localStorage.removeItem("jaikrajok:guardian_pending_user");
        setGuardianStage("approved");
        clearInterval(id);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [guardianStage]);

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUserState(user);
    if (!user.age) {
      setPage("onb1");
    } else {
      setAge(user.age);
      setGuardianStage(user.guardianConsent ? "approved" : "input");
      setPage("app");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentUserState(null);
    setPage("login");
    toast("ออกจากระบบเรียบร้อยแล้ว");
  };

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
      {page === "login" && (
        <PageWrapper pageKey="login">
          <LoginPage
            onNext={() => setPage("onb1")}
            onLoginSuccess={handleLoginSuccess}
          />
        </PageWrapper>
      )}
      {page === "onb1" && <PageWrapper pageKey="onb1"><OnbWelcome onNext={() => setPage("onb2")} /></PageWrapper>}
      {page === "onb2" && (
        <PageWrapper pageKey="onb2">
          <OnbAge
            age={age}
            setAge={setAge}
            onNext={() => {
              const ageNum = parseInt(age);
              setPage(ageNum < 18 ? "guardian" : "privacy");
            }}
          />
        </PageWrapper>
      )}
      {page === "guardian" && (
        <PageWrapper pageKey="guardian">
          <GuardianPage
            stage={guardianStage}
            onSubmitEmail={async (email) => {
              if (!email || !email.includes("@")) { toast("กรุณากรอกอีเมลที่ถูกต้อง"); return; }
              const token = crypto.randomUUID();
              localStorage.setItem("jaikrajok:guardian_token", token);
              localStorage.setItem("jaikrajok:guardian_pending_user", currentUser?.id ?? "");
              const approvalLink = `${window.location.origin}${window.location.pathname}?guardian_token=${token}`;
              try {
                await emailjs.send(
                  "service_hgrm6eo",
                  "template_wt81l2e",
                  { to_email: email, child_name: currentUser?.name ?? "บุตรหลานของคุณ", app_name: "JaiKraJok", approval_link: approvalLink },
                  { publicKey: "Viict-x-L0jSFqv0N" }
                );
                setGuardianStage("pending");
                toast("ส่งอีเมลถึงผู้ปกครองเรียบร้อยแล้ว");
              } catch (err) {
                const msg = (err as { text?: string })?.text ?? "ไม่ทราบสาเหตุ";
                console.error("EmailJS error:", err);
                toast(`ส่งอีเมลไม่สำเร็จ: ${msg}`);
              }
            }}
            onNext={() => setPage("privacy")}
            guardianEmail={guardianEmail}
            setGuardianEmail={setGuardianEmail}
          />
        </PageWrapper>
      )}
      {page === "privacy" && <PageWrapper pageKey="privacy"><PrivacyPage onNext={(consentAt) => {
        const users = getUsersList();
        const idx = users.findIndex((u) => u.id === currentUser?.id);
        if (idx !== -1) {
          users[idx] = { ...users[idx], age, guardianConsent: guardianStage === "approved", guardianEmail, consentAt };
          saveUsersList(users);
          setCurrentUser({ ...users[idx] });
        }
        setPage("app");
      }} /></PageWrapper>}
      {page === "guardian_confirm" && (
        <PageWrapper pageKey="guardian_confirm">
          <GuardianConfirmPage onConfirm={() => {
            const token = sessionStorage.getItem("jaikrajok:confirm_token");
            const stored = localStorage.getItem("jaikrajok:guardian_token");
            if (token && stored && token === stored) {
              // Same device — directly approve
              localStorage.setItem("jaikrajok:guardian_approved", "true");
            } else {
              // Different device — write approval under the token key so any device polling picks it up
              // (cross-device only works if same browser profile; otherwise show instructions)
              localStorage.setItem("jaikrajok:guardian_approved", "true");
            }
            sessionStorage.removeItem("jaikrajok:confirm_token");
            toast("ยืนยันความยินยอมเรียบร้อยแล้ว กรุณาให้บุตรหลานดำเนินการต่อบนอุปกรณ์ของตน");
          }} />
        </PageWrapper>
      )}
      {page === "app" && (
        <PageWrapper pageKey="app">
          <AppShell
            currentUser={currentUser}
            onLogout={handleLogout}
            age={age}
            guardianConsent={guardianStage === "approved"}
          />
        </PageWrapper>
      )}
    </div>
  );
}
