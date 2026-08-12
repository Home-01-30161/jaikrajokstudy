import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.*', 'load-test.js'],
    files: ['client/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: true, document: true, console: true, fetch: true,
        location: true, history: true, navigator: true, performance: true,
        localStorage: true, sessionStorage: true, indexedDB: true,
        setTimeout: true, clearTimeout: true, setInterval: true, clearInterval: true,
        requestAnimationFrame: true, cancelAnimationFrame: true,
        // DOM types — these are TypeScript types, not runtime globals; suppress via no-undef off
        Blob: true, File: true, FileReader: true, FormData: true,
        URL: true, URLSearchParams: true, Headers: true, Request: true, Response: true,
        AudioContext: true, DataView: true, ArrayBuffer: true, ArrayBufferView: true,
        HTMLElement: true, HTMLButtonElement: true, HTMLDivElement: true,
        HTMLInputElement: true, HTMLTextAreaElement: true, HTMLAnchorElement: true,
        HTMLImageElement: true, SVGPolylineElement: true,
        KeyboardEvent: true, MouseEvent: true, MediaQueryListEvent: true,
        MediaRecorder: true, SpeechSynthesisUtterance: true,
        MutationObserver: true, ResizeObserver: true, IntersectionObserver: true,
        btoa: true, atob: true, crypto: true,
        // React JSX transform — React doesn't need to be in scope with new JSX runtime
        React: true,
        // Google Maps / Google OAuth globals
        google: true,
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // TypeScript handles undefined references better than ESLint; avoid false positives
      'no-undef': 'off',
      // Allow _ prefix to denote intentionally unused variables (convention used in this codebase)
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Allow any in shared UI component wrappers (shadcn-style)
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]
