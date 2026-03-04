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
  const [isRevealed, setIsRevealed] = useState(false)

  const synthRef = useRef<Tone.Synth | null>(null)
  const noteQueueRef = useRef(noteQueue)
  const activeStringIdxRef = useRef(activeStringIdx)

  useEffect(() => { noteQueueRef.current = noteQueue }, [noteQueue])
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

    const queue = noteQueueRef.current.slice()
    const note = queue.shift() ?? ''

    let newQueue = queue
    if (newQueue.length === 0) {
      const nextIdx = (activeStringIdxRef.current + 1) % 6
      activeStringIdxRef.current = nextIdx
      newQueue = getChromatic(nextIdx)
    }

    // Schedule audio at the precise transport time
    const stringRoot = GUITAR_STRINGS[activeStringIdxRef.current]
    const octave = stringRoot.replace(/[A-G#b]/g, '')
    try {
      synthRef.current?.triggerAttackRelease(`${note}${octave}`, '8n', time)
    } catch {
      // ignore invalid note name
    }

    // Schedule UI updates for the animation frame closest to this beat
    Tone.getDraw().schedule(() => {
      if (newQueue.length < noteQueueRef.current.length) {
        // wrapped to new string
        setActiveStringIdx(activeStringIdxRef.current)
      }
      setCurrentNote(newQueue[0])
      setNoteQueue(newQueue)
      setIsRevealed(true)
    }, time)
  }, [])

  // Register / unregister beat callback through context (single engine in MetronomePanel)
  useEffect(() => {
    beatCallbackRef.current = onBeat
    return () => { beatCallbackRef.current = null }
  }, [onBeat, beatCallbackRef])

  const dots: FretDot[] = isRevealed ? (() => {
    const fret = getFretForNote(activeStringIdx, currentNote)
    if (fret === -1) return []
    return [{ string: 6 - activeStringIdx, fret, note: currentNote }]
  })() : []

  const switchString = (idx: number) => {
    setActiveStringIdx(idx)
    const newQueue = getChromatic(idx)
    setNoteQueue(newQueue)
    setCurrentNote(newQueue[0])
    setIsRevealed(false)
  }

  // noteQueue always contains currentNote at index 0 plus the remaining notes.
  // noteNumber = how many notes into the string we are (1-indexed).
  const noteNumber = isRevealed ? 12 - noteQueue.length + 1 : 0

  return (
    <div className="flex flex-col items-center p-6 gap-6">
      <h1 className="text-2xl font-bold text-zinc-200">Learn Notes</h1>

      <div className="flex flex-col items-center gap-1">
        <div className="text-8xl font-bold text-sky-400 font-mono min-w-32 text-center">
          {currentNote}
        </div>
        <div className="text-zinc-500 text-sm">
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
                ? 'bg-sky-600 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="text-zinc-500 text-xs">
        {isRevealed ? `${noteNumber} / 12 notes on this string` : '— / 12 notes on this string'}
      </div>

      <div className="w-full max-w-3xl overflow-x-auto">
        <FretboardView dots={dots} fretFrom={0} fretTo={12} />
      </div>

      {!isPlaying && (
        <p className="text-zinc-500 text-sm text-center max-w-sm">
          The metronome will reveal one note per beat 1. Find it on the fretboard.
          Use the panel below to start.
        </p>
      )}
    </div>
  )
}
