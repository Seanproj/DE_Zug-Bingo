import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { yamlPlugin } from './scripts/vite-plugin-yaml.ts';

const api = { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } };

export default defineConfig({
  server: { proxy: api },
  preview: { proxy: api },
  plugins: [
    yamlPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Zug-Bingo',
        short_name: 'Zug-Bingo',
        description: 'German train delays, now collectible. Unofficial fan project.',
        lang: 'en',
        theme_color: '#0B0F17',
        background_color: '#0B0F17',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
