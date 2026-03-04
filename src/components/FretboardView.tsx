import { useRef, useEffect } from 'react'
import { Fretboard, GUITAR_TUNINGS } from '@moonwave99/fretboard.js'
import {
  NOTE_COLOR_DEFS,
  INTERVAL_FUNCTION_DEFS,
  toHsl,
  intervalToFunction,
} from '../lib/colors'

export interface FretDot {
  string: number
  fret: number
  note?: string
  interval?: string
}

interface FretboardViewProps {
  dots: FretDot[]
  fretFrom?: number
  fretTo?: number
  dotText?: (dot: FretDot) => string
}

const SINGLE_MARKER_FRETS = [3, 5, 7, 9, 15, 17, 19, 21]
const DOUBLE_MARKER_FRETS = [12, 24]

function addFretMarkers(fb: Fretboard, fretFrom: number, fretTo: number) {
  const fretCount = fretTo - fretFrom
  const { frets, positions, wrapper } = fb
  const wrapperEl = (wrapper as unknown as { node: () => SVGGElement }).node()
  if (!wrapperEl || !positions.length || !frets.length) return

  // y midpoint of the neck: average of string 3 and 4 y positions (0-indexed: 2 and 3)
  const y3 = positions[2][0].y
  const y4 = positions[3][0].y
  const centerY = (y3 + y4) / 2
  const doubleOffset = (y4 - y3) / 2.5

  const allMarkers = [
    ...SINGLE_MARKER_FRETS.map(f => ({ fret: f, double: false })),
    ...DOUBLE_MARKER_FRETS.map(f => ({ fret: f, double: true })),
  ]

  for (const { fret: markerFret, double: isDouble } of allMarkers) {
    const localFret = markerFret - fretFrom
    if (localFret < 1 || localFret > fretCount) continue

    const x = frets[localFret] - (frets[localFret] - frets[localFret - 1]) / 2

    const ys = isDouble ? [centerY - doubleOffset, centerY + doubleOffset] : [centerY]
    for (const y of ys) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', `${x}%`)
      circle.setAttribute('cy', String(y))
      circle.setAttribute('r', '5')
      circle.setAttribute('fill', '#3f3f46') // zinc-700
      circle.setAttribute('class', 'fret-marker')
      wrapperEl.insertBefore(circle, wrapperEl.firstChild)
    }
  }
}

export default function FretboardView({ dots, fretFrom = 0, fretTo = 12, dotText }: FretboardViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fretboardRef = useRef<Fretboard | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    containerRef.current.innerHTML = ''
    const el = document.createElement('div')
    containerRef.current.appendChild(el)

    fretboardRef.current = new Fretboard({
      el,
      fretCount: fretTo - fretFrom,
      tuning: GUITAR_TUNINGS.default,
      dotSize: 25,
      fretWidth: 2,
      stringWidth: [1, 1, 2, 2, 3, 3],
      showFretNumbers: true,
    })
    fretboardRef.current.render()
    addFretMarkers(fretboardRef.current, fretFrom, fretTo)

    return () => {
      fretboardRef.current = null
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [fretFrom, fretTo])

  useEffect(() => {
    if (!fretboardRef.current) return
    const positions = dots.map(d => {
      const pos: Record<string, string | number | boolean> = {
        string: d.string,
        fret: d.fret,
      }
      if (d.note !== undefined) pos.note = d.note
      if (d.interval !== undefined) pos.interval = d.interval
      return pos
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fb = fretboardRef.current as any
    fb.setDots(positions as Parameters<Fretboard['setDots']>[0]).render()

    // fretboard.js bakes fret numbers on the first render (baseRendered guard).
    // Patch them to show absolute fret numbers when viewing a sub-range.
    if (fretFrom > 0) {
      containerRef.current
        ?.querySelectorAll('.fret-numbers text')
        .forEach((el, i) => { el.textContent = String(i + 1 + fretFrom) })
    }

    const hasNote     = dots.some(d => d.note     !== undefined)
    const hasInterval = dots.some(d => d.interval !== undefined)

    // Clear default fretboard.js dot stroke on all dots
    fb.style({ stroke: 'none' })

    if (hasNote) {
      // Layer 1: chromatic fill + matched text color, one call per pitch class
      for (const [noteName, def] of Object.entries(NOTE_COLOR_DEFS)) {
        const fill = toHsl(def)
        if (dotText) {
          fb.style({
            filter: (d: { note?: string }) => d.note === noteName,
            fill,
            text: dotText,
            fontFill: def.textColor,
          })
        } else {
          fb.style({ filter: (d: { note?: string }) => d.note === noteName, fill })
        }
      }
    } else if (hasInterval && !hasNote) {
      // Interval-function fill only (no chromatic note data on these dots)
      for (const [fn, def] of Object.entries(INTERVAL_FUNCTION_DEFS) as [string, typeof INTERVAL_FUNCTION_DEFS[keyof typeof INTERVAL_FUNCTION_DEFS]][]) {
        const fnKey = fn as 'root' | 'third' | 'fifth'
        const fill = toHsl(def)
        const styleOpts: Record<string, unknown> = {
          filter: (d: { interval?: string }) => intervalToFunction(d.interval ?? '') === fnKey,
          fill,
        }
        if (dotText) { styleOpts.text = dotText; styleOpts.fontFill = def.textColor }
        fb.style(styleOpts)
      }
      // Dots that don't map to root/third/fifth: apply dotText with default color
      if (dotText) {
        fb.style({
          filter: (d: { interval?: string }) => intervalToFunction(d.interval ?? '') === null,
          text: dotText,
        })
      }
    } else if (dotText) {
      fb.style({ text: dotText })
    }

  }, [dots, dotText, fretFrom])

  return <div ref={containerRef} className="fretboard-container" />
}
