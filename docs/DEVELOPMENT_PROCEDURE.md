# JaiKraJok Development Procedure

**Project:** JaiKraJok (กระจกสะท้อนใจ) — Thai emotional reflection & mental health companion  
**Stack:** Vite + React 19 + TypeScript, TailwindCSS v4, Express (prod server)  
**Package Manager:** pnpm  
**Target:** Web (mobile-first, desktop-responsive)

---

## 1. Project Overview

### 1.1 Product Purpose
A private, judgment-free digital diary with integrated mental health support (Thai 1323 hotline) for young Thai users to track emotional wellbeing over time. Key differentiator: cassette inlay / newsprint analog aesthetic with warm, empathetic Thai tone.

### 1.2 Core User Flows
| Flow | Pages | Key Features |
|------|-------|--------------|
| **Onboarding** | Welcome → Age → Guardian Consent (if <18) → Privacy | Cassette card animations, OTP email verification |
| **Authentication** | Login / Signup / Google OAuth | Email/password + OTP, Google One Tap, localStorage persistence |
| **Main App** | Home (Diary) / Chat / Trend / Safety | Multi-modal input (text, selfie, voice, homework photo), sentiment tracking, crisis escalation |

### 1.3 Brand Commitments (Non-negotiable)
- Thai language interface throughout
- Collage-style analog aesthetic: grid backgrounds, hand-pen, origami stars, glasses
- Warm, non-clinical, empathetic tone
- **Safety First**: Guardian consent for <18, 1323 hotline always visible on negative emotions
- Privacy: No public sharing, localStorage-only (no backend DB for user data)

---

## 2. Environment Setup

### 2.1 Prerequisites
```bash
# Required versions
node >= 20
pnpm >= 10
```

### 2.2 Install Dependencies
```bash
cd D:\JaiKraJokNECTEC
pnpm install
```

### 2.3 Environment Variables
Copy `.env.example` to `.env` and configure:

```env
# Required for production email (fallback: Ethereal test accounts)
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_gmail_app_password

# ThaiLLM (text LLM) — required for AI features
VITE_THAILLM_API_KEY=your_thaillm_key

# Pathumma (Vision/Audio VQA) — required for selfie/homework/voice
VITE_PATHUMMA_API_KEY=your_pathumma_key

# Google OAuth — required for Google Sign-In
VITE_GOOGLE_CLIENT_ID=your_google_client_id

# Optional: Enhanced features
VITE_GEMINI_API_KEY=your_gemini_key          # Better vision fallback
VITE_TYPHOON_API_KEY=your_typhoon_key        # Better Thai ASR
VITE_TAVILY_API_KEY=your_tavily_key          # Web search grounding
```

### 2.4 Development Commands
```bash
pnpm dev          # Start Vite dev server (port 3000) + debug collector
pnpm build        # Production build (client + server bundle)
pnpm start        # Run production server (dist/index.js)
pnpm preview      # Preview production build locally
pnpm check        # TypeScript type-check (no emit)
pnpm format       # Prettier format all files
```

---

## 3. Architecture & Code Organization

### 3.1 Directory Structure
```
D:\JaiKraJokNECTEC\
├── client/                    # React frontend (Vite root)
│   ├── public/                # Static assets served as-is
│   │   ├── __manus__/         # Debug collector script
│   │   └── collage/           # Collage images (served at /collage/)
│   └── src/
│       ├── components/
│       │   ├── ui/            # Radix-based primitive components (38 files)
│       │   ├── ErrorBoundary.tsx
│       │   ├── ManusDialog.tsx
│       │   └── Map.tsx
│       ├── contexts/
│       │   └── ThemeContext.tsx
│       ├── hooks/
│       │   ├── useComposition.ts
│       │   ├── useMobile.tsx
│       │   └── usePersistFn.ts
│       ├── pages/
│       │   ├── Home.tsx       # Main diary view (imported in App.tsx)
│       │   └── NotFound.tsx
│       ├── App.tsx            # Single-file app shell (3400+ lines) — all views, state, API
│       ├── main.tsx           # Entry point
│       ├── index.css          # Tailwind v4 imports + global styles
│       ├── pathummaApi.ts     # ThaiLLM/Pathumma/Typhoon/Tavily client (1050+ lines)
│       ├── MathText.tsx       # KaTeX math rendering
│       ├── const.ts           # Constants
│       └── lib/utils.ts       # cn() utility
├── server/
│   └── index.ts               # Express static server (production only)
├── tokens/                    # Design tokens (DTCG format, 13 files)
│   ├── colors.json            # 3-tier: primitive → semantic → component + dark mode
│   ├── typography.json        # Major Third scale + composite text styles
│   ├── spacing.json           # 4px base unit + semantic aliases
│   ├── shadows.json           # 5-level elevation + focus ring
│   ├── borders.json           # Radius + width scale
│   ├── breakpoints.json       # Mobile-first breakpoints + z-index
│   ├── motion.json            # Duration, easing, keyframes, reduced-motion
│   ├── gradients.json         # Semantic gradient presets
│   ├── opacity.json           # Alpha scale (disabled, overlays, scrim)
│   ├── blur.json              # Backdrop blur scale
│   ├── sizing.json            # Control sizes, icon sizes, aspect ratios
│   ├── states.json            # 8 interaction states tokens
│   └── theming.json           # Multi-brand overrides + density modes
├── CollagePics/               # Source collage images (copied to dist/public/collage/)
├── accessibility/             # WCAG/ARIA references
├── components/                # Component specifications (atoms → templates)
├── design-systems/            # Design system library + interop
├── content/                   # Voice & tone guidelines
├── frameworks/                # Framework adapters (React, SwiftUI, etc.)
├── scripts/                   # Validation gates (contrast, tokens, hardcode lint)
├── workflows/                 # Process docs (review, QA, governance, token build)
├── .claude/skills/            # Runnable skills (design-tokens, design-component, etc.)
├── vite.config.ts             # Vite config + 9 custom plugins
├── tsconfig.json              # TypeScript config
├── PRODUCT.md                 # Product schema (impeccable format)
└── CLAUDE.md                  # Engineering standards + design system reference
```

### 3.2 Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Single-file App.tsx** | All views (login, onboarding, main app) share state & design tokens; avoids prop drilling |
| **localStorage-only persistence** | No backend DB = simpler deployment, full user privacy, works offline |
| **Vite dev server + Express prod** | Dev: hot reload + API proxies; Prod: single static server |
| **Design tokens as source of truth** | `tokens/*.json` (DTCG) → Tailwind v4 `@theme` → CSS custom properties |
| **Cassette inlay aesthetic hardcoded in App.tsx** | `T` token object (lines 52–65) defines the 6-color palette; no ThemeContext switching |
| **Emoji in mood data (EMO)** | **Known deviation** from CLAUDE.md "no emoji" rule — product requirement for mood chips; tracked for future icon migration |
| **Radix UI primitives + Tailwind** | Accessible, unstyled primitives; styled via inline `style={{}}` using `T` tokens |

---

## 4. Design System & Tokens

### 4.1 Token Hierarchy (DTCG Format)
```
Primitive (never used directly) → Semantic (design intent) → Component (scoped)
```

**Critical tokens in `App.tsx` (lines 52–65):**
```typescript
const T = {
  paper: "#EDE8DC",   // newsprint ground
  ink: "#1A1208",     // deep ink — text, borders
  red: "#C8382A",     // signal red — primary action, brand accent
  teal: "#3D6B5A",    // teal grove — secondary actions, calm states
  khaki: "#C4B88A",   // ruled line — dividers, muted labels
  smoke: "#F7F4EE",   // lighter paper — input backgrounds
  white: "#FAFAF7",   // near-white — card face
};
```

### 4.2 Using Tokens in Code
**DO:**
```tsx
// Inline styles with token reference
style={{ backgroundColor: T.paper, color: T.ink, borderColor: T.khaki }}
```

**DON'T:**
```tsx
// Hardcoded values (fails lint_hardcodes.py)
style={{ backgroundColor: "#EDE8DC" }}
className="bg-[#EDE8DC]"
```

### 4.3 Validation Gates (Run Before Commit)
```bash
# 1. Token validation (DTCG format, references resolve)
node scripts/validate_tokens.py

# 2. Contrast check (WCAG 2.2 AA, light + dark)
node scripts/validate_contrast.py

# 3. Hardcode lint (no hex/px/ms in component code)
node scripts/lint_hardcodes.py

# 4. Theme reference validation (every var(--...) resolves)
node scripts/validate_theme_refs.py

# 5. Full accuracy report (all gates + real render + states)
node scripts/accuracy_report.mjs

# 6. TypeScript check
pnpm check
```

---

## 5. Development Workflow

### 5.1 Adding a New View/Page
1. **Check existing pattern** — All views are functions inside `App.tsx` (LoginPage, OnbWelcome, OnbAge, GuardianPage, PrivacyPage, AppShell)
2. **Follow cassette card shell** — Use `OnbCard` or custom card with:
   - `background: T.white`
   - `border: 1.5px solid T.khaki` or `T.ink`
   - `box-shadow: "6px 6px 0 T.ink"` (cassette offset shadow)
   - `transform: "rotate(0.6deg)"` (slight tilt)
   - Hand-underline: `height: 2, background: T.red, transform: "rotate(-0.5deg)"`
3. **Entry animations** — Use GSAP `fromTo` with `expo.out`/`back.out` easing
4. **Responsive** — Test at 280px, 320px, 414px, 768px, 1024px
5. **Dark mode** — Current design is light-only; if adding dark, extend `T` with dark variants

### 5.2 Adding a New UI Component
1. **Check `client/src/components/ui/` first** — 38 Radix-based primitives exist
2. **If new primitive needed:**
   - Create in `client/src/components/ui/[name].tsx`
   - Use `forwardRef`, `cva` for variants, `cn()` for class merging
   - Style with `T` tokens via inline `style={{}}` (not Tailwind arbitrary values)
   - Include all 8 states: default, hover, focus, active, disabled, loading, error, selected
   - Add ARIA pattern per `accessibility/aria-patterns.md`
3. **Register in design system** — Add spec to `components/atoms.md` or `molecules.md`

### 5.3 Modifying API Integration (`pathummaApi.ts`)
1. **Understand the 4 providers:**
   - **ThaiLLM** (text): `/api/thaillm` → `pathumma-thaillm-qwen3-8b-think-3.0.0`
   - **Pathumma** (vision/audio): `/api/pathumma` → VQA + AudioQA
   - **Typhoon** (ASR): `/api/typhoon` → `typhoon-asr-realtime`
   - **Tavily** (search): `/api/tavily` → web grounding
2. **Follow existing patterns:** `callTextLLM`, `callVisionLLM`, `callTyphoonASR`, `searchWeb`
3. **Add stripThink() handling** for Qwen3 reasoning blocks
4. **Test with and without API keys** — mock fallbacks in `App.tsx`

### 5.4 Adding Collage Assets
1. **Place source in `CollagePics/`** (PNG, transparent preferred)
2. **Reference in `App.tsx` IMG object** (lines 16–40)
3. **Use `IMG.key` in JSX** — served at `/collage/key.png` via Vite plugin
4. **Build copies to `dist/public/collage/`** automatically via `vitePluginCollageBuild`

---

## 6. Key Implementation Details

### 6.1 Authentication Flow
```
Signup → Generate 6-digit OTP → POST /api/send-otp → Email sent (SMTP or Ethereal)
       → Show OtpModal with 6-digit inputs + 60s timer
       → Verify OTP → Create UserAccount in localStorage → Set current_user → Enter app

Login → Check localStorage users → Match email + passwordHash → Set current_user

Google OAuth → VITE_GOOGLE_CLIENT_ID required
             → google.accounts.oauth2.initTokenClient (implicit flow)
             → Fetch userinfo from Google → Create/find UserAccount → Set current_user
```

### 6.2 Guardian Consent (<18)
```
Age input < 18 → GuardianPage
              → Enter guardian email → Send consent request (mock/logged)
              → Guardian "approves" → approved=true → Proceed to PrivacyPage
              → Privacy accept → Enter app with guardianConsent=true
```

### 6.3 Multi-Modal Input Handling (AppShell)
| Input | Handler | API | Output |
|-------|---------|-----|--------|
| Text | `sendMessage` | `chat()` (ThaiLLM + Tavily) | Reply + emotionKey |
| Selfie | `handleSelfieFile` | `analyzeSelfie()` (Gemini Vision → Pathumma VQA) | Emotion card + reply |
| Voice | `handleVoice` (MediaRecorder) | `analyzeAudio()` (Typhoon ASR → Pathumma AudioQA) | Transcription + reply |
| Homework | `handleHomeworkFile` | `analyzeHomework()` (Vision OCR → Math LLM) | Step-by-step solution |

### 6.4 Emotion Tracking & Crisis Escalation
- **Mood detection:** Keyword-based (`classifyMoodFromText`) + LLM (`analyzeSentiment`)
- **Trend data:** Stored in localStorage `jaikrajok:trend:{userKey}` (valence + color per entry)
- **Concern streak:** 3 consecutive negative emotions → `showEscalationModal` with 1323 hotline
- **Support strip:** Shows after any concern emotion

### 6.5 Transparency Logging
Every API call logs to `transparencyLogs` state (shown in Safety view):
```
"กำลังวิเคราะห์อารมณ์จากใบหน้าของคุณ (Face Recognition API)"
"กำลังวิเคราะห์น้ำเสียงจากข้อความ (Sentiment Analysis API)"
"กำลังแปลงเสียงพูดเป็นข้อความ (Speech-to-Text API)"
"กำลังอ่านข้อความจากภาพ (OCR API)"
```

---

## 7. Testing & Quality Gates

### 7.1 Manual Testing Checklist
- [ ] **Onboarding flow:** Welcome → Age → Guardian (if <18) → Privacy → App
- [ ] **Auth:** Signup (OTP email), Login, Google OAuth, Logout
- [ ] **Chat:** Text, Selfie (camera/upload), Voice (mic), Homework photo
- [ ] **Trend view:** Valence chart renders, log entries show
- [ ] **Safety view:** 1323 hotline visible, transparency logs show
- [ ] **Responsive:** 280px, 375px, 414px, 768px, 1024px, 1440px
- [ ] **Keyboard nav:** Tab through all interactive elements, focus visible
- [ ] **Screen reader:** NVDA/VoiceOver announce mood cards, buttons, inputs
- [ ] **Reduced motion:** `prefers-reduced-motion` disables GSAP animations

### 7.2 Automated Gates (CI)
```yaml
# .github/workflows/ci.yml runs on every push/PR:
- pnpm check                    # TypeScript
- node scripts/validate_tokens.py
- node scripts/validate_contrast.py
- node scripts/lint_hardcodes.py
- node scripts/validate_theme_refs.py
- node scripts/accuracy_report.mjs  # All-in-one gate
- pnpm test                     # vitest (if tests exist)
```

### 7.3 Visual Regression
```bash
# Run visual regression (if configured)
pnpm test:visual
```

---

## 8. Deployment

### 8.1 Production Build
```bash
pnpm build
# Output: dist/public/ (client) + dist/index.js (server bundle)
```

### 8.2 Production Start
```bash
NODE_ENV=production node dist/index.js
# Serves dist/public statically, falls back to index.html for SPA routing
```

### 8.3 Environment Variables (Production)
Required in production environment:
- `SMTP_USER`, `SMTP_PASS` (real Gmail/App password for OTP emails)
- `VITE_THAILLM_API_KEY`, `VITE_PATHUMMA_API_KEY`
- `VITE_GOOGLE_CLIENT_ID` (authorized domain)
- `PORT` (default 3000)

### 8.4 Vercel/Static Hosting
The `vercel.json` configures SPA fallback. For static hosting:
```bash
pnpm build
# Deploy dist/public/ as static site
# Ensure SPA fallback to index.html for client-side routes
```

---

## 9. Common Tasks & Troubleshooting

### 9.1 "OTP email not sending"
- Check `.env` has `SMTP_USER` + `SMTP_PASS`
- Dev mode falls back to Ethereal test account — check console for preview URL
- Verify `/api/send-otp` endpoint hit in Network tab

### 9.2 "Google Sign-In not working"
- `VITE_GOOGLE_CLIENT_ID` must be set in `.env`
- Authorized redirect URIs in Google Cloud Console must include `http://localhost:3000`
- Check browser console for `google.accounts` load errors

### 9.3 "ThaiLLM / Pathumma API errors"
- Verify API keys in `.env`
- Check Vite proxy config in `vite.config.ts` (lines 364–393)
- Network tab → check `/api/thaillm`, `/api/pathumma` requests

### 9.4 "Collage images 404 in production"
- Run `pnpm build` — `vitePluginCollageBuild` copies `CollagePics/` → `dist/public/collage/`
- Verify `dist/public/collage/` has the PNG files

### 9.5 "TypeScript errors after adding component"
- Run `pnpm check`
- Ensure `client/src/components/ui/[name].tsx` exports properly
- Check `tsconfig.json` includes `client/src`

### 9.6 "Design token changes not reflecting"
- Tokens in `App.tsx` are in `const T` object (lines 52–65), NOT from `tokens/*.json` directly
- For global token changes: edit `tokens/colors.json` → run `node scripts/build_tokens.mjs` → restart dev server
- For App.tsx cassette palette: edit `T` object directly

---

## 10. Extending the Project

### 10.1 Adding a New API Provider
1. Add key to `.env.example` and `.env`
2. Add proxy in `vite.config.ts` (server.proxy)
3. Add client function in `pathummaApi.ts` following existing patterns
4. Add fallback/mock in `App.tsx` for dev without key

### 10.2 Adding a New Mood/Emotion
1. Add to `EMO` object in `App.tsx` (lines 80–147)
2. Add keywords to `KEYWORDS` (lines 149–155)
3. Add responses to `RESPONSES` (lines 157–182)
4. Add to `SELFIE_RESULTS` if vision-detectable (line 191)
5. Update `classifyMoodFromText` in `pathummaApi.ts` (lines 999–1026)

### 10.3 Adding a New Onboarding Step
1. Create component function in `App.tsx` (pattern: `OnbWelcome`, `OnbAge`)
2. Add to `Page` type union (line 199)
3. Add state and render logic in main `App` component
4. Follow cassette card + GSAP animation pattern

### 10.4 Migrating to Multi-File Architecture (Future)
When `App.tsx` exceeds maintainability:
1. Extract views: `client/src/pages/LoginPage.tsx`, `Onboarding/*.tsx`, `AppShell.tsx`
2. Extract hooks: `useAuth`, `useChat`, `useTrend`, `useAudio`
3. Extract contexts: `AuthContext`, `ThemeContext` (already exists), `SessionContext`
4. Keep `T` tokens in shared `client/src/designTokens.ts`

---

## 11. Reference Documents

| Document | Purpose |
|----------|---------|
| `PRODUCT.md` | Product schema (impeccable format) |
| `CLAUDE.md` | Engineering standards + design system reference |
| `tokens/*.json` | Design token source (DTCG) |
| `components/*.md` | Component specifications (atoms → templates) |
| `accessibility/*.md` | WCAG, ARIA, cognitive, vision, RTL, AAA |
| `workflows/design-review.md` | Review rubric + Nielsen heuristics |
| `workflows/design-qa.md` | Visual regression + a11y CI gates |
| `workflows/token-build.md` | Token pipeline → CSS/Tailwind/iOS/Android |
| `frameworks/react-tailwind.md` | React 19 + Tailwind v4 + cva patterns |
| `scripts/accuracy_report.mjs` | One-command quality gate |

---

## 12. Quick Reference: File Locations

| Need | File |
|------|------|
| Main app logic, all views, state | `client/src/App.tsx` |
| ThaiLLM/Pathumma/Typhoon/Tavily clients | `client/src/pathummaApi.ts` |
| Cassette color palette | `client/src/App.tsx:52-65` (const T) |
| Design tokens (source of truth) | `tokens/*.json` |
| UI primitives (Button, Input, etc.) | `client/src/components/ui/*.tsx` |
| Vite config + plugins | `vite.config.ts` |
| Production server | `server/index.ts` |
| Collage source images | `CollagePics/` |
| Environment template | `.env.example` |
| TypeScript config | `tsconfig.json` |
| Package scripts | `package.json` |

---

**Last Updated:** 2026-08-07  
**Version:** 1.0  
**Maintainer:** JaiKraJok Development Team