/**
 * Fuzz: soulbound transfer rejection (Doc6 §III requirement)
 *
 * Generates 1,000 random wallet addresses and verifies that
 * safeTransferFrom reverts for every single one.
 *
 * Requirement: 1,000 random addresses, zero successful transfers.
 *
 * Usage: npx hardhat run scripts/fuzzTransfer.ts --network amoy
 */

import { ethers } from 'hardhat'

async function main() {
  const [deployer] = await ethers.getSigners()

  const Factory    = await ethers.getContractFactory('TCTCredential')
  const credential = await Factory.deploy(deployer.address)
  await credential.waitForDeployment()

  const ISSUER_ROLE = await credential.ISSUER_ROLE()
  await credential.grantRole(ISSUER_ROLE, deployer.address)

  const identityBinding = ethers.keccak256(ethers.toUtf8Bytes('fuzz-identity'))
  const networkId       = ethers.zeroPadBytes(ethers.toUtf8Bytes('polygon'), 8)
  const jurisdiction    = ethers.zeroPadBytes(ethers.toUtf8Bytes('US  '), 4)
  const auditHash       = ethers.keccak256(ethers.toUtf8Bytes('fuzz-audit'))

  await credential.mintAndActivate(
    deployer.address, networkId, identityBinding, jurisdiction, 1, auditHash
  )
  const tokenId = 1n

  console.log(`Fuzz: testing 1,000 transfer attempts against token ${tokenId}...`)

  let passed = 0
  let failed = 0

  for (let i = 0; i < 1000; i++) {
    const target = ethers.Wallet.createRandom().address
    try {
      // Static call — no gas wasted
      await credential.safeTransferFrom.staticCall(
        deployer.address, target, tokenId, 1, '0x'
      )
      // If we reach here, the call succeeded — this is a failure
      console.error(`  FAIL at i=${i}: transfer to ${target} did NOT revert`)
      failed++
    } catch (err: any) {
      if (err.message?.includes('soulbound') || err.message?.includes('revert')) {
        passed++
      } else {
        console.error(`  UNEXPECTED error at i=${i}: ${err.message}`)
        failed++
      }
    }
  }

  console.log(`\nFuzz results: ${passed}/1000 reverted as expected`)
  if (failed > 0) {
    console.error(`FAILED: ${failed} transfers were NOT rejected!`)
    process.exit(1)
  }
  console.log('✅  All 1,000 transfer attempts correctly rejected (soulbound enforced)')
}

main().catch(err => { console.error(err); process.exit(1) })
