import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const BUILD_ID = String(Date.now())

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    { name: 'inject-build-id', transformIndexHtml() { return [{ tag: 'meta', attrs: { name: 'build-id', content: BUILD_ID }, injectTo: 'head' }] } },
    VitePWA({
      registerType: 'autoUpdate',   // new worker activates immediately (skipWaiting + clientsClaim)
      injectRegister: false,        // we register + auto-reload in main.jsx
      manifest: false,              // keep our own manifest.json + portal.webmanifest
      workbox: {
        // Precache the HASHED assets (immutable) so the app is installable + works offline.
        // HTML is NOT precached — it's fetched NetworkFirst so it always points at the
        // latest asset hashes (this is what prevents stale bundles).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],  // include html so navigateFallback (offline) has it
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/functions\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',            // always fetch fresh HTML online; cache only as offline fallback
            options: { cacheName: 'html', networkTimeoutSeconds: 3 },
          },
        ],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // No caching of Supabase API/functions — data stays live.
      },
      devOptions: { enabled: false },
    }),
  ],
})
