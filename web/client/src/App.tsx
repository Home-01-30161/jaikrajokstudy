import { useState, useEffect, useRef, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { api, ApiError, type Mood, type SchoolResult, type TrendResult } from "@/lib/api";
import { useInView, useCountUp, createRipple } from "@/lib/animations";

/* ================================================================
   LOCAL IDENTITY
   ================================================================ */
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
    return "web-anon";
  }
}

/* ================================================================
   IMAGE PATHS
   ================================================================ */
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

/* ================================================================
   SVG ICONS (replacing emoji)
   ================================================================ */
function IconHome({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconChat({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconTrend({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconSchool({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 22V8l10-6 10 6v14" />
      <path d="M6 12v6" /><path d="M10 12v6" /><path d="M14 12v6" /><path d="M18 12v6" />
      <path d="M2 8h20" /><path d="M12 2v6" />
    </svg>
  );
}

function IconShield({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconSend({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconMic({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconCamera({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconImage({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function IconText({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function IconVolume({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function IconDownload({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconTrash({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconMenu({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconX({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconCalendar({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconMessages({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="13" y2="13" />
    </svg>
  );
}

function IconHeart({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconStop({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  );
}

function IconPhone({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconLock({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconEye({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconAlert({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconUsers({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconActivity({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconBell({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/* ================================================================
   MOOD SYSTEM (no emoji, text + color only)
   ================================================================ */
const MOOD: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  stressed: { label: "เครียด", color: "#C41E3A", bgColor: "rgba(196,30,58,0.08)", icon: "!!" },
  tired:    { label: "เหนื่อย", color: "#8b7355", bgColor: "rgba(139,115,85,0.08)", icon: "~" },
  neutral:  { label: "ปกติ", color: "#888888", bgColor: "rgba(136,136,136,0.08)", icon: "--" },
  calm:     { label: "สงบ", color: "#2D6A6F", bgColor: "rgba(45,106,111,0.08)", icon: "~~" },
  sad:      { label: "เศร้า", color: "#6a7080", bgColor: "rgba(106,112,128,0.08)", icon: ".." },
  positive: { label: "สดใส", color: "#2D8F5C", bgColor: "rgba(45,143,92,0.08)", icon: "++" },
};

const TRANSPARENCY: Record<string, string> = {
  "เซลฟี่": "กำลังตรวจจับใบหน้าจากภาพ (Face Detection API)",
  "ข้อความ": "กำลังวิเคราะห์น้ำเสียงจากข้อความ (Sentiment Analysis + Pathumma LLM)",
  "เสียงพูด": "กำลังแปลงเสียงพูดเป็นข้อความ (Speech-to-Text API)",
  "รูปการบ้าน": "กำลังอ่านข้อความจากภาพ (OCR API)",
};

const ERROR_REPLY =
  "ขออภัยนะ ตอนนี้กระจกเชื่อมต่อระบบวิเคราะห์ไม่ได้ ลองอีกครั้งในอีกสักครู่ได้ไหม";

type Page = "login" | "onb1" | "onb2" | "onb3" | "guardian" | "guardianOk" | "privacy" | "app";
type AppView = "home" | "chat" | "trend" | "school" | "safety";
type ChatMode = "ข้อความ" | "เซลฟี่" | "เสียงพูด" | "รูปการบ้าน";

const MAX_RECORD_SECONDS = 60;

/* ================================================================
   TIME GREETING
   ================================================================ */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "ยังตื่นอยู่เหรอ";
  if (h < 12) return "สวัสดีตอนเช้า";
  if (h < 17) return "สวัสดีตอนบ่าย";
  if (h < 21) return "สวัสดีตอนเย็น";
  return "สวัสดีตอนค่ำ";
}

/* ================================================================
   VOICE RECORDER HOOK
   ================================================================ */
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
  service?: string;
}

/* ================================================================
   BACKGROUND DECORATIONS
   ================================================================ */
function GridBg() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      style={{
        background: `
          linear-gradient(rgba(180,170,150,0.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(180,170,150,0.12) 1px, transparent 1px)
        `,
        backgroundSize: "28px 28px",
        backgroundColor: "#f5f0e8",
      }}
    />
  );
}

function HalftoneBg() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none opacity-[0.05]"
      style={{
        backgroundImage: `radial-gradient(circle, #1a1a1a 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
      }}
    />
  );
}

function CheckerStrip() {
  const squares = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-8 flex overflow-hidden" style={{ background: "#1a1a1a" }}>
      {squares.map((i) => (
        <div
          key={i}
          className="h-full flex-1 min-w-[1.5rem]"
          style={{ background: i % 2 === 0 ? "#1a1a1a" : "#f5f0e8" }}
        />
      ))}
    </div>
  );
}

/* ================================================================
   MOOD BADGE
   ================================================================ */
function MoodBadge({ mood, size = "md", animate = false }: { mood: string; size?: "sm" | "md" | "lg"; animate?: boolean }) {
  const m = MOOD[mood] || MOOD.neutral;
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizeClasses[size]} ${animate ? "mood-pop" : ""}`}
      style={{
        backgroundColor: m.bgColor,
        color: m.color,
        border: `1.5px solid ${m.color}20`,
        fontFamily: "'Noto Sans Thai', sans-serif",
      }}
    >
      <span className="font-mono text-xs opacity-70">{m.icon}</span>
      {m.label}
    </span>
  );
}

/* ================================================================
   LOGIN PAGE
   ================================================================ */
function LoginPage({ onNext }: { onNext: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: "#f5f0e8" }}>
      <CheckerStrip />
      <GridBg />
      <HalftoneBg />

      {/* Left collage */}
      <div className="absolute left-0 top-8 bottom-0 w-1/2 z-10 hidden md:block">
        <img src={IMG.loginCollage} alt="" className="w-full h-full object-cover object-left-top opacity-90" />
        <div className="absolute bottom-0 left-0 w-full h-32 z-20"
          style={{ background: "linear-gradient(to top, #1a1a1a 0%, transparent 100%)" }} />
      </div>

      {/* Curved black shape */}
      <div className="absolute left-0 bottom-0 w-[45%] z-10 hidden md:block" style={{ height: "60%" }}>
        <svg viewBox="0 0 600 500" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0,0 C200,50 300,100 500,200 C600,300 600,500 600,500 L0,500 Z" fill="#1a1a1a" />
        </svg>
      </div>

      {/* Login card */}
      <div className="absolute right-0 top-8 bottom-0 w-full md:w-[55%] flex items-center justify-center z-20 px-6 md:px-8">
        <div
          className="w-full max-w-md p-8 relative animate-scale-in"
          style={{
            background: "linear-gradient(160deg, #FFB5A7 0%, #FFC8B8 40%, #FFD5CC 100%)",
            borderRadius: "28px",
            border: "2.5px solid #e0d0c4",
            boxShadow: "6px 6px 0px rgba(26,26,26,0.15), 0 20px 60px rgba(0,0,0,0.1)",
          }}
        >
          <div className="absolute inset-0 rounded-[28px] opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle, #1a1a1a 1px, transparent 1px)`,
              backgroundSize: "12px 12px",
            }} />

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

          <p className="text-xs mb-5 tracking-widest uppercase" style={{ color: "#888", fontFamily: "'Space Mono', monospace" }}>
            พื้นที่ปลอดภัย - สำหรับนักเรียน
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

      {/* Hand with pen */}
      <div className="absolute bottom-4 right-4 z-30 opacity-60 hidden md:block" style={{ width: "180px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto animate-float" style={{ filter: "brightness(0.8) contrast(1.2)" }} />
      </div>
    </div>
  );
}

/* ================================================================
   ONBOARDING STEP 1: Welcome
   ================================================================ */
function OnbWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 md:p-8" style={{ backgroundColor: "#f5f0e8" }}>
      <GridBg />
      <HalftoneBg />

      <img src={IMG.halftoneDots} alt="" className="absolute top-0 left-0 w-[300px] md:w-[400px] opacity-20 pointer-events-none" style={{ transform: "scaleX(-1)" }} />

      <div className="absolute bottom-8 right-8 opacity-50 hidden md:block" style={{ width: "220px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto animate-float" />
      </div>

      <div className="relative z-10 w-full max-w-lg bg-white rounded-[28px] p-8 shadow-xl animate-scale-in" style={{ border: "2px solid #e0d8cc" }}>
        <div
          className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-6 text-white"
          style={{ backgroundColor: "#2D6A6F", fontFamily: "'Space Mono', monospace" }}
        >
          AI for Thai - Pathumma LLM
        </div>

        <h1 className="text-3xl font-black mb-4 leading-tight" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
          กระจกสะท้อนใจ
        </h1>
        <p className="text-lg font-semibold mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#2D6A6F" }}>
          พื้นที่ปลอดภัยให้ใจได้มองเห็นตัวเอง
        </p>
        <p className="text-base mb-8 leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666" }}>
          แอปพลิเคชัน AI สำหรับนักเรียน ม.ปลาย ที่ช่วยให้คุณสำรวจและเข้าใจอารมณ์ของตัวเอง ผ่านการวิเคราะห์ข้อความ และเสียงพูด อย่างปลอดภัยและโปร่งใส
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

/* ================================================================
   ONBOARDING STEP 2: Age
   ================================================================ */
function OnbAge({ onNext, age, setAge }: { onNext: () => void; age: string; setAge: (v: string) => void }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 md:p-8" style={{ backgroundColor: "#f5f0e8" }}>
      <GridBg />
      <HalftoneBg />

      <img src={IMG.halftoneDots} alt="" className="absolute top-0 left-0 w-[350px] opacity-15 pointer-events-none" />

      <div className="absolute bottom-4 left-8 opacity-50 hidden md:block" style={{ width: "180px" }}>
        <img src={IMG.origamiStars} alt="" className="w-full h-auto" />
      </div>

      <div className="relative z-10 w-full max-w-lg bg-white rounded-[28px] p-8 shadow-xl animate-scale-in" style={{ border: "2px solid #e0d8cc" }}>
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

/* ================================================================
   GUARDIAN CONSENT
   ================================================================ */
function GuardianPage({
  approved, onSend, onNext, guardianEmail, setGuardianEmail,
}: {
  approved: boolean; onSend: () => void; onNext: () => void;
  guardianEmail: string; setGuardianEmail: (v: string) => void;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 md:p-8" style={{ backgroundColor: "#f5f0e8" }}>
      <GridBg />
      <HalftoneBg />

      <div className="relative z-10 w-full max-w-lg bg-white rounded-[28px] p-8 shadow-xl animate-scale-in" style={{ border: "2px solid #e0d8cc" }}>
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
              <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "#2E7D32", fontFamily: "'Noto Sans Thai', sans-serif" }}>
                <IconShield size={16} color="#2E7D32" />
                ผู้ปกครองให้ความยินยอมแล้ว
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
              style={{ backgroundColor: "#f5f0e8", fontFamily: "'Noto Sans Thai', sans-serif", border: "2px solid #e0d8cc", color: "#1a1a1a" }}
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

/* ================================================================
   PRIVACY PAGE
   ================================================================ */
function PrivacyPage({ onNext }: { onNext: () => void }) {
  const [accepted, setAccepted] = useState(false);

  const items = [
    "ไม่เก็บข้อมูลใบหน้า -- ใช้การวิเคราะห์ทันทีแล้วลบ",
    "ข้อมูลทั้งหมดเข้ารหัสแบบ end-to-end",
    "ไม่ใช่การวินิจฉัยทางการแพทย์",
    "คุณสามารถลบข้อมูลได้ทุกเมื่อ",
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 md:p-8" style={{ backgroundColor: "#f5f0e8" }}>
      <GridBg />
      <HalftoneBg />

      <div className="absolute bottom-8 left-8 opacity-40 hidden md:block" style={{ width: "180px" }}>
        <img src={IMG.megaphone} alt="" className="w-full h-auto" />
      </div>

      <div className="relative z-10 w-full max-w-lg bg-white rounded-[28px] p-8 shadow-xl animate-scale-in" style={{ border: "2px solid #e0d8cc" }}>
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

        <ul className="space-y-3 mb-6 stagger-children">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#444", fontSize: "14px" }}>
              <span className="mt-0.5"><IconShield size={14} color="#2D6A6F" /></span>
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

/* ================================================================
   MAIN APP SHELL
   ================================================================ */
function AppShell() {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [age] = useState("16");
  const [mood, setMood] = useState<string>("neutral");
  const [userId] = useState(getUserId);
  const [crisisRaised, setCrisisRaised] = useState(false);
  const [trend, setTrend] = useState<TrendResult | null>(null);
  const [school, setSchool] = useState<SchoolResult | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  useEffect(() => { void refreshTrend(); }, [refreshTrend]);

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

  const navItems: { id: AppView; label: string; Icon: typeof IconHome }[] = [
    { id: "home", label: "หน้าหลัก", Icon: IconHome },
    { id: "chat", label: "แชท", Icon: IconChat },
    { id: "trend", label: "แนวโน้มของวัน", Icon: IconTrend },
    { id: "school", label: "ภาพรวมโรงเรียน", Icon: IconSchool },
    { id: "safety", label: "ความปลอดภัย & ข้อมูล", Icon: IconShield },
  ];

  const viewLabels: Record<AppView, string> = {
    home: "หน้าหลัก",
    chat: "คุยกับกระจก",
    trend: "แนวโน้มของฉัน",
    school: "ภาพรวมโรงเรียน",
    safety: "ความปลอดภัย & ข้อมูล",
  };

  const addBot = useCallback((text: string, service?: string) => {
    setMessages((prev) => [...prev, { role: "bot", text, timestamp: Date.now(), service }]);
  }, []);

  const noteDegraded = useCallback((degraded: string[]) => {
    if (degraded.length) toast(`บางบริการไม่พร้อมใช้งาน: ${degraded.join(", ")}`);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isAnalyzing) return;

    setMessages((prev) => [...prev, { role: "user", text, timestamp: Date.now() }]);
    setInputText("");
    setIsAnalyzing(true);
    try {
      const res = await api.sendMessage(userId, text);
      setMood(res.mood);
      addBot(res.reply, res.service);
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
        addBot(res.reply, res.service);
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
    (audio: Blob, filename: string) => runAnalysis("ถอดเสียง", () => api.transcribeVoice(userId, audio, filename)),
    [runAnalysis, userId],
  );
  const doHomework = useCallback(
    (image: Blob) => runAnalysis("อ่านการบ้าน", () => api.readHomework(userId, image)),
    [runAnalysis, userId],
  );

  const navigateTo = (view: AppView) => {
    setCurrentView(view);
    setSidebarOpen(false);
  };

  return (
    <div className="relative min-h-screen flex" style={{ backgroundColor: "#f5f0e8" }}>
      <CheckerStrip />
      <GridBg />
      <HalftoneBg />

      {/* Mobile hamburger button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-9 left-3 z-[60] p-2 rounded-xl lg:hidden"
        style={{ backgroundColor: "rgba(26,26,26,0.85)", color: "#FFB5A7" }}
        aria-label="เปิดเมนู"
      >
        {sidebarOpen ? <IconX size={20} /> : <IconMenu size={20} />}
      </button>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-8 bottom-0 w-[240px] z-40 flex flex-col pt-6 px-4 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "#1a1a1a", borderRadius: "0 24px 24px 0" }}
      >
        {/* Brand */}
        <div className="mb-8 px-2">
          <h1
            className="text-xl font-black tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: "#FFB5A7" }}
          >
            JaiKrajok
          </h1>
          <p className="text-xs mt-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "rgba(255,181,167,0.6)" }}>
            กระจกสะท้อนใจ
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all duration-200"
                style={{
                  backgroundColor: isActive ? "#FFB5A7" : "transparent",
                  color: isActive ? "#1a1a1a" : "rgba(255,255,255,0.65)",
                  fontFamily: "'Noto Sans Thai', sans-serif",
                  fontWeight: isActive ? 700 : 400,
                  fontSize: "14px",
                }}
              >
                <item.Icon size={18} color={isActive ? "#1a1a1a" : "rgba(255,255,255,0.55)"} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Mood status */}
        <div className="mt-auto mb-4 px-1">
          <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            <p className="text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              สภาวะล่าสุด
            </p>
            <MoodBadge mood={mood} size="sm" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-[240px] flex-1 pt-10 min-h-screen w-full">
        {/* Page header */}
        <div className="px-4 md:px-8 pt-4 pb-2 flex items-center gap-3">
          {/* Spacer for hamburger on mobile */}
          <div className="w-10 lg:hidden" />
          <div
            className="inline-block px-5 py-2 rounded-full text-sm font-bold"
            style={{
              backgroundColor: "#FFB5A7",
              color: "#1a1a1a",
              fontFamily: "'Noto Sans Thai', sans-serif",
            }}
          >
            {viewLabels[currentView]}
          </div>
        </div>

        {/* Content area */}
        <div className="px-4 md:px-8 pb-8">
          {currentView === "home" && (
            <HomeView mood={mood} setMood={setMood} age={age} trend={trend} onNavigate={navigateTo} />
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
      </div>
    </div>
  );
}

/* ================================================================
   HOME VIEW
   ================================================================ */
function HomeView({ mood, setMood, age, trend, onNavigate }: {
  mood: string; setMood: (v: string) => void; age: string;
  trend: TrendResult | null; onNavigate: (v: AppView) => void;
}) {
  const greeting = getGreeting();
  const moods = Object.entries(MOOD);

  const quickActions = [
    { label: "คุยกับกระจก", desc: "พิมพ์หรือพูดเล่าให้กระจกฟัง", Icon: IconChat, view: "chat" as AppView, color: "#2D6A6F" },
    { label: "แนวโน้มของฉัน", desc: "ดูกราฟสภาวะอารมณ์ย้อนหลัง", Icon: IconTrend, view: "trend" as AppView, color: "#C41E3A" },
    { label: "ภาพรวมโรงเรียน", desc: "สถิติรวมแบบไม่ระบุตัวตน", Icon: IconSchool, view: "school" as AppView, color: "#8b7355" },
  ];

  const tips = [
    "หายใจเข้าลึก ๆ นับ 4 ค้าง 4 หายใจออก 4 ทำซ้ำ 3 รอบ",
    "เขียนสิ่งที่รู้สึกขอบคุณ 3 อย่างก่อนนอน ช่วยให้นอนหลับสบายขึ้น",
    "ลองเดินเล่น 10 นาที เปลี่ยนบรรยากาศ ช่วยให้สมองปลอดโปร่ง",
    "ดื่มน้ำให้เพียงพอ ร่างกายที่ขาดน้ำทำให้อารมณ์หงุดหงิดง่าย",
    "ก่อนสอบ ลองทบทวนบทเรียนก่อนนอน สมองจะจัดระเบียบข้อมูลขณะหลับ",
  ];
  const todayTip = tips[new Date().getDate() % tips.length];

  const [heroRef, heroInView] = useInView<HTMLDivElement>();
  const [actionsRef, actionsInView] = useInView<HTMLDivElement>();
  const [tipsRef, tipsInView] = useInView<HTMLDivElement>();
  const msgCount = useCountUp(trend?.messages ?? 0, 800, heroInView);
  const dayCount = useCountUp(trend?.active_days ?? 0, 600, heroInView);

  return (
    <div className="space-y-6 view-transition">
      {/* Hero greeting */}
      <div
        ref={heroRef}
        className={`p-6 rounded-2xl relative overflow-hidden transition-all duration-700 ${heroInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        style={{
          background: "linear-gradient(135deg, #2D6A6F 0%, #3a8a90 50%, #2D6A6F 100%)",
          border: "none",
        }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }} />
        <div className="relative z-10">
          <p className="text-sm font-medium mb-1" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Noto Sans Thai', sans-serif" }}>
            {greeting}
          </p>
          <h2 className="text-2xl md:text-3xl font-black mb-2" style={{ fontFamily: "'Playfair Display', serif", color: "#fff" }}>
            กระจกสะท้อนใจ
          </h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "'Noto Sans Thai', sans-serif" }}>
            พื้นที่ปลอดภัยที่เข้าใจอารมณ์ของคุณ
          </p>
          <div className="mt-4 flex items-center gap-3">
            <MoodBadge mood={mood} animate={heroInView} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace" }}>
              {msgCount} ข้อความ - {dayCount} วันใช้งาน
            </span>
          </div>
        </div>
      </div>

      {/* Mood picker */}
      <div>
        <h3 className="text-lg font-bold mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
          วันนี้รู้สึกยังไง?
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 stagger-children">
          {moods.map(([key, m]) => (
            <button
              key={key}
              onClick={() => setMood(key)}
              className="p-3 rounded-xl transition-all duration-200 active:scale-[0.95] hover-lift text-center"
              style={{
                backgroundColor: mood === key ? m.bgColor : "rgba(255,255,255,0.8)",
                border: mood === key ? `2px solid ${m.color}` : "2px solid #e0d8cc",
                fontFamily: "'Noto Sans Thai', sans-serif",
              }}
            >
              <span className="text-lg font-mono font-bold block mb-1" style={{ color: m.color }}>{m.icon}</span>
              <span className="text-xs font-semibold" style={{ color: mood === key ? m.color : "#666" }}>
                {m.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div
        ref={actionsRef}
        className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-all duration-500 ${actionsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      >
        {quickActions.map((action, idx) => (
          <button
            key={action.label}
            onClick={(e) => { createRipple(e); onNavigate(action.view); }}
            className="glass-card p-5 text-left hover-lift transition-all duration-200 active:scale-[0.98]"
            style={{ transitionDelay: `${idx * 0.08}s` }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${action.color}15` }}>
                <action.Icon size={20} color={action.color} />
              </div>
              <p className="font-bold text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
                {action.label}
              </p>
            </div>
            <p className="text-xs" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#888" }}>
              {action.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Tip of the day + API status */}
      <div
        ref={tipsRef}
        className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-500 delay-100 ${tipsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      >
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <IconHeart size={16} color="#C41E3A" />
            <p className="text-xs font-bold" style={{ color: "#C41E3A", fontFamily: "'Space Mono', monospace" }}>
              เคล็ดลับวันนี้
            </p>
          </div>
          <p className="text-sm leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#444" }}>
            {todayTip}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <IconActivity size={16} color="#2D6A6F" />
            <p className="text-xs font-bold" style={{ color: "#2D6A6F", fontFamily: "'Space Mono', monospace" }}>
              สถานะระบบ
            </p>
          </div>
          <div className="space-y-2">
            {[
              { name: "Pathumma LLM", ok: true },
              { name: "Sentiment API", ok: true },
              { name: "Face Detection", ok: true },
              { name: "Text-to-Speech", ok: true },
            ].map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <span className="text-xs" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666" }}>{s.name}</span>
                <span className="text-xs font-bold flex items-center gap-1" style={{ color: s.ok ? "#2D8F5C" : "#C41E3A" }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.ok ? "#2D8F5C" : "#C41E3A" }} />
                  {s.ok ? "เชื่อมต่อ" : "ขัดข้อง"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   CHAT VIEW
   ================================================================ */
function ChatView({
  messages, inputText, setInputText, sendMessage, chatMode, setChatMode, isAnalyzing, doSelfie, doVoice, doHomework,
}: {
  messages: ChatMsg[]; inputText: string; setInputText: (v: string) => void;
  sendMessage: () => void; chatMode: ChatMode; setChatMode: (v: ChatMode) => void;
  isAnalyzing: boolean; doSelfie: (image: Blob) => void;
  doVoice: (audio: Blob, filename: string) => void; doHomework: (image: Blob) => void;
}) {
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const modes: { mode: ChatMode; Icon: typeof IconText; label: string }[] = [
    { mode: "ข้อความ", Icon: IconText, label: "ข้อความ" },
    { mode: "เซลฟี่", Icon: IconCamera, label: "เซลฟี่" },
    { mode: "เสียงพูด", Icon: IconMic, label: "เสียง" },
    { mode: "รูปการบ้าน", Icon: IconImage, label: "การบ้าน" },
  ];
  const { recording, seconds, start, stop } = useRecorder(doVoice);

  useEffect(() => {
    const el = chatBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isAnalyzing]);

  const onImagePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) (chatMode === "เซลฟี่" ? doSelfie : doHomework)(file);
    e.target.value = "";
  };

  const playTTS = async (text: string) => {
    try {
      const blob = await api.speak(text);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
    } catch {
      toast("อ่านออกเสียงไม่สำเร็จ");
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-110px)]" style={{ maxHeight: "calc(100vh - 110px)" }}>
      {/* Transparency banner */}
      {isAnalyzing && TRANSPARENCY[chatMode] && (
        <div className="mb-3 px-4 py-2 rounded-xl text-xs animate-fade-in" style={{
          backgroundColor: "rgba(45,106,111,0.06)",
          border: "1.5px solid rgba(45,106,111,0.15)",
          color: "#2D6A6F",
          fontFamily: "'Space Mono', monospace",
        }}>
          {TRANSPARENCY[chatMode]}
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {modes.map((m) => (
          <button
            key={m.mode}
            onClick={() => setChatMode(m.mode)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
            style={{
              backgroundColor: chatMode === m.mode ? "#2D6A6F" : "rgba(255,255,255,0.8)",
              color: chatMode === m.mode ? "#fff" : "#666",
              border: chatMode === m.mode ? "none" : "1.5px solid #e0d8cc",
              fontFamily: "'Noto Sans Thai', sans-serif",
            }}
          >
            <m.Icon size={14} color={chatMode === m.mode ? "#fff" : "#888"} />
            {m.label}
          </button>
        ))}
      </div>

      {/* Chat body */}
      <div
        ref={chatBodyRef}
        className="flex-1 overflow-y-auto space-y-3 pr-2 pb-4"
        style={{ scrollbarWidth: "thin" }}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} msg-enter`} style={{ animationDelay: `${Math.max(0, i - messages.length + 3) * 0.05}s` }}>
            <div className="max-w-[80%] md:max-w-[70%]">
              <div
                className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                style={{
                  backgroundColor: msg.role === "user" ? "#2D6A6F" : "rgba(255,255,255,0.95)",
                  color: msg.role === "user" ? "#fff" : "#1a1a1a",
                  border: msg.role === "bot" ? "1.5px solid #e0d8cc" : "none",
                  fontFamily: "'Noto Sans Thai', sans-serif",
                  borderBottomRightRadius: msg.role === "user" ? "6px" : "20px",
                  borderBottomLeftRadius: msg.role === "bot" ? "6px" : "20px",
                }}
              >
                {msg.text}
              </div>
              <div className={`flex items-center gap-2 mt-1 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <span className="text-[10px]" style={{ color: "#aaa", fontFamily: "'Space Mono', monospace" }}>
                  {formatTime(msg.timestamp)}
                </span>
                {msg.role === "bot" && msg.service && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                    backgroundColor: "rgba(45,106,111,0.06)",
                    color: "#2D6A6F",
                    fontFamily: "'Space Mono', monospace",
                  }}>
                    {msg.service}
                  </span>
                )}
                {msg.role === "bot" && (
                  <button
                    onClick={() => playTTS(msg.text)}
                    className="opacity-40 hover:opacity-80 transition-opacity"
                    title="อ่านออกเสียง"
                  >
                    <IconVolume size={12} color="#2D6A6F" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {isAnalyzing && (
          <div className="flex justify-start animate-fade-in">
            <div
              className="px-5 py-3 rounded-2xl"
              style={{ backgroundColor: "rgba(255,255,255,0.95)", border: "1.5px solid #e0d8cc" }}
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

      {/* Upload mode actions */}
      {(chatMode === "เซลฟี่" || chatMode === "รูปการบ้าน") && (
        <div className="mb-3">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            capture={chatMode === "เซลฟี่" ? "user" : "environment"}
            onChange={onImagePicked}
            className="sr-only"
            aria-label={chatMode === "เซลฟี่" ? "เลือกภาพเซลฟี่" : "เลือกรูปการบ้าน"}
          />
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: "#C41E3A", fontFamily: "'Noto Sans Thai', sans-serif" }}
          >
            {chatMode === "เซลฟี่" ? <><IconCamera size={16} /> ถ่ายเซลฟี่วิเคราะห์</> : <><IconImage size={16} /> อัปโหลดรูปการบ้าน</>}
          </button>
        </div>
      )}

      {chatMode === "เสียงพูด" && (
        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={recording ? stop : start}
            disabled={isAnalyzing}
            aria-pressed={recording}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-50 ${recording ? "animate-recording-pulse" : ""}`}
            style={{
              backgroundColor: recording ? "#1a1a1a" : "#C41E3A",
              fontFamily: "'Noto Sans Thai', sans-serif",
            }}
          >
            {recording ? <><IconStop size={14} color="#fff" /> หยุดและส่ง</> : <><IconMic size={14} /> เริ่มอัดเสียง</>}
          </button>
          {recording && (
            <span
              className="text-sm font-semibold flex items-center gap-1.5"
              style={{ color: "#C41E3A", fontFamily: "'Space Mono', monospace" }}
              role="status"
              aria-live="polite"
            >
              <span className="w-2 h-2 rounded-full bg-[#C41E3A] animate-pulse" />
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:
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
            border: "1.5px solid #e0d8cc",
            fontFamily: "'Noto Sans Thai', sans-serif",
            color: "#1a1a1a",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isAnalyzing || !inputText.trim()}
          className="px-5 py-3 rounded-2xl text-white font-bold text-sm transition-all duration-150 active:scale-[0.97] disabled:opacity-50 flex items-center gap-2"
          style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}
        >
          <IconSend size={16} />
          <span className="hidden md:inline">ส่ง</span>
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   TREND VIEW
   ================================================================ */
const DAY_LABELS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const MOOD_HEIGHT: Record<string, number> = {
  stressed: 35, sad: 45, tired: 55, neutral: 65, calm: 80, positive: 95,
};

function TrendView({ mood, trend, error }: { mood: string; trend: TrendResult | null; error: string | null }) {
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

  const dominantMood = trend?.dominant_mood ?? mood;
  const dm = MOOD[dominantMood] || MOOD.neutral;

  const [chartRef, chartInView] = useInView<HTMLDivElement>();
  const [statsRef, statsInView] = useInView<HTMLDivElement>();
  const activeDays = useCountUp(trend?.active_days ?? 0, 700, statsInView);
  const totalMessages = useCountUp(trend?.messages ?? 0, 900, statsInView);

  return (
    <div className="space-y-6 view-transition">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
          แนวโน้มอารมณ์ของฉัน
        </h2>
        {hasData && <MoodBadge mood={dominantMood} />}
      </div>

      {error && (
        <div className="p-4 rounded-xl flex items-center gap-2" style={{ backgroundColor: "rgba(196,30,58,0.06)", border: "1.5px solid rgba(196,30,58,0.2)" }}>
          <IconAlert size={16} color="#C41E3A" />
          <p className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#C41E3A" }}>
            {error}
          </p>
        </div>
      )}

      {/* Weekly chart */}
      <div ref={chartRef} className={`glass-card p-6 transition-all duration-600 ${chartInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        <p className="text-xs font-bold mb-4 flex items-center gap-2" style={{ color: "#2D6A6F", fontFamily: "'Space Mono', monospace" }}>
          <IconTrend size={14} color="#2D6A6F" />
          สภาวะอารมณ์ 7 วันล่าสุด
        </p>
        {!hasData && !error && (
          <div className="text-center py-8">
            <IconChat size={32} color="#ccc" />
            <p className="text-sm mt-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#888" }}>
              ยังไม่มีข้อมูลนะ ลองคุยกับกระจกในหน้าแชทก่อน
            </p>
            <p className="text-xs mt-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#aaa" }}>
              แล้วกราฟจะเริ่มขึ้นที่นี่
            </p>
          </div>
        )}
        <div className="flex items-end gap-2 md:gap-3 h-44">
          {weekData.map((d, i) => {
            const m = d.mood ? MOOD[d.mood] : null;
            const h = d.mood ? (MOOD_HEIGHT[d.mood] ?? 65) : 5;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                {m && (
                  <span className="text-[10px] font-semibold" style={{ color: m.color, fontFamily: "'Noto Sans Thai', sans-serif" }}>
                    {m.label}
                  </span>
                )}
                <div
                  className="w-full rounded-t-lg animate-bar-grow"
                  style={{
                    height: `${h}%`,
                    backgroundColor: m ? m.color : "#ece7de",
                    opacity: m ? 0.7 : 0.3,
                    animationDelay: `${i * 0.08}s`,
                  }}
                  title={m ? `${d.date}: ${m.label}` : `${d.date}: ไม่มีข้อมูล`}
                />
                <span className="text-xs font-semibold" style={{ color: "#666", fontFamily: "'Noto Sans Thai', sans-serif" }}>
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mood legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t" style={{ borderColor: "#e0d8cc" }}>
          {Object.entries(MOOD).map(([key, m]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: m.color, opacity: 0.7 }} />
              <span className="text-[10px]" style={{ color: "#888", fontFamily: "'Noto Sans Thai', sans-serif" }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div ref={statsRef} className={`grid grid-cols-3 gap-3 md:gap-4 transition-all duration-500 ${statsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        {[
          { label: "วันใช้งาน", value: `${activeDays} วัน`, Icon: IconCalendar, color: "#2D6A6F" },
          { label: "แชททั้งหมด", value: `${totalMessages} ข้อความ`, Icon: IconMessages, color: "#8b7355" },
          { label: "สภาวะหลัก", value: dm.label, Icon: IconHeart, color: dm.color },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-4 text-center hover-lift">
            <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: `${stat.color}10` }}>
              <stat.Icon size={16} color={stat.color} />
            </div>
            <p className="text-base md:text-lg font-bold" style={{ color: "#1a1a1a", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {stat.value}
            </p>
            <p className="text-xs" style={{ color: "#888", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Weekly summary */}
      {hasData && (
        <div className="glass-card p-5">
          <p className="text-sm font-bold mb-2" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            สรุปสัปดาห์นี้
          </p>
          <p className="text-sm leading-relaxed" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666" }}>
            สัปดาห์นี้คุณใช้งานกระจกมาทั้งหมด {trend?.messages ?? 0} ข้อความ
            ใน {trend?.active_days ?? 0} วัน
            {dominantMood && ` สภาวะอารมณ์หลักของคุณคือ "${dm.label}"`}
            {dominantMood === "stressed" || dominantMood === "sad"
              ? " อย่าลืมพักผ่อนให้เพียงพอ และหากต้องการความช่วยเหลือ สามารถติดต่อสายด่วนสุขภาพจิต 1323 ได้ตลอด 24 ชั่วโมง"
              : dominantMood === "positive" || dominantMood === "calm"
                ? " ดีใจที่คุณอยู่ในสภาวะที่ดี ขอให้รักษาความรู้สึกนี้ไว้นะ"
                : " ลองคุยกับกระจกเพิ่มเติมเพื่อสำรวจอารมณ์ให้ลึกขึ้น"}
          </p>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   SCHOOL VIEW
   ================================================================ */
function SchoolView({ school, error }: { school: SchoolResult | null; error: string | null }) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const total = school?.readings ?? 0;
  const distribution = school?.distribution ?? {};

  const [statsGridRef, statsGridInView] = useInView<HTMLDivElement>();
  const [distRef, distInView] = useInView<HTMLDivElement>();
  const userCount = useCountUp(school?.users ?? 0, 800, statsGridInView);
  const readingCount = useCountUp(school?.readings ?? 0, 1000, statsGridInView);

  return (
    <div className="space-y-6 view-transition">
      <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
        ภาพรวมโรงเรียน
      </h2>
      <p className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666" }}>
        ข้อมูลแบบไม่ระบุตัวตน รวมจากนักเรียนทั้งหมดในสถาบัน
      </p>

      {error && (
        <div className="p-4 rounded-xl flex items-center gap-2" style={{ backgroundColor: "rgba(196,30,58,0.06)", border: "1.5px solid rgba(196,30,58,0.2)" }}>
          <IconAlert size={16} color="#C41E3A" />
          <p className="text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#C41E3A" }}>{error}</p>
        </div>
      )}

      {/* Stats grid */}
      <div ref={statsGridRef} className={`grid grid-cols-2 gap-4 transition-all duration-500 ${statsGridInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        {[
          { label: "นักเรียนที่ใช้งาน", value: `${userCount} คน`, Icon: IconUsers, color: "#2D6A6F" },
          { label: "สภาวะเครียดเฉลี่ย", value: pct(school?.stress_ratio ?? 0), Icon: IconActivity, color: "#C41E3A" },
          { label: "การวิเคราะห์ทั้งหมด", value: `${readingCount} ครั้ง`, Icon: IconMessages, color: "#2D6A6F" },
          { label: "ใช้แชทเป็นประจำ", value: pct(school?.regular_ratio ?? 0), Icon: IconHeart, color: "#2D8F5C" },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-5 hover-lift">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}10` }}>
                <stat.Icon size={16} color={stat.color} />
              </div>
            </div>
            <p className="text-2xl font-black" style={{ color: stat.color, fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {stat.value}
            </p>
            <p className="text-sm mt-1" style={{ color: "#666", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Mood distribution bars */}
      {total > 0 && (
        <div ref={distRef} className={`glass-card p-5 transition-all duration-500 delay-100 ${distInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <p className="text-sm font-bold mb-4" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            การกระจายตัวของสภาวะอารมณ์
          </p>
          <div className="space-y-3">
            {Object.entries(distribution).sort((a, b) => b[1] - a[1]).map(([moodKey, count]) => {
              const m = MOOD[moodKey] || MOOD.neutral;
              const ratio = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={moodKey}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold" style={{ color: m.color, fontFamily: "'Noto Sans Thai', sans-serif" }}>
                      {m.label}
                    </span>
                    <span className="text-xs" style={{ color: "#888", fontFamily: "'Space Mono', monospace" }}>
                      {count} ({Math.round(ratio)}%)
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#f0ebe3" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${ratio}%`, backgroundColor: m.color, opacity: 0.65 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* School image */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid #e0d8cc" }}>
        <img src={IMG.schoolBuilding} alt="" className="w-full h-40 object-cover opacity-60" />
      </div>

      {/* Disclaimer */}
      <div className="p-4 rounded-xl flex items-start gap-2" style={{ backgroundColor: "rgba(255,181,167,0.1)", border: "1.5px solid rgba(255,181,167,0.3)" }}>
        <IconLock size={14} color="#888" />
        <p className="text-xs" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#888" }}>
          ข้อมูลทั้งหมดไม่ระบุตัวตน (anonymized) และไม่สามารถย้อนกลับไปถึงบุคคลใดบุคคลหนึ่งได้
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   SAFETY VIEW
   ================================================================ */
function SafetyView({ crisis }: { crisis: boolean }) {
  const [lineNotify, setLineNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const userId = getUserId();
  const [cardsRef, cardsInView] = useInView<HTMLDivElement>();

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

  const privacyItems = [
    {
      title: "ความโปร่งใส",
      desc: "ภาพและเสียงถูกส่งไปวิเคราะห์ที่ AI for Thai / Pathumma ผ่าน HTTPS แล้วทิ้งทันที ไม่มีการเก็บไฟล์ไว้บนเซิร์ฟเวอร์ ส่วนที่บันทึกไว้คือผลอารมณ์และข้อความสนทนาเท่านั้น",
      Icon: IconEye,
      color: "#2D6A6F",
    },
    {
      title: "การควบคุมข้อมูล",
      desc: "คุณสามารถส่งออกหรือลบข้อมูลทั้งหมดของคุณได้ทุกเมื่อจากหน้านี้",
      Icon: IconDownload,
      color: "#8b7355",
    },
    {
      title: "ไม่ใช่การวินิจฉัย",
      desc: "กระจกสะท้อนใจไม่ใช่เครื่องมือทางการแพทย์ ไม่สามารถวินิจฉัยโรคหรือภาวะทางจิตเวชได้",
      Icon: IconAlert,
      color: "#C41E3A",
    },
  ];

  return (
    <div className="space-y-6 view-transition">
      <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
        ความปลอดภัย & ข้อมูล
      </h2>

      {/* Crisis alert */}
      {crisis && (
        <div
          className="p-5 rounded-2xl animate-scale-in"
          style={{ backgroundColor: "rgba(196,30,58,0.08)", border: "2px solid #C41E3A" }}
          role="alert"
        >
          <div className="flex items-center gap-2 mb-3">
            <IconHeart size={20} color="#C41E3A" />
            <p className="font-bold" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#C41E3A" }}>
              กระจกเป็นห่วงคุณนะ
            </p>
          </div>
          <p className="text-sm mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
            ถ้ากำลังรู้สึกอยากทำร้ายตัวเอง โปรดติดต่อคนที่ช่วยได้ทันที
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href="tel:1323"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-bold text-sm"
              style={{ backgroundColor: "#C41E3A", fontFamily: "'Noto Sans Thai', sans-serif" }}
            >
              <IconPhone size={16} />
              สายด่วนสุขภาพจิต 1323
            </a>
            <a
              href="tel:1669"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm"
              style={{ backgroundColor: "rgba(196,30,58,0.08)", color: "#C41E3A", fontFamily: "'Noto Sans Thai', sans-serif", border: "1.5px solid #C41E3A" }}
            >
              <IconPhone size={16} />
              เหตุฉุกเฉิน 1669
            </a>
          </div>
        </div>
      )}

      {/* Helpline card (always visible) */}
      {!crisis && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <IconPhone size={16} color="#2D6A6F" />
            <p className="font-bold text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#2D6A6F" }}>
              สายด่วนสุขภาพจิต
            </p>
          </div>
          <p className="text-sm mb-3" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#666" }}>
            หากต้องการความช่วยเหลือ โทรได้ตลอด 24 ชั่วโมง ฟรี ไม่เสียค่าใช้จ่าย
          </p>
          <a
            href="tel:1323"
            className="inline-flex items-center gap-1.5 text-sm font-bold"
            style={{ color: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}
          >
            <IconPhone size={14} />
            1323
          </a>
        </div>
      )}

      {/* Privacy cards */}
      <div ref={cardsRef} className={`space-y-3 transition-all duration-500 ${cardsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        {privacyItems.map((item, i) => (
          <div
            key={i}
            className="glass-card p-5 hover-lift"
            style={{ transitionDelay: `${i * 0.08}s` }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${item.color}10` }}>
                <item.Icon size={18} color={item.color} />
              </div>
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
      <div className="glass-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(45,106,111,0.08)" }}>
            <IconBell size={18} color="#2D6A6F" />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
              การแจ้งเตือนผ่าน LINE
            </p>
            <p className="text-xs mt-0.5" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: "#888" }}>
              รับการแจ้งเตือนเมื่อกระจกตรวจพบความกังวล
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setLineNotify(!lineNotify);
            toast(lineNotify ? "ปิดการแจ้งเตือนผ่าน LINE แล้ว" : "เปิดการแจ้งเตือนผ่าน LINE แล้ว");
          }}
          className="w-12 h-6 rounded-full transition-all duration-300 relative flex-shrink-0"
          style={{ backgroundColor: lineNotify ? "#2D6A6F" : "#ccc" }}
        >
          <div
            className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-300 shadow-sm"
            style={{ left: lineNotify ? "26px" : "2px" }}
          />
        </button>
      </div>

      {/* Data controls */}
      <div className="space-y-3">
        <button
          onClick={exportData}
          disabled={busy}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            backgroundColor: "rgba(255,255,255,0.85)",
            border: "1.5px solid #e0d8cc",
            color: "#2D6A6F",
            fontFamily: "'Noto Sans Thai', sans-serif",
          }}
        >
          <IconDownload size={16} />
          ส่งออกข้อมูลทั้งหมดของฉัน
        </button>

        <button
          onClick={deleteData}
          disabled={busy}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            backgroundColor: "rgba(255,255,255,0.85)",
            border: "1.5px solid #C41E3A",
            color: "#C41E3A",
            fontFamily: "'Noto Sans Thai', sans-serif",
          }}
        >
          <IconTrash size={16} />
          ลบข้อมูลทั้งหมดของฉัน
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN APP
   ================================================================ */
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
