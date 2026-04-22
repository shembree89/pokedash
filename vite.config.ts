import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/pokedash/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-32.png", "apple-touch-icon.png", "icon.svg"],
      manifest: {
        name: "pokedash",
        short_name: "pokedash",
        description: "Competitive Pokemon Champions dashboard (VGC · Reg M-A)",
        start_url: "/pokedash/",
        scope: "/pokedash/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f0f14",
        theme_color: "#0f0f14",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,json}"],
        runtimeCaching: [
          {
            // Runtime-fetched PokeAPI data (species fallback, evolution chains)
            urlPattern: /^https:\/\/pokeapi\.co\/api\/v2\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "pokeapi",
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
