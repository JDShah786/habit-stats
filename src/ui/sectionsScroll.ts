// Turning the sections' native horizontal scroll into "where are we" (see Sections.tsx).

const LAST = 3 // My habits; Today is 0

// How far a resting scroll may be from a page edge: phones report fractional positions.
const SETTLE_TOLERANCE = 1

// Fractional section position, for the strip cursor and background word while moving.
// Clamped, so the iPhone's bounce past either end doesn't drag them off the strip.
export function scrollPosition(scrollLeft: number, width: number, last = LAST): number {
  if (!width) return 0
  return Math.min(last, Math.max(0, scrollLeft / width))
}

// The section the scroll has come to rest on, or null while it's still moving or bouncing.
export function settledSection(scrollLeft: number, width: number, last = LAST): number | null {
  if (!width) return null
  const i = Math.round(scrollLeft / width)
  if (i < 0 || i > last) return null
  return Math.abs(scrollLeft - i * width) <= SETTLE_TOLERANCE ? i : null
}
