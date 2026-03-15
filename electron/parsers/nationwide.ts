import Papa from 'papaparse'
import * as crypto from 'crypto'
import { parse, format, isValid } from 'date-fns'
import type { ParsedTransaction } from './types'

function hashNationwide(date: string, desc: string, paidOut: string, paidIn: string, balance: string): string {
  return crypto
    .createHash('sha256')
    .update(`nationwide|${date}|${desc}|${paidOut}|${paidIn}|${balance}`)
    .digest('hex')
    .slice(0, 32)
}

function stripCurrency(val: string): string {
  return val.replace(/[£,\s]/g, '')
}

export function parseNationwide(rawBuffer: Buffer): ParsedTransaction[] {
  // Nationwide uses Latin-1 encoding
  const csvText = rawBuffer.toString('latin1')

  // Split lines to find the header row (starts with "Date","Transaction type")
  const lines = csvText.split(/\r?\n/)
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^"/, '').toLowerCase()
    if (line.startsWith('date')) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    throw new Error('Could not find header row in Nationwide CSV')
  }

  // Re-join from header row onward
  const csvBody = lines.slice(headerIdx).join('\n')

  const result = Papa.parse<Record<string, string>>(csvBody, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().replace(/^"|"$/g, ''),
  })

  const headers = result.meta.fields ?? []
  const hasDate = headers.some((h) => h.toLowerCase() === 'date')
  if (!hasDate) {
    throw new Error('File does not appear to be a Nationwide CSV')
  }

  const descKey = headers.find((h) => /description/i.test(h)) ?? ''
  const paidOutKey = headers.find((h) => /paid out/i.test(h)) ?? ''
  const paidInKey = headers.find((h) => /paid in/i.test(h)) ?? ''
  const balanceKey = headers.find((h) => /balance/i.test(h)) ?? ''

  const transactions: ParsedTransaction[] = []

  for (const row of result.data) {
    const rawDate = (row['Date'] || '').trim().replace(/^"|"$/g, '')
    const description = (row[descKey] || '').trim().replace(/^"|"$/g, '')
    const paidOut = stripCurrency((row[paidOutKey] || '').trim())
    const paidIn = stripCurrency((row[paidInKey] || '').trim())
    const balance = stripCurrency((row[balanceKey] || '').trim())

    if (!rawDate) continue

    // Nationwide date format: "15 Mar 2024"
    let dateObj = parse(rawDate, 'dd MMM yyyy', new Date())
    if (!isValid(dateObj)) {
      dateObj = parse(rawDate, 'd MMM yyyy', new Date())
    }
    if (!isValid(dateObj)) continue

    const dateIso = format(dateObj, 'yyyy-MM-dd')

    let amount = 0
    let originalAmount = 0

    if (paidOut) {
      const n = parseFloat(paidOut)
      if (!isNaN(n)) {
        amount = n          // spending = positive
        originalAmount = n
      }
    } else if (paidIn) {
      const n = parseFloat(paidIn)
      if (!isNaN(n)) {
        amount = -n         // income = negative
        originalAmount = n
      }
    }

    if (amount === 0) continue

    const external_id = hashNationwide(dateIso, description, paidOut, paidIn, balance)

    transactions.push({
      external_id,
      date: dateIso,
      description,
      amount,
      original_amount: originalAmount,
    })
  }

  return transactions
}
