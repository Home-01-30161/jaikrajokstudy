// ─────────────────────────────────────────────────────────────────────────────
// vaja.js — AI for Thai Text-to-Speech (Vaja9)
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, speaker = 1, phrase_break = 0, audiovisual = 0 } = req.body ?? {};

  if (!text) {
    return res.status(400).json({ error: "Missing text parameter" });
  }

  try {
    const apiKey = process.env.AIFORTHAI_API_KEY || process.env.PATHUMMA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "AIFORTHAI_API_KEY not configured" });
    }

    // Step 1: Request TTS synthesis
    const synthResponse = await fetch("https://api.aiforthai.in.th/vaja9/synth_audiovisual", {
      method: "POST",
      headers: {
        "Apikey": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input_text: text,
        speaker: Number(speaker),
        phrase_break: Number(phrase_break),
        audiovisual: Number(audiovisual),
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!synthResponse.ok) {
      const errorText = await synthResponse.text().catch(() => "Unknown error");
      return res.status(synthResponse.status).json({
        error: `Vaja9 synthesis error: ${synthResponse.status}`,
        details: errorText.slice(0, 200)
      });
    }

    const synthData = await synthResponse.json();
    const wavUrl = synthData.wav_url;

    if (!wavUrl) {
      return res.status(500).json({
        error: "No wav_url in Vaja9 response",
        response: synthData
      });
    }

    // Step 2: Download the audio file
    const audioResponse = await fetch(wavUrl, {
      headers: { "Apikey": apiKey },
      signal: AbortSignal.timeout(30000),
    });

    if (!audioResponse.ok) {
      return res.status(audioResponse.status).json({
        error: `Failed to download audio from ${wavUrl}`,
        status: audioResponse.status
      });
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get("content-type") || "audio/wav";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error("[vaja] Error:", err?.message);
    res.status(500).json({
      error: "TTS synthesis failed",
      details: err?.message
    });
  }
}
