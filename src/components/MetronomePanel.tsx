import { useState, useEffect } from 'react'
import { start } from 'tone'
import { useMetronome } from '../contexts/MetronomeContext'
import { useMetronomeEngine } from '../hooks/useMetronomeEngine'

const TIME_SIGS = [
  { label: '2/4', beats: 2 },
  { label: '3/4', beats: 3 },
  { label: '4/4', beats: 4 },
  { label: '5/4', beats: 5 },
  { label: '6/8', beats: 6 },
  { label: '7/8', beats: 7 },
]

export default function MetronomePanel() {
  const { bpm, setBpm, beatsPerMeasure, setBeatsPerMeasure, isPlaying, setIsPlaying, currentBeat } = useMetronome()

  useMetronomeEngine()

  const [bpmInput, setBpmInput] = useState(String(bpm))

  useEffect(() => { setBpmInput(String(bpm)) }, [bpm])

  const commitBpm = (val: string) => {
    const n = parseInt(val, 10)
    const clamped = isNaN(n) ? bpm : Math.max(20, Math.min(300, n))
    setBpm(clamped)
    setBpmInput(String(clamped))
  }

  const toggle = async () => {
    await start()
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-surface-1 border-t border-border-strong grid grid-cols-[1fr_auto_1fr] items-center px-4 gap-4 z-50">

      {/* Left: spacer */}
      <div />

      {/* Center: controls */}
      <div className="flex items-center gap-5">

        {/* Time signature dropdown */}
        <select
          value={beatsPerMeasure}
          onChange={e => setBeatsPerMeasure(Number(e.target.value))}
          className="h-8 px-3 rounded-lg bg-surface-2 text-fg-primary font-mono text-sm appearance-none cursor-pointer hover:bg-surface-3 transition border-0 outline-none"
          style={{ textAlignLast: 'center' }}
        >
          {TIME_SIGS.map(ts => (
            <option key={ts.label} value={ts.beats}>{ts.label}</option>
          ))}
        </select>

        {/* Play/Stop */}
        <button
          onClick={toggle}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-surface-3 hover:bg-surface-3 text-fg-primary text-xs font-display transition"
          aria-label={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? '⏹' : '▶'}
        </button>

        {/* BPM input */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            inputMode="numeric"
            value={bpmInput}
            onChange={e => setBpmInput(e.target.value)}
            onBlur={e => commitBpm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { commitBpm(bpmInput); e.currentTarget.blur() } }}
            className="w-12 h-8 rounded bg-surface-2 text-fg-primary font-mono text-sm text-center border-0 outline-none focus:ring-1 focus:ring-border-strong"
          />
          <span className="text-fg-secondary font-mono text-sm">BPM</span>
        </div>

      </div>

      {/* Right: beat indicators */}
      <div className="flex gap-1.5 justify-end">
        {Array.from({ length: beatsPerMeasure }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors duration-75 ${
              isPlaying && currentBeat === i
                ? i === 0 ? 'bg-ui-warning' : 'bg-ui-info'
                : 'bg-surface-3'
            }`}
          />
        ))}
      </div>

    </div>
  )
}
