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


export interface ChordVoicing {
  strings: number[]  // 6 elements, index 0 = low E; fret number or -1 (muted)
  fretFrom: number
  fretTo: number
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

/** Up to 5 playable voicings across the neck scored by quality. */
export function getChordVoicings(root: string, symbol: string): ChordVoicing[] {
  const chord = Chord.get(root + symbol)
  if (!chord.notes.length) return []

  const chromaToInterval = new Map<number, string>()
  chord.notes.forEach((n, i) => {
    const chroma = Note.chroma(n)
    if (chroma !== undefined) chromaToInterval.set(chroma, chord.intervals[i])
  })
  const noteSet = new Set(chromaToInterval.keys())

  const results: { strings: number[]; score: number; fretFrom: number; fretTo: number }[] = []
  const seen = new Set<string>()

  for (let startFret = 0; startFret <= 8; startFret++) {
    // Candidate frets per string within this 5-fret window
    const candidates: number[][] = Array.from({ length: 6 }, (_, strIdx) => {
      const opts = [-1]  // -1 = muted
      for (let fret = startFret; fret <= startFret + 4; fret++) {
        const note = FRETBOARD_NOTES[strIdx][fret]?.replace(/\d/g, '')
        const chroma = note !== undefined ? Note.chroma(note) : undefined
        if (chroma !== undefined && noteSet.has(chroma)) opts.push(fret)
      }
      return opts
    })

    const dfs = (
      strIdx: number,
      current: number[],
      nonOpenFrets: number[],
      hasRoot: boolean,
    ): void => {
      if (results.length >= 25) return  // limit before dedup

      if (strIdx === 6) {
        const played = current.filter(f => f !== -1)
        if (played.length < 4 || !hasRoot) return

        // Span check (open strings excluded)
        if (nonOpenFrets.length >= 2) {
          const min = Math.min(...nonOpenFrets)
          const max = Math.max(...nonOpenFrets)
          if (max - min > 4) return
        }

        const key = current.join(',')
        if (seen.has(key)) return
        seen.add(key)

        // Coverage check
        const presentChromas = new Set(
          current.flatMap((fret, si) => {
            if (fret === -1) return []
            const note = FRETBOARD_NOTES[si][fret]?.replace(/\d/g, '')
            const chroma = note !== undefined ? Note.chroma(note) : undefined
            return chroma !== undefined ? [chroma] : []
          }),
        )
        const allPresent = [...noteSet].every(c => presentChromas.has(c))

        const lowestStr = current.findIndex(f => f !== -1)
        const lowestNote =
          lowestStr !== -1
            ? FRETBOARD_NOTES[lowestStr][current[lowestStr]]?.replace(/\d/g, '')
            : undefined
        const lowestChroma = lowestNote !== undefined ? Note.chroma(lowestNote) : undefined
        const rootOnLowest =
          lowestChroma !== undefined && chromaToInterval.get(lowestChroma) === '1P'

        let score = played.length
        if (allPresent) score += 10
        if (rootOnLowest) score += 5
        score -= current.filter(f => f === -1).length

        const fretMin = Math.min(...played)
        const fretMax = Math.max(...played)
        results.push({
          strings: current.slice(),
          score,
          fretFrom: fretMin,
          fretTo: Math.max(fretMin + 5, fretMax + 1),
        })
        return
      }

      for (const fret of candidates[strIdx]) {
        const newNonOpen = fret > 0 ? [...nonOpenFrets, fret] : nonOpenFrets

        // Early prune on span
        if (newNonOpen.length >= 2) {
          const min = Math.min(...newNonOpen)
          const max = Math.max(...newNonOpen)
          if (max - min > 4) continue
        }

        const note = fret !== -1 ? FRETBOARD_NOTES[strIdx][fret]?.replace(/\d/g, '') : undefined
        const chroma = note !== undefined ? Note.chroma(note) : undefined
        const isRoot = chroma !== undefined && chromaToInterval.get(chroma) === '1P'

        dfs(strIdx + 1, [...current, fret], newNonOpen, hasRoot || isRoot)
      }
    }

    dfs(0, [], [], false)
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, 5).map(r => ({
    strings: r.strings,
    fretFrom: r.fretFrom,
    fretTo: r.fretTo,
  }))
}
