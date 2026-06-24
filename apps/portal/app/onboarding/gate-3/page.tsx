'use client'

/**
 * Gate 3 — Wallet Binding
 *
 * Doc10 §III Gate 3:
 * - MetaMask (injected) + WalletConnect v2 (mobile)
 * - Display signing challenge in plain language
 * - User signs EIP-191 challenge → POST /api/v1/wallet/bind
 * - Reject wallets already holding an active credential
 * - NEVER ask for private key
 * - identity_binding = SHA-256(kyc_case_id + wallet_address)
 * - Supports EOA (ecrecover) and ERC-4337 smart contract wallets (EIP-1271)
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { GateProgress } from '@/components/gates/GateProgress'
import { wallet as walletApi, ApiError } from '@/lib/apiClient'
import { buildSigningChallenge } from '@/lib/wagmi'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
const DEMO_WALLET = '0xDEMO000000000000000000000000000000000001'

type Step = 'CONNECT' | 'SIGN' | 'BINDING' | 'DONE' | 'ERROR'

export default function Gate3WalletPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [step,      setStep]      = useState<Step>('CONNECT')
  const [error,     setError]     = useState<string | null>(null)
  const [nonce,     setNonce]     = useState('')

  const { address, isConnected } = useAccount()
  const { connect }              = useConnect()
  const { disconnect }           = useDisconnect()
  const { signMessageAsync }     = useSignMessage()

  useEffect(() => {
    const sid = sessionStorage.getItem('tcm_session_id')
    if (!sid) { router.replace('/onboarding'); return }
    setSessionId(sid)
    setNonce(Math.random().toString(36).slice(2, 10))
  }, [router])

  useEffect(() => {
    if (isConnected && step === 'CONNECT') setStep('SIGN')
  }, [isConnected, step])

  async function handleSign() {
    if (!address || !sessionId) return
    setStep('BINDING')
    setError(null)

    try {
      const message   = buildSigningChallenge(sessionId, nonce)
      const signature = await signMessageAsync({ message })

      const res = await walletApi.bind({
        session_id:     sessionId,
        wallet_address: address,
        signature,
        message,
      })

      if (res.gate3_passed) {
        sessionStorage.setItem('tcm_identity_binding', res.identity_binding)
        setStep('DONE')
        setTimeout(() => router.push('/onboarding/gate-4'), 1200)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('This wallet is already associated with an active credential. Please use a different wallet.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Signing failed. Please try again.')
      }
      setStep('SIGN')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-tcm-light-grey">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-md p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-tcm-blue">Connect Your Wallet</h1>
          <p className="text-sm text-tcm-grey mt-1">
            Your credential will be permanently bound to this wallet address.
          </p>
        </div>

        <GateProgress currentGate={3} />

        {error && (
          <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm p-4">{error}</div>
        )}

        {/* Step: Connect */}
        {step === 'CONNECT' && (
          <div className="space-y-3">
            <div className="rounded bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <strong>What does signing mean?</strong> You will sign a one-time challenge to prove
              ownership of this wallet. Your private key never leaves your device.
            </div>

            {DEMO_MODE && (
              <button
                onClick={async () => {
                  setStep('BINDING')
                  const res = await walletApi.bind({
                    session_id:     sessionId!,
                    wallet_address: DEMO_WALLET,
                    signature:      'demo-signature',
                    message:        'demo',
                  })
                  if (res.gate3_passed) {
                    sessionStorage.setItem('tcm_identity_binding', res.identity_binding)
                    setStep('DONE')
                    setTimeout(() => router.push('/onboarding/gate-4'), 1200)
                  }
                }}
                className="w-full bg-tcm-blue text-white rounded-lg py-3 text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2"
              >
                🔐 Use demo wallet (simulated)
              </button>
            )}

            {!DEMO_MODE && (
              <>
                <button
                  onClick={() => connect({ connector: injected() })}
                  className="w-full border-2 border-tcm-blue text-tcm-blue rounded-lg py-3 text-sm font-semibold hover:bg-blue-50 flex items-center justify-center gap-2"
                >
                  🦊 Connect MetaMask
                </button>
                <button
                  onClick={() => connect({ connector: walletConnect({
                    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '',
                    showQrModal: true,
                  } as any) })}
                  className="w-full border rounded-lg py-3 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  📱 WalletConnect (mobile)
                </button>
              </>
            )}
          </div>
        )}

        {/* Step: Sign */}
        {step === 'SIGN' && address && (
          <div className="space-y-4">
            <div className="rounded bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              ✓ Wallet connected: <span className="font-mono">{address.slice(0,6)}…{address.slice(-4)}</span>
            </div>

            <div className="rounded bg-gray-50 border p-4 text-xs font-mono whitespace-pre-wrap text-tcm-grey">
              {buildSigningChallenge(sessionId ?? '…', nonce)}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { disconnect(); setStep('CONNECT') }}
                className="flex-1 border rounded py-2 text-sm text-tcm-grey hover:bg-gray-50"
              >
                Use different wallet
              </button>
              <button
                onClick={handleSign}
                className="flex-1 bg-tcm-blue text-white rounded py-2 text-sm font-semibold hover:opacity-90"
              >
                Sign to confirm
              </button>
            </div>
          </div>
        )}

        {/* Step: Binding */}
        {step === 'BINDING' && (
          <div className="rounded bg-blue-50 border border-blue-200 p-4 flex items-center gap-3 text-sm text-blue-700">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Binding wallet to your credential…
          </div>
        )}

        {/* Step: Done */}
        {step === 'DONE' && (
          <div className="rounded bg-green-50 border border-green-200 p-4 flex items-center gap-3 text-sm text-green-700">
            <span className="text-xl">✓</span>
            Wallet bound. Proceeding to credential activation…
          </div>
        )}

        <p className="text-xs text-tcm-grey">
          One credential per verified identity. Wallet binding is permanent and cannot be changed
          after activation.
        </p>
      </div>
    </main>
  )
}
