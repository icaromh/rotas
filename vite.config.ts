import { defineConfig } from 'vite';
import type { UserConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig(({ mode }) => {
  const isTest = mode === 'test' || Boolean(process.env.VITEST);

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(!isTest ? [cloudflare()] : []),
      VitePWA({
        registerType: 'prompt',
        workbox: {
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /\/api\//i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'osm-tiles',
                expiration: {
                  maxEntries: 1000,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\.(?:js|css|svg|png|woff2?)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'assets',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 Days
                },
              },
            },
          ],
        },
      }),
    ],
    test: {
      projects: [
        {
          test: {
            name: 'unit',
            environment: 'node',
            include: ['tests/**/*.test.ts'],
            globals: true,
          },
        },
        {
          plugins: [react()],
          test: {
            name: 'components',
            environment: 'jsdom',
            include: ['src/**/*.test.tsx'],
            globals: true,
            setupFiles: [],
          },
        },
      ],
    },
  } satisfies UserConfig;
});
