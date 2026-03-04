import { useMetronome, AccentMode } from '../../contexts/MetronomeContext'

const ACCENT_MODES: { value: AccentMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'downbeat', label: 'Beat 1 only' },
  { value: 'all', label: 'All beats' },
]

const TIME_SIGS = [
  { label: '3/4', beats: 3 },
  { label: '4/4', beats: 4 },
  { label: '5/4', beats: 5 },
  { label: '6/8', beats: 6 },
]

export default function MetronomeView() {
  const { bpm, setBpm, beatsPerMeasure, setBeatsPerMeasure, accentMode, setAccentMode, isPlaying, setIsPlaying, currentBeat } = useMetronome()

  const toggle = async () => {
    const { start } = await import('tone')
    await start()
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 p-8">
      <h1 className="text-3xl font-bold text-zinc-200">Metronome</h1>

      {/* Play/Stop */}
      <button
        onClick={toggle}
        className="w-16 h-16 rounded-full flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 text-white text-2xl transition"
        aria-label={isPlaying ? 'Stop' : 'Play'}
      >
        {isPlaying ? '⏹' : '▶'}
      </button>

      {/* Beat display */}
      <div className="flex gap-4">
        {Array.from({ length: beatsPerMeasure }).map((_, i) => (
          <div
            key={i}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-colors duration-75 ${
              isPlaying && currentBeat === i
                ? i === 0 ? 'bg-amber-400 text-zinc-900' : 'bg-sky-400 text-zinc-900'
                : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* BPM slider */}
      <div className="flex flex-col items-center gap-2 w-64">
        <span className="text-5xl font-mono font-bold text-white">{bpm}</span>
        <span className="text-zinc-400 text-sm">BPM</span>
        <input
          type="range"
          min={20}
          max={300}
          value={bpm}
          onChange={e => setBpm(Number(e.target.value))}
          className="w-full accent-sky-500"
        />
        <div className="flex gap-2">
          {[40, 60, 80, 100, 120, 140, 160].map(v => (
            <button
              key={v}
              onClick={() => setBpm(v)}
              className={`px-2 py-1 rounded text-xs font-mono transition ${
                bpm === v ? 'bg-sky-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Time signature */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-zinc-400 text-sm">Time Signature</span>
        <div className="flex gap-2">
          {TIME_SIGS.map(ts => (
            <button
              key={ts.label}
              onClick={() => setBeatsPerMeasure(ts.beats)}
              className={`px-4 py-2 rounded font-mono transition ${
                beatsPerMeasure === ts.beats
                  ? 'bg-sky-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {ts.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accent mode */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-zinc-400 text-sm">Accent</span>
        <div className="flex gap-2">
          {ACCENT_MODES.map(mode => (
            <button
              key={mode.value}
              onClick={() => setAccentMode(mode.value)}
              className={`px-4 py-2 rounded text-sm transition ${
                accentMode === mode.value
                  ? 'bg-amber-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
