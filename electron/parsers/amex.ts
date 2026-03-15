import Papa from 'papaparse'
import * as crypto from 'crypto'
import { parse, format, isValid } from 'date-fns'
import type { ParsedTransaction } from './types'

function hashAmex(date: string, description: string, amount: string): string {
  return crypto
    .createHash('sha256')
    .update(`amex|${date}|${description}|${amount}`)
    .digest('hex')
    .slice(0, 32)
}

export function parseAmex(csvText: string): ParsedTransaction[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const headers = result.meta.fields ?? []
  // Amex has a 3-column format: Date, Description, Amount
  const hasDate = headers.some((h) => h.toLowerCase().includes('date'))
  const hasDesc = headers.some((h) => h.toLowerCase().includes('description'))
  const hasAmount = headers.some((h) => h.toLowerCase().includes('amount'))

  if (!hasDate || !hasDesc || !hasAmount) {
    throw new Error('File does not appear to be an Amex CSV (expected Date, Description, Amount columns)')
  }

  // Normalise header names regardless of case
  const dateKey = headers.find((h) => h.toLowerCase().includes('date'))!
  const descKey = headers.find((h) => h.toLowerCase().includes('description'))!
  const amountKey = headers.find((h) => h.toLowerCase().includes('amount'))!

  const transactions: ParsedTransaction[] = []

  for (const row of result.data) {
    const rawDate = (row[dateKey] || '').trim()
    const description = (row[descKey] || '').trim()
    const rawAmount = (row[amountKey] || '').trim()

    if (!rawDate || !description) continue

    let dateObj = parse(rawDate, 'dd/MM/yyyy', new Date())
    if (!isValid(dateObj)) {
      dateObj = parse(rawDate, 'MM/dd/yyyy', new Date())
    }
    if (!isValid(dateObj)) continue

    const dateIso = format(dateObj, 'yyyy-MM-dd')

    const rawNum = parseFloat(rawAmount.replace(/[£,]/g, ''))
    if (isNaN(rawNum)) continue
    if (rawNum === 0) continue

    // Amex: positive = spending (already correct). Negative = payment to card.
    const amount = rawNum  // Keep as-is; negative payments will be categorised as Transfer

    const external_id = hashAmex(dateIso, description, rawAmount)

    transactions.push({
      external_id,
      date: dateIso,
      description,
      amount,
      original_amount: rawNum,
    })
  }

  return transactions
}
