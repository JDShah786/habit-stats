// Shared motion: the four sections, spring presets, and the bubble burst.

import { animate, type Transition } from 'motion/react'
import type { MouseEvent } from 'react'

export const SECTIONS = ['Today', 'Library', 'Stats', 'My habits'] as const

export const SNAP: Transition = { type: 'spring', stiffness: 520, damping: 32 }
export const SOFT: Transition = { type: 'spring', stiffness: 260, damping: 28 }
export const BOUNCY: Transition = { type: 'spring', stiffness: 420, damping: 16 }

// Where a tap landed; the element's centre for a keyboard press (which has no pointer position).
export function tapPoint(e: MouseEvent<HTMLElement>): [number, number] {
  if (e.detail) return [e.clientX, e.clientY]
  const r = e.currentTarget.getBoundingClientRect()
  return [r.left + r.width / 2, r.top + r.height / 2]
}

// Glossy bubbles that pop out from a point and fade. Decorative only.
export function burst([x, y]: [number, number], count = 10, spread = 70) {
  for (let i = 0; i < count; i++) {
    const bubble = document.createElement('i')
    bubble.className = 'pop'
    bubble.setAttribute('aria-hidden', 'true')
    bubble.style.setProperty('--s', `${8 + Math.random() * 16}px`)
    bubble.style.left = `${x}px`
    bubble.style.top = `${y}px`
    document.body.append(bubble)
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6
    const distance = spread * (0.6 + Math.random() * 0.6)
    void animate(
      bubble,
      { x: [0, Math.cos(angle) * distance], y: [0, Math.sin(angle) * distance - 12], scale: [0.3, 1, 0], opacity: [1, 1, 0] },
      { duration: 0.55 + Math.random() * 0.25, ease: [0.2, 0.8, 0.3, 1] },
    ).then(() => bubble.remove())
  }
}
