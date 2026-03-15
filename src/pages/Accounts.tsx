import { useState, useEffect } from 'react'
import { Edit2, Check, X, Plus, ArrowRightLeft, PiggyBank, CreditCard, Wallet } from 'lucide-react'
import { format } from 'date-fns'
import type { Account, TransferCandidate } from '../types'

const ACCOUNT_TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; colour: string }> = {
  spending: { label: 'Spending', icon: Wallet,      colour: 'bg-blue-100 text-blue-700' },
  savings:  { label: 'Savings',  icon: PiggyBank,   colour: 'bg-green-100 text-green-700' },
  credit:   { label: 'Credit',   icon: CreditCard,  colour: 'bg-purple-100 text-purple-700' },
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  // Edit account
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<string>('spending')
  const [editShare, setEditShare] = useState<string>('1')

  // Add account
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBankType, setNewBankType] = useState<string>('monzo')
  const [newType, setNewType] = useState<string>('spending')
  const [newShare, setNewShare] = useState<string>('1')

  // Transfer detection
  const [windowDays, setWindowDays] = useState(5)
  const [candidates, setCandidates] = useState<TransferCandidate[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detecting, setDetecting] = useState(false)
  const [applyStatus, setApplyStatus] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.getAccounts().then((a) => {
      setAccounts(a)
      setLoading(false)
    })
  }, [])

  const startEdit = (a: Account) => {
    setEditingId(a.id)
    setEditName(a.name)
    setEditType(a.account_type ?? 'spending')
    setEditShare(String(a.ownership_share))
  }

  const saveEdit = async (id: number) => {
    const share = parseFloat(editShare)
    if (!editName.trim() || isNaN(share) || share < 0 || share > 1) return
    const updated = await window.electronAPI.updateAccount(id, {
      name: editName.trim(),
      account_type: editType,
      ownership_share: share,
    })
    if (updated) setAccounts((prev) => prev.map((a) => a.id === id ? updated : a))
    setEditingId(null)
  }

  const addAccount = async () => {
    if (!newName.trim()) return
    const share = parseFloat(newShare)
    if (isNaN(share) || share < 0 || share > 1) return
    const acc = await window.electronAPI.addAccount({
      name: newName.trim(),
      bank_type: newBankType,
      account_type: newType,
      ownership_share: share,
    })
    if (acc) {
      setAccounts((prev) => [...prev, acc])
      setShowAdd(false)
      setNewName('')
      setNewShare('1')
    }
  }

  const runDetection = async () => {
    setDetecting(true)
    setCandidates(null)
    setSelected(new Set())
    setApplyStatus(null)
    const pairs = await window.electronAPI.detectTransfers(windowDays)
    setCandidates(pairs)
    // Pre-select all by default
    setSelected(new Set(pairs.map((p) => pairKey(p))))
    setDetecting(false)
  }

  const applySelected = async () => {
    if (!candidates) return
    const toMark = candidates
      .filter((p) => selected.has(pairKey(p)))
      .flatMap((p) => [p.out_id, p.in_id])
    await window.electronAPI.applyTransfers(toMark)
    setApplyStatus(`Marked ${toMark.length / 2} transfer pair${toMark.length / 2 !== 1 ? 's' : ''} (${toMark.length} transactions)`)
    setCandidates(null)
    setSelected(new Set())
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Accounts</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage accounts and detect internal transfers</p>
      </div>

      {/* Account list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Your accounts</h2>
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <Plus size={14} /> Add account
            </button>
          )}
        </div>

        {/* Add account form */}
        {showAdd && (
          <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50 space-y-3">
            <p className="text-sm font-medium text-gray-900">Add account</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Account name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Monzo Savings"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') addAccount(); if (e.key === 'Escape') setShowAdd(false) }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">CSV format (for importing)</label>
                <select
                  value={newBankType}
                  onChange={(e) => setNewBankType(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                >
                  <option value="monzo">Monzo</option>
                  <option value="amex">Amex</option>
                  <option value="nationwide">Nationwide</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Account type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                >
                  <option value="spending">Spending</option>
                  <option value="savings">Savings</option>
                  <option value="credit">Credit card</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Your ownership share (0–1)</label>
                <input
                  type="number"
                  min="0" max="1" step="0.01"
                  value={newShare}
                  onChange={(e) => setNewShare(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addAccount} className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-700">
                Add account
              </button>
              <button onClick={() => setShowAdd(false)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </div>
        )}

        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left">Name</th>
              <th className="px-5 py-3 text-left">Type</th>
              <th className="px-5 py-3 text-left">CSV format</th>
              <th className="px-5 py-3 text-right">Your share</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const typeInfo = ACCOUNT_TYPE_LABELS[a.account_type ?? 'spending']
              const TypeIcon = typeInfo?.icon ?? Wallet
              return (
                <tr key={a.id} className={`border-t border-gray-100 hover:bg-gray-50 ${editingId === a.id ? 'bg-indigo-50' : ''}`}>
                  <td className="px-5 py-3">
                    {editingId === a.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-sm border border-indigo-300 rounded-lg px-2 py-1 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(a.id); if (e.key === 'Escape') setEditingId(null) }}
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{a.name}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {editingId === a.id ? (
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1"
                      >
                        <option value="spending">Spending</option>
                        <option value="savings">Savings</option>
                        <option value="credit">Credit card</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${typeInfo?.colour ?? 'bg-gray-100 text-gray-600'}`}>
                        <TypeIcon size={10} />
                        {typeInfo?.label ?? a.account_type}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500 capitalize">{a.bank_type}</td>
                  <td className="px-5 py-3 text-right">
                    {editingId === a.id ? (
                      <input
                        type="number"
                        min="0" max="1" step="0.01"
                        value={editShare}
                        onChange={(e) => setEditShare(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1 w-20 text-right"
                      />
                    ) : (
                      <span className="text-gray-700">{Math.round(a.ownership_share * 100)}%</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {editingId === a.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => saveEdit(a.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(a)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
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

      {/* Transfer detection */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-indigo-500" />
              Transfer detection
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Find transactions across accounts that cancel each other out — credit card payments,
              internal transfers, and deposits to savings accounts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Match within</label>
            <input
              type="number"
              min={0} max={30}
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              className="w-16 text-sm border border-gray-300 rounded-lg px-2 py-1.5 text-center"
            />
            <span className="text-sm text-gray-600">days</span>
          </div>
          <button
            onClick={runDetection}
            disabled={detecting}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <ArrowRightLeft size={14} />
            {detecting ? 'Scanning…' : 'Scan for transfers'}
          </button>
        </div>

        {applyStatus && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
            <Check size={14} />
            {applyStatus}
          </div>
        )}

        {candidates !== null && (
          <div className="space-y-3">
            {candidates.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No unmatched transfer pairs found.</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700 font-medium">
                    {candidates.length} pair{candidates.length !== 1 ? 's' : ''} found
                    <span className="text-gray-400 font-normal ml-2">— select which to mark as transfers</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelected(new Set(candidates.map(pairKey)))}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => setSelected(new Set())}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Deselect all
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-400 uppercase tracking-wide border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left w-8"></th>
                        <th className="px-3 py-2 text-left">Outgoing</th>
                        <th className="px-3 py-2 text-left">Incoming</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((p) => {
                        const key = pairKey(p)
                        const checked = selected.has(key)
                        const isSavings = p.in_account_type === 'savings'
                        return (
                          <tr
                            key={key}
                            className={`border-t border-gray-100 cursor-pointer ${checked ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                            onClick={() => setSelected((s) => {
                              const next = new Set(s)
                              next.has(key) ? next.delete(key) : next.add(key)
                              return next
                            })}
                          >
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={checked} readOnly className="rounded" />
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-800 truncate max-w-[180px]">{p.out_desc}</div>
                              <div className="text-gray-400">{p.out_account} · {format(new Date(p.out_date), 'd MMM')}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-800 truncate max-w-[180px]">{p.in_desc}</div>
                              <div className="text-gray-400 flex items-center gap-1">
                                {p.in_account} · {format(new Date(p.in_date), 'd MMM')}
                                {isSavings && (
                                  <span className="text-green-600 bg-green-100 px-1.5 py-0.5 rounded font-medium">savings</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">
                              £{p.out_amount.toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={applySelected}
                    disabled={selected.size === 0}
                    className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Mark {selected.size} pair{selected.size !== 1 ? 's' : ''} as transfers
                  </button>
                  <button
                    onClick={() => { setCandidates(null); setSelected(new Set()) }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function pairKey(p: TransferCandidate) {
  return `${p.out_id}-${p.in_id}`
}
