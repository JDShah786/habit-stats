// Home Screen app settings (manifest) and service worker settings, used by vite.config.ts.

export interface ManifestIcon {
  src: string
  sizes: string
  type: string
  purpose?: 'maskable'
}

export const MANIFEST = {
  name: 'Meta Log',
  short_name: 'Meta Log',
  description: 'Timed habits that rank up four stats.',
  // Relative, so the app works at /meta-log/ (and anywhere else it's hosted).
  start_url: './',
  scope: './',
  display: 'standalone' as const,
  orientation: 'portrait' as const,
  background_color: '#050807',
  theme_color: '#050807',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    // Padded, so Android's round and squircle crops keep the cross arms.
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ] as ManifestIcon[],
}

export const WORKBOX = {
  // Everything the app needs, cached on first open: then it works with no signal.
  globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
  // PR previews live under the same site; their pages must never get the real app.
  navigateFallbackDenylist: [/\/pr-preview\//],
  // Quiet updates: a new version waits and takes over the next time the app opens,
  // never mid-use.
  skipWaiting: false,
  clientsClaim: false,
  cleanupOutdatedCaches: true,
}
