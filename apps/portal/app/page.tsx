import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <SiteNav />
      <Hero />
      <TrustBar />
      <HowItWorks />
      <Features />
      <Pricing />
      <SiteFooter />
    </div>
  )
}

/* ─── Navigation ───────────────────────────────────────────────────────────── */
function SiteNav() {
  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-0 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1A3A5C] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm tracking-tight">TC</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-[#1A3A5C] text-base tracking-tight">TokenCap</span>
            <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Network</span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#how-it-works" className="hover:text-[#1A3A5C] transition-colors">How It Works</a>
          <a href="#features"     className="hover:text-[#1A3A5C] transition-colors">Features</a>
          <a href="#pricing"      className="hover:text-[#1A3A5C] transition-colors">Pricing</a>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link href="/auth/signin" className="text-sm font-medium text-slate-600 hover:text-[#1A3A5C] transition-colors hidden md:block">
            Sign In
          </Link>
          <Link href="/onboarding" className="btn-primary text-xs px-5 py-2.5">
            Apply for Credential
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ─── Hero ──────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0C1B2E] text-white">
      {/* Background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#1A3A5C_0%,_transparent_60%)] opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#0f2540_0%,_transparent_70%)]" />
      <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle, rgba(201,168,76,0.04) 1px, transparent 1px)', backgroundSize: '48px 48px'}} />

      <div className="relative max-w-7xl mx-auto px-6 py-28 md:py-36">
        <div className="max-w-4xl">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 bg-white/8 border border-white/12 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-white/80 tracking-wide">Live on Polygon PoS · Mainnet</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6">
            Your verified credential<br />
            <span className="text-[#C9A84C]">on the 2678 Network.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/65 leading-relaxed max-w-2xl mb-10">
            The TokenCap Token is a compliance-grade, on-chain identity credential.
            Complete a five-step onboarding process — identity verification, payment,
            and wallet binding — and receive your soulbound TCT on Polygon PoS.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/onboarding" className="btn-gold text-base px-8 py-4">
              Apply for Your Credential →
            </Link>
            <Link href="/auth/signin" className="btn-outline-white text-base px-8 py-4">
              Resume Application
            </Link>
          </div>

          {/* Disclaimer — Doc10 §IV non-negotiable */}
          <p className="mt-10 text-xs text-white/30 font-medium">
            TokenCap Token is a credential, not a financial instrument. &nbsp;·&nbsp; Credential issuance is subject to successful identity verification and sanctions screening.
          </p>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="h-16 bg-gradient-to-b from-transparent to-white absolute bottom-0 left-0 right-0" />
    </section>
  )
}

/* ─── Trust bar ─────────────────────────────────────────────────────────────── */
function TrustBar() {
  const items = [
    { icon: '⛓', label: 'Polygon PoS', sub: 'Chain ID 137' },
    { icon: '🪪', label: 'KYC by Persona', sub: 'Identity Verification' },
    { icon: '🔒', label: 'PCI-DSS Payments', sub: 'Stripe Secure Checkout' },
    { icon: '✅', label: '128-Block Finality', sub: 'Audit-Final Confirmation' },
    { icon: '🛡', label: 'SDN Screening', sub: 'Pre-Purchase, Non-Waivable' },
  ]
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-wrap items-center justify-center md:justify-between gap-6">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="font-semibold text-[#1A3A5C] text-xs">{item.label}</p>
                <p className="text-slate-400 text-[11px]">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── How It Works ──────────────────────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      number: '01',
      gate: 'Pre-Gate',
      title: 'Submit Your Details',
      desc: 'Provide your legal name, email, and jurisdiction. An immediate sanctions screening is performed before any payment is collected.',
      detail: 'SDN / OFAC check · Jurisdiction validation',
    },
    {
      number: '02',
      gate: 'Gate 1',
      title: 'Purchase Your Credential',
      desc: 'Complete a one-time $500 USD payment via Stripe. PCI-DSS compliant, secure checkout. Funds held pending KYC completion.',
      detail: 'Stripe Elements · PCI-DSS Level 1',
    },
    {
      number: '03',
      gate: 'Gate 2',
      title: 'Verify Your Identity',
      desc: 'Complete KYC using a government-issued photo ID and biometric selfie. Required by regulation before credential activation.',
      detail: 'Powered by Persona · Gov-issued ID + selfie',
    },
    {
      number: '04',
      gate: 'Gate 3',
      title: 'Bind Your Wallet',
      desc: 'Connect your Ethereum-compatible wallet and sign an EIP-191 challenge to permanently bind it to your verified identity.',
      detail: 'MetaMask · WalletConnect · EIP-191 signing',
    },
    {
      number: '05',
      gate: 'Gate 4',
      title: 'Activate On-Chain',
      desc: 'Your soulbound TCT credential is minted on Polygon PoS. Activation is confirmed at 128 block confirmations (~4 minutes).',
      detail: '128-block Audit Final · Polygon PoS',
    },
  ]

  return (
    <section id="how-it-works" className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-16">
          <p className="section-eyebrow mb-3">The Process</p>
          <h2 className="text-4xl md:text-5xl font-bold text-[#0C1B2E] mb-4">
            Five steps to activation.
          </h2>
          <p className="text-slate-500 text-lg leading-relaxed">
            The entire process takes under 30 minutes. Once activated, your credential
            is permanently on-chain and cannot be transferred or duplicated.
          </p>
        </div>

        <div className="relative">
          {/* Connector line — desktop */}
          <div className="hidden lg:block absolute top-10 left-[5%] right-[5%] h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative flex flex-col">
                {/* Number + gate badge */}
                <div className="flex items-center gap-3 mb-4 lg:flex-col lg:items-start lg:gap-2">
                  <div className="w-10 h-10 rounded-full bg-[#0C1B2E] text-white flex items-center justify-center text-xs font-bold tracking-widest flex-shrink-0">
                    {step.number}
                  </div>
                  <span className="text-[10px] font-bold tracking-widest text-[#C9A84C] uppercase">{step.gate}</span>
                </div>

                <h3 className="font-bold text-[#0C1B2E] text-base mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-3 flex-1">{step.desc}</p>
                <p className="text-[11px] text-slate-400 font-mono border-t border-slate-100 pt-3">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex justify-center">
          <Link href="/onboarding" className="btn-primary px-8 py-4 text-base">
            Begin Your Application →
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─── Features ──────────────────────────────────────────────────────────────── */
function Features() {
  const features = [
    {
      title: 'Soulbound Credential',
      desc: 'Your TCT is ERC-1155 + ERC-5192. Non-transferable, non-duplicable. One wallet. One verified identity. One credential — permanently on-chain.',
      tag: 'ERC-5192 · Soulbound',
    },
    {
      title: 'Compliance-Grade KYC',
      desc: 'Identity verification powered by Persona. Full AML/KYC workflow with biometric liveness checks and document verification.',
      tag: 'Persona · Gov-ID Verified',
    },
    {
      title: 'Pre-Purchase SDN Screening',
      desc: 'Sanctions checks (OFAC SDN list) run before any payment is collected. If a match occurs, the application is blocked — non-waivable.',
      tag: 'OFAC · SDN Fail-Closed',
    },
    {
      title: 'On-Chain Verifiable',
      desc: 'Any counterparty can verify your credential status directly on Polygon PoS via Polygonscan or the TCM Auth API. No intermediary required.',
      tag: 'Polygon PoS · Public Verification',
    },
    {
      title: 'Audit-Final Finality',
      desc: 'Activation is confirmed at 128 block confirmations — approximately 4 minutes on Polygon PoS. Revenue recognition occurs only at Audit Final.',
      tag: '128 Blocks · ~4 Min Finality',
    },
    {
      title: 'Participant Dashboard',
      desc: 'Monitor your credential status, permission tier, network access state, and activity history in real time from your personal portal.',
      tag: 'Real-Time · VIEWER Tier',
    },
  ]

  return (
    <section id="features" className="py-24 px-6 bg-[#F5F7FA]">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-16">
          <p className="section-eyebrow mb-3">What You Receive</p>
          <h2 className="text-4xl md:text-5xl font-bold text-[#0C1B2E] mb-4">
            Built to institutional standards.
          </h2>
          <p className="text-slate-500 text-lg">
            Every component of the TCT credential system is designed for compliance,
            auditability, and permanence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i} className="card p-7 flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div>
                <h3 className="font-bold text-[#0C1B2E] text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
              <div className="mt-auto">
                <span className="inline-block bg-[#0C1B2E]/5 text-[#1A3A5C] text-[11px] font-semibold font-mono px-3 py-1 rounded-full border border-[#1A3A5C]/10">
                  {f.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Pricing ───────────────────────────────────────────────────────────────── */
function Pricing() {
  const includes = [
    'Soulbound TCT credential on Polygon PoS',
    'Compliance-grade KYC (Persona)',
    'SDN / sanctions screening (OFAC)',
    'VIEWER-tier network access',
    'Participant dashboard & activity log',
    'On-chain verifiable credential status',
    '128-block Audit Final confirmation',
    'ERC-1155 + ERC-5192 standard compliance',
  ]

  return (
    <section id="pricing" className="py-24 px-6 bg-[#0C1B2E]">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Left: Copy */}
          <div className="text-white">
            <p className="section-eyebrow mb-4">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              One credential.<br />One price.<br />
              <span className="text-[#C9A84C]">No subscriptions.</span>
            </h2>
            <p className="text-white/60 text-lg leading-relaxed mb-8">
              Your TokenCap Token is a one-time credential purchase. No recurring
              fees, no hidden costs. Once minted, your credential lives on-chain
              permanently at no additional cost.
            </p>
            <Link href="/onboarding" className="btn-gold px-8 py-4 text-base">
              Apply Now →
            </Link>
          </div>

          {/* Right: Pricing card */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-[#1A3A5C] px-8 py-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-1">Credential Class</p>
                  <p className="text-white font-mono text-sm font-bold">0x0001</p>
                </div>
                <span className="bg-[#C9A84C] text-[#0C1B2E] text-[11px] font-bold px-3 py-1 rounded-full">ACTIVE</span>
              </div>
              <div className="mt-4">
                <span className="text-5xl font-bold text-white">$500</span>
                <span className="text-white/50 ml-2">USD · one-time</span>
              </div>
            </div>

            {/* Includes */}
            <div className="px-8 py-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-4">Includes</p>
              <ul className="space-y-3">
                {includes.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-700">
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>

              <Link href="/onboarding" className="btn-primary w-full mt-8 py-4 text-base justify-center">
                Begin Application →
              </Link>

              <p className="text-center text-xs text-slate-400 mt-4 leading-relaxed">
                All applications subject to identity verification and sanctions screening.
                TokenCap Token is a credential, not a financial instrument.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Footer ────────────────────────────────────────────────────────────────── */
function SiteFooter() {
  return (
    <footer className="bg-[#080F1A] text-white">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/8">
          {/* Brand */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#1A3A5C] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">TC</span>
              </div>
              <span className="font-bold text-white text-base">TokenCap Network</span>
            </div>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              Compliance-grade on-chain credentialing infrastructure for the 2678 ecosystem.
              Built on Polygon PoS.
            </p>
            <p className="text-[#C9A84C] text-xs font-semibold">
              TokenCap Token is a credential, not a financial instrument.
            </p>
          </div>

          {/* Portal */}
          <div className="space-y-4">
            <p className="text-white/40 text-xs font-semibold tracking-widest uppercase">Portal</p>
            <ul className="space-y-3 text-sm text-white/60">
              <li><Link href="/onboarding"  className="hover:text-white transition-colors">Apply for Credential</Link></li>
              <li><Link href="/auth/signin" className="hover:text-white transition-colors">Resume Application</Link></li>
              <li><Link href="/dashboard"   className="hover:text-white transition-colors">Participant Dashboard</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <p className="text-white/40 text-xs font-semibold tracking-widest uppercase">Support</p>
            <ul className="space-y-3 text-sm text-white/60">
              <li><a href="mailto:support@2678holdings.com" className="hover:text-white transition-colors">support@2678holdings.com</a></li>
              <li className="font-mono text-white/40 text-xs">Polygon PoS · Chain ID 137</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/25">
          <span>© 2026 2678 Holdings. All rights reserved.</span>
          <span className="font-mono">TCM Protocol v1 · ERC-1155 + ERC-5192</span>
        </div>
      </div>
    </footer>
  )
}
