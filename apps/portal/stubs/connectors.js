/**
 * Minimal wagmi connectors stub — only injected + walletConnect.
 * Prevents webpack from bundling porto, coinbase, safe, base, gemini connectors
 * and their broken ESM sub-dependencies.
 */
'use strict'

// injected comes from @wagmi/core (no broken sub-deps)
const core = require('@wagmi/core')

// walletConnect — load from wagmi's bundled @wagmi/connectors
let walletConnect
try {
  // Find wagmi root then navigate to its bundled connectors
  const wagmiDir = require.resolve('wagmi').replace(/\/dist.*/, '')
  // eslint-disable-next-line
  const wc = require(wagmiDir + '/node_modules/@wagmi/connectors/dist/esm/walletConnect.js')
  walletConnect = wc.walletConnect
} catch (_) {
  walletConnect = function walletConnect() {
    throw new Error('walletConnect connector could not be loaded')
  }
}

// Provide stubs for all named exports the barrel re-exports
// so destructuring from this module never throws
module.exports = {
  injected:      core.injected,
  walletConnect,
  mock:          core.mock,
  coinbaseWallet:function() { throw new Error('CoinbaseWallet not enabled') },
  metaMask:      function() { throw new Error('MetaMask connector not enabled') },
  safe:          function() { throw new Error('Safe connector not enabled') },
  porto:         function() { throw new Error('Porto connector not enabled') },
  baseAccount:   function() { throw new Error('BaseAccount connector not enabled') },
  gemini:        function() { throw new Error('Gemini connector not enabled') },
}
