/**
 * Color system for Fretful.
 *
 * Two independent layers, composable on the same element:
 *   1. Chromatic note colors  — one hue per pitch class (12-TET, C-anchored)
 *   2. Interval function colors — high-contrast set for Root / Third / Fifth
 *
 * When both apply to the same fretboard dot the chromatic hue is the fill and
 * the interval function hue is rendered as a stroke ring, so neither clobbers
 * the other.
 *
 * All colors are designed for a dark background (~#0f0e0c).
 * Text contrast assignments are hardcoded — HSL lightness alone cannot
 * determine contrast reliably (perceptual non-uniformity).
 */

export interface ColorDef {
  h: number
  s: number   // 0-100
  l: number   // 0-100
  textColor: string  // hardcoded for correct contrast on dark bg
}

// ── Chromatic note colors ────────────────────────────────────────────────────
// Full hue-wheel sweep in ~30° steps; C anchors to Root color.
// Enharmonic pairs share the same def.

export const NOTE_COLOR_DEFS: Record<string, ColorDef> = {
  'C':  { h: 11,  s: 100, l: 59, textColor: 'white'   },
  'C#': { h: 22,  s: 100, l: 55, textColor: 'white'   },
  'Db': { h: 22,  s: 100, l: 55, textColor: 'white'   },
  'D':  { h: 35,  s: 100, l: 50, textColor: '#1a0800' },
  'D#': { h: 50,  s: 100, l: 57, textColor: '#1a1000' },
  'Eb': { h: 50,  s: 100, l: 57, textColor: '#1a1000' },
  'E':  { h: 76,  s: 79,  l: 56, textColor: '#151c00' },
  'F':  { h: 136, s: 55,  l: 55, textColor: '#001a0a' },
  'F#': { h: 170, s: 75,  l: 42, textColor: '#001a15' },
  'Gb': { h: 170, s: 75,  l: 42, textColor: '#001a15' },
  'G':  { h: 180, s: 60,  l: 53, textColor: '#001a1a' },
  'G#': { h: 203, s: 78,  l: 54, textColor: '#001424' },
  'Ab': { h: 203, s: 78,  l: 54, textColor: '#001424' },
  'A':  { h: 224, s: 100, l: 65, textColor: 'white'   },
  'A#': { h: 258, s: 89,  l: 66, textColor: 'white'   },
  'Bb': { h: 258, s: 89,  l: 66, textColor: 'white'   },
  'B':  { h: 325, s: 60,  l: 52, textColor: 'white'   },
}

// ── Interval function colors ─────────────────────────────────────────────────
// C intentionally shares Root; G intentionally shares Fifth.

export const INTERVAL_FUNCTION_DEFS: Record<'root' | 'third' | 'fifth', ColorDef> = {
  root:  { h: 11,  s: 100, l: 59, textColor: 'white'   },
  third: { h: 50,  s: 100, l: 57, textColor: '#1a1000' },
  fifth: { h: 180, s: 60,  l: 53, textColor: '#001a1a' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function toHsl({ h, s, l }: ColorDef): string {
  return `hsl(${h}, ${s}%, ${l}%)`
}

export function getNoteColorDef(note: string): ColorDef | null {
  return NOTE_COLOR_DEFS[note] ?? null
}

/** Maps interval display label (R, ♭3, 3, ♭5, 5 …) to its function bucket. */
export function intervalToFunction(label: string): 'root' | 'third' | 'fifth' | null {
  if (label === 'R')                        return 'root'
  if (label === '3' || label === '♭3')      return 'third'
  if (label === '5' || label === '♭5' || label === '♯5') return 'fifth'
  return null
}

/**
 * Returns a React inline-style object with per-component CSS custom properties
 * for the given note name, so components can use `var(--note-h)` etc.
 *
 * Usage:
 *   <div style={{ ...getNoteVars('C#'), backgroundColor: 'hsl(var(--note-h), var(--note-s), var(--note-l))' }}>
 */
export function getNoteVars(note: string): React.CSSProperties {
  const def = getNoteColorDef(note)
  if (!def) return {}
  return {
    '--note-h': String(def.h),
    '--note-s': `${def.s}%`,
    '--note-l': `${def.l}%`,
    '--note-text': def.textColor,
  } as React.CSSProperties
}

/**
 * CSS class name for a note's chromatic color utility class.
 * e.g. 'C#' → 'note-cs', 'Bb' → 'note-as'
 */
export function noteCssClass(note: string): string {
  const map: Record<string, string> = {
    'C': 'note-c', 'C#': 'note-cs', 'Db': 'note-cs',
    'D': 'note-d', 'D#': 'note-ds', 'Eb': 'note-ds',
    'E': 'note-e',
    'F': 'note-f', 'F#': 'note-fs', 'Gb': 'note-fs',
    'G': 'note-g', 'G#': 'note-gs', 'Ab': 'note-gs',
    'A': 'note-a', 'A#': 'note-as', 'Bb': 'note-as',
    'B': 'note-b',
  }
  return map[note] ?? 'note-c'
}

/**
 * CSS class name for an interval-function utility class.
 * e.g. 'R' → 'interval-root', '3' → 'interval-third'
 */
export function intervalCssClass(label: string): string | null {
  const fn = intervalToFunction(label)
  if (!fn) return null
  return `interval-${fn}`
}
