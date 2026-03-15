import Papa from 'papaparse'
import { parse, format, isValid } from 'date-fns'
import type { ParsedTransaction } from './types'

const REQUIRED_HEADERS = ['Transaction ID', 'Date', 'Amount']

export function parseMonzo(csvText: string): ParsedTransaction[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const headers = result.meta.fields ?? []
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
  if (missing.length > 0) {
    throw new Error(`Monzo CSV missing columns: ${missing.join(', ')}`)
  }

  const transactions: ParsedTransaction[] = []

  for (const row of result.data) {
    const transactionId = (row['Transaction ID'] || '').trim()
    const rawDate = (row['Date'] || '').trim()
    const name = (row['Name'] || row['Description'] || '').trim()
    const rawAmount = (row['Amount'] || '').trim()
    const monzoCategory = (row['Category'] || '').trim()

    if (!transactionId || !rawDate) continue

    // Parse date: dd/mm/yyyy
    let dateObj = parse(rawDate, 'dd/MM/yyyy', new Date())
    if (!isValid(dateObj)) {
      dateObj = parse(rawDate, 'yyyy-MM-dd', new Date())
    }
    if (!isValid(dateObj)) continue

    const dateIso = format(dateObj, 'yyyy-MM-dd')

    // Amount: negative in Monzo CSV = money out (spending). Flip to positive.
    const rawNum = parseFloat(rawAmount.replace(/[£,]/g, ''))
    if (isNaN(rawNum)) continue

    // Ignore zero-amount rows
    if (rawNum === 0) continue

    const amount = -rawNum // flip: Monzo negative → positive spending

    transactions.push({
      external_id: transactionId,
      date: dateIso,
      description: name || transactionId,
      amount,
      original_amount: rawNum,
      monzo_category: monzoCategory || undefined,
    })
  }

  return transactions
}
