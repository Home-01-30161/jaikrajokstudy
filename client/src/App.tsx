import { useState, useRef, useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

/* ============ IMAGE PATHS ============ */
const IMG = {
  loginCollage: "/collage/login_collage_ffaf73f0.png",
  handPen: "/collage/hand_pen_b35a681f.png",
  origamiStars: "/collage/origami_stars_0584c42e.png",
  megaphone: "/collage/megaphone_halftone_f526c4ce.png",
  booksStack: "/collage/books_stack_435c2b81.png",
  chatBubbles: "/collage/chat_bubbles_77801543.png",
  chartGraph: "/collage/chart_graph_a92a34b6.png",
  schoolBuilding: "/collage/school_building_8cd04dbb.png",
  shieldLock: "/collage/shield_lock_6bc87c75.png",
};

/* ============ EMOJI / MOOD DATA ============ */
interface MoodInfo {
  label: string;
  emoji: string;
  valence: number; // 0 (stressed) to 1 (positive)
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
    color: "#E05555",
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
    color: "#2D6A6F",
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
    color: "#2D6A6F",
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
    color: "#2D6A6F",
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
function CheckerStrip() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex overflow-hidden" style={{ height: "40px" }}>
      {Array.from({ length: 26 }).map((_, i) => (
        <div key={i} style={{ flex: 1, background: i % 2 === 0 ? "#1a1a1a" : "#f5f0e8" }} />
      ))}
    </div>
  );
}

/* ============ GRID BACKGROUND ============ */
function GridBg({ showDots = false }: { showDots?: boolean }) {
  return (
    <>
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(rgba(160,150,130,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(160,150,130,0.12) 1px, transparent 1px)
          `,
          backgroundSize: "28px 28px",
          backgroundColor: "#f5f0e8",
        }}
      />
      {showDots && (
        <div
          className="fixed left-0 top-0 bottom-0 z-0 pointer-events-none opacity-20"
          style={{
            width: "32%",
            backgroundImage: `radial-gradient(circle, rgba(80,80,80,0.5) 2.5px, transparent 2.5px)`,
            backgroundSize: "22px 22px",
          }}
        />
      )}
    </>
  );
}

/* ============ BRAIN CLOUD SVG ============ */
function BrainCloud({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute pointer-events-none ${className}`}>
      <svg viewBox="0 0 200 160" width="200" height="160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="brainBlur">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <clipPath id="brainClip">
            <ellipse cx="100" cy="80" rx="85" ry="65" />
          </clipPath>
        </defs>
        <g clipPath="url(#brainClip)" filter="url(#brainBlur)">
          {Array.from({ length: 12 }).map((_, row) =>
            Array.from({ length: 16 }).map((_, col) => {
              const x = col * 13 + 5;
              const y = row * 13 + 5;
              const dist = Math.sqrt((x - 100) ** 2 + (y - 80) ** 2);
              const r = Math.max(0, 5.5 - dist * 0.045);
              return r >= 0.5 ? <circle key={`${row}-${col}`} cx={x} cy={y} r={r} fill="#555" opacity="0.85" /> : null;
            })
          )}
        </g>
      </svg>
    </div>
  );
}

/* ============ RED DOT CROSS ============ */
function RedDotCross({ className = "" }: { className?: string }) {
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
        ].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="3" fill="#C41E3A" opacity="0.85" />)}
      </svg>
    </div>
  );
}

/* ============ LOGIN PAGE ============ */
function LoginPage({ onNext }: { onNext: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: "#f5f0e8" }}>
      <CheckerStrip />
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(rgba(160,150,130,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(160,150,130,0.12) 1px, transparent 1px)
          `,
          backgroundSize: "28px 28px",
          backgroundColor: "#f5f0e8",
        }}
      />
      <div className="absolute left-0 top-10 bottom-0 z-10" style={{ width: "52%" }}>
        <img src={IMG.loginCollage} alt="" className="w-full h-full object-cover object-left-top" />
      </div>
      <div className="absolute bottom-0 left-0 z-20" style={{ width: "52%", height: "55%" }}>
        <svg viewBox="0 0 520 420" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0,160 C80,120 180,60 340,20 C420,0 520,0 520,0 L520,420 L0,420 Z" fill="#1a1a1a" />
        </svg>
      </div>

      <div className="absolute right-0 top-10 bottom-0 z-30 flex items-center justify-center px-10" style={{ width: "50%" }}>
        <div
          className="w-full relative"
          style={{
            maxWidth: "400px",
            background: "linear-gradient(150deg, #FBCFCA 0%, #FCD5CF 50%, #FDDDD9 100%)",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
          }}
        >
          <p className="text-xl font-semibold mb-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>Welcome To</p>
          <h1 className="text-5xl font-black mb-5" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#C41E3A", lineHeight: 1.1 }}>JaiKraJok</h1>

          <div className="flex mb-5 rounded-2xl overflow-hidden" style={{ border: "1.5px solid rgba(26,26,26,0.1)", background: "rgba(255,255,255,0.6)" }}>
            <button
              onClick={() => setMode("login")}
              className="flex-1 py-2.5 text-sm font-semibold transition-all"
              style={{
                background: mode === "login" ? "#ffffff" : "transparent",
                color: "#1a1a1a",
                fontFamily: "'Noto Sans Thai', sans-serif",
                borderRight: "1.5px solid rgba(26,26,26,0.1)",
              }}
            >
              Log In
            </button>
            <button
              onClick={() => setMode("signup")}
              className="flex-1 py-2.5 text-sm font-semibold transition-all"
              style={{
                background: mode === "signup" ? "#ffffff" : "transparent",
                color: "#1a1a1a",
                fontFamily: "'Noto Sans Thai', sans-serif",
              }}
            >
              Sign Up
            </button>
          </div>

          <label className="block text-base font-bold mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#C41E3A" }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl outline-none mb-4"
            style={{ backgroundColor: "rgba(255,255,255,0.75)", border: "none", fontFamily: "'Noto Sans Thai', sans-serif", fontSize: "15px", color: "#1a1a1a" }}
          />

          <label className="block text-base font-bold mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#C41E3A" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl outline-none mb-4"
            style={{ backgroundColor: "rgba(255,255,255,0.75)", border: "none", fontFamily: "'Noto Sans Thai', sans-serif", fontSize: "15px", color: "#1a1a1a" }}
          />

          <button
            onClick={() => {
              if (!email || !password) { toast("กรุณากรอกข้อมูลให้ครบ"); return; }
              onNext();
            }}
            className="w-full py-3.5 rounded-full font-bold text-white text-base mb-3 transition-all active:scale-[0.97]"
            style={{ backgroundColor: "#E05555", fontFamily: "'Noto Sans Thai', sans-serif", boxShadow: "0 2px 12px rgba(224,85,85,0.3)" }}
          >
            {mode === "login" ? "Log In" : "Sign Up"}
          </button>

          <p className="text-center text-sm font-medium mb-3" style={{ color: "#1a1a1a", fontFamily: "'Noto Sans Thai', sans-serif" }}>or</p>

          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full py-3 rounded-full font-semibold text-base mb-4 transition-all active:scale-[0.97]"
            style={{ backgroundColor: "#ffffff", color: "#1a1a1a", fontFamily: "'Noto Sans Thai', sans-serif", border: "1.5px solid rgba(26,26,26,0.15)" }}
          >
            {mode === "login" ? "Sign Up" : "Log In"}
          </button>

          <button
            className="w-full py-3.5 rounded-full font-bold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{ backgroundColor: "#E05555", fontFamily: "'Noto Sans Thai', sans-serif", boxShadow: "0 2px 12px rgba(224,85,85,0.25)" }}
            onClick={() => toast("ฟีเจอร์ Google Login กำลังพัฒนา")}
          >
            Log In With Google
            <svg width="22" height="22" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="24" fill="white" />
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 right-0 z-40 pointer-events-none" style={{ width: "220px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto" />
      </div>
    </div>
  );
}

/* ============ ONBOARDING STEP 1: WELCOME ============ */
function OnbWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f0e8" }}>
      <GridBg showDots />
      <BrainCloud className="top-8 right-[28%] z-10" />
      <RedDotCross className="top-12 right-10 z-10" />
      <div className="fixed bottom-0 right-0 z-20 pointer-events-none" style={{ width: "220px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto" />
      </div>

      <div
        className="relative z-10 mx-auto"
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          padding: "40px 44px",
          maxWidth: "560px",
          width: "100%",
          marginLeft: "32%",
          marginRight: "8%",
          boxShadow: "0 4px 30px rgba(0,0,0,0.06)",
          border: "1.5px solid rgba(200,195,185,0.5)",
        }}
      >
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm mb-6"
          style={{ border: "1.5px solid #2D6A6F", color: "#2D6A6F", fontFamily: "'Space Mono', monospace", fontSize: "12px", backgroundColor: "rgba(45,106,111,0.06)" }}
        >
          AI for Thai · Pathumma LLM
        </div>

        <h1 className="font-black mb-3 leading-tight" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a", fontSize: "32px" }}>
          กระจกสะท้อนใจ<br />พื้นที่ปลอดภัยให้ใจได้มองเห็นตัวเอง
        </h1>

        <p className="mb-8 leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666", fontSize: "15px" }}>
          ผู้ช่วยเรียนรู้เท่าทันอารมณ์สำหรับนักเรียนมัธยมปลาย พูดคุย ถ่ายรูป หรือพูดระบายได้ตามที่ถนัด กระจกจะช่วยสะท้อนสภาวะใจและให้คำแนะนำเฉพาะบุคคล ก่อนเริ่มใช้งาน ขอทราบข้อมูลเล็กน้อยเพื่อดูแลความปลอดภัยของคุณ
        </p>

        <div className="flex justify-end">
          <button
            onClick={onNext}
            className="px-8 py-3 rounded-full text-white font-bold transition-all active:scale-[0.97]"
            style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif", fontSize: "16px" }}
          >
            เริ่มต้นใช้งาน
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ ONBOARDING STEP 2: AGE ============ */
function OnbAge({ onNext, age, setAge }: { onNext: () => void; age: string; setAge: (v: string) => void }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f0e8" }}>
      <GridBg showDots />
      <BrainCloud className="top-8 right-[28%] z-10" />
      <div className="absolute bottom-10 left-[38%] z-10 pointer-events-none opacity-60" style={{ width: "120px" }}>
        <img src={IMG.origamiStars} alt="" className="w-full h-auto" style={{ filter: "grayscale(0.3) contrast(1.1)" }} />
      </div>
      <div className="fixed bottom-0 right-0 z-20 pointer-events-none" style={{ width: "220px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto" />
      </div>

      <div
        className="relative z-10"
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          padding: "40px 44px",
          maxWidth: "560px",
          width: "100%",
          marginLeft: "32%",
          marginRight: "8%",
          boxShadow: "0 4px 30px rgba(0,0,0,0.06)",
          border: "1.5px solid rgba(200,195,185,0.5)",
        }}
      >
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm mb-6"
          style={{ border: "1.5px solid #2D6A6F", color: "#2D6A6F", fontFamily: "'Space Mono', monospace", fontSize: "12px", backgroundColor: "rgba(45,106,111,0.06)" }}
        >
          ขั้นตอน 1 จาก 3
        </div>

        <h1 className="font-black mb-2 underline" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a", fontSize: "28px" }}>
          ขอทราบอายุของคุณ
        </h1>

        <p className="mb-6" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666", fontSize: "14px" }}>
          เพื่อให้กระจกดูแลความยินยอมและความปลอดภัยได้ถูกต้องตาม PDPA
        </p>

        <label className="block text-sm mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#555" }}>อายุ (ปี)</label>
        <input
          type="number"
          placeholder="เช่น 16"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="w-full px-5 py-3.5 rounded-2xl outline-none mb-6 text-base"
          style={{ backgroundColor: "#f5f0e8", border: "1.5px solid #e0d8cc", fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}
        />

        <div className="flex justify-end">
          <button
            onClick={() => {
              if (!age || parseInt(age) < 1 || parseInt(age) > 99) {
                toast("กรุณากรอกอายุที่ถูกต้อง");
                return;
              }
              onNext();
            }}
            className="px-8 py-3 rounded-full text-white font-bold transition-all active:scale-[0.97]"
            style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif", fontSize: "16px" }}
          >
            ถัดไป
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ GUARDIAN CONSENT ============ */
function GuardianPage({
  approved, onSend, onNext, guardianEmail, setGuardianEmail,
}: {
  approved: boolean;
  onSend: () => void;
  onNext: () => void;
  guardianEmail: string;
  setGuardianEmail: (v: string) => void;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f0e8" }}>
      <GridBg showDots />
      <BrainCloud className="top-8 right-[28%] z-10" />
      <div className="fixed bottom-0 right-0 z-20 pointer-events-none" style={{ width: "220px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto" />
      </div>

      <div
        className="relative z-10"
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          padding: "40px 44px",
          maxWidth: "560px",
          width: "100%",
          marginLeft: "32%",
          marginRight: "8%",
          boxShadow: "0 4px 30px rgba(0,0,0,0.06)",
          border: "1.5px solid rgba(200,195,185,0.5)",
        }}
      >
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm mb-5"
          style={{ border: "1.5px solid #2D6A6F", color: "#2D6A6F", fontFamily: "'Space Mono', monospace", fontSize: "12px", backgroundColor: "rgba(45,106,111,0.06)" }}
        >
          ต้องได้รับความยินยอมจากผู้ปกครอง
        </div>

        <h1 className="font-black mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a", fontSize: "28px" }}>
          ผู้ใช้อายุต่ำกว่า 13 ปี
        </h1>

        <p className="mb-6" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666", fontSize: "14px", lineHeight: 1.7 }}>
          ระบบต้องได้รับความยินยอมจากผู้ปกครองก่อนเริ่มเก็บข้อมูลใดๆ กรุณากรอกอีเมลผู้ปกครองเพื่อส่งคำขอความยินยอม
        </p>

        {approved ? (
          <>
            <div className="w-full px-5 py-3.5 rounded-2xl mb-6" style={{ backgroundColor: "#e8f0ee", border: "1.5px solid #b5d0cc", fontFamily: "'Noto Sans Thai', sans-serif", color: "#2D6A6F", fontSize: "15px" }}>
              ✓ ผู้ปกครองให้ความยินยอมแล้ว
            </div>
            <div className="flex justify-end">
              <button
                onClick={onNext}
                className="px-8 py-3 rounded-full text-white font-bold transition-all active:scale-[0.97]"
                style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif", fontSize: "16px" }}
              >
                ถัดไป
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block text-sm mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#555" }}>อีเมลผู้ปกครอง</label>
            <input
              type="email"
              placeholder="parent@email.com"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              className="w-full px-5 py-3.5 rounded-2xl outline-none mb-6 text-base"
              style={{ backgroundColor: "#f5f0e8", border: "1.5px solid #e0d8cc", fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}
            />
            <div className="flex justify-end">
              <button
                onClick={onSend}
                className="px-8 py-3 rounded-full text-white font-bold transition-all active:scale-[0.97]"
                style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif", fontSize: "16px" }}
              >
                ส่งคำขอความยินยอม
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============ PRIVACY / FINAL STEP ============ */
function PrivacyPage({ onNext }: { onNext: () => void }) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="relative min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f0e8" }}>
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(rgba(160,150,130,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(160,150,130,0.12) 1px, transparent 1px)
          `,
          backgroundSize: "28px 28px",
          backgroundColor: "#f5f0e8",
        }}
      />
      <BrainCloud className="top-8 left-1/2 z-10" />
      <div className="absolute bottom-0 left-10 z-10 pointer-events-none" style={{ width: "200px" }}>
        <img src={IMG.megaphone} alt="" className="w-full h-auto" />
      </div>
      <div className="fixed bottom-0 right-0 z-20 pointer-events-none" style={{ width: "220px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto" />
      </div>

      <div
        className="relative z-10"
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          padding: "40px 44px",
          maxWidth: "560px",
          width: "100%",
          margin: "0 auto",
          boxShadow: "0 4px 30px rgba(0,0,0,0.06)",
          border: "1.5px solid rgba(200,195,185,0.5)",
        }}
      >
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm mb-5"
          style={{ border: "1.5px solid #2D6A6F", color: "#2D6A6F", fontFamily: "'Space Mono', monospace", fontSize: "12px", backgroundColor: "rgba(45,106,111,0.06)" }}
        >
          ขั้นตอนสุดท้าย
        </div>

        <h1 className="font-black mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a", fontSize: "28px" }}>
          ความเป็นส่วนตัวของคุณ
        </h1>

        <p className="mb-5" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666", fontSize: "14px" }}>
          ก่อนเริ่ม อยากให้ทราบสั้นๆ ว่า:
        </p>

        <ul className="mb-6 space-y-2">
          {[
            "ภาพใบหน้าประมวลผลแบบเรียลไทม์ ไม่ถูกจัดเก็บลงเซิร์ฟเวอร์",
            "ข้อมูลแนวโน้มอารมณ์จัดเก็บแบบไม่ระบุตัวตน เข้ารหัส AES-256",
            "กระจกไม่วินิจฉัยโรคทางจิตเวช และจะแนะนำผู้เชี่ยวชาญเมื่อจำเป็น",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#444" }}>
              <span style={{ color: "#2D6A6F", fontWeight: 700 }}>•</span>
              {item}
            </li>
          ))}
        </ul>

        <label className="flex items-center gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={() => setAccepted(!accepted)}
            className="w-5 h-5 rounded accent-[#2D6A6F]"
          />
          <span className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#444" }}>
            ฉันเข้าใจและยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว
          </span>
        </label>

        <button
          onClick={() => {
            if (!accepted) { toast("กรุณายอมรับเงื่อนไขก่อนใช้งาน"); return; }
            onNext();
          }}
          className="w-full py-3.5 rounded-full font-bold text-base transition-all active:scale-[0.97]"
          style={{
            backgroundColor: accepted ? "#2D6A6F" : "#b0c4c5",
            color: "white",
            fontFamily: "'Noto Sans Thai', sans-serif",
            cursor: accepted ? "pointer" : "default",
          }}
        >
          เข้าสู่กระจกสะท้อนใจ
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

  // Chat & Mood state
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

  // Analytics & History state
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [concernStreak, setConcernStreak] = useState(0);
  const [modesUsed, setModesUsed] = useState<Set<string>>(new Set());
  const [transparencyLogs, setTransparencyLogs] = useState<string[]>([]);

  // Escalation Modal
  const [showEscalationModal, setShowEscalationModal] = useState(false);

  // Audio Speech synthesis
  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) {
      toast("เบราว์เซอร์นี้ไม่รองรับ Text-to-Speech");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    u.rate = 0.98;
    window.speechSynthesis.speak(u);
    toast("🔊 กำลังอ่านข้อความเสียง...");
  };

  // Push trend point
  const pushTrend = useCallback((key: string, sourceLabel: string) => {
    const info = EMO[key] || EMO.neutral;
    setMood(key);

    setTrendData((prev) => {
      const nextId = prev.length > 0 ? prev[prev.length - 1].id + 1 : 1;
      const nextArr = [...prev, { id: nextId, valence: info.valence, color: info.color, key, label: info.label }];
      return nextArr.slice(-9); // keep last 9 points
    });

    const nowStr = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    setLogEntries((prev) => [
      { id: Math.random().toString(), time: nowStr, label: info.label, source: sourceLabel, key },
      ...prev.slice(0, 19),
    ]);

    // Concern check
    setConcernStreak((prevStreak) => {
      const newStreak = info.concern ? prevStreak + 1 : 0;
      if (newStreak >= 3) {
        setTimeout(() => setShowEscalationModal(true), 1200);
      }
      return newStreak;
    });
  }, []);

  // Note Multimodal
  const noteMultimodal = useCallback((sourceLabel: string) => {
    setModesUsed((prev) => {
      const nextSet = new Set(prev).add(sourceLabel);
      if (nextSet.size === 2 && !prev.has(sourceLabel)) {
        setTimeout(() => {
          setMessages((msgs) => [
            ...msgs,
            {
              id: Math.random().toString(),
              role: "system",
              text: `Pathumma LLM กำลังรวมข้อมูลจากหลายแหล่ง (${Array.from(nextSet).join(" + ")}) เพื่อให้คำแนะนำที่แม่นยำขึ้น`,
              timestamp: Date.now(),
            },
          ]);
        }, 600);
      }
      return nextSet;
    });

    const transNote = TRANSPARENCY[sourceLabel] || "กำลังวิเคราะห์ข้อมูลด้วย Pathumma LLM";
    setTransparencyLogs((prev) => [transNote, ...prev.slice(0, 4)]);
  }, []);

  // Emotion Keyword Detector
  const detectEmotion = (text: string) => {
    const t = text.toLowerCase();
    const scores: Record<string, number> = {};
    for (const key in KEYWORDS) {
      scores[key] = KEYWORDS[key].reduce((acc, word) => acc + (t.includes(word) ? 1 : 0), 0);
    }
    let bestKey = "neutral";
    let bestScore = 0;
    for (const key in scores) {
      if (scores[key] > bestScore) {
        bestKey = key;
        bestScore = scores[key];
      }
    }
    return bestScore === 0 ? "neutral" : bestKey;
  };

  // Send User Message
  const sendMessage = useCallback((overrideText?: string, sourceLabel: string = "ข้อความ") => {
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    if (!textToSend.trim()) return;

    if (overrideText === undefined) {
      setInputText("");
    }

    const userMsg: ChatMsg = {
      id: Math.random().toString(),
      role: "user",
      text: textToSend,
      timestamp: Date.now(),
      sourceTag: sourceLabel !== "ข้อความ" ? sourceLabel : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    noteMultimodal(sourceLabel);
    setIsAnalyzing(true);

    const key = detectEmotion(textToSend);

    setTimeout(() => {
      const list = RESPONSES[key] || RESPONSES.neutral;
      const replyText = list[Math.floor(Math.random() * list.length)];

      const botMsg: ChatMsg = {
        id: Math.random().toString(),
        role: "bot",
        text: replyText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsAnalyzing(false);
      pushTrend(key, sourceLabel);
    }, 1000);
  }, [inputText, noteMultimodal, pushTrend]);

  // Selfie Handler
  const handleSelfie = () => {
    const userMsg: ChatMsg = {
      id: Math.random().toString(),
      role: "user",
      text: "📷 ถ่ายเซลฟี่เพื่อวิเคราะห์สีหน้า",
      timestamp: Date.now(),
      sourceTag: "เซลฟี่",
    };
    setMessages((prev) => [...prev, userMsg]);
    noteMultimodal("เซลฟี่");
    setIsAnalyzing(true);

    setTimeout(() => {
      const key = SELFIE_RESULTS[Math.floor(Math.random() * SELFIE_RESULTS.length)];
      const info = EMO[key];
      const note = SELFIE_NOTES[key];

      const emotionCardMsg: ChatMsg = {
        id: Math.random().toString(),
        role: "bot",
        text: note,
        timestamp: Date.now(),
        cardType: "emotion",
        emotionData: {
          label: info.label,
          note,
          color: info.color,
          bg: info.bg,
          text: info.text,
        },
      };

      setMessages((prev) => [...prev, emotionCardMsg]);
      setIsAnalyzing(false);
      pushTrend(key, "เซลฟี่");

      // Follow up response
      setTimeout(() => {
        const list = RESPONSES[key];
        const replyText = list[Math.floor(Math.random() * list.length)];
        setMessages((prev) => [
          ...prev,
          { id: Math.random().toString(), role: "bot", text: replyText, timestamp: Date.now() },
        ]);
      }, 700);
    }, 1200);
  };

  // Voice Handler
  const handleVoice = () => {
    const samples = [
      "วันนี้เหนื่อยมากเลย อ่านหนังสือทั้งวัน",
      "พรุ่งนี้สอบแล้วรู้สึกกังวลนิดหน่อย",
      "วันนี้โอเคดี สบายใจ",
      "เครียดมาก ทำโจทย์ไม่ได้เลย",
    ];
    const s = samples[Math.floor(Math.random() * samples.length)];
    sendMessage(`🎤 (เสียงพูด): "${s}"`, "เสียงพูด");
  };

  // Photo Homework OCR Handler
  const handleHomeworkPhoto = () => {
    const userMsg: ChatMsg = {
      id: Math.random().toString(),
      role: "user",
      text: "🖼️ แนบรูปถ่ายการบ้าน (Homework.jpg)",
      timestamp: Date.now(),
      sourceTag: "รูปการบ้าน",
    };
    setMessages((prev) => [...prev, userMsg]);
    noteMultimodal("รูปการบ้าน");
    setIsAnalyzing(true);

    setTimeout(() => {
      const ocrMsg: ChatMsg = {
        id: Math.random().toString(),
        role: "bot",
        text: "อ่านโจทย์สมการเชิงเส้นเรียบร้อยแล้ว",
        timestamp: Date.now(),
        cardType: "ocr",
        ocrText: '"...จงหาค่า x จากสมการ 2x + 5 = 17 พร้อมแสดงวิธีทำ..."',
      };

      const botExplainMsg: ChatMsg = {
        id: Math.random().toString(),
        role: "bot",
        text: "กระจกอ่านโจทย์แล้วนะ ดูเหมือนเป็นโจทย์สมการเชิงเส้น ลองบอกกระจกได้ไหมว่าติดขั้นตอนไหนอยู่ จะได้ช่วยอธิบายเป็นข้อๆ ให้",
        timestamp: Date.now() + 50,
      };

      setMessages((prev) => [...prev, ocrMsg, botExplainMsg]);
      setIsAnalyzing(false);
      pushTrend("neutral", "รูปการบ้าน");
    }, 1300);
  };

  // Reset Chat
  const resetChat = () => {
    setMessages([
      {
        id: "init_" + Date.now(),
        role: "bot",
        text: "สวัสดีค่ะ วันนี้อยากเล่าอะไรให้กระจกฟังไหม จะพิมพ์ พูด ถ่ายเซลฟี่ หรือถ่ายรูปการบ้านก็ได้นะ",
        timestamp: Date.now(),
      },
    ]);
    setTrendData([]);
    setLogEntries([]);
    setConcernStreak(0);
    setModesUsed(new Set());
    setTransparencyLogs([]);
    setMood("calm");
    toast("เริ่มการสนทนาใหม่แล้ว");
  };

  // Try Mode helper from Home view
  const tryMode = (mode: "camera" | "keyboard" | "mic" | "photo") => {
    setCurrentView("chat");
    setTimeout(() => {
      if (mode === "camera") handleSelfie();
      else if (mode === "mic") handleVoice();
      else if (mode === "photo") handleHomeworkPhoto();
    }, 300);
  };

  const navItems: { id: AppView; label: string; img: string }[] = [
    { id: "home", label: "หน้าหลัก", img: IMG.booksStack },
    { id: "chat", label: "แชท", img: IMG.chatBubbles },
    { id: "trend", label: "แนวโน้มของฉัน", img: IMG.chartGraph },
    { id: "school", label: "ภาพรวมโรงเรียน", img: IMG.schoolBuilding },
    { id: "safety", label: "ความปลอดภัย & ข้อมูล", img: IMG.shieldLock },
  ];

  const pageLabel: Record<AppView, string> = {
    home: "หน้าหลัก",
    chat: "คุยกับกระจก",
    trend: "แนวโน้มของฉัน",
    school: "ภาพรวมโรงเรียน",
    safety: "ความปลอดภัย & ข้อมูล",
  };

  return (
    <div className="relative min-h-screen flex" style={{ backgroundColor: "#f5f0e8" }}>
      <CheckerStrip />
      <GridBg />

      {/* LEFT SIDEBAR (BLACK CURVED) */}
      <div className="fixed left-0 top-10 bottom-0 z-30 flex flex-col" style={{ width: "260px" }}>
        <div className="relative flex-1 flex flex-col">
          <div className="absolute inset-0" style={{ backgroundColor: "#1a1a1a", borderRadius: "0 40px 40px 0" }} />
          <div className="relative z-10 flex flex-col h-full px-5 pt-7 pb-5">
            <div className="mb-8 px-1">
              <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Playfair Display', serif", color: "#FFB5A7" }}>
                JaiKraJok
              </h1>
              <p className="text-xs mt-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "rgba(255,181,167,0.6)" }}>
                กระจกสะท้อนใจ
              </p>
            </div>

            <nav className="flex-1 space-y-1.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all duration-200"
                  style={{
                    backgroundColor: currentView === item.id ? "#FFB5A7" : "transparent",
                    color: currentView === item.id ? "#1a1a1a" : "rgba(255,255,255,0.7)",
                    fontFamily: "'Noto Sans Thai', sans-serif",
                    fontWeight: currentView === item.id ? 700 : 400,
                    fontSize: "14px",
                    border: currentView === item.id ? "none" : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="w-7 h-7 rounded-xl overflow-hidden flex-shrink-0">
                    <img
                      src={item.img}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ filter: currentView === item.id ? "none" : "grayscale(1) brightness(0.7)" }}
                    />
                  </div>
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="mt-auto px-1">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Noto Sans Thai', sans-serif" }}>
                  สภาวะล่าสุด
                </p>
                <p className="text-sm font-bold flex items-center gap-2" style={{ color: "#FFB5A7", fontFamily: "'Noto Sans Thai', sans-serif" }}>
                  <span>{EMO[mood]?.emoji}</span>
                  {EMO[mood]?.label || "ปกติ"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="ml-[260px] flex-1 min-h-screen pt-10">
        <div
          className="inline-block px-6 py-2 text-sm font-semibold mb-0 shadow-sm"
          style={{
            backgroundColor: "#FFB5A7",
            color: "#1a1a1a",
            fontFamily: "'Noto Sans Thai', sans-serif",
            borderRadius: "0 0 16px 0",
          }}
        >
          {pageLabel[currentView]}
        </div>

        <div className="px-8 py-6">
          {currentView === "home" && (
            <HomeView
              mood={mood}
              setMood={setMood}
              onGoChat={() => setCurrentView("chat")}
              onGoTrend={() => setCurrentView("trend")}
              tryMode={tryMode}
              lineNotify={lineNotify}
              setLineNotify={setLineNotify}
            />
          )}

          {currentView === "chat" && (
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
          )}

          {currentView === "trend" && (
            <TrendView
              trendData={trendData}
              logEntries={logEntries}
              onDeleteEntry={(id) => {
                setLogEntries((prev) => prev.filter((e) => e.id !== id));
                toast("ลบรายการแล้ว");
              }}
              onClearAll={() => {
                if (window.confirm("ยืนยันลบข้อมูลแนวโน้มอารมณ์ทั้งหมดของคุณ?")) {
                  setTrendData([]);
                  setLogEntries([]);
                  setConcernStreak(0);
                  toast("ลบข้อมูลทั้งหมดเรียบร้อยแล้ว");
                }
              }}
              onExport={() => {
                const payload = JSON.stringify({ exportedAt: new Date().toISOString(), trendData, logEntries }, null, 2);
                const blob = new Blob([payload], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "jaikrajok-my-data.json";
                a.click();
                URL.revokeObjectURL(url);
                toast("ส่งออกข้อมูลของฉันเรียบร้อยแล้ว");
              }}
            />
          )}

          {currentView === "school" && <SchoolView />}

          {currentView === "safety" && (
            <SafetyView
              age={age}
              guardianConsent={guardianConsent}
              onExport={() => {
                const payload = JSON.stringify({ exportedAt: new Date().toISOString(), trendData, logEntries }, null, 2);
                const blob = new Blob([payload], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "jaikrajok-my-data.json";
                a.click();
                URL.revokeObjectURL(url);
                toast("ส่งออกข้อมูลของฉันเรียบร้อยแล้ว");
              }}
              onClearAll={() => {
                if (window.confirm("ยืนยันลบข้อมูลทั้งหมดของคุณ?")) {
                  setTrendData([]);
                  setLogEntries([]);
                  toast("ลบข้อมูลทั้งหมดเรียบร้อยแล้ว");
                }
              }}
            />
          )}
        </div>
      </div>

      {/* ESCALATION MODAL */}
      {showEscalationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-2 border-[#E05555]">
            <div className="text-4xl mb-3">🤝</div>
            <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
              เราสังเกตว่าช่วงนี้ใจคุณหนักอยู่หลายครั้ง
            </h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
              ไม่เป็นไรนะ ความรู้สึกแบบนี้ไม่ผิดเลย กระจกอยากชวนคุณลองพูดคุยกับคนที่ไว้ใจได้ ไม่ว่าจะเป็นครูที่ปรึกษา ผู้ปกครอง หรือสายด่วนสุขภาพจิต 1323
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  toast("แจ้งครูที่ปรึกษาเรียบร้อยแล้ว ครูจะติดต่อกลับภายในวันนี้");
                  setShowEscalationModal(false);
                }}
                className="w-full py-3 rounded-2xl text-white font-bold transition-all active:scale-[0.97]"
                style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}
              >
                แจ้งครูที่ปรึกษา
              </button>
              <a
                href="tel:1323"
                className="block text-center w-full py-3 rounded-2xl font-bold text-[#E05555] border-2 border-[#E05555] hover:bg-[#F1DEE3] transition-all"
                style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
              >
                📞 โทรสายด่วน 1323
              </a>
              <button
                onClick={() => setShowEscalationModal(false)}
                className="w-full py-2.5 rounded-2xl text-gray-500 font-medium text-sm hover:bg-gray-100"
                style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
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
    <div className="space-y-6 max-w-4xl">
      {/* HERO CARD */}
      <div className="p-8 rounded-3xl bg-white border border-[#c8bfb2] shadow-md shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-inner border-2 border-[#2D6A6F]"
            style={{ backgroundColor: EMO[mood]?.bg || "#E3EAE0" }}
          >
            {EMO[mood]?.emoji || "😌"}
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
              {greeting}
            </h2>
            <p className="text-sm mt-1 text-gray-600" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
              วันนี้อยากให้กระจกฟังอะไรบ้าง จะพิมพ์ พูด ถ่ายเซลฟี่ หรือถ่ายรูปการบ้านก็ได้นะ
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onGoChat}
            className="px-6 py-3 rounded-2xl text-white font-bold text-sm shadow-md transition-all active:scale-[0.97]"
            style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}
          >
            💬 เริ่มคุยกับกระจก
          </button>
          <button
            onClick={onGoTrend}
            className="px-5 py-3 rounded-2xl font-semibold text-sm border border-[#c8bfb2] bg-white hover:bg-gray-50 transition-all"
            style={{ color: "#1a1a1a", fontFamily: "'Noto Sans Thai', sans-serif" }}
          >
            📈 ดูแนวโน้มของฉัน
          </button>
        </div>
      </div>

      {/* QUICK MOOD PICKER */}
      <div>
        <h3 className="text-lg font-bold mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          วันนี้รู้สึกยังไง?
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {moods.map(([key, emo]) => (
            <button
              key={key}
              onClick={() => setMood(key)}
              className="p-3.5 rounded-2xl text-center transition-all active:scale-[0.97]"
              style={{
                backgroundColor: mood === key ? "#FFB5A7" : "#ffffff",
                border: mood === key ? "2.5px solid #C41E3A" : "2px solid #e0d8cc",
                fontFamily: "'Noto Sans Thai', sans-serif",
              }}
            >
              <span className="text-3xl block mb-1.5">{emo.emoji}</span>
              <span className="text-xs font-bold block" style={{ color: "#1a1a1a" }}>
                {emo.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4 MODE CARDS */}
      <div>
        <h3 className="text-lg font-bold mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          วิธีระบายความรู้สึก · เลือกวิธีที่ถนัดได้เลย
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              id: "camera" as const,
              title: "ถ่ายเซลฟี่",
              desc: "อ่านสีหน้าและอารมณ์ผ่าน Face Recognition API",
              icon: "📷",
            },
            {
              id: "keyboard" as const,
              title: "พิมพ์ความรู้สึก",
              desc: "วิเคราะห์น้ำเสียงข้อความด้วย Sentiment Analysis API",
              icon: "⌨️",
            },
            {
              id: "mic" as const,
              title: "พูดระบาย",
              desc: "แปลงเสียงพูดเป็นข้อความผ่าน Speech-to-Text API",
              icon: "🎤",
            },
            {
              id: "photo" as const,
              title: "ถ่ายรูปการบ้าน",
              desc: "อ่านและช่วยอธิบายเนื้อหาด้วย OCR API",
              icon: "🖼️",
            },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => tryMode(item.id)}
              className="p-5 rounded-2xl text-left bg-white border border-[#c8bfb2] shadow-sm hover:border-[#2D6A6F] hover:shadow-md transition-all hover:-translate-y-1 shadow-xs group"
            >
              <span className="text-3xl block mb-2">{item.icon}</span>
              <h4 className="font-bold text-base mb-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
                {item.title}
              </h4>
              <p className="text-xs text-gray-500 mb-3 leading-normal" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                {item.desc}
              </p>
              <span className="text-xs font-bold text-[#2D6A6F] group-hover:underline" style={{ fontFamily: "'Space Mono', monospace" }}>
                ลองเลย ↗
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* CHANNEL ACCESS & NOTIFICATION TOGGLE */}
      <div className="p-5 rounded-2xl bg-white border border-[#c8bfb2] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm mb-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            ช่องทางการเข้าถึง
          </h4>
          <div className="flex gap-2 mt-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E3EAE0] text-[#3C5137]" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
              💚 LINE Official Account
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E7E3EF] text-[#423A56]" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
              🌐 Web Application (หน้านี้)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            รับการแจ้งเตือนผ่าน LINE
          </span>
          <button
            onClick={() => {
              setLineNotify(!lineNotify);
              toast(lineNotify ? "ปิดการแจ้งเตือนผ่าน LINE แล้ว" : "เปิดการแจ้งเตือนผ่าน LINE แล้ว");
            }}
            className="w-12 h-6 rounded-full transition-all relative"
            style={{ backgroundColor: lineNotify ? "#2D6A6F" : "#ccc" }}
          >
            <div
              className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
              style={{ left: lineNotify ? "26px" : "4px" }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ CHAT VIEW ============ */
function ChatView({
  messages,
  inputText,
  setInputText,
  sendMessage,
  isAnalyzing,
  handleSelfie,
  handleVoice,
  handleHomeworkPhoto,
  resetChat,
  speakText,
  mood,
  concernStreak,
  transparencyLogs,
  onNotifyCounselor,
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
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isAnalyzing]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: "calc(100vh - 140px)" }}>
      {/* LEFT CHAT PANEL (2 COLS) */}
      <div className="lg:col-span-2 flex flex-col bg-white border border-[#c8bfb2] rounded-3xl overflow-hidden shadow-md">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-[#e0d8cc] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl border-2 border-[#2D6A6F]"
              style={{ backgroundColor: EMO[mood]?.bg || "#E3EAE0" }}
            >
              {EMO[mood]?.emoji || "😌"}
            </div>
            <div>
              <p className="font-bold text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
                กระจกสะท้อนใจ
              </p>
              <p className="text-xs text-[#2D6A6F] flex items-center gap-1 font-semibold" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                <span className="w-2 h-2 rounded-full bg-[#2D6A6F] animate-pulse" />
                สภาวะล่าสุด: {EMO[mood]?.label || "ปกติ"}
              </p>
            </div>
          </div>
          <button
            onClick={resetChat}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
            title="เริ่มการสนทนาใหม่"
          >
            🔄
          </button>
        </div>

        {/* MESSAGES BODY */}
        <div ref={chatBodyRef} className="flex-1 overflow-y-auto p-6 space-y-4" style={{ scrollbarWidth: "thin" }}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "system" ? (
                <div className="w-full px-4 py-2 rounded-2xl bg-[#F3E6C8] text-[#6E4F1F] text-xs font-mono text-center">
                  💡 {msg.text}
                </div>
              ) : msg.cardType === "emotion" && msg.emotionData ? (
                <div
                  className="max-w-[85%] p-4 rounded-2xl border text-sm leading-relaxed"
                  style={{
                    backgroundColor: msg.emotionData.bg,
                    borderColor: msg.emotionData.color,
                    color: msg.emotionData.text,
                    fontFamily: "'Noto Sans Thai', sans-serif",
                  }}
                >
                  <p className="font-bold text-xs uppercase tracking-wider mb-1 opacity-80" style={{ fontFamily: "'Space Mono', monospace" }}>
                    ผลการสะท้อนจากใบหน้า · {msg.emotionData.label}
                  </p>
                  <p>{msg.emotionData.note}</p>
                </div>
              ) : msg.cardType === "ocr" ? (
                <div className="max-w-[85%] p-4 rounded-2xl bg-[#f5f0e8] border border-dashed border-gray-400 text-sm">
                  <p className="font-bold text-xs text-gray-500 mb-1" style={{ fontFamily: "'Space Mono', monospace" }}>
                    📷 ผลจาก OCR API
                  </p>
                  <p className="text-xs text-gray-500 italic border-l-2 border-[#2D6A6F] pl-3 py-1 my-1">
                    {msg.ocrText}
                  </p>
                </div>
              ) : (
                <div
                  className="max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed relative group"
                  style={{
                    backgroundColor: msg.role === "user" ? "#2D6A6F" : "#f5f0e8",
                    color: msg.role === "user" ? "#ffffff" : "#1a1a1a",
                    borderBottomRightRadius: msg.role === "user" ? "4px" : "20px",
                    borderBottomLeftRadius: msg.role === "bot" ? "4px" : "20px",
                    fontFamily: "'Noto Sans Thai', sans-serif",
                  }}
                >
                  {msg.text}

                  {/* Audio Speaker Button for Bot replies */}
                  {msg.role === "bot" && (
                    <button
                      onClick={() => speakText(msg.text)}
                      className="ml-2 text-xs opacity-60 hover:opacity-100 transition-opacity"
                      title="ฟังเสียงอ่าน"
                    >
                      🔊
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="px-5 py-3 rounded-2xl bg-[#f5f0e8] border border-gray-300">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#2D6A6F] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[#2D6A6F] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[#2D6A6F] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* INPUT TOOLBAR */}
        <div className="p-4 border-t border-[#e0d8cc] bg-white space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelfie}
              className="p-2.5 rounded-full border border-gray-300 hover:border-[#2D6A6F] hover:bg-[#E3EAE0] transition-all text-sm"
              title="ถ่ายเซลฟี่"
            >
              📷
            </button>
            <button
              onClick={handleVoice}
              className="p-2.5 rounded-full border border-gray-300 hover:border-[#2D6A6F] hover:bg-[#E3EAE0] transition-all text-sm"
              title="พูดระบาย"
            >
              🎤
            </button>
            <button
              onClick={handleHomeworkPhoto}
              className="p-2.5 rounded-full border border-gray-300 hover:border-[#2D6A6F] hover:bg-[#E3EAE0] transition-all text-sm"
              title="แนบรูปการบ้าน"
            >
              🖼️
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="พิมพ์ความรู้สึกของคุณ..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 px-5 py-3 rounded-full bg-[#f5f0e8] outline-none text-sm border border-transparent focus:border-[#2D6A6F]"
              style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}
            />
            <button
              onClick={sendMessage}
              className="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center transition-all active:scale-[0.95]"
              style={{ backgroundColor: "#2D6A6F" }}
            >
              ⬆️
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE STACK (1 COL) */}
      <div className="space-y-4">
        {/* MODES USED INFO */}
        <div className="p-5 rounded-3xl bg-white border border-[#c8bfb2] shadow-md">
          <h4 className="font-bold text-sm mb-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            โหมดที่ใช้ได้
          </h4>
          <p className="text-xs text-gray-600 leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
            Face Recognition · Sentiment Analysis · Speech-to-Text · OCR ถูกส่งต่อให้ Pathumma LLM สังเคราะห์คำแนะนำเฉพาะบุคคล
          </p>
        </div>

        {/* CONCERN SLOT / ESCALATION CARD */}
        <div className="p-5 rounded-3xl bg-white border border-[#c8bfb2] shadow-md">
          <h4 className="font-bold text-sm mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            สถานะการดูแล
          </h4>
          {concernStreak >= 2 ? (
            <div className="p-3.5 rounded-2xl bg-[#F1DEE3] border border-[#A85F73] space-y-2">
              <p className="font-bold text-xs text-[#6B3B49]" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                ⚠️ สังเกตแนวโน้มเชิงลบต่อเนื่อง
              </p>
              <p className="text-xs text-[#6B3B49]" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                อยากชวนคุยกับครูที่ปรึกษาหรือสายด่วน 1323 ไหม
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onNotifyCounselor}
                  className="px-3 py-1.5 rounded-xl bg-[#2D6A6F] text-white text-xs font-bold"
                  style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
                >
                  แจ้งครูที่ปรึกษา
                </button>
                <a
                  href="tel:1323"
                  className="px-3 py-1.5 rounded-xl border border-[#A85F73] text-[#6B3B49] text-xs font-bold"
                  style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
                >
                  โทร 1323
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
              ยังไม่พบสัญญาณที่น่าเป็นห่วง ระบบจะแจ้งเตือนอัตโนมัติหากพบแนวโน้มต่อเนื่อง
            </p>
          )}
        </div>

        {/* TRANSPARENCY LOGS */}
        <div className="p-5 rounded-3xl bg-white border border-[#c8bfb2] shadow-md">
          <h4 className="font-bold text-sm mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            บันทึกความโปร่งใส
          </h4>
          {transparencyLogs.length === 0 ? (
            <p className="text-xs text-gray-400 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>
              ยังไม่มีการเรียกใช้ API
            </p>
          ) : (
            <div className="space-y-2">
              {transparencyLogs.map((log, i) => (
                <div key={i} className="text-xs font-mono text-gray-600 bg-gray-50 p-2 rounded-xl flex items-center gap-2 border border-gray-200">
                  <span>👁️</span>
                  <span>{log}</span>
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
function TrendView({
  trendData,
  logEntries,
  onDeleteEntry,
  onClearAll,
  onExport,
}: {
  trendData: TrendPoint[];
  logEntries: LogEntry[];
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
  onExport: () => void;
}) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SVG EMOTION TREND CHART */}
        <div className="p-6 rounded-3xl bg-white border border-[#c8bfb2] shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
              แนวโน้มอารมณ์ในเซสชันนี้
            </h3>
            <span className="text-xs font-mono text-gray-500" style={{ fontFamily: "'Space Mono', monospace" }}>
              {trendData.length === 0 ? "ยังไม่มีข้อมูล" : `${trendData.length} จุดข้อมูล`}
            </span>
          </div>

          {/* SVG Canvas */}
          <div className="relative h-44 w-full my-2">
            <svg viewBox="0 0 500 160" className="w-full h-full overflow-visible">
              <line x1="0" y1="140" x2="500" y2="140" stroke="#e0d8cc" strokeWidth="1" />
              <text x="0" y="18" fontFamily="'Space Mono', monospace" fontSize="10" fill="#888">
                ผ่อนคลาย
              </text>
              <text x="0" y="150" fontFamily="'Space Mono', monospace" fontSize="10" fill="#888">
                ตึงเครียด
              </text>

              {trendData.length > 0 && (
                <>
                  <polyline
                    fill="none"
                    stroke="#6F6389"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={trendData
                      .map((d, idx) => {
                        const stepX = trendData.length > 1 ? 460 / (trendData.length - 1) : 0;
                        const x = 30 + idx * stepX;
                        const y = 140 - d.valence * 110;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                  {trendData.map((d, idx) => {
                    const stepX = trendData.length > 1 ? 460 / (trendData.length - 1) : 0;
                    const x = 30 + idx * stepX;
                    const y = 140 - d.valence * 110;
                    return <circle key={d.id} cx={x} cy={y} r="5.5" fill={d.color} stroke="#ffffff" strokeWidth="1.5" />;
                  })}
                </>
              )}
            </svg>
          </div>

          <div className="flex gap-4 pt-3 border-t border-[#e0d8cc] text-xs font-semibold text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2D6A6F]" /> ผ่อนคลาย / ดี
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6F6389]" /> ปกติ / เหนื่อยล้า
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E05555]" /> เครียด / กังวล
            </span>
          </div>
        </div>

        {/* CHECK-IN HISTORY LOG */}
        <div className="p-6 rounded-3xl bg-white border border-[#c8bfb2] shadow-md flex flex-col">
          <h3 className="font-bold text-base mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            ประวัติการเช็คอิน
          </h3>

          <div className="flex-1 overflow-y-auto max-h-48 space-y-2 pr-1" style={{ scrollbarWidth: "thin" }}>
            {logEntries.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-8" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                ยังไม่มีประวัติการเช็คอินในเซสชันนี้
              </div>
            ) : (
              logEntries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#f5f0e8] text-xs"
                  style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
                >
                  <span className="font-semibold text-gray-800">
                    {e.label} · {e.source}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-400">{e.time}</span>
                    <button onClick={() => onDeleteEntry(e.id)} className="text-gray-400 hover:text-red-500">
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t border-[#e0d8cc] mt-auto">
            <button
              onClick={onExport}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-xs font-bold text-gray-700"
              style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
            >
              📥 ส่งออกข้อมูลของฉัน
            </button>
            <button
              onClick={onClearAll}
              className="px-4 py-2.5 rounded-xl border border-[#E05555] text-[#E05555] hover:bg-[#F1DEE3] text-xs font-bold"
              style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
            >
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
      <div className="inline-block px-4 py-1.5 rounded-full text-xs font-mono font-bold bg-[#F3E6C8] text-[#6E4F1F]">
        🧪 ข้อมูลตัวอย่างเพื่อสาธิต (Demo aggregate data)
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { num: "312", label: "การเช็คอินสัปดาห์นี้" },
          { num: "24%", label: "มีแนวโน้มเครียด/กังวลต่อเนื่อง" },
          { num: "58%", label: "อยู่ในเกณฑ์ปกติ-ผ่อนคลาย" },
          { num: "9", label: "กรณีที่ส่งต่อครูที่ปรึกษา" },
        ].map((stat, i) => (
          <div key={i} className="p-5 rounded-3xl bg-white border border-[#c8bfb2] shadow-md">
            <span className="text-3xl font-black block" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
              {stat.num}
            </span>
            <span className="text-xs text-gray-600 mt-1 block" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* BAR CHART */}
      <div className="p-6 rounded-3xl bg-white border border-[#c8bfb2] shadow-md">
        <h4 className="font-bold text-base mb-4" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          แนวโน้มรายสัปดาห์ (ระดับความเครียดเฉลี่ย)
        </h4>

        <div className="flex items-end gap-6 h-40 pt-4">
          {[
            { height: "52%", label: "สัปดาห์ 1", color: "#2D6A6F" },
            { height: "61%", label: "สัปดาห์ 2", color: "#2D6A6F" },
            { height: "74%", label: "สัปดาห์ 3", color: "#E05555" },
            { height: "66%", label: "สัปดาห์ 4", color: "#6F6389" },
            { height: "48%", label: "สัปดาห์นี้", color: "#2D6A6F" },
          ].map((bar, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full rounded-t-xl transition-all" style={{ height: bar.height, backgroundColor: bar.color }} />
              <span className="text-xs font-mono text-gray-500" style={{ fontFamily: "'Space Mono', monospace" }}>
                {bar.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* PLANS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "บริการฟรี", desc: "นักเรียนใช้งานรายบุคคลผ่าน LINE Official Account ได้ฟรีเสมอ" },
          { title: "แพ็กเกจโรงเรียน", desc: "ค่าบริการรายเดือนสำหรับภาพรวมสถิติระดับสถาบัน ไม่ระบุตัวตนนักเรียน" },
          { title: "บริการวิเคราะห์ข้อมูล", desc: "สำหรับหน่วยงานด้านการศึกษาที่ต้องการข้อมูลเชิงลึกระดับภาพรวม" },
        ].map((plan, i) => (
          <div key={i} className="p-5 rounded-3xl bg-white border border-[#c8bfb2] shadow-md">
            <h5 className="font-bold text-sm mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
              {plan.title}
            </h5>
            <p className="text-xs text-gray-600 leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {plan.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ SAFETY & PRIVACY VIEW ============ */
function SafetyView({
  age, guardianConsent, onExport, onClearAll,
}: {
  age: string;
  guardianConsent: boolean;
  onExport: () => void;
  onClearAll: () => void;
}) {
  const [subTab, setSubTab] = useState<"privacy" | "ethics" | "arch" | "limits">("privacy");

  return (
    <div className="space-y-6 max-w-4xl">
      {/* SUB TABS */}
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
              backgroundColor: subTab === t.id ? "#1a1a1a" : "#ffffff",
              color: subTab === t.id ? "#ffffff" : "#1a1a1a",
              border: subTab === t.id ? "none" : "1.5px solid #e0d8cc",
              fontFamily: "'Noto Sans Thai', sans-serif",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SUBVIEW 1: PRIVACY */}
      {subTab === "privacy" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[#E3EAE0] text-[#3C5137]">
              <h5 className="font-bold text-xs mb-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                อายุที่ยืนยัน
              </h5>
              <p className="text-sm font-semibold">{age ? `${age} ปี` : "16 ปี"}</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#E3EAE0] text-[#3C5137]">
              <h5 className="font-bold text-xs mb-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                ความยินยอมผู้ปกครอง
              </h5>
              <p className="text-sm font-semibold">{guardianConsent ? "ได้รับความยินยอมแล้ว" : "รอดำเนินการ"}</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#E3EAE0] text-[#3C5137]">
              <h5 className="font-bold text-xs mb-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                เงื่อนไขการใช้งาน
              </h5>
              <p className="text-sm font-semibold">ยอมรับแล้ว</p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#c8bfb2] shadow-md space-y-4">
            <h4 className="font-bold text-base" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
              การควบคุมข้อมูลของฉัน
            </h4>
            <p className="text-xs text-gray-600" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
              คุณสามารถเข้าถึง ส่งออก หรือลบข้อมูลของตนเองได้ทุกเมื่อ
            </p>
            <div className="flex gap-3">
              <button
                onClick={onExport}
                className="px-5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-xs font-bold"
                style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
              >
                📥 ส่งออกข้อมูลของฉัน
              </button>
              <button
                onClick={onClearAll}
                className="px-5 py-2.5 rounded-xl border border-[#E05555] text-[#E05555] hover:bg-[#F1DEE3] text-xs font-bold"
                style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
              >
                🗑️ ลบข้อมูลทั้งหมด
              </button>
            </div>
          </div>

          {/* ACCORDIONS */}
          <div className="space-y-3">
            {[
              {
                title: "พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)",
                content:
                  "ระบบปฏิบัติตาม PDPA อย่างเคร่งครัด ภาพใบหน้าประมวลผลแบบเรียลไทม์และไม่ถูกจัดเก็บลงเซิร์ฟเวอร์ ข้อมูลแนวโน้มอารมณ์จัดเก็บแบบไม่ระบุตัวตนโดยใช้รหัสแทนชื่อ และเข้ารหัสตามมาตรฐาน AES-256",
              },
              {
                title: "นโยบายความเป็นส่วนตัว (สรุป)",
                content:
                  "ข้อมูลที่เก็บมีเพียงแนวโน้มอารมณ์แบบไม่ระบุตัวตนเพื่อแสดงพัฒนาการของผู้ใช้เท่านั้น ไม่มีการขายหรือแบ่งปันข้อมูลส่วนบุคคลให้บุคคลที่สาม",
              },
              {
                title: "ข้อกำหนดการใช้งาน (สรุป)",
                content:
                  "ผู้ใช้อายุต่ำกว่า 13 ปีต้องได้รับความยินยอมจากผู้ปกครองก่อนใช้งาน ผู้ใช้อายุต่ำกว่า 20 ปีต้องได้รับความยินยอมจากผู้ปกครองก่อนเก็บข้อมูล ระบบมีการจำกัดอัตราการใช้งาน (Rate Limiting)",
              },
            ].map((acc, i) => (
              <details key={i} className="p-4 rounded-2xl bg-white border border-[#e0d8cc] group">
                <summary className="font-bold text-sm cursor-pointer list-none flex justify-between items-center" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                  <span>{acc.title}</span>
                  <span className="text-gray-400 font-mono text-base group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100 leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                  {acc.content}
                </p>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* SUBVIEW 2: ETHICS */}
      {subTab === "ethics" && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white border border-[#c8bfb2] shadow-md space-y-3">
            {[
              "👁️ ระบบแสดงข้อความแจ้งเตือนทุกครั้งที่กำลังวิเคราะห์ข้อมูล (Transparent AI)",
              "🩺 AI ไม่มีหน้าที่วินิจฉัยโรคซึมเศร้าหรือโรคทางจิตเวชไม่ว่ากรณีใดๆ",
              "👥 มี Human-in-the-loop — กรณีฉุกเฉินจะแจ้งเตือนไปยังผู้ดูแลระบบที่เป็นมนุษย์แบบไม่ระบุตัวตน",
              "💖 ผลลัพธ์จากการวิเคราะห์เป็นข้อเสนอแนะเชิงบวก ไม่ใช่การตัดสิน ตีตรา หรือประเมินค่า",
              "🛡️ มี Rate Limiting และระบบตรวจจับกรองเนื้อหาที่ไม่เหมาะสม เพื่อป้องกันการใช้งานในทางที่ผิด",
            ].map((text, i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-[#f5f0e8] text-xs font-semibold text-gray-800" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                {text}
              </div>
            ))}
          </div>

          <div className="p-6 rounded-3xl bg-[#1a1a1a] text-white flex items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-lg mb-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#FFB5A7" }}>
                📞 สายด่วนสุขภาพจิต 1323
              </h4>
              <p className="text-xs text-gray-300" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                หากพบสัญญาณน่าเป็นห่วงต่อเนื่อง กระจกจะแนะนำให้ปรึกษาครูที่ปรึกษา ผู้ปกครอง หรือสายด่วนนี้
              </p>
            </div>
            <a
              href="tel:1323"
              className="px-6 py-3 rounded-full bg-[#E05555] text-white font-bold text-sm hover:bg-red-600 transition-all shrink-0"
              style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}
            >
              โทร 1323
            </a>
          </div>
        </div>
      )}

      {/* SUBVIEW 3: ARCHITECTURE */}
      {subTab === "arch" && (
        <div className="space-y-3">
          {[
            { layer: "ชั้น 1", title: "User Interface", desc: "LINE Official Account และ Web Application — พิมพ์ ถ่ายเซลฟี่ พูด หรือถ่ายรูปการบ้าน" },
            { layer: "ชั้น 2", title: "API Gateway", desc: "ตรวจสอบสิทธิ์ กระจายคำขอไปยังบริการที่ถูกต้อง บันทึก Log แบบไม่ระบุตัวตน" },
            { layer: "ชั้น 3", title: "AI Services · AI for Thai", desc: "Face Recognition · Sentiment Analysis · Speech-to-Text · OCR · Pathumma LLM (โมเดลหลัก)" },
            { layer: "ชั้น 4", title: "Data Storage", desc: "เก็บประวัติแนวโน้มอารมณ์แบบไม่ระบุตัวตน เข้ารหัส AES-256 ปฏิบัติตาม PDPA" },
          ].map((item, i) => (
            <div key={i} className="p-5 rounded-3xl bg-white border border-[#c8bfb2] shadow-md flex items-center gap-4">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#2D6A6F] text-white shrink-0">
                {item.layer}
              </span>
              <div>
                <h5 className="font-bold text-sm text-gray-900" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                  {item.title}
                </h5>
                <p className="text-xs text-gray-600 mt-0.5" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUBVIEW 4: LIMITS */}
      {subTab === "limits" && (
        <div className="p-6 rounded-3xl bg-white border border-[#c8bfb2] shadow-md space-y-3">
          {[
            "⚠️ การวิเคราะห์อารมณ์จากใบหน้าอาจคลาดเคลื่อนในสภาพแสงน้อย หรือเมื่อใส่หน้ากากอนามัย",
            "⚠️ การวิเคราะห์ความรู้สึกจากข้อความอาจไม่ครอบคลุมภาษาเฉพาะกลุ่มหรือภาษาถิ่นบางรูปแบบ",
            "⚠️ ระบบนี้เป็นเครื่องมือเสริม ไม่สามารถแทนที่การปรึกษาจิตแพทย์หรือนักจิตวิทยา",
            "⚠️ อาจยังไม่สามารถตรวจจับอารมณ์เชิงซ้อนที่เกิดจากหลายสาเหตุพร้อมกันได้อย่างแม่นยำ",
            "⚠️ ประสิทธิภาพขึ้นอยู่กับคุณภาพการเชื่อมต่ออินเทอร์เน็ต เนื่องจากเรียกใช้ API แบบเรียลไทม์",
          ].map((text, i) => (
            <div key={i} className="p-3.5 rounded-2xl bg-[#F3E6C8] text-[#6E4F1F] text-xs font-semibold" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ MAIN APP ============ */
export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [age, setAge] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianApproved, setGuardianApproved] = useState(false);

  return (
    <div className="font-sans">
      <Toaster richColors position="top-center" />

      {page === "login" && <LoginPage onNext={() => setPage("onb1")} />}
      {page === "onb1" && <OnbWelcome onNext={() => setPage("onb2")} />}
      {page === "onb2" && (
        <OnbAge
          age={age}
          setAge={setAge}
          onNext={() => {
            const ageNum = parseInt(age);
            if (ageNum < 13) {
              setPage("guardian");
            } else {
              setPage("privacy");
            }
          }}
        />
      )}
      {page === "guardian" && (
        <GuardianPage
          approved={guardianApproved}
          onSend={() => {
            if (!guardianEmail || !guardianEmail.includes("@")) {
              toast("กรุณากรอกอีเมลที่ถูกต้อง");
              return;
            }
            setTimeout(() => setGuardianApproved(true), 1200);
          }}
          onNext={() => setPage("privacy")}
          guardianEmail={guardianEmail}
          setGuardianEmail={setGuardianEmail}
        />
      )}
      {page === "privacy" && <PrivacyPage onNext={() => setPage("app")} />}
      {page === "app" && <AppShell />}
    </div>
  );
}


