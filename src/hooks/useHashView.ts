import { useState, useEffect } from 'react'
import { View } from '../components/Sidebar'

const VIEWS: View[] = ['metronome', 'learn-notes', 'learn-chords', 'learn-triads', 'learn-scales']

function hashToView(hash: string): View {
  const id = hash.replace(/^#\//, '') as View
  return VIEWS.includes(id) ? id : 'learn-notes'
}

export function useHashView(): [View, (v: View) => void] {
  const [view, setView] = useState<View>(() => hashToView(window.location.hash))

  useEffect(() => {
    const onHashChange = () => setView(hashToView(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (v: View) => {
    window.location.hash = `/${v}`
  }

  return [view, navigate]
}
