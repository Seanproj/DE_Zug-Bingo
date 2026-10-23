import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { yamlPlugin } from './scripts/vite-plugin-yaml.ts';

export default defineConfig({
  plugins: [
    yamlPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Zug-Bingo',
        short_name: 'Zug-Bingo',
        description: '독일 기차의 지연을 수집하는 빙고 게임 (비공식 팬 프로젝트)',
        lang: 'ko',
        theme_color: '#0B0F17',
        background_color: '#0B0F17',
        display: 'standalone',
        orientation: 'portrait',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
