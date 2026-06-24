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

  // Landing, auth, and onboarding pages handle their own layout
  if (isLanding || isAuth || isOnboarding) return <>{children}</>

  return (
    <div className="min-h-screen bg-tcm-light-grey flex flex-col">
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex justify-between items-center sticky top-7 z-40">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-tcm-blue rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-xs">TC</span>
          </div>
          <span className="font-bold text-tcm-blue">TokenCap</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-tcm-grey">
          <NavLink href="/dashboard"  label="Dashboard"  current={pathname} />
        </nav>

        <div className="flex items-center gap-4">
          {session?.user?.email && (
            <span className="hidden md:block text-xs text-tcm-grey">{session.user.email}</span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-xs text-tcm-grey hover:text-tcm-blue transition-colors border rounded px-3 py-1.5"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-white px-6 py-4 text-xs text-center text-tcm-grey">
        <span className="text-tcm-blue font-medium">TokenCap Token is a credential, not a financial instrument.</span>
        <span className="mx-2 text-gray-300">·</span>
        <span>© 2026 2678 Holdings</span>
      </footer>
    </div>
  )
}

function NavLink({ href, label, current }: { href: string; label: string; current: string | null }) {
  const active = current === href
  return (
    <Link
      href={href}
      className={active
        ? 'text-tcm-blue font-semibold'
        : 'hover:text-tcm-blue transition-colors'
      }
    >
      {label}
    </Link>
  )
}
