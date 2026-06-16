// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * TCTOutcomeRegistry — Outcome Reference Registry
 * TCM-STATEMACHINE-006 v4 | TCM-ARCH-004 v4
 *
 * UUPS proxy behind timelock.
 * Timelock duration: Stan to recommend before contract coding begins (Open item O3).
 * Write role: SYNC_ROLE only — never end users.
 *
 * REPORTER NOT DETERMINER:
 * - Stores references to outcomes determined elsewhere
 * - Never stores determined values (amounts, allocations, percentages)
 * - result_type from controlled vocabulary v1.0.0 only
 * - finalized=true ONLY after Audit Final (128 blocks on Polygon PoS)
 *
 * ⚠ TCM-TOKEN-STATE-005 BLOCKED: production deployment requires written
 *   Legal/Compliance patent consistency confirmation. Non-waivable.
 */

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract TCTOutcomeRegistry is Initializable, UUPSUpgradeable, AccessControlUpgradeable {

    bytes32 public constant SYNC_ROLE          = keccak256("SYNC_ROLE");
    bytes32 public constant UPGRADER_ROLE      = keccak256("UPGRADER_ROLE");

    struct OutcomeReference {
        bytes32 eventId;              // On-chain event ID
        bytes32 eventHash;            // Integrity anchor (SHA-256 of canonical event)
        bytes32 contractId;           // Which TCN contract produced this
        string  resultType;           // From controlled vocabulary v1.0.0
        string  resultSubtype;
        string  offchainAuthorityRef; // Opaque pointer — NEVER the determined value
        bool    finalized;            // true ONLY after Audit Final (128 blocks)
        uint64  effectiveAt;
        uint64  recordedAt;
    }

    // eventId → OutcomeReference
    mapping(bytes32 => OutcomeReference) public outcomes;
    // tokenId → list of eventIds
    mapping(uint256 => bytes32[]) public tokenOutcomes;

    event OutcomeRecorded(bytes32 indexed eventId, uint256 indexed tokenId, string resultType);
    event OutcomeFinalized(bytes32 indexed eventId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address admin) public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * Record an outcome reference.
     * SYNC_ROLE only — called by the sync pipeline adapter, never by end users.
     * resultType must be from controlled vocab v1.0.0.
     * offchainAuthorityRef is an opaque pointer — never store the determined value.
     */
    function recordOutcome(
        uint256 tokenId,
        bytes32 eventId,
        bytes32 eventHash,
        bytes32 contractId,
        string calldata resultType,
        string calldata resultSubtype,
        string calldata offchainAuthorityRef,
        uint64  effectiveAt
    ) external onlyRole(SYNC_ROLE) {
        require(outcomes[eventId].eventId == bytes32(0), "Registry: event already recorded");
        require(bytes(resultType).length > 0, "Registry: resultType required");
        require(bytes(offchainAuthorityRef).length > 0, "Registry: offchainAuthorityRef required");

        outcomes[eventId] = OutcomeReference({
            eventId:              eventId,
            eventHash:            eventHash,
            contractId:           contractId,
            resultType:           resultType,
            resultSubtype:        resultSubtype,
            offchainAuthorityRef: offchainAuthorityRef,
            finalized:            false,  // Always starts unfinalized
            effectiveAt:          effectiveAt,
            recordedAt:           uint64(block.timestamp)
        });

        tokenOutcomes[tokenId].push(eventId);
        emit OutcomeRecorded(eventId, tokenId, resultType);
    }

    /**
     * Mark an outcome as Audit Final.
     * Called by sync pipeline after 128 block confirmations on Polygon PoS.
     * SYNC_ROLE only.
     */
    function finalizeOutcome(bytes32 eventId) external onlyRole(SYNC_ROLE) {
        OutcomeReference storage o = outcomes[eventId];
        require(o.eventId != bytes32(0), "Registry: event not found");
        require(!o.finalized, "Registry: already finalized");
        o.finalized = true;
        emit OutcomeFinalized(eventId);
    }

    // ─── UUPS UPGRADE AUTH ─────────────────────────────────────────────────────
    /**
     * Upgrade is gated by UPGRADER_ROLE + timelock enforced externally.
     * Timelock duration: Open item O3 — Stan to set before contract coding.
     */
    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}
