/**
 * MathText.tsx — Rich text & code block renderer for JaiKraJok chat messages
 * Renders:
 *   - Code blocks ```cpp ... ``` with dark theme & Copy button
 *   - Inline code `code`
 *   - LaTeX math ($...$ and $$...$$ via KaTeX)
 *   - Markdown headers (##, ###), bold (**text**), lists (1., -)
 */
import { useState } from "react";
import "katex/dist/katex.min.css";
import katex from "katex";

interface Props {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function MathText({ text, className, style }: Props) {
  if (!text) return null;

  const nodes = parseFullMarkdown(text);

  return (
    <div className={className} style={{ ...style, display: "block", width: "100%" }}>
      {nodes}
    </div>
  );
}

// ─── Main Markdown Parser ──────────────────────────────────────────────────────

function parseFullMarkdown(raw: string): React.ReactNode[] {
  const text = raw.replace(/\r\n/g, "\n");
  const nodes: React.ReactNode[] = [];

  // Step 1: Extract code blocks (```lang\ncode\n```)
  const codeBlockRegex = /```([a-zA-Z0-9_+#-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const preText = text.substring(lastIndex, match.index);
    if (preText) {
      nodes.push(...parseLinesAndBlocks(preText, `pre-${lastIndex}`));
    }

    const lang = match[1].trim() || "code";
    const codeContent = match[2].trim();
    nodes.push(<CodeBlock key={`code-${match.index}`} lang={lang} code={codeContent} />);

    lastIndex = codeBlockRegex.lastIndex;
  }

  const remainingText = text.substring(lastIndex);
  if (remainingText) {
    nodes.push(...parseLinesAndBlocks(remainingText, `post-${lastIndex}`));
  }

  return nodes;
}

// ─── Parse Line-by-Line Markdown (headers, lists, math) ───────────────────────

function parseLinesAndBlocks(textBlock: string, keyPrefix: string): React.ReactNode[] {
  const lines = textBlock.split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    const key = `${keyPrefix}-${lineIdx}`;

    // Skip empty trailing lines if needed or render small gap
    if (lineIdx > 0 && line === "") {
      nodes.push(<div key={`space-${key}`} style={{ height: "0.5em" }} />);
      return;
    }

    // Match block math line: $$...$$
    const blockMathMatch = line.match(/^\s*\$\$([\s\S]*?)\$\$\s*$/);
    if (blockMathMatch) {
      nodes.push(<BlockMath key={key} latex={blockMathMatch[1].trim()} />);
      return;
    }

    // Match h1 / h2 header: # ... or ## ...
    const h2Match = line.match(/^##?\s+(.+)$/);
    if (h2Match) {
      nodes.push(
        <h3
          key={key}
          style={{
            fontWeight: 800,
            fontSize: "1.15em",
            marginTop: "0.8em",
            marginBottom: "0.3em",
            color: "inherit",
          }}
        >
          {renderInline(h2Match[1])}
        </h3>
      );
      return;
    }

    // Match h3 header: ### ...
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      nodes.push(
        <h4
          key={key}
          style={{
            fontWeight: 700,
            fontSize: "1.02em",
            marginTop: "0.6em",
            marginBottom: "0.2em",
            color: "inherit",
          }}
        >
          {renderInline(h3Match[1])}
        </h4>
      );
      return;
    }

    // Match numbered list item: 1. ...
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      nodes.push(
        <div key={key} style={{ display: "flex", gap: "0.5em", marginTop: "0.3em", alignItems: "flex-start" }}>
          <span style={{ fontWeight: 700, minWidth: "1.5em", opacity: 0.85 }}>{numMatch[1]}.</span>
          <div style={{ flex: 1 }}>{renderInline(numMatch[2])}</div>
        </div>
      );
      return;
    }

    // Match bullet item: - ... or • ... or * ...
    const bulletMatch = line.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      nodes.push(
        <div key={key} style={{ display: "flex", gap: "0.5em", marginTop: "0.3em", alignItems: "flex-start" }}>
          <span style={{ opacity: 0.7, minWidth: "1em" }}>•</span>
          <div style={{ flex: 1 }}>{renderInline(bulletMatch[1])}</div>
        </div>
      );
      return;
    }

    // Normal line
    nodes.push(
      <div key={key} style={{ marginTop: lineIdx === 0 ? 0 : "0.2em" }}>
        {renderInline(line)}
      </div>
    );
  });

  return nodes;
}

// ─── Inline Token Parser (Math, Code, Bold) ───────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  // Tokens:
  // 1. Block Math: $$...$$
  // 2. Inline Math: $...$
  // 3. Inline Code: `...`
  // 4. Bold: **...**
  const TOKEN_REGEX = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|`[^`\n]+?`|\*\*[^*]+?\*\*)/g;

  const parts = text.split(TOKEN_REGEX);
  return parts.map((part, i) => {
    if (!part) return null;

    if (part.startsWith("$$") && part.endsWith("$$")) {
      return <BlockMath key={i} latex={part.slice(2, -2).trim()} />;
    }
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      return <InlineMath key={i} latex={part.slice(1, -1).trim()} />;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <InlineCode key={i} code={part.slice(1, -1)} />;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Code Block Component with Dark Theme & Copy Button ───────────────────────

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        margin: "0.8em 0",
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: "#181825",
        color: "#CDD6F4",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        fontSize: "0.85em",
        border: "1px solid #313244",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "between",
          alignItems: "center",
          padding: "0.4em 0.9em",
          backgroundColor: "#11111B",
          borderBottom: "1px solid #313244",
          fontSize: "0.82em",
          color: "#A6ADC8",
        }}
      >
        <span style={{ fontWeight: 600, textTransform: "lowercase" }}>{lang || "code"}</span>
        <button
          onClick={handleCopy}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "1px solid #45475A",
            borderRadius: "6px",
            color: copied ? "#A6E3A1" : "#BAC2DE",
            padding: "0.2em 0.6em",
            fontSize: "0.82em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.3em",
            transition: "all 0.2s",
          }}
        >
          {copied ? "✓ Copied" : "📋 Copy"}
        </button>
      </div>

      {/* Code body */}
      <pre
        style={{
          margin: 0,
          padding: "0.9em 1.1em",
          overflowX: "auto",
          lineHeight: 1.5,
          fontFamily: "inherit",
          whiteSpace: "pre",
          tabSize: 2,
        }}
      >
        <code>{highlightSyntax(code, lang)}</code>
      </pre>
    </div>
  );
}

// Simple lightweight syntax colorizer
function highlightSyntax(code: string, lang: string): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, idx) => {
    // Comment line
    if (line.trim().startsWith("//") || line.trim().startsWith("# ")) {
      return (
        <span key={idx} style={{ color: "#6C7086", fontStyle: "italic" }}>
          {line}
          {idx < lines.length - 1 ? "\n" : ""}
        </span>
      );
    }

    return (
      <span key={idx}>
        {colorLineKeywords(line, lang)}
        {idx < lines.length - 1 ? "\n" : ""}
      </span>
    );
  });
}

function colorLineKeywords(line: string, lang: string): React.ReactNode[] {
  // Highlight C++/Python keywords, numbers, strings
  const KEYWORD_REGEX = /\b(include|using|namespace|int|double|float|char|string|bool|void|class|struct|if|else|for|while|return|cout|cin|endl|std|true|false|auto|const|def|import|from|print|in|range)\b|("[^"]*"|'[^']*')|(\/\/.*$)/g;

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = KEYWORD_REGEX.exec(line)) !== null) {
    if (match.index > lastIdx) {
      parts.push(line.substring(lastIdx, match.index));
    }

    const matchedStr = match[0];
    if (matchedStr.startsWith("//")) {
      parts.push(<span key={match.index} style={{ color: "#6C7086", fontStyle: "italic" }}>{matchedStr}</span>);
    } else if (matchedStr.startsWith('"') || matchedStr.startsWith("'")) {
      parts.push(<span key={match.index} style={{ color: "#A6E3A1" }}>{matchedStr}</span>);
    } else {
      parts.push(<span key={match.index} style={{ color: "#F38BA8", fontWeight: 600 }}>{matchedStr}</span>);
    }

    lastIdx = KEYWORD_REGEX.lastIndex;
  }

  if (lastIdx < line.length) {
    parts.push(line.substring(lastIdx));
  }

  return parts;
}

// ─── Inline Code Badge ────────────────────────────────────────────────────────

function InlineCode({ code }: { code: string }) {
  return (
    <code
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.07)",
        color: "#C41E3A",
        padding: "0.15em 0.4em",
        borderRadius: "4px",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: "0.88em",
        border: "1px solid rgba(0, 0, 0, 0.1)",
      }}
    >
      {code}
    </code>
  );
}

// ─── KaTeX Components ─────────────────────────────────────────────────────────

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      trust: false,
      strict: false,
    });
  } catch {
    return latex;
  }
}

function InlineMath({ latex }: { latex: string }) {
  const html = renderKatex(latex, false);
  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ display: "inline" }}
    />
  );
}

function BlockMath({ latex }: { latex: string }) {
  const html = renderKatex(latex, true);
  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        display: "block",
        overflowX: "auto",
        margin: "0.5em 0",
        textAlign: "center",
      }}
    />
  );
}
