import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { MANIFEST, WORKBOX } from './src/pwa/manifest.ts'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths, so the app works from /meta-log/ and from PR preview subfolders.
  base: './',
  plugins: [
    react(),
    // Installable and offline (step 7). The app registers the service worker itself
    // (src/pwa/register.ts), so PR previews can skip it.
    VitePWA({
      registerType: 'prompt', // a new version waits for the next open; we never prompt
      injectRegister: false,
      manifest: MANIFEST,
      workbox: WORKBOX,
    }),
  ],
})
