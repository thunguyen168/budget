import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Search, SlidersHorizontal, X, ChevronUp, ChevronDown,
  Edit2, ArrowRightLeft, CheckSquare, Tag
} from 'lucide-react'
import type { Transaction, Category, Account, TransactionFilters } from '../types'

// ─── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function usePrevMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── Split toggle (used in the side panel) ───────────────────────────────────
function SplitToggle({
  acctShare,
  value,
  onChange,
}: {
  acctShare: number
  value: number | null
  onChange: (v: number | null) => void
}) {
  const options: { label: string; sub: string; share: number | null }[] = [
    { label: 'Default', sub: `${Math.round(acctShare * 100)}% — account setting`, share: null },
  ]
  if (Math.round(acctShare * 100) !== 100)
    options.push({ label: '100%', sub: 'Just me', share: 1 })
  if (Math.round(acctShare * 100) !== 50)
    options.push({ label: '50%', sub: '50/50 split', share: 0.5 })

  return (
    <div className="flex gap-2">
      {options.map((opt) => {
        const active =
          opt.share === null
            ? value === null
            : value !== null && Math.round(value * 100) === Math.round(opt.share * 100)
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.share)}
            className={`flex-1 text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
              active
                ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <p className="font-medium">{opt.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
          </button>
        )
      })}
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 ${
        checked ? 'bg-indigo-500' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function TransactionsPage({ initialCategoryId }: { initialCategoryId?: number | null }) {
  const currentMonth = usePrevMonth()

  const [transactions, setTransactions]   = useState<Transaction[]>([])
  const [categories, setCategories]       = useState<Category[]>([])
  const [accounts, setAccounts]           = useState<Account[]>([])
  const [loading, setLoading]             = useState(true)
  const [showFilters, setShowFilters]     = useState(false)

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search, setSearch]               = useState('')
  const [month, setMonth]                 = useState(currentMonth)
  const [categoryFilter, setCategoryFilter] = useState<string>(
    initialCategoryId ? String(initialCategoryId) : ''
  )
  const [accountFilter, setAccountFilter] = useState<string>('')
  const debouncedSearch                   = useDebounce(search, 300)

  // ── Sort ─────────────────────────────────────────────────────────────────
  const [sortBy, setSortBy]   = useState<'date' | 'amount' | 'description'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // ── Side panel ───────────────────────────────────────────────────────────
  const [panelTx, setPanelTx]             = useState<Transaction | null>(null)
  const [editCategoryId, setEditCategoryId] = useState<string>('')
  const [editNotes, setEditNotes]         = useState<string>('')
  const [editSplit, setEditSplit]         = useState<number | null>(null)
  const [editIsTransfer, setEditIsTransfer] = useState<boolean>(false)
  const [saving, setSaving]               = useState(false)

  // ── Bulk selection ───────────────────────────────────────────────────────
  const [selected, setSelected]           = useState<Set<number>>(new Set())
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('')
  const [bulkApplying, setBulkApplying]   = useState(false)

  // ── Drag-and-drop ─────────────────────────────────────────────────────
  const [dragTxId, setDragTxId]           = useState<number | null>(null)
  const [dragOverCatId, setDragOverCatId] = useState<number | null>(null)

  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      window.electronAPI.getCategories(),
      window.electronAPI.getAccounts(),
    ]).then(([cats, accs]) => {
      setCategories(cats)
      setAccounts(accs)
    })
  }, [])

  useEffect(() => {
    if (initialCategoryId !== undefined && initialCategoryId !== null)
      setCategoryFilter(String(initialCategoryId))
  }, [initialCategoryId])

  const fetchTransactions = useCallback(() => {
    const filters: TransactionFilters = {}
    if (month)           filters.month       = month
    if (categoryFilter)  filters.category_id = Number(categoryFilter)
    if (accountFilter)   filters.account_id  = Number(accountFilter)
    if (debouncedSearch) filters.search      = debouncedSearch

    setLoading(true)
    window.electronAPI.getTransactions(filters).then((txs) => {
      setTransactions(txs)
      setLoading(false)
    })
  }, [month, categoryFilter, accountFilter, debouncedSearch])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  // ── Panel helpers ─────────────────────────────────────────────────────────
  const openPanel = (t: Transaction) => {
    setPanelTx(t)
    setEditCategoryId(t.category_id ? String(t.category_id) : '')
    setEditNotes(t.notes ?? '')
    const acctShare = t.account_ownership_share ?? 1
    const txShare   = t.ownership_share ?? acctShare
    setEditSplit(
      Math.round(txShare * 100) !== Math.round(acctShare * 100) ? txShare : null
    )
    setEditIsTransfer(t.is_transfer === 1)
  }

  const closePanel = () => setPanelTx(null)

  const savePanel = async () => {
    if (!panelTx) return
    setSaving(true)
    await window.electronAPI.updateTransaction(panelTx.id, {
      category_id:     editCategoryId ? Number(editCategoryId) : undefined,
      notes:           editNotes,
      ownership_share: editSplit,
      is_transfer:     editIsTransfer ? 1 : 0,
    })
    setSaving(false)
    closePanel()
    fetchTransactions()
  }

  // ── Bulk helpers ──────────────────────────────────────────────────────────
  const applyBulk = async () => {
    if (!bulkCategoryId || selected.size === 0) return
    setBulkApplying(true)
    await Promise.all(
      [...selected].map((id) =>
        window.electronAPI.updateTransaction(id, { category_id: Number(bulkCategoryId) })
      )
    )
    setSelected(new Set())
    setBulkCategoryId('')
    setBulkApplying(false)
    fetchTransactions()
  }

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected(selected.size === sorted.length ? new Set() : new Set(sorted.map((t) => t.id)))

  // ── Drag helpers ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, txId: number) => {
    setDragTxId(txId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDropOnCategory = async (catId: number) => {
    if (dragTxId == null) return
    setDragOverCatId(null)
    setDragTxId(null)
    await window.electronAPI.updateTransaction(dragTxId, { category_id: catId })
    fetchTransactions()
  }

  // ── Sort helpers ──────────────────────────────────────────────────────────
  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(field); setSortDir('desc') }
  }

  const sorted = [...transactions].sort((a, b) => {
    let v = 0
    if (sortBy === 'date')        v = a.date.localeCompare(b.date)
    if (sortBy === 'amount')      v = (a.adjusted_amount ?? 0) - (b.adjusted_amount ?? 0)
    if (sortBy === 'description') v = a.description.localeCompare(b.description)
    return sortDir === 'asc' ? v : -v
  })

  function SortIcon({ field }: { field: typeof sortBy }) {
    if (sortBy !== field) return null
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }

  const fmtAmt = (t: Transaction) => {
    const adj = t.adjusted_amount ?? t.amount
    if (adj < 0)
      return <span className="text-emerald-600 font-semibold">+£{Math.abs(adj).toFixed(2)}</span>
    return (
      <span className={`font-semibold ${adj > 100 ? 'text-red-600' : 'text-gray-800'}`}>
        £{adj.toFixed(2)}
      </span>
    )
  }

  const catMap = new Map(categories.map((c) => [c.id, c]))

  // Quick-filter chips — top 8 variable categories with counts
  const catCounts = new Map<number, number>()
  transactions.forEach((t) => {
    if (t.category_id) catCounts.set(t.category_id, (catCounts.get(t.category_id) ?? 0) + 1)
  })
  const chipCategories = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, count]) => ({ cat: catMap.get(id), id, count }))
    .filter((x) => x.cat)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-200 ${panelTx ? 'mr-[22rem]' : ''}`}>
        <div className="flex-1 overflow-y-auto p-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {loading ? 'Loading…' : `${transactions.length} records`}
              </p>
            </div>
            <button
              onClick={() => setShowFilters((f) => !f)}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                showFilters
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal size={13} />
              Filters
            </button>
          </div>

          {/* ── Filter bar ─────────────────────────────────────────────── */}
          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block font-medium">Month</label>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block font-medium">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block font-medium">Account</label>
                  <select
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
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
                    <X size={13} /> Reset all
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Search ─────────────────────────────────────────────────── */}
          <div className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search descriptions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* ── Category chips ──────────────────────────────────────────── */}
          {chipCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => setCategoryFilter('')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  categoryFilter === ''
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                All
              </button>
              {chipCategories.map(({ cat, id, count }) => (
                <button
                  key={id}
                  onClick={() => setCategoryFilter(categoryFilter === String(id) ? '' : String(id))}
                  onDragOver={(e) => { if (dragTxId != null) { e.preventDefault(); setDragOverCatId(id) } }}
                  onDragLeave={() => setDragOverCatId(null)}
                  onDrop={(e) => { e.preventDefault(); handleDropOnCategory(id) }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    dragOverCatId === id
                      ? 'scale-110 shadow-md text-white border-transparent'
                      : categoryFilter === String(id)
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                  style={
                    dragOverCatId === id || categoryFilter === String(id)
                      ? { background: cat!.colour, borderColor: cat!.colour }
                      : {}
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: dragOverCatId === id || categoryFilter === String(id) ? 'white' : cat!.colour }}
                  />
                  {cat!.name}
                  <span className={`${dragOverCatId === id || categoryFilter === String(id) ? 'opacity-70' : 'text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              ))}
              {dragTxId != null && (
                <span className="inline-flex items-center px-2.5 py-1 text-xs text-indigo-500 font-medium animate-pulse">
                  Drop on a category to assign ↑
                </span>
              )}
            </div>
          )}

          {/* ── Bulk bar ────────────────────────────────────────────────── */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 mb-4">
              <CheckSquare size={14} className="text-indigo-600 flex-shrink-0" />
              <span className="text-sm text-indigo-700 font-medium">
                {selected.size} selected
              </span>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <Tag size={13} className="text-indigo-500" />
                <select
                  value={bulkCategoryId}
                  onChange={(e) => setBulkCategoryId(e.target.value)}
                  className="text-sm border border-indigo-300 rounded-lg px-3 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">Assign category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={applyBulk}
                  disabled={!bulkCategoryId || bulkApplying}
                  className="bg-indigo-600 text-white text-sm px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-40 font-medium"
                >
                  {bulkApplying ? 'Applying…' : 'Apply'}
                </button>
                <button
                  onClick={() => { setSelected(new Set()); setBulkCategoryId('') }}
                  className="text-sm text-indigo-500 hover:text-indigo-700"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* ── Table ───────────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === sorted.length && sorted.length > 0}
                        onChange={toggleAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => toggleSort('date')}
                    >
                      <span className="flex items-center gap-1">Date <SortIcon field="date" /></span>
                    </th>
                    <th
                      className="px-4 py-3 text-left cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => toggleSort('description')}
                    >
                      <span className="flex items-center gap-1">Description <SortIcon field="description" /></span>
                    </th>
                    <th className="px-4 py-3 text-left">Account</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => toggleSort('amount')}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Your share <SortIcon field="amount" />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-right w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                          Loading transactions…
                        </div>
                      </td>
                    </tr>
                  ) : sorted.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                        No transactions match your filters
                      </td>
                    </tr>
                  ) : (
                    sorted.map((t) => {
                      const acctShare    = t.account_ownership_share ?? 1
                      const effectiveShare = t.ownership_share ?? acctShare
                      const hasOverride  = Math.round(effectiveShare * 100) !== Math.round(acctShare * 100)
                      const isActive     = panelTx?.id === t.id
                      const isChecked    = selected.has(t.id)
                      const cat          = t.category_id ? catMap.get(t.category_id) : undefined

                      return (
                        <tr
                          key={t.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, t.id)}
                          onDragEnd={() => { setDragTxId(null); setDragOverCatId(null) }}
                          className={`border-t border-gray-100 transition-colors cursor-grab active:cursor-grabbing ${
                            dragTxId === t.id
                              ? 'opacity-50 bg-indigo-50'
                              : isActive
                              ? 'bg-indigo-50'
                              : isChecked
                              ? 'bg-blue-50/60'
                              : 'hover:bg-gray-50/80'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelect(t.id)}
                              className="rounded border-gray-300"
                            />
                          </td>

                          {/* Date */}
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                            {format(new Date(t.date), 'd MMM yyyy')}
                          </td>

                          {/* Description */}
                          <td className="px-4 py-2.5 max-w-[220px]">
                            <div className="text-gray-900 truncate font-medium">{t.description}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {t.is_transfer === 1 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full font-medium">
                                  <ArrowRightLeft size={9} /> transfer
                                </span>
                              )}
                              {t.is_manually_categorised === 1 && (
                                <span className="text-[10px] text-indigo-400 font-medium">edited</span>
                              )}
                              {t.notes && (
                                <span className="text-[10px] text-gray-400 truncate max-w-[140px]">{t.notes}</span>
                              )}
                            </div>
                          </td>

                          {/* Account */}
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                              {t.account_name}
                            </span>
                          </td>

                          {/* Category */}
                          <td className="px-4 py-2.5">
                            {cat ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                                style={{ background: cat.colour }}
                              >
                                {cat.name}
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                Uncategorised
                              </span>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {fmtAmt(t)}
                            {effectiveShare < 1 && (
                              <span className={`text-[10px] ml-1 ${hasOverride ? 'text-indigo-500 font-semibold' : 'text-gray-400'}`}>
                                ({Math.round(effectiveShare * 100)}%)
                              </span>
                            )}
                          </td>

                          {/* Edit */}
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => (isActive ? closePanel() : openPanel(t))}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isActive
                                  ? 'text-indigo-600 bg-indigo-100'
                                  : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                              title="Edit transaction"
                            >
                              <Edit2 size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Side panel ───────────────────────────────────────────────────── */}
      {panelTx && (
        <div className="fixed right-0 top-0 h-full w-[22rem] bg-white border-l border-gray-200 shadow-2xl z-30 flex flex-col">

          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-900">Edit transaction</h2>
            <button
              onClick={closePanel}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Summary card */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
              <p className="text-sm font-semibold text-gray-900 leading-snug mb-0.5 truncate">
                {panelTx.description}
              </p>
              <p className="text-xs text-gray-500">
                {format(new Date(panelTx.date), 'd MMMM yyyy')} · {panelTx.account_name}
              </p>
              <p className="text-2xl font-bold mt-2.5">
                {(panelTx.adjusted_amount ?? panelTx.amount) < 0 ? (
                  <span className="text-emerald-600">
                    +£{Math.abs(panelTx.adjusted_amount ?? panelTx.amount).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-gray-900">
                    £{(panelTx.adjusted_amount ?? panelTx.amount).toFixed(2)}
                  </span>
                )}
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Category
              </label>
              <select
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {/* Preview chip */}
              {editCategoryId && (() => {
                const cat = catMap.get(Number(editCategoryId))
                return cat ? (
                  <div className="mt-2">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ background: cat.colour }}
                    >
                      {cat.name}
                    </span>
                  </div>
                ) : null
              })()}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Notes
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add a note…"
                rows={3}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Split */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Your share
              </label>
              <SplitToggle
                acctShare={panelTx.account_ownership_share ?? 1}
                value={editSplit}
                onChange={setEditSplit}
              />
            </div>

            {/* Transfer toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-700">Mark as transfer</p>
                <p className="text-xs text-gray-400 mt-0.5">Excludes from budget calculations</p>
              </div>
              <Toggle checked={editIsTransfer} onChange={() => setEditIsTransfer((v) => !v)} />
            </div>

          </div>

          {/* Panel footer */}
          <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
            <button
              onClick={savePanel}
              disabled={saving}
              className="flex-1 bg-indigo-600 text-white text-sm py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={closePanel}
              className="px-4 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
