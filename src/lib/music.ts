import { Scale, Chord, Note } from 'tonal'

export const GUITAR_STRINGS = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']

export const FRETBOARD_NOTES: string[][] = GUITAR_STRINGS.map(
  note => Scale.get(`${note} chromatic`).notes
)

export function getFretForNote(stringIdx: number, note: string): number {
  const notes = FRETBOARD_NOTES[stringIdx]
  // Strip octave from note for comparison
  const noteName = note.replace(/\d/g, '')
  return notes.findIndex(n => n.replace(/\d/g, '') === noteName)
}

export function getChromatic(stringIdx: number): string[] {
  return shuffle(FRETBOARD_NOTES[stringIdx].map(n => n.replace(/\d/g, '')))
}

export function stripOctave(note: string): string {
  return note.replace(/\d/g, '')
}

export function shuffle<T>(arr: T[]): T[] {
  const clone = arr.slice()
  let currentIndex = clone.length
  while (currentIndex !== 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--
    ;[clone[currentIndex], clone[randomIndex]] = [clone[randomIndex], clone[currentIndex]]
  }
  return clone
}

// ─── Chord helpers ──────────────────────────────────────────────────────────

export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export const CHORD_QUALITIES = [
  { label: 'Major',  symbol: 'M'    },
  { label: 'Minor',  symbol: 'm'    },
  { label: 'Dom 7',  symbol: '7'    },
  { label: 'Maj 7',  symbol: 'maj7' },
  { label: 'Min 7',  symbol: 'm7'   },
  { label: 'Dim',    symbol: 'dim'  },
  { label: 'Aug',    symbol: 'aug'  },
  { label: 'Sus2',   symbol: 'sus2' },
  { label: 'Sus4',   symbol: 'sus4' },
  { label: 'm7♭5',   symbol: 'm7b5' },
]

const INTERVAL_LABEL_MAP: Record<string, string> = {
  '1P': 'R',  '2m': '♭2', '2M': '2',  '3m': '♭3', '3M': '3',
  '4P': '4',  '4A': '♯4', '5d': '♭5', '5P': '5',  '5A': '♯5',
  '6m': '♭6', '6M': '6',  '7m': '♭7', '7M': '7',  '8P': 'R',
  '9m': '♭9', '9M': '9',  '11P': '11','13M': '13',
}

export function intervalLabel(interval: string): string {
  return INTERVAL_LABEL_MAP[interval] ?? interval
}


export type ShapeName = 'E' | 'A' | 'G' | 'C' | 'D'

export interface ChordVoicing {
  strings: number[]  // 6 elements, index 0 = low E; fret number or -1 (muted)
  fretFrom: number
  fretTo: number
  shapeName?: ShapeName
}

interface CagedTemplate {
  rootStrIdx: number
  offsets: (number | null)[]
}

const CAGED_TEMPLATES: Record<ShapeName, Record<string, CagedTemplate>> = {
  E: {
    M:    { rootStrIdx: 0, offsets: [0,    2,    2,    1,    0,    0   ] },
    m:    { rootStrIdx: 0, offsets: [0,    2,    2,    0,    0,    0   ] },
    '7':  { rootStrIdx: 0, offsets: [0,    2,    0,    1,    0,    0   ] },
    maj7: { rootStrIdx: 0, offsets: [0,    2,    1,    1,    0,    0   ] },
    m7:   { rootStrIdx: 0, offsets: [0,    2,    0,    0,    0,    0   ] },
  },
  A: {
    M:    { rootStrIdx: 1, offsets: [null, 0,    2,    2,    2,    0   ] },
    m:    { rootStrIdx: 1, offsets: [null, 0,    2,    2,    1,    0   ] },
    '7':  { rootStrIdx: 1, offsets: [null, 0,    2,    0,    2,    0   ] },
    maj7: { rootStrIdx: 1, offsets: [null, 0,    2,    1,    2,    0   ] },
    m7:   { rootStrIdx: 1, offsets: [null, 0,    2,    0,    1,    0   ] },
  },
  G: {
    M:    { rootStrIdx: 0, offsets: [0,   -1,   -3,   -3,   -3,    0  ] },
    m:    { rootStrIdx: 0, offsets: [0,   -2,   -3,   -3,    0,    0  ] },
    '7':  { rootStrIdx: 0, offsets: [0,   -1,   -3,   -3,   -3,   -2  ] },
    maj7: { rootStrIdx: 0, offsets: [0,   -1,   -3,   -3,   -3,   -1  ] },
    m7:   { rootStrIdx: 0, offsets: [0,   -2,   -3,   -3,    0,   -2  ] },
  },
  C: {
    M:    { rootStrIdx: 1, offsets: [null, 0,   -1,   -3,   -2,   -3  ] },
    m:    { rootStrIdx: 1, offsets: [null, 0,   -2,   -3,   -2,    0  ] },
    '7':  { rootStrIdx: 1, offsets: [null, 0,   -1,    0,   -2,   -3  ] },
    maj7: { rootStrIdx: 1, offsets: [null, 0,   -1,   -3,   -3,    0  ] },
    m7:   { rootStrIdx: 1, offsets: [null, 0,   -2,    0,   -2,    0  ] },
  },
  D: {
    M:    { rootStrIdx: 2, offsets: [null, null, 0,    2,    3,    2  ] },
    m:    { rootStrIdx: 2, offsets: [null, null, 0,    2,    3,    1  ] },
    '7':  { rootStrIdx: 2, offsets: [null, null, 0,    2,    1,    2  ] },
    maj7: { rootStrIdx: 2, offsets: [null, null, 0,    2,    2,    2  ] },
    m7:   { rootStrIdx: 2, offsets: [null, null, 0,    2,    1,    1  ] },
  },
}

export function getCagedVoicing(
  root: string,
  symbol: string,
  shapeName: ShapeName,
): ChordVoicing | null {
  const template = CAGED_TEMPLATES[shapeName]?.[symbol]
  if (!template) return null

  const rootFret = getFretForNote(template.rootStrIdx, root)
  if (rootFret === -1) return null

  const strings = template.offsets.map(offset =>
    offset === null ? -1 : rootFret + offset,
  )

  if (strings.some(f => f !== -1 && (f < 0 || f > 12))) return null

  const played = strings.filter(f => f !== -1)
  if (played.length < 3) return null
  const fretMin = Math.min(...played)
  const fretMax = Math.max(...played)
  return {
    strings,
    fretFrom: fretMin,
    fretTo: Math.max(fretMin + 5, fretMax + 1),
    shapeName,
  }
}

/** All neck positions (frets 0–12) where a chord tone appears. */
export function getChordNeckDots(
  root: string,
  symbol: string,
): Array<{ string: number; fret: number; note: string; interval: string }> {
  const chord = Chord.get(root + symbol)
  if (!chord.notes.length) return []

  const chromaToInterval = new Map<number, string>()
  const chromaToNote = new Map<number, string>()
  chord.notes.forEach((n, i) => {
    const chroma = Note.chroma(n)
    if (chroma !== undefined) {
      chromaToInterval.set(chroma, chord.intervals[i])
      chromaToNote.set(chroma, Note.get(n).pc ?? n)
    }
  })

  const dots: Array<{ string: number; fret: number; note: string; interval: string }> = []

  for (let strIdx = 0; strIdx < 6; strIdx++) {
    const fbString = 6 - strIdx  // fretboard.js: 1 = high E, 6 = low E
    for (let fret = 0; fret <= 12; fret++) {
      const noteName = FRETBOARD_NOTES[strIdx][fret]?.replace(/\d/g, '')
      if (!noteName) continue
      const chroma = Note.chroma(noteName)
      if (chroma === undefined || !chromaToInterval.has(chroma)) continue

      dots.push({
        string: fbString,
        fret,
        note: chromaToNote.get(chroma)!,
        interval: intervalLabel(chromaToInterval.get(chroma)!),
      })
    }
  }

  return dots
}

/** Up to 5 CAGED-based voicings (one per shape: E, A, G, C, D). */
export function getChordVoicings(root: string, symbol: string): ChordVoicing[] {
  return (['E', 'A', 'G', 'C', 'D'] as ShapeName[])
    .map(s => getCagedVoicing(root, symbol, s))
    .filter((v): v is ChordVoicing => v !== null)
}
