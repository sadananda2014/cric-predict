import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Local dev: /   |   GitHub Pages: /cric-predict/
  base: process.env.NODE_ENV === 'production' ? '/cric-predict/' : '/',
  plugins: [react()],
})
