import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// The FastAPI app serves the built bundle from api/app/frontend at "/", so the
// build lands there directly and asset URLs stay root-relative.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "..", "api", "app", "frontend"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    host: true,
    // Local dev only: proxy API calls to the FastAPI app so the frontend can
    // use the same root-relative paths it uses in production.
    proxy: {
      "^/(chat|emotion|selfie|voice|homework|tts|trend|school|health)": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
