import { defineConfig, type Preset } from '@vite-pwa/assets-generator/config'

// Иконки из public/icon.svg. У иконки свой фон во весь квадрат, поэтому без полей.
// Запуск: npm run icons (PNG кладутся рядом в public/ и коммитятся).
const preset: Preset = {
  transparent: { sizes: [192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
  maskable: { sizes: [512], padding: 0 },
  apple: { sizes: [180], padding: 0 },
}

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset,
  images: ['public/icon.svg'],
})
