// Registering the service worker that makes Meta Log work offline.

// Never in a PR preview (built with VITE_PWA=off) or where the browser can't.
export const shouldRegisterServiceWorker = ({ pwa, supported }: { pwa: string | undefined; supported: boolean }) =>
  pwa !== 'off' && supported

// Built app only: the dev server has no service worker. Waits for the page to load so the
// first visit stays fast.
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return
  if (!shouldRegisterServiceWorker({ pwa: import.meta.env.VITE_PWA, supported: 'serviceWorker' in navigator })) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js', { scope: './' })
  })
}
