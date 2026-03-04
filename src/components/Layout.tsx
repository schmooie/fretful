import { ReactNode } from 'react'
import { View } from './Sidebar'
import MetronomePanel from './MetronomePanel'

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: 'metronome',    label: 'Metronome'  },
  { id: 'learn-notes',  label: 'Notes'      },
  { id: 'learn-chords', label: 'Chords'     },
  { id: 'learn-triads', label: 'Triads'     },
  { id: 'learn-scales', label: 'Scales'     },
]

interface LayoutProps {
  activeView: View
  onNavigate: (v: View) => void
  children: ReactNode
}

export default function Layout({ activeView, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-base text-fg-primary overflow-hidden">
      <header className="flex items-center justify-end gap-1 px-4 h-12 border-b border-border shrink-0">
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
      </header>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <MetronomePanel />
    </div>
  )
}
