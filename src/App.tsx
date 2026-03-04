import { MetronomeProvider } from './contexts/MetronomeContext'
import Layout from './components/Layout'
import MetronomeView from './features/Metronome'
import LearnNotes from './features/LearnNotes'
import LearnChords from './features/LearnChords'
import LearnTriads from './features/LearnTriads'
import LearnScales from './features/LearnScales'
import { useHashView } from './hooks/useHashView'

function AppContent() {
  const [view, navigate] = useHashView()

  const renderView = () => {
    switch (view) {
      case 'metronome': return <MetronomeView />
      case 'learn-notes': return <LearnNotes />
      case 'learn-chords': return <LearnChords />
      case 'learn-triads': return <LearnTriads />
      case 'learn-scales': return <LearnScales />
    }
  }

  return (
    <Layout activeView={view} onNavigate={navigate}>
      {renderView()}
    </Layout>
  )
}

export default function App() {
  return (
    <MetronomeProvider>
      <AppContent />
    </MetronomeProvider>
  )
}
