import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Версия для строки в Профиле: дата и время сборки по Москве + короткий номер коммита. */
function appVersion(): string {
  const when = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date())
    .replace(',', '')
  let hash = 'dev'
  try {
    hash = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    // нет git — оставляем «dev»
  }
  return `${when} · ${hash}`
}

// https://vite.dev/config/
export default defineConfig({
  // Адрес на GitHub Pages: <логин>.github.io/sparky/ — не менять (SPEC → «Решения»).
  base: '/sparky/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Обновление не применяется само посреди работы — решает src/app/updates.ts.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        id: '/sparky/',
        name: 'Спарки',
        short_name: 'Спарки',
        description: 'Английские слова карточками',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Всё приложение (включая шрифт и витрину) — в офлайн-кэше.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico,webp}'],
      },
    }),
  ],
})
