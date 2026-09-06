import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      selfDestroying: true,   // TEMP: remove the stuck SW cache everywhere (auto, on next load). Re-add a proper SW with Level-2 offline later.
      registerType: 'autoUpdate',
      injectRegister: false,   // we register manually so we can show an update prompt
      manifest: false,         // keep our own manifest.json + portal.webmanifest (portal swaps its own)
      workbox: {
        // Precache hashed assets for instant/offline loads. HTML is fetched fresh
        // (NetworkFirst) so per-host branding in index.html is never stale; falls
        // back to cache only when offline.
        globPatterns: ['**/*.{js,css,ico,png,svg,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/functions\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'html', networkTimeoutSeconds: 3 },
          },
        ],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // No runtime caching of Supabase API/functions — data must stay live (offline data is Level 2).
      },
      devOptions: { enabled: false },
    }),
  ],
})
