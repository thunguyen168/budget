import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { Search, SlidersHorizontal, X, ChevronUp, ChevronDown, Edit2, Check } from 'lucide-react'
import type { Transaction, Category, Account, TransactionFilters } from '../types'

const BANK_COLOURS: Record<string, string> = {
  monzo: 'bg-coral-100 text-coral-700',
  amex: 'bg-blue-100 text-blue-700',
  nationwide: 'bg-purple-100 text-purple-700',
}

function usePrevMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function TransactionsPage({ initialCategoryId }: { initialCategoryId?: number | null }) {
  const currentMonth = usePrevMonth()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategoryId ? String(initialCategoryId) : '')
  const [accountFilter, setAccountFilter] = useState<string>('')

  // Sort
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Editing
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editCategoryId, setEditCategoryId] = useState<string>('')
  const [editNotes, setEditNotes] = useState<string>('')
  const [editSplit, setEditSplit] = useState<number | null>(null) // null = use account default

  useEffect(() => {
    Promise.all([window.electronAPI.getCategories(), window.electronAPI.getAccounts()]).then(
      ([cats, accs]) => { setCategories(cats); setAccounts(accs) }
    )
  }, [])

  useEffect(() => {
    if (initialCategoryId) setCategoryFilter(String(initialCategoryId))
  }, [initialCategoryId])

  const fetchTransactions = useCallback(() => {
    const filters: TransactionFilters = {}
    if (month) filters.month = month
    if (categoryFilter) filters.category_id = Number(categoryFilter)
    if (accountFilter) filters.account_id = Number(accountFilter)
    if (search) filters.search = search

    setLoading(true)
    window.electronAPI.getTransactions(filters).then((txs) => {
      setTransactions(txs)
      setLoading(false)
    })
  }, [month, categoryFilter, accountFilter, search])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  const startEdit = (t: Transaction) => {
    setEditingId(t.id)
    setEditCategoryId(t.category_id ? String(t.category_id) : '')
    setEditNotes(t.notes ?? '')
    // If the transaction has its own override, use it; otherwise null (= account default)
    const acctShare = t.account_ownership_share ?? 1
    const txShare = t.ownership_share ?? acctShare
    // Only set an override if tx has an explicit non-account value
    // We compare rounded to avoid float weirdness
    setEditSplit(Math.round(txShare * 100) !== Math.round(acctShare * 100) ? txShare : null)
  }

  const saveEdit = async (id: number, acctShare: number) => {
    await window.electronAPI.updateTransaction(id, {
      category_id: editCategoryId ? Number(editCategoryId) : undefined,
      notes: editNotes,
      ownership_share: editSplit,
    })
    setEditingId(null)
    fetchTransactions()
  }

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('desc') }
  }

  const sorted = [...transactions].sort((a, b) => {
    let v = 0
    if (sortBy === 'date') v = a.date.localeCompare(b.date)
    if (sortBy === 'amount') v = (a.adjusted_amount ?? 0) - (b.adjusted_amount ?? 0)
    if (sortBy === 'description') v = a.description.localeCompare(b.description)
    return sortDir === 'asc' ? v : -v
  })

  function SortIcon({ field }: { field: typeof sortBy }) {
    if (sortBy !== field) return null
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
  }

  const fmtAmt = (t: Transaction) => {
    const adj = t.adjusted_amount ?? t.amount
    if (adj < 0) return <span className="text-green-600">+£{Math.abs(adj).toFixed(2)}</span>
    return <span className={adj > 100 ? 'text-red-600' : 'text-gray-900'}>£{adj.toFixed(2)}</span>
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
          <p className="text-gray-500 text-sm mt-0.5">{transactions.length} records</p>
        </div>
        <button
          onClick={() => setShowFilters((f) => !f)}
          className="flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
        >
          <SlidersHorizontal size={14} />
          Filters
        </button>
      </div>

      {/* Filter bar */}
      <div className={`bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3 ${showFilters ? '' : 'hidden'}`}>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Account</label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setMonth(currentMonth); setCategoryFilter(''); setAccountFilter(''); setSearch('') }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <X size={14} /> Reset filters
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search descriptions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-gray-700" onClick={() => toggleSort('date')}>
                  <span className="flex items-center gap-1">Date <SortIcon field="date" /></span>
                </th>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-gray-700" onClick={() => toggleSort('description')}>
                  <span className="flex items-center gap-1">Description <SortIcon field="description" /></span>
                </th>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right cursor-pointer hover:text-gray-700" onClick={() => toggleSort('amount')}>
                  <span className="flex items-center justify-end gap-1">Your share <SortIcon field="amount" /></span>
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No transactions found</td></tr>
              ) : sorted.map((t) => {
                const acctShare = t.account_ownership_share ?? 1
                const effectiveShare = t.ownership_share ?? acctShare
                const hasOverride = Math.round(effectiveShare * 100) !== Math.round(acctShare * 100)

                return (
                  <tr
                    key={t.id}
                    className={`border-t border-gray-100 hover:bg-gray-50 ${editingId === t.id ? 'bg-indigo-50' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                      {format(new Date(t.date), 'd MMM yyyy')}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-gray-900 max-w-xs truncate">{t.description}</div>
                      {t.notes && <div className="text-xs text-gray-400 mt-0.5 truncate">{t.notes}</div>}
                      {t.is_manually_categorised ? (
                        <span className="text-xs text-indigo-400">manually categorised</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        BANK_COLOURS[t.account_name?.toLowerCase() ?? ''] ?? 'bg-gray-100 text-gray-600'
                      }`}>
                        {t.account_name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {editingId === t.id ? (
                        <div className="flex flex-col gap-1">
                          <select
                            value={editCategoryId}
                            onChange={(e) => setEditCategoryId(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                            autoFocus
                          >
                            <option value="">Uncategorised</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Notes…"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                          />
                          {/* Split toggle — only shown when account has a non-100% default */}
                          <SplitToggle
                            acctShare={acctShare}
                            value={editSplit}
                            onChange={setEditSplit}
                          />
                        </div>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ background: t.category_colour ?? '#6b7280' }}
                        >
                          {t.category_name ?? (
                            <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs">
                              Uncategorised
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                      {fmtAmt(t)}
                      {effectiveShare < 1 && (
                        <span className={`text-xs ml-1 ${hasOverride ? 'text-indigo-500 font-semibold' : 'text-gray-400'}`}>
                          ({Math.round(effectiveShare * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editingId === t.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => saveEdit(t.id, acctShare)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(t)}
                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SplitToggle({
  acctShare,
  value,
  onChange,
}: {
  acctShare: number
  value: number | null
  onChange: (v: number | null) => void
}) {
  // The effective share being shown
  const effective = value ?? acctShare

  // Build button options: always include 100% and 50%; if account default is something else, include that too
  const options: { label: string; share: number | null }[] = []

  // "Account default" option (null = use account default)
  options.push({ label: `Default (${Math.round(acctShare * 100)}%)`, share: null })

  // If account default isn't 100%, offer 100%
  if (Math.round(acctShare * 100) !== 100) {
    options.push({ label: '100% (just me)', share: 1 })
  }

  // If account default isn't 50%, offer 50%
  if (Math.round(acctShare * 100) !== 50) {
    options.push({ label: '50/50 split', share: 0.5 })
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">Split</p>
      <div className="flex gap-1 flex-wrap">
        {options.map((opt) => {
          const active = opt.share === null ? value === null : value !== null && Math.round(value * 100) === Math.round(opt.share * 100)

          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.share)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                active
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
