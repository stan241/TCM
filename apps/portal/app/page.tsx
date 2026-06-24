import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <HowItWorks />
      <WhatYouGet />
      <Pricing />
      <Footer />
    </div>
  )
}

function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-100 px-6 py-4">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-tcm-blue rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">TC</span>
          </div>
          <span className="font-bold text-tcm-blue text-lg">TokenCap</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-tcm-grey">
          <a href="#how-it-works" className="hover:text-tcm-blue transition-colors">How it works</a>
          <a href="#what-you-get"  className="hover:text-tcm-blue transition-colors">What you get</a>
          <a href="#pricing"       className="hover:text-tcm-blue transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/signin"
            className="text-sm text-tcm-blue hover:underline"
          >
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="bg-tcm-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Apply now
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="bg-gradient-to-br from-tcm-blue to-[#0f2540] text-white py-24 px-6">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Network is live on Polygon PoS
        </div>

        <h1 className="text-5xl md:text-6xl font-bold leading-tight">
          Your verified credential<br />
          <span className="text-tcm-gold">for the 2678 network.</span>
        </h1>

        <p className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
          The TokenCap Token is a compliance-grade on-chain credential. Complete a five-step
          onboarding process — identity verification, payment, and wallet binding — to receive
          your soulbound TCT credential on Polygon PoS.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
          <Link
            href="/onboarding"
            className="bg-tcm-gold text-tcm-blue font-bold px-8 py-3.5 rounded-xl text-base hover:opacity-90 transition-opacity"
          >
            Apply for your credential →
          </Link>
          <Link
            href="/auth/signin"
            className="border border-white/30 text-white px-8 py-3.5 rounded-xl text-base hover:bg-white/10 transition-colors"
          >
            Resume application
          </Link>
        </div>

        <p className="text-xs text-white/40 pt-2">
          TokenCap Token is a credential, not a financial instrument.
        </p>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      gate: 'Pre-gate',
      icon: '📋',
      title: 'Submit your details',
      desc: 'Provide your legal name, email, and jurisdiction. An immediate sanctions check is performed before any payment is collected.',
    },
    {
      gate: 'Gate 1',
      icon: '💳',
      title: 'Purchase your credential',
      desc: 'Complete a one-time payment of $500 USD via Stripe to reserve your TCT credential slot. Secure, PCI-compliant.',
    },
    {
      gate: 'Gate 2',
      icon: '🪪',
      title: 'Verify your identity',
      desc: 'Complete a KYC check using a government-issued photo ID and a selfie. Required by law before activation.',
    },
    {
      gate: 'Gate 3',
      icon: '🔐',
      title: 'Bind your wallet',
      desc: 'Connect your Ethereum-compatible wallet and sign a challenge to permanently bind it to your verified identity.',
    },
    {
      gate: 'Gate 4',
      icon: '⛓️',
      title: 'Activate on-chain',
      desc: 'Your soulbound TCT credential is minted on Polygon PoS. It becomes fully active at 128 block confirmations.',
    },
  ]

  return (
    <section id="how-it-works" className="py-20 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-tcm-blue">Five steps to activation</h2>
          <p className="text-tcm-grey mt-3 max-w-xl mx-auto">
            The entire process takes under 30 minutes. Once activated, your credential is
            permanently on-chain and cannot be transferred or duplicated.
          </p>
        </div>

        <div className="relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-8 left-[10%] right-[10%] h-px bg-gray-200 z-0" />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 bg-tcm-light-grey rounded-2xl flex items-center justify-center text-2xl border border-gray-100 bg-white shadow-sm">
                  {step.icon}
                </div>
                <span className="text-xs font-mono text-tcm-gold font-semibold">{step.gate}</span>
                <h3 className="text-sm font-bold text-tcm-blue">{step.title}</h3>
                <p className="text-xs text-tcm-grey leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 bg-tcm-blue text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Start your application →
          </Link>
        </div>
      </div>
    </section>
  )
}

function WhatYouGet() {
  const features = [
    {
      icon: '🔒',
      title: 'Soulbound credential',
      desc: 'Your TCT is ERC-1155 + ERC-5192. It cannot be transferred, sold, or duplicated. One wallet. One identity. One credential.',
    },
    {
      icon: '✅',
      title: 'Compliance-grade KYC',
      desc: 'Identity verification powered by Persona. SDN / sanctions check is performed before payment is collected — non-waivable.',
    },
    {
      icon: '🌐',
      title: 'Network access',
      desc: 'Active credentials unlock VIEWER-tier access to the TokenCap Network on Polygon PoS. Tier upgrades are available post-activation.',
    },
    {
      icon: '🔍',
      title: 'On-chain verifiable',
      desc: 'Any counterparty can verify your credential status directly on-chain via Polygonscan or the TCM Auth API. No intermediary required.',
    },
    {
      icon: '🛡️',
      title: 'Audit-final finality',
      desc: 'Activation confirmed at 128 block confirmations (~4 min on Polygon PoS). Revenue and access rights recognized only at Audit Final.',
    },
    {
      icon: '📊',
      title: 'Participant dashboard',
      desc: 'Monitor your credential status, network access tier, and activity history in real time from your personal dashboard.',
    },
  ]

  return (
    <section id="what-you-get" className="py-20 px-6 bg-tcm-light-grey">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-tcm-blue">What you receive</h2>
          <p className="text-tcm-grey mt-3 max-w-xl mx-auto">
            Your TokenCap Token credential is the key to verified participation in the 2678 ecosystem.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3 shadow-sm">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="font-bold text-tcm-blue">{f.title}</h3>
              <p className="text-sm text-tcm-grey leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="py-20 px-6 bg-white">
      <div className="max-w-lg mx-auto text-center space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-tcm-blue">Simple, one-time pricing</h2>
          <p className="text-tcm-grey mt-3">No subscriptions. No hidden fees. One credential per verified identity.</p>
        </div>

        <div className="border-2 border-tcm-blue rounded-2xl p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-tcm-blue text-white text-xs font-semibold px-3 py-1 rounded-bl-xl">
            Credential Class 0x0001
          </div>

          <div>
            <span className="text-5xl font-bold text-tcm-blue">$500</span>
            <span className="text-tcm-grey ml-2">USD · one-time</span>
          </div>

          <ul className="space-y-3 text-sm text-left">
            {[
              'Soulbound TCT credential on Polygon PoS',
              'Compliance-grade KYC (Persona)',
              'Sanctions screening (SDN check)',
              'VIEWER-tier network access',
              'Participant dashboard',
              'On-chain verifiable status',
              '128-block Audit Final confirmation',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-tcm-grey">
                <span className="text-tcm-green font-bold">✓</span>
                {item}
              </li>
            ))}
          </ul>

          <Link
            href="/onboarding"
            className="block w-full bg-tcm-blue text-white font-bold py-3.5 rounded-xl text-center hover:opacity-90 transition-opacity"
          >
            Apply now →
          </Link>

          <p className="text-xs text-tcm-grey">
            TokenCap Token is a credential, not a financial instrument. All purchases are
            subject to successful identity verification and sanctions screening.
          </p>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-tcm-blue text-white py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">TC</span>
              </div>
              <span className="font-bold">TokenCap Token</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Compliance-grade on-chain credentialing for the 2678 ecosystem.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Onboarding</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><Link href="/onboarding"       className="hover:text-white transition-colors">Apply for credential</Link></li>
              <li><Link href="/auth/signin"       className="hover:text-white transition-colors">Resume application</Link></li>
              <li><Link href="/dashboard"         className="hover:text-white transition-colors">Participant dashboard</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Support</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><a href="mailto:support@2678holdings.com" className="hover:text-white transition-colors">support@2678holdings.com</a></li>
              <li><span>Polygon PoS · Chain ID 137</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/40">
          <span>© 2026 2678 Holdings. All rights reserved.</span>
          <span className="text-tcm-gold font-medium">
            TokenCap Token is a credential, not a financial instrument.
          </span>
        </div>
      </div>
    </footer>
  )
}
