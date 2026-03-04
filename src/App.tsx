import { useState } from 'react'
import { MetronomeProvider } from './contexts/MetronomeContext'
import Layout from './components/Layout'
import { View } from './components/Sidebar'
import MetronomeView from './features/Metronome'
import LearnNotes from './features/LearnNotes'
import LearnChords from './features/LearnChords'
import LearnTriads from './features/LearnTriads'
import LearnScales from './features/LearnScales'

function AppContent() {
  const [view, setView] = useState<View>('learn-notes')

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
    <Layout activeView={view} onNavigate={setView}>
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
