/** @type {import('next').NextConfig} */
const path = require('path')
const fs   = require('fs')

function findNm(pkg) {
  const candidates = [
    path.resolve(__dirname, 'node_modules', pkg),
    path.resolve(__dirname, '../../node_modules', pkg),
  ]
  for (const c of candidates) if (fs.existsSync(c)) return c
  throw new Error(`Cannot find node_modules/${pkg}`)
}

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tcm/shared'],

  webpack(config, { isServer }) {
    // ── Server: never bundle wallet / crypto packages ──────────────────────────
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals)
          ? config.externals
          : [config.externals].filter(Boolean)),
        'wagmi', 'viem', '@wagmi/core', '@wagmi/connectors', 'ethers',
        'cbw-sdk', 'eth-block-tracker', '@coinbase/wallet-sdk',
        '@walletconnect/core', '@walletconnect/sign-client',
        '@safe-global/safe-apps-sdk', '@safe-global/safe-apps-provider',
        'porto', '@base-org/account',
      ]
    }

    const stub          = path.resolve(__dirname, 'stubs/empty.js')
    const connStub      = path.resolve(__dirname, 'stubs/connectors.js')
    const aliases       = {}

    // ── Fix @noble/curves: redirect viem's nested broken copy to root ───────────
    try {
      const viemRoot  = findNm('viem')
      const nobleRoot = findNm('@noble/curves')
      const viemNoble = path.join(viemRoot, 'node_modules/@noble/curves')
      if (fs.existsSync(viemNoble)) aliases[viemNoble] = nobleRoot
    } catch (e) { console.warn('next.config.js:', e.message) }

    // ── Replace the wagmi connectors barrel with our minimal stub ──────────────
    // This is the single source of all broken connector sub-deps (porto, coinbase, safe, base)
    try {
      const wagmiRoot      = findNm('wagmi')
      const connectorsBrl  = path.join(wagmiRoot, 'dist/esm/exports/connectors.js')
      if (fs.existsSync(connectorsBrl)) aliases[connectorsBrl] = connStub
    } catch (e) { console.warn('next.config.js connectors stub:', e.message) }

    // ── Stub upstream packages that break webpack ──────────────────────────────
    const stubs = [
      'cbw-sdk', '@coinbase/wallet-sdk', 'eth-block-tracker',
      '@safe-global/safe-apps-sdk', '@safe-global/safe-apps-provider',
      '@react-native-async-storage/async-storage',
      '@base-org/account', 'porto',
    ]
    for (const s of stubs) aliases[s] = stub

    config.resolve.alias = { ...config.resolve.alias, ...aliases }

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false, net: false, tls: false, path: false, crypto: false,
    }

    return config
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.alchemy.com wss://*.alchemy.com https://*.withpersona.com https://api.stripe.com",
              "frame-src https://js.stripe.com https://*.withpersona.com",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
