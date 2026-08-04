# Frontend source

The visual frontend was fetched from:

- Repository: `https://github.com/Home-01-30161/FrontEndB`
- Branch: `main`
- Commit: `048e7e169af9a05df105a8048ee425a0acff0313`
- Commit title: `V3`
- Commit date: `2026-08-04T03:53:28+07:00`

Only the deployable client and its collage assets are kept here. The upstream
prototype's mock server, editor/debug collectors, generated artifacts, and
historical design files are intentionally excluded. The client is integrated
with this repository's FastAPI API. Local builds are also copied into
`api/app/frontend/` for the single-process development fallback; production
builds use `web/Dockerfile` and serve the same client from a dedicated frontend
container on port 3000, as required by the participant deployment guide.
