"""Pathumma LLM client via AI for Thai API (/textqa/completion)."""

from __future__ import annotations

import re

import httpx

from app.config import get_settings
from app.services.base import ServiceResult
from app.utils.logging import get_logger

logger = get_logger(__name__)

SYSTEM_PROMPT = (
    # Identity & tone — exact match with JAIKRAJOK_SYSTEM_PROMPT from reference repo
    "คุณคือ กระจก (JaiKraJok) ผู้ช่วยสอนเรียนและเพื่อนคู่คิดอัจฉริยะ สร้างโดยทีม JaiKraJok "
    "ตอบเป็นภาษาไทยอย่างสุภาพ อบอุ่น ชัดเจน ครอบคลุม ละเอียดลึกซึ้งในระดับมืออาชีพ "
    # Output formatting rules — 10 rules matching reference exactly
    "📐 กฎการจัดรูปแบบคำตอบ (Output Formatting Rules) — **บังคับปฏิบัติตลอด**: "
    "1. **LaTeX Math**: ใช้ $...$ สำหรับ inline math และ $$...$$ สำหรับ display math ทุกสูตรสมการ "
    "(หากใช้ \\begin{aligned} ให้หุ้มด้วย $$...$$ เสมอ) "
    "2. **Code Blocks**: ใช้ ```language\ncode\n``` พร้อมระบุภาษา "
    "(python, cpp, javascript, typescript, java, go, rust, sql, bash, json, yaml, markdown, html, css) "
    "3. **Tables**: สร้างตาราง markdown เมื่อเปรียบเทียบข้อมูล หรือแสดงขั้นตอนคำนวณ "
    "| Header1 | Header2 |\n|---|---|\n| A | B | "
    "4. **Task Lists**: ใช้ `- [ ]` และ `- [x]` สำหรับขั้นตอนหรือรายการตรวจสอบ "
    "5. **Blockquotes**: ใช้ `> quote` สำหรับข้อความสำคัญ คำพูด หรือคำแนะนำ "
    "6. **Headers**: ใช้ ## ### จัดโครงสร้างคำตอบเป็นหัวข้อย่อย "
    "7. **Bold/Italic**: ใช้ **bold** และ *italic* เน้นจุดสำคัญ "
    "8. **Links**: ใช้ [text](url) สำหรับอ้างอิงแหล่งข้อมูล "
    "9. **Horizontal Rules**: ใช้ --- แยกส่วนที่เกี่ยวข้อง "
    "10. **Mermaid**: ใช้ ```mermaid\n...``` สำหรับแผนภาพ กราฟ หรือลำดับขั้นตอน "
    # Anti-repetition rules
    "🚫 กฎต่อต้านการซ้ำซ้อน (Anti-Repetition Rules) — บังคับเด็ดขาด: "
    "- ห้ามแสดงส่วน 'สรุปคำตอบ' หรือ 'คำตอบที่ถูกต้อง' มากกว่า 1 ครั้งต่อคำตอบ "
    "- ห้ามซ้ำข้อความเดิมหรือย่อหน้าเดิมในคำตอบเด็ดขาด "
    "- ตอบครั้งเดียว สรุปครั้งเดียว จบในคำตอบเดียว "
    # Anti-hallucination math rules — expanded to match reference
    "กฎสำคัญสำหรับการคำนวณทางคณิตศาสตร์และวิชาการ (Anti-Hallucination & Precise Math Rules): "
    "1. ห้ามเดาคำตอบ หรือเดาผลลัพธ์เด็ดขาด! ต้องแสดงขั้นตอนการคำนวณทางคณิตศาสตร์ที่ถูกต้องทีละบรรทัด "
    "2. สำหรับโจทย์เศษเหลือ/ทฤษฎีบทจำนวน/ทฤษฎีเศษเหลือ (Remainder / Modular Arithmetic / LCM / ค.ร.น.): "
    "   - คำนวณ ค.ร.น. ของตัวหารอย่างแม่นยำ "
    "   - บวกเศษกลับเข้าไป ตรวจสอบเงื่อนไขช่วง "
    "   - ตรวจสอบกับตัวเลือก ก. ข. ค. ง. ให้ตรงกับข้อที่คำนวณได้ถูกต้อง 100% "
    "3. สำหรับโจทย์การโปรแกรม/เขียนโค้ด (C, C++, Python, Java, JS ฯลฯ): "
    "   - สอน 5 หัวข้อหลักพร้อมกล่องโค้ด ```lang ... ``` แยกแต่ละหัวข้อ "
    "   - โค้ดต้องถูกต้องตามไวยากรณ์ภาษา 100% "
    "4. สำหรับโจทย์คณิตศาสตร์/วิทยาศาสตร์ ใช้ LaTeX $...$ และ $$...$$ แสดงสมการแบบละเอียดทุกขั้นตอน "
    "5. หากผู้ใช้มีความเสี่ยงซึมเศร้ารุนแรง ให้แนะนำสายด่วน 1323 ด้วยความห่วงใย "
    # Language rule (kept for LINE bot which cannot render rich markdown)
    "กฎภาษา (บังคับเด็ดขาด): ห้ามตอบเป็นภาษาอังกฤษ ภาษาจีน หรือภาษาอื่น "
    "ห้ามแสดง internal thinking หรือ scratchpad ใด ๆ ตอบเฉพาะคำตอบสุดท้ายเป็นภาษาไทยเท่านั้น "
    "ตัวเลือก ก.ข.ค.ง.: ใช้อักษรไทยเท่านั้น ห้ามเปลี่ยนเป็น A/B/C/D"
)

MATH_SYSTEM_PROMPT = (
    # Exact match with reference MATH_SYSTEM_PROMPT
    "คุณคือครูสอนพิเศษคณิตศาสตร์และวิทยาศาสตร์ผู้เชี่ยวชาญระดับสูง สร้างโดยทีม JaiKraJok "
    "📐 กฎการจัดรูปแบบคำตอบ (Output Formatting Rules) — **บังคับปฏิบัติตลอด**: "
    "1. **LaTeX Math**: ใช้ $...$ สำหรับ inline math และ $$...$$ สำหรับ display math **ทุกสูตรสมการ** "
    "2. **Code Blocks**: ใช้ ```language\ncode\n``` พร้อมระบุภาษา "
    "3. **Tables**: สร้างตาราง markdown แสดงขั้นตอนคำนวณ เปรียบเทียบตัวเลือก หรือสรุปผล "
    "4. **Task Lists**: ใช้ `- [ ]` สำหรับขั้นตอนการแก้โจทย์ `- [x]` สำหรับขั้นตอนที่ทำเสร็จ "
    "5. **Blockquotes**: ใช้ `> **คำแนะนำ**` เน้นเคล็ดลับ สูตรสำคัญ หรือข้อระวัง "
    "6. **Headers**: ใช้ ## ### จัดโครงสร้าง: ## วิธีแก้, ## การคำนวณ, ## สรุปคำตอบ "
    "7. **Bold**: ใช้ **คำตอบสุดท้าย** เน้นผลลัพธ์ "
    "8. **Horizontal Rules**: ใช้ --- แยกแต่ละขั้นตอนหลัก "
    "🔤 กฎการใช้อักษรตัวเลือก (CRITICAL Choice Rule): "
    "- หากโจทย์ใช้ตัวเลือกภาษาไทย (ก. ข. ค. ง.) ให้ใช้อักษร ก. ข. ค. ง. ตลอดทั้งคำตอบ ❌ ห้ามเปลี่ยนเป็น A, B, C, D เด็ดขาด "
    "🚫 กฎต่อต้านการซ้ำซ้อน (CRITICAL Anti-Repetition): "
    "- ห้ามแสดงส่วน '## สรุปคำตอบสุดท้าย' หรือ 'คำตอบที่ถูกต้อง' มากกว่า **1 ครั้ง** ต่อคำตอบ เด็ดขาด! "
    "- ห้ามซ้ำหรือ copy ย่อหน้าเดิม ประโยคเดิม หรือข้อความเดิมในคำตอบ "
    "- ตอบจบในส่วนสรุปเดียว ไม่ต้องพูดซ้ำอีก "
    "กฎการตอบ (ห้ามเดาตัวเลข คำนวณจริงทีละขั้น): "
    "1. ตอบเป็นภาษาไทย อธิบายละเอียด ทุกขั้นตอน ห้ามสุ่มหรือเดาคำตอบเด็ดขาด "
    "2. สำหรับโจทย์เศษเหลือและการหาร: คำนวณ ค.ร.น. (LCM) ให้แม่นยำ บวกเศษกลับเข้าไป แล้วตรวจสอบเงื่อนไขขอบเขต "
    "3. หากมีตัวเลือก ก. ข. ค. ง. ให้ตรวจทานคำตอบที่คำนวณได้กับตัวเลือกอย่างระมัดระวัง แล้วระบุข้อที่ถูกต้องด้วยอักษร ก. ข. ค. ง. "
    "4. แสดงสูตรและสมการด้วย LaTeX: inline ใช้ $...$ และ block ใช้ $$...$$ "
    "5. สรุปคำตอบสุดท้าย **ครั้งเดียว** ในกรอบ $$...$$ และให้กำลังใจผู้เรียน — ห้ามซ้ำสรุปอีก! "
    "กฎภาษา: ห้ามตอบเป็นภาษาอังกฤษหรือภาษาจีน ห้ามแสดง scratchpad ใด ๆ"
)

PATHUMMA_TEXTQA_URL = "https://api.aiforthai.in.th/textqa/completion"

# thaillm-8b is a reasoning model: it wraps its scratchpad in <think>...</think>
# before the real answer. That must never reach a student, and an unclosed block
# means the token budget ran out mid-thought, leaving no answer at all.
_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)

# Matches lines that are pure Chinese (no Thai, no Latin content) — leaked Qwen3 scratchpad
_CHINESE_LINE_RE = re.compile(
    r"^[一-鿿㐀-䶿＀-￯　-〿，。！？：；「」『』【】\s]+$"
)
# Matches lines that contain ANY Chinese characters mixed with other content
# — catches hallucinations like "wind resistance。使用Newton second law旋转"
_MIXED_CHINESE_RE = re.compile(r"[一-鿿㐀-䶿，。！？：；「」『』【】]{2,}")

# Leaked English internal reasoning patterns from Qwen3-Think
_ENG_REASONING_RE = re.compile(
    r"^(The (task|user|question|problem|answer|key|goal|request|response|instruction|content|text|image|context)|"
    r"(First|Now|Next|Then|So|Also|Wait|Okay|Alright|Let|Looking|To|Because|In|Hmm|I need|"
    r"We need|Check|Note|Based on|Given|Since|Actually|However|Therefore|Thus|Finally),?\s)",
    re.IGNORECASE,
)

# English-dominant hallucination markers seen in real bad responses:
# "Step-by-step", "Part A/B/C", "EXAMPLE CASE", "Suppose", "Determine Whether"
# Also catches un-tagged Qwen3-Think scratchpad leaks (screenshot 2):
# STEP_1, [Diagram], [END OF DRAFT], Note: This draft, [Example Diagram], \boxed
_ENG_HALLUCINATION_RE = re.compile(
    r"(Step-by-step|Part [A-Z][\s：:]|EXAMPLE CASE|Suppose\s+\w+|"
    r"Determine[sd]? [Ww]hether|ObjectiveFunction|Imagine Scenario|"
    r"TheirHeightsMust|SimilarTO|SuchAs:|STEPS THREE|ASSUMPTION\(|"
    r"STEP_\d|END OF DRAFT|\[Diagram\]|\[Example\s*Diagram\]|"
    r"Note:\s*This draft|\\boxed\{)",
    re.IGNORECASE,
)

# Matches "Note: This draft..." or "[END OF DRAFT]" — marks the end of leaked scratchpad section.
# Everything AFTER this marker is the real answer.
_SCRATCHPAD_SECTION_RE = re.compile(
    r"(\[END\s+OF\s+DRAFT\]|Note:\s*This\s+draft)",
    re.IGNORECASE,
)

# Matches a full line that is ONLY a scratchpad marker (dropped entirely).
_SCRATCHPAD_LINE_RE = re.compile(
    r"^\s*(STEP_\d+\s*:|"
    r"\[Diagram\]|"
    r"\[Example\s*Diagram\]|"
    r"\[END\s+OF\s+DRAFT\]|"
    r"Note:\s*This\s+draft|"
    r"\\boxed\{)\s*$",
    re.IGNORECASE,
)


def _is_english_dominant(text: str) -> bool:
    """Return True if the reply is English-dominant (hallucination).

    Uses two signals:
    1. Hard markers: known English hallucination phrases from real bad responses
    2. Character ratio: if Latin chars outnumber Thai chars 3:1 and text is long
       (>200 chars), it's English-dominant.
    """
    # Hard marker — any occurrence means it's a hallucination
    if _ENG_HALLUCINATION_RE.search(text):
        return True
    # Character-ratio guard for long replies
    if len(text) > 200:
        latin_chars = len(re.findall(r"[A-Za-z]", text))
        thai_chars = len(re.findall(r"[฀-๿]", text))
        # English-dominant: lots of Latin, very few Thai
        if thai_chars == 0:
            return True
        if latin_chars > 0 and latin_chars > thai_chars * 3:
            return True
    return False


# ---------------------------------------------------------------------------
# Anti-hallucination guards for thaillm-8b (TokenMind)
# ---------------------------------------------------------------------------
# thaillm-8b has specific hallucination patterns not seen in Qwen3-8b-think:
#   1. Repetition loops: long runs of ---- ____ >>>  |||| with no content
#   2. Off-topic rambling: quantum mechanics, Los Angeles, automata
#   3. Full-width punctuation from Chinese: ： ， 。 which leak into Thai text
#   4. Empty numbered lists: (iv): (v): (VI). with nothing after
#   5. Mixed nonsense: random English mid-sentence ("Wait，let me correct")
#   6. Fake transliteration: made-up Thai words like "อินเทียราซิตี้"
#   7. Infinite <think> loops that exceed max_tokens with no </think>

# Repetition pattern: 10+ identical chars in a row (dashes, underscores, pipes, etc.)
_REPETITION_RE = re.compile(r"(.)\1{9,}")

# Full-width CJK punctuation that leaks into output
_CJK_PUNCT_RE = re.compile(r"[：，。；！？》《「」『』【】（）]")

# Off-topic hallucination keywords — things thaillm-8b rambles about
_OFFTOPIC_KEYWORDS = re.compile(
    r"(quantum|automata|ลอสแอนเจลิส|แมดาลา|อินเทียราซิตี้|"
    r"ไมโครโฟนอน|กฎฮวงเฮียน|เมทริกซ์ขนาดใหญ่|แอมพลิจู๊ด|"
    r"วาดรูปแบบวานร|นวนิยายแห่งโลก|กราวิตัส-แมคนามรา|"
    r"อัดลม|สาขาหลักภายใน|imgur\.com|"
    r"Wait，|Let me correct|Actually re-read|Hmm maybe better)",
    re.IGNORECASE,
)

# Empty numbered items: lines like "(iv):" or "(VI)." with nothing meaningful after
_EMPTY_ITEM_RE = re.compile(
    r"^\s*\(?(?:i{1,4}|iv|vi{0,3}|[0-9]+)[.)]:?\s*[_\s]*$",
    re.IGNORECASE | re.MULTILINE,
)


def _detect_hallucination(text: str) -> str | None:
    """Detect thaillm-8b hallucination patterns.

    Returns a reason string if hallucination is detected, None if clean.
    """
    if not text or len(text) < 20:
        return None

    # 1. Repetition loops: 10+ same character in a row
    rep_matches = _REPETITION_RE.findall(text)
    if len(rep_matches) >= 3:
        return f"repetition-loop ({len(rep_matches)} runs of repeated chars)"

    # 2. Full-width CJK punctuation (：，。) — thaillm-8b leaks these
    cjk_punct_count = len(_CJK_PUNCT_RE.findall(text))
    if cjk_punct_count >= 3:
        return f"cjk-punctuation ({cjk_punct_count} full-width marks)"

    # 3. Off-topic keywords — model is rambling about unrelated topics
    offtopic = _OFFTOPIC_KEYWORDS.findall(text)
    if offtopic:
        return f"off-topic ({offtopic[0]})"

    # 4. Too many empty numbered items (model generating skeleton with no content)
    empty_items = _EMPTY_ITEM_RE.findall(text)
    if len(empty_items) >= 3:
        return f"empty-skeleton ({len(empty_items)} empty items)"

    # 5. Coherence check: ratio of actual Thai content vs junk chars
    thai_chars = len(re.findall(r"[ก-๙]", text))
    latin_chars = len(re.findall(r"[A-Za-z]", text))
    symbol_chars = len(re.findall(r"[-_|><=+*/\\#@~`^{}()\[\]]", text))
    total = len(text)

    # If symbols outnumber meaningful text (Thai + Latin), it's junk
    meaningful = thai_chars + latin_chars
    if total > 100 and symbol_chars > meaningful:
        return f"symbol-dominant (symbols={symbol_chars} > meaningful={meaningful})"

    # 6. Low Thai density for long replies — model switched to English/gibberish
    if total > 300 and thai_chars < total * 0.15:
        return f"low-thai-density (thai={thai_chars}/{total} = {thai_chars*100//total}%)"

    # 7. Line-level noise: too many lines that are just whitespace/symbols
    lines = text.split("\n")
    if len(lines) > 5:
        junk_lines = sum(
            1 for line in lines
            if line.strip() and not re.search(r"[ก-๙A-Za-z0-9]", line)
        )
        if junk_lines > len(lines) * 0.4:
            return f"junk-lines ({junk_lines}/{len(lines)} lines are symbol-only)"

    return None


def _sanitize_reply(text: str) -> str:
    """Clean up thaillm-8b output: remove leaked CJK punctuation, fix formatting.

    Unlike _detect_hallucination (which rejects), this tries to salvage
    a mostly-good reply by stripping minor artifacts.
    """
    # Replace full-width CJK punctuation with Thai/standard equivalents
    text = text.replace("：", ": ")
    text = text.replace("，", ", ")
    text = text.replace("。", ". ")
    text = text.replace("；", "; ")
    text = text.replace("！", "! ")
    text = text.replace("？", "? ")

    # Strip repetition runs (e.g. "--------") — replace with single instance
    text = re.sub(r"(.)\1{4,}", lambda m: m.group(1) * 2, text)

    # Remove lines that are purely symbols/whitespace
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        if stripped and not re.search(r"[ก-๙A-Za-z0-9]", stripped):
            continue  # pure symbol line
        cleaned.append(line)
    text = "\n".join(cleaned)

    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def _strip_reasoning(text: str) -> str:
    """Strip <think>...</think> blocks and any leaked Chinese/English scratchpad.

    Also handles the Qwen3-Think scratchpad that leaks WITHOUT <think> tags —
    seen in screenshot 2: STEP_1, [Diagram], [END OF DRAFT], Note: This draft,
    [Example Diagram], \\boxed{} — these are internal draft markers that the
    model emits when it ignores the \"no scratchpad\" instruction.
    """
    # 0. Strip un-tagged scratchpad line markers BEFORE any other processing.
    #    These leak when Qwen3-8b-think outputs its draft without <think> wrapping.
    #    Strategy: drop any line that IS a scratchpad marker, and also drop everything
    #    from "[END OF DRAFT]" or "Note: This draft" onwards (they mark end of fake draft).

    # If a section-end marker exists, keep only text AFTER it (the actual answer)
    section_match = _SCRATCHPAD_SECTION_RE.search(text)
    if section_match:
        after_section = text[section_match.end():].strip()
        if after_section:
            text = after_section
        # else the whole thing was scratchpad — fall through, other guards will catch it

    # Drop individual scratchpad marker lines
    lines = text.split("\n")
    text = "\n".join(line for line in lines if not _SCRATCHPAD_LINE_RE.match(line))

    # 1. Proper closed <think>...</think> — extract everything AFTER </think>
    if "</think>" in text.lower():
        after = re.split(r"</think>", text, flags=re.IGNORECASE, maxsplit=1)[-1].strip()
        if after:
            text = after
        else:
            # </think> at end of string — drop the whole block
            text = _THINK_RE.sub("", text).strip()
    else:
        # 2. Unclosed <think> — drop from the tag onwards (token budget hit)
        if "<think>" in text.lower():
            text = re.split(r"<think>", text, flags=re.IGNORECASE)[0].strip()
        else:
            text = _THINK_RE.sub("", text).strip()

    # 3. Strip lines containing Chinese characters (pure OR mixed with other languages)
    # This catches hallucinations like the answer.txt output where lines mix
    # Chinese, English and Thai — e.g. "wind resistance。使用Newton" or "旋转（assuming...）"
    lines = text.split("\n")
    clean_lines = []
    for line in lines:
        if _MIXED_CHINESE_RE.search(line):
            # Line has Chinese embedded — drop it entirely
            continue
        if _CHINESE_LINE_RE.match(line.strip()):
            # Pure Chinese line — drop it
            continue
        clean_lines.append(line)
    text = "\n".join(clean_lines).strip()

    # 4. If the whole text is still majority Chinese (no Thai at all), it's a
    #    leaked reasoning block — return empty so the caller triggers fallback.
    thai_chars = len(re.findall(r"[฀-๿]", text))
    chinese_chars = len(re.findall(r"[一-鿿]", text))
    if chinese_chars > 0 and thai_chars == 0:
        return ""
    # If chinese chars outnumber Thai chars 2:1, it's still mostly hallucination
    if chinese_chars > 0 and thai_chars > 0 and chinese_chars > thai_chars * 2:
        return ""

    # 5. Strip leading English reasoning paragraphs that precede Thai content
    first_thai = next((i for i, c in enumerate(text) if "฀" <= c <= "๿"), -1)
    if first_thai > 50:
        preamble = text[:first_thai]
        if _ENG_REASONING_RE.search(preamble):
            text = text[first_thai:].strip()

    return text.strip()


def _dedup_lines(text: str) -> str:
    """Remove consecutively repeated lines/paragraphs that the model loops on.

    Strategy: split on blank lines (paragraph) and numbered list items.
    If a paragraph body is seen twice, keep only the first occurrence.
    Also catches repeating bullet-body blocks where only the header differs
    (e.g. ขั้นตอนที่ 1/2/3/4/5 all with the same bullet content underneath).
    """
    # Normalise: collapse 3+ blank lines → 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    paragraphs = text.split("\n\n")
    seen: list[str] = []
    result: list[str] = []

    def _normalise(s: str) -> str:
        # Remove leading numbering/step headers before comparing bodies
        s = re.sub(r"^\s*[\d๑-๙]+[.)]\s*", "", s, flags=re.MULTILINE)
        s = re.sub(r"^\s*ขั้นตอนที่\s*\d+.*", "", s, flags=re.MULTILINE)
        return re.sub(r"[\s\W]+", "", s).lower()

    # Also track individual bullet lines to catch repeated bullet bodies
    seen_lines: set[str] = set()

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
            # Also check if all bullet lines in this paragraph are already seen
            bullet_lines = [
                re.sub(r"[\s\W]+", "", ln).lower()
                for ln in para.split("\n")
                if ln.strip().startswith(("•", "-", "*")) and len(ln.strip()) > 5
            ]
            if len(bullet_lines) >= 2:
                new_bullets = [bl for bl in bullet_lines if bl not in seen_lines]
                if len(new_bullets) == 0:
                    duplicate = True
                else:
                    seen_lines.update(bullet_lines)
            seen.append(key)
            result.append(para)

    return "\n\n".join(result).strip()


# Matches prompts that contain math/calculation keywords — mirrors TS isMathOrChoice check.
# When detected, use MATH_SYSTEM_PROMPT + temperature=0.05 for higher precision.
# Extended with homework-pipeline keywords (โจทย์ที่อ่านได้, คำอธิบายแผนภาพ, ข้อมูลโจทย์)
# that appear in dual-OCR solve prompts so they always route through math mode.
_MATH_DETECT_RE = re.compile(
    r"(โจทย์คณิต|คำนวณ|สมการ|ค\.ร\.น\.|ห\.ร\.ม\.|เศษเหลือ|ข้อสอบ|lcm|gcd|\bmod\b|\$\d|\d+\s*[+*/%]\s*\d+|\d+\s*=\s*\d+|โจทย์ที่อ่านได้|คำอธิบายแผนภาพ|ข้อมูลโจทย์)",
    re.IGNORECASE,
)

# Matches prompts that are competitive-programming / problem-solving requests.
# Ported from isProblemSolving in pathummaApi.ts reference repo.
_PROBLEM_SOLVING_RE = re.compile(
    r"(solve|แก้โจทย์|คำตอบ|ส่งผ่าน|pass|tasks/|problem/|contest/|toi\d|codecube|leetcode|hackerrank)",
    re.IGNORECASE,
)

# Matches explicit programming tutorial requests (teach/learn, NOT problem solving).
# Ported from isExplicitTutorial in pathummaApi.ts reference repo.
_TUTORIAL_RE = re.compile(
    r"(สอน|tutorial|คู่มือ|เรียนรู้|overview|เรียนเขียน)",
    re.IGNORECASE,
)

CODING_SOLVER_PROMPT = (
    "คุณคือ กระจก (JaiKraJok) ผู้เชี่ยวชาญการแก้โจทย์โปรแกรมมิ่งและการแข่งขันอัลกอริทึม (Competitive Programming) "
    "🎯 กฎเหล็กในการตอบโจทย์โปรแกรมมิ่ง (ห้ามละเมิดเด็ดขาด):\n"
    "1. ❌ CRITICAL: Do NOT write any English thinking, reasoning, or scratchpad text. "
    "Begin directly with Thai explanations and the ```cpp ... ``` code block.\n"
    "2. **อ่าน Output Format ของโจทย์ให้ครบ 100% ก่อนเขียนโค้ด** — "
    "ดูตัวอย่าง Input/Output ในโจทย์แล้วตรวจว่าต้อง output กี่บรรทัด อะไรบ้าง\n"
    "3. **Trace ผ่าน Example ก่อนส่ง** — รัน logic ในหัวกับ example ที่โจทย์ให้ "
    "ตรวจว่า output ตรงกับ expected output ทุกบรรทัดทุกช่องว่าง\n"
    "4. ตอบตรงประเด็นด้วยโค้ดฉบับเต็มภาษา C++ (หรือภาษาที่ขอ) พร้อมใช้งาน 100% — "
    "ต้องครอบคลุมทุก output field ที่โจทย์กำหนด\n"
    "5. อธิบายแนวคิดหลัก (Algorithm & Time Complexity) อย่างกระชับชัดเจน\n"
    "6. ❌ ห้าม output น้อยกว่าหรือผิดรูปแบบที่โจทย์กำหนด "
    "(เช่น ถ้าโจทย์ต้องการ 2 บรรทัด ต้องแสดง 2 บรรทัดตามตัวอย่างอย่างถูกต้อง)"
)


def _build_extra_instruction(prompt: str) -> str:
    """Build extra instruction suffix based on prompt content.

    Ported from callTextLLM() in pathummaApi.ts reference repo.
    Returns a string to append to the user message for better formatting.
    """
    is_math = bool(_MATH_DETECT_RE.search(prompt))
    is_problem_solving = bool(_PROBLEM_SOLVING_RE.search(prompt))
    is_tutorial = bool(_TUTORIAL_RE.search(prompt))

    if is_problem_solving:
        return (
            "\n\n[ข้อบังคับในการตอบโจทย์โปรแกรมมิ่ง]: "
            "1. ตอบตรงจุดทันทีด้วยโค้ดภาษาที่ระบุ (เช่น C++) "
            "2. อธิบายแนวคิด/อัลกอริทึม (Algorithm & Complexity) อย่างกระชับ "
            "3. แสดงกล่องโค้ด ```cpp ... ``` ฉบับสมบูรณ์ที่พร้อมนำไปคอมไพล์และรันส่งผ่าน 100% "
            "4. ❌ ห้ามเขียนบทเรียน Hello World หรือบทเรียนพื้นฐานเด็ดขาด ให้แก้โจทย์ที่ระบุทันที"
        )

    if is_math:
        return (
            "\n\n[หากมีโจทย์คณิตศาสตร์ในคำขอ: แสดงขั้นตอนการคำนวณอย่างแม่นยำทีละบรรทัด ห้ามเดาตัวเลข "
            "จัดรูปแบบด้วย $$...$$ สำหรับทุกสูตรสมการ และ **Bold** เน้นคำตอบสุดท้าย]"
        )

    if is_tutorial:
        return (
            "\n\n[คำขอสอนโปรแกรมมิ่ง: เขียนบทเรียน 5 หัวข้อ: "
            "1. โครงสร้างหลัก & Hello World, 2. Variables & Data Types, "
            "3. Input & Output, 4. Conditionals & Loops, 5. Functions "
            "โดยมีกล่องโค้ด ```lang...```]"
        )

    # General formatting boost for all responses — encourage rich markdown
    return (
        "\n\n[จัดรูปแบบ: ใช้ markdown ให้ครบถ้วน — **Bold** เน้นจุดสำคัญ | `code` inline | "
        "```code blocks``` | $$LaTeX$$ สูตร | ตาราง | `- [ ]` task list | `> quote` | `---` แยกส่วน]"
    )


def _fix_thai_choices(reply: str, ocr_text: str) -> str:
    """Convert stray A/B/C/D choice letters back to ก./ข./ค./ง. if question uses Thai choices.

    Direct port of fixThaiChoices() from pathummaApi.ts in the reference repo.
    """
    if not reply:
        return reply
    # Only apply if the original OCR text actually uses Thai choice letters
    if not re.search(r"[กขคง][.)]|\bก\b|\bข\b|\bค\b|\bง\b", ocr_text):
        return reply

    r = reply
    r = re.sub(r"ตัวเลือก\s*A\b", "ตัวเลือก ก.", r, flags=re.IGNORECASE)
    r = re.sub(r"ตัวเลือก\s*B\b", "ตัวเลือก ข.", r, flags=re.IGNORECASE)
    r = re.sub(r"ตัวเลือก\s*C\b", "ตัวเลือก ค.", r, flags=re.IGNORECASE)
    r = re.sub(r"ตัวเลือก\s*D\b", "ตัวเลือก ง.", r, flags=re.IGNORECASE)

    r = re.sub(r"ข้อ\s*A\b", "ข้อ ก.", r, flags=re.IGNORECASE)
    r = re.sub(r"ข้อ\s*B\b", "ข้อ ข.", r, flags=re.IGNORECASE)
    r = re.sub(r"ข้อ\s*C\b", "ข้อ ค.", r, flags=re.IGNORECASE)
    r = re.sub(r"ข้อ\s*D\b", "ข้อ ง.", r, flags=re.IGNORECASE)

    r = re.sub(r"(คำตอบที่ถูกต้องคือ:\s*)A\b", r"\1ก.", r, flags=re.IGNORECASE)
    r = re.sub(r"(คำตอบที่ถูกต้องคือ:\s*)B\b", r"\1ข.", r, flags=re.IGNORECASE)
    r = re.sub(r"(คำตอบที่ถูกต้องคือ:\s*)C\b", r"\1ค.", r, flags=re.IGNORECASE)
    r = re.sub(r"(คำตอบที่ถูกต้องคือ:\s*)D\b", r"\1ง.", r, flags=re.IGNORECASE)

    r = re.sub(r"(คำตอบคือ:\s*)A\b", r"\1ก.", r, flags=re.IGNORECASE)
    r = re.sub(r"(คำตอบคือ:\s*)B\b", r"\1ข.", r, flags=re.IGNORECASE)
    r = re.sub(r"(คำตอบคือ:\s*)C\b", r"\1ค.", r, flags=re.IGNORECASE)
    r = re.sub(r"(คำตอบคือ:\s*)D\b", r"\1ง.", r, flags=re.IGNORECASE)

    return r


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

    # Prefer ThaiLLM (Qwen3-8b-think, best quality) → fall back to TokenMind (thaillm-8b) → textqa
    if settings.thaillm_api_key:
        result = await _generate_thaillm(prompt, settings, history=history or [])
        if result.ok:
            return result
        logger.warning("ThaiLLM LLM failed (%s); trying TokenMind", result.error)

    if settings.tokenmind_api_key:
        result = await _generate_tokenmind(prompt, settings, history=history or [])
        if result.ok:
            return result
        logger.warning("TokenMind LLM failed (%s); falling back to textqa", result.error)

    if not settings.aiforthai_api_key:
        return ServiceResult(
            service="pathumma",
            ok=False,
            error="Missing THAILLM_API_KEY / TOKENMIND_API_KEY and AIFORTHAI_API_KEY",
        )
    return await _generate_textqa(prompt, settings)


async def _generate_thaillm(prompt: str, settings, history: list | None = None) -> ServiceResult:
    """OpenAI-compatible /chat/completions call against the ThaiLLM Playground API.

    URL is always built from THAILLM_BASE_URL (default: http://thaillm.or.th/api/v1).
    On the deployed server this must be set as APP_THAILLM_BASE_URL in CI/CD variables.

    Mirrors the smart routing in callTextLLM() from pathummaApi.ts (reference repo):
    - Math/calculation prompts → MATH_SYSTEM_PROMPT + temperature=0.05 (high precision)
    - Other prompts → SYSTEM_PROMPT + temperature=0.3
    """
    base = (settings.thaillm_base_url or "http://thaillm.or.th/api/v1").rstrip("/")
    url = f"{base}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.thaillm_api_key}",
        "Content-Type": "application/json",
    }

    # Math detection: use MATH_SYSTEM_PROMPT + ultra-low temperature for precision
    is_math = bool(_MATH_DETECT_RE.search(prompt))
    is_problem_solving = bool(_PROBLEM_SOLVING_RE.search(prompt))

    # Smart system prompt routing (mirrors callTextLLM from reference repo):
    # 1. Competitive programming → CODING_SOLVER_PROMPT
    # 2. Math/science → MATH_SYSTEM_PROMPT
    # 3. General → SYSTEM_PROMPT
    if is_problem_solving:
        active_system_prompt = CODING_SOLVER_PROMPT
        temperature = 0.05
    elif is_math:
        active_system_prompt = MATH_SYSTEM_PROMPT
        temperature = 0.05
    else:
        active_system_prompt = SYSTEM_PROMPT
        temperature = 0.3

    # Build extra instruction suffix (formatting hints based on prompt type)
    extra_instruction = _build_extra_instruction(prompt)

    messages: list[dict] = [{"role": "system", "content": active_system_prompt}]
    for h in (history or [])[-10:]:
        role = "assistant" if h.get("role") == "bot" else "user"
        text = (h.get("text") or "").strip()
        if text:
            messages.append({"role": role, "content": text})
    messages.append({"role": "user", "content": prompt + extra_instruction})

    # Pathumma-ThaiLLM-qwen3-8b-think-3.0.0 is a Qwen3 reasoning model:
    # it emits <think>...</think> before the real answer — stripped below.
    # We budget 1200 tokens for the visible answer (the <think> block consumes
    # its own quota before the answer starts). 2048 total keeps latency sane.
    # Note: repetition_penalty is NOT supported by this gateway (returns 400).
    payload = {
        "model": settings.thaillm_llm_model,
        "messages": messages,
        "max_tokens": 2048,
        "temperature": temperature,  # 0.05 for math, 0.3 for general
    }
    try:
        verify = not settings.insecure_tls
        # 45s per-request timeout: ThaiLLM with Qwen3-8b-think needs time for
        # reasoning on complex physics/math problems.  For LINE bot, the overall
        # 45s deadline in web_chat.py guards against exceeding LINE's reply window.
        async with httpx.AsyncClient(timeout=60.0, verify=verify) as client:
            resp = await client.post(url, headers=headers, json=payload)
            try:
                raw = resp.json()
            except Exception:
                raw = {"text": resp.text}

            if resp.status_code >= 400:
                logger.warning("ThaiLLM HTTP %s: %s", resp.status_code, resp.text[:300])
                return ServiceResult(
                    service="pathumma",
                    ok=False,
                    error=f"HTTP {resp.status_code}",
                    raw=raw if isinstance(raw, dict) else {"body": str(raw)},
                )

            raw_dict = raw if isinstance(raw, dict) else {}
            finish_reason = ""
            choices = raw_dict.get("choices")
            if isinstance(choices, list) and choices:
                finish_reason = choices[0].get("finish_reason") or ""
            if finish_reason == "length":
                logger.warning("ThaiLLM: finish_reason=length — response cut at max_tokens")
                # Still try to use the partial answer — it may be complete enough
                # after stripping the <think> block. If stripping leaves nothing,
                # the empty-text guard below will trigger a fallback.

            text = _strip_emoji(
                _dedup_lines(_strip_reasoning(_extract_text(raw_dict)))
            )
            if not text:
                return ServiceResult(
                    service="pathumma", ok=False, error="empty reply after stripping reasoning"
                )
            # English-dominant guard: ThaiLLM-qwen3 sometimes ignores the Thai-only
            # system prompt and responds entirely in English (seen in xcv.jpg screenshot).
            # Reject those replies so the caller can fall through to the next service.
            if _is_english_dominant(text):
                logger.warning(
                    "ThaiLLM reply is English-dominant (hallucination) — "
                    "marking as failed. Preview: %r", text[:120]
                )
                return ServiceResult(
                    service="pathumma",
                    ok=False,
                    error="English-dominant reply (hallucination)",
                )
            return ServiceResult(service="pathumma", ok=True, text=text, raw=raw_dict)
    except httpx.TimeoutException:
        return ServiceResult(service="pathumma", ok=False, error="timeout")
    except Exception as exc:  # noqa: BLE001
        logger.exception("ThaiLLM call failed")
        return ServiceResult(service="pathumma", ok=False, error=str(exc))


async def _generate_tokenmind(prompt: str, settings, history: list | None = None) -> ServiceResult:
    """OpenAI-compatible /chat/completions call against the TokenMind gateway (fallback).

    NOTE: TokenMind has been observed producing hallucinated mixed Chinese/English/Thai
    output when ThaiLLM is unavailable. All replies are passed through _strip_reasoning
    which strips mixed-Chinese lines, and additionally checked for minimum Thai content
    before being accepted. Responses that contain Chinese characters or lack Thai are
    rejected so the caller can fall through to textqa.
    """
    url = f"{settings.tokenmind_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.tokenmind_api_key}",
        "Content-Type": "application/json",
    }

    # Build messages with conversation history — apply same smart routing as ThaiLLM
    is_math = bool(_MATH_DETECT_RE.search(prompt))
    is_problem_solving = bool(_PROBLEM_SOLVING_RE.search(prompt))

    if is_problem_solving:
        active_system_prompt = CODING_SOLVER_PROMPT
    elif is_math:
        active_system_prompt = MATH_SYSTEM_PROMPT
    else:
        active_system_prompt = SYSTEM_PROMPT

    extra_instruction = _build_extra_instruction(prompt)

    messages: list[dict] = [{"role": "system", "content": active_system_prompt}]

    # Append up to last 10 turns of history (user+bot pairs)
    for h in (history or [])[-10:]:
        role = "assistant" if h.get("role") == "bot" else "user"
        text = (h.get("text") or "").strip()
        if text:
            messages.append({"role": role, "content": text})

    # Append current user message
    messages.append({"role": "user", "content": prompt + extra_instruction})

    temperature = 0.05 if (is_math or is_problem_solving) else 0.3
    payload = {
        "model": settings.tokenmind_llm_model,
        "messages": messages,
        "max_tokens": 2048,
        "temperature": temperature,
        "repetition_penalty": 1.15,
    }
    try:
        verify = not settings.insecure_tls
        # 60s timeout: TokenMind is now primary LLM (thaillm-8b).
        async with httpx.AsyncClient(timeout=60.0, verify=verify) as client:
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

            # ── Hallucination guards (thaillm-8b specific) ──
            # Guard 1: Chinese chars, no Thai, or English-dominant
            _chinese_in_reply = len(re.findall(r"[一-鿿]", text))
            _thai_in_reply = len(re.findall(r"[฀-๿]", text))
            if _chinese_in_reply > 0 or _thai_in_reply == 0 or _is_english_dominant(text):
                logger.warning(
                    "TokenMind reply failed language guard "
                    "(chinese=%d thai=%d english_dominant=%s). Preview: %r",
                    _chinese_in_reply, _thai_in_reply, _is_english_dominant(text), text[:120],
                )
                return ServiceResult(
                    service="pathumma",
                    ok=False,
                    error="hallucinated reply (Chinese / no Thai / English-dominant)",
                )

            # Guard 2: Deep hallucination patterns (repetition, off-topic, junk)
            hallucination_reason = _detect_hallucination(text)
            if hallucination_reason:
                logger.warning(
                    "TokenMind reply failed hallucination guard: %s. Preview: %r",
                    hallucination_reason, text[:120],
                )
                return ServiceResult(
                    service="pathumma",
                    ok=False,
                    error=f"hallucinated reply ({hallucination_reason})",
                )

            # Sanitize: clean up minor artifacts (CJK punctuation, symbol runs)
            text = _sanitize_reply(text)

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
            timeout=25.0, verify=not settings.insecure_tls
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
