import { start } from 'tone'
import { useMetronome } from '../contexts/MetronomeContext'
import { useMetronomeEngine } from '../hooks/useMetronomeEngine'

const TIME_SIGS = [
  { label: '3/4', beats: 3 },
  { label: '4/4', beats: 4 },
  { label: '5/4', beats: 5 },
  { label: '6/8', beats: 6 },
]

export default function MetronomePanel() {
  const { bpm, setBpm, beatsPerMeasure, setBeatsPerMeasure, isPlaying, setIsPlaying, currentBeat } = useMetronome()

  useMetronomeEngine()

  const toggle = async () => {
    await start()
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-900 border-t border-zinc-700 grid grid-cols-[1fr_auto_1fr] items-center px-4 gap-4 z-50">
      {/* Left: empty spacer */}
      <div />

      {/* Center: controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={toggle}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 text-white text-lg transition"
          aria-label={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? '⏹' : '▶'}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setBpm(Math.max(20, bpm - 5))}
            className="w-7 h-7 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-sm"
          >−</button>
          <span className="text-white font-mono text-sm w-14 text-center">{bpm} BPM</span>
          <button
            onClick={() => setBpm(Math.min(300, bpm + 5))}
            className="w-7 h-7 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-sm"
          >+</button>
        </div>

        <div className="flex gap-1">
          {TIME_SIGS.map(ts => (
            <button
              key={ts.label}
              onClick={() => setBeatsPerMeasure(ts.beats)}
              className={`px-2 py-1 rounded text-xs font-mono transition ${
                beatsPerMeasure === ts.beats
                  ? 'bg-sky-600 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {ts.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: beat indicators */}
      <div className="flex gap-1.5 justify-end">
        {Array.from({ length: beatsPerMeasure }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-colors duration-75 ${
              isPlaying && currentBeat === i
                ? i === 0 ? 'bg-amber-400' : 'bg-sky-400'
                : 'bg-zinc-600'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
