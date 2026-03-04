import { ReactNode } from 'react'
import Sidebar, { View } from './Sidebar'
import MetronomePanel from './MetronomePanel'

interface LayoutProps {
  activeView: View
  onNavigate: (v: View) => void
  children: ReactNode
}

export default function Layout({ activeView, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <Sidebar activeView={activeView} onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto pb-16">
        {children}
      </main>
      <MetronomePanel />
    </div>
  )
}
