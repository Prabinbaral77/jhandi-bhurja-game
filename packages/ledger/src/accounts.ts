// Account kinds of the double-entry ledger (docs/architecture.md §5.4).
export const ACCOUNT_TYPES = ['USER', 'ROOM_BANK', 'ROUND_ESCROW', 'SYSTEM'] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const SYSTEM_ACCOUNTS = ['BONUS', 'PLATFORM_FEE', 'ADJUSTMENT'] as const

export type SystemAccount = (typeof SYSTEM_ACCOUNTS)[number]
