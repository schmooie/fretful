import { useState, useEffect, useRef, useCallback } from 'react'
import * as Tone from 'tone'
import { useMetronome } from '../../contexts/MetronomeContext'
import FretboardView, { FretDot } from '../../components/FretboardView'
import { GUITAR_STRINGS, getChromatic, getFretForNote } from '../../lib/music'

const STRING_LABELS = ['E (low)', 'A', 'D', 'G', 'B', 'e (high)']

export default function LearnNotes() {
  const { isPlaying, beatCallbackRef } = useMetronome()

  const [activeStringIdx, setActiveStringIdx] = useState(0)
  const [noteQueue, setNoteQueue] = useState<string[]>(() => getChromatic(0))
  const [currentNote, setCurrentNote] = useState<string>(() => getChromatic(0)[0])
  const [revealedNote, setRevealedNote] = useState<string | null>(null)
  const [revealedStringIdx, setRevealedStringIdx] = useState(0)

  const synthRef = useRef<Tone.Synth | null>(null)
  const noteQueueRef = useRef(noteQueue)
  const currentNoteRef = useRef(currentNote)
  const activeStringIdxRef = useRef(activeStringIdx)

  useEffect(() => { noteQueueRef.current = noteQueue }, [noteQueue])
  useEffect(() => { currentNoteRef.current = currentNote }, [currentNote])
  useEffect(() => { activeStringIdxRef.current = activeStringIdx }, [activeStringIdx])

  useEffect(() => {
    synthRef.current = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.5 },
    }).toDestination()
    return () => { synthRef.current?.dispose() }
  }, [])

  const onBeat = useCallback((beat: number, time: number) => {
    if (beat !== 0) return

    // Capture current challenge to reveal its dot
    const noteToReveal = currentNoteRef.current
    const stringToReveal = activeStringIdxRef.current

    // Advance queue to next challenge
    const queue = noteQueueRef.current.slice()
    queue.shift()  // remove current note

    let newQueue = queue
    if (newQueue.length === 0) {
      const nextIdx = (activeStringIdxRef.current + 1) % 6
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
      // Reveal answer for current challenge
      setRevealedNote(noteToReveal)
      setRevealedStringIdx(stringToReveal)
      // Advance to next challenge
      if (newQueue.length < noteQueueRef.current.length) {
        setActiveStringIdx(activeStringIdxRef.current)
      }
      setCurrentNote(newQueue[0])
      setNoteQueue(newQueue)
    }, time)
  }, [])

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

  const switchString = (idx: number) => {
    setActiveStringIdx(idx)
    const newQueue = getChromatic(idx)
    setNoteQueue(newQueue)
    setCurrentNote(newQueue[0])
    setRevealedNote(null)
  }

  // noteNumber = how many notes into the string we are (1-indexed).
  const noteNumber = revealedNote !== null ? 12 - noteQueue.length + 1 : 0

  return (
    <div className="flex flex-col items-center p-6 gap-6">
      <h1 className="text-4xl font-bold font-display tracking-tight text-fg-primary">Learn Notes</h1>

      <div className="flex flex-col items-center gap-1">
        <div className="text-8xl font-bold text-ui-info font-display min-w-32 text-center">
          {currentNote}
        </div>
        <div className="text-fg-secondary text-sm">
          {isPlaying ? `on string: ${STRING_LABELS[activeStringIdx]}` : 'Press play to start'}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        {STRING_LABELS.map((label, idx) => (
          <button
            key={idx}
            onClick={() => switchString(idx)}
            className={`px-3 py-1.5 rounded text-sm font-mono transition ${
              activeStringIdx === idx
                ? 'bg-ui-primary text-white'
                : 'bg-surface-2 text-fg-secondary hover:bg-surface-3'
            }`}
          >
            {label}
          </button>
        ))}
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
