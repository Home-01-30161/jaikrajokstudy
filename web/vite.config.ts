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
    // Local dev only. In production the hackathon proxy strips /api before the
    // request reaches the container (guide s.7), so dev has to strip it too or
    // the same client code would hit different paths in each environment.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
