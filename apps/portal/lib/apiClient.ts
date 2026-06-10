/**
 * Portal API client — typed wrappers around backend routes
 *
 * All requests include session_id from NextAuth JWT.
 * Errors surface as typed ApiError — no silent failures.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code:   string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path:   string,
  body?:  unknown
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body:    body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? 'UNKNOWN_ERROR', data.message ?? res.statusText)
  }

  return data as T
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export interface InitiateOnboardingRequest {
  legal_name:   string
  email:        string
  jurisdiction: string
}

export interface InitiateOnboardingResponse {
  session_id:      string
  current_gate:    number
  pre_gate_passed: boolean
  expires_at:      string
  purchase: {
    sku:          string
    amount_cents: number
    currency:     string
    description:  string
  }
}

export const onboarding = {
  /** Pre-gate: POST /api/v1/onboarding/initiate — creates session + fires SDN check */
  initiate: (body: InitiateOnboardingRequest) =>
    apiRequest<InitiateOnboardingResponse>('POST', '/v1/onboarding/initiate', body),

  /** Resume: GET /api/v1/onboarding/session/:id */
  getSession: (session_id: string) =>
    apiRequest<Record<string, unknown>>('GET', `/v1/onboarding/session/${session_id}`),
}

// ── Purchase ──────────────────────────────────────────────────────────────────
export const purchase = {
  confirm: (body: { session_id: string; payment_ref: string }) =>
    apiRequest<{ gate1_passed: boolean }>('POST', '/v1/purchase/confirm', body),
}

// ── KYC ───────────────────────────────────────────────────────────────────────
export const kyc = {
  initiate: (body: { session_id: string }) =>
    apiRequest<{ case_id: string }>('POST', '/v1/kyc/initiate', body),

  getStatus: (case_id: string) =>
    apiRequest<{
      status:           'VERIFIED' | 'FAILED' | 'RESTRICTED' | 'PENDING'
      jurisdiction_code?: string
    }>('GET', `/v1/kyc/status/${case_id}`),
}

// ── Wallet ────────────────────────────────────────────────────────────────────
export const wallet = {
  bind: (body: { session_id: string; wallet_address: string; signature: string; message: string }) =>
    apiRequest<{ gate3_passed: boolean; identity_binding: string }>('POST', '/v1/wallet/bind', body),
}

// ── Token ─────────────────────────────────────────────────────────────────────
export const token = {
  /** Gate 4: mint + activate in a single operation (Rev 4 — mint-at-Active) */
  mintAndActivate: (body: { session_id: string }) =>
    apiRequest<{
      token_id:   string
      tx_hash:    string
      status:     'ACTIVE'
      network:    string
    }>('POST', '/v1/token/mint-and-activate', body),
}

// ── Credentials ───────────────────────────────────────────────────────────────
export const credentials = {
  get: (token_id: string) =>
    apiRequest<{
      token_id:         string
      status:           string
      permission_tier:  string
      jurisdiction_code: string
      activated_at:     string
      network_id:       string
    }>('GET', `/v1/credentials/${token_id}`),

  getActivity: (token_id: string) =>
    apiRequest<Array<{ action: string; event_time: string }>>
      ('GET', `/v1/credentials/${token_id}/activity`),
}
