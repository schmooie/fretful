import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as Tone from 'tone'
import { Chord, Note } from 'tonal'
import { useMetronome } from '../../contexts/MetronomeContext'
import FretboardView, { FretDot } from '../../components/FretboardView'
import {
  ROOTS,
  FRETBOARD_NOTES,
  intervalLabel,
  getTriadVoicings,
  TRIAD_QUALITIES,
  INVERSION_NAMES,
  TriadVoicing,
} from '../../lib/music'

// ── Helpers ──────────────────────────────────────────────────────────────────

function voicingToDots(voicing: TriadVoicing, root: string, quality: string): FretDot[] {
  const chord = Chord.get(root + quality)
  const chromaToInterval = new Map<number, string>()
  const chromaToNote = new Map<number, string>()
  chord.notes.forEach((n, i) => {
    const chroma = Note.chroma(n)
    if (chroma !== undefined) {
      chromaToInterval.set(chroma, chord.intervals[i])
      chromaToNote.set(chroma, Note.get(n).pc ?? n)
    }
  })

  const dots: FretDot[] = []
  for (let strIdx = 0; strIdx < 6; strIdx++) {
    const fret = voicing.strings[strIdx]
    if (fret === -1) continue
    const guitarString = 6 - strIdx   // fretboard.js: 1 = high e, 6 = low E
    const noteName = FRETBOARD_NOTES[strIdx][fret]?.replace(/\d/g, '')
    if (!noteName) continue
    const chroma = Note.chroma(noteName)
    if (chroma === undefined || !chromaToInterval.has(chroma)) continue
    dots.push({
      string: guitarString,
      fret,
      note: chromaToNote.get(chroma)!,
      interval: intervalLabel(chromaToInterval.get(chroma)!),
    })
  }
  return dots
}

const STRING_SET_LABELS = ['E A D', 'A D G', 'D G B', 'G B e']

// ── Component ─────────────────────────────────────────────────────────────────

export default function LearnTriads() {
  const { isPlaying, setIsPlaying, beatCallbackRef } = useMetronome()

  // ── Reference mode ───────────────────────────────────────────────────────
  const [root, setRoot] = useState('C')
  const [quality, setQuality] = useState('M')
  const [stringSetIdx, setStringSetIdx] = useState(0)
  const [inversionIdx, setInversionIdx] = useState<0 | 1 | 2>(0)
  const [labelMode, setLabelMode] = useState<'intervals' | 'notes'>('intervals')

  // ── Drill mode ───────────────────────────────────────────────────────────
  const [drillMode, setDrillMode] = useState(false)
  const [drillStarted, setDrillStarted] = useState(false)
  const [drillRoot, setDrillRoot] = useState('C')
  const [drillQuality, setDrillQuality] = useState('M')
  const [drillType, setDrillType] = useState<'horizontal' | 'vertical'>('horizontal')
  const [snake, setSnake] = useState(false)
  const [reverse, setReverse] = useState(false)
  const [drillItemIdx, setDrillItemIdx] = useState(-1)
  const [revealedItemIdx, setRevealedItemIdx] = useState(-1)

  const drillItemIdxRef = useRef(-1)
  const revealedItemIdxRef = useRef(-1)
  const drillItemsRef = useRef<TriadVoicing[]>([])
  const synthRef = useRef<Tone.Synth | null>(null)

  useEffect(() => { drillItemIdxRef.current = drillItemIdx }, [drillItemIdx])

  useEffect(() => {
    synthRef.current = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.6 },
    }).toDestination()
    return () => { synthRef.current?.dispose() }
  }, [])

  // ── Reference voicings ───────────────────────────────────────────────────
  const refVoicings = useMemo(() => getTriadVoicings(root, quality), [root, quality])
  const currentVoicing = useMemo(
    () => refVoicings.find(v => v.stringSetIdx === stringSetIdx && v.inversion === inversionIdx)
      ?? refVoicings[0],
    [refVoicings, stringSetIdx, inversionIdx],
  )

  // ── Drill items ──────────────────────────────────────────────────────────
  const drillItems = useMemo(() => {
    if (!drillMode) return []
    const voicings = getTriadVoicings(drillRoot, drillQuality)
    const mf = (v: TriadVoicing) => Math.min(...v.strings.filter(f => f !== -1))

    if (drillType === 'horizontal') {
      // One string set at a time, each sweeping high → low fret
      const groups = [0, 1, 2, 3].map(setIdx =>
        voicings.filter(v => v.stringSetIdx === setIdx).sort((a, b) => mf(b) - mf(a))
      )
      // Snake: reverse fret direction on odd-indexed string sets (low → high)
      if (snake) groups.forEach((g, i) => { if (i % 2 === 1) g.reverse() })
      const result = groups.flat()
      return reverse ? result.slice().reverse() : result
    } else {
      // Vertical: sort by neck position (high → low), jumping across string sets
      const sorted = [...voicings].sort((a, b) =>
        mf(a) !== mf(b) ? mf(b) - mf(a) : a.stringSetIdx - b.stringSetIdx
      )
      let result = sorted
      if (snake) {
        // Snake: reverse every other chunk of 4 (one full string-set pass)
        const snaked: TriadVoicing[] = []
        for (let i = 0; i < sorted.length; i += 4) {
          const chunk = sorted.slice(i, i + 4)
          if ((i / 4) % 2 === 1) chunk.reverse()
          snaked.push(...chunk)
        }
        result = snaked
      }
      return reverse ? result.slice().reverse() : result
    }
  }, [drillMode, drillRoot, drillQuality, drillType, snake, reverse])

  // Start at -1: first beat introduces challenge 0 (no dots yet),
  // second beat reveals challenge 0's dots + introduces challenge 1.
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
  const onBeat = useCallback((beat: number, time: number) => {
    if (beat !== 0) return
    const items = drillItemsRef.current
    if (!items.length) return

    const toReveal = drillItemIdxRef.current
    revealedItemIdxRef.current = toReveal
    const nextIdx = toReveal < 0 ? 0 : (toReveal + 1) % items.length
    drillItemIdxRef.current = nextIdx

    if (toReveal >= 0) {
      try {
        const item = items[toReveal]
        const lowestStrIdx = item.strings.findIndex(f => f !== -1)
        const rootFret = item.strings[lowestStrIdx]
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

  // ── Derived ──────────────────────────────────────────────────────────────
  const challengeDrillItem = drillMode && drillStarted && drillItemIdx >= 0
    ? drillItems[drillItemIdx] : null
  const revealedDrillItem = drillMode && drillStarted && revealedItemIdx >= 0
    ? drillItems[revealedItemIdx] : null

  const { dots, fretFrom, fretTo } = useMemo(() => {
    if (drillMode && drillStarted && !revealedDrillItem) {
      return { dots: [], fretFrom: 0, fretTo: 12 }
    }
    if (drillMode && drillStarted && revealedDrillItem) {
      return { dots: voicingToDots(revealedDrillItem, drillRoot, drillQuality), fretFrom: 0, fretTo: 12 }
    }
    if (!currentVoicing) return { dots: [], fretFrom: 0, fretTo: 12 }
    return { dots: voicingToDots(currentVoicing, root, quality), fretFrom: 0, fretTo: 12 }
  }, [drillMode, drillStarted, revealedDrillItem, drillRoot, drillQuality, currentVoicing, root, quality])

  const dotText = (d: FretDot) => labelMode === 'notes' ? (d.note ?? '') : (d.interval ?? '')

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center p-6 gap-6">

      <h1 className="text-4xl font-bold font-display tracking-tight text-fg-primary">Learn Triads</h1>

      {/* Drill action buttons */}
      <div className="flex items-center justify-end w-full max-w-[60rem]">
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
                onClick={() => setDrillStarted(false)}
                className="px-4 py-1.5 rounded text-sm font-display font-semibold bg-surface-2 text-fg-secondary hover:bg-surface-3 transition"
              >
                Settings
              </button>
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
                onClick={() => { setIsPlaying(false); setDrillStarted(false) }}
                className="px-4 py-1.5 rounded text-sm font-display font-semibold bg-surface-2 text-fg-secondary hover:bg-surface-3 transition"
              >
                Settings
              </button>
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
        <div className="flex flex-col gap-4 w-full max-w-[60rem]">

          <div>
            <div className="text-xs text-fg-muted uppercase tracking-widest mb-1.5">Root</div>
            <div className="flex flex-wrap gap-1.5">
              {ROOTS.map(r => (
                <button
                  key={r}
                  onClick={() => setRoot(r)}
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
              {TRIAD_QUALITIES.map(q => (
                <button
                  key={q.symbol}
                  onClick={() => setQuality(q.symbol)}
                  className={`px-3 py-1 rounded text-sm font-mono transition ${
                    quality === q.symbol ? 'bg-ui-primary text-white' : 'bg-surface-2 text-fg-secondary hover:bg-surface-3'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-fg-muted uppercase tracking-widest mb-1.5">String Set</div>
            <div className="flex rounded overflow-hidden border border-border-strong">
              {STRING_SET_LABELS.map((name, i) => (
                <button
                  key={i}
                  onClick={() => setStringSetIdx(i)}
                  className={`flex-1 px-3 py-1.5 text-sm font-mono transition ${
                    stringSetIdx === i ? 'bg-surface-3 text-fg-primary' : 'bg-surface-1 text-fg-muted hover:bg-surface-2'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-fg-muted uppercase tracking-widest mb-1.5">Inversion</div>
            <div className="flex rounded overflow-hidden border border-border-strong">
              {INVERSION_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => setInversionIdx(i as 0 | 1 | 2)}
                  className={`flex-1 px-3 py-1.5 text-sm font-display font-semibold transition ${
                    inversionIdx === i ? 'bg-surface-3 text-fg-primary' : 'bg-surface-1 text-fg-muted hover:bg-surface-2'
                  }`}
                >
                  {name}
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
                    drillRoot === r ? 'bg-ui-warning text-fg-inverse' : 'bg-surface-2 text-fg-secondary hover:bg-surface-3'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-fg-muted uppercase tracking-widest mb-1.5">Quality</div>
            <div className="flex flex-wrap gap-2">
              {TRIAD_QUALITIES.map(q => (
                <button
                  key={q.symbol}
                  onClick={() => setDrillQuality(q.symbol)}
                  className={`px-3 py-1.5 rounded text-sm font-mono transition ${
                    drillQuality === q.symbol ? 'bg-ui-warning text-fg-inverse' : 'bg-surface-2 text-fg-muted hover:bg-surface-3'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-fg-muted uppercase tracking-widest mb-1.5">Mode</div>
            <div className="flex rounded overflow-hidden border border-border-strong w-fit">
              {([
                { key: 'horizontal', label: 'Horizontal', desc: 'one string set at a time, high → low fret' },
                { key: 'vertical',   label: 'Vertical',   desc: 'jump across string sets at each position' },
              ] as const).map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => setDrillType(key)}
                  title={desc}
                  className={`px-4 py-1.5 text-sm font-display font-semibold transition ${
                    drillType === key ? 'bg-surface-3 text-fg-primary' : 'bg-surface-1 text-fg-muted hover:bg-surface-2'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSnake(s => !s)}
              className={`px-4 py-1.5 rounded text-sm font-display font-semibold transition ${
                snake ? 'bg-ui-primary text-white' : 'bg-surface-2 text-fg-muted hover:bg-surface-3'
              }`}
            >
              Snake
            </button>
            <button
              onClick={() => setReverse(r => !r)}
              className={`px-4 py-1.5 rounded text-sm font-display font-semibold transition ${
                reverse ? 'bg-ui-primary text-white' : 'bg-surface-2 text-fg-muted hover:bg-surface-3'
              }`}
            >
              Reverse
            </button>
          </div>

          <div className="text-fg-muted text-xs">
            {drillType === 'horizontal'
              ? snake
                ? 'EAD high→low, ADG low→high, DGB high→low, GBe low→high'
                : 'Sweeps each string set from high fret to low fret'
              : snake
                ? 'Zigzags across string sets at each neck position'
                : 'Jumps across string sets at the same neck position'}
          </div>

        </div>
      )}

      {/* ── Drill playing: current challenge ── */}
      {/* Always rendered when drillStarted so space is reserved before beat 1 */}
      {drillMode && drillStarted && (
        <div className="flex flex-col items-center gap-1">
          <div className={`text-4xl font-bold font-display text-center ${!challengeDrillItem ? 'invisible' : ''}`}>
            <span className="text-ui-warning">{drillRoot}</span>{' '}
            <span className="text-fg-primary">
              {TRIAD_QUALITIES.find(q => q.symbol === drillQuality)?.label}
            </span>
          </div>
          <div className={`text-fg-secondary text-base font-display font-semibold ${!challengeDrillItem ? 'invisible' : ''}`}>
            {challengeDrillItem?.inversionName ?? '—'}
          </div>
          <div className={`text-fg-muted text-sm font-mono ${!challengeDrillItem ? 'invisible' : ''}`}>
            {challengeDrillItem?.stringSetName ?? '—'}
          </div>
          <div className={`text-fg-muted text-xs font-mono mt-0.5 ${!challengeDrillItem ? 'invisible' : ''}`}>
            {drillItemIdx >= 0 ? `${drillItemIdx + 1} / ${drillItems.length}` : `— / ${drillItems.length}`}
          </div>
        </div>
      )}

      {/* ── Label toggle (reference mode only) ── */}
      {!drillMode && (
        <div className="flex justify-end w-full max-w-[60rem]">
          <div className="flex rounded overflow-hidden border border-border-strong">
            {(['intervals', 'notes'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setLabelMode(mode)}
                className={`px-4 py-1.5 text-sm font-display font-semibold transition ${
                  labelMode === mode ? 'bg-surface-3 text-fg-primary' : 'bg-surface-1 text-fg-muted hover:bg-surface-2'
                }`}
              >
                {mode === 'intervals' ? 'Intervals' : 'Notes'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Fretboard ── */}
      {(!drillMode || drillStarted) && (
        <div className="w-full max-w-[60rem] overflow-x-auto">
          <FretboardView
            dots={dots}
            fretFrom={fretFrom}
            fretTo={fretTo}
            dotText={dotText}
            colorBy="interval"
          />
        </div>
      )}

    </div>
  )
}
