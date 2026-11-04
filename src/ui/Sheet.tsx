// A bottom sheet: slides up, closes with ✕, a tap outside, or dragging its top down.
// Rendered into <body>: inside the moving swipe track, position: fixed would follow the track.

import { motion, useDragControls, type PanInfo } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Pulling the sheet down this far, or flicking it this fast, closes it.
const CLOSE_DISTANCE = 90
const CLOSE_SPEED = 600

interface Props {
  title: string
  reduced: boolean
  onClose: () => void
  // Shown under the title, inside the draggable top.
  head?: ReactNode
  // Gets `close`, which slides the sheet away first (for e.g. closing after Save).
  children: (close: () => void) => ReactNode
}

export function Sheet({ title, reduced, onClose, head, children }: Props) {
  const titleId = useId()
  const drag = useDragControls()
  const [closing, setClosing] = useState(false)

  // Slide away, then close (see onAnimationComplete). With Reduce Motion, close at once.
  const close = () => (reduced ? onClose() : setClosing(true))

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_SPEED) close()
  }

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={() => close()} />
      <motion.div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ y: reduced ? 0 : '100%' }}
        animate={{ y: closing ? '110%' : 0 }}
        transition={closing ? { duration: 0.24, ease: [0.4, 0, 1, 1] } : { type: 'spring', stiffness: 420, damping: 34 }}
        onAnimationComplete={() => closing && onClose()}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 1 }}
        onDragEnd={onDragEnd}
      >
        {/* Grab the top of the sheet to drag it down; the rest scrolls and types as normal. */}
        <div className="sheet-grab" onPointerDown={(e) => drag.start(e)}>
          <div className="handle" aria-hidden="true" />
          <header className="sheet-head">
            <h2 id={titleId}>{title}</h2>
            <button className="close" aria-label="Close" onClick={() => close()}>
              ✕
            </button>
          </header>
          {head}
        </div>
        {children(close)}
      </motion.div>
    </>,
    document.body,
  )
}
