import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  /** اگر فقط Vite را جدا اجرا کنید (npm run dev --prefix client)، API را پروکسی کنید. حالت پیشنهادی: یک پورت با npm run dev از ریشه. */
  server: {
    allowedHosts: ["directory.iraniu.uk"],
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: true, credentials: true },
      "/go": { target: "http://127.0.0.1:3001", changeOrigin: true, credentials: true },
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
