'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',   icon: '📊' },
  { href: '/credentials', label: 'Credentials', icon: '🪪' },
  { href: '/audit',       label: 'Audit Log',   icon: '📋' },
]

export function Sidebar() {
  const path = usePathname()
  return (
    <aside className="w-56 min-h-screen bg-tcm-blue text-white flex flex-col">
      <div className="px-6 py-6 border-b border-tcm-blue-dark">
        <h1 className="font-bold text-sm tracking-wide">TCM Admin</h1>
        <p className="text-xs opacity-60 mt-0.5">Operations Portal</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon }) => {
          const active = path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active ? 'bg-white/20' : 'hover:bg-white/10'}`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="px-6 py-4 border-t border-tcm-blue-dark text-xs opacity-50">
        TokenCap Miner v0.1
      </div>
    </aside>
  )
}
