import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout({ title, children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="fx-app">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="fx-main">
        <Header title={title} onMenuClick={() => setMenuOpen((o) => !o)} />
        <main className="fx-content fx-scrollbar">{children}</main>
      </div>
    </div>
  )
}
