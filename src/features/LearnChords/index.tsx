import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as Tone from 'tone'
import { Chord, Note } from 'tonal'
import { useMetronome } from '../../contexts/MetronomeContext'
import FretboardView, { FretDot } from '../../components/FretboardView'
import {
  ROOTS,
  CHORD_QUALITIES,
  FRETBOARD_NOTES,
  getChordNeckDots,
  getChordVoicings,
  getCagedVoicing,
  intervalLabel,
  ChordVoicing,
  ShapeName,
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

const CAGED_SHAPES: ShapeName[] = ['E', 'A', 'G', 'C', 'D']

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
  shapeName: ShapeName
  voicing: ChordVoicing
}

function buildDrillItems(root: string, enabledSymbols: string[]): DrillItem[] {
  const items: DrillItem[] = []
  for (const q of DRILL_QUALITIES.filter(q => enabledSymbols.includes(q.symbol))) {
    for (const shapeName of CAGED_SHAPES) {
      const voicing = getCagedVoicing(root, q.symbol, shapeName)
      if (!voicing) continue
      items.push({ qualitySymbol: q.symbol, qualityLabel: q.label, shapeName, voicing })
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
  const [drillStarted, setDrillStarted] = useState(false)
  const [drillRoot, setDrillRoot] = useState('A')
  const [drillEnabledSymbols, setDrillEnabledSymbols] = useState<string[]>(['M', 'm'])
  const [drillItemIdx, setDrillItemIdx] = useState(0)

  const [revealedItemIdx, setRevealedItemIdx] = useState(-1)

  const drillItemIdxRef = useRef(0)
  const revealedItemIdxRef = useRef(-1)
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

  // Keep ref in sync for beat callback; initialise when items change.
  // Start at -1 so the first beat introduces challenge 0 (no dots yet),
  // and the second beat reveals challenge 0's dots + introduces challenge 1.
  useEffect(() => {
    drillItemsRef.current = drillItems
    if (drillItems.length > 0) {
      setDrillItemIdx(-1)
      drillItemIdxRef.current = -1
      setRevealedItemIdx(-1)
      revealedItemIdxRef.current = -1
    }
  }, [drillItems])

  // ── Beat callback ────────────────────────────────────────────────────────
  // On each downbeat: reveal the previous challenge's dots, introduce the next.
  // drillItemIdx starts at -1, so:
  //   beat 1 → reveal=-1 (no dots), challenge=0 (first chord shown)
  //   beat 2 → reveal=0  (dots appear), challenge=1
  //   beat N → reveal=N-2, challenge=N-1
  const onBeat = useCallback((beat: number, time: number) => {
    if (beat !== 0) return
    const items = drillItemsRef.current
    if (!items.length) return

    const toReveal = drillItemIdxRef.current                          // -1 on first beat
    revealedItemIdxRef.current = toReveal
    const nextIdx = toReveal < 0 ? 0 : (toReveal + 1) % items.length // 0 on first beat
    drillItemIdxRef.current = nextIdx

    // Play root note only when actually revealing a chord (not the first beat)
    if (toReveal >= 0) {
      try {
        const item = items[toReveal]
        const lowestStrIdx = item.voicing.strings.findIndex(f => f !== -1)
        const rootFret = item.voicing.strings[lowestStrIdx]
        const rootNote = FRETBOARD_NOTES[lowestStrIdx][rootFret]?.replace(/\d/g, '') ?? 'C'
        synthRef.current?.triggerAttackRelease(`${rootNote}3`, '8n', time)
      } catch { /* ignore */ }
    }

    Tone.getDraw().schedule(() => {
      setRevealedItemIdx(toReveal)
      setDrillItemIdx(nextIdx)
    }, time)
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

  // Challenge = what to find (name shown, no dots); Revealed = previous answer (dots shown).
  // drillItemIdx starts at -1, so nothing is shown until the first beat fires.
  const challengeDrillItem = drillMode && drillStarted && drillItemIdx >= 0 ? drillItems[drillItemIdx] : null
  const revealedDrillItem = drillMode && drillStarted && revealedItemIdx >= 0
    ? drillItems[revealedItemIdx] : null

  const { dots, fretFrom, fretTo } = useMemo((): {
    dots: FretDot[]
    fretFrom: number
    fretTo: number
  } => {
    // Drill active but nothing revealed yet — show a blank neck
    if (drillMode && drillStarted && !revealedDrillItem) {
      return { dots: [], fretFrom: 0, fretTo: 12 }
    }

    // Drill active: show dots for the revealed item (previous challenge)
    if (drillMode && drillStarted && revealedDrillItem?.voicing) {
      return {
        dots: voicingToFretDots(
          revealedDrillItem.voicing,
          drillRoot,
          revealedDrillItem.qualitySymbol,
        ),
        fretFrom: revealedDrillItem.voicing.fretFrom,
        fretTo: revealedDrillItem.voicing.fretTo,
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
    drillMode, drillStarted, revealedDrillItem, drillRoot,
    displayMode, root, quality, refVoicings, clampedVoicingIdx,
  ])

  const dotText = (d: FretDot) => labelMode === 'notes' ? (d.note ?? '') : (d.interval ?? '')

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center p-6 gap-6">

      {/* Header */}
      <h1 className="text-4xl font-bold font-display tracking-tight text-fg-primary">Learn Chords</h1>
      <div className="flex items-center justify-between w-full max-w-[60rem]">

        {/* Spacer */}
        <div/>

        <div className="flex gap-2">
          {!drillMode && (
            <button
              onClick={() => setDrillMode(true)}
              className="px-4 py-1.5 rounded text-sm font-display font-semibold bg-surface-3 text-fg-secondary hover:bg-surface-3 transition"
            >
              Drill ▶
            </button>
          )}
          {drillMode && !drillStarted && (
            <>
              <button
                onClick={() => setDrillMode(false)}
                className="px-4 py-1.5 rounded text-sm font-display font-semibold bg-surface-3 text-fg-secondary hover:bg-surface-3 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { setIsPlaying(true); setDrillStarted(true) }}
                className="px-4 py-1.5 rounded text-sm font-display font-semibold bg-ui-success text-white hover:bg-ui-success-hover transition"
              >
                Start ▶
              </button>
            </>
          )}
          {drillMode && drillStarted && !isPlaying && (
            <>
              <button
                onClick={() => { setDrillMode(false); setDrillStarted(false) }}
                className="px-4 py-1.5 rounded text-sm font-display font-semibold bg-ui-destructive text-white hover:bg-ui-destructive-hover transition"
              >
                End Drill
              </button>
              <button
                onClick={() => setIsPlaying(true)}
                className="px-4 py-1.5 rounded text-sm font-display font-semibold bg-ui-success text-white hover:bg-ui-success-hover transition"
              >
                Resume ▶
              </button>
            </>
          )}
          {drillMode && drillStarted && isPlaying && (
            <>
              <button
                onClick={() => { setIsPlaying(false); setDrillMode(false); setDrillStarted(false) }}
                className="px-4 py-1.5 rounded text-sm font-display font-semibold bg-ui-destructive text-white hover:bg-ui-destructive-hover transition"
              >
                End Drill
              </button>
              <button
                onClick={() => setIsPlaying(false)}
                className="px-4 py-1.5 rounded text-sm font-display font-semibold bg-surface-3 text-fg-secondary hover:bg-surface-3 transition"
              >
                Pause ⏸
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Reference mode controls ── */}
      {!drillMode && (
        <div className="flex flex-col gap-3 w-full max-w-[60rem]">
          <div>
            <div className="text-xs text-fg-muted uppercase tracking-widest mb-1.5">Root Note</div>
            <div className="flex flex-wrap gap-1.5">
              {ROOTS.map(r => (
                <button
                  key={r}
                  onClick={() => { setRoot(r); setVoicingIdx(0) }}
                  className={`px-3 py-1 rounded text-sm font-mono transition ${
                    root === r ? 'bg-ui-primary text-white' : 'bg-surface-2 text-fg-secondary hover:bg-surface-3'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-fg-muted uppercase tracking-widest mb-1.5">Quality</div>
            <div className="flex flex-wrap gap-1.5">
              {CHORD_QUALITIES.map(q => (
                <button
                  key={q.symbol}
                  onClick={() => { setQuality(q.symbol); setVoicingIdx(0) }}
                  className={`px-3 py-1 rounded text-sm font-mono transition ${
                    quality === q.symbol ? 'bg-ui-primary text-white' : 'bg-surface-2 text-fg-secondary hover:bg-surface-3'
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
      {drillMode && !drillStarted && (
        <div className="flex flex-col gap-5 w-full max-w-[60rem]">
          <div>
            <div className="text-xs text-fg-muted uppercase tracking-widest mb-1.5">Root Note</div>
            <div className="flex flex-wrap gap-1.5">
              {ROOTS.map(r => (
                <button
                  key={r}
                  onClick={() => setDrillRoot(r)}
                  className={`px-3 py-1 rounded text-sm font-mono transition ${
                    drillRoot === r
                      ? 'bg-ui-warning text-fg-inverse'
                      : 'bg-surface-2 text-fg-secondary hover:bg-surface-3'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-fg-muted uppercase tracking-widest mb-1.5">Chord Types</div>
            <div className="flex flex-wrap gap-2">
              {DRILL_QUALITIES.map(q => {
                const active = drillEnabledSymbols.includes(q.symbol)
                return (
                  <button
                    key={q.symbol}
                    onClick={() => toggleDrillQuality(q.symbol)}
                    className={`px-3 py-1.5 rounded text-sm font-mono transition ${
                      active
                        ? 'bg-ui-warning text-fg-inverse'
                        : 'bg-surface-2 text-fg-muted hover:bg-surface-3'
                    }`}
                  >
                    {q.label}
                  </button>
                )
              })}
            </div>
            <div className="text-fg-muted text-xs mt-2">
              {drillItems.length} positions in this drill
              {drillItems.length > 0 && (
                <> ({drillEnabledSymbols.length} quality × {CAGED_SHAPES.length} shapes)</>

              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Drill playing: current chord ── */}
      {/* Always rendered when drillStarted so space is reserved before beat 1 fires */}
      {drillMode && drillStarted && (
        <div className="flex flex-col items-center gap-1.5">
          <div className={`text-4xl font-bold font-display text-center ${!challengeDrillItem ? 'invisible' : ''}`}>
            <span className="text-ui-warning">{drillRoot}</span>{' '}
            <span className="text-fg-primary">{challengeDrillItem?.qualityLabel ?? '—'}</span>
          </div>
          <div className={`text-fg-secondary text-sm ${!challengeDrillItem ? 'invisible' : ''}`}>
            {challengeDrillItem?.shapeName} shape
          </div>
          <div className={`text-fg-muted text-xs font-mono ${!challengeDrillItem ? 'invisible' : ''}`}>
            {drillItemIdx >= 0 ? `${drillItemIdx + 1} / ${drillItems.length}` : `— / ${drillItems.length}`}
          </div>
        </div>
      )}

      {/* ── Display / Label toggles (reference mode only) ── */}
      {!drillMode && (
        <div className="flex items-center justify-between w-full max-w-[60rem]">
          <div className="flex rounded overflow-hidden border border-border-strong">
            {(['neck', 'voicings'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setDisplayMode(mode)}
                className={`px-4 py-1.5 text-sm font-display font-semibold transition ${
                  displayMode === mode
                    ? 'bg-surface-3 text-fg-primary'
                    : 'bg-surface-1 text-fg-muted hover:bg-surface-2'
                }`}
              >
                {mode === 'neck' ? 'Full Neck' : 'Voicings'}
              </button>
            ))}
          </div>

          <div className="flex rounded overflow-hidden border border-border-strong">
            {(['intervals', 'notes'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setLabelMode(mode)}
                className={`px-4 py-1.5 text-sm font-display font-semibold transition ${
                  labelMode === mode
                    ? 'bg-surface-3 text-fg-primary'
                    : 'bg-surface-1 text-fg-muted hover:bg-surface-2'
                }`}
              >
                {mode === 'intervals' ? 'Intervals' : 'Notes'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Fretboard (hidden during drill config) ── */}
      {(!drillMode || drillStarted) && (
        <div className="w-full max-w-[60rem] overflow-x-auto">
          <FretboardView dots={dots} fretFrom={fretFrom} fretTo={fretTo} dotText={dotText} colorBy="interval" />
        </div>
      )}

      {/* ── Voicing nav (reference voicings mode only) ── */}
      {!drillMode && displayMode === 'voicings' && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => setVoicingIdx(i => Math.max(0, i - 1))}
            disabled={clampedVoicingIdx === 0}
            className="px-3 py-1 rounded bg-surface-2 text-fg-secondary hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed font-display font-semibold transition"
          >
            ←
          </button>
          <span className="text-fg-secondary text-sm font-mono">
            {refVoicings.length > 0
              ? `${clampedVoicingIdx + 1} / ${refVoicings.length}`
              : 'No voicings'}
          </span>
          <button
            onClick={() => setVoicingIdx(i => Math.min(refVoicings.length - 1, i + 1))}
            disabled={clampedVoicingIdx >= refVoicings.length - 1}
            className="px-3 py-1 rounded bg-surface-2 text-fg-secondary hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed font-display font-semibold transition"
          >
            →
          </button>
        </div>
      )}

    </div>
  )
}
