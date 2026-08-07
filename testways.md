
## Code Quality
ESLint — linting, free/open-source, npm install
TypeScript compiler (tsc --noEmit) — already in your stack, free
npm audit — built into npm, free
CodeRabbit — free tier for public/open-source repos (your repo is public)
## Design-System Gates
Already in your repo (validate_tokens.py, axe_audit.mjs, etc.) — free, yours
Unit / Integration Testing
Vitest — free, built for Vite projects specifically (perfect fit for your stack)
React Testing Library — free, pairs with Vitest
## End-to-End + Visual Regression + Cross-Browser (all-in-one)
Playwright — completely free, open-source (made by Microsoft)
E2E scenarios
Built-in screenshot/visual diff (toHaveScreenshot())
Multi-browser out of the box (Chromium, Firefox, WebKit)
Records video/trace automatically on failure
## Accessibility
axe-core / @axe-core/playwright — free, open-source, integrates directly into Playwright tests
Pa11y CI — free, open-source alternative
## Performance
Lighthouse CI — completely free, open-source (Google)
Run via CLI or GitHub Action, no account needed
Gives Performance/Accessibility/SEO/Best-Practices scores + Core Web Vitals
## API Testing
Postman (free tier — generous, includes Newman CLI for automation)
Supertest — free, npm package, pairs with Vitest
## Load / Stress Testing
k6 — completely free, open-source (Grafana)
Also has a free cloud tier for result dashboards
Security Scanning
OWASP ZAP — completely free, open-source, automated baseline scan mode
npm audit / Dependabot — free, built into GitHub
Bundle Size
vite-bundle-visualizer — free npm package, zero config for your Vite setup
## Uptime Monitoring
UptimeRobot — free tier (50 monitors, 5-min checks) — enough for a .vercel.app demo
## AI/Model Testing (if applicable)
promptfoo — completely free, open-source, built specifically for LLM regression/benchmark testing
DeepEval — free, open-source Python framework for LLM eval metrics (accuracy, hallucination, etc.)
If you want just ONE tool that covers the most ground

Playwright is the best single pick for a school project — it's 100% free and can do:

E2E testing
Visual regression
Cross-browser testing
Accessibility audits (via axe-core plugin)
Performance traces
Screenshots/video evidence automatically saved — great for your Chapter 4 report