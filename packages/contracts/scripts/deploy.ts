/**
 * Deploy TCTCredential + TCTOutcomeRegistry
 *
 * TCTCredential      — immutable, non-upgradeable
 * TCTOutcomeRegistry — UUPS proxy behind timelock (timelock = 0 for dev)
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network amoy
 *   npx hardhat run scripts/deploy.ts --network polygon  ← BLOCKED until legal confirmation
 */

import { ethers, upgrades } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const [deployer] = await ethers.getSigners()
  const network    = await ethers.provider.getNetwork()
  console.log(`Network  : ${network.name} (chainId ${network.chainId})`)
  console.log(`Deployer : ${deployer.address}`)
  console.log(`Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MATIC`)

  if (network.chainId === 137n) {
    console.error('\n⛔  BLOCKED: Polygon mainnet deployment requires written Legal/Compliance patent confirmation (TCM-TOKEN-STATE-005).')
    process.exit(1)
  }

  // ── Deploy TCTCredential (immutable) ─────────────────────────────────────
  console.log('\nDeploying TCTCredential...')
  const TCTCredential = await ethers.getContractFactory('TCTCredential')
  const credential    = await TCTCredential.deploy(deployer.address)
  await credential.waitForDeployment()
  const credentialAddr = await credential.getAddress()
  console.log(`TCTCredential deployed: ${credentialAddr}`)

  const ISSUER_ROLE     = await credential.ISSUER_ROLE()
  const REVOKE_ROLE_TCM = await credential.REVOCATION_ROLE_TCM()
  await credential.grantRole(ISSUER_ROLE,     deployer.address)
  await credential.grantRole(REVOKE_ROLE_TCM, deployer.address)
  console.log(`ISSUER_ROLE + REVOCATION_ROLE_TCM granted to ${deployer.address}`)

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

  const SYNC_ROLE = await registry.SYNC_ROLE()
  await registry.grantRole(SYNC_ROLE, deployer.address)
  console.log(`SYNC_ROLE granted to ${deployer.address}`)

  // ── Write addresses to .env ───────────────────────────────────────────────
  const envPath = path.resolve(__dirname, '../../../.env')
  if (fs.existsSync(envPath)) {
    let env = fs.readFileSync(envPath, 'utf8')
    env = env
      .replace(/TCT_CREDENTIAL_CONTRACT_ADDRESS=.*/,  `TCT_CREDENTIAL_CONTRACT_ADDRESS=${credentialAddr}`)
      .replace(/TCT_OUTCOME_REGISTRY_ADDRESS=.*/,      `TCT_OUTCOME_REGISTRY_ADDRESS=${registryAddr}`)
    fs.writeFileSync(envPath, env)
    console.log('\n✅  Contract addresses written to .env')
  }

  // Write deployment manifest
  const manifest = {
    network:            network.name,
    chainId:            Number(network.chainId),
    deployedAt:         new Date().toISOString(),
    deployer:           deployer.address,
    TCTCredential:      credentialAddr,
    TCTOutcomeRegistry: registryAddr,
  }
  const manifestPath = path.resolve(__dirname, `../deployments/${network.name}.json`)
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`✅  Manifest: ${manifestPath}`)

  console.log('\n=== DEPLOYMENT SUMMARY ===')
  console.log(`TCTCredential      : ${credentialAddr}`)
  console.log(`TCTOutcomeRegistry : ${registryAddr}`)
  console.log(`Network            : ${network.name} (${network.chainId})`)
}

main().catch(err => { console.error(err); process.exit(1) })
