import { defineConfig } from 'vite';
import type { UserConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 Days
              }
            }
          }
        ]
      }
    }),
  ],
  test: {
    // Run unit tests in Node.js — avoids the need for a DOM/browser shim
    // while still being able to import the optimizer worker (pure TS logic).
    environment: 'node',
    // Include files under tests/ that end with .test.ts
    include: ['tests/**/*.test.ts'],
    // Enable vitest globals (describe, it, expect) without explicit imports
    globals: true,
  },
} satisfies UserConfig);
