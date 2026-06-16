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
 * TODo: TCM-TOKEN-STATE-005 production deployment BLOCKED until
 *   Legal/Compliance issues written patent consistency confirmation.
 *   Stan reviews first as patent-alignment owner. API Policy 8.1 non-waivable.
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

    // ─── ENUMS ─────────────────────────────────────────────────────────────────
    // PENDING is off-chain only — no on-chain representation
    enum Status { ACTIVE, SUSPENDED, REVOKED, EXPIRED, RETIRED }
    enum ComplianceStatus { VERIFIED, PENDING, FAILED, RESTRICTED }

    // ─── CREDENTIAL RECORD ─────────────────────────────────────────────────────
    // Split into two structs to stay within Yul 16-slot stack limit on the
    // public getter. The auto-generated getter for a 15-field struct overflows.
    struct CredentialCore {
        uint256 tokenId;
        bytes8  networkId;
        bytes32 identityBinding;
        Status  status;
        ComplianceStatus complianceStatus;
        bytes4  jurisdictionCode;
        uint32  claimsVersion;
        bytes32 auditRootHash;
    }

    struct CredentialTimestamps {
        uint64 issuedAt;
        uint64 activatedAt;
        uint64 updatedAt;
        uint64 suspendedAt;
        uint64 revokedAt;
        uint64 expiredAt;
        uint64 retiredAt;
    }

    struct Credential {
        CredentialCore       core;
        CredentialTimestamps ts;
    }

    mapping(uint256 => Credential) private _credentials;
    mapping(bytes32 => uint256)    public  bindingToTokenId;
    uint256 private _nextTokenId;

    // ─── PUBLIC GETTERS (split to avoid Yul stack overflow) ───────────────────
    function credentials(uint256 tokenId) external view returns (CredentialCore memory, CredentialTimestamps memory) {
        Credential storage c = _credentials[tokenId];
        return (c.core, c.ts);
    }

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
        uint64 now_ = uint64(block.timestamp);

        CredentialCore storage core = _credentials[tokenId].core;
        core.tokenId          = tokenId;
        core.networkId        = networkId;
        core.identityBinding  = identityBinding;
        core.status           = Status.ACTIVE;
        core.complianceStatus = ComplianceStatus.VERIFIED;
        core.jurisdictionCode = jurisdictionCode;
        core.claimsVersion    = claimsVersion;
        core.auditRootHash    = auditRootHash;

        CredentialTimestamps storage stamps = _credentials[tokenId].ts;
        stamps.issuedAt    = now_;
        stamps.activatedAt = now_;
        stamps.updatedAt   = now_;

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
        Credential storage c = _credentials[tokenId];
        require(c.core.status == Status.ACTIVE, "TCT: can only suspend ACTIVE credential");
        c.core.status   = Status.SUSPENDED;
        c.ts.suspendedAt = uint64(block.timestamp);
        c.ts.updatedAt   = uint64(block.timestamp);
        _refreshAuditHash(c);
        emit CredentialSuspended(tokenId);
    }

    function unsuspend(uint256 tokenId) external {
        require(
            hasRole(REVOCATION_ROLE_TCM, msg.sender) || hasRole(REVOCATION_ROLE_TCN, msg.sender),
            "TCT: missing revocation role"
        );
        Credential storage c = _credentials[tokenId];
        require(c.core.status == Status.SUSPENDED, "TCT: can only unsuspend SUSPENDED credential");
        c.core.status = Status.ACTIVE;
        c.ts.updatedAt = uint64(block.timestamp);
        _refreshAuditHash(c);
        emit CredentialUnsuspended(tokenId);
    }

    function revoke(uint256 tokenId) external {
        require(
            hasRole(REVOCATION_ROLE_TCM, msg.sender) || hasRole(REVOCATION_ROLE_TCN, msg.sender),
            "TCT: missing revocation role"
        );
        Credential storage c = _credentials[tokenId];
        require(c.core.status != Status.REVOKED, "TCT: already REVOKED");
        c.core.status = Status.REVOKED;
        c.ts.revokedAt = uint64(block.timestamp);
        c.ts.updatedAt = uint64(block.timestamp);
        _refreshAuditHash(c);
        emit CredentialRevoked(tokenId);
        // Token NOT burned — audit continuity (Doc6 §II)
    }

    function retire(uint256 tokenId) external {
        require(
            hasRole(ISSUER_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "TCT: missing issuer role"
        );
        Credential storage c = _credentials[tokenId];
        require(c.core.status == Status.ACTIVE, "TCT: can only retire ACTIVE credential");
        c.core.status = Status.RETIRED;
        c.ts.retiredAt = uint64(block.timestamp);
        c.ts.updatedAt = uint64(block.timestamp);
        _refreshAuditHash(c);
        emit CredentialRetired(tokenId);
    }

    // ─── ERC-1155 TRANSFER OVERRIDE — SOULBOUND ───────────────────────────────
    function safeTransferFrom(address, address, uint256, uint256, bytes memory)
        public pure override { revert("TCT: soulbound - transfers disabled"); }

    function safeBatchTransferFrom(address, address, uint256[] memory, uint256[] memory, bytes memory)
        public pure override { revert("TCT: soulbound - transfers disabled"); }

    function setApprovalForAll(address, bool)
        public pure override { revert("TCT: soulbound - approvals disabled"); }

    // ─── INTERNAL ──────────────────────────────────────────────────────────────
    function _refreshAuditHash(Credential storage c) internal {
        c.core.auditRootHash = keccak256(
            abi.encode(c.core.tokenId, c.core.status, c.ts.updatedAt, c.core.auditRootHash)
        );
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
