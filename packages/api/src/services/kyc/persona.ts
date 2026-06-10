/**
 * Persona KYC adapter — dev/staging only
 *
 * Doc2 §I: Persona sandbox retained for dev/staging only.
 * Zero code change when JPM is live — vendor swap = config change only.
 *
 * Persona API docs: https://docs.withpersona.com/reference
 */
import type { KYCVendorAdapter, KYCInitiateParams, KYCVerificationResult } from './interface'

const PERSONA_BASE = 'https://withpersona.com/api/v1'

export class PersonaAdapter implements KYCVendorAdapter {
  private readonly apiKey:     string
  private readonly templateId: string

  constructor() {
    this.apiKey     = process.env.PERSONA_API_KEY     ?? ''
    this.templateId = process.env.PERSONA_TEMPLATE_ID ?? ''

    if (!this.apiKey)     throw new Error('PERSONA_API_KEY not set')
    if (!this.templateId) throw new Error('PERSONA_TEMPLATE_ID not set')
  }

  private get headers() {
    return {
      'Authorization':   `Bearer ${this.apiKey}`,
      'Content-Type':    'application/json',
      'Persona-Version': '2023-01-05',
      'Key-Inflection':  'camel',
    }
  }

  /**
   * Create a Persona inquiry for the participant.
   * Returns the inquiry ID as case_id.
   * The portal mounts the Persona Embedded Flow with this inquiry ID.
   */
  async initiateVerification(params: KYCInitiateParams): Promise<{ case_id: string }> {
    const res = await fetch(`${PERSONA_BASE}/inquiries`, {
      method:  'POST',
      headers: this.headers,
      body: JSON.stringify({
        data: {
          attributes: {
            inquiryTemplateId: this.templateId,
            referenceId:       params.session_id,  // links back to our session
          },
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Persona initiateVerification failed: ${res.status} ${err}`)
    }

    const data = await res.json() as { data: { id: string } }
    return { case_id: data.data.id }
  }

  /**
   * Poll inquiry status.
   * Persona statuses: created | pending | needs_review | approved | declined | expired | failed
   * Mapped to TCM: VERIFIED | PENDING | FAILED | RESTRICTED
   */
  async getVerificationStatus(case_id: string): Promise<KYCVerificationResult> {
    const res = await fetch(`${PERSONA_BASE}/inquiries/${case_id}`, {
      headers: this.headers,
    })

    if (!res.ok) {
      throw new Error(`Persona getVerificationStatus failed: ${res.status}`)
    }

    const data = await res.json() as {
      data: {
        attributes: {
          status:          string
          referenceId:     string
          fields?: {
            addressCountryCode?: { value: string }
          }
        }
      }
    }

    const attrs = data.data.attributes
    const result = this.mapStatus(attrs.status)
    const jurisdiction_code =
      attrs.fields?.addressCountryCode?.value?.toUpperCase() ?? ''

    return {
      result,
      jurisdiction_code,
      case_id,
      verified_at: result === 'VERIFIED' ? new Date().toISOString() : null,
      failure_reason: result === 'FAILED' || result === 'RESTRICTED'
        ? `Persona status: ${attrs.status}`
        : undefined,
    }
  }

  /**
   * SDN / sanctions check via Persona's AML watchlist screening.
   * Pre-purchase: fires before payment collected. Fail-closed.
   */
  async checkSanctions(name: string, _jurisdiction: string): Promise<{ blocked: boolean }> {
    // Persona watchlist screening — POST /report/watchlist
    const res = await fetch(`${PERSONA_BASE}/report/watchlist`, {
      method:  'POST',
      headers: this.headers,
      body: JSON.stringify({
        data: {
          attributes: {
            nameFirst: name.split(' ')[0] ?? name,
            nameLast:  name.split(' ').slice(1).join(' ') || name,
          },
        },
      }),
    })

    if (!res.ok) {
      // Fail-closed: if SDN check errors, block the participant
      throw new Error(`Persona sanctions check failed: ${res.status}`)
    }

    const data = await res.json() as {
      data: { attributes: { status: string; matchedLists?: string[] } }
    }

    const blocked = data.data.attributes.status === 'hit'
    return { blocked }
  }

  private mapStatus(personaStatus: string): 'VERIFIED' | 'FAILED' | 'RESTRICTED' | 'PENDING' {
    switch (personaStatus) {
      case 'approved':      return 'VERIFIED'
      case 'declined':      return 'FAILED'
      case 'needs_review':  return 'PENDING'
      case 'pending':
      case 'created':       return 'PENDING'
      case 'expired':
      case 'failed':        return 'FAILED'
      default:              return 'PENDING'
    }
  }
}
