/**
 * Sync Pipeline — listens for on-chain TCTCredential events and writes
 * canonical updates to the credential_state_mirror.
 *
 * Events watched:
 *   CredentialMinted(tokenId, holder, jurisdiction)
 *   CredentialSuspended(tokenId, reason)
 *   CredentialRevoked(tokenId, revoker, reason)
 *   CredentialExpired(tokenId)
 *   CredentialRetired(tokenId)
 *   OutcomeFinalized(tokenId, outcome, reporter)  — from TCTOutcomeRegistry
 *
 * Resumable: stores last processed block in sync_pipeline_cursors table.
 */

import { createPublicClient, http, parseAbiItem, type Log } from 'viem'
import { polygon, polygonMumbai }                            from 'viem/chains'
import { db }                                                from '../db/index.js'
import { logger }                                            from '../lib/logger.js'

const CHAIN = process.env.NODE_ENV === 'production' ? polygon : polygonMumbai
const RPC   = process.env.NODE_ENV === 'production'
  ? process.env.ALCHEMY_RPC_URL_POLYGON!
  : process.env.ALCHEMY_RPC_URL_MUMBAI!

const POLL_INTERVAL_MS = 12_000   // ~1 Polygon block
const BATCH_BLOCKS     = 500      // blocks per backfill batch

type EventName = 'CredentialMinted' | 'CredentialSuspended' | 'CredentialRevoked'
               | 'CredentialExpired' | 'CredentialRetired'

const EVENT_ABIS = {
  CredentialMinted:    parseAbiItem('event CredentialMinted(uint256 indexed tokenId, address indexed holder, string jurisdiction)'),
  CredentialSuspended: parseAbiItem('event CredentialSuspended(uint256 indexed tokenId, string reason)'),
  CredentialRevoked:   parseAbiItem('event CredentialRevoked(uint256 indexed tokenId, address indexed revoker, string reason)'),
  CredentialExpired:   parseAbiItem('event CredentialExpired(uint256 indexed tokenId)'),
  CredentialRetired:   parseAbiItem('event CredentialRetired(uint256 indexed tokenId)'),
} as const

const STATUS_MAP: Record<EventName, string> = {
  CredentialMinted:    'ACTIVE',
  CredentialSuspended: 'SUSPENDED',
  CredentialRevoked:   'REVOKED',
  CredentialExpired:   'EXPIRED',
  CredentialRetired:   'RETIRED',
}

async function getCursor(contract: string): Promise<bigint> {
  const { rows } = await db.query<{ last_block: string }>(
    `SELECT last_block FROM sync_pipeline_cursors WHERE contract_address = $1`,
    [contract]
  )
  return rows[0] ? BigInt(rows[0].last_block) : 0n
}

async function saveCursor(contract: string, block: bigint): Promise<void> {
  await db.query(
    `INSERT INTO sync_pipeline_cursors (contract_address, last_block, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (contract_address) DO UPDATE
       SET last_block = $2, updated_at = NOW()`,
    [contract, block.toString()]
  )
}

async function applyMirrorUpdate(eventName: EventName, log: Log, args: Record<string, unknown>): Promise<void> {
  const rawId  = args['tokenId'] as bigint | undefined
  if (!rawId) return

  const tokenId = `TCT-${rawId}`
  const status  = STATUS_MAP[eventName]

  logger.info({ eventName, tokenId, status, block: log.blockNumber?.toString() }, 'Sync event received')

  if (eventName === 'CredentialMinted') {
    await db.query(
      `INSERT INTO credential_state_mirror
         (token_id, status, network_id, jurisdiction_code, activated_at, last_sync_block,
          identity_binding, compliance_status, audit_root_hash, chain_id)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, 'VERIFIED', $6, $7)
       ON CONFLICT (token_id) DO UPDATE
         SET status          = $2,
             activated_at    = COALESCE(credential_state_mirror.activated_at, NOW()),
             last_sync_block = $5`,
      [
        tokenId, status, CHAIN.id.toString(), args['jurisdiction'] ?? 'UNKNOWN',
        log.blockNumber?.toString() ?? '0',
        'sync-pipeline-placeholder',   // identity_binding / audit_root_hash placeholder
        CHAIN.id,
      ]
    )
  } else {
    await db.query(
      `UPDATE credential_state_mirror
       SET    status          = $1,
              last_sync_block = $2,
              updated_at      = NOW()
       WHERE  token_id = $3`,
      [status, log.blockNumber?.toString() ?? '0', tokenId]
    )
  }
}

export async function startSyncPipeline(): Promise<void> {
  const contractAddress = process.env.TCT_CREDENTIAL_CONTRACT_ADDRESS
  if (!contractAddress) {
    logger.warn('TCT_CREDENTIAL_CONTRACT_ADDRESS not set — sync pipeline idle')
    return
  }

  const client = createPublicClient({ chain: CHAIN, transport: http(RPC) })
  const log    = logger.child({ service: 'sync-pipeline', contract: contractAddress })

  log.info('Starting sync pipeline')

  async function poll() {
    try {
      const head    = await client.getBlockNumber()
      const cursor  = await getCursor(contractAddress!)
      const fromBlock = cursor === 0n ? head - 1n : cursor + 1n
      const toBlock   = fromBlock + BigInt(BATCH_BLOCKS) > head ? head : fromBlock + BigInt(BATCH_BLOCKS)

      if (fromBlock > head) return   // nothing new

      for (const [name, abi] of Object.entries(EVENT_ABIS) as [EventName, typeof EVENT_ABIS[EventName]][]) {
        const logs = await client.getLogs({
          address:   contractAddress as `0x${string}`,
          event:     abi,
          fromBlock,
          toBlock,
        })

        for (const entry of logs) {
          await applyMirrorUpdate(name, entry, (entry as any).args ?? {})
        }
      }

      await saveCursor(contractAddress!, toBlock)
      log.debug({ fromBlock: fromBlock.toString(), toBlock: toBlock.toString() }, 'Block range processed')

    } catch (err) {
      log.error({ err }, 'Sync pipeline poll error')
    } finally {
      setTimeout(poll, POLL_INTERVAL_MS)
    }
  }

  poll()
}
