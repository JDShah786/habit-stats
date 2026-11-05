import { describe, expect, it } from 'vitest'
import { isIOS, isStandalone, shouldShowInstallHint } from './installHint'
import { MANIFEST, WORKBOX } from './manifest'
import { shouldRegisterServiceWorker } from './register'

describe('the Home Screen app (manifest)', () => {
  it('is called Meta Log, opens full screen in portrait, in the app colours', () => {
    expect(MANIFEST).toMatchObject({
      name: 'Meta Log',
      short_name: 'Meta Log',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#050807',
      theme_color: '#050807',
    })
  })

  it('starts and stays inside its own folder, wherever it is hosted (relative paths)', () => {
    expect(MANIFEST.start_url).toBe('./')
    expect(MANIFEST.scope).toBe('./')
    expect(MANIFEST.icons.every((icon) => !icon.src.startsWith('/'))).toBe(true)
  })

  it('has 192 and 512 icons, plus a padded 512 for Android shapes', () => {
    const icons = MANIFEST.icons.map((i) => `${i.sizes} ${i.type} ${i.purpose ?? 'any'}`)
    expect(icons).toEqual(expect.arrayContaining(['192x192 image/png any', '512x512 image/png any', '512x512 image/png maskable']))
  })
})

describe('the service worker (offline and updates)', () => {
  it('updates quietly: a new version waits and takes over the next time the app opens', () => {
    expect(WORKBOX.skipWaiting).toBe(false)
    expect(WORKBOX.clientsClaim).toBe(false)
  })

  it('caches the app, its fonts and icons for offline use', () => {
    expect(WORKBOX.globPatterns).toEqual(expect.arrayContaining(['**/*.{js,css,html,woff2,png,svg}']))
  })

  it('leaves PR previews alone: their pages never get the real app', () => {
    const ignored = (path: string) => WORKBOX.navigateFallbackDenylist.some((rule) => rule.test(path))
    expect(ignored('/meta-log/pr-preview/pr-23/')).toBe(true)
    expect(ignored('/meta-log/')).toBe(false)
  })

  it('is registered in the real app, never in a PR preview or where there is no support', () => {
    expect(shouldRegisterServiceWorker({ pwa: undefined, supported: true })).toBe(true)
    expect(shouldRegisterServiceWorker({ pwa: 'off', supported: true })).toBe(false)
    expect(shouldRegisterServiceWorker({ pwa: undefined, supported: false })).toBe(false)
  })
})

describe('the install hint', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
  const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'
  const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'

  it('knows an iPhone or iPad, including an iPad asking for the desktop site (a "Mac" with touch)', () => {
    expect(isIOS(IPHONE, 5)).toBe(true)
    expect(isIOS(IPAD, 5)).toBe(true)
    expect(isIOS(MAC, 5)).toBe(true)
    expect(isIOS(MAC, 0)).toBe(false)
    expect(isIOS(WINDOWS, 0)).toBe(false)
    expect(isIOS(ANDROID, 5)).toBe(false)
  })

  it('knows when it is running as the installed app', () => {
    const media = (standalone: boolean) => (q: string) => ({ matches: standalone && q === '(display-mode: standalone)' })
    expect(isStandalone({ matchMedia: media(true), navigator: {} })).toBe(true)
    expect(isStandalone({ matchMedia: media(false), navigator: { standalone: true } })).toBe(true) // older iOS
    expect(isStandalone({ matchMedia: media(false), navigator: {} })).toBe(false)
  })

  it('shows only on an iPhone or iPad, not installed yet, and not dismissed', () => {
    expect(shouldShowInstallHint({ ios: true, standalone: false, dismissed: false })).toBe(true)
    expect(shouldShowInstallHint({ ios: true, standalone: true, dismissed: false })).toBe(false)
    expect(shouldShowInstallHint({ ios: true, standalone: false, dismissed: true })).toBe(false)
    expect(shouldShowInstallHint({ ios: false, standalone: false, dismissed: false })).toBe(false)
  })
})
