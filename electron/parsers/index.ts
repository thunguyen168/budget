import * as fs from 'fs'
import { parseMonzo } from './monzo'
import { parseAmex } from './amex'
import { parseNationwide } from './nationwide'
import type { ParseResult, BankType } from './types'

function detectBankType(firstLine: string, headers: string): BankType | null {
  const h = headers.toLowerCase()
  if (h.includes('transaction id') && h.includes('category')) return 'monzo'
  if (h.includes('transaction type') && h.includes('paid out')) return 'nationwide'
  // Amex: very simple 3-column CSV
  if (h.includes('date') && h.includes('description') && h.includes('amount')) return 'amex'
  return null
}

export function parseCSVFile(filePath: string): ParseResult {
  try {
    const buffer = fs.readFileSync(filePath)

    // Try UTF-8 first for header detection
    const text = buffer.toString('utf8')
    const lines = text.split(/\r?\n/)

    // For Nationwide the real header is after metadata rows
    let headerLine = ''
    for (const line of lines.slice(0, 10)) {
      const stripped = line.replace(/"/g, '').toLowerCase()
      if (stripped.startsWith('date') || stripped.startsWith('transaction id')) {
        headerLine = line.toLowerCase()
        break
      }
    }

    const bankType = detectBankType(lines[0] ?? '', headerLine)

    if (!bankType) {
      return { transactions: [], bankType: 'monzo', error: 'Could not detect bank type. Please check the file format.' }
    }

    let transactions
    if (bankType === 'monzo') {
      transactions = parseMonzo(text)
    } else if (bankType === 'amex') {
      transactions = parseAmex(text)
    } else {
      // Nationwide: must pass raw buffer for Latin-1 decoding
      transactions = parseNationwide(buffer)
    }

    return { transactions, bankType }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { transactions: [], bankType: 'monzo', error: msg }
  }
}
