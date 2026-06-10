/**
 * Controlled Vocabulary v1.0.0 — TCM v4
 * Source of truth: TCM-COMPLIANCE-002 v4 §VI
 *
 * VERSIONING:
 * - MAJOR bump: new result_type
 * - MINOR bump: new result_subtype
 * - Deprecated values accepted 90 days after bump, then rejected at normalizer
 * - New result_type values must be registered before the project goes live
 */

export const VOCAB_VERSION = '1.0.0' as const

export const RESULT_TYPES = {
  allocation: ['final_settlement', 'correction', 'lister_action'],
  vote:        ['participant_action', 'lister_action', 'final_settlement'],
  milestone:   ['final_settlement', 'correction', 'lister_action'],
  notice:      ['participant_action', 'lister_action', 'compliance_downgrade'],
  exception:   ['sanctions_flag', 'compliance_downgrade', 'contract_breach', 'correction'],
  formation:   ['entity_formed', 'correction'],
  transfer:    ['funds_escrowed', 'funds_released', 'correction'],
  compliance:  ['sanctions_flag', 'compliance_downgrade', 'contract_breach'],
} as const

export type ResultType = keyof typeof RESULT_TYPES
export type ResultSubtype<T extends ResultType> = (typeof RESULT_TYPES)[T][number]

export function isValidResultType(type: string): type is ResultType {
  return type in RESULT_TYPES
}

export function isValidResultSubtype(type: ResultType, subtype: string): boolean {
  return (RESULT_TYPES[type] as readonly string[]).includes(subtype)
}
