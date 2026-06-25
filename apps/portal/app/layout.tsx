import type { Metadata } from 'next'
import { Providers } from './providers'
import { AppShell } from '@/components/layout/AppShell'
import './globals.css'

export const metadata: Metadata = {
  title:       'TokenCap Token — Credentialing Portal',
  description: 'Participant onboarding and credentialing for the 2678 ecosystem.',
  robots:      { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-800 font-sans antialiased">
        <Providers>
          <AppShell>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  )
}
