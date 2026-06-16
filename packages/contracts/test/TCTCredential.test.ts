import { expect } from 'chai'
import { ethers } from 'hardhat'
import { TCTCredential } from '../typechain-types'

describe('TCTCredential', () => {
  let credential: TCTCredential
  let deployer: any, issuer: any, holder: any, holder2: any, attacker: any
  let tcmRevoker: any, tcnRevoker: any

  // bytes8: 'polygon ' padded to 8 bytes
  const NETWORK_ID   = ('0x' + Buffer.from('polygon ').toString('hex')) as `0x${string}`
  const BINDING1     = ethers.keccak256(ethers.toUtf8Bytes('identity-1'))
  const BINDING2     = ethers.keccak256(ethers.toUtf8Bytes('identity-2'))
  // bytes4: 'US  ' = 4 bytes
  const JURISDICTION = ('0x' + Buffer.from('US  ').toString('hex')) as `0x${string}`
  const AUDIT_HASH   = ethers.keccak256(ethers.toUtf8Bytes('audit-root'))

  // Helper: returns [core, timestamps]
  async function getCred(tokenId: bigint) {
    return credential.credentials(tokenId)
  }

  async function mint(signer: any, holderAddr: string, binding: string) {
    return credential.connect(signer).mintAndActivate(
      holderAddr, NETWORK_ID, binding, JURISDICTION, 1, AUDIT_HASH
    )
  }

  beforeEach(async () => {
    ;[deployer, issuer, holder, holder2, attacker, tcmRevoker, tcnRevoker] =
      await ethers.getSigners()

    const Factory = await ethers.getContractFactory('TCTCredential')
    credential    = (await Factory.deploy(deployer.address)) as TCTCredential
    await credential.waitForDeployment()

    await credential.grantRole(await credential.ISSUER_ROLE(),          issuer.address)
    await credential.grantRole(await credential.REVOCATION_ROLE_TCM(),  tcmRevoker.address)
    await credential.grantRole(await credential.REVOCATION_ROLE_TCN(),  tcnRevoker.address)
    await credential.grantRole(await credential.PAUSER_ROLE(),          deployer.address)
  })

  // ── Deployment ──────────────────────────────────────────────────────────
  describe('deployment', () => {
    it('grants DEFAULT_ADMIN_ROLE to constructor arg', async () => {
      expect(await credential.hasRole(await credential.DEFAULT_ADMIN_ROLE(), deployer.address)).to.be.true
    })
    it('CREDENTIAL_CLASS_V1 == 1', async () => {
      expect(await credential.CREDENTIAL_CLASS_V1()).to.equal(1n)
    })
  })

  // ── mintAndActivate ─────────────────────────────────────────────────────
  describe('mintAndActivate', () => {
    it('mints at ACTIVE (Rev 4 — no Pending on-chain)', async () => {
      await mint(issuer, holder.address, BINDING1)
      const [core] = await getCred(1n)
      expect(core.status).to.equal(0)           // Status.ACTIVE
      expect(core.complianceStatus).to.equal(0) // ComplianceStatus.VERIFIED
    })

    it('emits CredentialMinted and CredentialActivated', async () => {
      await expect(mint(issuer, holder.address, BINDING1))
        .to.emit(credential, 'CredentialMinted').withArgs(1n, holder.address, BINDING1)
        .and.to.emit(credential, 'CredentialActivated').withArgs(1n)
    })

    it('issuedAt == activatedAt (single-op model)', async () => {
      await mint(issuer, holder.address, BINDING1)
      const [, stamps] = await getCred(1n)
      expect(stamps.issuedAt).to.equal(stamps.activatedAt)
      expect(stamps.issuedAt).to.be.greaterThan(0n)
    })

    it('mints ERC-1155 balance = 1', async () => {
      await mint(issuer, holder.address, BINDING1)
      expect(await credential.balanceOf(holder.address, 1n)).to.equal(1n)
    })

    it('indexes binding -> tokenId', async () => {
      await mint(issuer, holder.address, BINDING1)
      expect(await credential.bindingToTokenId(BINDING1)).to.equal(1n)
    })

    it('assigns incrementing token IDs', async () => {
      await mint(issuer, holder.address,  BINDING1)
      await mint(issuer, holder2.address, BINDING2)
      expect(await credential.bindingToTokenId(BINDING1)).to.equal(1n)
      expect(await credential.bindingToTokenId(BINDING2)).to.equal(2n)
    })

    it('rejects duplicate identity binding', async () => {
      await mint(issuer, holder.address, BINDING1)
      await expect(mint(issuer, holder2.address, BINDING1))
        .to.be.revertedWith('TCT: identity already bound')
    })

    it('blocks non-ISSUER_ROLE', async () => {
      await expect(mint(attacker, holder.address, BINDING1)).to.be.reverted
    })

    it('blocks when paused', async () => {
      await credential.connect(deployer).pause()
      await expect(mint(issuer, holder.address, BINDING1)).to.be.reverted
      await credential.connect(deployer).unpause()
      await expect(mint(issuer, holder.address, BINDING1)).not.to.be.reverted
    })
  })

  // ── Soulbound ──────────────────────────────────────────────────────────
  describe('soulbound — transfer hooks', () => {
    beforeEach(async () => { await mint(issuer, holder.address, BINDING1) })

    it('rejects safeTransferFrom', async () => {
      await expect(
        credential.connect(holder).safeTransferFrom(holder.address, holder2.address, 1n, 1n, '0x')
      ).to.be.revertedWith('TCT: soulbound - transfers disabled')
    })

    it('rejects safeBatchTransferFrom', async () => {
      await expect(
        credential.connect(holder).safeBatchTransferFrom(holder.address, holder2.address, [1n], [1n], '0x')
      ).to.be.revertedWith('TCT: soulbound - transfers disabled')
    })

    it('rejects setApprovalForAll', async () => {
      await expect(
        credential.connect(holder).setApprovalForAll(holder2.address, true)
      ).to.be.revertedWith('TCT: soulbound - approvals disabled')
    })

    it('rejects 20 random-address transfers (representative fuzz)', async () => {
      for (let i = 0; i < 20; i++) {
        const target = ethers.Wallet.createRandom().address
        await expect(
          credential.connect(holder).safeTransferFrom(holder.address, target, 1n, 1n, '0x')
        ).to.be.revertedWith('TCT: soulbound - transfers disabled')
      }
    })
  })

  // ── Suspend / Unsuspend ─────────────────────────────────────────────────
  describe('suspend / unsuspend', () => {
    beforeEach(async () => { await mint(issuer, holder.address, BINDING1) })

    it('TCM revoker: ACTIVE -> SUSPENDED', async () => {
      await credential.connect(tcmRevoker).suspend(1n)
      const [core] = await getCred(1n)
      expect(core.status).to.equal(1)
    })

    it('TCN revoker: ACTIVE -> SUSPENDED', async () => {
      await credential.connect(tcnRevoker).suspend(1n)
      const [core] = await getCred(1n)
      expect(core.status).to.equal(1)
    })

    it('emits CredentialSuspended', async () => {
      await expect(credential.connect(tcmRevoker).suspend(1n))
        .to.emit(credential, 'CredentialSuspended').withArgs(1n)
    })

    it('cannot suspend non-ACTIVE credential', async () => {
      await credential.connect(tcmRevoker).suspend(1n)
      await expect(credential.connect(tcmRevoker).suspend(1n)).to.be.reverted
    })

    it('SUSPENDED -> ACTIVE via unsuspend', async () => {
      await credential.connect(tcmRevoker).suspend(1n)
      await credential.connect(tcmRevoker).unsuspend(1n)
      const [core] = await getCred(1n)
      expect(core.status).to.equal(0)
    })

    it('attacker cannot suspend', async () => {
      await expect(credential.connect(attacker).suspend(1n)).to.be.reverted
    })
  })

  // ── Revoke ──────────────────────────────────────────────────────────────
  describe('revoke', () => {
    beforeEach(async () => { await mint(issuer, holder.address, BINDING1) })

    it('ACTIVE -> REVOKED', async () => {
      await credential.connect(tcmRevoker).revoke(1n)
      const [core] = await getCred(1n)
      expect(core.status).to.equal(2)
    })

    it('SUSPENDED -> REVOKED', async () => {
      await credential.connect(tcmRevoker).suspend(1n)
      await credential.connect(tcmRevoker).revoke(1n)
      const [core] = await getCred(1n)
      expect(core.status).to.equal(2)
    })

    it('token NOT burned — balance stays 1 (audit continuity)', async () => {
      await credential.connect(tcmRevoker).revoke(1n)
      expect(await credential.balanceOf(holder.address, 1n)).to.equal(1n)
    })

    it('emits CredentialRevoked', async () => {
      await expect(credential.connect(tcmRevoker).revoke(1n))
        .to.emit(credential, 'CredentialRevoked').withArgs(1n)
    })

    it('cannot double-revoke', async () => {
      await credential.connect(tcmRevoker).revoke(1n)
      await expect(credential.connect(tcmRevoker).revoke(1n))
        .to.be.revertedWith('TCT: already REVOKED')
    })

    it('attacker cannot revoke', async () => {
      await expect(credential.connect(attacker).revoke(1n)).to.be.reverted
    })
  })

  // ── Retire ──────────────────────────────────────────────────────────────
  describe('retire', () => {
    beforeEach(async () => { await mint(issuer, holder.address, BINDING1) })

    it('ACTIVE -> RETIRED', async () => {
      await credential.connect(issuer).retire(1n)
      const [core] = await getCred(1n)
      expect(core.status).to.equal(4)
    })

    it('emits CredentialRetired', async () => {
      await expect(credential.connect(issuer).retire(1n))
        .to.emit(credential, 'CredentialRetired').withArgs(1n)
    })

    it('cannot retire SUSPENDED credential', async () => {
      await credential.connect(tcmRevoker).suspend(1n)
      await expect(credential.connect(issuer).retire(1n)).to.be.reverted
    })

    it('attacker cannot retire', async () => {
      await expect(credential.connect(attacker).retire(1n)).to.be.reverted
    })
  })

  // ── Pause ───────────────────────────────────────────────────────────────
  describe('pause', () => {
    it('non-PAUSER cannot pause', async () => {
      await expect(credential.connect(attacker).pause()).to.be.reverted
    })
  })

  // ── ERC-165 ─────────────────────────────────────────────────────────────
  describe('supportsInterface', () => {
    it('supports ERC-1155 (0xd9b67a26)', async () => {
      expect(await credential.supportsInterface('0xd9b67a26')).to.be.true
    })
    it('supports AccessControl (0x7965db0b)', async () => {
      expect(await credential.supportsInterface('0x7965db0b')).to.be.true
    })
  })
})
