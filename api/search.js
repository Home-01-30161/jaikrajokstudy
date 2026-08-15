export default async function handler(req, res) {
  const { query, max_results = 5 } = req.body ?? {};

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query is required" });
  }

  // ── Primary: SearXNG (self-hosted, free) ──────────────────────────────────
  const searxngBase = process.env.SEARXNG_URL ?? "http://searxng:8080";

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      language: "th-TH",
      engines: "google,duckduckgo,bing",
    });

    const searxResp = await fetch(`${searxngBase}/search?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!searxResp.ok) throw new Error(`SearXNG ${searxResp.status}`);

    const raw = await searxResp.json();

    // Normalise to Tavily-compatible shape so the frontend needs no changes
    const results = (raw.results ?? []).slice(0, max_results).map((r) => ({
      title:   r.title   ?? "",
      url:     r.url     ?? "",
      content: r.content ?? r.snippet ?? "",
      score:   r.score   ?? 1,
    }));

    console.log(`[search] SearXNG OK — ${results.length} results for: ${query}`);
    return res.json({ query, results, answer: raw.answers?.[0] ?? undefined });

  } catch (searxErr) {
    console.warn("[search] SearXNG failed:", searxErr.message, "— trying Tavily fallback");
  }

  // ── Fallback: Tavily (if API key is set) ──────────────────────────────────
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    console.error("[search] SearXNG failed and no TAVILY_API_KEY set");
    return res.status(503).json({ error: "Search unavailable", query, results: [] });
  }

  try {
    const tavilyResp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tavilyKey}`,
      },
      body: JSON.stringify({
        query,
        max_results,
        search_depth: req.body?.search_depth ?? "basic",
        include_answer: true,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await tavilyResp.json().catch(() => ({}));
    console.log(`[search] Tavily fallback OK — ${data.results?.length ?? 0} results`);
    return res.status(tavilyResp.status).json(data);

  } catch (tavilyErr) {
    console.error("[search] Tavily fallback also failed:", tavilyErr.message);
    return res.status(503).json({ error: "Search unavailable", query, results: [] });
  }
}
