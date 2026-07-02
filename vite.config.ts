import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  // On GitHub Pages a project site is served from /<repo>/, so assets need
  // that prefix. The deploy workflow sets VITE_BASE to "/<repo>/"; locally it
  // falls back to "/".
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  worker: {
    format: "es",
  },
  optimizeDeps: {
    // Pyodide ships its own worker-loaded wasm/JS; don't let Vite try to
    // pre-bundle it (that breaks its runtime asset resolution).
    exclude: ["pyodide"],
  },
});
