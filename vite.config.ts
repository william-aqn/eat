import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Дневник питания",
        short_name: "Питание",
        description: "Дневник питания — работает офлайн, данные хранятся у вас",
        lang: "ru",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#faf8f3",
        theme_color: "#4a7c59",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        // OAuth-редиректы обязаны дойти до воркера, а не до SPA-фолбэка сервис-воркера
        navigateFallbackDenylist: [/^\/auth\//]
      }
    })
  ]
});
