import Link from 'next/link'

export function OnboardingShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="bg-[#0C1B2E] text-white/40 text-[11px] text-center py-2 font-medium">
        TokenCap Token is a credential, not a financial instrument.
      </div>
      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between" style={{height:'60px'}}>
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1A3A5C] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">TC</span>
            </div>
            <span className="font-bold text-[#1A3A5C] text-base">TokenCap Network</span>
          </Link>
          <Link href="/auth/signin" className="text-sm text-slate-500 hover:text-[#1A3A5C] font-medium transition-colors">
            Sign In
          </Link>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className={`${wide ? 'max-w-2xl' : 'max-w-xl'} mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8`}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Spinner() {
  return <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
}
