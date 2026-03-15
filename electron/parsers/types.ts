export interface ParsedTransaction {
  external_id: string
  date: string          // 'YYYY-MM-DD'
  description: string
  amount: number        // positive = spending, negative = income
  original_amount: number
  monzo_category?: string
}

export type BankType = 'monzo' | 'amex' | 'nationwide'

export interface ParseResult {
  transactions: ParsedTransaction[]
  bankType: BankType
  accountId?: number
  error?: string
}
