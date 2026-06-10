import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title:       'TokenCap Token — Credentialing Portal',
  description: 'Participant onboarding and credentialing for the 2678 ecosystem.',
  robots:      { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-tcm-light-grey text-tcm-grey font-sans antialiased">
        {/* Regulatory disclaimer — visible on ALL screens. Doc10 §IV non-negotiable. */}
        <div className="bg-tcm-blue text-white text-xs text-center py-1.5 px-4 sticky top-0 z-50">
          TokenCap Token is a credential, not a financial instrument.
        </div>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
