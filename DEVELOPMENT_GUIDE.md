# JaiKraJok Development Guide

**Version:** 1.0  
**Last Updated:** 2026-08-07  
**Project:** JaiKraJok — Thai mental health diary for young users

---

## 1. Project Overview

**JaiKraJok** (Thai: ใจกระจก, "Mirror of the Heart") is a private, judgment-free digital diary with integrated mental health support for young Thai users. It bridges personal journaling with professional mental health resources (Thailand's 1323 hotline).

### Core Stack
- **Frontend:** Vite + React 19 + TypeScript + TailwindCSS v4
- **Backend:** Express (Node.js) — serves static files + API proxies
- **UI Components:** Radix UI primitives + custom cassette-inlay design system
- **Animation:** GSAP + Framer Motion
- **State:** React hooks + localStorage (no database)
- **AI APIs:** ThaiLLM (text), Pathumma (VQA/AudioQA), Typhoon ASR, Tavily (search), Gemini (Vision fallback)

### Key Features
- **Cassette Inlay Design** — newsprint ground (#EDE8DC), deep ink (#1A1208), signal red (#C8382A), teal grove (#3D6B5A)
- **Multi-modal input:** Text, Selfie (face emotion), Voice (ASR), Homework photo (OCR)
- **Guardian consent flow** for users under 18 (legal requirement)
- **Mood tracking** with trend visualization
- **Safety escalation** after 3 consecutive negative moods → 1323 hotline
- **Data export / deletion** (PDPA compliant)

---

## 2. Prerequisites

### Required Software
```bash
# Node.js 20+ (LTS recommended)
node --version  # v20.x.x or v22.x.x

# pnpm 10+ (package manager per package.json)
pnpm --version  # 10.4.1 or compatible
```

### Required API Keys (in `.env`)
| Variable | Purpose | Required? |
|----------|---------|-----------|
| `VITE_THAILLM_API_KEY` | ThaiLLM text chat (pathumma-thaillm-qwen3-8b-think-3.0.0) | **Yes** (falls back to mock) |
| `VITE_PATHUMMA_API_KEY` | Pathumma VQA (selfie/homework) + AudioQA fallback | Recommended |
| `VITE_GEMINI_API_KEY` | Gemini Flash Vision (fallback for VQA) | Optional |
| `VITE_TYPHOON_ASR_KEY` | Typhoon ASR (Thai speech-to-text) | Recommended |
| `VITE_TAVILY_API_KEY` | Tavily web search (live data) | Optional |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth sign-in | Optional |

**Copy and fill:**
```bash
cp .env.example .env
# Edit .env with your keys
```

---

## 3. Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start dev server (Vite + Express proxy)
pnpm dev
# → Frontend: http://localhost:5173
# → API proxies: /api/thaillm, /api/pathumma, /api/gemini, /api/typhoon, /api/tavily

# 3. Production build
pnpm build
# → Outputs to dist/

# 4. Run production server
pnpm start
# → http://localhost:3000
```

---

## 4. Project Structure

```
JaiKraJokNECTEC/
├── client/
│   └── src/
│       ├── App.tsx          # MAIN APP — 3400+ lines, all pages + logic
│       ├── main.tsx         # Entry point
│       ├── index.css        # Tailwind v4 imports + global styles
│       ├── pathummaApi.ts   # ALL AI API integrations (1000+ lines)
│       ├── components/
│       │   └── ui/          # Radix-based UI primitives (40+ components)
│       ├── hooks/           # Custom hooks (useMobile, usePersistFn, useComposition)
│       ├── contexts/        # ThemeContext (dark/light)
│       ├── lib/utils.ts     # cn() utility (clsx + tailwind-merge)
│       └── const.ts         # Shared constants
├── server/
│   └── index.ts             # Express static server + SPA fallback
├── tokens/                  # DTCG design tokens (colors, typography, spacing, etc.)
├── scripts/                 # Validation gates (contrast, tokens, hardcodes, etc.)
├── workflows/               # Design system workflows (review, QA, governance)
├── .env                     # API keys (gitignored)
├── .env.example             # Template
├── package.json
├── vite.config.ts
├── tsconfig.json
├── PRODUCT.md               # Product definition
└── CLAUDE.md                # Project instructions (design system rules)
```

---

## 5. Development Workflow

### 5.1 Adding a New Page/View

All views live in **`client/src/App.tsx`** as internal components. Follow the pattern:

1. **Define the view component** (e.g., `MyNewView`) inside `App.tsx`
2. **Add to `AppView` type** (line ~200):
   ```typescript
   type AppView = "home" | "chat" | "trend" | "safety" | "mynew";
   ```
3. **Add nav item** in `navItems` array (line ~1990):
   ```typescript
   { id: "mynew", label: "ฉันใหม่", iconSrc: IMG.someIcon },
   ```
4. **Add page label** in `pageLabel` (line ~1997):
   ```typescript
   mynew: "ฉันใหม่",
   ```
5. **Render in main content** (line ~2287):
   ```tsx
   {currentView === "mynew" && (
     <PageWrapper pageKey="mynew">
       <MyNewView {...props} />
     </PageWrapper>
   )}
   ```

### 5.2 Adding a New AI Feature

All AI logic is in **`client/src/pathummaApi.ts`**:

1. **Add new API endpoint** in the config section (lines 13-26)
2. **Create typed interface** for request/response
3. **Implement async function** following existing patterns:
   - Use `fetch` with proxy paths (`/api/...`)
   - Handle errors gracefully with fallbacks
   - Strip `` tags from Qwen3-Think output
   - Return structured result
4. **Export** and use in `App.tsx` handlers

### 5.3 Modifying the Design System

**Tokens** (source of truth) → **Tailwind v4 `@theme`** → **Components**

1. **Edit tokens** in `tokens/*.json` (DTCG format with `$type`/`$value`)
2. **Run token build:**
   ```bash
   node scripts/build_tokens.mjs
   # Outputs to CSS custom properties for Tailwind v4
   ```
3. **Verify:**
   ```bash
   node scripts/validate_tokens.py
   node scripts/validate_contrast.py   # WCAG 2.2 AA light + dark
   node scripts/lint_hardcodes.py      # No hardcoded hex/px/ms
   node scripts/accuracy_report.mjs    # All gates (one command)
   ```

### 5.4 Adding UI Components

Use existing Radix-based primitives in `client/src/components/ui/`:

```tsx
// Example: New button variant
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

<Button variant="custom" className={cn("custom-styles")} />
```

**For custom components:** Follow the `cva` + `forwardRef` pattern in existing files.

---

## 6. Key Files to Understand

| File | Purpose | Lines |
|------|---------|-------|
| `client/src/App.tsx` | **Main app** — routing, auth, all pages, chat, trend, safety | 3422 |
| `client/src/pathummaApi.ts` | **AI integration** — ThaiLLM, Pathumma, Typhoon, Tavily, Gemini | 1054 |
| `client/src/index.css` | Tailwind v4 import, CSS variables, global styles | ~100 |
| `tokens/colors.json` | 3-tier color system (primitive → semantic → component) | 14367 bytes |
| `server/index.ts` | Express static server + API proxy config | 34 |

---

## 7. Testing & Quality Gates

### Run All Gates (CI-equivalent)
```bash
# One command — all must pass
node scripts/accuracy_report.mjs

# Individual gates
node scripts/validate_tokens.py        # Token structure
node scripts/validate_contrast.py      # WCAG 2.2 AA (light + dark)
node scripts/lint_hardcodes.py         # No hardcoded values
node scripts/validate_theme_refs.py    # All var(--) resolve
node scripts/check_no_emoji.py         # No emoji anywhere
node scripts/verify_states.mjs         # Contrast in hover/focus/active
node scripts/verify_responsive.mjs     # No overflow at 280/320/414px
node scripts/axe_audit.mjs             # axe-core a11y
```

### Unit Tests
```bash
pnpm test          # vitest (currently minimal)
pnpm check         # TypeScript type check
pnpm format        # Prettier
```

---

## 8. Deployment

### Vercel (Recommended)
```bash
# 1. Push to GitHub
git push origin main

# 2. Import in Vercel
# - Framework: Vite
# - Build: pnpm build
# - Output: dist
# - Env vars: Add all VITE_* keys
```

### Manual Build + Server
```bash
pnpm build
# dist/ contains:
#   dist/public/      # Client assets
#   dist/index.js     # Bundled Express server

NODE_ENV=production node dist/index.js
# → Serves on port 3000 (or PORT env)
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## 9. Common Tasks

### 9.1 Change Color Palette
1. Edit `tokens/colors.json` — modify primitive shades (blue.50–950) or semantic mappings
2. Update `dark` section for dark mode
3. Run `node scripts/build_tokens.mjs`
4. Verify `node scripts/validate_contrast.py`

### 9.2 Add New Mood/Emotion
1. Add to `EMO` object in `App.tsx` (line ~80)
2. Add keywords to `KEYWORDS` (line ~149)
3. Add responses to `RESPONSES` (line ~157)
4. Update `SELFIE_RESULTS` / `SELFIE_NOTES` if vision-supported
5. Add to `MOOD_CUES` in `pathummaApi.ts` (line ~991)

### 9.3 Modify Onboarding Flow
Pages: `OnbWelcome` → `OnbAge` → `GuardianPage` → `PrivacyPage` → `AppShell`
- Guard logic in `App()` component (line ~3298)
- Age check: `< 18` → guardian consent required
- State persisted in `localStorage` (`jaikrajok:current_user`)

### 9.4 Debug API Calls
- Open DevTools → Network → Filter `/api/`
- Check proxy paths in `vite.config.ts` (line ~48):
  ```typescript
  server: {
    proxy: {
      '/api/thaillm': 'http://thaillm.or.th',
      '/api/pathumma': 'https://aiforthai.in.th',
      '/api/gemini': 'https://generativelanguage.googleapis.com',
      '/api/typhoon': 'https://api.opentyphoon.ai',
      '/api/tavily': 'https://api.tavily.com',
    }
  }
  ```
- API keys sent via headers in `pathummaApi.ts` helpers

---

## 10. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Single `App.tsx` | Cohesive state, shared types, fast iteration; split when >5k lines |
| localStorage only | No backend infra, privacy-first, works offline |
| Radix UI primitives | Accessible, unstyled, composable — design system owns look |
| Tailwind v4 `@theme` | Native CSS variables, no config file, token-driven |
| ThaiLLM + Pathumma | Thai-optimized models; VQA/ASR via Pathumma/Typhoon |
| GSAP for complex animations | Timeline control, stagger, scroll-trigger beyond CSS |
| No emoji in UI | Consistency, accessibility, design system mandate |

---

## 11. Troubleshooting

| Issue | Fix |
|-------|-----|
| `pnpm install` fails | Delete `node_modules`, `pnpm-lock.yaml`, re-run |
| API returns 401/403 | Check `.env` keys; verify proxy in `vite.config.ts` |
| TypeScript errors | Run `pnpm check`; fix types in `pathummaApi.ts` interfaces |
| Dark mode broken | Verify `tokens/colors.json` has `dark` section; check `ThemeContext` |
| Animation jank | Use `will-change`, `transform` over layout props; respect `prefers-reduced-motion` |
| Mobile layout overflow | Run `node scripts/verify_responsive.mjs client/src/App.tsx` |

---

## 12. Extending the Project

### Priority Areas (from PRODUCT.md)
1. **Guardian consent email integration** — currently mock (1200ms timeout)
2. **Real 1323 hotline integration** — currently `tel:` link only
3. **Server-side session storage** — replace localStorage for multi-device
4. **Push notifications** — for mood check-in reminders
5. **Admin dashboard** — `SchoolView` is a placeholder (line ~3072)

### Design System Governance
- Follow `workflows/governance.md` for versioning (SemVer)
- New components: `design-component` skill → scaffold → review → promote
- Token changes: `token-build` workflow → validate → release

---

## 13. Quick Reference Commands

```bash
# Development
pnpm dev                    # Start dev (Vite + proxy)
pnpm build                  # Production build
pnpm start                  # Run production server
pnpm preview                # Preview build locally

# Quality
pnpm check                  # TypeScript
pnpm format                 # Prettier
pnpm test                   # Vitest

# Design System Gates
node scripts/accuracy_report.mjs        # ALL gates
node scripts/validate_tokens.py         # Token structure
node scripts/validate_contrast.py       # WCAG 2.2 AA
node scripts/lint_hardcodes.py          # No hardcoded values
node scripts/verify_states.mjs <file>   # State-aware contrast
node scripts/verify_responsive.mjs <file> # Mobile overflow
node scripts/axe_audit.mjs <file>       # a11y

# Token Pipeline
node scripts/build_tokens.mjs           # DTCG → CSS vars
```

---

## 14. Important Notes

⚠️ **Never:**
- Hardcode colors, spacing, durations — use tokens
- Use emoji in UI, code, comments — use Lucide icons or plain text
- Skip verification gates — run `accuracy_report.mjs` before commit
- Add dependencies without checking existing ones first

✅ **Always:**
- Read `CLAUDE.md` (project instructions) before changes
- Follow the cassette inlay design language
- Test both light and dark mode
- Verify keyboard navigation and screen reader behavior
- Keep Thai language as primary; English only for technical terms

---

*Generated from codebase analysis on 2026-08-07. Update this guide when architecture changes.*