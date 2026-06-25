'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()

  const isOnboarding = pathname?.startsWith('/onboarding')
  const isAuth       = pathname?.startsWith('/auth')
  const isLanding    = pathname === '/'

  if (isLanding || isAuth || isOnboarding) return <>{children}</>

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      <div className="bg-[#0C1B2E] text-white/40 text-[11px] text-center py-2 font-medium tracking-wide">
        TokenCap Token is a credential, not a financial instrument.
      </div>

      <header className="bg-white border-b border-slate-200 px-6 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between" style={{height:'60px'}}>
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1A3A5C] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">TC</span>
            </div>
            <span className="font-bold text-[#1A3A5C] text-base hidden sm:block">TokenCap Network</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
            <Link href="/dashboard" className={`transition-colors ${pathname === '/dashboard' ? 'text-[#1A3A5C] font-semibold' : 'hover:text-[#1A3A5C]'}`}>
              Dashboard
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            {session?.user?.email && (
              <div className="hidden md:flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#1A3A5C]/10 flex items-center justify-center">
                  <span className="text-[#1A3A5C] text-xs font-bold">
                    {session.user.email[0].toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-medium">{session.user.email}</span>
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-xs text-slate-500 hover:text-[#1A3A5C] transition-colors border border-slate-200 rounded-lg px-3 py-2 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-slate-400">
          <span className="text-[#1A3A5C] font-semibold">TokenCap Token is a credential, not a financial instrument.</span>
          <span>© 2026 2678 Holdings · Polygon PoS · Chain ID 137</span>
        </div>
      </footer>
    </div>
  )
}
