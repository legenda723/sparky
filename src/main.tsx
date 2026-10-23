import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Nunito лежит в приложении: латиница и кириллица, жирность 600–900.
import '@fontsource/nunito/latin-600.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/nunito/latin-900.css'
import '@fontsource/nunito/latin-ext-600.css'
import '@fontsource/nunito/latin-ext-700.css'
import '@fontsource/nunito/latin-ext-800.css'
import '@fontsource/nunito/latin-ext-900.css'
import '@fontsource/nunito/cyrillic-600.css'
import '@fontsource/nunito/cyrillic-700.css'
import '@fontsource/nunito/cyrillic-800.css'
import '@fontsource/nunito/cyrillic-900.css'
import './index.css'
import App from './App.tsx'
import { seedDemo } from './demo'

// Временный показ (src/demo.ts): без ?demo ничего не делает.
void seedDemo().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
