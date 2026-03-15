import { useState, useEffect, useCallback } from 'react'
import { Upload, CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react'
import { format } from 'date-fns'
import type { Account, ParseResult, ImportRecord, ParsedTransaction } from '../types'

const BANK_LABELS: Record<string, string> = {
  monzo: 'Monzo',
  amex: 'American Express',
  nationwide: 'Nationwide',
}

interface PreviewState {
  result: ParseResult
  filePath: string
  filename: string
  accountId: number | null
}

export function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [history, setHistory] = useState<ImportRecord[]>([])
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number; uncategorised: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    window.electronAPI.getAccounts().then(setAccounts)
    window.electronAPI.getImportHistory().then(setHistory)
  }, [])

  const handleFiles = useCallback(async (filePaths: string[]) => {
    setError(null)
    setImportResult(null)
    if (filePaths.length === 0) return

    const filePath = filePaths[0]
    const filename = filePath.split(/[\\/]/).pop() ?? filePath
    const result = await window.electronAPI.parseCSVFile(filePath)

    if (result.error) {
      setError(result.error)
      return
    }

    // Find matching account
    const matchedAccount = accounts.find((a) => a.bank_type === result.bankType)
    setPreview({ result, filePath, filename, accountId: matchedAccount?.id ?? null })
  }, [accounts])

  const handleBrowse = async () => {
    const paths = await window.electronAPI.openFileDialog()
    handleFiles(paths)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).map((f) => (f as unknown as { path: string }).path).filter(Boolean)
    if (files.length) handleFiles(files)
  }, [handleFiles])

  const confirmImport = async () => {
    if (!preview || !preview.accountId) return
    setImporting(true)
    try {
      const result = await window.electronAPI.importTransactions({
        accountId: preview.accountId,
        filename: preview.filename,
        transactions: preview.result.transactions,
      })
      setImportResult(result)
      setPreview(null)
      // Refresh history
      const updated = await window.electronAPI.getImportHistory()
      setHistory(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const fmtAmount = (t: ParsedTransaction) =>
    `£${Math.abs(t.amount).toFixed(2)} ${t.amount > 0 ? 'out' : 'in'}`

  return (
    <div className="p-8 w-full">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Import Statements</h1>
      <p className="text-gray-500 text-sm mb-8">Upload CSV files from Monzo, American Express, or Nationwide.</p>

      {/* Drop zone */}
      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={handleBrowse}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
          }`}
        >
          <Upload className="mx-auto mb-3 text-gray-400" size={36} />
          <p className="text-gray-700 font-medium">Drop a CSV file here, or click to browse</p>
          <p className="text-gray-400 text-sm mt-1">Supports Monzo, Amex, and Nationwide formats</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-4 text-red-800 text-sm">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Import success */}
      {importResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mt-4">
          <div className="flex items-center gap-2 text-green-800 font-medium mb-3">
            <CheckCircle size={18} />
            Import complete
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Transactions imported" value={importResult.imported} />
            <Stat label="Duplicates skipped" value={importResult.duplicates} />
            <Stat label="Uncategorised" value={importResult.uncategorised} warn={importResult.uncategorised > 5} />
          </div>
          <button
            onClick={() => { setImportResult(null); setError(null) }}
            className="mt-4 text-sm text-green-700 underline"
          >
            Import another file
          </button>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-white border border-gray-200 rounded-xl mt-4 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{preview.filename}</p>
              <p className="text-sm text-gray-500">
                Detected: <span className="font-medium">{BANK_LABELS[preview.result.bankType]}</span>
                {' · '}{preview.result.transactions.length} transactions found
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Account selector */}
              <select
                value={preview.accountId ?? ''}
                onChange={(e) => setPreview((p) => p ? { ...p, accountId: Number(e.target.value) } : p)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                onClick={() => setPreview(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={!preview.accountId || importing}
                className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {importing ? 'Importing…' : 'Confirm import'}
              </button>
            </div>
          </div>

          {/* Preview table (first 5 rows) */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.result.transactions.slice(0, 5).map((t, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-500">{t.date}</td>
                    <td className="px-4 py-2 text-gray-900">{t.description}</td>
                    <td className={`px-4 py-2 text-right font-medium ${t.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmtAmount(t)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.result.transactions.length > 5 && (
              <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
                …and {preview.result.transactions.length - 5} more rows
              </p>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Import history</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">File</th>
                  <th className="px-4 py-2 text-left">Account</th>
                  <th className="px-4 py-2 text-right">Rows</th>
                  <th className="px-4 py-2 text-right">Duplicates</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {format(new Date(h.imported_at), 'dd MMM yyyy HH:mm')}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1 text-gray-700">
                        <FileText size={12} />
                        {h.filename}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{h.account_name}</td>
                    <td className="px-4 py-2 text-right text-gray-900 font-medium">{h.row_count}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{h.duplicates_skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${warn ? 'text-amber-600' : 'text-green-700'}`}>{value}</p>
      <p className="text-sm text-green-700">{label}</p>
    </div>
  )
}
