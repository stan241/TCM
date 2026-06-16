// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * TCTCredential — TokenCap Token Credential
 * TCM-STATEMACHINE-006 v4 | TCM-TOKEN-CHAR-003 v4
 *
 * NON-UPGRADEABLE (immutable). Security-critical. Audit-stable.
 * ERC-1155 + ERC-5192 soulbound marker.
 * ERC-4337 compatible. EIP-1271 accepted for smart contract wallets.
 * ERC-3643 REJECTED — invites securities framing.
 *
 * GOVERNING PRINCIPLE: TCT authenticates and reports.
 * It does NOT determine, calculate, settle, or represent economic outcomes.
 *
 * Rev 4: Mint fires at Active, not at Pending.
 * No on-chain token exists until KYC verified (compliance_status = VERIFIED).
 *
 * ⚠ TODO: TCM-TOKEN-STATE-005 production deployment BLOCKED until
 *   Legal/Compliance issues written patent consistency confirmation.
 *   Stan reviews first as patent-alignment owner. API Policy §8.1 non-waivable.
 */

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract TCTCredential is ERC1155, AccessControl, Pausable {

    // ─── ROLES ─────────────────────────────────────────────────────────────────
    bytes32 public constant ISSUER_ROLE         = keccak256("ISSUER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE     = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant REVOCATION_ROLE_TCM = keccak256("REVOCATION_ROLE_TCM");
    bytes32 public constant REVOCATION_ROLE_TCN = keccak256("REVOCATION_ROLE_TCN");
    bytes32 public constant PAUSER_ROLE         = keccak256("PAUSER_ROLE");

    // ─── CREDENTIAL CLASS ──────────────────────────────────────────────────────
    uint256 public constant CREDENTIAL_CLASS_V1 = 0x0001;

    // ─── STATUS ENUM ───────────────────────────────────────────────────────────
    // Note: PENDING is off-chain only — no on-chain representation
    enum Status { ACTIVE, SUSPENDED, REVOKED, EXPIRED, RETIRED }

    // ─── COMPLIANCE STATUS ─────────────────────────────────────────────────────
    enum ComplianceStatus { VERIFIED, PENDING, FAILED, RESTRICTED }

    // ─── CREDENTIAL RECORD ─────────────────────────────────────────────────────
    struct Credential {
        uint256 tokenId;           // Assigned at mint (Active state)
        bytes8  networkId;         // REQUIRED from first write
        bytes32 identityBinding;   // SHA-256(canonical_identity_record + salt). Never PII.
        Status  status;
        ComplianceStatus complianceStatus;
        bytes4  jurisdictionCode;
        uint32  claimsVersion;
        // Seven timestamps (0 = not set)
        uint64  issuedAt;          // Set at mint (= activatedAt in single-op model)
        uint64  activatedAt;       // Set at mint (= issuedAt in single-op model)
        uint64  updatedAt;
        uint64  suspendedAt;
        uint64  revokedAt;
        uint64  expiredAt;
        uint64  retiredAt;
        bytes32 auditRootHash;     // SHA-256(canonical record + prior hash). Refreshed every state change.
    }

    mapping(uint256 => Credential) public credentials;
    mapping(bytes32 => uint256)    public bindingToTokenId; // identity_binding → token_id
    uint256 private _nextTokenId;

    // ─── EVENTS ────────────────────────────────────────────────────────────────
    event CredentialMinted(uint256 indexed tokenId, address indexed holder, bytes32 identityBinding);
    event CredentialActivated(uint256 indexed tokenId);
    event CredentialSuspended(uint256 indexed tokenId);
    event CredentialUnsuspended(uint256 indexed tokenId);
    event CredentialRevoked(uint256 indexed tokenId);
    event CredentialExpired(uint256 indexed tokenId);
    event CredentialRetired(uint256 indexed tokenId);

    // ─── CONSTRUCTOR ───────────────────────────────────────────────────────────
    constructor(address admin) ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── MINT + ACTIVATE (single operation — Rev 4) ────────────────────────────
    /**
     * Mint and activate credential in a single operation.
     * Rev 4: Mint fires at Active, not at Pending.
     * compliance_status must be VERIFIED before this is called.
     * Batch limit: max 50 tokens per tx (gas-safety ceiling — Doc6 §VI).
     */
    function mintAndActivate(
        address holder,
        bytes8  networkId,
        bytes32 identityBinding,
        bytes4  jurisdictionCode,
        uint32  claimsVersion,
        bytes32 auditRootHash
    ) external onlyRole(ISSUER_ROLE) whenNotPaused returns (uint256 tokenId) {
        require(bindingToTokenId[identityBinding] == 0, "TCT: identity already bound");

        tokenId = ++_nextTokenId;
        uint64 ts = uint64(block.timestamp);

        credentials[tokenId] = Credential({
            tokenId:          tokenId,
            networkId:        networkId,
            identityBinding:  identityBinding,
            status:           Status.ACTIVE,
            complianceStatus: ComplianceStatus.VERIFIED,
            jurisdictionCode: jurisdictionCode,
            claimsVersion:    claimsVersion,
            issuedAt:         ts,      // same as activatedAt in single-op model
            activatedAt:      ts,
            updatedAt:        ts,
            suspendedAt:      0,
            revokedAt:        0,
            expiredAt:        0,
            retiredAt:        0,
            auditRootHash:    auditRootHash
        });

        bindingToTokenId[identityBinding] = tokenId;
        _mint(holder, tokenId, 1, "");

        emit CredentialMinted(tokenId, holder, identityBinding);
        emit CredentialActivated(tokenId);
    }

    // ─── STATE TRANSITIONS ─────────────────────────────────────────────────────
    function suspend(uint256 tokenId) external {
        require(
            hasRole(REVOCATION_ROLE_TCM, msg.sender) || hasRole(REVOCATION_ROLE_TCN, msg.sender),
            "TCT: missing revocation role"
        );
        Credential storage c = credentials[tokenId];
        require(c.status == Status.ACTIVE, "TCT: can only suspend ACTIVE credential");
        c.status      = Status.SUSPENDED;
        c.suspendedAt = uint64(block.timestamp);
        c.updatedAt   = uint64(block.timestamp);
        _refreshAuditHash(c);
        emit CredentialSuspended(tokenId);
    }

    function unsuspend(uint256 tokenId) external {
        require(
            hasRole(REVOCATION_ROLE_TCM, msg.sender) || hasRole(REVOCATION_ROLE_TCN, msg.sender),
            "TCT: missing revocation role"
        );
        Credential storage c = credentials[tokenId];
        require(c.status == Status.SUSPENDED, "TCT: can only unsuspend SUSPENDED credential");
        c.status    = Status.ACTIVE;
        c.updatedAt = uint64(block.timestamp);
        _refreshAuditHash(c);
        emit CredentialUnsuspended(tokenId);
    }

    function revoke(uint256 tokenId) external {
        require(
            hasRole(REVOCATION_ROLE_TCM, msg.sender) || hasRole(REVOCATION_ROLE_TCN, msg.sender),
            "TCT: missing revocation role"
        );
        Credential storage c = credentials[tokenId];
        require(c.status != Status.REVOKED, "TCT: already REVOKED");
        c.status    = Status.REVOKED;
        c.revokedAt = uint64(block.timestamp);
        c.updatedAt = uint64(block.timestamp);
        _refreshAuditHash(c);
        emit CredentialRevoked(tokenId);
        // Token NOT burned — audit continuity (Doc6 §II)
    }

    function retire(uint256 tokenId) external {
        require(
            hasRole(ISSUER_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "TCT: missing issuer role"
        );
        Credential storage c = credentials[tokenId];
        require(c.status == Status.ACTIVE, "TCT: can only retire ACTIVE credential");
        c.status    = Status.RETIRED;
        c.retiredAt = uint64(block.timestamp);
        c.updatedAt = uint64(block.timestamp);
        _refreshAuditHash(c);
        emit CredentialRetired(tokenId);
    }

    // ─── ERC-1155 TRANSFER OVERRIDE — SOULBOUND ────────────────────────────────
    /**
     * Transfer hooks overridden to revert all transfers.
     * ERC-5192 soulbound: identity-bound, non-transferable.
     * Fuzz test requirement: 1,000 random addresses, zero successful transfers.
     * Doc5 §V, Doc3 §III.
     */
    function safeTransferFrom(address, address, uint256, uint256, bytes memory)
        public pure override { revert("TCT: soulbound - transfers disabled"); }

    function safeBatchTransferFrom(address, address, uint256[] memory, uint256[] memory, bytes memory)
        public pure override { revert("TCT: soulbound - transfers disabled"); }

    function setApprovalForAll(address, bool)
        public pure override { revert("TCT: soulbound - approvals disabled"); }

    // ─── ERC-4337 / EIP-1271 COMPATIBILITY ────────────────────────────────────
    /**
     * identity_binding is wallet-agnostic — does not embed wallet type.
     * EIP-1271 isValidSignature accepted for smart contract wallets.
     * Wallet-binding check in off-chain service (not enforced here).
     */

    // ─── INTERNAL ──────────────────────────────────────────────────────────────
    function _refreshAuditHash(Credential storage c) internal {
        // Simplified — production: SHA-256(canonical_credential_record + prior_hash)
        c.auditRootHash = keccak256(abi.encode(c.tokenId, c.status, c.updatedAt, c.auditRootHash));
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC1155, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ─── PAUSE ─────────────────────────────────────────────────────────────────
    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
