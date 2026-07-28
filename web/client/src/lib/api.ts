/**
 * Backend client for the JaiKrajok API.
 *
 * The hackathon reverse proxy serves the frontend at /<team>/ and strips /api
 * before the request reaches the FastAPI container, so paths are built from
 * API_BASE below rather than hardcoded. In local dev, vite proxies these
 * straight to http://127.0.0.1:8000.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export type Mood = "stressed" | "sad" | "tired" | "neutral" | "calm" | "positive";

export interface ChatResult {
  reply: string;
  emotion: string | null;
  mood: Mood;
  confidence: number | null;
  crisis: boolean;
  service: string;
  degraded: string[];
}

export interface AnalysisResult {
  ok: boolean;
  mood: Mood;
  reply: string;
  detail: string | null;
  transcript: string | null;
  service: string;
  error: string | null;
}

export interface TrendResult {
  days: { date: string; mood: Mood }[];
  messages: number;
  active_days: number;
  dominant_mood: Mood | null;
  first_seen: string | null;
  labels: Record<string, string>;
}

export interface SchoolResult {
  users: number;
  readings: number;
  distribution: Record<string, number>;
  stress_ratio: number;
  regular_ratio: number;
}

/**
 * Everything the server holds for one id. Chat text, images and audio are never
 * written to disk, so only mood readings and usage counters come back.
 */
export interface ExportResult {
  user_id: string;
  exported_at: string;
  readings: { at: string; mood: string; source: string; confidence: number | null }[];
  messages: number;
  first_seen: string | null;
  last_seen: string | null;
  note: string;
}

/** Shape of GET /health. Used by the home page status panel. */
export interface HealthResult {
  status: string;
  app: string;
  team: string;
  env: string;
  line_configured: boolean;
  aiforthai_key_set: boolean;
}

/** Thrown for any non-2xx response so callers can show one consistent message. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const TIMEOUT_MS = 120_000; // the LLM can legitimately take over a minute

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try {
        const body = await resp.json();
        if (body?.detail) detail = String(body.detail);
      } catch {
        /* non-JSON error body; keep the status text */
      }
      throw new ApiError(resp.status, detail);
    }
    return (await resp.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(408, "คำขอใช้เวลานานเกินไป");
    }
    throw new ApiError(0, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  } finally {
    clearTimeout(timer);
  }
}

function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function upload(file: Blob, filename: string, userId: string): RequestInit {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("user_id", userId);
  return { method: "POST", body: form };
}

export const api = {
  /** Text mode: sentiment + mood-aware LLM reply. */
  sendMessage: (userId: string, message: string) =>
    request<ChatResult>("/chat/send", json({ user_id: userId, message })),

  /** Sentiment only, without generating a reply. */
  analyzeEmotion: (text: string) =>
    request<{ emotion: string; polarity: string; confidence: number; mood: Mood }>(
      "/emotion/analyze",
      json({ text }),
    ),

  /** Selfie mode: face detection. */
  analyzeSelfie: (userId: string, image: Blob) =>
    request<AnalysisResult>("/selfie/analyze", upload(image, "selfie.jpg", userId)),

  /** Voice mode: speech-to-text, then the text pipeline. */
  transcribeVoice: (userId: string, audio: Blob, filename = "voice.webm") =>
    request<AnalysisResult>("/voice/transcribe", upload(audio, filename, userId)),

  /** Homework mode: OCR, then the LLM explains what it read. */
  readHomework: (userId: string, image: Blob) =>
    request<AnalysisResult>("/homework/ocr", upload(image, "homework.jpg", userId)),

  trend: (userId: string) =>
    request<TrendResult>(`/trend/${encodeURIComponent(userId)}`, { method: "GET" }),

  school: () => request<SchoolResult>("/school/overview", { method: "GET" }),

  health: () => request<HealthResult>("/health", { method: "GET" }),

  /** PDPA: hand back everything stored for this id. */
  exportData: (userId: string) =>
    request<ExportResult>(`/data/${encodeURIComponent(userId)}/export`, { method: "GET" }),

  /** PDPA: erase all stored readings and messages for this id. */
  deleteData: (userId: string) =>
    request<{ deleted: number }>(`/data/${encodeURIComponent(userId)}`, { method: "DELETE" }),

  /** Text-to-speech. Returns WAV bytes, not JSON, so it bypasses request(). */
  async speak(text: string): Promise<Blob> {
    const resp = await fetch(`${API_BASE}/tts/speak`, json({ text }));
    if (!resp.ok) throw new ApiError(resp.status, "อ่านออกเสียงไม่สำเร็จ");
    return resp.blob();
  },
};
