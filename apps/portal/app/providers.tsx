'use client'

/**
 * Client-side providers — wagmi + TanStack Query + NextAuth SessionProvider
 *
 * WagmiClientProvider is loaded with ssr:false so wagmi's connectors barrel
 * (walletConnect, porto, coinbase, etc.) never executes during Next.js prerender.
 */

import dynamic                                  from 'next/dynamic'
import { QueryClient, QueryClientProvider }     from '@tanstack/react-query'
import { SessionProvider }                       from 'next-auth/react'
import { useState, type ReactNode }              from 'react'

// ssr:false — wagmi is browser-only; this prevents prerender from executing
// walletConnect / connectors which have broken ESM sub-dependencies server-side.
const WagmiClientProvider = dynamic(
  () => import('./wagmi-provider').then(m => m.WagmiClientProvider),
  { ssr: false }
)

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }))

  return (
    <SessionProvider>
      <WagmiClientProvider>
        <QueryClientProvider client={queryClient}>
          {children as any}
        </QueryClientProvider>
      </WagmiClientProvider>
    </SessionProvider>
  )
}
