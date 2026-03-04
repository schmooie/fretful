import { useState, useEffect, useRef, useCallback } from 'react'
import * as Tone from 'tone'
import { useMetronome } from '../../contexts/MetronomeContext'
import FretboardView, { FretDot } from '../../components/FretboardView'
import { GUITAR_STRINGS, getChromatic, getFretForNote } from '../../lib/music'

const STRING_LABELS = ['E (low)', 'A', 'D', 'G', 'B', 'e (high)']

export default function LearnNotes() {
  const { isPlaying, beatCallbackRef } = useMetronome()

  // Multi-select: which strings are included in the drill
  const [selectedStrings, setSelectedStrings] = useState<number[]>([0])

  const [activeStringIdx, setActiveStringIdx] = useState(0)
  const [noteQueue, setNoteQueue] = useState<string[]>(() => getChromatic(0))
  const [currentNote, setCurrentNote] = useState<string>(() => getChromatic(0)[0])
  const [revealedNote, setRevealedNote] = useState<string | null>(null)
  const [revealedStringIdx, setRevealedStringIdx] = useState(0)
  const [countingIn, setCountingIn] = useState(false)

  const synthRef = useRef<Tone.Synth | null>(null)
  const noteQueueRef = useRef(noteQueue)
  const currentNoteRef = useRef(currentNote)
  const activeStringIdxRef = useRef(activeStringIdx)
  const selectedStringsRef = useRef(selectedStrings)
  const countInRef = useRef(false)

  useEffect(() => { noteQueueRef.current = noteQueue }, [noteQueue])
  useEffect(() => { currentNoteRef.current = currentNote }, [currentNote])
  useEffect(() => { activeStringIdxRef.current = activeStringIdx }, [activeStringIdx])
  useEffect(() => { selectedStringsRef.current = selectedStrings }, [selectedStrings])

  useEffect(() => {
    synthRef.current = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.5 },
    }).toDestination()
    return () => { synthRef.current?.dispose() }
  }, [])

  const onBeat = useCallback((beat: number, time: number) => {
    if (beat !== 0) return

    // Count-in: skip the first measure, then begin the drill
    if (countInRef.current) {
      countInRef.current = false
      Tone.getDraw().schedule(() => setCountingIn(false), time)
      return
    }

    // Capture current challenge to reveal its dot
    const noteToReveal = currentNoteRef.current
    const stringToReveal = activeStringIdxRef.current

    // Advance queue to next challenge
    const queue = noteQueueRef.current.slice()
    queue.shift()

    let newQueue = queue
    if (newQueue.length === 0) {
      // Move to next selected string (circular)
      const sel = selectedStringsRef.current
      const pos = sel.indexOf(activeStringIdxRef.current)
      const nextIdx = sel[(pos + 1) % sel.length]
      activeStringIdxRef.current = nextIdx
      newQueue = getChromatic(nextIdx)
    }

    // Play the note being revealed at the precise transport time
    const stringRoot = GUITAR_STRINGS[stringToReveal]
    const octave = stringRoot.replace(/[A-G#b]/g, '')
    try {
      synthRef.current?.triggerAttackRelease(`${noteToReveal}${octave}`, '8n', time)
    } catch {
      // ignore invalid note name
    }

    Tone.getDraw().schedule(() => {
      setRevealedNote(noteToReveal)
      setRevealedStringIdx(stringToReveal)
      if (newQueue.length < noteQueueRef.current.length) {
        setActiveStringIdx(activeStringIdxRef.current)
      }
      setCurrentNote(newQueue[0])
      setNoteQueue(newQueue)
    }, time)
  }, [])

  // Arm count-in whenever the metronome starts
  useEffect(() => {
    if (isPlaying) {
      countInRef.current = true
      setCountingIn(true)
    } else {
      setCountingIn(false)
    }
  }, [isPlaying])

  // Register / unregister beat callback through context (single engine in MetronomePanel)
  useEffect(() => {
    beatCallbackRef.current = onBeat
    return () => { beatCallbackRef.current = null }
  }, [onBeat, beatCallbackRef])

  const dots: FretDot[] = revealedNote !== null ? (() => {
    const fret = getFretForNote(revealedStringIdx, revealedNote)
    if (fret === -1) return []
    return [{ string: 6 - revealedStringIdx, fret, note: revealedNote }]
  })() : []

  const toggleString = (idx: number) => {
    setSelectedStrings(prev => {
      if (prev.includes(idx)) {
        if (prev.length === 1) return prev  // keep at least one selected
        const next = prev.filter(s => s !== idx)
        // If we're removing the active string, jump to the first remaining
        if (activeStringIdx === idx) {
          const newActive = next[0]
          setActiveStringIdx(newActive)
          activeStringIdxRef.current = newActive
          const newQueue = getChromatic(newActive)
          setNoteQueue(newQueue)
          setCurrentNote(newQueue[0])
          setRevealedNote(null)
        }
        return next
      }
      return [...prev, idx].sort((a, b) => a - b)
    })
  }

  // noteNumber = how many notes into the string we are (1-indexed).
  const noteNumber = revealedNote !== null ? 12 - noteQueue.length : 0

  return (
    <div className="flex flex-col items-center p-6 gap-6">
      <h1 className="text-4xl font-bold font-display tracking-tight text-fg-primary">Learn Notes</h1>

      <div className="flex flex-col items-center gap-1">
        <div className="text-8xl font-bold font-display min-w-32 text-center text-ui-info">
          {currentNote}
        </div>
        <div className="text-fg-secondary text-sm">
          {isPlaying && !countingIn ? `on string: ${STRING_LABELS[activeStringIdx]}` : isPlaying ? '\u00a0' : 'Press play to start'}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        {STRING_LABELS.map((label, idx) => {
          const isActive = activeStringIdx === idx
          const isSelected = selectedStrings.includes(idx)
          return (
            <button
              key={idx}
              onClick={() => toggleString(idx)}
              className={`px-3 py-1.5 rounded text-sm font-mono transition ${
                isActive
                  ? 'bg-ui-primary text-white ring-2 ring-ui-primary ring-offset-2 ring-offset-base'
                  : isSelected
                    ? 'bg-ui-primary/30 text-fg-primary'
                    : 'bg-surface-2 text-fg-muted hover:bg-surface-3'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="text-fg-muted text-xs">
        {revealedNote !== null ? `${noteNumber} / 12 notes on this string` : '— / 12 notes on this string'}
      </div>

      <div className="w-full max-w-[60rem] overflow-x-auto">
        <FretboardView dots={dots} fretFrom={0} fretTo={12} dotText={d => d.note ?? ''} />
      </div>

      {!isPlaying && (
        <p className="text-fg-secondary text-sm text-center max-w-sm">
          The metronome will reveal one note per beat 1. Find it on the fretboard.
          Use the panel below to start.
        </p>
      )}
    </div>
  )
}
