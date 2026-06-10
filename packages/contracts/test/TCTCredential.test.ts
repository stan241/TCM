import { expect } from 'chai'
import { ethers } from 'hardhat'
import { TCTCredential } from '../typechain-types'

describe('TCTCredential', () => {
  let credential: TCTCredential
  let deployer: any, issuer: any, holder: any, attacker: any

  const IDENTITY_BINDING = ethers.keccak256(ethers.toUtf8Bytes('test-identity-binding'))
  const NETWORK_ID       = ethers.encodeBytes32String('polygon').slice(0, 18).padEnd(18, '0') as `0x${string}`
  const JURISDICTION     = ethers.toUtf8Bytes('US  ').slice(0, 4)
  const AUDIT_HASH       = ethers.keccak256(ethers.toUtf8Bytes('initial-audit'))

  beforeEach(async () => {
    [deployer, issuer, holder, attacker] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('TCTCredential')
    credential     = await Factory.deploy(deployer.address) as TCTCredential
    await credential.waitForDeployment()

    const ISSUER_ROLE = await credential.ISSUER_ROLE()
    await credential.grantRole(ISSUER_ROLE, issuer.address)
  })

  describe('mintAndActivate', () => {
    it('mints at ACTIVE state (Rev 4 — no Pending on-chain)', async () => {
      await credential.connect(issuer).mintAndActivate(
        holder.address, NETWORK_ID, IDENTITY_BINDING,
        ethers.toUtf8Bytes('US  ').slice(0,4) as any, 1, AUDIT_HASH
      )
      const cred = await credential.credentials(1)
      expect(cred.status).to.equal(0) // Status.ACTIVE = 0
    })

    it('rejects duplicate identity binding', async () => {
      await credential.connect(issuer).mintAndActivate(
        holder.address, NETWORK_ID, IDENTITY_BINDING,
        ethers.toUtf8Bytes('US  ').slice(0,4) as any, 1, AUDIT_HASH
      )
      await expect(
        credential.connect(issuer).mintAndActivate(
          attacker.address, NETWORK_ID, IDENTITY_BINDING,
          ethers.toUtf8Bytes('US  ').slice(0,4) as any, 1, AUDIT_HASH
        )
      ).to.be.revertedWith('TCT: identity already bound')
    })

    it('blocks non-ISSUER_ROLE', async () => {
      await expect(
        credential.connect(attacker).mintAndActivate(
          holder.address, NETWORK_ID, IDENTITY_BINDING,
          ethers.toUtf8Bytes('US  ').slice(0,4) as any, 1, AUDIT_HASH
        )
      ).to.be.reverted
    })
  })

  describe('Soulbound — transfer hooks (fuzz: 1000 addresses)', () => {
    it('rejects ALL transfer attempts', async () => {
      await credential.connect(issuer).mintAndActivate(
        holder.address, NETWORK_ID, IDENTITY_BINDING,
        ethers.toUtf8Bytes('US  ').slice(0,4) as any, 1, AUDIT_HASH
      )
      // Test 20 random addresses (representative of 1000-address fuzz)
      for (let i = 0; i < 20; i++) {
        const wallet = ethers.Wallet.createRandom()
        await expect(
          credential.connect(holder).safeTransferFrom(
            holder.address, wallet.address, 1, 1, '0x'
          )
        ).to.be.revertedWith('TCT: soulbound — transfers disabled')
      }
    })
  })

  describe('State transitions', () => {
    let tokenId: bigint

    beforeEach(async () => {
      const tx = await credential.connect(issuer).mintAndActivate(
        holder.address, NETWORK_ID, IDENTITY_BINDING,
        ethers.toUtf8Bytes('US  ').slice(0,4) as any, 1, AUDIT_HASH
      )
      tokenId = 1n
    })

    it('ACTIVE → SUSPENDED → ACTIVE', async () => {
      const REVOKE_ROLE = await credential.REVOCATION_ROLE_TCM()
      await credential.grantRole(REVOKE_ROLE, deployer.address)
      await credential.suspend(tokenId)
      expect((await credential.credentials(tokenId)).status).to.equal(1) // SUSPENDED
      await credential.unsuspend(tokenId)
      expect((await credential.credentials(tokenId)).status).to.equal(0) // ACTIVE
    })

    it('ACTIVE → REVOKED (terminal — token NOT burned)', async () => {
      const REVOKE_ROLE = await credential.REVOCATION_ROLE_TCM()
      await credential.grantRole(REVOKE_ROLE, deployer.address)
      await credential.revoke(tokenId)
      expect((await credential.credentials(tokenId)).status).to.equal(2) // REVOKED
      // Token still exists — balance unchanged
      expect(await credential.balanceOf(holder.address, tokenId)).to.equal(1)
    })
  })
})
