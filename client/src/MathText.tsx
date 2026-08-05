/**
 * MathText.tsx — Rich text renderer for JaiKraJok chat messages
 * Renders: LaTeX math (KaTeX), Markdown bold/headers/lists, plain text
 */
import "katex/dist/katex.min.css";
import katex from "katex";

interface Props {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a segment that may contain inline or block LaTeX + Markdown formatting.
 * Parsing order (to avoid conflicts):
 *   1. Block math  $$...$$
 *   2. Inline math $...$
 *   3. Markdown bold **...**
 *   4. Markdown headers ##, #
 *   5. Markdown numbered list 1.
 *   6. Markdown bullet  - or •
 *   7. Plain text
 */
export default function MathText({ text, className, style }: Props) {
  if (!text) return null;

  const rendered = parseSegments(text);

  return (
    <span className={className} style={{ ...style, display: "block" }}>
      {rendered}
    </span>
  );
}

// ─── Parser ───────────────────────────────────────────────────────────────────

type Segment =
  | { type: "blockMath"; latex: string }
  | { type: "inlineMath"; latex: string }
  | { type: "bold"; inner: string }
  | { type: "h2"; inner: string }
  | { type: "h3"; inner: string }
  | { type: "numberedItem"; n: string; inner: string }
  | { type: "bulletItem"; inner: string }
  | { type: "newline" }
  | { type: "text"; value: string };

function parseSegments(raw: string): React.ReactNode[] {
  // Normalise windows line endings
  const text = raw.replace(/\r\n/g, "\n");

  // Split the text into blocks by double-newline first (paragraphs)
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}`} />);

    // Match block math line: line that starts and ends with $$
    const blockMathLine = line.match(/^\s*\$\$([\s\S]*?)\$\$\s*$/);
    if (blockMathLine) {
      nodes.push(<BlockMath key={lineIdx} latex={blockMathLine[1].trim()} />);
      return;
    }

    // Match h2 header: ## ...
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      nodes.push(
        <strong key={lineIdx} style={{ display: "block", fontSize: "1.05em", marginTop: "0.6em", marginBottom: "0.2em" }}>
          {renderInline(h2Match[1])}
        </strong>
      );
      return;
    }

    // Match h3 header: ### ...
    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      nodes.push(
        <strong key={lineIdx} style={{ display: "block", fontSize: "0.98em", marginTop: "0.4em" }}>
          {renderInline(h3Match[1])}
        </strong>
      );
      return;
    }

    // Match numbered list item: 1. ...
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      nodes.push(
        <div key={lineIdx} style={{ display: "flex", gap: "0.4em", marginTop: "0.25em", alignItems: "flex-start" }}>
          <span style={{ fontWeight: 700, minWidth: "1.4em" }}>{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      );
      return;
    }

    // Match bullet item: - ... or • ...
    const bulletMatch = line.match(/^[-•]\s+(.+)$/);
    if (bulletMatch) {
      nodes.push(
        <div key={lineIdx} style={{ display: "flex", gap: "0.4em", marginTop: "0.25em", alignItems: "flex-start" }}>
          <span style={{ minWidth: "1em" }}>•</span>
          <span>{renderInline(bulletMatch[1])}</span>
        </div>
      );
      return;
    }

    // Normal line with potential inline math/bold
    nodes.push(<span key={lineIdx}>{renderInline(line)}</span>);
  });

  return nodes;
}

/**
 * Render inline content: block $$...$$, inline $...$, **bold**, plain text.
 */
function renderInline(text: string): React.ReactNode[] {
  // Token pattern: block math | inline math | bold
  const TOKEN = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\*\*[^*]+?\*\*)/g;

  const parts = text.split(TOKEN);
  return parts.map((part, i) => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      return <BlockMath key={i} latex={part.slice(2, -2).trim()} />;
    }
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      return <InlineMath key={i} latex={part.slice(1, -1).trim()} />;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── KaTeX components ──────────────────────────────────────────────────────────

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
