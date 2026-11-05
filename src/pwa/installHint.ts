// When to show the "add to Home Screen" hint. iPhone Safari never offers to install a web
// app, so the app explains it, once, until installed or dismissed. Pure functions.

// An iPhone or iPad. An iPad asking for the desktop site says "Macintosh", but has touch.
export const isIOS = (userAgent: string, maxTouchPoints: number) =>
  /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)

// Running as the installed Home Screen app. Older iOS only sets navigator.standalone.
export const isStandalone = (w: { matchMedia: (query: string) => { matches: boolean }; navigator: { standalone?: boolean } }) =>
  w.matchMedia('(display-mode: standalone)').matches || w.navigator.standalone === true

export const shouldShowInstallHint = ({ ios, standalone, dismissed }: { ios: boolean; standalone: boolean; dismissed: boolean }) =>
  ios && !standalone && !dismissed
