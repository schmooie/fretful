import { useEffect, useRef, useCallback } from 'react'
import * as Tone from 'tone'
import { useMetronome } from '../contexts/MetronomeContext'

export function useMetronomeEngine() {
  const { bpm, beatsPerMeasure, accentMode, isPlaying, setCurrentBeat, beatCallbackRef } = useMetronome()

  const accentSynthRef = useRef<Tone.MembraneSynth | null>(null)
  const regularSynthRef = useRef<Tone.MembraneSynth | null>(null)
  const sequenceRef = useRef<Tone.Sequence | null>(null)
  const beatRef = useRef(0)

  useEffect(() => {
    accentSynthRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    }).toDestination()
    regularSynthRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    }).toDestination()

    return () => {
      accentSynthRef.current?.dispose()
      regularSynthRef.current?.dispose()
    }
  }, [])

  const tick = useCallback((time: number) => {
    const beat = beatRef.current
    const isAccent = beat === 0
    const hasBeatCallback = !!beatCallbackRef.current

    // Feature callback receives the scheduled audio time so it can schedule
    // its own audio precisely — call it here in the audio thread, not in getDraw
    if (hasBeatCallback) {
      beatCallbackRef.current!(beat, time)
    }

    // Beat 0 is handled by the feature callback when one is registered.
    // All other beats always get a regular click.
    if (isAccent && hasBeatCallback) {
      // silence — feature plays the note instead
    } else if (isAccent && (accentMode === 'all' || accentMode === 'downbeat') && accentSynthRef.current) {
      accentSynthRef.current.triggerAttackRelease('C2', '16n', time)
    } else if (regularSynthRef.current) {
      regularSynthRef.current.triggerAttackRelease('C1', '16n', time)
    }

    const currentBeat = beat
    Tone.getDraw().schedule(() => {
      setCurrentBeat(currentBeat)
    }, time)

    beatRef.current = (beat + 1) % beatsPerMeasure
  }, [accentMode, beatsPerMeasure, beatCallbackRef, setCurrentBeat])

  useEffect(() => {
    sequenceRef.current?.dispose()
    sequenceRef.current = null

    if (!isPlaying) {
      Tone.getTransport().stop()
      beatRef.current = 0
      setCurrentBeat(0)
      return
    }

    Tone.getTransport().bpm.value = bpm
    sequenceRef.current = new Tone.Sequence(tick, [0], '4n')
    sequenceRef.current.start(0)
    Tone.getTransport().start()

    return () => {
      sequenceRef.current?.dispose()
      sequenceRef.current = null
    }
  }, [isPlaying, bpm, beatsPerMeasure, tick, setCurrentBeat])
}
