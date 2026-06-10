/**
 * Deploy TCTCredential + TCTOutcomeRegistry
 *
 * TCTCredential   — immutable, non-upgradeable
 * TCTOutcomeRegistry — UUPS proxy behind timelock (timelock = 0 for dev)
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network mumbai
 *   npx hardhat run scripts/deploy.ts --network amoy
 *   npx hardhat run scripts/deploy.ts --network polygon  ← BLOCKED until legal confirmation
 */

import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log(`Deploying from: ${deployer.address}`)
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MATIC`)

  // ── Deploy TCTCredential (immutable) ──────────────────────────────────────
  console.log('\nDeploying TCTCredential...')
  const TCTCredential = await ethers.getContractFactory('TCTCredential')
  const credential    = await TCTCredential.deploy(deployer.address)
  await credential.waitForDeployment()
  const credentialAddr = await credential.getAddress()
  console.log(`TCTCredential deployed: ${credentialAddr}`)

  // Grant ISSUER_ROLE to deployer (dev only — prod: use multisig)
  const ISSUER_ROLE = await credential.ISSUER_ROLE()
  await credential.grantRole(ISSUER_ROLE, deployer.address)
  console.log(`ISSUER_ROLE granted to ${deployer.address}`)

  // ── Deploy TCTOutcomeRegistry (UUPS proxy) ────────────────────────────────
  console.log('\nDeploying TCTOutcomeRegistry...')
  const Registry = await ethers.getContractFactory('TCTOutcomeRegistry')
  const registry  = await upgrades.deployProxy(Registry, [deployer.address], {
    initializer: 'initialize',
    kind: 'uups',
  })
  await registry.waitForDeployment()
  const registryAddr = await registry.getAddress()
  console.log(`TCTOutcomeRegistry deployed: ${registryAddr}`)

  // Grant SYNC_ROLE to deployer (dev only)
  const SYNC_ROLE = await registry.SYNC_ROLE()
  await registry.grantRole(SYNC_ROLE, deployer.address)
  console.log(`SYNC_ROLE granted to ${deployer.address}`)

  // ── Write addresses to .env ───────────────────────────────────────────────
  const envPath = path.resolve(__dirname, '../../../.env')
  let envContent = fs.readFileSync(envPath, 'utf8')
  envContent = envContent
    .replace(/TCT_CREDENTIAL_CONTRACT_ADDRESS=.*/,  `TCT_CREDENTIAL_CONTRACT_ADDRESS=${credentialAddr}`)
    .replace(/TCT_OUTCOME_REGISTRY_ADDRESS=.*/,      `TCT_OUTCOME_REGISTRY_ADDRESS=${registryAddr}`)
  fs.writeFileSync(envPath, envContent)
  console.log('\n✅ Contract addresses written to .env')

  console.log('\n=== DEPLOYMENT SUMMARY ===')
  console.log(`TCTCredential   : ${credentialAddr}`)
  console.log(`TCTOutcomeRegistry: ${registryAddr}`)
  console.log(`Network         : ${(await ethers.provider.getNetwork()).name}`)
}

main().catch(err => { console.error(err); process.exit(1) })
