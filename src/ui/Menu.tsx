// Command-menu home: big stacked italic words, one per section. The last section is marked.

import { motion } from 'motion/react'
import type { MouseEvent } from 'react'
import { GhostWord } from './Decor'
import { burst, SECTIONS, SNAP, tapPoint } from './motionKit'

interface Props {
  current: number
  reduced: boolean
  onChoose: (index: number) => void
}

export function Menu({ current, reduced, onChoose }: Props) {
  const choose = (index: number, e: MouseEvent<HTMLButtonElement>) => {
    if (!reduced) burst(tapPoint(e), 12, 90)
    onChoose(index)
  }

  return (
    <div className="menu-view">
      <GhostWord word="HABITS" />
      <p className="tagline">What will you do today?</p>
      <nav className="menu" aria-label="Menu">
        {SECTIONS.map((name, i) => {
          const selected = i === current
          return (
            <motion.button
              key={name}
              className={selected ? 'sel' : undefined}
              aria-current={selected ? 'true' : undefined}
              initial={{ x: 160, opacity: 0 }}
              // The selected word jolts as the highlight lands on it.
              animate={{ x: 0, opacity: 1, rotate: selected ? [-8, 0] : 0, scale: selected ? [1.15, 1] : 1 }}
              transition={{ ...SNAP, delay: i * 0.05 }}
              whileTap={{ scale: 0.93 }}
              onClick={(e) => choose(i, e)}
            >
              {name}
            </motion.button>
          )
        })}
      </nav>
    </div>
  )
}
