/**
 * Backend client for the JaiKrajok API.
 *
 * The hackathon reverse proxy serves the frontend at /<team>/ and strips /api
 * before the request reaches the FastAPI container, so paths are built from
 * API_BASE below rather than hardcoded. In local dev, vite proxies these
 * straight to http://127.0.0.1:8000.
 */

const isDirectLocalApi = typeof window !== "undefined"
  && (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")
  && window.location.port === "8000";
const API_BASE = import.meta.env.VITE_API_BASE ?? (isDirectLocalApi ? "" : "/api");

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
  stress_ratio: number | null;
  regular_ratio: number | null;
  suppressed: boolean;
}

/**
 * Everything the server holds for the current session. Chat text, images and
 * audio are never written to disk, so only mood readings and usage counters
 * come back.
 */
export interface ExportResult {
  exported_at: string;
  readings: { at: string; mood: string; source: string; confidence: number | null }[];
  messages: number;
  first_seen: string | null;
  last_seen: string | null;
  note: string;
}

export interface SessionResult {
  ok: boolean;
}

/** Shape of GET /health. Used by the home page status panel. */
export interface HealthResult {
  status: string;
  app: string;
  team: string;
  env: string;
  line_configured: boolean;
  aiforthai_key_set: boolean;
  session_configured: boolean;
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

  console.group(`🌐 API Request: ${init.method || 'GET'} ${path}`);
  console.log('📤 Request URL:', `${API_BASE}${path}`);
  console.log('⚙️ Request options:', { ...init, signal: undefined });
  const startTime = performance.now();

  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      signal: controller.signal,
    });

    const elapsed = Math.round(performance.now() - startTime);
    console.log(`⏱️ Response time: ${elapsed}ms`);
    console.log(`📥 Status: ${resp.status} ${resp.statusText}`);

    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try {
        const body = await resp.json();
        console.error('❌ Error response body:', body);
        if (body?.detail) detail = String(body.detail);
      } catch {
        /* non-JSON error body; keep the status text */
      }
      console.groupEnd();
      throw new ApiError(resp.status, detail);
    }

    const data = (await resp.json()) as T;
    console.log('✅ Response data:', data);
    console.groupEnd();
    return data;
  } catch (err) {
    const elapsed = Math.round(performance.now() - startTime);
    console.log(`⏱️ Failed after: ${elapsed}ms`);

    if (err instanceof ApiError) {
      console.error('❌ API Error:', err.message);
      console.groupEnd();
      throw err;
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error('⏰ Request timeout after', TIMEOUT_MS / 1000, 'seconds');
      console.groupEnd();
      throw new ApiError(408, "คำขอใช้เวลานานเกินไป");
    }
    console.error('🔌 Network error:', err);
    console.groupEnd();
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

function upload(file: Blob, filename: string): RequestInit {
  const form = new FormData();
  form.append("file", file, filename);
  return { method: "POST", body: form };
}

export const api = {
  /** Establish the server-owned pseudonymous browser session. */
  createSession: () => request<SessionResult>("/session", { method: "POST" }),

  /** Text mode: sentiment + mood-aware LLM reply. */
  sendMessage: (message: string) =>
    request<ChatResult>("/chat/send", json({ message })),

  /** Sentiment only, without generating a reply. */
  analyzeEmotion: (text: string) =>
    request<{ emotion: string; polarity: string; confidence: number; mood: Mood }>(
      "/emotion/analyze",
      json({ text }),
    ),

  /** Selfie mode: face detection. */
  analyzeSelfie: (image: Blob, filename = "selfie.jpg") =>
    request<AnalysisResult>("/selfie/analyze", upload(image, filename)),

  /** Voice mode: speech-to-text, then the text pipeline. */
  transcribeVoice: (audio: Blob, filename = "voice.webm") =>
    request<AnalysisResult>("/voice/transcribe", upload(audio, filename)),

  /** Homework mode: OCR, then the LLM explains what it read. */
  readHomework: (image: Blob, filename = "homework.jpg") =>
    request<AnalysisResult>("/homework/ocr", upload(image, filename)),

  trend: () => request<TrendResult>("/trend", { method: "GET" }),

  school: () => request<SchoolResult>("/school/overview", { method: "GET" }),

  health: () => request<HealthResult>("/health", { method: "GET" }),

  /** PDPA: hand back everything stored for this id. */
  exportData: () => request<ExportResult>("/data/export", { method: "GET" }),

  /** PDPA: erase all stored readings and messages for this id. */
  deleteData: () => request<{ deleted: number }>("/data", { method: "DELETE" }),

  /** Text-to-speech. Returns WAV bytes, not JSON, so it bypasses request(). */
  async speak(text: string): Promise<Blob> {
    const resp = await fetch(`${API_BASE}/tts/speak`, {
      ...json({ text }),
      credentials: "include",
    });
    if (!resp.ok) throw new ApiError(resp.status, "อ่านออกเสียงไม่สำเร็จ");
    return resp.blob();
  },
};
