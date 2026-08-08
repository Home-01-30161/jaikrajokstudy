"""
TTS server — run this before using the app:
  pip install edge-tts
  python tts.py

Listens on http://localhost:5050/speak
POST {"text": "..."} → returns audio/mpeg (Ava Neural, Thai+English)
"""
import asyncio
import io
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

import edge_tts

VOICE = "en-US-AvaMultilingualNeural"
PITCH = "+30Hz"
RATE  = "+10%"
PORT  = 5050


class TTSHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != "/speak":
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length) or b"{}")
        text   = body.get("text", "").strip()

        if not text:
            self.send_response(400)
            self._cors()
            self.end_headers()
            return

        buf = io.BytesIO()

        async def _gen():
            comm = edge_tts.Communicate(text, VOICE, pitch=PITCH, rate=RATE)
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])

        asyncio.run(_gen())
        audio = buf.getvalue()

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def log_message(self, fmt, *args):
        print(f"[TTS] {args[0]} {args[1]}")


if __name__ == "__main__":
    server = HTTPServer(("localhost", PORT), TTSHandler)
    print(f"TTS server ready → http://localhost:{PORT}/speak  (Ctrl+C to stop)")
    server.serve_forever()
