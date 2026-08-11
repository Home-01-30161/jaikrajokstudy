"""Pathumma LLM client via AI for Thai API (/textqa/completion)."""

from __future__ import annotations

import re

import httpx

from app.config import get_settings
from app.services.base import ServiceResult
from app.utils.logging import get_logger

logger = get_logger(__name__)

SYSTEM_PROMPT = (
    "คุณคือ JaiKrajok (ใจกระจก) ผู้ช่วยการเรียนที่เข้าใจอารมณ์สำหรับนักเรียนมัธยมไทย "
    "บทบาทหลักของคุณคือช่วยเรื่องการเรียน อธิบายเนื้อหา วิเคราะห์โจทย์ และให้กำลังใจ "
    "ตอบเป็นภาษาไทย ชัดเจน สุภาพ ตรงประเด็น "
    # Anti-repetition: explicit instruction is the strongest guard against loop
    "ห้ามซ้ำประโยคหรือย่อหน้าเดิมเด็ดขาด แต่ละข้อต้องมีเนื้อหาใหม่ที่แตกต่างกัน "
    "ถ้าอธิบายครบแล้วให้หยุด อย่าเพิ่มข้อที่เหมือนเดิม "
    # Length control
    "ตอบให้กระชับ ไม่เกิน 5 ข้อหลัก ถ้าไม่จำเป็นต้องมีข้อย่อย "
    # Context instruction
    "ตอบตาม context ของบทสนทนาเสมอ อย่าเปลี่ยน topic เอง "
    "ถ้าผู้เรียนถามต่อจากข้อความก่อน ให้ตอบต่อจาก context นั้นโดยตรง "
    "อย่าวินิจฉัยโรคหรือแสดงตนเป็นนักจิตวิทยา "
    "ห้ามใช้อีโมจิหรือสัญลักษณ์รูปภาพ ใช้ข้อความล้วนเท่านั้น "
    "หากผู้ใช้มีความเสี่ยงรุนแรง ให้แนะนำติดต่อสายด่วน 1323"
)

PATHUMMA_TEXTQA_URL = "https://api.aiforthai.in.th/textqa/completion"

# thaillm-8b is a reasoning model: it wraps its scratchpad in <think>...</think>
# before the real answer. That must never reach a student, and an unclosed block
# means the token budget ran out mid-thought, leaving no answer at all.
_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def _strip_reasoning(text: str) -> str:
    text = _THINK_RE.sub("", text)
    # Unclosed <think> (hit max_tokens): nothing usable follows, so drop it.
    if "<think>" in text.lower():
        text = re.split(r"<think>", text, flags=re.IGNORECASE)[0]
    return text.strip()


def _dedup_lines(text: str) -> str:
    """Remove consecutively repeated lines/paragraphs that the model loops on.

    Strategy: split on blank lines (paragraph) and numbered list items.
    If a paragraph body is seen twice, keep only the first occurrence.
    Similarity threshold: strip whitespace + punctuation before comparing.
    """
    # Normalise: collapse 3+ blank lines → 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    paragraphs = text.split("\n\n")
    seen: list[str] = []
    result: list[str] = []

    def _normalise(s: str) -> str:
        # Remove leading numbering like "1.", "2.", "ก)", etc. before comparing
        s = re.sub(r"^\s*[\d๑-๙]+[.)]\s*", "", s, flags=re.MULTILINE)
        return re.sub(r"[\s\W]+", "", s).lower()

    for para in paragraphs:
        key = _normalise(para)
        # Allow short connectors / empty paragraphs through
        if len(key) < 15:
            result.append(para)
            continue
        # Check if this paragraph's content is already seen (>80% substring match)
        duplicate = False
        for s in seen:
            if len(key) > 0 and len(s) > 0:
                shorter, longer = (key, s) if len(key) <= len(s) else (s, key)
                if shorter in longer or (len(shorter) >= 20 and shorter[:20] in longer):
                    duplicate = True
                    break
        if not duplicate:
            seen.append(key)
            result.append(para)

    return "\n\n".join(result).strip()


# The system prompt forbids emoji, but the model complies only intermittently, so
# the output is filtered too. Ranges cover pictographs, dingbats, symbols and the
# regional-indicator/flag block, plus the variation selector and zero-width joiner
# that would otherwise be left stranded behind a removed glyph.
_EMOJI_RE = re.compile(
    "["
    "\U0001f000-\U0001faff"
    "☀-➿"
    "⬀-⯿"
    "︎️‍"
    "\U0001f1e6-\U0001f1ff"
    "]"
)


def _strip_emoji(text: str) -> str:
    """Drop emoji and tidy the whitespace they leave behind."""
    cleaned = _EMOJI_RE.sub("", text)
    # Collapse runs of spaces/tabs left where a glyph was, but keep newlines so
    # multi-line explanations do not turn into one paragraph.
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"[ \t]+([,.!?ๆ])", r"\1", cleaned)
    return "\n".join(line.rstrip() for line in cleaned.split("\n")).strip()


# LaTeX → plain-text conversion for LINE (no KaTeX renderer available)
_DISPLAY_MATH_RE = re.compile(r"\$\$(.+?)\$\$", re.DOTALL)
_INLINE_MATH_RE  = re.compile(r"\$([^$\n]+?)\$")

def _latex_to_plain(expr: str) -> str:
    """Best-effort convert a LaTeX math expression to readable plain text."""
    s = expr.strip()
    s = re.sub(r"\\frac\{([^}]+)\}\{([^}]+)\}", r"(\1)/(\2)", s)
    s = re.sub(r"\\sqrt\{([^}]+)\}", r"√(\1)", s)
    s = re.sub(r"\\text\{([^}]+)\}", r"\1", s)
    s = re.sub(r"\\mathrm\{([^}]+)\}", r"\1", s)
    s = re.sub(r"\\mathbf\{([^}]+)\}", r"\1", s)
    s = re.sub(r"\^\{([^}]+)\}", r"^\1", s)
    s = re.sub(r"_\{([^}]+)\}", r"_\1", s)
    replacements = {
        r"\times": "×", r"\div": "÷", r"\pm": "±", r"\cdot": "·",
        r"\leq": "≤", r"\geq": "≥", r"\neq": "≠", r"\approx": "≈",
        r"\infty": "∞", r"\pi": "π", r"\alpha": "α", r"\beta": "β",
        r"\gamma": "γ", r"\theta": "θ", r"\lambda": "λ", r"\mu": "μ",
        r"\sigma": "σ", r"\omega": "ω", r"\Delta": "Δ", r"\sum": "Σ",
        r"\int": "∫", r"\rightarrow": "→", r"\leftarrow": "←",
        r"\Rightarrow": "⇒", r"\left": "", r"\right": "",
    }
    for latex_cmd, plain in replacements.items():
        s = s.replace(latex_cmd, plain)
    s = re.sub(r"\\[a-zA-Z]+", "", s)   # remove remaining \commands
    s = re.sub(r"[{}]", "", s)           # remove stray braces
    return s.strip()


def strip_latex_for_line(text: str) -> str:
    """Convert LaTeX math in a bot reply to plain text suitable for LINE."""
    text = _DISPLAY_MATH_RE.sub(lambda m: _latex_to_plain(m.group(1)), text)
    text = _INLINE_MATH_RE.sub(lambda m: _latex_to_plain(m.group(1)), text)
    return text


async def generate_reply(user_text: str, *, emotion_hint: str | None = None, history: list | None = None) -> ServiceResult:
    """Generate a reply, preferring the TokenMind gateway (thaillm-8b).

    Falls back to the legacy AI for Thai /textqa/completion endpoint so a
    gateway outage degrades instead of breaking the bot.
    """
    settings = get_settings()

    prompt = user_text
    # Only add emotion hint for non-neutral moods — neutral adds noise without value
    if emotion_hint and emotion_hint != "ปกติ":
        prompt = f"(อารมณ์โดยประมาณ: {emotion_hint})\nคำถาม/ข้อความของผู้เรียน: {user_text}"

    if settings.tokenmind_api_key:
        result = await _generate_tokenmind(prompt, settings, history=history or [])
        if result.ok:
            return result
        logger.warning("TokenMind LLM failed (%s); falling back to textqa", result.error)

    if not settings.aiforthai_api_key:
        return ServiceResult(
            service="pathumma",
            ok=False,
            error="Missing TOKENMIND_API_KEY and AIFORTHAI_API_KEY",
        )
    return await _generate_textqa(prompt, settings)


async def _generate_tokenmind(prompt: str, settings, history: list | None = None) -> ServiceResult:
    """OpenAI-compatible /chat/completions call against the TokenMind gateway."""
    url = f"{settings.tokenmind_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.tokenmind_api_key}",
        "Content-Type": "application/json",
    }

    # Build messages with conversation history
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Append up to last 10 turns of history (user+bot pairs)
    for h in (history or [])[-10:]:
        role = "assistant" if h.get("role") == "bot" else "user"
        text = (h.get("text") or "").strip()
        if text:
            messages.append({"role": role, "content": text})

    # Append current user message
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": settings.tokenmind_llm_model,
        "messages": messages,
        "max_tokens": 8192,
        "temperature": 0.3,
        "repetition_penalty": 1.15,  # reduce repetitive loop output
    }
    try:
        verify = not settings.insecure_tls
        async with httpx.AsyncClient(timeout=120.0, verify=verify) as client:
            resp = await client.post(url, headers=headers, json=payload)
            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}

            if resp.status_code >= 400:
                logger.warning("TokenMind HTTP %s: %s", resp.status_code, resp.text[:300])
                return ServiceResult(
                    service="pathumma",
                    ok=False,
                    error=f"HTTP {resp.status_code}",
                    raw=raw if isinstance(raw, dict) else {"body": str(raw)},
                )

            raw_dict = raw if isinstance(raw, dict) else {}

            # Warn if model stopped due to token limit (answer may be truncated)
            finish_reason = ""
            choices = raw_dict.get("choices")
            if isinstance(choices, list) and choices:
                finish_reason = choices[0].get("finish_reason") or ""
            if finish_reason == "length":
                logger.warning("TokenMind: finish_reason=length — response was cut at max_tokens")

            text = _strip_emoji(
                _dedup_lines(_strip_reasoning(_extract_text(raw_dict)))
            )
            if not text:
                return ServiceResult(
                    service="pathumma", ok=False, error="empty reply after stripping reasoning"
                )
            return ServiceResult(
                service="pathumma",
                ok=True,
                text=text,
                raw=raw_dict,
            )
    except httpx.TimeoutException:
        return ServiceResult(service="pathumma", ok=False, error="timeout")
    except Exception as exc:  # noqa: BLE001
        logger.exception("TokenMind call failed")
        return ServiceResult(service="pathumma", ok=False, error=str(exc))


async def _generate_textqa(prompt: str, settings) -> ServiceResult:
    """Legacy AI for Thai Text QA fallback."""

    headers = {
        "Apikey": settings.aiforthai_api_key,
        "X-lib": "ai4thai-lib",
    }
    # The endpoint requires multipart/form-data. Sending urlencoded form data
    # (httpx `data=`) makes it reply 422 "Field required: body.instruction",
    # so fields are passed as multipart parts via `files=` instead.
    form = {
        "instruction": (None, prompt.encode("utf-8"), "text/plain; charset=utf-8"),
        "system_prompt": (None, SYSTEM_PROMPT.encode("utf-8"), "text/plain; charset=utf-8"),
        "max_new_tokens": (None, "512"),
        "temperature": (None, "0.4"),
    }

    url = settings.pathumma_endpoint or PATHUMMA_TEXTQA_URL
    try:
        async with httpx.AsyncClient(
            timeout=60.0, verify=not settings.insecure_tls
        ) as client:
            resp = await client.post(url, headers=headers, files=form)
            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}

            if resp.status_code >= 400:
                logger.warning("Pathumma HTTP %s: %s", resp.status_code, resp.text[:300])
                return ServiceResult(
                    service="pathumma",
                    ok=False,
                    error=f"HTTP {resp.status_code}",
                    raw=raw if isinstance(raw, dict) else {"body": str(raw)},
                )

            text = _strip_emoji(
                _dedup_lines(_strip_reasoning(_extract_text(raw if isinstance(raw, dict) else {})))
            )
            if not text:
                return ServiceResult(
                    service="pathumma", ok=False, error="empty or unrecognised reply"
                )
            return ServiceResult(
                service="pathumma",
                ok=True,
                text=text,
                raw=raw if isinstance(raw, dict) else {},
            )
    except httpx.TimeoutException:
        return ServiceResult(service="pathumma", ok=False, error="timeout")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Pathumma call failed")
        return ServiceResult(service="pathumma", ok=False, error=str(exc))


def _extract_text(raw: dict) -> str:
    if not isinstance(raw, dict):
        return str(raw)
    choices = raw.get("choices")
    if isinstance(choices, list) and choices:
        msg = choices[0].get("message") or {}
        if isinstance(msg, dict) and msg.get("content"):
            return str(msg["content"]).strip()
        if choices[0].get("text"):
            return str(choices[0]["text"]).strip()
    for key in ("content", "response", "output", "text", "result", "generated_text"):
        if raw.get(key):
            return str(raw[key]).strip()
    return ""
