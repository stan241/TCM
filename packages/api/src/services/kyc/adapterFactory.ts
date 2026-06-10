/**
 * KYC adapter factory — vendor-agnostic interface
 *
 * Doc2 §I: Vendor swap = config change only. Zero code change.
 * KYC_VENDOR=persona → PersonaAdapter
 * KYC_VENDOR=jpm     → JPMAdapter (production)
 */

import type { KYCVendorAdapter } from './interface'
import { PersonaAdapter } from './persona'
import { JPMAdapter } from './jpm'

let _adapter: KYCVendorAdapter | null = null

export function getKYCAdapter(): KYCVendorAdapter {
  if (_adapter) return _adapter

  const vendor = process.env.KYC_VENDOR ?? 'persona'

  switch (vendor) {
    case 'jpm':
      _adapter = new JPMAdapter()
      break
    case 'persona':
      _adapter = new PersonaAdapter()
      break
    default:
      throw new Error(`Unknown KYC_VENDOR: ${vendor}. Must be 'persona' or 'jpm'.`)
  }

  return _adapter
}
