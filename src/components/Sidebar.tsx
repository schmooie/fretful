export type View = 'metronome' | 'learn-notes' | 'learn-chords' | 'learn-triads' | 'learn-scales'

interface NavItem {
  id: View
  icon: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'metronome', icon: '🥁', label: 'Metronome' },
  { id: 'learn-notes', icon: '🎵', label: 'Notes' },
  { id: 'learn-chords', icon: '🎸', label: 'Chords' },
  { id: 'learn-triads', icon: '🔺', label: 'Triads' },
  { id: 'learn-scales', icon: '🎼', label: 'Scales' },
]

interface SidebarProps {
  activeView: View
  onNavigate: (v: View) => void
}

export default function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <nav className="w-16 bg-surface-1 border-r border-border-strong flex flex-col items-center py-4 gap-2 shrink-0">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          title={item.label}
          className={`flex flex-col items-center gap-0.5 w-12 py-2 rounded-lg transition text-xs font-display font-semibold ${
            activeView === item.id
              ? 'bg-ui-primary text-white'
              : 'text-fg-secondary hover:bg-surface-2 hover:text-fg-primary'
          }`}
        >
          <span className="text-lg leading-none">{item.icon}</span>
          <span className="leading-none">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
