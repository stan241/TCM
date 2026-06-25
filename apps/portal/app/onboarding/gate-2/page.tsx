'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { kyc, ApiError } from '@/lib/apiClient'
import { GateProgress } from '@/components/gates/GateProgress'
import { OnboardingShell } from '@/components/layout/OnboardingShell'
import { PERSONA_POLL_INTERVAL_MS } from '@/lib/persona'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

type KYCStatus = 'IDLE' | 'INITIATING' | 'IN_PROGRESS' | 'VERIFIED' | 'FAILED' | 'RESTRICTED'

export default function Gate2KYCPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [caseId,    setCaseId]    = useState<string | null>(null)
  const [status,    setStatus]    = useState<KYCStatus>('IDLE')
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    const sid = sessionStorage.getItem('tcm_session_id')
    if (!sid) { router.replace('/onboarding'); return }
    setSessionId(sid)
  }, [router])

  useEffect(() => {
    if (!sessionId || status !== 'IDLE') return
    setStatus('INITIATING')
    kyc.initiate({ session_id: sessionId })
      .then(res => { setCaseId(res.case_id); setStatus('IN_PROGRESS') })
      .catch(err => { setError(err instanceof ApiError ? err.message : 'Failed to start verification.'); setStatus('FAILED') })
  }, [sessionId, status])

  const pollStatus = useCallback(async () => {
    if (!caseId || status !== 'IN_PROGRESS') return
    try {
      const res = await kyc.getStatus(caseId)
      if (res.status === 'VERIFIED') { setStatus('VERIFIED'); setTimeout(() => router.push('/onboarding/gate-3'), 1800) }
      else if (res.status === 'FAILED') { setStatus('FAILED'); setError('Identity verification was not completed. Please contact support.') }
      else if (res.status === 'RESTRICTED') { setStatus('RESTRICTED'); setError('We are unable to process this application. Please contact support.') }
    } catch { /* non-fatal polling error */ }
  }, [caseId, status, router])

  useEffect(() => {
    if (status !== 'IN_PROGRESS') return
    const interval = setInterval(pollStatus, PERSONA_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [status, pollStatus])

  return (
    <OnboardingShell wide>
      <GateProgress currentGate={2} />

      {/* Page header */}
      <div className="mt-8 mb-7">
        <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem'}}>
          <div style={{width:'40px', height:'40px', background:'#0C1B2E', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div>
            <p style={{fontSize:'0.6875rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'#C9A84C', marginBottom:'2px'}}>Gate 2 of 4</p>
            <h1 style={{fontSize:'1.5rem', fontWeight:800, color:'#0C1B2E', letterSpacing:'-0.02em', lineHeight:1.1}}>Identity Verification</h1>
          </div>
        </div>
        <p style={{fontSize:'0.875rem', color:'#64748b', lineHeight:1.6}}>
          Federal regulation requires identity verification before a credential can be issued.
          This process is powered by our compliance partner and takes 1–3 minutes.
        </p>
      </div>

      {/* Compliance authority strip */}
      <div style={{display:'flex', alignItems:'center', gap:'1rem', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'0.75rem', padding:'0.875rem 1.25rem', marginBottom:'1.5rem'}}>
        <div style={{width:'32px', height:'32px', background:'#1A3A5C', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:'0.8125rem', fontWeight:600, color:'#0C1B2E'}}>AML/KYC Compliance — Required by Law</p>
          <p style={{fontSize:'0.75rem', color:'#64748b', marginTop:'1px'}}>Pursuant to the Bank Secrecy Act and applicable FinCEN regulations</p>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.6875rem', fontWeight:600, color:'#059669', flexShrink:0}}>
          <span style={{width:'6px', height:'6px', background:'#059669', borderRadius:'50%', display:'inline-block'}} />
          SECURE
        </div>
      </div>

      {/* Status states */}
      {status === 'INITIATING' && <InitiatingState />}
      {status === 'VERIFIED'   && <VerifiedState />}
      {(status === 'FAILED' || status === 'RESTRICTED') && <FailedState error={error} />}

      {/* KYC flow */}
      {status === 'IN_PROGRESS' && caseId && DEMO_MODE  && <DemoKycFlow onComplete={pollStatus} />}
      {status === 'IN_PROGRESS' && caseId && !DEMO_MODE && <PersonaEmbeddedFlow caseId={caseId} onComplete={pollStatus} />}

      {/* Requirements */}
      {(status === 'IDLE' || status === 'INITIATING' || status === 'IN_PROGRESS') && (
        <div style={{marginTop:'1.5rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
          {[
            {icon:'🪪', title:'Government-Issued ID', desc:'Passport, driver\'s license, or national identity card'},
            {icon:'📷', title:'Biometric Selfie',     desc:'Front-facing camera required for liveness check'},
            {icon:'🔒', title:'Encrypted Transmission', desc:'256-bit TLS — your data is never stored unencrypted'},
            {icon:'⚖️',  title:'Legal Compliance',     desc:'Data used only for regulatory identity verification'},
          ].map((item, i) => (
            <div key={i} style={{background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'0.75rem', padding:'0.875rem'}}>
              <div style={{fontSize:'1.25rem', marginBottom:'0.375rem'}}>{item.icon}</div>
              <p style={{fontSize:'0.75rem', fontWeight:600, color:'#0C1B2E', marginBottom:'0.25rem'}}>{item.title}</p>
              <p style={{fontSize:'0.6875rem', color:'#94a3b8', lineHeight:1.4}}>{item.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Legal footer */}
      <div style={{marginTop:'1.5rem', paddingTop:'1.25rem', borderTop:'1px solid #E2E8F0'}}>
        <p style={{fontSize:'0.6875rem', color:'#94a3b8', lineHeight:1.6}}>
          Identity verification is conducted in accordance with applicable Anti-Money Laundering (AML) and
          Know Your Customer (KYC) regulations. Your information is processed securely and retained only as
          required by law. TokenCap Token is a credential, not a financial instrument.
        </p>
      </div>
    </OnboardingShell>
  )
}

function InitiatingState() {
  return (
    <div style={{display:'flex', alignItems:'center', gap:'1rem', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:'0.75rem', padding:'1.25rem'}}>
      <div style={{width:'36px', height:'36px', border:'2px solid #1A3A5C', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0}} />
      <div>
        <p style={{fontWeight:600, color:'#1e3a5f', fontSize:'0.875rem'}}>Initializing secure session…</p>
        <p style={{fontSize:'0.75rem', color:'#3b82f6', marginTop:'2px'}}>Establishing encrypted connection to compliance infrastructure</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function VerifiedState() {
  return (
    <div style={{background:'#ECFDF5', border:'1px solid #6EE7B7', borderRadius:'0.75rem', padding:'1.5rem', textAlign:'center'}}>
      <div style={{width:'56px', height:'56px', background:'#059669', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem'}}>
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <p style={{fontWeight:700, fontSize:'1.125rem', color:'#065f46', marginBottom:'0.375rem'}}>Identity Verified</p>
      <p style={{fontSize:'0.875rem', color:'#059669'}}>Proceeding to wallet binding…</p>
    </div>
  )
}

function FailedState({ error }: { error: string | null }) {
  return (
    <div style={{background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:'0.75rem', padding:'1.25rem'}}>
      <div style={{display:'flex', gap:'0.75rem', alignItems:'flex-start'}}>
        <div style={{width:'36px', height:'36px', background:'#FEE2E2', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p style={{fontWeight:600, color:'#991b1b', fontSize:'0.875rem', marginBottom:'0.25rem'}}>Verification Unsuccessful</p>
          <p style={{fontSize:'0.8125rem', color:'#B91C1C', lineHeight:1.5}}>{error ?? 'An error occurred during verification.'}</p>
          <p style={{fontSize:'0.75rem', color:'#9CA3AF', marginTop:'0.625rem'}}>
            Reference ID: {Math.random().toString(36).slice(2, 10).toUpperCase()} &nbsp;·&nbsp;
            Contact <a href="mailto:support@2678holdings.com" style={{color:'#1A3A5C', fontWeight:600}}>support@2678holdings.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}

function DemoKycFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const steps = [
    { label: 'Document scan',         detail: 'Reading MRZ / barcode data',          pct: 25  },
    { label: 'Biometric liveness',    detail: 'Liveness detection in progress',       pct: 50  },
    { label: 'Identity cross-check',  detail: 'Matching against reference records',   pct: 75  },
    { label: 'Sanctions screening',   detail: 'OFAC SDN list check',                  pct: 90  },
    { label: 'Verification complete', detail: 'All checks passed',                    pct: 100 },
  ]

  useEffect(() => {
    const timers = steps.map((_, i) =>
      setTimeout(() => {
        setStep(i + 1)
        if (i === steps.length - 1) setTimeout(onComplete, 600)
      }, (i + 1) * 1100)
    )
    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  const currentPct = steps[Math.min(step, steps.length - 1)]?.pct ?? 0

  return (
    <div style={{border:'1px solid #E2E8F0', borderRadius:'0.75rem', overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:'#0C1B2E', padding:'1rem 1.25rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:'0.625rem'}}>
          <div style={{width:'8px', height:'8px', background:'#C9A84C', borderRadius:'50%'}} />
          <span style={{fontSize:'0.8125rem', fontWeight:600, color:'#ffffff', letterSpacing:'0.05em'}}>IDENTITY VERIFICATION</span>
        </div>
        <span style={{fontSize:'0.6875rem', color:'rgba(255,255,255,0.4)', fontFamily:'monospace'}}>DEMO MODE</span>
      </div>

      <div style={{padding:'1.5rem', background:'#ffffff'}}>
        {/* Progress bar */}
        <div style={{marginBottom:'1.5rem'}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.5rem'}}>
            <span style={{fontSize:'0.75rem', fontWeight:600, color:'#0C1B2E'}}>Verification Progress</span>
            <span style={{fontSize:'0.75rem', fontWeight:700, color:'#1A3A5C', fontFamily:'monospace'}}>{currentPct}%</span>
          </div>
          <div style={{height:'6px', background:'#E2E8F0', borderRadius:'9999px', overflow:'hidden'}}>
            <div style={{height:'100%', width:`${currentPct}%`, background:'linear-gradient(90deg, #1A3A5C, #C9A84C)', borderRadius:'9999px', transition:'width 0.6s ease'}} />
          </div>
        </div>

        {/* Steps */}
        <div style={{display:'flex', flexDirection:'column', gap:'0.625rem'}}>
          {steps.map((s, i) => {
            const done    = i < step
            const active  = i === step - 1 && step <= steps.length
            const pending = i >= step
            return (
              <div key={i} style={{display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', borderRadius:'0.5rem', background: done ? '#F0FDF4' : active ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${done ? '#BBF7D0' : active ? '#BFDBFE' : '#E2E8F0'}`}}>
                <div style={{width:'24px', height:'24px', borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: done ? '#059669' : active ? '#1A3A5C' : '#E2E8F0'}}>
                  {done
                    ? <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                    : active
                      ? <div style={{width:'8px', height:'8px', border:'1.5px solid white', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite'}} />
                      : <span style={{width:'6px', height:'6px', background:'#94a3b8', borderRadius:'50%', display:'block'}} />
                  }
                </div>
                <div style={{flex:1}}>
                  <p style={{fontSize:'0.8125rem', fontWeight:600, color: done ? '#065f46' : active ? '#1e3a5f' : '#94a3b8'}}>{s.label}</p>
                  <p style={{fontSize:'0.6875rem', color: done ? '#059669' : active ? '#3b82f6' : '#cbd5e1', marginTop:'1px'}}>{s.detail}</p>
                </div>
                {done && <span style={{fontSize:'0.6875rem', fontWeight:700, color:'#059669', letterSpacing:'0.05em'}}>PASS</span>}
              </div>
            )
          })}
        </div>

        <p style={{fontSize:'0.6875rem', color:'#94a3b8', textAlign:'center', marginTop:'1.25rem'}}>
          Simulated for demo purposes · No real document processing occurs
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function PersonaEmbeddedFlow({ caseId, onComplete }: { caseId: string; onComplete: () => void }) {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdn.withpersona.com/dist/persona-v4-latest.js'
    script.async = true
    script.onload = () => {
      const client = new (window as any).Persona.Client({
        inquiryId: caseId, environment: 'sandbox',
        onComplete, onCancel: () => {}, onError: (err: unknown) => console.error('[Persona]', err),
      })
      client.open()
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [caseId, onComplete])

  return (
    <div style={{border:'1px solid #E2E8F0', borderRadius:'0.75rem', padding:'2.5rem', textAlign:'center', background:'#F8FAFC'}}>
      <div style={{width:'48px', height:'48px', border:'2px solid #1A3A5C', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 1rem'}} />
      <p style={{fontWeight:600, color:'#0C1B2E', fontSize:'0.9375rem', marginBottom:'0.375rem'}}>Opening Secure Verification</p>
      <p style={{fontSize:'0.8125rem', color:'#64748b'}}>A secure verification window will appear momentarily.</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
