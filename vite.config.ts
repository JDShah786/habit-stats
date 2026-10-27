import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths, so the app works from /habit-stats/ and from PR preview subfolders.
  base: './',
  plugins: [react()],
})
