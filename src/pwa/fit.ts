// Making the installed iPhone app fill the whole screen.
//
// With the see-through ("black-translucent") status bar, iOS draws the app from the very top of the
// screen but reports a window that is shorter by about the status bar's height. Everything pinned
// to the bottom of the window then stops early, leaving a blank band. We measure that shortfall
// and hand it to CSS as --fit-gap; full-screen layers stretch down by it (see app.css).

interface Sizes {
  standalone: boolean
  innerWidth: number
  innerHeight: number
  screenWidth: number
  screenHeight: number
}

// No status bar is taller than this; a bigger shortfall means something else (not this bug).
const MAX_STATUS_BAR = 80

export function fitGap({ standalone, innerWidth, innerHeight, screenWidth, screenHeight }: Sizes): number {
  if (!standalone) return 0
  // Narrower than the screen: iPad split view or landscape, where screen sizes don't apply.
  if (innerWidth !== screenWidth) return 0
  const gap = screenHeight - innerHeight
  return gap > 0 && gap <= MAX_STATUS_BAR ? gap : 0
}

interface FitWindow {
  navigator: object
  innerWidth: number
  innerHeight: number
  screen: { width: number; height: number }
  addEventListener: (type: 'resize', listener: () => void) => void
}

export function fitToScreen(win: FitWindow, root: HTMLElement) {
  const apply = () => {
    const gap = fitGap({
      // navigator.standalone exists only on iPhone and iPad, and is true in a Home Screen app.
      standalone: (win.navigator as { standalone?: boolean }).standalone === true,
      innerWidth: win.innerWidth,
      innerHeight: win.innerHeight,
      screenWidth: win.screen.width,
      screenHeight: win.screen.height,
    })
    if (gap) root.style.setProperty('--fit-gap', `${gap}px`)
    else root.style.removeProperty('--fit-gap')
  }
  apply()
  win.addEventListener('resize', apply)
}
