// The iPhone "Reduce Motion" setting, kept live. Our own hook rather than Motion's, which
// reads the setting once and caches it.

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'
const media = () => (typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null)

function subscribe(onChange: () => void) {
  const m = media()
  m?.addEventListener('change', onChange)
  return () => m?.removeEventListener('change', onChange)
}

export const usePrefersReducedMotion = () => useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false)
