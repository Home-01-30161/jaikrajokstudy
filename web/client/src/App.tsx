import { useState, useEffect, useRef, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { api, ApiError, type Mood, type SchoolResult, type TrendResult } from "@/lib/api";

/* ============ LOCAL IDENTITY ============
 * There is no auth backend, so a random id is generated per browser and kept in
 * localStorage. It only scopes this browser's own mood history; it grants
 * nothing and is hashed before the server stores it.
 */
const USER_KEY = "jaikrajok_user_id";

function getUserId(): string {
  try {
    let id = localStorage.getItem(USER_KEY);
    if (!id) {
      id = `web_${crypto.randomUUID()}`;
      localStorage.setItem(USER_KEY, id);
    }
    return id;
  } catch {
    // Private mode with storage blocked: fall back to a per-session id.
    return "web-anon";
  }
}

/* ============ IMAGE PATHS ============ */
// Served from client/public/assets by the FastAPI static mount. The originals
// lived behind a storage proxy that needs credentials the deploy does not have.
const IMG = {
  loginCollage: "/assets/login_collage.svg",
  handPen: "/assets/hand_pen.svg",
  glasses: "/assets/glasses_halftone.svg",
  megaphone: "/assets/megaphone_halftone.svg",
  origamiStars: "/assets/origami_stars.svg",
  crumpledPaper: "/assets/crumpled_paper.svg",
  halftoneDots: "/assets/halftone_dots.svg",
  booksStack: "/assets/books_stack.svg",
  chatBubbles: "/assets/chat_bubbles.svg",
  chartGraph: "/assets/chart_graph.svg",
  schoolBuilding: "/assets/school_building.svg",
  shieldLock: "/assets/shield_lock.svg",
};

/* ============ EMOJI / MOOD ============ */
const EMO: Record<string, { emoji: string; label: string; mid: string; edge: string }> = {
  stressed: { emoji: "😣", label: "เครียด", mid: "#c4b5a0", edge: "#8b7355" },
  tired: { emoji: "😴", label: "เหนื่อย", mid: "#b0a898", edge: "#7a6f60" },
  neutral: { emoji: "😐", label: "ปกติ", mid: "#d4cfc5", edge: "#a09888" },
  calm: { emoji: "😌", label: "สงบ", mid: "#c8ddd5", edge: "#7da89a" },
  sad: { emoji: "😢", label: "เศร้า", mid: "#a0a8b8", edge: "#6a7080" },
  positive: { emoji: "😊", label: "สดใส", mid: "#e8d5c0", edge: "#c4a882" },
};

/* Shown while a request is in flight, so the user knows which service is
 * running. The reply itself always comes from the backend. */
const TRANSPARENCY: Record<string, string> = {
  เซลฟี่: "กำลังตรวจจับใบหน้าจากภาพ (Face Detection API)",
  ข้อความ: "กำลังวิเคราะห์น้ำเสียงจากข้อความ (Sentiment Analysis + Pathumma LLM)",
  "เสียงพูด": "กำลังแปลงเสียงพูดเป็นข้อความ (Speech-to-Text API)",
  "รูปการบ้าน": "กำลังอ่านข้อความจากภาพ (OCR API)",
};

/** Shown only when a service is unreachable, so the chat never dead-ends. */
const ERROR_REPLY =
  "ขออภัยนะ ตอนนี้กระจกเชื่อมต่อระบบวิเคราะห์ไม่ได้ ลองอีกครั้งในอีกสักครู่ได้ไหม";

type Page = "login" | "onb1" | "onb2" | "onb3" | "guardian" | "guardianOk" | "privacy" | "app";
type AppView = "home" | "chat" | "trend" | "school" | "safety";
type ChatMode = "ข้อความ" | "เซลฟี่" | "เสียงพูด" | "รูปการบ้าน";

const MAX_RECORD_SECONDS = 60;

/**
 * Microphone recording via MediaRecorder.
 *
 * The browser picks the container (webm/opus in Chrome, mp4 in Safari), and the
 * backend's ASR accepts both. Recording stops itself at MAX_RECORD_SECONDS so a
 * forgotten session cannot upload something huge, and the mic track is always
 * released so the recording indicator does not linger.
 */
function useRecorder(onComplete: (audio: Blob, filename: string) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stop = useCallback(() => {
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast("เบราว์เซอร์นี้ไม่รองรับการอัดเสียง");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast("ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน");
      return;
    }

    const rec = new MediaRecorder(stream);
    recorderRef.current = rec;
    chunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      setSeconds(0);
      const type = rec.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (blob.size < 1024) {
        toast("เสียงสั้นเกินไป ลองพูดอีกครั้งนะ");
        return;
      }
      onComplete(blob, `voice.${type.includes("mp4") ? "mp4" : "webm"}`);
    };

    rec.start();
    setRecording(true);
    setSeconds(0);
  }, [onComplete]);

  // Tick the timer and enforce the cap.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORD_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [recording, stop]);

  // Release the mic if the view unmounts mid-recording.
  useEffect(() => () => {
    const rec = recorderRef.current;
    if (rec?.state === "recording") rec.stop();
  }, []);

  return { recording, seconds, start, stop };
}

interface ChatMsg {
  role: "user" | "bot";
  text: string;
  timestamp: number;
}

/* ============ CHECKERBOARD STRIP ============ */
function CheckerStrip() {
  const squares = Array.from({ length: 20 }, (_, i) => i);
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-10 flex overflow-hidden" style={{ background: "#1a1a1a" }}>
      {squares.map((i) => (
        <div
          key={i}
          className="h-full flex-1 min-w-[2rem]"
          style={{
            background: i % 2 === 0 ? "#1a1a1a" : "#f5f0e8",
            borderRadius: "0",
          }}
        />
      ))}
    </div>
  );
}

/* ============ HALFTONE DOTS BG ============ */
function HalftoneBg() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none opacity-[0.07]"
      style={{
        backgroundImage: `radial-gradient(circle, #1a1a1a 1px, transparent 1px)`,
        backgroundSize: "18px 18px",
        backgroundPosition: "center",
      }}
    />
  );
}

/* ============ GRAPH PAPER BG ============ */
function GridBg() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      style={{
        background: `
          linear-gradient(rgba(180,170,150,0.15) 1px, transparent 1px),
          linear-gradient(90deg, rgba(180,170,150,0.15) 1px, transparent 1px)
        `,
        backgroundSize: "24px 24px",
        backgroundPosition: "center",
        backgroundColor: "#f5f0e8",
      }}
    />
  );
}

/* ============ RED SPARKLE ============ */
function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path d="M20 0 L23 15 L38 17 L25 23 L20 40 L17 23 L2 17 L15 15 Z" fill="#C41E3A" />
    </svg>
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
      <GridBg />
      <HalftoneBg />

      {/* Main collage image left */}
      <div className="absolute left-0 top-10 bottom-0 w-1/2 z-10">
        <img src={IMG.loginCollage} alt="" className="w-full h-full object-cover object-left-top opacity-90" />
        <div className="absolute bottom-0 left-0 w-full h-32 z-20"
          style={{ background: "linear-gradient(to top, #1a1a1a 0%, transparent 100%)" }} />
      </div>

      {/* Curved black shape */}
      <div className="absolute left-0 bottom-0 w-[45%] z-10" style={{ height: "60%" }}>
        <svg viewBox="0 0 600 500" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0,0 C200,50 300,100 500,200 C600,300 600,500 600,500 L0,500 Z" fill="#1a1a1a" />
        </svg>
      </div>

      {/* Right side - login card */}
      <div className="absolute right-0 top-10 bottom-0 w-[55%] flex items-center justify-center z-20 px-8">
        <div
          className="w-full max-w-md p-8 relative"
          style={{
            background: "linear-gradient(160deg, #FFB5A7 0%, #FFC8B8 40%, #FFD5CC 100%)",
            borderRadius: "28px",
            border: "2.5px solid #e0d0c4",
            boxShadow: "6px 6px 0px rgba(26,26,26,0.15), 0 20px 60px rgba(0,0,0,0.1)",
          }}
        >
          {/* Paper texture overlay */}
          <div className="absolute inset-0 rounded-[28px] opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle, #1a1a1a 1px, transparent 1px)`,
              backgroundSize: "12px 12px",
            }} />

          <Sparkle className="absolute -top-4 right-8" />
          <Sparkle className="absolute top-12 -left-4 opacity-60" />

          {/* Warm Thai brand headline */}
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}
          >
            สวัสดี กระจกรอคุณอยู่
          </h1>
          <h2
            className="text-4xl font-black mb-6"
            style={{ fontFamily: "'Playfair Display', serif", color: "#C41E3A" }}
          >
            JaiKrajok
          </h2>

          {/* Monospace label */}
          <p className="text-xs mb-5 tracking-widest uppercase" style={{ color: "#888", fontFamily: "'Space Mono', monospace" }}>
            พื้นที่ปลอดภัย · สำหรับนักเรียน
          </p>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="อีเมล"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-0 outline-none text-[#1a1a1a]"
              style={{
                backgroundColor: "rgba(255,255,255,0.85)",
                fontFamily: "'Noto Sans Thai', sans-serif",
                fontSize: "15px",
                border: "2px solid rgba(26,26,26,0.1)",
              }}
            />
            <input
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-0 outline-none text-[#1a1a1a]"
              style={{
                backgroundColor: "rgba(255,255,255,0.85)",
                fontFamily: "'Noto Sans Thai', sans-serif",
                fontSize: "15px",
                border: "2px solid rgba(26,26,26,0.1)",
              }}
            />

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  if (!email || !password) { toast("กรุณากรอกข้อมูลให้ครบ"); return; }
                  onNext();
                }}
                className="flex-1 py-3.5 rounded-xl font-semibold text-white transition-all duration-150 active:scale-[0.97]"
                style={{
                  backgroundColor: "#2D6A6F",
                  fontFamily: "'Noto Sans Thai', sans-serif",
                  boxShadow: "3px 3px 0px rgba(26,26,26,0.2)",
                }}
              >
                {mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
              </button>
            </div>

            <button
              className="w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.97] mt-2"
              style={{
                backgroundColor: "rgba(255,255,255,0.9)",
                color: "#1a1a1a",
                fontFamily: "'Noto Sans Thai', sans-serif",
                border: "2px solid rgba(26,26,26,0.1)",
              }}
              onClick={() => toast("ฟีเจอร์ Google Login กำลังพัฒนา")}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              เข้าสู่ระบบด้วย Google
            </button>

            <p className="text-center text-sm mt-5" style={{ color: "#666", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {mode === "login" ? "ยังไม่มีบัญชี? " : "มีบัญชีอยู่แล้ว? "}
              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="underline font-semibold"
                style={{ color: "#2D6A6F" }}
              >
                {mode === "login" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Hand with pen at bottom right */}
      <div className="absolute bottom-4 right-4 z-30 opacity-70" style={{ width: "200px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto" style={{ filter: "brightness(0.8) contrast(1.2)" }} />
      </div>
    </div>
  );
}

/* ============ ONBOARDING STEP 1: Welcome ============ */
function OnbWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#f5f0e8" }}>
      <GridBg />
      <HalftoneBg />

      {/* Halftone dots top-left */}
      <img
        src={IMG.halftoneDots}
        alt=""
        className="absolute top-0 left-0 w-[400px] opacity-20 pointer-events-none"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Red sparkle top-right */}
      <Sparkle className="absolute top-16 right-12" />

      {/* Hand with pen bottom-right */}
      <div className="absolute bottom-8 right-8 opacity-60" style={{ width: "250px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto" style={{ filter: "grayscale(0.3)" }} />
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-[28px] p-8 shadow-xl" style={{ border: "2px solid #e0d8cc" }}>
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-6 text-white"
          style={{ backgroundColor: "#2D6A6F", fontFamily: "'Space Mono', monospace" }}
        >
          AI for Thai · Pathumma LLM
        </div>

        <h1 className="text-3xl font-black mb-4 leading-tight" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
          กระจกสะท้อนใจ
        </h1>
        <p className="text-lg font-semibold mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#2D6A6F" }}>
          พื้นที่ปลอดภัยให้ใจได้มองเห็นตัวเอง
        </p>
        <p className="text-base mb-8 leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666" }}>
          แอปพลิเคชัน AI สำหรับนักเรียน ม.ปลาย ที่ช่วยให้คุณสำรวจและเข้าใจอารมณ์ของตัวเอง ผ่านการวิเคราะห์ใบหน้า, ข้อความ, และเสียงพูด อย่างปลอดภัยและโปร่งใส
        </p>

        <button
          onClick={onNext}
          className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all duration-150 active:scale-[0.97]"
          style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}
        >
          เริ่มต้นใช้งาน
        </button>
      </div>
    </div>
  );
}

/* ============ ONBOARDING STEP 2: Age ============ */
function OnbAge({ onNext, age, setAge }: { onNext: () => void; age: string; setAge: (v: string) => void }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#f5f0e8" }}>
      <GridBg />
      <HalftoneBg />

      {/* Halftone dots */}
      <img src={IMG.halftoneDots} alt="" className="absolute top-0 left-0 w-[350px] opacity-15 pointer-events-none" />

      {/* Origami stars bottom */}
      <div className="absolute bottom-4 left-8 opacity-50" style={{ width: "180px" }}>
        <img src={IMG.origamiStars} alt="" className="w-full h-auto" />
      </div>

      {/* Hand with pen bottom-right */}
      <div className="absolute bottom-4 right-4 opacity-60" style={{ width: "200px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto" />
      </div>

      <div className="relative z-10 w-full max-w-lg bg-white rounded-[28px] p-8 shadow-xl" style={{ border: "2px solid #e0d8cc" }}>
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-6 text-white"
          style={{ backgroundColor: "#2D6A6F", fontFamily: "'Space Mono', monospace" }}
        >
          ขั้นตอนที่ 1 จาก 3
        </div>

        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          ขอทราบอายุของคุณ
        </h1>
        <p className="text-sm mb-6" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#888" }}>
          ระบุอายุเพื่อการตรวจสอบตามข้อกำหนด PDPA
        </p>

        <input
          type="number"
          placeholder="อายุ (ปี)"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="w-full px-5 py-4 rounded-2xl text-lg mb-6 outline-none"
          style={{
            backgroundColor: "#f5f0e8",
            fontFamily: "'Noto Sans Thai', sans-serif",
            border: "2px solid #e0d8cc",
            color: "#1a1a1a",
          }}
        />

        <button
          onClick={() => {
            if (!age || parseInt(age) < 1 || parseInt(age) > 99) {
              toast("กรุณากรอกอายุที่ถูกต้อง");
              return;
            }
            onNext();
          }}
          className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all duration-150 active:scale-[0.97]"
          style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}

/* ============ GUARDIAN CONSENT ============ */
function GuardianPage({
  approved,
  onSend,
  onNext,
  guardianEmail,
  setGuardianEmail,
}: {
  approved: boolean;
  onSend: () => void;
  onNext: () => void;
  guardianEmail: string;
  setGuardianEmail: (v: string) => void;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#f5f0e8" }}>
      <GridBg />
      <HalftoneBg />

      {/* Hand with pen top center */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 opacity-40" style={{ width: "200px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto" />
      </div>

      {/* Glasses top-right */}
      <div className="absolute top-12 right-16 opacity-40" style={{ width: "140px" }}>
        <img src={IMG.glasses} alt="" className="w-full h-auto" />
      </div>

      {/* Crumpled paper bottom-left */}
      <div className="absolute bottom-8 left-8 opacity-30" style={{ width: "160px" }}>
        <img src={IMG.crumpledPaper} alt="" className="w-full h-auto" />
      </div>

      <div className="relative z-10 w-full max-w-lg bg-white rounded-[28px] p-8 shadow-xl" style={{ border: "2px solid #e0d8cc" }}>
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-6 text-white"
          style={{ backgroundColor: "#2D6A6F", fontFamily: "'Space Mono', monospace" }}
        >
          ต้องได้รับความยินยอมจากผู้ปกครอง
        </div>

        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          ผู้ใช้อายุต่ำกว่า 13 ปี
        </h1>
        <p className="text-sm mb-6" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#888" }}>
          ตามข้อกำหนด PDPA ต้องได้รับความยินยอมจากผู้ปกครองก่อนใช้งาน
        </p>

        {approved ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl" style={{ backgroundColor: "#E8F5E9", border: "1px solid #A5D6A7" }}>
              <p className="text-sm font-semibold" style={{ color: "#2E7D32", fontFamily: "'Noto Sans Thai', sans-serif" }}>
                ✓ ผู้ปกครองให้ความยินยอมแล้ว
              </p>
            </div>
            <button
              onClick={onNext}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all duration-150 active:scale-[0.97]"
              style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}
            >
              ถัดไป
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="email"
              placeholder="อีเมลผู้ปกครอง"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl text-lg outline-none"
              style={{
                backgroundColor: "#f5f0e8",
                fontFamily: "'Noto Sans Thai', sans-serif",
                border: "2px solid #e0d8cc",
                color: "#1a1a1a",
              }}
            />
            <button
              onClick={onSend}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all duration-150 active:scale-[0.97]"
              style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}
            >
              ส่งคำขอความยินยอม
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ PRIVACY / FINAL STEP ============ */
function PrivacyPage({ onNext }: { onNext: () => void }) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#f5f0e8" }}>
      <GridBg />
      <HalftoneBg />

      {/* Megaphone bottom-left */}
      <div className="absolute bottom-8 left-8 opacity-50" style={{ width: "200px" }}>
        <img src={IMG.megaphone} alt="" className="w-full h-auto" />
      </div>

      {/* Hand with pen bottom-right */}
      <div className="absolute bottom-4 right-4 opacity-50" style={{ width: "200px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto" />
      </div>

      <div className="relative z-10 w-full max-w-lg bg-white rounded-[28px] p-8 shadow-xl" style={{ border: "2px solid #e0d8cc" }}>
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-6 text-white"
          style={{ backgroundColor: "#2D6A6F", fontFamily: "'Space Mono', monospace" }}
        >
          ขั้นตอนสุดท้าย
        </div>

        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          ความเป็นส่วนตัวของคุณ
        </h1>
        <p className="text-sm mb-6" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#888" }}>
          โปรดอ่านและยอมรับเงื่อนไขก่อนใช้งาน
        </p>

        <ul className="space-y-3 mb-6">
          {[
            "ไม่เก็บข้อมูลใบหน้า — ใช้การวิเคราะห์ทันทีแล้วลบ",
            "ข้อมูลทั้งหมดเข้ารหัสแบบ end-to-end",
            "ไม่ใช่การวินิจฉัยทางการแพทย์",
            "คุณสามารถลบข้อมูลได้ทุกเมื่อ",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#444", fontSize: "14px" }}>
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
            className="w-5 h-5 rounded-md accent-[#2D6A6F]"
          />
          <span className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#444" }}>
            ยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว
          </span>
        </label>

        <button
          onClick={() => {
            if (!accepted) { toast("กรุณายอมรับเงื่อนไขก่อนใช้งาน"); return; }
            onNext();
          }}
          className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all duration-150 active:scale-[0.97]"
          style={{
            backgroundColor: accepted ? "#2D6A6F" : "#999",
            fontFamily: "'Noto Sans Thai', sans-serif",
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
  const [age, setAge] = useState("16");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianApproved, setGuardianApproved] = useState(true);
  const [mood, setMood] = useState<string>("neutral");
  const [userId] = useState(getUserId);
  const [crisisRaised, setCrisisRaised] = useState(false);
  const [trend, setTrend] = useState<TrendResult | null>(null);
  const [school, setSchool] = useState<SchoolResult | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  /** Re-read the mood history after anything that records a new reading. */
  const refreshTrend = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([api.trend(userId), api.school()]);
      setTrend(t);
      setSchool(s);
      setDataError(null);
    } catch (err) {
      setDataError(err instanceof ApiError ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [userId]);

  useEffect(() => {
    void refreshTrend();
  }, [refreshTrend]);

  // A crisis signal routes the user to the safety page, where the helpline is.
  useEffect(() => {
    if (crisisRaised) setCurrentView("safety");
  }, [crisisRaised]);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "bot",
      text: "สวัสดีค่ะ กระจกดีใจที่ได้พบคุณวันนี้ อยากคุยเรื่องอะไรให้กระจกช่วยไหม?",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [chatMode, setChatMode] = useState<ChatMode>("ข้อความ");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // chatBodyRef is managed internally by ChatView

  useEffect(() => {
    // Messages auto-scroll handled by ChatView
  }, [messages]);

  const navItems: { id: AppView; label: string; img: string }[] = [
    { id: "home", label: "หน้าหลัก", img: IMG.booksStack },
    { id: "chat", label: "แชท", img: IMG.chatBubbles },
    { id: "trend", label: "แนวโน้มของฉัน", img: IMG.chartGraph },
    { id: "school", label: "ภาพรวมโรงเรียน", img: IMG.schoolBuilding },
    { id: "safety", label: "ความปลอดภัย & ข้อมูล", img: IMG.shieldLock },
  ];

  const addBot = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: "bot", text, timestamp: Date.now() }]);
  }, []);

  /** Warn once per session when a service degrades, without derailing the chat. */
  const noteDegraded = useCallback((degraded: string[]) => {
    if (degraded.length) toast(`บางบริการไม่พร้อมใช้งาน: ${degraded.join(", ")}`);
  }, []);

  /** Text mode: sentiment + mood-aware LLM reply, both from the backend. */
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isAnalyzing) return;

    setMessages((prev) => [...prev, { role: "user", text, timestamp: Date.now() }]);
    setInputText("");
    setIsAnalyzing(true);
    try {
      const res = await api.sendMessage(userId, text);
      setMood(res.mood);
      addBot(res.reply);
      if (res.crisis) setCrisisRaised(true);
      noteDegraded(res.degraded);
      void refreshTrend();
    } catch (err) {
      addBot(ERROR_REPLY);
      toast(err instanceof ApiError ? err.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setIsAnalyzing(false);
    }
  }, [inputText, isAnalyzing, userId, addBot, noteDegraded, refreshTrend]);

  /** Shared tail for the three upload modes. */
  const runAnalysis = useCallback(
    async (label: string, call: () => Promise<import("@/lib/api").AnalysisResult>) => {
      if (isAnalyzing) return;
      setIsAnalyzing(true);
      try {
        const res = await call();
        if (res.transcript) {
          setMessages((prev) => [
            ...prev,
            { role: "user", text: res.transcript as string, timestamp: Date.now() },
          ]);
        }
        setMood(res.mood);
        addBot(res.reply);
        void refreshTrend();
      } catch (err) {
        addBot(ERROR_REPLY);
        toast(err instanceof ApiError ? err.message : `${label}ไม่สำเร็จ`);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [isAnalyzing, addBot, refreshTrend],
  );

  const doSelfie = useCallback(
    (image: Blob) => runAnalysis("วิเคราะห์ภาพ", () => api.analyzeSelfie(userId, image)),
    [runAnalysis, userId],
  );

  const doVoice = useCallback(
    (audio: Blob, filename: string) =>
      runAnalysis("ถอดเสียง", () => api.transcribeVoice(userId, audio, filename)),
    [runAnalysis, userId],
  );

  const doHomework = useCallback(
    (image: Blob) => runAnalysis("อ่านการบ้าน", () => api.readHomework(userId, image)),
    [runAnalysis, userId],
  );

  return (
    <div className="relative min-h-screen flex" style={{ backgroundColor: "#f5f0e8" }}>
      <CheckerStrip />
      <GridBg />
      <HalftoneBg />

      {/* Curved black sidebar */}
      <div
        className="fixed left-0 top-10 bottom-0 w-[260px] z-30 flex flex-col pt-6 px-4"
        style={{ backgroundColor: "#1a1a1a", borderRadius: "0 32px 32px 0" }}
      >
        {/* Brand */}
        <div className="mb-8 px-2">
          <h1
            className="text-2xl font-black tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: "#FFB5A7" }}
          >
            JaiKrajok
          </h1>
          <p className="text-xs mt-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "rgba(255,181,167,0.7)" }}>
            กระจกสะท้อนใจ
          </p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-2">
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
              }}
            >
              <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 opacity-70">
                <img src={item.img} alt="" className="w-full h-full object-cover" style={{ filter: currentView === item.id ? "none" : "grayscale(1) brightness(0.8)" }} />
              </div>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Mood indicator */}
        <div className="mt-auto mb-4 px-2">
          <div className="p-3 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
            <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              สภาวะล่าสุด
            </p>
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: "#FFB5A7", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              <span>{EMO[mood]?.emoji}</span>
              {EMO[mood]?.label || "ปกติ"}
            </p>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="ml-[260px] flex-1 pt-14 min-h-screen">
        {/* Page badge */}
        <div className="px-8 pt-6 pb-2">
          <div
            className="inline-block px-5 py-2 rounded-full text-sm font-bold"
            style={{
              backgroundColor: "#FFB5A7",
              color: "#1a1a1a",
              fontFamily: "'Noto Sans Thai', sans-serif",
            }}
          >
            {currentView === "home" && "หน้าหลัก"}
            {currentView === "chat" && "คุยกับกระจก"}
            {currentView === "trend" && "แนวโน้มของฉัน"}
            {currentView === "school" && "ภาพรวมโรงเรียน"}
            {currentView === "safety" && "ความปลอดภัย & ข้อมูล"}
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          {currentView === "home" && (
            <HomeView mood={mood} setMood={setMood} age={age} />
          )}
          {currentView === "chat" && (
            <ChatView
              messages={messages}
              inputText={inputText}
              setInputText={setInputText}
              sendMessage={sendMessage}
              chatMode={chatMode}
              setChatMode={setChatMode}
              isAnalyzing={isAnalyzing}
              doSelfie={doSelfie}
              doVoice={doVoice}
              doHomework={doHomework}
            />
          )}
          {currentView === "trend" && <TrendView mood={mood} trend={trend} error={dataError} />}
          {currentView === "school" && <SchoolView school={school} error={dataError} />}
          {currentView === "safety" && <SafetyView crisis={crisisRaised} />}
        </div>

        {/* Decorative collage element */}
        <div className="fixed bottom-8 right-8 z-20 opacity-30 pointer-events-none" style={{ width: "180px" }}>
          <img src={IMG.handPen} alt="" className="w-full h-auto" style={{ filter: "grayscale(0.5)" }} />
        </div>
      </div>
    </div>
  );
}

/* ============ HOME VIEW ============ */
function HomeView({ mood, setMood, age }: { mood: string; setMood: (v: string) => void; age: string }) {
  const moods = Object.entries(EMO);
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
        วันนี้รู้สึกยังไง?
      </h2>

      {/* Mood picker */}
      <div className="grid grid-cols-3 gap-4">
        {moods.map(([key, emo]) => (
          <button
            key={key}
            onClick={() => setMood(key)}
            className="p-4 rounded-2xl transition-all duration-200 active:scale-[0.97]"
            style={{
              backgroundColor: mood === key ? "#FFB5A7" : "rgba(255,255,255,0.8)",
              border: mood === key ? "2px solid #C41E3A" : "2px solid #e0d8cc",
              fontFamily: "'Noto Sans Thai', sans-serif",
            }}
          >
            <span className="text-3xl block mb-2">{emo.emoji}</span>
            <span className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>
              {emo.label}
            </span>
          </button>
        ))}
      </div>

      {/* Quick info cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.9)", border: "2px solid #e0d8cc" }}>
          <p className="text-xs font-bold mb-1" style={{ color: "#2D6A6F", fontFamily: "'Space Mono', monospace" }}>
            SUDTHAI API
          </p>
          <p className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666" }}>
            ระบบวิเคราะห์อารมณ์ภาษาไทย
          </p>
          <p className="text-lg font-bold mt-2" style={{ color: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}>
            เชื่อมต่อ ✓
          </p>
        </div>
        <div className="p-5 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.9)", border: "2px solid #e0d8cc" }}>
          <p className="text-xs font-bold mb-1" style={{ color: "#2D6A6F", fontFamily: "'Space Mono', monospace" }}>
            CONSENT STATUS
          </p>
          <p className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666" }}>
            อายุ {age} ปี · ยินยอมแล้ว
          </p>
          <p className="text-lg font-bold mt-2" style={{ color: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}>
            ผ่าน ✓
          </p>
        </div>
      </div>

      {/* Recent activity */}
      <div className="p-5 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.9)", border: "2px solid #e0d8cc" }}>
        <p className="text-sm font-bold mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          กิจกรรมล่าสุด
        </p>
        <div className="space-y-2">
          {[
            { time: "เมื่อ 2 ชม.ก่อน", event: "แชทกับกระจก · สภาวะ: ปกติ" },
            { time: "เมื่อวาน", event: "วิเคราะห์เซลฟี่ · สภาวะ: เครียด" },
            { time: "3 วันก่อน", event: "ส่งรูปการบ้าน · สภาวะ: เหนื่อย" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-[#e0d8cc] last:border-0">
              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "#f5f0e8", color: "#888", fontFamily: "'Space Mono', monospace" }}>
                {item.time}
              </span>
              <span className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#444" }}>
                {item.event}
              </span>
            </div>
          ))}
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
  chatMode,
  setChatMode,
  isAnalyzing,
  doSelfie,
  doVoice,
  doHomework,
}: {
  messages: ChatMsg[];
  inputText: string;
  setInputText: (v: string) => void;
  sendMessage: () => void;
  chatMode: ChatMode;
  setChatMode: (v: ChatMode) => void;
  isAnalyzing: boolean;
  doSelfie: (image: Blob) => void;
  doVoice: (audio: Blob, filename: string) => void;
  doHomework: (image: Blob) => void;
}) {
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const modes: readonly ChatMode[] = ["ข้อความ", "เซลฟี่", "เสียงพูด", "รูปการบ้าน"];
  const { recording, seconds, start, stop } = useRecorder(doVoice);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    const el = chatBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isAnalyzing]);

  const onImagePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) (chatMode === "เซลฟี่" ? doSelfie : doHomework)(file);
    e.target.value = ""; // allow re-picking the same file
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]" style={{ maxHeight: "calc(100vh - 120px)" }}>
      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => setChatMode(m)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: chatMode === m ? "#2D6A6F" : "rgba(255,255,255,0.8)",
              color: chatMode === m ? "#fff" : "#666",
              border: chatMode === m ? "none" : "2px solid #e0d8cc",
              fontFamily: "'Noto Sans Thai', sans-serif",
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Chat body */}
      <div
        ref={chatBodyRef}
        className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4"
        style={{ scrollbarWidth: "thin" }}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[75%] px-5 py-3 rounded-2xl text-sm leading-relaxed"
              style={{
                backgroundColor: msg.role === "user" ? "#2D6A6F" : "rgba(255,255,255,0.95)",
                color: msg.role === "user" ? "#fff" : "#1a1a1a",
                border: msg.role === "bot" ? "2px solid #e0d8cc" : "none",
                fontFamily: "'Noto Sans Thai', sans-serif",
                borderBottomRightRadius: msg.role === "user" ? "6px" : "24px",
                borderBottomLeftRadius: msg.role === "bot" ? "6px" : "24px",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isAnalyzing && (
          <div className="flex justify-start">
            <div
              className="px-5 py-3 rounded-2xl"
              style={{ backgroundColor: "rgba(255,255,255,0.95)", border: "2px solid #e0d8cc", fontFamily: "'Noto Sans Thai', sans-serif" }}
            >
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#2D6A6F] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#2D6A6F] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-[#2D6A6F] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mode action */}
      {(chatMode === "เซลฟี่" || chatMode === "รูปการบ้าน") && (
        <div className="mb-3">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            // "user" opens the front camera on mobile for selfies; homework
            // photos use the rear one.
            capture={chatMode === "เซลฟี่" ? "user" : "environment"}
            onChange={onImagePicked}
            className="sr-only"
            aria-label={chatMode === "เซลฟี่" ? "เลือกภาพเซลฟี่" : "เลือกรูปการบ้าน"}
          />
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={isAnalyzing}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: "#C41E3A", fontFamily: "'Noto Sans Thai', sans-serif" }}
          >
            {chatMode === "เซลฟี่" ? "📷 ถ่ายเซลฟี่วิเคราะห์" : "📸 อัปโหลดรูปการบ้าน"}
          </button>
        </div>
      )}

      {chatMode === "เสียงพูด" && (
        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={recording ? stop : start}
            disabled={isAnalyzing}
            aria-pressed={recording}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
            style={{
              backgroundColor: recording ? "#1a1a1a" : "#C41E3A",
              fontFamily: "'Noto Sans Thai', sans-serif",
            }}
          >
            {recording ? "⏹ หยุดและส่ง" : "🎙 เริ่มอัดเสียง"}
          </button>
          {recording && (
            <span
              className="text-sm font-semibold"
              style={{ color: "#C41E3A", fontFamily: "'Space Mono', monospace" }}
              role="status"
              aria-live="polite"
            >
              ● {String(Math.floor(seconds / 60)).padStart(2, "0")}:
              {String(seconds % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-3 pt-3 border-t" style={{ borderColor: "#e0d8cc" }}>
        <input
          type="text"
          placeholder="พิมพ์ข้อความที่นี่..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 px-5 py-3 rounded-2xl outline-none text-sm"
          style={{
            backgroundColor: "rgba(255,255,255,0.9)",
            border: "2px solid #e0d8cc",
            fontFamily: "'Noto Sans Thai', sans-serif",
            color: "#1a1a1a",
          }}
        />
        <button
          onClick={sendMessage}
          className="px-6 py-3 rounded-2xl text-white font-bold text-sm transition-all duration-150 active:scale-[0.97]"
          style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}
        >
          ส่ง
        </button>
      </div>
    </div>
  );
}

/* ============ TREND VIEW ============ */
const DAY_LABELS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
/** Bar height per mood, so a stressed day reads visually lower than a calm one. */
const MOOD_HEIGHT: Record<string, number> = {
  stressed: 45,
  sad: 52,
  tired: 60,
  neutral: 70,
  calm: 88,
  positive: 100,
};
const MOOD_COLOR: Record<string, string> = {
  stressed: "#C41E3A",
  sad: "#6a7080",
  tired: "#888888",
  neutral: "#d4cfc5",
  calm: "#2D6A6F",
  positive: "#2D6A6F",
};

function TrendView({
  mood,
  trend,
  error,
}: {
  mood: string;
  trend: TrendResult | null;
  error: string | null;
}) {
  // The backend returns only days that have a reading; pad to a full week so
  // the chart keeps a stable shape.
  const weekData = (() => {
    const byDate = new Map((trend?.days ?? []).map((d) => [d.date, d.mood as string]));
    const out: { day: string; mood: string | null; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: DAY_LABELS_TH[d.getDay()], mood: byDate.get(key) ?? null, date: key });
    }
    return out;
  })();

  const hasData = (trend?.messages ?? 0) > 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
        แนวโน้มอารมณ์ของฉัน
      </h2>

      {error && (
        <div className="p-4 rounded-2xl" style={{ backgroundColor: "rgba(196,30,58,0.08)", border: "2px solid #C41E3A" }}>
          <p className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#C41E3A" }}>
            {error}
          </p>
        </div>
      )}

      {/* Weekly mood chart */}
      <div className="p-6 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.9)", border: "2px solid #e0d8cc" }}>
        <p className="text-xs font-bold mb-4" style={{ color: "#2D6A6F", fontFamily: "'Space Mono', monospace" }}>
          สภาวะอารมณ์ 7 วันล่าสุด
        </p>
        {!hasData && !error && (
          <p className="text-sm mb-4" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#888" }}>
            ยังไม่มีข้อมูลนะ ลองคุยกับกระจกในหน้าแชทก่อน แล้วกราฟจะเริ่มขึ้นที่นี่
          </p>
        )}
        <div className="flex items-end gap-3 h-40">
          {weekData.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-2xl">{d.mood ? EMO[d.mood]?.emoji : "·"}</span>
              <div
                className="w-full rounded-t-lg transition-all duration-500"
                style={{
                  height: d.mood ? `${MOOD_HEIGHT[d.mood] ?? 70}%` : "6%",
                  backgroundColor: d.mood ? (MOOD_COLOR[d.mood] ?? "#d4cfc5") : "#ece7de",
                }}
                title={d.mood ? `${d.date}: ${EMO[d.mood]?.label}` : `${d.date}: ไม่มีข้อมูล`}
              />
              <span className="text-xs font-semibold" style={{ color: "#666", fontFamily: "'Noto Sans Thai', sans-serif" }}>
                {d.day}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "วันใช้งาน", value: `${trend?.active_days ?? 0} วัน`, icon: "📅" },
          { label: "แชททั้งหมด", value: `${trend?.messages ?? 0} ข้อความ`, icon: "💬" },
          {
            label: "สภาวะหลัก",
            value: EMO[trend?.dominant_mood ?? mood]?.label ?? "ปกติ",
            icon: EMO[trend?.dominant_mood ?? mood]?.emoji ?? "😐",
          },
        ].map((stat, i) => (
          <div key={i} className="p-4 rounded-2xl text-center" style={{ backgroundColor: "rgba(255,255,255,0.9)", border: "2px solid #e0d8cc" }}>
            <span className="text-2xl block mb-1">{stat.icon}</span>
            <p className="text-lg font-bold" style={{ color: "#1a1a1a", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {stat.value}
            </p>
            <p className="text-xs" style={{ color: "#888", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Chart graph image */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "2px solid #e0d8cc" }}>
        <img src={IMG.chartGraph} alt="" className="w-full h-48 object-cover opacity-80" />
      </div>
    </div>
  );
}

/* ============ SCHOOL VIEW ============ */
function SchoolView({ school, error }: { school: SchoolResult | null; error: string | null }) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const stats = [
    { label: "นักเรียนที่ใช้งาน", value: `${school?.users ?? 0} คน`, color: "#2D6A6F" },
    { label: "สภาวะเครียดเฉลี่ย", value: pct(school?.stress_ratio ?? 0), color: "#C41E3A" },
    { label: "การวิเคราะห์ทั้งหมด", value: `${school?.readings ?? 0} ครั้ง`, color: "#2D6A6F" },
    { label: "ใช้แชทเป็นประจำ", value: pct(school?.regular_ratio ?? 0), color: "#2D6A6F" },
  ];
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
        ภาพรวมโรงเรียน
      </h2>
      <p className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666" }}>
        ข้อมูลแบบไม่ระบุตัวตน รวมจากนักเรียนทั้งหมดในสถาบัน
      </p>

      {/* School image */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "2px solid #e0d8cc" }}>
        <img src={IMG.schoolBuilding} alt="" className="w-full h-48 object-cover opacity-70" />
      </div>

      {error && (
        <div className="p-4 rounded-2xl" style={{ backgroundColor: "rgba(196,30,58,0.08)", border: "2px solid #C41E3A" }}>
          <p className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#C41E3A" }}>
            {error}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="p-5 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.9)", border: "2px solid #e0d8cc" }}>
            <p className="text-2xl font-black" style={{ color: stat.color, fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {stat.value}
            </p>
            <p className="text-sm mt-1" style={{ color: "#666", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="p-4 rounded-2xl" style={{ backgroundColor: "rgba(255,181,167,0.15)", border: "2px solid #FFB5A7" }}>
        <p className="text-xs" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#888" }}>
          ข้อมูลทั้งหมดไม่ระบุตัวตน (anonymized) และไม่สามารถย้อนกลับไปถึงบุคคลใดบุคคลหนึ่งได้
        </p>
      </div>
    </div>
  );
}

/* ============ SAFETY VIEW ============ */
function SafetyView({ crisis }: { crisis: boolean }) {
  const [lineNotify, setLineNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const userId = getUserId();

  const exportData = async () => {
    setBusy(true);
    try {
      const data = await api.exportData(userId);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `jaikrajok-${userId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("ส่งออกข้อมูลเรียบร้อย");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "ส่งออกข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const deleteData = async () => {
    if (!window.confirm("ลบประวัติอารมณ์และการสนทนาทั้งหมดของคุณ? การกระทำนี้ย้อนกลับไม่ได้")) return;
    setBusy(true);
    try {
      await api.deleteData(userId);
      toast("ลบข้อมูลทั้งหมดเรียบร้อย");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "ลบข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
        ความปลอดภัย & ข้อมูล
      </h2>

      {/* Raised when the backend flags a crisis signal in a message. */}
      {crisis && (
        <div
          className="p-5 rounded-2xl"
          style={{ backgroundColor: "rgba(196,30,58,0.1)", border: "2px solid #C41E3A" }}
          role="alert"
        >
          <p className="font-bold mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#C41E3A" }}>
            กระจกเป็นห่วงคุณนะ
          </p>
          <p className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            ถ้ากำลังรู้สึกอยากทำร้ายตัวเอง โปรดติดต่อคนที่ช่วยได้ทันที
          </p>
          <p className="text-sm mt-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            สายด่วนสุขภาพจิต <a href="tel:1323" className="font-bold underline" style={{ color: "#C41E3A" }}>1323</a>
            {" · "}เหตุฉุกเฉิน <a href="tel:1669" className="font-bold underline" style={{ color: "#C41E3A" }}>1669</a>
          </p>
        </div>
      )}

      {/* Shield image */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "2px solid #e0d8cc", maxWidth: "200px" }}>
        <img src={IMG.shieldLock} alt="" className="w-full h-auto opacity-70" />
      </div>

      {/* Privacy info cards */}
      <div className="space-y-4">
        {[
          {
            title: "ความโปร่งใส",
            desc: "ภาพและเสียงถูกส่งไปวิเคราะห์ที่ AI for Thai / Pathumma ผ่าน HTTPS แล้วทิ้งทันที ไม่มีการเก็บไฟล์ไว้บนเซิร์ฟเวอร์ ส่วนที่บันทึกไว้คือผลอารมณ์และข้อความสนทนาเท่านั้น",
            icon: "🔒",
          },
          {
            title: "การควบคุมข้อมูล",
            desc: "คุณสามารถส่งออกหรือลบข้อมูลทั้งหมดของคุณได้ทุกเมื่อจากหน้านี้",
            icon: "🗑️",
          },
          {
            title: "ไม่ใช่การวินิจฉัย",
            desc: "กระจกสะท้อนใจไม่ใช่เครื่องมือทางการแพทย์ ไม่สามารถวินิจฉัยโรคหรือภาวะทางจิตเวชได้",
            icon: "⚠️",
          },
        ].map((item, i) => (
          <div key={i} className="p-5 rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.9)", border: "2px solid #e0d8cc" }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{item.icon}</span>
              <p className="font-bold" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
                {item.title}
              </p>
            </div>
            <p className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666" }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* LINE Notify toggle */}
      <div className="p-5 rounded-2xl flex items-center justify-between" style={{ backgroundColor: "rgba(255,255,255,0.9)", border: "2px solid #e0d8cc" }}>
        <div>
          <p className="font-bold" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            การแจ้งเตือนผ่าน LINE
          </p>
          <p className="text-xs mt-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#888" }}>
            รับการแจ้งเตือนเมื่อกระจกตรวจพบความกังวล
          </p>
        </div>
        <button
          onClick={() => {
            setLineNotify(!lineNotify);
            toast(lineNotify ? "ปิดการแจ้งเตือนผ่าน LINE แล้ว" : "เปิดการแจ้งเตือนผ่าน LINE แล้ว");
          }}
          className="w-14 h-7 rounded-full transition-all duration-300 relative"
          style={{ backgroundColor: lineNotify ? "#2D6A6F" : "#ccc" }}
        >
          <div
            className="w-5 h-5 rounded-full bg-white absolute top-1 transition-all duration-300"
            style={{ left: lineNotify ? "32px" : "4px" }}
          />
        </button>
      </div>

      {/* Data export / delete */}
      <button
        onClick={exportData}
        disabled={busy}
        className="w-full py-3 rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
        style={{
          backgroundColor: "rgba(255,255,255,0.9)",
          border: "2px solid #e0d8cc",
          color: "#2D6A6F",
          fontFamily: "'Noto Sans Thai', sans-serif",
        }}
      >
        ส่งออกข้อมูลทั้งหมดของฉัน
      </button>

      <button
        onClick={deleteData}
        disabled={busy}
        className="w-full py-3 rounded-2xl text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
        style={{
          backgroundColor: "rgba(255,255,255,0.9)",
          border: "2px solid #C41E3A",
          color: "#C41E3A",
          fontFamily: "'Noto Sans Thai', sans-serif",
        }}
      >
        ลบข้อมูลทั้งหมดของฉัน
      </button>
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
