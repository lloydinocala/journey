import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,   // we register manually so we can show an update prompt
      manifest: false,         // keep our own manifest.json + portal.webmanifest (portal swaps its own)
      workbox: {
        // Precache the built app shell so both apps load instantly and open offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/functions\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // No runtime caching of Supabase API/functions — data must stay live (offline data is Level 2).
      },
      devOptions: { enabled: false },
    }),
  ],
})
