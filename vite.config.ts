import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// На GitHub Pages проект живёт по пути /<имя-репозитория>/ —
// workflow передаёт его через VITE_BASE; локально base = "/".
const BASE = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Дневник питания",
        short_name: "Питание",
        description: "Дневник питания — работает офлайн, данные у вас",
        lang: "ru",
        // относительные пути резолвятся от URL манифеста — работают при любом base
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#faf8f3",
        theme_color: "#4a7c59",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"]
      }
    })
  ]
});
