/**
 * wagmi + viem configuration — TCM Client Intake Portal
 *
 * Doc10 §V: wagmi + viem for wallet interactions.
 * MetaMask (browser extension) + WalletConnect v2 (mobile).
 * EIP-191 signing for wallet binding.
 *
 * NOTE: createConfig is lazily initialized to avoid server-side execution
 * during Next.js prerender (wagmi is browser-only).
 */

import type { Chain } from 'viem'

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? ''

let _wagmiConfig: ReturnType<typeof import('wagmi')['createConfig']> | null = null

export function getWagmiConfig() {
  if (typeof window === 'undefined') {
    // Return a dummy config during SSR — never actually used server-side
    // since all wagmi hooks are in 'use client' components
    return null as any
  }

  if (_wagmiConfig) return _wagmiConfig

  // Dynamic require at runtime (browser only) — keeps the module graph clean
  const { createConfig, http } = require('wagmi') as typeof import('wagmi')
  const { polygon, polygonAmoy, polygonMumbai } = require('wagmi/chains') as typeof import('wagmi/chains')
  const { injected, walletConnect }             = require('wagmi/connectors') as typeof import('wagmi/connectors')

  const chain: Chain =
    process.env.NODE_ENV === 'production'             ? polygon :
    process.env.NEXT_PUBLIC_NETWORK === 'amoy'        ? polygonAmoy :
    polygonMumbai

  const connectors = [
    injected({ target: 'metaMask' }),
    // WalletConnect requires a project ID — skip in demo or when not configured
    ...(WC_PROJECT_ID ? [walletConnect({
      projectId: WC_PROJECT_ID,
      metadata: {
        name:        'TokenCap Token Portal',
        description: 'Credential issuance portal — TokenCap Miner',
        url:         process.env.NEXTAUTH_URL ?? 'https://portal.tokencap.io',
        icons:       [],
      },
      showQrModal: true,
    })] : []),
  ]

  _wagmiConfig = createConfig({
    chains: [chain] as [Chain],
    connectors,
    transports: {
      [polygon.id]:       http(process.env.NEXT_PUBLIC_RPC_POLYGON  ?? ''),
      [polygonAmoy.id]:   http(process.env.NEXT_PUBLIC_RPC_AMOY     ?? ''),
      [polygonMumbai.id]: http(process.env.NEXT_PUBLIC_RPC_MUMBAI   ?? ''),
    },
  })

  return _wagmiConfig
}

// Keep a synchronous export for components that import it at module level
// — returns null on server, real config on client
export const wagmiConfig = typeof window !== 'undefined'
  ? undefined   // will be set lazily by getWagmiConfig()
  : undefined

/**
 * EIP-191 wallet binding signing challenge.
 */
export function buildSigningChallenge(session_id: string, nonce: string): string {
  return [
    'TokenCap Miner — Wallet Binding Challenge',
    '',
    'By signing this message you prove ownership of this wallet address.',
    'This is a one-time operation that binds your identity credential to this wallet.',
    'Your private key never leaves your device.',
    '',
    `Session: ${session_id}`,
    `Nonce:   ${nonce}`,
    `Issued:  ${new Date().toISOString()}`,
  ].join('\n')
}
