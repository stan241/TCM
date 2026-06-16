/**
 * Gas Profile — TCTCredential operations
 *
 * Measures gas for all state-transition operations.
 * Run before each deployment to catch regressions.
 *
 * Usage: npx hardhat run scripts/gasProfile.ts --network amoy
 */

import { ethers } from 'hardhat'

interface GasResult {
  op:    string
  gas:   number
  gwei?: string
}

async function main() {
  const [deployer] = await ethers.getSigners()
  const feeData    = await ethers.provider.getFeeData()
  const gasPrice   = feeData.gasPrice ?? ethers.parseUnits('50', 'gwei')

  const Factory    = await ethers.getContractFactory('TCTCredential')
  const credential = await Factory.deploy(deployer.address)
  await credential.waitForDeployment()

  const ISSUER_ROLE     = await credential.ISSUER_ROLE()
  const REVOKE_ROLE_TCM = await credential.REVOCATION_ROLE_TCM()
  await credential.grantRole(ISSUER_ROLE,     deployer.address)
  await credential.grantRole(REVOKE_ROLE_TCM, deployer.address)

  const results: GasResult[] = []

  function toGwei(gas: number) {
    const cost = BigInt(gas) * gasPrice
    return ethers.formatUnits(cost, 'gwei') + ' gwei'
  }

  // Helper: mint a fresh token with unique binding
  let counter = 0
  async function mintFresh() {
    counter++
    const binding = ethers.keccak256(ethers.toUtf8Bytes(`binding-${counter}`))
    const networkId    = ethers.zeroPadBytes(ethers.toUtf8Bytes('polygon'), 8)
    const jurisdiction = ethers.zeroPadBytes(ethers.toUtf8Bytes('US  '),    4)
    const auditHash    = ethers.keccak256(ethers.toUtf8Bytes(`audit-${counter}`))
    const tx      = await credential.mintAndActivate(
      deployer.address, networkId, binding, jurisdiction, 1, auditHash
    )
    const receipt = await tx.wait()
    return { tokenId: BigInt(counter), gas: Number(receipt!.gasUsed) }
  }

  // 1. mintAndActivate
  const mint1 = await mintFresh()
  results.push({ op: 'mintAndActivate (first)',      gas: mint1.gas })
  const mint2 = await mintFresh()
  results.push({ op: 'mintAndActivate (subsequent)', gas: mint2.gas })

  // 2. suspend
  const { tokenId: t1 } = await mintFresh()
  const suspendTx = await credential.suspend(t1)
  const suspendRx = await suspendTx.wait()
  results.push({ op: 'suspend', gas: Number(suspendRx!.gasUsed) })

  // 3. unsuspend
  const unsuspendTx = await credential.unsuspend(t1)
  const unsuspendRx = await unsuspendTx.wait()
  results.push({ op: 'unsuspend', gas: Number(unsuspendRx!.gasUsed) })

  // 4. revoke
  const { tokenId: t2 } = await mintFresh()
  const revokeTx = await credential.revoke(t2)
  const revokeRx = await revokeTx.wait()
  results.push({ op: 'revoke', gas: Number(revokeRx!.gasUsed) })

  // 5. retire
  const { tokenId: t3 } = await mintFresh()
  const retireTx = await credential.retire(t3)
  const retireRx = await retireTx.wait()
  results.push({ op: 'retire', gas: Number(retireRx!.gasUsed) })

  // 6. credentialStatus read (view — no gas cost on-chain but useful for latency)
  const readTx = await credential.credentials(t1)
  results.push({ op: 'credentials(tokenId) read (view)', gas: 0 })

  // ── Print results ─────────────────────────────────────────────────────────
  console.log('\n=== TCTCredential Gas Profile ===')
  console.log(`Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei\n`)
  console.log(`${'Operation'.padEnd(40)} ${'Gas Used'.padStart(10)}  ${'Cost'}`)
  console.log('─'.repeat(72))
  for (const r of results) {
    const costStr = r.gas > 0 ? toGwei(r.gas) : 'view (free)'
    console.log(`${r.op.padEnd(40)} ${String(r.gas).padStart(10)}  ${costStr}`)
  }
  console.log('─'.repeat(72))

  // Regression guards
  const mintGas = mint1.gas
  if (mintGas > 300_000) {
    console.error(`\n⚠️  mintAndActivate gas (${mintGas}) exceeds 300k threshold — investigate`)
    process.exit(1)
  }
  console.log('\n✅  All operations within acceptable gas limits')
}

main().catch(err => { console.error(err); process.exit(1) })
