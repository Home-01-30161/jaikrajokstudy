# JaiKrajok

JaiKrajok is a Thai emotion-aware study companion. It combines sentiment
analysis, mood classification, Pathumma responses, OCR homework help, speech
transcription, face detection, and a LINE chatbot.

## Current Scope

- Web text chat: sentiment -> mood -> Pathumma reply.
- Web selfie mode: face presence detection only; it does not infer emotion.
- Web voice mode: browser microphone recording -> speech-to-text -> reply.
- Web homework mode: browser image selection/camera capture -> OCR -> explanation.
- Web mood trend and privacy export/delete controls use a signed HttpOnly session.
- School statistics are suppressed until at least five users exist.
- LINE currently supports text conversation, menu selection, and crisis referral.

Raw images, audio, and chat bodies are not written to the local SQLite store,
but inputs are sent to the configured external AI services for processing.

## Repository Layout

- `api/app/`: FastAPI application and service clients.
- `api/tests/`: unit and API boundary tests.
- `web/client/src/`: React frontend source.
- `api/app/frontend/`: committed Vite production output served by FastAPI.
- `docker-compose.yml`: production container and persistent upload/database volume.
- `docs/`: deployment and testing notes.

## Local Development

```powershell
cd E:\pathummalesgo
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r api\requirements.txt
cd api
python -m pytest -q
cd ..\web
npm install
npm run check
npm run build
```

Set local credentials in `.env`. For production, set `APP_SESSION_SECRET` to a
long random value and keep it stable across deployments.

Run the API from `api/`:

```powershell
uvicorn app.main:app --reload --port 8000
```

Run the frontend separately with `npm run dev`; Vite proxies `/api` to the
FastAPI server.

## Security Notes

- Web identity is issued by `POST /session` and stored in a signed HttpOnly cookie.
- Web data routes do not accept caller-supplied user IDs.
- Mutating and read requests are rate-limited per client and route.
- Uploads are streamed in bounded chunks and checked by content type.
- CORS origins are configured through `CORS_ORIGINS`; wildcard origins are not used
  with credentialed sessions.

## Verification

Run the full local checks from the repository root:

```powershell
python -m pytest -q
cd web
npm run check
npm run build
```

The external AI smoke scripts under `api/scripts/` are manual probes and require
live credentials; they are intentionally not part of the unit-test suite.
