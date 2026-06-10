/**
 * Mint Service — Gate 4
 *
 * Calls TCTCredential.mintAndActivate() on Polygon PoS via Alchemy SDK.
 * Rev 4: single operation — mint fires at Active, no Pending on-chain.
 * Batch limit: 50 tokens per tx (gas-safety ceiling — Doc6 §VI).
 *
 * Finality tracking:
 * - PROVISIONAL:        0–31 blocks
 * - SOFT_FINAL:         32 blocks
 * - OPERATIONAL_FINAL:  64 blocks
 * - AUDIT_FINAL:        128 blocks (~4.3 min on Polygon PoS)
 *
 * Revenue recognition: ONLY after AUDIT_FINAL (Doc8 §II).
 */

import { createHash, randomBytes } from 'crypto'

// ABI — only the functions we call
const TCT_ABI = [
  'function mintAndActivate(address holder, bytes8 networkId, bytes32 identityBinding, bytes4 jurisdictionCode, uint32 claimsVersion, bytes32 auditRootHash) returns (uint256 tokenId)',
  'event CredentialMinted(uint256 indexed tokenId, address indexed holder, bytes32 identityBinding)',
  'event CredentialActivated(uint256 indexed tokenId)',
]

export interface MintParams {
  holder_address:    string
  identity_binding:  string   // bytes32 hex
  jurisdiction_code: string   // e.g. 'US'
  network_id:        string   // bytes8 hex
  claims_version:    number
}

export interface MintResult {
  token_id:           string
  tx_hash:            string
  block_number:       number
  network_id:         string
  finality_state:     'PROVISIONAL' | 'SOFT_FINAL' | 'OPERATIONAL_FINAL' | 'AUDIT_FINAL'
}

export async function mintAndActivate(params: MintParams): Promise<MintResult> {
  const contractAddress = process.env.TCT_CREDENTIAL_CONTRACT_ADDRESS
  const issuerKey       = process.env.ISSUER_PRIVATE_KEY
  const rpcUrl          = process.env.ALCHEMY_RPC_URL_MUMBAI
    ?? process.env.ALCHEMY_RPC_URL_AMOY
    ?? process.env.ALCHEMY_RPC_URL_POLYGON

  if (!contractAddress) throw new Error('TCT_CREDENTIAL_CONTRACT_ADDRESS not set — deploy contracts first (npm run deploy:amoy in packages/contracts)')
  if (!issuerKey)        throw new Error('ISSUER_PRIVATE_KEY not set')
  if (!rpcUrl)           throw new Error('Alchemy RPC URL not set')

  // Dynamic import — ethers only needed at runtime for minting
  const { ethers } = await import('ethers')

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet   = new ethers.Wallet(issuerKey, provider)
  const contract = new ethers.Contract(contractAddress, TCT_ABI, wallet)

  // Compute audit_root_hash
  const audit_root_hash = '0x' + createHash('sha256')
    .update(`${params.identity_binding}:${params.holder_address}:${Date.now()}`)
    .digest('hex')

  // Encode params for contract call
  const networkIdBytes       = ethers.zeroPadBytes(ethers.toUtf8Bytes(params.network_id.slice(0, 8)), 8)
  const jurisdictionBytes    = ethers.zeroPadBytes(ethers.toUtf8Bytes(params.jurisdiction_code.slice(0, 4).padEnd(4, ' ')), 4)
  const identityBindingBytes = params.identity_binding.startsWith('0x')
    ? params.identity_binding
    : '0x' + params.identity_binding

  // Estimate gas with 30% safety margin
  const gasEstimate = await contract.mintAndActivate.estimateGas(
    params.holder_address,
    networkIdBytes,
    identityBindingBytes,
    jurisdictionBytes,
    params.claims_version,
    audit_root_hash
  )
  const gasLimit = (gasEstimate * 130n) / 100n

  const tx = await contract.mintAndActivate(
    params.holder_address,
    networkIdBytes,
    identityBindingBytes,
    jurisdictionBytes,
    params.claims_version,
    audit_root_hash,
    { gasLimit }
  )

  const receipt = await tx.wait(1) // wait for 1 confirmation before returning

  // Extract token_id from CredentialMinted event
  const mintedEvent = receipt.logs
    .map((log: any) => { try { return contract.interface.parseLog(log) } catch { return null } })
    .find((e: any) => e?.name === 'CredentialMinted')

  const token_id = mintedEvent?.args?.tokenId?.toString()
    ?? receipt.logs[0]?.topics?.[1]
    ?? '0'

  return {
    token_id:       `0x${BigInt(token_id).toString(16).padStart(16, '0')}`,
    tx_hash:        receipt.hash,
    block_number:   receipt.blockNumber,
    network_id:     params.network_id,
    finality_state: 'PROVISIONAL',
  }
}

/**
 * Get current block confirmation count for a tx
 */
export async function getBlockConfirmations(tx_hash: string): Promise<number> {
  const rpcUrl = process.env.ALCHEMY_RPC_URL_MUMBAI
    ?? process.env.ALCHEMY_RPC_URL_AMOY
    ?? process.env.ALCHEMY_RPC_URL_POLYGON ?? ''

  const { ethers } = await import('ethers')
  const provider   = new ethers.JsonRpcProvider(rpcUrl)
  const receipt    = await provider.getTransactionReceipt(tx_hash)
  if (!receipt) return 0
  const current = await provider.getBlockNumber()
  return current - receipt.blockNumber
}

export function getFinalityState(confirmations: number):
  'PROVISIONAL' | 'SOFT_FINAL' | 'OPERATIONAL_FINAL' | 'AUDIT_FINAL' {
  if (confirmations >= 128) return 'AUDIT_FINAL'
  if (confirmations >= 64)  return 'OPERATIONAL_FINAL'
  if (confirmations >= 32)  return 'SOFT_FINAL'
  return 'PROVISIONAL'
}
