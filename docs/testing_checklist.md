# Testing Checklist

Run the local checks before testing external AI or LINE. The web UI requires a
server-owned session cookie; it must never receive a caller-supplied `user_id`.

## 1. Automated checks

From the repository root:

```powershell
python -m pytest -q
cd web
npm run check
npm run build
```

`npm run build` writes the committed frontend bundle to
`api/app/frontend/`, which is served by FastAPI.

## 2. API smoke test

Start the API:

```powershell
cd E:\pathummalesgo\api
uvicorn app.main:app --reload --port 8000
```

Check health at `http://127.0.0.1:8000/health`. In production it must include
`"session_configured": true`; a missing `APP_SESSION_SECRET` must produce
HTTP 503 and fail deployment.

Create a browser session and verify protected routes:

```powershell
curl -i -X POST http://127.0.0.1:8000/session
curl -i http://127.0.0.1:8000/trend
curl -i http://127.0.0.1:8000/trend/someone-else
```

The first request sets the `jaikrajok_session` HttpOnly cookie. A client that
does not send that cookie must receive HTTP 401. The old user-ID route must
receive HTTP 404, not access another user's data.

## 3. Web modes

Open the frontend and check each mode with a real input:

- Text: sends a message and records a server-side mood event.
- Selfie: uploads an image and reports face presence only; it must not claim to
  infer emotion from facial expression.
- Voice: requests microphone permission, records at most five seconds, and
  sends the actual audio to speech-to-text.
- Homework: selects or captures a real image, runs OCR, and explains the
  extracted text.
- Trend: reload the page and confirm server history remains. Export must use
  the server response. Delete must remove server-side data, not only hide rows.
- School: with fewer than five users, the page must show suppression and no
  ratios or mood distribution.

## 4. LINE webhook

Run the local bot probe only when credentials are available:

```powershell
cd E:\pathummalesgo
python api\scripts\test_bot_local.py
```

For a local LINE test:

```powershell
ngrok http 8000
```

Set the webhook URL to `https://YOUR-ID.ngrok-free.app/webhooks/line`, verify
the webhook, then send a text message. The server must verify the LINE
signature before processing the event.

For production use:

```text
https://team07.aiforthai.in.th/api/webhooks/line
```

Required masked CI variables are `APP_AIFORTHAI_API_KEY`,
`APP_LINE_CHANNEL_ACCESS_TOKEN`, `APP_LINE_CHANNEL_SECRET`, and
`APP_SESSION_SECRET`.

## 5. Safety checks

- Crisis text bypasses the LLM and recommends 1323.
- Repeated concerning moods show support resources but do not claim to notify
  a counselor automatically.
- External AI processing is disclosed in the privacy screen.
- The app does not claim AES-256 storage encryption, human-in-the-loop
  escalation, facial emotion recognition, or automatic guardian email
  verification unless those features are actually implemented.
