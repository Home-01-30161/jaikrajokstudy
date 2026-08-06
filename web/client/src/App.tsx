import { useState, useRef, useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { gsap } from "gsap";
import katex from "katex";
import "katex/dist/katex.min.css";
import { marked } from "marked";
import {
  api,
  type ExportResult,
  type Mood,
  type SchoolResult,
  type TrendResult,
} from "@/lib/api";

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

/* ============ KATEX RENDERER ============ */
// Configure marked for safe, clean output
marked.setOptions({ breaks: true, gfm: true });

function renderMessageWithLatex(text: string): string {
  // 1. Protect LaTeX blocks from markdown parser by replacing with placeholders
  const latexBlocks: string[] = [];
  let protected_text = text;

  // Protect display math $$...$$
  protected_text = protected_text.replace(/\$\$([^$]+)\$\$/g, (_match, latex) => {
    const idx = latexBlocks.length;
    try {
      latexBlocks.push(katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false }));
    } catch {
      latexBlocks.push(`<span style="color:#EF4444">[LaTeX Error: ${escapeHtml(latex)}]</span>`);
    }
    return `%%LATEX_BLOCK_${idx}%%`;
  });

  // Protect inline math $...$
  protected_text = protected_text.replace(/\$([^$\n]+)\$/g, (_match, latex) => {
    const idx = latexBlocks.length;
    try {
      latexBlocks.push(katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false }));
    } catch {
      latexBlocks.push(`<span style="color:#EF4444">[LaTeX Error: ${escapeHtml(latex)}]</span>`);
    }
    return `%%LATEX_BLOCK_${idx}%%`;
  });

  // 2. Parse markdown
  let html = marked.parse(protected_text) as string;

  // 3. Restore LaTeX blocks
  html = html.replace(/%%LATEX_BLOCK_(\d+)%%/g, (_match, idx) => latexBlocks[parseInt(idx)] ?? "");

  // 4. Add Tailwind-friendly inline styles for markdown elements
  html = html
    .replace(/<h1>/g, '<h1 style="font-size:1.2em;font-weight:700;margin:0.75em 0 0.25em">')
    .replace(/<h2>/g, '<h2 style="font-size:1.1em;font-weight:700;margin:0.6em 0 0.2em">')
    .replace(/<h3>/g, '<h3 style="font-size:1em;font-weight:700;margin:0.5em 0 0.15em">')
    .replace(/<ul>/g, '<ul style="list-style:disc;padding-left:1.2em;margin:0.4em 0">')
    .replace(/<ol>/g, '<ol style="list-style:decimal;padding-left:1.2em;margin:0.4em 0">')
    .replace(/<li>/g, '<li style="margin:0.2em 0">')
    .replace(/<strong>/g, '<strong style="font-weight:700">')
    .replace(/<hr>/g, '<hr style="border:none;border-top:1px solid rgba(0,0,0,0.15);margin:0.5em 0">')
    .replace(/<p>/g, '<p style="margin:0.3em 0">');

  return html;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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

const EMO: Record<Mood, MoodInfo> = {
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

const TRANSPARENCY: Record<string, string> = {
  เซลฟี่: "กำลังตรวจว่ามีใบหน้าในภาพหรือไม่ ระบบไม่วิเคราะห์อารมณ์จากสีหน้า",
  ข้อความ: "กำลังวิเคราะห์น้ำเสียงจากข้อความ (Sentiment Analysis API)",
  เสียงพูด: "กำลังแปลงเสียงพูดเป็นข้อความ (Speech-to-Text API)",
  รูปการบ้าน: "กำลังอ่านข้อความจากภาพ (OCR API)",
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
  imageUrl?: string; // For displaying uploaded images
  imageType?: "selfie" | "homework"; // Type of image
}

interface TrendPoint {
  id: number;
  valence: number;
  color: string;
  key: Mood;
  label: string;
}

interface LogEntry {
  id: string;
  time: string;
  label: string;
  source: string;
  key: Mood;
}

interface TransparencyLog {
  id: string;
  timestamp: string;
  service: string;
  description: string;
  duration?: number;
  status: "processing" | "success" | "error";
}

/* ============ ICON COMPONENTS ============ */
function CameraIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function ImageIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function SpeakerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function RefreshIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function LightbulbIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function EyeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DownloadIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function SendIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function HandshakeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a4 4 0 0 1 8 0 4 4 0 0 1 8 0z" />
    </svg>
  );
}

function PhoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function AlertIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ClockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ServerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}


/* ============ CRISIS ALERT COMPONENT ============ */
function CrisisAlert({ onDismiss, onCall1323 }: { onDismiss: () => void; onCall1323: () => void }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 mx-auto mt-4 max-w-2xl"
      style={{
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    >
      <div
        className="mx-4 rounded-2xl p-6 shadow-2xl"
        style={{
          backgroundColor: "#FEF2F2",
          border: "2px solid #EF4444",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#FEE2E2" }}
          >
            <AlertIcon size={24} />
          </div>
          <div className="flex-1">
            <h3
              className="font-bold text-lg mb-2"
              style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#991B1B" }}
            >
              เราสังเกตเห็นว่าคุณอาจกำลังลำบากใจมาก
            </h3>
            <p
              className="text-sm mb-4"
              style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#7F1D1D" }}
            >
              คุณไม่ได้อยู่คนเดียว มีผู้เชี่ยวชาญพร้อมช่วยเหลือคุณตลอด 24 ชั่วโมง
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onCall1323}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-full font-bold text-sm transition-all"
                style={{
                  backgroundColor: "#EF4444",
                  color: "#FFFFFF",
                  fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#DC2626";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(239, 68, 68, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#EF4444";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.3)";
                }}
              >
                <PhoneIcon size={18} />
                โทร 1323 (สายด่วนสุขภาพจิต)
              </button>
              <button
                onClick={onDismiss}
                className="px-5 py-3 rounded-full font-semibold text-sm transition-all"
                style={{
                  backgroundColor: "#FFFFFF",
                  color: "#991B1B",
                  fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
                  border: "1.5px solid #FCA5A5",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#FEE2E2";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#FFFFFF";
                }}
              >
                ฉันโอเค ขอบคุณ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



function WindIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
    </svg>
  );
}

function AnchorIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="3" />
      <line x1="12" y1="22" x2="12" y2="8" />
      <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
    </svg>
  );
}

function ActivityIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function UsersIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TrendUpIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function ChevronRightIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeOffIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function TimerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <polyline points="12 9 12 13 15 15" />
      <path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83" />
    </svg>
  );
}

function LogOutIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ZapIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function HeartIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function QrCodeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="5" height="5" />
      <rect x="16" y="3" width="5" height="5" />
      <rect x="3" y="16" width="5" height="5" />
      <path d="M16 16h5v5h-5z" />
      <path d="M10 10h1v1h-1z" />
      <path d="M13 10h1v1h-1z" />
      <path d="M10 13h1v1h-1z" />
      <path d="M13 13h1v1h-1z" />
    </svg>
  );
}

function MessageSquareIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BellIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function TypeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function SunIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6m5.66-17A10 10 0 0 1 22 12a10 10 0 0 1-4.34 8.66m-11.32 0A10 10 0 0 1 2 12a10 10 0 0 1 4.34-8.66" />
    </svg>
  );
}

/* ============ EMOTION REGULATION TOOLS ============ */
type RegulationTool = "breathing" | "grounding" | "muscle";

const REGULATION_META: Record<RegulationTool, { title: string; blurb: string; minutes: string; icon: (size: number) => React.ReactNode }> = {
  breathing: {
    title: "แบบฝึกหายใจ 4-4-4",
    blurb: "หายใจเป็นจังหวะช้า ๆ ช่วยลดการเต้นของหัวใจและความตึงเครียด",
    minutes: "ประมาณ 2 นาที",
    icon: (s) => <WindIcon size={s} />,
  },
  grounding: {
    title: "Grounding 5-4-3-2-1",
    blurb: "พาความคิดกลับมาที่ปัจจุบันด้วยประสาทสัมผัสทั้งห้า",
    minutes: "ประมาณ 3 นาที",
    icon: (s) => <AnchorIcon size={s} />,
  },
  muscle: {
    title: "คลายกล้ามเนื้อทีละส่วน",
    blurb: "เกร็งแล้วคลายกล้ามเนื้อทีละจุด ช่วยให้ร่างกายรู้สึกเบาลง",
    minutes: "ประมาณ 3 นาที",
    icon: (s) => <ActivityIcon size={s} />,
  },
};

const BREATH_PHASES = [
  { key: "in", label: "หายใจเข้า", hint: "สูดลมเข้าทางจมูกช้า ๆ", seconds: 4, scale: 1 },
  { key: "hold", label: "กลั้นไว้", hint: "ค้างไว้เบา ๆ ไม่ต้องเกร็ง", seconds: 4, scale: 1 },
  { key: "out", label: "หายใจออก", hint: "ผ่อนลมออกทางปากยาว ๆ", seconds: 4, scale: 0.55 },
] as const;

const GROUNDING_STEPS = [
  { count: 5, sense: "มองเห็น", prompt: "มองรอบตัวแล้วบอกชื่อสิ่งที่คุณเห็น 5 อย่าง" },
  { count: 4, sense: "ได้ยิน", prompt: "ตั้งใจฟังเสียงรอบตัว 4 เสียง" },
  { count: 3, sense: "สัมผัสได้", prompt: "สังเกตสิ่งที่ผิวคุณสัมผัสอยู่ 3 อย่าง" },
  { count: 2, sense: "ได้กลิ่น", prompt: "หากลิ่นรอบตัว 2 กลิ่น หรือนึกถึงกลิ่นที่ชอบ" },
  { count: 1, sense: "รับรส", prompt: "สังเกตรสในปาก 1 รส หรือจิบน้ำหนึ่งอึก" },
];

const MUSCLE_STEPS = [
  { part: "มือและแขน", action: "กำหมัดแน่น 5 วินาที แล้วคลายออก" },
  { part: "ไหล่และคอ", action: "ยกไหล่ขึ้นชิดหู 5 วินาที แล้วปล่อยลง" },
  { part: "ใบหน้า", action: "ขมวดคิ้วและเม้มปาก 5 วินาที แล้วคลาย" },
  { part: "ท้องและหลัง", action: "แขม่วท้อง 5 วินาที แล้วหายใจออกยาว" },
  { part: "ขาและเท้า", action: "เกร็งขาและกระดกปลายเท้า 5 วินาที แล้วปล่อย" },
];

function BreathingRunner({ onFinish }: { onFinish: () => void }) {
  const TARGET_CYCLES = 6;
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState<number>(BREATH_PHASES[0].seconds);
  const [cycles, setCycles] = useState(0);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev > 1) return prev - 1;
        setPhaseIndex((idx) => {
          const next = (idx + 1) % BREATH_PHASES.length;
          if (next === 0) setCycles((c) => c + 1);
          return next;
        });
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    setRemaining(BREATH_PHASES[phaseIndex].seconds);
  }, [phaseIndex]);

  useEffect(() => {
    if (cycles >= TARGET_CYCLES) setRunning(false);
  }, [cycles]);

  const phase = BREATH_PHASES[phaseIndex];
  const done = cycles >= TARGET_CYCLES;

  return (
    <div className="text-center">
      <div className="flex items-center justify-center" style={{ height: "220px" }}>
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: "180px",
            height: "180px",
            background: `radial-gradient(circle at 35% 30%, #FFE1E8, ${T.salmon}22)`,
            border: `2px solid ${T.salmon}`,
            transform: `scale(${done ? 0.8 : phase.scale})`,
            transition: `transform ${phase.seconds}s ease-in-out`,
          }}
        >
          <div>
            <p className="font-bold" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black, fontSize: "1.1rem" }}>
              {done ? "เสร็จแล้ว" : phase.label}
            </p>
            {!done && (
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.salmon, fontSize: "2rem", fontWeight: 800, lineHeight: 1.1 }}>
                {remaining || phase.seconds}
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm mb-1" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#4a4a4a" }}>
        {done ? "ลองสังเกตดูว่าร่างกายรู้สึกต่างจากเมื่อกี้ไหม" : phase.hint}
      </p>
      <p className="text-xs mb-5" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#9CA3AF" }}>
        รอบที่ {Math.min(cycles + (done ? 0 : 1), TARGET_CYCLES)} / {TARGET_CYCLES}
      </p>

      <div className="flex gap-2 justify-center">
        {!done && (
          <button
            onClick={() => setRunning((r) => !r)}
            className="px-5 py-2.5 rounded-full text-sm font-bold transition-all active:scale-[0.97]"
            style={{ border: `2px solid ${T.salmon}`, color: T.salmon, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}
          >
            {running ? "พักไว้ก่อน" : "ทำต่อ"}
          </button>
        )}
        <button
          onClick={onFinish}
          className="px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all active:scale-[0.97]"
          style={{ backgroundColor: done ? T.salmon : T.black, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}
        >
          {done ? "เรียบร้อย" : "หยุดตรงนี้"}
        </button>
      </div>
    </div>
  );
}

function StepRunner({ steps, onFinish }: {
  steps: { title: string; body: string; badge: string }[];
  onFinish: () => void;
}) {
  const [index, setIndex] = useState(0);
  const last = index === steps.length - 1;
  const step = steps[index];

  return (
    <div>
      <div className="flex gap-1.5 mb-5">
        {steps.map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: i <= index ? T.salmon : "#E5E1D8" }}
          />
        ))}
      </div>

      <div className="p-5 rounded-2xl mb-5" style={{ backgroundColor: "#FFF7F3", border: "1.5px dashed #E3A48E" }}>
        <p className="text-xs font-bold mb-2" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.salmon, letterSpacing: "0.08em" }}>
          {step.badge}
        </p>
        <p className="font-bold text-base mb-1.5" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
          {step.title}
        </p>
        <p className="text-sm leading-relaxed" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#4a4a4a" }}>
          {step.body}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => (index === 0 ? onFinish() : setIndex((i) => i - 1))}
          className="px-5 py-2.5 rounded-full text-sm font-bold transition-all active:scale-[0.97]"
          style={{ border: "2px solid #D8D2C6", color: "#6b6b6b", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}
        >
          {index === 0 ? "ออก" : "ย้อนกลับ"}
        </button>
        <button
          onClick={() => (last ? onFinish() : setIndex((i) => i + 1))}
          className="flex-1 py-2.5 rounded-full text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
          style={{ backgroundColor: T.salmon, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}
        >
          {last ? "เรียบร้อย" : "ขั้นต่อไป"}
          {!last && <ChevronRightIcon size={15} />}
        </button>
      </div>
    </div>
  );
}

function EmotionRegulationModal({ tool, onClose }: { tool: RegulationTool; onClose: () => void }) {
  const meta = REGULATION_META[tool];
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groundingSteps = GROUNDING_STEPS.map((s) => ({
    badge: `${s.count} สิ่งที่คุณ${s.sense}`,
    title: s.prompt,
    body: "ไม่ต้องรีบ ค่อย ๆ นึกทีละอย่าง พูดในใจหรือพูดออกมาก็ได้",
  }));

  const muscleSteps = MUSCLE_STEPS.map((s, i) => ({
    badge: `ส่วนที่ ${i + 1} / ${MUSCLE_STEPS.length}`,
    title: s.part,
    body: s.action,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 no-ripple"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={meta.title}
        tabIndex={-1}
        className="w-full max-w-md rounded-3xl p-7 shadow-2xl outline-none"
        style={{ backgroundColor: "#FFFFFF", border: `2px solid ${T.salmon}` }}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFF0EB", color: T.salmon }}>
              {meta.icon(20)}
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
                {meta.title}
              </h3>
              <p className="text-[11px]" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#9CA3AF" }}>{meta.minutes}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="p-2 rounded-xl transition-colors hover:bg-black/5" style={{ color: "#9CA3AF" }}>
            <XIcon size={18} />
          </button>
        </div>

        {tool === "breathing" && <BreathingRunner onFinish={onClose} />}
        {tool === "grounding" && <StepRunner steps={groundingSteps} onFinish={onClose} />}
        {tool === "muscle" && <StepRunner steps={muscleSteps} onFinish={onClose} />}

        <p className="text-[10px] mt-5 pt-4 leading-relaxed" style={{ borderTop: "1px solid #EDE6D3", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#9CA3AF" }}>
          แบบฝึกนี้ทำงานในเครื่องของคุณทั้งหมด ไม่มีการส่งข้อมูลไปยังบริการ AI ใด ๆ หากอาการไม่ดีขึ้นหรือรู้สึกไม่ปลอดภัย โปรดโทร 1323
        </p>
      </div>
    </div>
  );
}

function EmotionRegulationCard({ mood, onPick }: { mood: Mood; onPick: (tool: RegulationTool) => void }) {
  const info = EMO[mood];
  const suggested: RegulationTool = mood === "stressed" ? "breathing" : mood === "sad" ? "grounding" : "muscle";

  return (
    <div className="p-5 rounded-2xl" style={{ backgroundColor: T.white, border: `1.5px solid ${info.concern ? "#E3A48E" : "#E2D9C2"}`, boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
      <h4 className="font-bold text-sm mb-1" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
        เครื่องมือคลายอารมณ์
      </h4>
      <p className="text-xs mb-3 leading-relaxed" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#666" }}>
        {info.concern
          ? "สภาวะล่าสุดดูหนักใจอยู่ ลองทำอะไรสั้น ๆ ให้ใจนิ่งลงก่อนไหม"
          : "ใช้ได้ทุกเมื่อที่อยากพักใจ ไม่ต้องรอให้รู้สึกแย่ก่อน"}
      </p>

      <div className="space-y-2">
        {(Object.keys(REGULATION_META) as RegulationTool[]).map((tool) => {
          const meta = REGULATION_META[tool];
          const isSuggested = info.concern && tool === suggested;
          return (
            <button
              key={tool}
              onClick={() => onPick(tool)}
              className="w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98]"
              style={{
                backgroundColor: isSuggested ? "#FFF0EB" : T.cream,
                border: isSuggested ? `1.5px solid ${T.salmon}` : "1.5px solid #E5E1D8",
              }}
            >
              <span className="flex-shrink-0" style={{ color: T.salmon }}>{meta.icon(18)}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold truncate" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
                  {meta.title}
                </span>
                <span className="block text-[10px]" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#8a8a8a" }}>
                  {meta.minutes}
                </span>
              </span>
              {isSuggested && (
                <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: T.salmon, color: "#fff", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
                  แนะนำ
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============ MULTI-MODAL STATUS INDICATOR ============ */
type ModalityMode = "text" | "selfie" | "voice" | "homework";
type ModalityPhase = "recording" | "processing" | "success" | "error";

interface ModalityState {
  mode: ModalityMode;
  status: ModalityPhase;
  startedAt: number;
  duration?: number;
  detail?: string;
}

const MODALITY_META: Record<ModalityMode, { label: string; service: string; icon: (size: number) => React.ReactNode }> = {
  text: { label: "ข้อความ", service: "Sentiment Analysis + Pathumma LLM", icon: (s) => <SendIcon size={s} /> },
  selfie: { label: "ภาพใบหน้า", service: "Face Detection", icon: (s) => <CameraIcon size={s} /> },
  voice: { label: "เสียงพูด", service: "Speech-to-Text", icon: (s) => <MicIcon size={s} /> },
  homework: { label: "รูปการบ้าน", service: "OCR", icon: (s) => <ImageIcon size={s} /> },
};

const PHASE_META: Record<ModalityPhase, { label: string; fg: string; bg: string; border: string }> = {
  recording: { label: "กำลังบันทึก", fg: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  processing: { label: "กำลังประมวลผล", fg: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
  success: { label: "เสร็จแล้ว", fg: "#047857", bg: "#F0FDF4", border: "#BBF7D0" },
  error: { label: "ไม่สำเร็จ", fg: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
};

function ModalityIndicator({ state }: { state: ModalityState }) {
  const mode = MODALITY_META[state.mode];
  const phase = PHASE_META[state.status];
  const busy = state.status === "recording" || state.status === "processing";

  // Live elapsed counter while the request is in flight.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) return;
    setElapsed(Date.now() - state.startedAt);
    const timer = window.setInterval(() => setElapsed(Date.now() - state.startedAt), 200);
    return () => window.clearInterval(timer);
  }, [busy, state.startedAt]);

  const timing = state.duration !== undefined
    ? `${(state.duration / 1000).toFixed(1)}s`
    : busy
      ? `${(elapsed / 1000).toFixed(1)}s`
      : null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
      style={{ backgroundColor: phase.bg, border: `1.5px solid ${phase.border}` }}
      role="status"
      aria-live="polite"
    >
      <span className="flex-shrink-0" style={{ color: phase.fg }}>{mode.icon(16)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: phase.fg }}>
          {mode.label} · {state.detail || phase.label}
        </p>
        <div className="h-1 mt-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(0,0,0,0.07)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: busy ? "45%" : "100%",
              backgroundColor: phase.fg,
              animation: busy ? "modality-slide 1.1s ease-in-out infinite" : undefined,
            }}
          />
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <span className="block text-[10px] hidden sm:block" style={{ fontFamily: "'IBM Plex Mono', monospace", color: phase.fg, opacity: 0.75 }}>
          {mode.service}
        </span>
        {timing && (
          <span className="block text-[10px] font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: phase.fg }}>
            {timing}
          </span>
        )}
      </div>
      <style>{`@keyframes modality-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(240%); } }`}</style>
    </div>
  );
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
  useEffect(() => {
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
          <h1 className="text-5xl font-black mb-5" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.red, lineHeight: 1.1 }}>JaiKraJok</h1>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(26,26,26,0.72)", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
            เริ่มใช้งานด้วยเซสชันแบบไม่ระบุตัวตน เราไม่ขอชื่อ อีเมล หรือรหัสผ่าน
          </p>
          <div className="rounded-2xl p-4 mb-6 text-sm" style={{ background: "rgba(255,255,255,0.62)", color: T.black, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
            ข้อความ ภาพ และเสียงจะถูกส่งไปยังบริการ AI เฉพาะเมื่อคุณเลือกใช้งานโหมดนั้น
          </div>

          <button
            onClick={onNext}
            className="w-full py-3.5 rounded-full font-bold text-white text-base transition-all active:scale-[0.97]"
            style={{ backgroundColor: T.red, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", boxShadow: "0 2px 12px rgba(196,30,58,0.3)" }}
          >
            เริ่มใช้งานแบบไม่ระบุตัวตน
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
  const valid = Boolean(age && Number(age) > 0 && Number(age) < 120);
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
          min="1"
          max="119"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="ระบุอายุของคุณ"
          className="w-full px-5 py-4 rounded-2xl mb-10 outline-none focus:ring-2 text-lg text-center"
          style={{ backgroundColor: "#EBE5DC", border: "2px solid #1a1a1a", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}
        />
        <button onClick={onNext} disabled={!valid} className="px-8 py-3 rounded-full transition-all active:scale-[0.97] disabled:opacity-50" style={{ backgroundColor: "#2D6A6F" }}>
          <span style={{ color: "#ffffff", fontWeight: "bold", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>ถัดไป</span>
        </button>
      </div>
    </div>
  );
}

function GuardianPage({ onNext }: { onNext: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 100);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>
      {!printMode && (
        <>
          <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-60" alt="" />
          <img src={IMG.shieldLockNoBg} className="absolute top-10 right-10 w-64 h-auto pointer-events-none z-0" alt="" />
          <img src={IMG.bulb} className="absolute bottom-16 left-16 w-32 h-auto pointer-events-none z-0" alt="" />
        </>
      )}
      <div
        className="relative mx-auto z-10"
        style={{
          background: "#ffffff",
          borderRadius: printMode ? "0" : "20px",
          padding: printMode ? "32px" : "48px 56px",
          maxWidth: printMode ? "100%" : "680px",
          width: "100%",
          boxShadow: printMode ? "none" : "0 10px 40px rgba(0,0,0,0.05)"
        }}
      >
        <div className="mb-2 flex items-center gap-3">
          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#FF3366", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div>
            <h2 className="text-[2rem] font-black leading-tight" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#1a1a1a" }}>
              หนังสือยินยอมของผู้ปกครอง
            </h2>
            <p className="text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#666", letterSpacing: "0.05em" }}>
              Guardian Consent Form • ใจกระจก v3.0
            </p>
          </div>
        </div>

        <div
          className="my-6 p-6 rounded-2xl text-sm leading-relaxed"
          style={{
            backgroundColor: "#FFF9F5",
            border: "2px solid #FFE4D6",
            fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
          }}
        >
          <div className="mb-5">
            <h3 className="font-bold text-base mb-2 flex items-center gap-2" style={{ color: "#C41E3A" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              สำคัญ: กรุณาอ่านก่อนอนุญาต
            </h3>
            <p style={{ color: "#4a4a4a", lineHeight: "1.7" }}>
              ระบบ "ใจกระจก" เป็นแพลตฟอร์มสนับสนุนสุขภาพจิตสำหรับนักเรียน โดยใช้ปัญญาประดิษฐ์ (AI) ช่วยวิเคราะห์อารมณ์และให้คำปรึกษาเบื้องต้น
            </p>
          </div>

          <div className="space-y-4 mb-5">
            <div>
              <h4 className="font-bold mb-1.5" style={{ color: "#1a1a1a" }}>1. ข้อจำกัดของระบบ</h4>
              <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: "#4a4a4a", paddingLeft: "0.5rem" }}>
                <li><strong>ไม่ใช่ผู้เชี่ยวชาญทางการแพทย์:</strong> ระบบนี้ไม่สามารถททดแทนนักจิตวิทยา จิตแพทย์ หรือที่ปรึกษาวิชาชีพได้</li>
                <li><strong>ไม่ใช่บริการฉุกเฉิน:</strong> หากบุตรหลานมีความคิดทำร้ายตนเองหรือผู้อื่น กรุณาติดต่อสายด่วนสุขภาพจิต <strong>1323</strong> ทันที</li>
                <li><strong>ความถูกต้องไม่สมบูรณ์:</strong> AI อาจวิเคราะห์ผิดพลาดได้ ไม่ควรใช้เป็นข้อมูลเดียวในการตัดสินใจ</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-1.5" style={{ color: "#1a1a1a" }}>2. การใช้ข้อมูลและความเป็นส่วนตัว</h4>
              <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: "#4a4a4a", paddingLeft: "0.5rem" }}>
                <li>ระบบใช้เซสชันแบบไม่ระบุตัวตน ไม่เก็บชื่อจริง เบอร์โทร หรือที่อยู่</li>
                <li>ข้อความ รูปภาพ และเสียงจะถูกส่งไปยังบริการ AI ภายนอก (AIFORTHAI, TokenMind) เพื่อวิเคราะห์</li>
                <li>ระบบบันทึกเฉพาะผลการวิเคราะห์อารมณ์ เวลา และสถิติการใช้งาน ไม่บันทึกเนื้อหาแชทหรือรูปภาพ</li>
                <li>ผู้ใช้สามารถลบข้อมูลได้ตลอดเวลาผ่านเมนู "ความปลอดภัยและข้อมูล"</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-1.5" style={{ color: "#1a1a1a" }}>3. บทบาทของผู้ปกครอง</h4>
              <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: "#4a4a4a", paddingLeft: "0.5rem" }}>
                <li>ควรติดตามการใช้งานของบุตรหลานอย่างสม่ำเสมอ</li>
                <li>หากระบบแจ้งเตือนความเสี่ยง (concern streak) กรุณาติดตามอาการและพูดคุยกับบุตรหลาน</li>
                <li>ระบบไม่แจ้งเตือนผู้ปกครองโดยอัตโนมัติ—ผู้ใช้ต้องแชร์ข้อมูลด้วยตนเอง</li>
                <li>แนะนำให้พาบุตรหลานพบนักจิตวิทยาโรงเรียนหากมีความกังวล</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-1.5" style={{ color: "#1a1a1a" }}>4. ข้อควรปฏิบัติ</h4>
              <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: "#4a4a4a", paddingLeft: "0.5rem" }}>
                <li>ใช้เป็นเครื่องมือเสริม ไม่ใช้เป็นทางเลือกเดียว</li>
                <li>สร้างบรรยากาศให้บุตรหลานรู้สึกปลอดภัยที่จะเล่าปัญหา</li>
                <li>ตรวจสอบสุขภาพจิตของบุตรหลานเป็นระยะ ไม่ควรพึ่งระบบเพียงอย่างเดียว</li>
              </ul>
            </div>
          </div>

          <div className="p-4 rounded-xl" style={{ backgroundColor: "#FFF3E0", border: "1.5px dashed #FF9800" }}>
            <p className="text-xs font-bold mb-1" style={{ color: "#E65100" }}>หมายเลขฉุกเฉิน:</p>
            <p className="text-sm" style={{ color: "#4a4a4a" }}>
              สายด่วนสุขภาพจิต: <strong style={{ color: "#C41E3A", fontSize: "1.1rem" }}>1323</strong> (24 ชั่วโมง ทุกวัน)
            </p>
          </div>
        </div>

        {!printMode && (
          <>
            <label className="flex gap-3 items-start p-5 rounded-2xl mb-4" style={{ backgroundColor: "#EBE5DC", color: "#1a1a1a", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
              <span className="text-sm leading-relaxed">
                <strong>ฉันในฐานะผู้ปกครองหรือผู้ใหญ่ที่บุตรหลานไว้ใจ</strong> รับทราบข้อจำกัดและความเสี่ยงของระบบแล้ว และเข้าใจว่า:
                <ul className="list-disc list-inside mt-2 ml-2 space-y-1 opacity-90">
                  <li>ระบบนี้ไม่ใช่บริการทางการแพทย์หรือฉุกเฉิน</li>
                  <li>ผู้ปกครองต้องติดตามและพูดคุยกับบุตรหลานเองด้วย</li>
                  <li>หากเกิดวิกฤติ ต้องติดต่อสายด่วน 1323 หรือผู้เชี่ยวชาญทันที</li>
                </ul>
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="px-6 py-3.5 rounded-full font-semibold transition-all active:scale-[0.97] flex items-center gap-2"
                style={{
                  backgroundColor: "#ffffff",
                  border: "2px solid #FF3366",
                  color: "#FF3366",
                  fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
                  fontSize: "0.95rem"
                }}
              >
                <DownloadIcon size={18} />
                พิมพ์หนังสือยินยอม
              </button>
              <button
                onClick={onNext}
                disabled={!confirmed}
                className="flex-1 py-3.5 rounded-full font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "#FF3366",
                  fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
                  fontSize: "0.95rem"
                }}
              >
                ยืนยันและไปต่อ
              </button>
            </div>
          </>
        )}

        {printMode && (
          <div className="mt-8 pt-6 border-t-2 border-dashed" style={{ borderColor: "#ddd" }}>
            <div className="grid grid-cols-2 gap-8 text-sm" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
              <div>
                <p className="mb-1 text-gray-600">ลายเซ็นผู้ปกครอง/ผู้ใหญ่:</p>
                <div className="border-b-2 border-black h-12"></div>
                <p className="mt-2 text-xs text-gray-500">ชื่อ: _______________________________</p>
              </div>
              <div>
                <p className="mb-1 text-gray-600">วันที่:</p>
                <div className="border-b-2 border-black h-12"></div>
                <p className="mt-2 text-xs text-gray-500">( ____ / ____ / ________ )</p>
              </div>
            </div>
            <p className="mt-6 text-xs text-center text-gray-500" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              เอกสารนี้สามารถเก็บไว้เป็นหลักฐานการรับทราบ • โครงการใจกระจก สังกัด {new Date().getFullYear() + 543}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .relative.mx-auto.z-10, .relative.mx-auto.z-10 * {
            visibility: visible;
          }
          .relative.mx-auto.z-10 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

function PrivacyPage({ onNext }: { onNext: () => void }) {
  const [accepted, setAccepted] = useState(false);
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
          <p className="mb-4">เราใช้เซสชันแบบไม่ระบุตัวตนและไม่ขอชื่อจริง โรงเรียน หรือข้อมูลติดต่อ</p>
          <p className="mb-4">1. ข้อความ ภาพ และเสียงจะถูกส่งไปยังบริการ AI ภายนอกเฉพาะเมื่อคุณเลือกใช้โหมดนั้น</p>
          <p className="mb-4">2. แอปไม่บันทึกเนื้อหาแชท ภาพ หรือเสียงลงฐานข้อมูล แต่บันทึกผลอารมณ์ เวลา แหล่งที่มา และจำนวนการใช้งาน</p>
          <p>3. คุณสามารถส่งออกหรือลบข้อมูลที่จัดเก็บได้จากเมนูความปลอดภัยและข้อมูล</p>
        </div>
        <label className="flex gap-3 items-start mb-6 text-sm" style={{ color: "#1a1a1a", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" />
          <span>ฉันอ่านสรุปนี้แล้วและต้องการเริ่มใช้งาน</span>
        </label>
        <button onClick={onNext} disabled={!accepted} className="px-8 py-3 rounded-full transition-all active:scale-[0.97] disabled:opacity-50" style={{ backgroundColor: "#2D6A6F" }}>
          <span style={{ color: "#ffffff", fontWeight: "bold", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>ยอมรับและเข้าสู่ระบบ</span>
        </button>
      </div>
    </div>
  );
}

/* ============ LIVE EMOTION INDICATOR ============ */
interface EmotionHistoryPoint {
  timestamp: number;
  mood: Mood;
}

function LiveEmotionIndicator({ history }: { history: EmotionHistoryPoint[] }) {
  if (history.length === 0) return null;

  const latest = history[history.length - 1];
  const latestInfo = EMO[latest.mood];
  const trajectory = history.slice(-5);

  return (
    <div className="p-4 rounded-2xl" style={{ backgroundColor: latestInfo.bg, border: `1.5px solid ${latestInfo.edge}` }}>
      <div className="flex items-center gap-3 mb-3">
        <HeartIcon size={18} />
        <h4 className="font-bold text-sm" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: latestInfo.text }}>
          อารมณ์ของคุณตอนนี้
        </h4>
      </div>
      <div className="text-center mb-4">
        <div className="text-5xl mb-2">{latestInfo.emoji}</div>
        <p className="text-sm font-medium" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: latestInfo.text }}>
          {latestInfo.label}
        </p>
      </div>
      {trajectory.length > 1 && (
        <div>
          <p className="text-xs mb-2" style={{ fontFamily: "'IBM Plex Mono', monospace", color: latestInfo.text, opacity: 0.7 }}>
            เส้นทางอารมณ์ในการสนทนานี้
          </p>
          <div className="flex items-center justify-center gap-2">
            {trajectory.map((pt, i) => (
              <div key={i} className="flex items-center">
                <span className="text-2xl">{EMO[pt.mood].emoji}</span>
                {i < trajectory.length - 1 && (
                  <ChevronRightIcon size={14} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ SAFETY INDICATORS ============ */
function SafetyIndicators() {
  return (
    <div className="flex items-center gap-2 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6B7280" }}>
      <span className="flex items-center gap-1" title="ข้อมูลเข้ารหัส">
        <LockIcon size={13} />
        <span className="hidden sm:inline">เข้ารหัส</span>
      </span>
      <span className="opacity-30">•</span>
      <span className="flex items-center gap-1" title="ไม่ระบุตัวตน">
        <EyeOffIcon size={13} />
        <span className="hidden sm:inline">ไม่ระบุชื่อ</span>
      </span>
      <span className="opacity-30">•</span>
      <span className="flex items-center gap-1" title="ลบอัตโนมัติใน 30 วัน">
        <TimerIcon size={13} />
        <span className="hidden sm:inline">30 วัน</span>
      </span>
    </div>
  );
}

/* ============ EMERGENCY EXIT BUTTON ============ */
function EmergencyExitButton() {
  const handleExit = () => {
    if (confirm('ต้องการออกจากระบบและลบข้อมูลทั้งหมดในเครื่องนี้หรือไม่?')) {
      localStorage.clear();
      window.location.href = '/';
    }
  };

  return (
    <button
      onClick={handleExit}
      className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors hover:bg-red-50"
      style={{ color: '#EF4444' }}
      title="ออกจากระบบอย่างปลอดภัย"
    >
      <LogOutIcon size={16} />
      <span className="text-sm font-medium" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
        ออกฉุกเฉิน
      </span>
    </button>
  );
}

/* ============ PANIC BUTTON ============ */
function PanicButton() {
  const handlePanic = () => {
    if (confirm('คุณต้องการโทรหา 1323 (สายด่วนสุขภาพจิต) เลยไหม?')) {
      window.location.href = 'tel:1323';
    }
  };

  return (
    <button
      onClick={handlePanic}
      className="fixed top-4 right-4 z-40 w-14 h-14 rounded-full shadow-lg transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
      style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
      title="โทร 1323 ทันที"
      aria-label="ปุ่มฉุกเฉิน โทร 1323"
    >
      <ZapIcon size={24} />
    </button>
  );
}

/* ============ LINE INTEGRATION ============ */
function LINEIntegration() {
  const [qrGenerated, setQrGenerated] = useState(false);

  const generateQR = () => {
    setQrGenerated(true);
    toast.success('QR Code สร้างแล้ว (ตัวอย่าง)');
  };

  return (
    <div className="p-6 rounded-2xl" style={{ backgroundColor: '#F0FDF4', border: '2px solid #10B981' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#06B876', color: '#FFFFFF' }}>
          <MessageSquareIcon size={24} />
        </div>
        <div>
          <h3 className="font-bold text-base" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#1a1a1a' }}>
            เชื่อมต่อกับ LINE
          </h3>
          <p className="text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#6B7280' }}>
            รับการแจ้งเตือนและติดตาม
          </p>
        </div>
      </div>

      {!qrGenerated ? (
        <button
          onClick={generateQR}
          className="w-full px-4 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ backgroundColor: '#06B876', color: '#FFFFFF' }}
        >
          <QrCodeIcon size={18} />
          <span className="font-bold" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
            สร้าง QR Code เชื่อมต่อ
          </span>
        </button>
      ) : (
        <div className="text-center">
          <div className="w-48 h-48 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FFFFFF', border: '2px solid #10B981' }}>
            <QrCodeIcon size={80} />
          </div>
          <p className="text-sm mb-4" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#374151' }}>
            สแกนเพื่อเชื่อม LINE Official Account
          </p>
        </div>
      )}

      <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: '#FFFFFF' }}>
        <p className="text-xs font-bold mb-2" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#1a1a1a' }}>
          คุณจะได้รับ:
        </p>
        <ul className="text-xs space-y-1.5" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#374151' }}>
          <li className="flex items-start gap-2">
            <BellIcon size={14} />
            <span>แจ้งเตือนตรวจสุขภาพจิตทุกวัน</span>
          </li>
          <li className="flex items-start gap-2">
            <MessageSquareIcon size={14} />
            <span>ติดตามอารมณ์ผ่าน LINE Chat</span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldIcon size={14} />
            <span>รับทรัพยากรช่วยเหลือ</span>
          </li>
        </ul>
      </div>

      <p className="text-[10px] mt-3 flex items-center gap-1.5" style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#6B7280' }}>
        <LockIcon size={12} />
        ยังคงไม่ระบุตัวตน ไม่ต้องใช้ชื่อจริง
      </p>
    </div>
  );
}

/* ============ ACCESSIBILITY SETTINGS ============ */
type FontSize = 'normal' | 'large' | 'xlarge';
type ContrastMode = 'normal' | 'high';
type FontFamily = 'default' | 'dyslexic';

interface AccessibilityState {
  fontSize: FontSize;
  contrastMode: ContrastMode;
  fontFamily: FontFamily;
}

function AccessibilitySettings({ settings, onChange }: { settings: AccessibilityState; onChange: (s: AccessibilityState) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#1a1a1a' }}>
          <SettingsIcon size={16} />
          การตั้งค่าการเข้าถึง
        </h4>
      </div>

      {/* Font Size */}
      <div className="p-4 rounded-xl" style={{ backgroundColor: '#F3F4F6' }}>
        <label className="block text-xs font-bold mb-2" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#374151' }}>
          <TypeIcon size={14} /> ขนาดตัวอักษร
        </label>
        <div className="flex gap-2">
          {[
            { value: 'normal' as FontSize, label: 'ปกติ' },
            { value: 'large' as FontSize, label: 'ใหญ่' },
            { value: 'xlarge' as FontSize, label: 'ใหญ่มาก' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...settings, fontSize: opt.value })}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: settings.fontSize === opt.value ? T.salmon : '#FFFFFF',
                color: settings.fontSize === opt.value ? '#FFFFFF' : '#374151',
                border: `1.5px solid ${settings.fontSize === opt.value ? T.salmon : '#D1D5DB'}`,
                fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contrast Mode */}
      <div className="p-4 rounded-xl" style={{ backgroundColor: '#F3F4F6' }}>
        <label className="block text-xs font-bold mb-2" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#374151' }}>
          <SunIcon size={14} /> ความคมชัดสี
        </label>
        <div className="flex gap-2">
          {[
            { value: 'normal' as ContrastMode, label: 'ปกติ' },
            { value: 'high' as ContrastMode, label: 'สูง' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...settings, contrastMode: opt.value })}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: settings.contrastMode === opt.value ? T.salmon : '#FFFFFF',
                color: settings.contrastMode === opt.value ? '#FFFFFF' : '#374151',
                border: `1.5px solid ${settings.contrastMode === opt.value ? T.salmon : '#D1D5DB'}`,
                fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Family */}
      <div className="p-4 rounded-xl" style={{ backgroundColor: '#F3F4F6' }}>
        <label className="block text-xs font-bold mb-2" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#374151' }}>
          <TypeIcon size={14} /> รูปแบบตัวอักษร
        </label>
        <div className="flex gap-2">
          {[
            { value: 'default' as FontFamily, label: 'ปกติ' },
            { value: 'dyslexic' as FontFamily, label: 'อ่านง่าย' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...settings, fontFamily: opt.value })}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: settings.fontFamily === opt.value ? T.salmon : '#FFFFFF',
                color: settings.fontFamily === opt.value ? '#FFFFFF' : '#374151',
                border: `1.5px solid ${settings.fontFamily === opt.value ? T.salmon : '#D1D5DB'}`,
                fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] leading-relaxed" style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#6B7280' }}>
        การตั้งค่าจะบันทึกในเครื่องของคุณ ไม่ถูกส่งไปที่เซิร์ฟเวอร์
      </p>
    </div>
  );
}

/* ============ SESSION SUMMARY ============ */
interface SessionSummary {
  duration: number;
  startMood: Mood;
  endMood: Mood;
  concernsDiscussed: number;
  apiCallsCount: number;
}

function SessionSummaryCard({ summary }: { summary: SessionSummary }) {
  const startInfo = EMO[summary.startMood];
  const endInfo = EMO[summary.endMood];
  const minutes = Math.floor(summary.duration / 60000);

  return (
    <div className="p-5 rounded-2xl" style={{ backgroundColor: '#F9FAFB', border: '2px solid #E5E7EB' }}>
      <h4 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#1a1a1a' }}>
        <ClockIcon size={16} />
        สรุปการสนทนา
      </h4>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-[10px] mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#6B7280' }}>
            อารมณ์เริ่มต้น
          </p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{startInfo.emoji}</span>
            <span className="text-xs" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#374151' }}>
              {startInfo.label}
            </span>
          </div>
        </div>
        <div>
          <p className="text-[10px] mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#6B7280' }}>
            อารมณ์ตอนนี้
          </p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{endInfo.emoji}</span>
            <span className="text-xs" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#374151' }}>
              {endInfo.label}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 p-3 rounded-xl" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="text-center">
          <p className="text-lg font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.salmon }}>
            {minutes}
          </p>
          <p className="text-[10px]" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#6B7280' }}>
            นาที
          </p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.salmon }}>
            {summary.concernsDiscussed}
          </p>
          <p className="text-[10px]" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#6B7280' }}>
            ประเด็น
          </p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.salmon }}>
            {summary.apiCallsCount}
          </p>
          <p className="text-[10px]" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#6B7280' }}>
            AI calls
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============ MAIN APP SHELL ============ */
function AppShell({ age, guardianConsent }: { age: string; guardianConsent: boolean }) {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [mood, setMood] = useState<Mood>("calm");
  const [sessionReady, setSessionReady] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);

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
  const [transparencyLogs, setTransparencyLogs] = useState<string[]>([]);
  const [detailedTransparencyLogs, setDetailedTransparencyLogs] = useState<TransparencyLog[]>([]);
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const [crisisDetected, setCrisisDetected] = useState(false);
  const escalationShownRef = useRef(false);
  const [showSupportStrip, setShowSupportStrip] = useState(false);
  const [activeRegulationTool, setActiveRegulationTool] = useState<RegulationTool | null>(null);
  const [modalityState, setModalityState] = useState<ModalityState | null>(null);
  const [emotionHistory, setEmotionHistory] = useState<EmotionHistoryPoint[]>([]);
  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilityState>({
    fontSize: 'normal',
    contrastMode: 'normal',
    fontFamily: 'default',
  });
  const [sessionStartTime] = useState(Date.now());
  const [sessionStartMood] = useState<Mood>("calm");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const escalationRef = useRef<HTMLDivElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const homeworkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    console.log('[Session] Creating session...');
    api.createSession()
      .then(() => {
        if (!cancelled) {
          console.log('[Session] Session created successfully');
          setSessionReady(true);
          toast.success('เซสชันพร้อมใช้งาน');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[Session] Failed to create session:', error);
          toast.error("เริ่มเซสชันไม่สำเร็จ โปรดลองโหลดหน้าใหม่");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const speakText = async (text: string) => {
    if (!text.trim()) return;

    toast("กำลังอ่านข้อความเสียง...");

    try {
      // Use backend TTS API (AI for Thai Vaja9)
      const audioBlob = await api.speak(text.slice(0, 300)); // API limit: 300 chars

      // Play the audio
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();

      // Cleanup after playing
      audio.onended = () => URL.revokeObjectURL(audioUrl);
    } catch (err) {
      console.error("TTS error:", err);
      toast("ไม่สามารถอ่านข้อความได้ในขณะนี้");
    }
  };

  const pushTrend = useCallback((key: Mood, sourceLabel: string) => {
    const info = EMO[key];
    setMood(key);
    setEmotionHistory((prev) => [...prev, { timestamp: Date.now(), mood: key }]);
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
    const transNote = TRANSPARENCY[sourceLabel] || "กำลังวิเคราะห์ข้อมูลด้วย Pathumma LLM";
    setTransparencyLogs((prev) => [transNote, ...prev.slice(0, 4)]);

    // Add detailed transparency log
    const logId = Math.random().toString();
    const timestamp = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const serviceMap: Record<string, string> = {
      "เซลฟี่": "Face Detection (AIFORTHAI)",
      "ข้อความ": "Sentiment Analysis (AIFORTHAI)",
      "เสียงพูด": "Speech-to-Text (TokenMind ptm-asr-1)",
      "รูปการบ้าน": "OCR (AIFORTHAI)",
    };

    setDetailedTransparencyLogs((prev) => [
      {
        id: logId,
        timestamp,
        service: serviceMap[sourceLabel] || "Pathumma LLM (TokenMind thaillm-8b)",
        description: transNote,
        status: "processing",
      },
      ...prev.slice(0, 9),
    ]);
  }, []);

  const sendMessage = useCallback(async (overrideText?: string, sourceLabel: string = "ข้อความ") => {
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    if (!textToSend.trim()) return;
    if (!sessionReady) {
      toast("กำลังเตรียมเซสชัน โปรดลองอีกครั้งในอีกสักครู่");
      return;
    }
    if (isAnalyzing) {
      toast("กรุณารอให้คำขอก่อนหน้าเสร็จก่อน");
      return;
    }
    if (overrideText === undefined) setInputText("");

    // Build history BEFORE setMessages (React state is async — messages still
    // reflects the previous render here, which is exactly what we want as context)
    const chatHistory = messages
      .filter((m) => m.text && !m.imageUrl)
      .slice(-10)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, { id: Math.random().toString(), role: "user", text: textToSend, timestamp: Date.now(), sourceTag: sourceLabel !== "ข้อความ" ? sourceLabel : undefined }]);
    noteMultimodal(sourceLabel);
    setIsAnalyzing(true);
    setModalityState({ mode: "text", status: "processing", startedAt: Date.now() });

    const startTime = Date.now();
    try {
      const result = await api.sendMessage(textToSend.trim(), chatHistory);
      const duration = Date.now() - startTime;
      setModalityState({ mode: "text", status: "success", startedAt: startTime, duration });

      // Update last log to success
      setDetailedTransparencyLogs((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[0] = { ...updated[0], status: "success", duration };
        return updated;
      });

      setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: result.reply, timestamp: Date.now() }]);
      pushTrend(result.mood, sourceLabel);
      setDataRevision((revision) => revision + 1);
      if (result.degraded.length > 0) {
        toast("บางบริการ AI ขัดข้องชั่วคราว ระบบใช้ผลสำรองแทน");
      }
      if (result.crisis) {
        setShowEscalationModal(true);
        setCrisisDetected(true);
        setShowCrisisAlert(true);
      }
    } catch (error) {
      // Update last log to error
      setDetailedTransparencyLogs((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[0] = { ...updated[0], status: "error" };
        return updated;
      });

      setModalityState({ mode: "text", status: "error", startedAt: startTime, detail: error instanceof Error ? error.message : undefined });
      toast.error(error instanceof Error ? error.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setIsAnalyzing(false);
    }
  }, [inputText, isAnalyzing, noteMultimodal, pushTrend, sessionReady]);

  const analyzeSelfie = async (image: Blob, filename: string) => {
    const imageUrl = URL.createObjectURL(image);

    setMessages((prev) => [...prev, {
      id: Math.random().toString(),
      role: "user",
      text: "ส่งภาพเพื่อตรวจว่ามีใบหน้าในภาพหรือไม่",
      timestamp: Date.now(),
      sourceTag: "เซลฟี่",
      imageUrl,
      imageType: "selfie"
    }]);
    noteMultimodal("เซลฟี่");
    setIsAnalyzing(true);
    const selfieStart = Date.now();
    setModalityState({ mode: "selfie", status: "processing", startedAt: selfieStart });

    try {
      const result = await api.analyzeSelfie(image, filename);
      setModalityState({ mode: "selfie", status: "success", startedAt: selfieStart, duration: Date.now() - selfieStart });
      setMessages((prev) => [...prev, {
        id: Math.random().toString(),
        role: "bot",
        text: result.reply,
        timestamp: Date.now(),
        cardType: "emotion",
        emotionData: {
          label: "ตรวจใบหน้า",
          note: result.detail || result.reply,
          color: T.salmon,
          bg: "#F1DEE3",
          text: "#6B3B49",
        },
      }]);
      if (!result.ok) toast.error(result.error || "วิเคราะห์ภาพไม่สำเร็จ");
    } catch (error) {
      setModalityState({ mode: "selfie", status: "error", startedAt: selfieStart, detail: error instanceof Error ? error.message : undefined });
      toast.error(error instanceof Error ? error.message : "วิเคราะห์ภาพไม่สำเร็จ");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelfie = () => {
    if (!sessionReady) return toast("กำลังเตรียมเซสชัน โปรดลองอีกครั้งในอีกสักครู่");
    if (isAnalyzing) return toast("กรุณารอให้คำขอก่อนหน้าเสร็จก่อน");
    selfieInputRef.current?.click();
  };

  const handleSelfieFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void analyzeSelfie(file, file.name || "selfie.jpg");
  };

  const handleVoice = async () => {
    if (!sessionReady) return toast("กำลังเตรียมเซสชัน โปรดลองอีกครั้งในอีกสักครู่");
    if (isAnalyzing) return toast("กรุณารอให้คำขอก่อนหน้าเสร็จก่อน");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return toast.error("เบราว์เซอร์นี้ไม่รองรับการบันทึกเสียง");
    }

    let stream: MediaStream | null = null;
    setIsAnalyzing(true);
    noteMultimodal("เสียงพูด");
    const voiceStart = Date.now();
    setModalityState({ mode: "voice", status: "recording", startedAt: voiceStart });
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((mime) => MediaRecorder.isTypeSupported(mime));
      const recorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
      const chunks: Blob[] = [];
      const audio = await new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error("บันทึกเสียงไม่สำเร็จ"));
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        recorder.start();
        window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 5000);
        toast("กำลังบันทึกเสียงไม่เกิน 5 วินาที");
      });
      if (!audio.size) throw new Error("ไม่พบเสียงที่บันทึก");

      setModalityState({ mode: "voice", status: "processing", startedAt: voiceStart });
      const extension = audio.type.includes("mp4") ? "m4a" : "webm";
      const result = await api.transcribeVoice(audio, `voice.${extension}`);
      setModalityState({ mode: "voice", status: "success", startedAt: voiceStart, duration: Date.now() - voiceStart });
      if (result.transcript) {
        setMessages((prev) => [...prev, { id: Math.random().toString(), role: "user", text: `(เสียงพูด) "${result.transcript}"`, timestamp: Date.now(), sourceTag: "เสียงพูด" }]);
      }
      setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: result.reply, timestamp: Date.now() }]);
      if (result.ok) {
        pushTrend(result.mood, "เสียงพูด");
        setDataRevision((revision) => revision + 1);
      } else {
        toast.error(result.error || "แปลงเสียงไม่สำเร็จ");
      }
    } catch (error) {
      setModalityState({ mode: "voice", status: "error", startedAt: voiceStart, detail: error instanceof Error ? error.message : undefined });
      toast.error(error instanceof Error ? error.message : "แปลงเสียงไม่สำเร็จ");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setIsAnalyzing(false);
    }
  };

  const analyzeHomework = async (image: Blob, filename: string) => {
    const imageUrl = URL.createObjectURL(image);

    setMessages((prev) => [...prev, {
      id: Math.random().toString(),
      role: "user",
      text: "ส่งรูปการบ้านให้ใจกระจกอ่านข้อความ",
      timestamp: Date.now(),
      sourceTag: "รูปการบ้าน",
      imageUrl,
      imageType: "homework"
    }]);
    noteMultimodal("รูปการบ้าน");
    setIsAnalyzing(true);
    const ocrStart = Date.now();
    setModalityState({ mode: "homework", status: "processing", startedAt: ocrStart });

    try {
      const result = await api.readHomework(image, filename);
      setModalityState({ mode: "homework", status: "success", startedAt: ocrStart, duration: Date.now() - ocrStart });
      if (result.detail) {
        setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: "อ่านข้อความจากภาพแล้ว", timestamp: Date.now(), cardType: "ocr", ocrText: `"${result.detail}"` }]);
      }
      setMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot", text: result.reply, timestamp: Date.now() }]);
      if (result.ok) {
        pushTrend(result.mood, "รูปการบ้าน");
        setDataRevision((revision) => revision + 1);
      } else {
        toast.error(result.error || "อ่านการบ้านไม่สำเร็จ");
      }
    } catch (error) {
      setModalityState({ mode: "homework", status: "error", startedAt: ocrStart, detail: error instanceof Error ? error.message : undefined });
      toast.error(error instanceof Error ? error.message : "อ่านการบ้านไม่สำเร็จ");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleHomeworkPhoto = () => {
    if (!sessionReady) return toast("กำลังเตรียมเซสชัน โปรดลองอีกครั้งในอีกสักครู่");
    if (isAnalyzing) return toast("กรุณารอให้คำขอก่อนหน้าเสร็จก่อน");
    homeworkInputRef.current?.click();
  };

  const handleHomeworkFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void analyzeHomework(file, file.name || "homework.jpg");
  };

  const resetChat = () => {
    if (!window.confirm("ยืนยันเริ่มการสนทนาใหม่? ประวัติที่จัดเก็บบนเซิร์ฟเวอร์จะยังอยู่จนกว่าคุณจะลบจากเมนูข้อมูล")) return;
    setMessages([{ id: "init_" + Date.now(), role: "bot", text: "สวัสดีค่ะ วันนี้อยากเล่าอะไรให้กระจกฟังไหม จะพิมพ์ พูด ถ่ายเซลฟี่ หรือถ่ายรูปการบ้านก็ได้นะ", timestamp: Date.now() }]);
    setTrendData([]); setLogEntries([]); setConcernStreak(0); setTransparencyLogs([]); setDetailedTransparencyLogs([]); setMood("calm"); setShowSupportStrip(false);
    setModalityState(null); setActiveRegulationTool(null); setEmotionHistory([]);
    escalationShownRef.current = false;
    toast("เริ่มการสนทนาใหม่แล้ว");
  };

  const tryMode = (mode: "camera" | "keyboard" | "mic" | "photo") => {
    setCurrentView("chat");
    setTimeout(() => {
      if (mode === "camera") handleSelfie();
      else if (mode === "mic") void handleVoice();
      else if (mode === "photo") handleHomeworkPhoto();
    }, 300);
  };

  const exportStoredData = async () => {
    if (!sessionReady) return toast("กำลังเตรียมเซสชัน โปรดลองอีกครั้งในอีกสักครู่");
    try {
      const result: ExportResult = await api.exportData();
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "jaikrajok-my-data.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 0);
      toast("ส่งออกข้อมูลของฉันเรียบร้อยแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ส่งออกข้อมูลไม่สำเร็จ");
    }
  };

  const deleteStoredData = async () => {
    if (!window.confirm("ยืนยันลบข้อมูลทั้งหมดที่จัดเก็บสำหรับเซสชันนี้? การกระทำนี้ไม่สามารถย้อนกลับได้")) return;
    if (!sessionReady) return toast("กำลังเตรียมเซสชัน โปรดลองอีกครั้งในอีกสักครู่");
    try {
      await api.deleteData();
      setTrendData([]);
      setLogEntries([]);
      setConcernStreak(0);
      setShowSupportStrip(false);
      setDataRevision((revision) => revision + 1);
      toast("ลบข้อมูลทั้งหมดเรียบร้อยแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ลบข้อมูลไม่สำเร็จ");
    }
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

  const getFontSizeMultiplier = () => {
    switch (accessibilitySettings.fontSize) {
      case 'large': return 1.2;
      case 'xlarge': return 1.5;
      default: return 1.0;
    }
  };

  const getContrastStyle = () => {
    if (accessibilitySettings.contrastMode === 'high') {
      return {
        filter: 'contrast(1.2) saturate(1.3)',
      };
    }
    return {};
  };

  const getFontFamily = () => {
    if (accessibilitySettings.fontFamily === 'dyslexic') {
      return "'Comic Sans MS', 'Verdana', 'Noto Sans Thai', sans-serif";
    }
    return "'Inter', 'Noto Sans Thai', sans-serif";
  };

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{
        backgroundColor: T.cream,
        fontSize: `${getFontSizeMultiplier()}rem`,
        fontFamily: getFontFamily(),
        ...getContrastStyle(),
      }}
    >
      {/* Panic Button - Always visible except on home page */}
      {currentView !== "home" && <PanicButton />}

      <input
        ref={selfieInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleSelfieFile}
      />
      <input
        ref={homeworkInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleHomeworkFile}
      />

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

              {/* Emergency 1323 Button */}
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,181,167,0.15)" }}>
                <a
                  href="tel:1323"
                  className="block w-full px-4 py-3 rounded-xl transition-all duration-200 text-center"
                  style={{
                    backgroundColor: "#DC2626",
                    color: "#FFFFFF",
                    fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
                    fontSize: "13px",
                    fontWeight: 700,
                    border: "2px solid rgba(255,255,255,0.2)",
                    boxShadow: "0 4px 12px rgba(220, 38, 38, 0.4)",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#B91C1C";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(220, 38, 38, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#DC2626";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(220, 38, 38, 0.4)";
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <PhoneIcon size={16} />
                    <span>สายด่วน 1323</span>
                  </div>
                  <div className="text-[10px] mt-1 opacity-90" style={{ fontWeight: 500 }}>
                    สุขภาพจิต 24 ชม.
                  </div>
                </a>
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
                  onMoodTap={(key: Mood) => {
                    setMood(key);
                    const openingLines: Record<Mood, string> = {
                      stressed: "วันนี้รู้สึกเครียด / กังวลอยู่นิดหน่อยค่ะ",
                      sad: "วันนี้ใจมันท้อแท้อยู่เลยค่ะ",
                      tired: "วันนี้รู้สึกเหนื่อยล้ามากค่ะ",
                      neutral: "วันนี้รู้สึกปกติดีค่ะ",
                      calm: "วันนี้ใจสงบผ่อนคลายค่ะ",
                      positive: "วันนี้รู้สึกสดใส มีความสุขมากค่ะ",
                    };
                    setCurrentView("chat");
                    void sendMessage(openingLines[key], "อารมณ์แท็บ");
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
                    toast("ระบบไม่ได้แจ้งครูอัตโนมัติ โปรดติดต่อผู้ใหญ่ที่ไว้ใจหรือสายด่วน 1323");
                    setShowEscalationModal(false);
                  }}
                  showCrisisAlert={showCrisisAlert}
                  onDismissCrisis={() => setShowCrisisAlert(false)}
                  crisisDetected={crisisDetected}
                  detailedTransparencyLogs={detailedTransparencyLogs}
                  modalityState={modalityState}
                  onPickRegulationTool={(tool) => setActiveRegulationTool(tool)}
                  emotionHistory={emotionHistory}
                  accessibilitySettings={accessibilitySettings}
                  onAccessibilityChange={setAccessibilitySettings}
                />
              </PageWrapper>
            )}
            {currentView === "trend" && (
              <PageWrapper pageKey="trend">
                <TrendView
                  trendData={trendData}
                  logEntries={logEntries}
                  sessionReady={sessionReady}
                  refreshKey={dataRevision}
                  onClearAll={() => { void deleteStoredData(); }}
                  onExport={() => { void exportStoredData(); }}
                />
              </PageWrapper>
            )}
            {currentView === "school" && <PageWrapper pageKey="school"><SchoolView sessionReady={sessionReady} refreshKey={dataRevision} /></PageWrapper>}
            {currentView === "safety" && (
              <PageWrapper pageKey="safety">
                <SafetyView
                  age={age}
                  guardianConsent={guardianConsent}
                  onExport={() => { void exportStoredData(); }}
                  onClearAll={() => { void deleteStoredData(); }}
                />
              </PageWrapper>
            )}
          </div>
        </div>
      </div>

      {/* FLOATING EMERGENCY 1323 BUTTON (Mobile) - Visible on all pages except home */}
      {currentView !== "home" && (
        <a
          href="tel:1323"
          className="fixed bottom-6 right-6 z-40 md:hidden flex items-center justify-center gap-2 px-5 py-4 rounded-full shadow-2xl transition-all duration-200"
          style={{
            backgroundColor: "#DC2626",
            color: "#FFFFFF",
            fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            textDecoration: "none",
            border: "2px solid rgba(255,255,255,0.3)",
            boxShadow: "0 8px 24px rgba(220, 38, 38, 0.6)",
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.transform = "scale(0.95)";
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <PhoneIcon size={18} />
          <span>1323</span>
        </a>
      )}

      {/* EMOTION REGULATION MODAL */}
      {activeRegulationTool && (
        <EmotionRegulationModal
          tool={activeRegulationTool}
          onClose={() => setActiveRegulationTool(null)}
        />
      )}

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
            <div className="text-4xl mb-3 flex justify-center">
              <HandshakeIcon size={48} />
            </div>
            <h3 id="escalation-title" className="text-xl font-bold mb-2" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
              เราสังเกตว่าช่วงนี้ใจคุณหนักอยู่หลายครั้ง
            </h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
              ไม่เป็นไรนะ ความรู้สึกแบบนี้ไม่ผิดเลย กระจกอยากชวนคุณลองพูดคุยกับคนที่ไว้ใจได้ สายด่วนสุขภาพจิต 1323
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { toast("โปรดติดต่อครู ผู้ปกครอง หรือผู้ใหญ่ที่ไว้ใจด้วยตนเอง"); setShowEscalationModal(false); }}
                className="w-full py-3 rounded-2xl text-white font-bold transition-all active:scale-[0.97]"
                style={{ backgroundColor: T.teal, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}
              >
                ฉันจะติดต่อผู้ใหญ่ที่ไว้ใจ
              </button>
              <a
                href="tel:1323"
                className="block text-center w-full py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                style={{ color: T.red, border: `2px solid ${T.red}`, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                โทรสายด่วน 1323
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

function HomeView({
  mood, setMood, onGoChat, onGoTrend, tryMode, trendData, onMoodTap,
}: {
  mood: Mood;
  setMood: (v: Mood) => void;
  onGoChat: () => void;
  onGoTrend: () => void;
  tryMode: (mode: "camera" | "keyboard" | "mic" | "photo") => void;
  trendData: TrendPoint[];
  onMoodTap: (key: Mood) => void;
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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
          <path d="M0 6 Q7.5 0 15 6 Q22.5 12 30 6 Q37.5 0 45 6 Q52.5 12 60 6" stroke={PINK} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
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
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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

      {/* FOOTER: privacy summary */}
      <div className="hv-strip" style={{
        background: CREAM,
        backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        borderTop: `1px solid rgba(26,20,10,0.1)`,
        padding: "1.75rem clamp(1.5rem, 5vw, 4rem)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap"
      }}>
        <div>
          <p style={{ fontFamily: SF, fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: INK_MUTED, margin: "0 0 0.3rem" }}>ความเป็นส่วนตัว</p>
          <p style={{ fontFamily: SF, fontSize: "1rem", fontWeight: 700, color: INK, margin: 0 }}>ไม่เก็บเนื้อหาแชท ภาพ หรือเสียงไว้ในฐานข้อมูล</p>
        </div>
        <p style={{ fontFamily: SF, fontSize: "0.82rem", fontWeight: 600, color: INK_MUTED, margin: 0, maxWidth: "34rem" }}>
          ระบบเก็บเฉพาะผลอารมณ์ เวลา แหล่งที่มา และจำนวนการใช้งานภายใต้เซสชันแบบไม่ระบุตัวตน
        </p>
      </div>
    </div>
  );
}




/* ============ CHAT VIEW ============ */
function ChatView({
  messages, inputText, setInputText, sendMessage, isAnalyzing,
  handleSelfie, handleVoice, handleHomeworkPhoto, resetChat, speakText,
  mood, concernStreak, transparencyLogs, supportStrip, onDismissSupport, onNotifyCounselor,
  showCrisisAlert, onDismissCrisis, crisisDetected, detailedTransparencyLogs,
  modalityState, onPickRegulationTool, emotionHistory, accessibilitySettings, onAccessibilityChange,
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
  mood: Mood;
  concernStreak: number;
  transparencyLogs: string[];
  supportStrip: boolean;
  onDismissSupport: () => void;
  onNotifyCounselor: () => void;
  showCrisisAlert: boolean;
  onDismissCrisis: () => void;
  crisisDetected: boolean;
  detailedTransparencyLogs: TransparencyLog[];
  modalityState: ModalityState | null;
  onPickRegulationTool: (tool: RegulationTool) => void;
  emotionHistory: EmotionHistoryPoint[];
  accessibilitySettings: AccessibilityState;
  onAccessibilityChange: (s: AccessibilityState) => void;
}) {
  const chatBodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [messages, isAnalyzing]);

  const handleCall1323 = () => {
    window.location.href = "tel:1323";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: "calc(100vh - 100px)" }}>
      {/* CRISIS ALERT */}
      {showCrisisAlert && <CrisisAlert onDismiss={onDismissCrisis} onCall1323={handleCall1323} />}

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
            <RefreshIcon size={18} />
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
                  <p className="font-bold text-xs uppercase tracking-wider mb-1 opacity-75 flex items-center gap-2" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    <CameraIcon size={12} />
                    ผลการประเมินเบื้องต้นจากใบหน้า · {msg.emotionData.label}
                  </p>
                  <p>{msg.emotionData.note}</p>
                </div>
              ) : msg.cardType === "ocr" ? (
                <div className="max-w-[85%] p-4 rounded-2xl text-sm" style={{ backgroundColor: T.cream, border: "1.5px dashed #aaa" }}>
                  <p className="font-bold text-xs text-gray-500 mb-1 flex items-center gap-2" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    <ImageIcon size={12} />
                    ผลจาก OCR API
                  </p>
                  <p className="text-xs text-gray-500 italic border-l-2 pl-3 py-1 my-1" style={{ borderColor: T.teal }}>{msg.ocrText}</p>
                </div>
              ) : (
                <div
                  className="max-w-[80%] rounded-2xl shadow-sm overflow-hidden"
                  style={{
                    backgroundColor: msg.role === "user" ? T.teal : T.white,
                    border: msg.role === "user" ? "none" : "1.5px solid #EDE6D3",
                  }}
                >
                  {/* Display image if available */}
                  {msg.imageUrl && (
                    <div className="relative">
                      <img
                        src={msg.imageUrl}
                        alt={msg.imageType === "selfie" ? "เซลฟี่" : "รูปการบ้าน"}
                        className="w-full h-auto max-h-[300px] object-cover"
                        style={{ display: "block" }}
                      />
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#FFFFFF" }}>
                        {msg.imageType === "selfie" ? <CameraIcon size={12} /> : <ImageIcon size={12} />}
                        {msg.imageType === "selfie" ? "เซลฟี่" : "รูปการบ้าน"}
                      </div>
                    </div>
                  )}
                  {/* Text content */}
                  <div
                    className="px-5 py-3 text-sm leading-relaxed"
                    style={{
                      color: msg.role === "user" ? T.white : T.black,
                      fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif",
                    }}
                  >
                    {msg.role === "bot" ? (
                      <div dangerouslySetInnerHTML={{ __html: renderMessageWithLatex(msg.text) }} />
                    ) : (
                      msg.text
                    )}
                    {msg.role === "bot" && (
                      <button onClick={() => speakText(msg.text)} className="ml-2 text-xs opacity-50 hover:opacity-100 transition-opacity">
                        <SpeakerIcon size={14} />
                      </button>
                    )}
                  </div>
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
              <p style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#6E3826" }} className="flex items-center gap-2">
                <HandshakeIcon size={14} />
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

        {/* Modality indicator — shows which input mode is active and its live status */}
        {modalityState && (
          <div className="px-4 pt-3">
            <ModalityIndicator state={modalityState} />
          </div>
        )}

        {/* Input toolbar */}
        <div className="p-4 space-y-3" style={{ borderTop: `2px solid ${T.teal}`, backgroundColor: T.white }}>
          <div className="flex items-center gap-2">
            {[
              { handler: handleSelfie, icon: <CameraIcon size={18} />, title: "ตรวจใบหน้าในภาพ", mode: "selfie" as ModalityMode },
              { handler: handleVoice, icon: <MicIcon size={18} />, title: "พูดระบาย", mode: "voice" as ModalityMode },
              { handler: handleHomeworkPhoto, icon: <ImageIcon size={18} />, title: "แนบรูปการบ้าน", mode: "homework" as ModalityMode },
            ].map(({ handler, icon, title, mode }) => {
              const isActive =
                modalityState?.mode === mode &&
                (modalityState.status === "processing" || modalityState.status === "recording");
              return (
                <button
                  key={title}
                  onClick={handler}
                  disabled={isAnalyzing}
                  title={title}
                  aria-label={title}
                  aria-pressed={isActive}
                  className="p-2.5 rounded-full text-sm font-bold transition-all"
                  style={{
                    border: `2px solid ${T.teal}`,
                    backgroundColor: isActive ? T.teal : "#E3EAE0",
                    color: isActive ? T.white : T.teal,
                    minWidth: "44px",
                    minHeight: "44px",
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = T.teal; e.currentTarget.style.color = T.white; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = "#E3EAE0"; e.currentTarget.style.color = T.teal; } }}
                >
                  {icon}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              id="chat-input"
              type="text"
              placeholder="พิมพ์ความรู้สึกของคุณ..."
              value={inputText}
              disabled={isAnalyzing}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 px-5 py-3 rounded-full outline-none text-sm"
              style={{ backgroundColor: T.cream, border: "1.5px solid transparent", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}
              onFocus={(e) => (e.target.style.borderColor = T.teal)}
              onBlur={(e) => (e.target.style.borderColor = "transparent")}
            />
            <button
              onClick={sendMessage}
              disabled={isAnalyzing || !inputText.trim()}
              className="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center transition-all active:scale-[0.95]"
              style={{ backgroundColor: T.teal }}
            >
              <SendIcon size={18} />
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
            ตรวจจับใบหน้า (ไม่อ่านอารมณ์) · วิเคราะห์ข้อความ · แปลงเสียงเป็นข้อความ · OCR การบ้าน แต่ละโหมดประมวลผลเฉพาะข้อมูลที่คุณเลือกส่ง
          </p>
        </div>

        {/* Concern card */}
        <div className="p-5 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
          <h4 className="font-bold text-sm mb-2" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>สถานะการดูแล</h4>
          {concernStreak >= 2 ? (
            <div className="p-3.5 rounded-xl space-y-2" style={{ backgroundColor: "#F1DEE3", border: "1.5px solid #A85F73" }}>
              <p className="font-bold text-xs flex items-center gap-1.5" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#6B3B49" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                สังเกตแนวโน้มเชิงลบต่อเนื่อง
              </p>
              <p className="text-xs" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#6B3B49" }}>อยากชวนคุยกับครูที่ปรึกษาหรือสายด่วน 1323 ไหม</p>
              <div className="flex gap-2 pt-1">
                <button onClick={onNotifyCounselor} className="px-3 py-1.5 rounded-xl text-white text-xs font-bold" style={{ backgroundColor: T.teal, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
                  วิธีติดต่อครู
                </button>
                <a href="tel:1323" className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1" style={{ border: "1.5px solid #A85F73", color: "#6B3B49", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
                  โทร 1323
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs leading-relaxed" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#666" }}>
              หากพบข้อความที่น่าเป็นห่วง ระบบจะแสดงช่องทางขอความช่วยเหลือ แต่จะไม่แจ้งครูหรือผู้ปกครองอัตโนมัติ
            </p>
          )}
        </div>

        {/* Emotion regulation tools */}
        <EmotionRegulationCard mood={mood} onPick={onPickRegulationTool} />

        {/* Live Emotion Indicator */}
        {emotionHistory.length > 0 && (
          <LiveEmotionIndicator history={emotionHistory} />
        )}

        {/* Accessibility Settings */}
        <div className="p-5 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
          <AccessibilitySettings settings={accessibilitySettings} onChange={onAccessibilityChange} />
        </div>

        {/* Transparency logs */}
        <div className="p-5 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
              การใช้งาน AI แบบโปร่งใส
            </h4>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: "#F0F9FF", color: "#0369A1", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
              <EyeIcon size={12} />
              {detailedTransparencyLogs.length} บันทึก
            </div>
          </div>

          {detailedTransparencyLogs.length === 0 ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ backgroundColor: "#F5F5F5" }}>
                <ServerIcon size={20} />
              </div>
              <p className="text-xs text-gray-400" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
                ยังไม่มีการเรียกใช้ AI<br />
                <span className="text-[10px]">ระบบจะแสดงรายละเอียดทุกครั้งที่ส่งข้อมูลไปวิเคราะห์</span>
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {detailedTransparencyLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border transition-all"
                  style={{
                    backgroundColor: log.status === "processing" ? "#FFFBEB" : log.status === "success" ? "#F0FDF4" : "#FEF2F2",
                    borderColor: log.status === "processing" ? "#FDE68A" : log.status === "success" ? "#BBF7D0" : "#FECACA",
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0">
                        {log.status === "processing" && (
                          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#F59E0B" }} />
                        )}
                        {log.status === "success" && (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#10B981" }}>
                            <CheckIcon size={10} />
                          </div>
                        )}
                        {log.status === "error" && (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#EF4444" }}>
                            <XIcon size={10} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#1F2937" }}>
                          {log.service}
                        </p>
                        <p className="text-[10px]" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#6B7280" }}>
                          {log.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1 text-[10px]" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#9CA3AF" }}>
                        <ClockIcon size={10} />
                        {log.timestamp}
                      </div>
                      {log.duration !== undefined && (
                        <div className="text-[10px] font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#059669" }}>
                          {log.duration}ms
                        </div>
                      )}
                    </div>
                  </div>

                  {log.status === "success" && (
                    <div className="mt-2 pt-2 border-t text-[10px]" style={{ borderColor: "#BBF7D0", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#065F46" }}>
                      ✓ ข้อมูลได้รับการวิเคราะห์แล้ว ระบบไม่เก็บเนื้อหาต้นฉบับ
                    </div>
                  )}
                  {log.status === "error" && (
                    <div className="mt-2 pt-2 border-t text-[10px]" style={{ borderColor: "#FECACA", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#991B1B" }}>
                      ✗ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t" style={{ borderColor: "#E5E7EB" }}>
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#3B82F6" }} />
              </div>
              <p className="text-[10px] leading-relaxed" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#6B7280" }}>
                <strong style={{ color: "#1F2937" }}>นโยบายความเป็นส่วนตัว:</strong> ระบบส่งข้อมูลไป API เพื่อวิเคราะห์ แต่ไม่เก็บเนื้อหาต้นฉบับไว้ในฐานข้อมูล เก็บเฉพาะผลอารมณ์และเวลาเท่านั้น
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ TREND VIEW ============ */
function TrendView({ trendData, logEntries, sessionReady, refreshKey, onClearAll, onExport }: {
  trendData: TrendPoint[];
  logEntries: LogEntry[];
  sessionReady: boolean;
  refreshKey: number;
  onClearAll: () => void;
  onExport: () => void;
}) {
  const [serverTrend, setServerTrend] = useState<TrendResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;
    setLoading(true);
    api.trend()
      .then((result) => { if (!cancelled) setServerTrend(result); })
      .catch(() => { if (!cancelled) toast.error("โหลดข้อมูลแนวโน้มไม่สำเร็จ"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionReady, refreshKey]);

  const chartData = trendData.length > 0
    ? trendData
    : (serverTrend?.days ?? []).map((point, id) => {
        const info = EMO[point.mood];
        return { id, valence: info.valence, color: info.color, key: point.mood, label: info.label };
      });

  const historyRows = logEntries.length > 0
    ? logEntries.map((entry) => ({ id: entry.id, label: entry.label, source: entry.source, time: entry.time }))
    : [...(serverTrend?.days ?? [])].reverse().map((point) => ({
        id: point.date,
        label: EMO[point.mood].label,
        source: "อารมณ์เด่นของวัน",
        time: point.date,
      }));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Session Summary - if there's current session data */}
      {trendData.length > 0 && logEntries.length > 0 && (
        <SessionSummaryCard
          summary={{
            duration: Date.now() - (logEntries[logEntries.length - 1]?.time ? new Date().getTime() : Date.now()),
            startMood: trendData[0]?.key || "calm",
            endMood: trendData[trendData.length - 1]?.key || "calm",
            concernsDiscussed: logEntries.filter((e) => EMO[e.key]?.concern).length,
            apiCallsCount: logEntries.length,
          }}
        />
      )}

      {loading && <div className="text-center py-6 text-gray-500">กำลังโหลดข้อมูล...</div>}
      {!loading && serverTrend && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: serverTrend.messages.toString(), label: "รายการอารมณ์ทั้งหมด" },
            { value: serverTrend.active_days.toString(), label: "วันที่ใช้งาน" },
            { value: serverTrend.dominant_mood ? EMO[serverTrend.dominant_mood].label : "ยังไม่มีข้อมูล", label: "อารมณ์ส่วนใหญ่" },
            { value: serverTrend.days.length.toString(), label: "วันที่มีบันทึก" },
          ].map((item) => (
            <div key={item.label} className="p-4 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2" }}>
              <span className="text-xl font-black block" style={{ color: T.teal }}>{item.value}</span>
              <span className="text-xs text-gray-600 font-semibold">{item.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SVG trend chart */}
        <div className="p-6 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>แนวโน้มอารมณ์ของคุณ</h3>
            <span className="text-xs font-mono text-gray-500">{chartData.length === 0 ? "ยังไม่มีข้อมูล" : `${chartData.length} จุดข้อมูล`}</span>
          </div>
          <div className="relative h-44 w-full my-2">
            <svg viewBox="0 0 500 160" className="w-full h-full overflow-visible">
              <line x1="0" y1="140" x2="500" y2="140" stroke="#EDE6D3" strokeWidth="1" />
              <text x="0" y="18" fontFamily="'IBM Plex Mono', monospace" fontSize="10" fill="#888">ผ่อนคลาย</text>
              <text x="0" y="150" fontFamily="'IBM Plex Mono', monospace" fontSize="10" fill="#888">ตึงเครียด</text>
              {chartData.length > 0 && (
                <>
                  <polyline fill="none" stroke="#6F6389" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    points={chartData.map((d, idx) => {
                      const stepX = chartData.length > 1 ? 460 / (chartData.length - 1) : 0;
                      return `${30 + idx * stepX},${140 - d.valence * 110}`;
                    }).join(" ")}
                  />
                  {chartData.map((d, idx) => {
                    const stepX = chartData.length > 1 ? 460 / (chartData.length - 1) : 0;
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
            {historyRows.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-8" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>ยังไม่มีประวัติการเช็คอิน</div>
            ) : (
              historyRows.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-xl text-xs" style={{ backgroundColor: T.cream, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
                  <span className="font-semibold text-gray-800">{e.label} · {e.source}</span>
                  <span className="font-mono text-gray-400">{e.time}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 pt-4 mt-auto" style={{ borderTop: "1px solid #EDE6D3" }}>
            <button onClick={onExport} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5" style={{ border: `2px solid ${T.teal}`, color: T.teal, backgroundColor: "#E3EAE0", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
              <DownloadIcon size={14} />
              ส่งออกข้อมูลของฉัน
            </button>
            <button onClick={onClearAll} className="px-4 py-2.5 rounded-xl text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5" style={{ backgroundColor: "#A85F73", border: "2px solid #A85F73", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
              <TrashIcon size={14} />
              ลบข้อมูลทั้งหมด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ SCHOOL VIEW ============ */
const MOOD_ORDER: Mood[] = ["stressed", "sad", "tired", "neutral", "calm", "positive"];

const MOOD_GROUPS: { key: string; label: string; moods: Mood[]; color: string; hint: string }[] = [
  { key: "heavy", label: "หนักใจ", moods: ["stressed", "sad"], color: "#A85F73", hint: "เครียด กังวล หรือเศร้า" },
  { key: "flat", label: "เหนื่อย / ปกติ", moods: ["tired", "neutral"], color: "#887F9E", hint: "เหนื่อยล้าหรือรู้สึกเฉย ๆ" },
  { key: "bright", label: "สดใส", moods: ["calm", "positive"], color: "#6C8C64", hint: "ผ่อนคลายหรือมีความสุข" },
];

/** Semicircular gauge for the aggregated wellbeing index (0..1). */
function WellbeingGauge({ value }: { value: number }) {
  const clamped = Math.min(1, Math.max(0, value));
  const radius = 70;
  const arcLength = Math.PI * radius;
  const band = clamped < 0.4 ? { label: "ต้องการการดูแล", color: "#A85F73" }
    : clamped < 0.6 ? { label: "ทรง ๆ", color: "#B78A3F" }
    : { label: "อยู่ในเกณฑ์ดี", color: "#4E7A46" };

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="104" viewBox="0 0 180 104" role="img" aria-label={`ดัชนีความรู้สึกรวม ${Math.round(clamped * 100)} จาก 100`}>
        <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="#EDE6D3" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M20 90 A70 70 0 0 1 160 90"
          fill="none"
          stroke={band.color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={arcLength * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.25,1,0.25,1)" }}
        />
        <text x="90" y="78" textAnchor="middle" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", fontSize: "30px", fontWeight: 800, fill: T.black }}>
          {Math.round(clamped * 100)}
        </text>
        <text x="90" y="94" textAnchor="middle" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fill: "#9CA3AF" }}>
          / 100
        </text>
      </svg>
      <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${band.color}1A`, color: band.color, fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>
        {band.label}
      </span>
    </div>
  );
}

function SchoolView({ sessionReady, refreshKey }: { sessionReady: boolean; refreshKey: number }) {
  const [schoolData, setSchoolData] = useState<SchoolResult | null>(null);
  const [myTrend, setMyTrend] = useState<TrendResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.school(),
      api.trend().catch(() => null),
    ])
      .then(([school, trend]) => {
        if (cancelled) return;
        setSchoolData(school);
        setMyTrend(trend);
      })
      .catch(() => { if (!cancelled) toast.error("โหลดข้อมูลโรงเรียนไม่สำเร็จ"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionReady, refreshKey]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">กำลังโหลดข้อมูล...</div>;
  }
  if (!schoolData) {
    return <div className="text-center py-12 text-gray-500">ไม่มีข้อมูล</div>;
  }
  if (schoolData.suppressed) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="p-7 rounded-2xl text-center" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2" }}>
          <h3 className="font-bold text-base mb-2" style={{ color: T.black }}>ยังไม่แสดงข้อมูลภาพรวม</h3>
          <p className="text-sm text-gray-600">ระบบจะแสดงสถิติเมื่อมีผู้ใช้อย่างน้อย 5 เซสชัน เพื่อป้องกันการอนุมานอารมณ์ของบุคคลเดียว</p>
        </div>
      </div>
    );
  }

  const stressRatio = schoolData.stress_ratio ?? 0;
  const regularRatio = schoolData.regular_ratio ?? 0;
  const readings = schoolData.readings;
  const countOf = (mood: Mood) => schoolData.distribution[mood] ?? 0;

  // Wellbeing index: readings weighted by each mood's valence.
  const wellbeing = readings > 0
    ? MOOD_ORDER.reduce((sum, mood) => sum + countOf(mood) * EMO[mood].valence, 0) / readings
    : 0;

  const groups = MOOD_GROUPS.map((group) => {
    const count = group.moods.reduce((sum, mood) => sum + countOf(mood), 0);
    return { ...group, count, ratio: readings > 0 ? count / readings : 0 };
  });

  const rankedMoods = [...MOOD_ORDER]
    .map((mood) => ({ mood, count: countOf(mood), ratio: readings > 0 ? countOf(mood) / readings : 0 }))
    .sort((a, b) => b.count - a.count);
  const topMoods = rankedMoods.filter((row) => row.count > 0).slice(0, 3);

  // "You are not alone": compare the visitor's own concern ratio against the school average.
  const myDays = myTrend?.days ?? [];
  const myConcernDays = myDays.filter((day) => EMO[day.mood]?.concern).length;
  const myConcernRatio = myDays.length > 0 ? myConcernDays / myDays.length : null;
  const peerDelta = myConcernRatio !== null ? myConcernRatio - stressRatio : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="inline-block px-4 py-1.5 rounded-full text-xs font-mono font-bold" style={{ backgroundColor: "#F3E6C8", color: "#6E4F1F" }}>
        ภาพรวมแบบไม่ระบุตัวตน
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { num: readings.toString(), label: "รายการอารมณ์ทั้งหมด" },
          { num: `${Math.round(stressRatio * 100)}%`, label: "รายการเครียดหรือเศร้า" },
          { num: `${Math.round(regularRatio * 100)}%`, label: "ผู้ใช้งานประจำ" },
          { num: schoolData.users.toString(), label: "เซสชันที่มีข้อมูล" },
        ].map((stat, i) => (
          <div key={i} className="p-5 rounded-2xl" style={{ backgroundColor: T.white, border: `2px solid ${T.teal}`, boxShadow: "0 2px 12px rgba(26,26,26,0.07)" }}>
            <span className="text-3xl font-black block" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.teal }}>{stat.num}</span>
            <span className="text-xs text-gray-700 mt-1 block font-semibold" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Wellbeing index + mood group split */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2 p-6 rounded-2xl flex flex-col items-center justify-center" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
          <h4 className="font-bold text-sm mb-1 flex items-center gap-2" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
            <TrendUpIcon size={15} />
            ดัชนีความรู้สึกรวม
          </h4>
          <p className="text-[11px] text-center mb-2" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#8a8a8a" }}>
            ถ่วงน้ำหนักจากทุกรายการอารมณ์ในโรงเรียน
          </p>
          <WellbeingGauge value={wellbeing} />
        </div>

        <div className="md:col-span-3 p-6 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
          <h4 className="font-bold text-sm mb-4" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
            สัดส่วนตามกลุ่มอารมณ์
          </h4>

          {/* Single stacked bar */}
          <div className="flex h-7 rounded-full overflow-hidden mb-4" style={{ backgroundColor: "#F0F0F0" }}>
            {groups.map((group) => (
              group.ratio > 0 ? (
                <div
                  key={group.key}
                  title={`${group.label} ${Math.round(group.ratio * 100)}%`}
                  style={{ width: `${group.ratio * 100}%`, backgroundColor: group.color, transition: "width 0.8s ease" }}
                />
              ) : null
            ))}
          </div>

          <div className="space-y-2.5">
            {groups.map((group) => (
              <div key={group.key} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                <span className="text-xs font-bold flex-shrink-0" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: T.black, width: "92px" }}>
                  {group.label}
                </span>
                <span className="text-[11px] flex-1 truncate" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#8a8a8a" }}>
                  {group.hint}
                </span>
                <span className="text-xs font-bold flex-shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace", color: group.color }}>
                  {Math.round(group.ratio * 100)}%
                </span>
                <span className="text-[10px] flex-shrink-0 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#9CA3AF", width: "56px" }}>
                  {group.count} ครั้ง
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* "You are not alone" peer comparison */}
      <div className="p-6 rounded-2xl" style={{ backgroundColor: "#FFF7F3", border: "1.5px solid #E3A48E" }}>
        <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#6E3826" }}>
          <UsersIcon size={15} />
          คุณไม่ได้อยู่คนเดียว
        </h4>

        {myConcernRatio === null ? (
          <p className="text-xs leading-relaxed" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#6E3826" }}>
            เมื่อคุณบันทึกอารมณ์สักสองสามวัน ระบบจะเทียบให้เห็นว่าวันที่หนักใจของคุณอยู่ในระดับใกล้เคียงกับเพื่อน ๆ แค่ไหน โดยไม่เปิดเผยข้อมูลของใครเลย
          </p>
        ) : (
          <>
            <div className="space-y-3 mb-3">
              {[
                { label: "วันที่หนักใจของคุณ", ratio: myConcernRatio, color: "#A85F73" },
                { label: "ค่าเฉลี่ยของโรงเรียน", ratio: stressRatio, color: "#887F9E" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="text-xs font-semibold flex-shrink-0" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#6E3826", width: "130px" }}>
                    {row.label}
                  </span>
                  <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(0,0,0,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round(row.ratio * 100)}%`, backgroundColor: row.color, transition: "width 0.8s ease" }} />
                  </div>
                  <span className="text-xs font-bold flex-shrink-0 w-10 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace", color: row.color }}>
                    {Math.round(row.ratio * 100)}%
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#6E3826" }}>
              {peerDelta !== null && peerDelta > 0.15
                ? "ช่วงนี้คุณมีวันที่หนักใจมากกว่าค่าเฉลี่ยอยู่บ้าง ลองใช้เครื่องมือคลายอารมณ์ในหน้าคุยกับกระจก หรือชวนผู้ใหญ่ที่ไว้ใจคุยดูนะ หากรู้สึกไม่ปลอดภัย โทร 1323 ได้ทุกเวลา"
                : "สัดส่วนวันที่หนักใจของคุณอยู่ในระดับใกล้เคียงกับเพื่อนคนอื่น ๆ ในโรงเรียน ความรู้สึกแบบนี้เกิดขึ้นกับหลายคน และไม่ใช่เรื่องผิดเลย"}
            </p>
          </>
        )}
      </div>

      {/* Full mood distribution, ordered from heavy to bright */}
      <div className="p-6 rounded-2xl" style={{ backgroundColor: T.white, border: "1.5px solid #E2D9C2", boxShadow: "0 2px 12px rgba(26,26,26,0.06)" }}>
        <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
          <h4 className="font-bold text-base" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>การกระจายอารมณ์</h4>
          {topMoods.length > 0 && (
            <p className="text-[11px]" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#8a8a8a" }}>
              พบมากสุด: {topMoods.map((row) => `${EMO[row.mood].label} ${Math.round(row.ratio * 100)}%`).join(" · ")}
            </p>
          )}
        </div>
        <div className="space-y-3">
          {MOOD_ORDER.map((mood) => {
            const info = EMO[mood];
            const count = countOf(mood);
            const percentage = readings > 0 ? Math.round((count / readings) * 100) : 0;
            return (
              <div key={mood} className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }} />
                <span className="text-sm font-semibold flex-shrink-0" style={{ width: "128px" }}>{info.label}</span>
                <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ backgroundColor: "#F0F0F0" }}>
                  <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: info.color, transition: "width 0.8s ease" }} />
                </div>
                <span className="text-sm font-bold w-12 text-right">{percentage}%</span>
                <span className="text-[10px] w-16 text-right" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#9CA3AF" }}>
                  {count} ครั้ง
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] mt-4 pt-3 leading-relaxed" style={{ borderTop: "1px solid #EDE6D3", fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: "#9CA3AF" }}>
          กราฟแนวโน้มรายสัปดาห์ของทั้งโรงเรียนยังไม่แสดง เพราะ API ภาพรวมส่งคืนเฉพาะยอดรวมสะสม ไม่มีข้อมูลแยกตามวัน
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "เกณฑ์ขั้นต่ำ", desc: "ไม่แสดงข้อมูลรวมจนกว่าจะมีผู้ใช้อย่างน้อย 5 เซสชัน" },
          { title: "ข้อมูลรวมเท่านั้น", desc: "แสดงจำนวนและสัดส่วนอารมณ์โดยไม่ส่งคืนรหัสของผู้ใช้" },
          { title: "ไม่มีการแจ้งอัตโนมัติ", desc: "สถิตินี้ไม่ส่งข้อความถึงครู ผู้ปกครอง หรือบุคคลอื่น" },
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
          {/* Safety Indicators */}
          <div className="p-4 rounded-2xl flex items-center justify-between" style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #10B981' }}>
            <div>
              <h4 className="font-bold text-sm mb-1 flex items-center gap-2" style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif", color: '#1a1a1a' }}>
                <ShieldIcon size={16} />
                พื้นที่ปลอดภัย
              </h4>
              <SafetyIndicators />
            </div>
            <EmergencyExitButton />
          </div>

          {/* LINE Integration */}
          <LINEIntegration />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "อายุที่ยืนยัน", value: age ? `${age} ปี` : "ไม่ได้ระบุ" },
              { label: "การรับทราบของผู้ใหญ่", value: Number(age) >= 20 ? "ไม่จำเป็น" : guardianConsent ? "ผู้ใช้ยืนยันแล้ว" : "ยังไม่ได้ยืนยัน" },
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
              <button onClick={onExport} className="px-5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-xs font-bold flex items-center gap-1.5" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
                <DownloadIcon size={14} />
                ส่งออกข้อมูลของฉัน
              </button>
              <button onClick={onClearAll} className="px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5" style={{ border: "1.5px solid #A85F73", color: "#A85F73", fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
                <TrashIcon size={14} />
                ลบข้อมูลทั้งหมด
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { title: "ข้อมูลที่ระบบจัดเก็บ", content: "ระบบจัดเก็บผลอารมณ์ แหล่งที่มา ความมั่นใจ และเวลาใน SQLite ภายใต้รหัสเซสชันที่ผ่านการแฮช ไม่จัดเก็บเนื้อหาแชท ภาพ หรือเสียงในฐานข้อมูลของแอป" },
              { title: "การประมวลผลภายนอก", content: "ข้อความ ภาพ และเสียงที่คุณเลือกส่งจะถูกส่งไปยังบริการ AI ภายนอกเพื่อประมวลผล จึงไม่ควรส่งข้อมูลที่ไม่ต้องการเปิดเผยต่อผู้ให้บริการเหล่านั้น" },
              { title: "เงื่อนไขการใช้งาน (สรุป)", content: "ผู้ใช้อายุต่ำกว่า 20 ปียืนยันด้วยตนเองว่าได้บอกผู้ปกครองหรือผู้ใหญ่ที่ไว้ใจแล้ว ระบบไม่ได้ตรวจสอบหรือส่งอีเมลขอความยินยอมอัตโนมัติ" },
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
            <div className="p-3.5 rounded-xl text-xs font-semibold text-gray-800 flex items-center gap-2" style={{ backgroundColor: T.cream, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>
              <EyeIcon size={14} />
              ระบบแสดงบันทึกว่าโหมดใดส่งข้อมูลไปวิเคราะห์
            </div>
            <div className="p-3.5 rounded-xl text-xs font-semibold text-gray-800" style={{ backgroundColor: T.cream, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>AI ไม่วินิจฉัยโรคซึมเศร้าหรือโรคทางจิตเวช</div>
            <div className="p-3.5 rounded-xl text-xs font-semibold text-gray-800" style={{ backgroundColor: T.cream, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>ข้อความวิกฤตที่ตรงกับคำเตือนจะข้าม LLM และแสดงสายด่วน 1323 แต่ระบบไม่ติดต่อมนุษย์อัตโนมัติ</div>
            <div className="p-3.5 rounded-xl text-xs font-semibold text-gray-800" style={{ backgroundColor: T.cream, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>ผลลัพธ์เป็นข้อเสนอแนะ ไม่ใช่การตัดสิน ตีตรา หรือประเมินค่า</div>
            <div className="p-3.5 rounded-xl text-xs font-semibold text-gray-800" style={{ backgroundColor: T.cream, fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif" }}>API มีการจำกัดอัตราการใช้งานและตรวจขนาดไฟล์ก่อนส่งต่อ</div>
          </div>
          <div className="p-6 rounded-2xl flex items-center justify-between gap-4" style={{ backgroundColor: T.black }}>
            <div>
              <h4 className="font-bold text-lg mb-1 flex items-center gap-2" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.salmon }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                สายด่วนสุขภาพจิต 1323
              </h4>
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
            { layer: "ชั้น 1", title: "User Interface", desc: "เว็บและ LINE รองรับข้อความ ส่วนเว็บเพิ่มการตรวจใบหน้า เสียง และรูปการบ้าน" },
            { layer: "ชั้น 2", title: "FastAPI", desc: "ใช้คุกกี้ HttpOnly ที่ลงลายเซ็น ตรวจสิทธิ์ จำกัดอัตรา และตรวจขนาดไฟล์" },
            { layer: "ชั้น 3", title: "AI Services", desc: "ตรวจใบหน้าโดยไม่อ่านอารมณ์ · วิเคราะห์ความรู้สึก · Speech-to-Text · OCR · Pathumma LLM" },
            { layer: "ชั้น 4", title: "SQLite", desc: "เก็บเฉพาะเหตุการณ์อารมณ์และตัวนับภายใต้รหัสผู้ใช้ที่ผ่านการแฮช" },
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
          {["โหมดภาพตรวจเพียงว่ามีใบหน้าในภาพหรือไม่ ไม่วิเคราะห์อารมณ์จากสีหน้า", "การวิเคราะห์ความรู้สึกจากข้อความอาจไม่ครอบคลุมภาษาถิ่น การประชด หรือบริบทซับซ้อน", "ระบบนี้เป็นเครื่องมือเสริม ไม่สามารถแทนที่บริการฉุกเฉิน จิตแพทย์ หรือนักจิตวิทยา", "การตรวจคำวิกฤตใช้คำสำคัญ จึงอาจไม่ครอบคลุมทุกถ้อยคำหรือทุกบริบท", "ประสิทธิภาพขึ้นอยู่กับอินเทอร์เน็ตและความพร้อมของบริการ AI ภายนอก"].map((text, i) => (
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
  const [guardianConsent, setGuardianConsent] = useState(false);

  // Global click ripple effect
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
              setPage(ageNum < 20 ? "guardian" : "privacy");
            }}
          />
        </PageWrapper>
      )}
      {page === "guardian" && (
        <PageWrapper pageKey="guardian">
          <GuardianPage onNext={() => { setGuardianConsent(true); setPage("privacy"); }} />
        </PageWrapper>
      )}
      {page === "privacy" && <PageWrapper pageKey="privacy"><PrivacyPage onNext={() => setPage("app")} /></PageWrapper>}
      {page === "app" && <PageWrapper pageKey="app"><AppShell age={age} guardianConsent={guardianConsent || Number(age) >= 20} /></PageWrapper>}
    </div>
  );
}
