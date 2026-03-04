import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as Tone from 'tone'
import { Chord, Note } from 'tonal'
import { useMetronome } from '../../contexts/MetronomeContext'
import FretboardView, { FretDot } from '../../components/FretboardView'
import {
  ROOTS,
  CHORD_QUALITIES,
  FRETBOARD_NOTES,
  getFretForNote,
  getChordNeckDots,
  getChordVoicings,
  intervalLabel,
  ChordVoicing,
} from '../../lib/music'

// ── Constants ────────────────────────────────────────────────────────────────

// Qualities available in drill mode
const DRILL_QUALITIES = [
  { label: 'Major',  symbol: 'M'    },
  { label: 'Minor',  symbol: 'm'    },
  { label: 'Dom 7',  symbol: '7'    },
  { label: 'Maj 7',  symbol: 'maj7' },
  { label: 'Min 7',  symbol: 'm7'   },
]

// Strings used as root positions (indices into FRETBOARD_NOTES / ChordVoicing.strings)
const DRILL_ROOT_STRINGS = [0, 1, 2, 3]  // low E, A, D, G
const ROOT_STRING_LABELS = ['6th (low E)', '5th (A)', '4th (D)', '3rd (G)']

// ── Helpers ──────────────────────────────────────────────────────────────────

function voicingToFretDots(voicing: ChordVoicing, root: string, symbol: string): FretDot[] {
  const chord = Chord.get(root + symbol)
  const chromaToInterval = new Map<number, string>()
  const chromaToNote = new Map<number, string>()
  chord.notes.forEach((n, i) => {
    const chroma = Note.chroma(n)
    if (chroma !== undefined) {
      chromaToInterval.set(chroma, chord.intervals[i])
      chromaToNote.set(chroma, Note.get(n).pc ?? n)
    }
  })

  return voicing.strings
    .map((fret, strIdx): FretDot | null => {
      if (fret === -1) return null
      const fbString = 6 - strIdx
      const noteName = FRETBOARD_NOTES[strIdx][fret]?.replace(/\d/g, '')
      if (!noteName) return null
      const chroma = Note.chroma(noteName)
      if (chroma === undefined || !chromaToInterval.has(chroma)) return null
      return {
        string: fbString,
        fret,
        note: chromaToNote.get(chroma)!,
        interval: intervalLabel(chromaToInterval.get(chroma)!),
      }
    })
    .filter((d): d is FretDot => d !== null)
}

interface DrillItem {
  qualitySymbol: string
  qualityLabel: string
  strIdx: number    // 0=low E … 3=G
  rootFret: number
  voicing: ChordVoicing | null
}

function buildDrillItems(root: string, enabledSymbols: string[]): DrillItem[] {
  const items: DrillItem[] = []
  for (const q of DRILL_QUALITIES.filter(q => enabledSymbols.includes(q.symbol))) {
    const voicings = getChordVoicings(root, q.symbol)
    for (const strIdx of DRILL_ROOT_STRINGS) {
      const rootFret = getFretForNote(strIdx, root)
      if (rootFret === -1) continue
      const voicing =
        voicings.find(v => v.strings[strIdx] === rootFret) ?? voicings[0] ?? null
      items.push({ qualitySymbol: q.symbol, qualityLabel: q.label, strIdx, rootFret, voicing })
    }
  }
  return items
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LearnChords() {
  const { isPlaying, setIsPlaying, beatCallbackRef } = useMetronome()

  // ── Reference mode ───────────────────────────────────────────────────────
  const [root, setRoot] = useState('C')
  const [quality, setQuality] = useState('M')
  const [displayMode, setDisplayMode] = useState<'neck' | 'voicings'>('neck')
  const [labelMode, setLabelMode] = useState<'intervals' | 'notes'>('intervals')
  const [voicingIdx, setVoicingIdx] = useState(0)

  // ── Drill mode ───────────────────────────────────────────────────────────
  const [drillMode, setDrillMode] = useState(false)
  const [drillRoot, setDrillRoot] = useState('A')
  const [drillEnabledSymbols, setDrillEnabledSymbols] = useState<string[]>(['M', 'm'])
  const [drillItemIdx, setDrillItemIdx] = useState(0)

  const drillItemIdxRef = useRef(0)
  const drillItemsRef = useRef<DrillItem[]>([])
  const synthRef = useRef<Tone.Synth | null>(null)

  useEffect(() => { drillItemIdxRef.current = drillItemIdx }, [drillItemIdx])

  useEffect(() => {
    synthRef.current = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.6 },
    }).toDestination()
    return () => { synthRef.current?.dispose() }
  }, [])

  // ── Drill items ──────────────────────────────────────────────────────────
  const drillItems = useMemo(
    () => (drillMode ? buildDrillItems(drillRoot, drillEnabledSymbols) : []),
    [drillMode, drillRoot, drillEnabledSymbols],
  )

  // Keep ref in sync for beat callback; initialise idx when items change
  useEffect(() => {
    drillItemsRef.current = drillItems
    if (drillItems.length > 0) {
      // Start at last index so first beat advances cleanly to 0
      const initIdx = drillItems.length - 1
      setDrillItemIdx(initIdx)
      drillItemIdxRef.current = initIdx
    }
  }, [drillItems])

  // ── Beat callback ────────────────────────────────────────────────────────
  const onBeat = useCallback((beat: number, time: number) => {
    if (beat !== 0) return
    const items = drillItemsRef.current
    if (!items.length) return

    const nextIdx = (drillItemIdxRef.current + 1) % items.length
    drillItemIdxRef.current = nextIdx

    // Play the root note at the exact transport time
    try {
      const item = items[nextIdx]
      const rootNote = FRETBOARD_NOTES[item.strIdx][item.rootFret]?.replace(/\d/g, '') ?? 'C'
      synthRef.current?.triggerAttackRelease(`${rootNote}3`, '8n', time)
    } catch { /* ignore */ }

    Tone.getDraw().schedule(() => { setDrillItemIdx(nextIdx) }, time)
  }, [])

  useEffect(() => {
    if (!drillMode) { beatCallbackRef.current = null; return }
    beatCallbackRef.current = onBeat
    return () => { beatCallbackRef.current = null }
  }, [drillMode, onBeat, beatCallbackRef])

  const toggleDrillQuality = (symbol: string) => {
    setDrillEnabledSymbols(prev => {
      if (prev.includes(symbol)) {
        if (prev.length === 1) return prev  // keep at least one
        return prev.filter(s => s !== symbol)
      }
      return [...prev, symbol]
    })
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const refVoicings = useMemo(
    () => getChordVoicings(root, quality),
    [root, quality],
  )
  const clampedVoicingIdx = Math.min(voicingIdx, Math.max(0, refVoicings.length - 1))

  const currentDrillItem = drillMode ? drillItems[drillItemIdx] : null

  const { dots, fretFrom, fretTo } = useMemo((): {
    dots: FretDot[]
    fretFrom: number
    fretTo: number
  } => {
    // Drill playing: show current voicing
    if (drillMode && isPlaying && currentDrillItem?.voicing) {
      return {
        dots: voicingToFretDots(
          currentDrillItem.voicing,
          drillRoot,
          currentDrillItem.qualitySymbol,
        ),
        fretFrom: currentDrillItem.voicing.fretFrom,
        fretTo: currentDrillItem.voicing.fretTo,
      }
    }

    // Reference neck view
    if (displayMode === 'neck') {
      return {
        dots: getChordNeckDots(root, quality) as FretDot[],
        fretFrom: 0,
        fretTo: 12,
      }
    }

    // Reference voicings view
    if (!refVoicings.length) return { dots: [], fretFrom: 0, fretTo: 5 }
    return {
      dots: voicingToFretDots(refVoicings[clampedVoicingIdx], root, quality),
      fretFrom: refVoicings[clampedVoicingIdx].fretFrom,
      fretTo: refVoicings[clampedVoicingIdx].fretTo,
    }
  }, [
    drillMode, isPlaying, currentDrillItem, drillRoot,
    displayMode, root, quality, refVoicings, clampedVoicingIdx,
  ])

  const dotText = (d: FretDot) => labelMode === 'notes' ? (d.note ?? '') : (d.interval ?? '')

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center p-6 gap-6">

      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-3xl">
        <h1 className="text-2xl font-bold text-zinc-200">Learn Chords</h1>
        <div className="flex gap-2">
          {!drillMode && (
            <button
              onClick={() => setDrillMode(true)}
              className="px-4 py-1.5 rounded text-sm font-medium bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition"
            >
              Drill ▶
            </button>
          )}
          {drillMode && !isPlaying && (
            <>
              <button
                onClick={() => setIsPlaying(true)}
                className="px-4 py-1.5 rounded text-sm font-medium bg-green-700 text-white hover:bg-green-600 transition"
              >
                Start ▶
              </button>
              <button
                onClick={() => setDrillMode(false)}
                className="px-4 py-1.5 rounded text-sm font-medium bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition"
              >
                Cancel
              </button>
            </>
          )}
          {drillMode && isPlaying && (
            <button
              onClick={() => { setIsPlaying(false); setDrillMode(false) }}
              className="px-4 py-1.5 rounded text-sm font-medium bg-red-800 text-white hover:bg-red-700 transition"
            >
              End Drill
            </button>
          )}
        </div>
      </div>

      {/* ── Reference mode controls ── */}
      {!drillMode && (
        <div className="flex flex-col gap-3 w-full max-w-3xl">
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1.5">Root</div>
            <div className="flex flex-wrap gap-1.5">
              {ROOTS.map(r => (
                <button
                  key={r}
                  onClick={() => { setRoot(r); setVoicingIdx(0) }}
                  className={`px-3 py-1 rounded text-sm font-mono transition ${
                    root === r ? 'bg-sky-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1.5">Quality</div>
            <div className="flex flex-wrap gap-1.5">
              {CHORD_QUALITIES.map(q => (
                <button
                  key={q.symbol}
                  onClick={() => { setQuality(q.symbol); setVoicingIdx(0) }}
                  className={`px-3 py-1 rounded text-sm transition ${
                    quality === q.symbol ? 'bg-sky-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Drill config (before starting) ── */}
      {drillMode && !isPlaying && (
        <div className="flex flex-col gap-5 w-full max-w-3xl">
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1.5">Root Note</div>
            <div className="flex flex-wrap gap-1.5">
              {ROOTS.map(r => (
                <button
                  key={r}
                  onClick={() => setDrillRoot(r)}
                  className={`px-3 py-1 rounded text-sm font-mono transition ${
                    drillRoot === r
                      ? 'bg-amber-500 text-zinc-900'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1.5">Chord Types</div>
            <div className="flex flex-wrap gap-2">
              {DRILL_QUALITIES.map(q => {
                const active = drillEnabledSymbols.includes(q.symbol)
                return (
                  <button
                    key={q.symbol}
                    onClick={() => toggleDrillQuality(q.symbol)}
                    className={`px-3 py-1.5 rounded text-sm transition ${
                      active
                        ? 'bg-amber-500 text-zinc-900'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {q.label}
                  </button>
                )
              })}
            </div>
            <div className="text-zinc-600 text-xs mt-2">
              {drillItems.length} positions in this drill
              {drillItems.length > 0 && (
                <> ({drillEnabledSymbols.length} quality × {DRILL_ROOT_STRINGS.length} strings)</>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Drill playing: current chord ── */}
      {drillMode && isPlaying && currentDrillItem && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-5xl font-bold font-mono text-center">
            <span className="text-amber-400">{drillRoot}</span>{' '}
            <span className="text-zinc-200">{currentDrillItem.qualityLabel}</span>
          </div>
          <div className="text-zinc-400 text-sm">
            root on {ROOT_STRING_LABELS[currentDrillItem.strIdx]}, fret {currentDrillItem.rootFret}
          </div>
          <div className="text-zinc-600 text-xs font-mono">
            {drillItemIdx + 1} / {drillItems.length}
          </div>
        </div>
      )}

      {/* ── Display / Label toggles (reference mode only) ── */}
      {!drillMode && (
        <div className="flex items-center justify-between w-full max-w-3xl">
          <div className="flex rounded overflow-hidden border border-zinc-700">
            {(['neck', 'voicings'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setDisplayMode(mode)}
                className={`px-4 py-1.5 text-sm transition ${
                  displayMode === mode
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {mode === 'neck' ? 'Full Neck' : 'Voicings'}
              </button>
            ))}
          </div>

          <div className="flex rounded overflow-hidden border border-zinc-700">
            {(['intervals', 'notes'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setLabelMode(mode)}
                className={`px-4 py-1.5 text-sm transition ${
                  labelMode === mode
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {mode === 'intervals' ? 'Intervals' : 'Notes'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Fretboard (hidden during drill config) ── */}
      {(!drillMode || isPlaying) && (
        <div className="w-full max-w-3xl overflow-x-auto">
          <FretboardView dots={dots} fretFrom={fretFrom} fretTo={fretTo} dotText={dotText} />
        </div>
      )}

      {/* ── Voicing nav (reference voicings mode only) ── */}
      {!drillMode && displayMode === 'voicings' && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => setVoicingIdx(i => Math.max(0, i - 1))}
            disabled={clampedVoicingIdx === 0}
            className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ←
          </button>
          <span className="text-zinc-400 text-sm font-mono">
            {refVoicings.length > 0
              ? `${clampedVoicingIdx + 1} / ${refVoicings.length}`
              : 'No voicings'}
          </span>
          <button
            onClick={() => setVoicingIdx(i => Math.min(refVoicings.length - 1, i + 1))}
            disabled={clampedVoicingIdx >= refVoicings.length - 1}
            className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            →
          </button>
        </div>
      )}

    </div>
  )
}
