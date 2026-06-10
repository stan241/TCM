import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'TCM Admin',
  description: 'TokenCap Miner — Compliance & Operations Portal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
