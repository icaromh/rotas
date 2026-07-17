import { defineConfig, loadEnv } from 'vite';
import type { UserConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:54321/functions/v1',
          changeOrigin: true
        }
      }
    },
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
              urlPattern: /^https:\/\/api\.rotas\.cc\/api\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'overpass-api',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 7 Days
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
      // Use Vitest workspace projects to support both Node and jsdom environments.
      // Project 1: Node environment for pure-logic unit tests (optimizer, gpx, etc.)
      // Project 2: jsdom environment for React component tests under src/
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
