/**
 * JPMorgan Chase KYC adapter — production
 *
 * Doc2 §I: JPM is the production KYC vendor.
 * $8/verification + $2,000/month platform fee.
 * CONTRACT MUST BE INITIATED THIS WEEK — 4–12 week sales cycle is critical path.
 *
 * JPM returns: Verified | Failed | Restricted + jurisdiction_code
 *
 * Open item (Doc7 §I): Confirm with JPM during contract negotiations:
 * (a) Does JPM retain documents, or does TCM receive and hold them?
 * (b) If JPM retains them, what is TCM's contractual right of access?
 * (c) Does JPM infrastructure qualify as 'Identity Vault' for RTBF and audit?
 */
import type { KYCVendorAdapter, KYCInitiateParams, KYCVerificationResult } from './interface'

export class JPMAdapter implements KYCVendorAdapter {
  private readonly apiUrl: string
  private readonly apiKey: string
  private readonly clientId: string

  constructor() {
    this.apiUrl   = process.env.JPM_KYC_API_URL   ?? ''
    this.apiKey   = process.env.JPM_KYC_API_KEY   ?? ''
    this.clientId = process.env.JPM_KYC_CLIENT_ID ?? ''
  }

  async initiateVerification(_params: KYCInitiateParams): Promise<{ case_id: string }> {
    // TODO: Implement once JPM contract is executed and API docs received
    throw new Error('JPMAdapter — pending contract execution. ETA: 4–12 weeks from contract initiation.')
  }

  async getVerificationStatus(_case_id: string): Promise<KYCVerificationResult> {
    throw new Error('JPMAdapter — pending contract execution.')
  }

  async checkSanctions(_name: string, _jurisdiction: string): Promise<{ blocked: boolean }> {
    // SDN kill switch — Doc2 §II
    // If participant on sanctions list at ANY point post-activation → REVOKE immediately
    throw new Error('JPMAdapter — pending contract execution.')
  }
}
