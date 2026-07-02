import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
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
