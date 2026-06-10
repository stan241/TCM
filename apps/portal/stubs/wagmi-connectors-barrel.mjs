/**
 * Minimal @wagmi/connectors barrel — only the two connectors TCM uses.
 * Replaces the full barrel that pulls in porto, coinbase, safe, base, gemini.
 */
export { injected, mock } from '@wagmi/core'
export { walletConnect }  from '../node_modules/wagmi/node_modules/@wagmi/connectors/dist/esm/walletConnect.js'

// Stub out unused connector names so any re-export from this file doesn't crash
export const coinbaseWallet = undefined
export const metaMask       = undefined
export const safe           = undefined
export const porto          = undefined
export const baseAccount    = undefined
export const gemini         = undefined
