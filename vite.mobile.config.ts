import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Static single-page build of the Android ride-safety prototype (mobile/).
// Capacitor loads dist-mobile/ from inside the APK, so there is no server,
// no SSR and no backend: every asset path must be relative.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: `${root}mobile`,
  base: "./",
  publicDir: `${root}mobile/public`,
  // .env.local (Firebase web config for browser testing) lives at the repo root.
  envDir: root,
  resolve: { alias: { "@": root } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [react()],
  server: { port: 5174, host: true },
  build: {
    outDir: `${root}dist-mobile`,
    emptyOutDir: true,
    target: "es2020",
    chunkSizeWarningLimit: 1_400,
  },
});
