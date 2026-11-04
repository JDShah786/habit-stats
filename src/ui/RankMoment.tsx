// Full-screen rank-up and graduation moments (SPEC "Screens"), following the approved prototype
// (design/mockups/motion.html). Rank-up: about 1.8 s, tappable after 0.7 s. Graduation: about
// 2.4 s, tappable after 1 s; GRADUATED! lands first with impact frames and a boom.
// With Reduce Motion it only fades. Rendered into <body>, above the log sheet.

import { animate } from 'motion/react'
import { useEffect, useEffectEvent, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { STATS, titleOf } from '../engine/stats'
import type { Moment, RankUp } from './moments'
import { BOUNCY, burst, centerOf, shockwave, SNAP, sparks } from './motionKit'
import { statName } from './todayView'

interface Props {
  moment: Moment
  reduced: boolean
  // Called once it has been tapped away and has left the screen.
  onDone: () => void
}

const EXIT_EASE = [0.6, 0, 1, 1] as const
const READY_MS = { rankUp: 700, graduated: 1000 }
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

export function RankMoment({ moment, reduced, onDone }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const contentId = useId()
  const [ready, setReady] = useState(false)
  const leaving = useRef(false)
  const graduated = moment.type === 'graduated'
  // Bubbles rising behind the content: random once, then fixed. None with Reduce Motion.
  const [rising] = useState(() =>
    reduced
      ? []
      : Array.from({ length: graduated ? 24 : 14 }, () => ({
          '--l': `${Math.random() * 100}%`,
          '--s': `${10 + Math.random() * 34}px`,
          '--d': `${4 + Math.random() * 4}s`,
          '--dl': `${-Math.random() * 6}s`,
        })),
  )

  // The entrance. Runs once per moment (each moment gets its own key).
  useEffect(() => {
    const el = root.current!
    const one = (selector: string) => el.querySelector(selector)!
    const timers: number[] = []
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms))
    const before = document.activeElement as HTMLElement | null
    el.focus()

    // Big words shrink to fit narrow phones.
    const fit = (selector: string, max: number, perChar: number) => {
      const word = one(selector) as HTMLElement
      word.style.fontSize = `${Math.max(20, Math.min(max, (el.clientWidth - 60) / (word.textContent!.length * perChar)))}px`
    }
    if (graduated) fit('.gr-hero', 64, 0.72)
    else fit('.mo-stat', 72, 0.78)

    if (reduced) {
      void animate(el, { opacity: [0, 1] }, { duration: 0.25 }).then(() => setReady(true))
    } else {
      void animate(one('.mo-bg'), { opacity: [0, 1] }, { duration: 0.15 })
      el.querySelectorAll('.mo-stripes i').forEach((stripe, i) =>
        animate(stripe, { x: [i % 2 ? '140%' : '-140%', '0%'] }, { ...SNAP, delay: 0.05 + i * 0.07 }),
      )
      if (graduated) playGraduation(el, one, later)
      else playRankUp(one, later)
      void animate(one('.mo-tap'), { opacity: [0, 1] }, { duration: 0.3, delay: graduated ? 2.2 : 1.8 })
      later(READY_MS[moment.type], () => setReady(true))
    }
    return () => {
      timers.forEach(clearTimeout)
      if (before?.isConnected) before.focus()
    }
  }, [reduced, graduated, moment.type])

  // Slide away, then hand back. Only once, and only when ready.
  const leave = async () => {
    if (!ready || leaving.current) return
    leaving.current = true
    const el = root.current!
    if (reduced) await animate(el, { opacity: 0 }, { duration: 0.2 })
    else {
      void animate(el.querySelector('.mo-exit')!, { x: [0, 480], opacity: [1, 0] }, { duration: 0.3, ease: EXIT_EASE })
      el.querySelectorAll('.mo-stripes i').forEach((stripe, i) =>
        animate(stripe, { x: i % 2 ? '-140%' : '140%' }, { duration: 0.3, ease: EXIT_EASE, delay: i * 0.04 }),
      )
      await animate(el, { opacity: 0 }, { duration: 0.25, delay: 0.18 })
    }
    onDone()
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') void leave()
  })
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e)
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [])

  return createPortal(
    <div
      ref={root}
      className={reduced ? 'moment calm' : 'moment'}
      role="dialog"
      aria-modal="true"
      aria-label={graduated ? 'Graduated' : 'Rank up'}
      aria-describedby={contentId}
      tabIndex={-1}
      onClick={() => void leave()}
    >
      <div className="mo-bg" />
      <div className="mo-stripes" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="mo-rise" aria-hidden="true">
        {rising.map((style, i) => (
          <i key={i} style={style as CSSProperties} />
        ))}
      </div>
      <div className="mo-flash" />
      <div className="mo-lines" />
      <div className="mo-shake">
        <div className="mo-exit">
          <div className="mo-content" id={contentId}>
            {moment.type === 'graduated' ? <Graduation /> : <RankUpContent moment={moment} />}
          </div>
        </div>
      </div>
      <button className="mo-tap seq" disabled={!ready} onClick={() => void leave()}>
        <span>Tap to continue</span>
      </button>
    </div>,
    document.body,
  )
}

type Pick = (selector: string) => Element
type Later = (ms: number, run: () => void) => void

const shake = (el: Element, big: boolean, delay = 0) =>
  animate(
    el,
    big ? { x: [0, -18, 15, -11, 7, -3, 0], y: [0, 11, -9, 5, -2, 0] } : { x: [0, -9, 8, -5, 3, 0], y: [0, 5, -4, 2, 0] },
    { duration: big ? 0.5 : 0.35, delay },
  )

function playRankUp(one: Pick, later: Later) {
  void animate(one('.mo-flash'), { opacity: [0, 0.9, 0] }, { duration: 0.35 })
  void animate(one('.mo-label'), { scale: [0, 1], rotate: [-20, 0], opacity: [0, 1] }, { ...BOUNCY, delay: 0.2 })
  void animate(one('.mo-stat'), { x: [-420, 0], skewX: [-25, 0], opacity: [0, 1] }, { type: 'spring', stiffness: 260, damping: 20, delay: 0.25 })
  void animate(one('.mo-oldwrap'), { x: [-30, 0], opacity: [0, 1] }, { duration: 0.25, delay: 0.45 })
  void animate(one('.mo-arrow'), { x: [-20, 0], opacity: [0, 1] }, { duration: 0.25, delay: 0.6 })
  void animate(one('.mo-new'), { scale: [3.2, 1], rotate: [25, 0], opacity: [0, 1] }, { type: 'spring', stiffness: 380, damping: 16, delay: 0.75 })
  later(850, () => {
    burst(centerOf(one('.mo-new')), 28, 180)
    void shake(one('.mo-shake'), false)
  })
  void animate(one('.mo-told'), { opacity: [0, 1] }, { duration: 0.2, delay: 0.95 })
  void animate(one('.mo-told i'), { scaleX: [0, 1] }, { duration: 0.25, delay: 1.15 })
  void animate(one('.mo-tnew'), { scale: [0, 1], rotate: [12, 0], opacity: [0, 1] }, { ...BOUNCY, delay: 1.3 })
  const next = one('.mo-content').querySelector('.mo-next')
  if (next) void animate(next, { y: [12, 0], opacity: [0, 1] }, { duration: 0.3, delay: 1.5 })
}

// Impact frames: negative, hot, negative, about 70 ms each, centred on the hit. Two bright
// flashes at most (WCAG 2.3.1 allows three a second).
async function impactFrames(el: HTMLElement, [x, y]: [number, number]) {
  const box = el.getBoundingClientRect()
  el.style.setProperty('--cx', `${x - box.left}px`)
  el.style.setProperty('--cy', `${y - box.top}px`)
  for (const frame of ['imp-a', 'imp-b', 'imp-a']) {
    el.classList.add(frame)
    await wait(70)
    el.classList.remove(frame)
  }
}

function playGraduation(el: HTMLElement, one: Pick, later: Later) {
  const hero = one('.gr-hero')
  // 1. GRADUATED! slams down from 4x.
  void animate(hero, { scale: [4, 1], rotate: [-25, 0], opacity: [0, 1] }, { type: 'spring', stiffness: 520, damping: 24, delay: 0.12 })
  // 2. It lands: impact frames and the boom.
  later(300, () => {
    const at = centerOf(hero)
    void impactFrames(el, at)
    shockwave(at)
    sparks(at, 24, 230)
    burst(at, 40, 260)
    void shake(one('.mo-shake'), true, 0.21)
  })
  // 3. The four stats at MAX, then GOOD JOB! and the message.
  el.querySelectorAll('.gr-row').forEach((row, i) =>
    animate(row, { x: [i % 2 ? 420 : -420, 0], opacity: [0, 1] }, { type: 'spring', stiffness: 320, damping: 26, delay: 0.75 + i * 0.1 }),
  )
  const good = one('.gr-good')
  void animate(good, { scale: [0, 1], rotate: [14, 0], opacity: [0, 1] }, { ...BOUNCY, delay: 1.35 })
  later(1450, () => burst(centerOf(good), 16, 120))
  void animate(one('.gr-msg'), { y: [12, 0], opacity: [0, 1] }, { duration: 0.35, delay: 1.7 })
}

function RankUpContent({ moment }: { moment: RankUp }) {
  const max = moment.toRank === 5
  return (
    <>
      <span className="mo-label seq">{max ? 'Max rank!' : 'Rank up!'}</span>
      <span className="mo-stat seq">{statName(moment.stat)}</span>
      <div className="mo-rank">
        <div className="mo-oldwrap seq">
          <small>Rank</small>
          <span className="mo-old">{moment.fromRank}</span>
        </div>
        <span className="mo-arrow seq" aria-hidden="true" />
        <span className="sr-only"> to </span>
        <span className="mo-new seq">{moment.toRank}</span>
      </div>
      <div className="mo-title">
        <span className="mo-told seq">
          {moment.fromTitle}
          <i aria-hidden="true" />
        </span>
        <span className="sr-only"> to </span>
        <span className="mo-tnew seq">{moment.toTitle}</span>
      </div>
      {/* Like the games: no threshold or next title. Only a max rank-up gets a line. */}
      {max && <span className="mo-next seq">Maxed · stops counting</span>}
    </>
  )
}

function Graduation() {
  return (
    <>
      <span className="gr-hero seq">Graduated!</span>
      <div className="gr-stats">
        {STATS.map((stat) => (
          <div key={stat} className="gr-row seq">
            <b>{statName(stat)}</b>
            <span>Max · {titleOf(stat, 5)}</span>
          </div>
        ))}
      </div>
      <span className="gr-good seq">Good job!</span>
      <span className="gr-msg seq">These habits are part of you now.</span>
    </>
  )
}
