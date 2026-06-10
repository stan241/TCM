'use client'

/**
 * WagmiProvider wrapper — loaded dynamically with ssr:false so wagmi's
 * walletConnect connector is never executed during Next.js SSR prerender.
 */

import { WagmiProvider }    from 'wagmi'
import { getWagmiConfig }   from '@/lib/wagmi'
import { useState, type ReactNode } from 'react'

export function WagmiClientProvider({ children }: { children: ReactNode }) {
  const [config] = useState(() => getWagmiConfig())
  return (
    <WagmiProvider config={config}>
      {children as any}
    </WagmiProvider>
  )
}
