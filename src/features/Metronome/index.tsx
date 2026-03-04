import { useRef } from 'react'
import { useMetronome } from '../../contexts/MetronomeContext'

const TIME_SIGS = [
  { label: '2/4', beats: 2 },
  { label: '3/4', beats: 3 },
  { label: '4/4', beats: 4 },
  { label: '5/4', beats: 5 },
  { label: '6/8', beats: 6 },
  { label: '7/8', beats: 7 },
]

const BPM_MIN = 20
const BPM_MAX = 300
const ARC_CX = 140
const ARC_CY = 133
const ARC_R = 122

function bpmToDot(bpm: number): { x: number; y: number } {
  const fraction = (bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)
  const angle = Math.PI * (1 - fraction)
  return {
    x: ARC_CX + ARC_R * Math.cos(angle),
    y: ARC_CY - ARC_R * Math.sin(angle),
  }
}

export default function MetronomeView() {
  const {
    bpm, setBpm,
    beatsPerMeasure, setBeatsPerMeasure,
    accentMode, setAccentMode,
    isPlaying, setIsPlaying,
    currentBeat,
  } = useMetronome()

  const svgRef = useRef<SVGSVGElement>(null)
  const tapTimesRef = useRef<number[]>([])

  const toggle = async () => {
    const { start } = await import('tone')
    await start()
    setIsPlaying(!isPlaying)
  }

  const accentOn = accentMode !== 'none'
  const toggleAccent = () => setAccentMode(accentOn ? 'none' : 'downbeat')

  const handleArcPointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 280
    const y = ((clientY - rect.top) / rect.height) * 140
    const dx = x - ARC_CX
    const dy = ARC_CY - y
    const angle = Math.atan2(dy, dx)
    if (angle < 0 || angle > Math.PI) return
    const fraction = 1 - angle / Math.PI
    setBpm(Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(BPM_MIN + fraction * (BPM_MAX - BPM_MIN)))))
  }

  const handleTap = () => {
    const now = Date.now()
    const recent = tapTimesRef.current.filter(t => now - t < 2500)
    recent.push(now)
    tapTimesRef.current = recent
    if (recent.length >= 2) {
      const intervals = recent.slice(1).map((t, i) => t - recent[i])
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      setBpm(Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(60000 / avg))))
    }
  }

  const dot = bpmToDot(bpm)

  return (
    <div className="flex flex-col items-center p-6 gap-6">

      <h1 className="text-4xl font-bold font-display tracking-tight text-fg-primary">Metronome</h1>

      {/* Time sig + Accent */}
      <div className="flex gap-3 w-full max-w-sm">
        <select
          value={beatsPerMeasure}
          onChange={e => setBeatsPerMeasure(Number(e.target.value))}
          className="flex-1 h-14 rounded-xl bg-surface-2 text-fg-primary font-mono text-base text-center appearance-none cursor-pointer hover:bg-surface-3 transition border-0 outline-none"
          style={{ textAlignLast: 'center' }}
        >
          {TIME_SIGS.map(ts => (
            <option key={ts.label} value={ts.beats}>{ts.label}</option>
          ))}
        </select>

        <button
          onClick={toggleAccent}
          className={`flex-1 h-14 rounded-xl font-display font-semibold text-base transition ${
            accentOn
              ? 'bg-surface-3 text-fg-primary hover:bg-surface-3'
              : 'bg-surface-2 text-fg-secondary hover:bg-surface-3'
          }`}
        >
          {accentOn ? 'Accent On' : 'Accent Off'}
        </button>
      </div>

      {/* Arc dial */}
      <div className="relative w-72">
        <svg
          ref={svgRef}
          viewBox="0 0 280 140"
          className="w-full cursor-pointer select-none"
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); handleArcPointer(e.clientX, e.clientY) }}
          onPointerMove={e => { if (e.buttons > 0) handleArcPointer(e.clientX, e.clientY) }}
        >
          <path
            d={`M ${ARC_CX - ARC_R},${ARC_CY} A ${ARC_R},${ARC_R} 0 0 1 ${ARC_CX + ARC_R},${ARC_CY}`}
            fill="none"
            style={{ stroke: 'var(--border-strong)' }}
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx={dot.x} cy={dot.y} r="10" style={{ fill: 'var(--ui-primary)' }} />
        </svg>

        {/* BPM overlaid inside the arc */}
        <div className="absolute bottom-1 inset-x-0 flex flex-col items-center">
          <span className="text-7xl font-bold font-display text-fg-primary leading-none">{bpm}</span>
          <span className="text-fg-muted text-xs font-mono tracking-widest uppercase mt-1">BPM</span>
        </div>
      </div>

      {/* Beat dots */}
      <div className="flex gap-2">
        {Array.from({ length: beatsPerMeasure }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors duration-75 ${
              isPlaying && currentBeat === i
                ? i === 0 && accentOn ? 'bg-ui-primary' : 'bg-ui-info'
                : 'bg-surface-3'
            }`}
          />
        ))}
      </div>

      {/* TAP | Play | Beat */}
      <div className="flex items-center w-full max-w-sm bg-surface-2 rounded-2xl h-16">
        <button
          onClick={handleTap}
          className="flex-1 h-full rounded-l-2xl font-display font-semibold text-lg text-fg-secondary hover:bg-surface-3 transition"
        >
          TAP
        </button>
        <div className="w-px h-8 bg-border-strong" />
        <div className="w-20 flex items-center justify-center">
          <button
            onClick={toggle}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-3 hover:bg-surface-3 text-fg-primary font-display text-lg transition"
            aria-label={isPlaying ? 'Stop' : 'Play'}
          >
            {isPlaying ? '⏹' : '▶'}
          </button>
        </div>
        <div className="w-px h-8 bg-border-strong" />
        <div className="flex-1 h-full rounded-r-2xl flex items-center justify-center font-display font-bold text-lg text-fg-secondary">
          {isPlaying ? currentBeat + 1 : '—'}
        </div>
      </div>
    </div>
  )
}
