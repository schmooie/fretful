import { createContext, useContext, useState, useRef, ReactNode, MutableRefObject } from 'react'

export type AccentMode = 'downbeat' | 'all' | 'none'

interface MetronomeState {
  bpm: number
  setBpm: (n: number) => void
  beatsPerMeasure: number
  setBeatsPerMeasure: (n: number) => void
  accentMode: AccentMode
  setAccentMode: (m: AccentMode) => void
  isPlaying: boolean
  setIsPlaying: (b: boolean) => void
  currentBeat: number
  setCurrentBeat: (b: number) => void
  beatCallbackRef: MutableRefObject<((beat: number, time: number) => void) | null>
}

const MetronomeContext = createContext<MetronomeState | null>(null)

export function MetronomeProvider({ children }: { children: ReactNode }) {
  const [bpm, setBpm] = useState(120)
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4)
  const [accentMode, setAccentMode] = useState<AccentMode>('downbeat')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(0)
  const beatCallbackRef = useRef<((beat: number, time: number) => void) | null>(null)

  return (
    <MetronomeContext.Provider value={{
      bpm, setBpm,
      beatsPerMeasure, setBeatsPerMeasure,
      accentMode, setAccentMode,
      isPlaying, setIsPlaying,
      currentBeat, setCurrentBeat,
      beatCallbackRef,
    }}>
      {children}
    </MetronomeContext.Provider>
  )
}

export function useMetronome() {
  const ctx = useContext(MetronomeContext)
  if (!ctx) throw new Error('useMetronome must be used within MetronomeProvider')
  return ctx
}
