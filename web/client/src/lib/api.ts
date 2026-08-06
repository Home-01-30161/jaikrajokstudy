const isDirectLocalApi =
  typeof window !== "undefined" &&
  (window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost") &&
  window.location.port === "8000";

const API_BASE =
  import.meta.env.VITE_API_BASE ?? (isDirectLocalApi ? "" : "/api");

const TIMEOUT_MS = 120_000;

export type Mood =
  | "stressed"
  | "sad"
  | "tired"
  | "neutral"
  | "calm"
  | "positive";

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

export interface ExportResult {
  exported_at: string;
  readings: {
    at: string;
    mood: string;
    source: string;
    confidence: number | null;
  }[];
  messages: number;
  first_seen: string | null;
  last_seen: string | null;
  note: string;
}

export interface HealthResult {
  status: string;
  app: string;
  team: string;
  env: string;
  line_configured: boolean;
  aiforthai_key_set: boolean;
  session_configured: boolean;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function fetchWithTimeout(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, "คำขอใช้เวลานานเกินไป");
    }
    throw new ApiError(0, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  } finally {
    window.clearTimeout(timer);
  }
}

async function errorFromResponse(response: Response): Promise<ApiError> {
  let message = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (body.detail) message = String(body.detail);
  } catch {
    // Keep the status-only message for non-JSON responses.
  }
  return new ApiError(response.status, message);
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetchWithTimeout(path, init);
  if (!response.ok) throw await errorFromResponse(response);
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, "เซิร์ฟเวอร์ส่งข้อมูลกลับมาไม่ถูกต้อง");
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
  createSession: () =>
    request<{ ok: boolean }>("/session", { method: "POST" }),

  sendMessage: (message: string, history: { role: string; text: string }[] = []) =>
    request<ChatResult>("/chat/send", json({ message, history })),

  analyzeSelfie: (image: Blob, filename = "selfie.jpg") =>
    request<AnalysisResult>("/selfie/analyze", upload(image, filename)),

  transcribeVoice: (audio: Blob, filename = "voice.webm") =>
    request<AnalysisResult>("/voice/transcribe", upload(audio, filename)),

  readHomework: (image: Blob, filename = "homework.jpg") =>
    request<AnalysisResult>("/homework/ocr", upload(image, filename)),

  trend: () => request<TrendResult>("/trend", { method: "GET" }),

  school: () =>
    request<SchoolResult>("/school/overview", { method: "GET" }),

  health: () => request<HealthResult>("/health", { method: "GET" }),

  exportData: () =>
    request<ExportResult>("/data/export", { method: "GET" }),

  deleteData: () =>
    request<{ deleted: number }>("/data", { method: "DELETE" }),

  async speak(text: string): Promise<Blob> {
    const response = await fetchWithTimeout("/tts/speak", json({ text }));
    if (!response.ok) throw await errorFromResponse(response);
    return response.blob();
  },
};
