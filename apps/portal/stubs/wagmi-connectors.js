/**
 * Minimal wagmi connectors stub — only exports what TCM portal uses.
 * Avoids the full barrel (wagmi/connectors → @wagmi/connectors → porto, coinbase, safe, base)
 * which pulls in packages with broken ESM internals.
 *
 * TCM only uses: injected (MetaMask) + walletConnect
 */
'use strict'

// Dynamically re-export only the connectors we need
const core       = require('@wagmi/core')
const wc         = require('../wagmi/node_modules/@wagmi/connectors/dist/esm/walletConnect.js')

module.exports = {
  injected:      core.injected,
  walletConnect: wc.walletConnect ?? wc.default?.walletConnect,
}
