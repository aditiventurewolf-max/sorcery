import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⬛' },
  { to: '/vendors', label: 'Vendors', icon: '◈' },
  { to: '/status', label: 'Status Board', icon: '◫' },
]

export default function Layout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0f0f0f]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#111111] border-r border-[#222] flex flex-col">
        <div className="px-5 py-5 border-b border-[#222]">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-xl font-bold">✦</span>
            <span className="text-white font-semibold text-base tracking-tight">Sourcery</span>
          </div>
          <p className="text-[#555] text-xs mt-1">Vendor Sourcing Tool</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-[#1e1e1e] text-white'
                    : 'text-[#888] hover:text-[#ccc] hover:bg-[#181818]'
                }`
              }
            >
              <span className="text-xs opacity-60">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-[#222]">
          <p className="text-[#333] text-xs font-mono">Scaler Internal</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-[#141414]">
        {children}
      </main>
    </div>
  )
}
