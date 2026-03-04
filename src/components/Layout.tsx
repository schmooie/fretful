import { ReactNode } from 'react'
import { View } from './Sidebar'
import MetronomePanel from './MetronomePanel'

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: 'learn-notes',  label: 'Notes'      },
  { id: 'learn-chords', label: 'Chords'     },
  { id: 'learn-triads', label: 'Triads'     },
  { id: 'learn-scales', label: 'Scales'     },
  { id: 'metronome',    label: 'Metronome'  },
]

interface LayoutProps {
  activeView: View
  onNavigate: (v: View) => void
  children: ReactNode
}

export default function Layout({ activeView, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-base text-fg-primary overflow-hidden">
      <header className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        {/* Logo — top left */}
        <div className="flex items-center gap-1.5 select-none">
          <svg viewBox="0 0 24 18" width="24" height="18" fill="none" aria-hidden="true">
            {/* Nut */}
            <rect x="1" y="1" width="2" height="16" rx="1" style={{ fill: 'var(--color-fg-muted)' }} />
            {/* Fret lines */}
            <line x1="9"  y1="1" x2="9"  y2="17" stroke="var(--color-border-strong)" strokeWidth="1" />
            <line x1="17" y1="1" x2="17" y2="17" stroke="var(--color-border-strong)" strokeWidth="1" />
            <line x1="23" y1="1" x2="23" y2="17" stroke="var(--color-border-strong)" strokeWidth="1" />
            {/* Strings — thicker toward low E */}
            <line x1="1" y1="4"  x2="23" y2="4"  stroke="var(--color-fg-secondary)" strokeWidth="0.75" />
            <line x1="1" y1="8"  x2="23" y2="8"  stroke="var(--color-fg-secondary)" strokeWidth="1"    />
            <line x1="1" y1="12" x2="23" y2="12" stroke="var(--color-fg-secondary)" strokeWidth="1.25" />
            <line x1="1" y1="16" x2="23" y2="16" stroke="var(--color-fg-secondary)" strokeWidth="1.5"  />
            {/* Fingering dot */}
            <circle cx="13" cy="8" r="3" style={{ fill: 'var(--color-ui-primary)' }} />
          </svg>
          <span className="font-display font-bold text-sm text-fg-primary tracking-tight">fretful</span>
        </div>

        {/* Nav items — top right */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-display font-semibold transition ${
                activeView === item.id
                  ? 'bg-ui-primary text-white'
                  : 'text-fg-muted hover:text-fg-primary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <MetronomePanel />
    </div>
  )
}
