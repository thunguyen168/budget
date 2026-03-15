import { useState, useEffect } from 'react'
import { Edit2, Check, X, Plus, Trash2, TrendingUp, TrendingDown, Pencil } from 'lucide-react'
import type { Budget, Category, CategorisationRule, CategoryActual } from '../types'

type Tab = 'budgets' | 'rules'

const SALARY = 2213

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, over, warn }: { pct: number; over: boolean; warn: boolean }) {
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          over ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-indigo-400'
        }`}
        style={{ width: `${Math.min(pct * 100, 100)}%` }}
      />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function BudgetPage() {
  const [tab, setTab]             = useState<Tab>('budgets')
  const [budgets, setBudgets]     = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules]         = useState<CategorisationRule[]>([])
  const [actuals, setActuals]     = useState<Map<number, number>>(new Map())
  const [loading, setLoading]     = useState(true)

  // Edit budget amount
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null)
  const [editAmount, setEditAmount]           = useState<string>('')

  // Edit category
  const [editingCatId, setEditingCatId]   = useState<number | null>(null)
  const [editCatName, setEditCatName]     = useState<string>('')
  const [editCatColour, setEditCatColour] = useState<string>('#6366f1')
  const [editCatFixed, setEditCatFixed]   = useState<boolean>(false)

  // New category
  const [showAddCat, setShowAddCat]   = useState(false)
  const [newCatName, setNewCatName]   = useState('')
  const [newCatColour, setNewCatColour] = useState('#6366f1')
  const [newCatFixed, setNewCatFixed] = useState(false)

  // New rule
  const [showAddRule, setShowAddRule]         = useState(false)
  const [newKeyword, setNewKeyword]           = useState('')
  const [newRuleCatId, setNewRuleCatId]       = useState<string>('')
  const [newRulePriority, setNewRulePriority] = useState<string>('50')

  // Edit rule
  const [editingRuleId, setEditingRuleId]         = useState<number | null>(null)
  const [editRuleKeyword, setEditRuleKeyword]     = useState<string>('')
  const [editRuleCatId, setEditRuleCatId]         = useState<string>('')
  const [editRulePriority, setEditRulePriority]   = useState<string>('')

  const today    = new Date().toISOString().slice(0, 10)
  const curMonth = today.slice(0, 7)

  useEffect(() => {
    Promise.all([
      window.electronAPI.getBudgets(today),
      window.electronAPI.getCategories(),
      window.electronAPI.getCategorisationRules(),
      window.electronAPI.getDashboardData(curMonth),
    ]).then(([b, c, r, dash]) => {
      setBudgets(b)
      setCategories(c)
      setRules(r)
      const map = new Map<number, number>()
      ;(dash.categoryActuals as CategoryActual[]).forEach((ca) => {
        map.set(ca.category_id, ca.actual)
      })
      setActuals(map)
      setLoading(false)
    })
  }, [today, curMonth])

  // ── Budget actions ─────────────────────────────────────────────────────────
  const saveBudget = async (id: number) => {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount < 0) return
    await window.electronAPI.updateBudget(id, amount)
    setBudgets((prev) => prev.map((b) => b.id === id ? { ...b, monthly_amount: amount } : b))
    setEditingBudgetId(null)
  }

  // ── Category actions ───────────────────────────────────────────────────────
  const startEditCat = (cat: Category) => {
    setEditingCatId(cat.id)
    setEditCatName(cat.name)
    setEditCatColour(cat.colour)
    setEditCatFixed(cat.is_fixed === 1)
  }

  const saveEditCat = async (id: number) => {
    if (!editCatName.trim()) return
    const updated = await window.electronAPI.updateCategory(id, {
      name: editCatName.trim(), colour: editCatColour, is_fixed: editCatFixed,
    })
    if (updated) {
      setCategories((prev) => prev.map((c) => c.id === id ? updated : c))
      setBudgets((prev) => prev.map((b) => b.category_id === id
        ? { ...b, category_name: updated.name, colour: updated.colour, is_fixed: updated.is_fixed }
        : b
      ))
    }
    setEditingCatId(null)
  }

  const addCategory = async () => {
    if (!newCatName.trim()) return
    const cat = await window.electronAPI.addCategory({
      name: newCatName.trim(), colour: newCatColour, is_fixed: newCatFixed,
    })
    if (cat) { setCategories((prev) => [...prev, cat]); setShowAddCat(false); setNewCatName('') }
  }

  // ── Rule actions ───────────────────────────────────────────────────────────
  const addRule = async () => {
    if (!newKeyword.trim() || !newRuleCatId) return
    const rule = await window.electronAPI.addRule({
      keyword: newKeyword.trim(), category_id: Number(newRuleCatId), priority: Number(newRulePriority) || 50,
    })
    if (rule) {
      setRules((prev) => [rule, ...prev])
      setShowAddRule(false)
      setNewKeyword('')
      setNewRuleCatId('')
    }
  }

  const deleteRule = async (id: number) => {
    await window.electronAPI.deleteRule(id)
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  const startEditRule = (r: import('../types').CategorisationRule) => {
    setEditingRuleId(r.id)
    setEditRuleKeyword(r.keyword)
    setEditRuleCatId(String(r.category_id))
    setEditRulePriority(String(r.priority))
  }

  const saveEditRule = async (id: number) => {
    if (!editRuleKeyword.trim() || !editRuleCatId) return
    const updated = await window.electronAPI.updateRule(id, {
      keyword: editRuleKeyword.trim(),
      category_id: Number(editRuleCatId),
      priority: Number(editRulePriority) || 50,
    })
    if (updated) {
      setRules((prev) => prev.map((r) => r.id === id ? updated : r))
    }
    setEditingRuleId(null)
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">Loading…</div>
    </div>
  )

  const fixedBudgets = budgets.filter((b) => b.is_fixed)
  const varBudgets   = budgets.filter((b) => !b.is_fixed)
  const totalBudget  = budgets.reduce((s, b) => s + b.monthly_amount, 0)
  const headroom     = SALARY - totalBudget

  // Over-budget count for the current month
  const overCount = varBudgets.filter((b) => (actuals.get(b.category_id) ?? 0) > b.monthly_amount).length

  return (
    <div className="p-8 w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Budget</h1>
          <p className="text-gray-500 text-sm mt-0.5">Monthly targets for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-3">
          {overCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-3 py-1.5 rounded-lg">
              <TrendingUp size={13} />
              {overCount} over budget
            </div>
          )}
          <div className={`text-right px-4 py-2 rounded-lg border ${headroom >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-sm font-semibold ${headroom >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {headroom >= 0 ? (
                <span className="flex items-center gap-1"><TrendingDown size={13} /> £{Math.abs(headroom).toFixed(0)} headroom</span>
              ) : (
                <span className="flex items-center gap-1"><TrendingUp size={13} /> £{Math.abs(headroom).toFixed(0)} over salary</span>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">£{totalBudget.toFixed(0)} of £{SALARY} take-home</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {(['budgets', 'rules'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'budgets' ? 'Budget targets' : 'Categorisation rules'}
          </button>
        ))}
      </div>

      {/* ── Budget targets tab ──────────────────────────────────────────────── */}
      {tab === 'budgets' && (
        <div className="space-y-6">
          <BudgetSection
            title="Fixed costs"
            subtitle="Predictable monthly bills"
            budgets={fixedBudgets}
            categories={categories}
            actuals={actuals}
            editingBudgetId={editingBudgetId}
            editAmount={editAmount}
            editingCatId={editingCatId}
            editCatName={editCatName}
            editCatColour={editCatColour}
            editCatFixed={editCatFixed}
            onEditBudget={(b) => { setEditingBudgetId(b.id); setEditAmount(String(b.monthly_amount)) }}
            onSaveBudget={saveBudget}
            onCancelBudget={() => setEditingBudgetId(null)}
            onEditAmountChange={setEditAmount}
            onEditCat={startEditCat}
            onSaveCat={saveEditCat}
            onCancelCat={() => setEditingCatId(null)}
            onEditCatName={setEditCatName}
            onEditCatColour={setEditCatColour}
            onEditCatFixed={setEditCatFixed}
          />
          <BudgetSection
            title="Variable costs"
            subtitle="Day-to-day spending — tracked live"
            budgets={varBudgets}
            categories={categories}
            actuals={actuals}
            editingBudgetId={editingBudgetId}
            editAmount={editAmount}
            editingCatId={editingCatId}
            editCatName={editCatName}
            editCatColour={editCatColour}
            editCatFixed={editCatFixed}
            onEditBudget={(b) => { setEditingBudgetId(b.id); setEditAmount(String(b.monthly_amount)) }}
            onSaveBudget={saveBudget}
            onCancelBudget={() => setEditingBudgetId(null)}
            onEditAmountChange={setEditAmount}
            onEditCat={startEditCat}
            onSaveCat={saveEditCat}
            onCancelCat={() => setEditingCatId(null)}
            onEditCatName={setEditCatName}
            onEditCatColour={setEditCatColour}
            onEditCatFixed={setEditCatFixed}
          />

          {/* Add category */}
          {showAddCat ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-900">Add new category</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Name</label>
                  <input
                    type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Gym"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setShowAddCat(false) }}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Colour</label>
                  <input type="color" value={newCatColour} onChange={(e) => setNewCatColour(e.target.value)}
                    className="w-full h-9 border border-gray-300 rounded-lg px-1 py-1 cursor-pointer" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Type</label>
                  <select
                    value={newCatFixed ? 'fixed' : 'variable'}
                    onChange={(e) => setNewCatFixed(e.target.value === 'fixed')}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                  >
                    <option value="variable">Variable</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addCategory} className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-700">
                  Add category
                </button>
                <button onClick={() => setShowAddCat(false)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCat(true)}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <Plus size={14} /> Add category
            </button>
          )}
        </div>
      )}

      {/* ── Rules tab ──────────────────────────────────────────────────────── */}
      {tab === 'rules' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Rules match transaction descriptions case-insensitively. Higher priority rules are checked first.
          </p>

          {showAddRule ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-900">Add new rule</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Keyword</label>
                  <input
                    type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="e.g. Tesco"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Category</label>
                  <select
                    value={newRuleCatId} onChange={(e) => setNewRuleCatId(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                  >
                    <option value="">Select…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Priority</label>
                  <input
                    type="number" value={newRulePriority} onChange={(e) => setNewRulePriority(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addRule} className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-700">
                  Add rule
                </button>
                <button onClick={() => setShowAddRule(false)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddRule(true)}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <Plus size={14} /> Add rule
            </button>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">Keyword</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Priority</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  editingRuleId === r.id ? (
                    <tr key={r.id} className="border-t border-gray-100 bg-indigo-50/40">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editRuleKeyword}
                          onChange={(e) => setEditRuleKeyword(e.target.value)}
                          className="w-full text-xs font-mono border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditRule(r.id); if (e.key === 'Escape') setEditingRuleId(null) }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editRuleCatId}
                          onChange={(e) => setEditRuleCatId(e.target.value)}
                          className="w-full text-xs border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        >
                          <option value="">Select…</option>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editRulePriority}
                          onChange={(e) => setEditRulePriority(e.target.value)}
                          className="w-16 text-xs border border-indigo-300 rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-indigo-300 ml-auto block"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => saveEditRule(r.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <Check size={13} />
                          </button>
                          <button onClick={() => setEditingRuleId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50 group">
                      <td className="px-4 py-2.5 font-mono text-gray-800 text-xs">{r.keyword}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.category_name}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{r.priority}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEditRule(r)}
                            className="p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteRule(r.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-400">No rules defined</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Budget section ───────────────────────────────────────────────────────────
function BudgetSection({
  title, subtitle, budgets, categories, actuals,
  editingBudgetId, editAmount,
  editingCatId, editCatName, editCatColour, editCatFixed,
  onEditBudget, onSaveBudget, onCancelBudget, onEditAmountChange,
  onEditCat, onSaveCat, onCancelCat, onEditCatName, onEditCatColour, onEditCatFixed,
}: {
  title: string
  subtitle: string
  budgets: Budget[]
  categories: Category[]
  actuals: Map<number, number>
  editingBudgetId: number | null
  editAmount: string
  editingCatId: number | null
  editCatName: string
  editCatColour: string
  editCatFixed: boolean
  onEditBudget: (b: Budget) => void
  onSaveBudget: (id: number) => void
  onCancelBudget: () => void
  onEditAmountChange: (v: string) => void
  onEditCat: (c: Category) => void
  onSaveCat: (id: number) => void
  onCancelCat: () => void
  onEditCatName: (v: string) => void
  onEditCatColour: (v: string) => void
  onEditCatFixed: (v: boolean) => void
}) {
  const total   = budgets.reduce((s, b) => s + b.monthly_amount, 0)
  const catById = new Map(categories.map((c) => [c.id, c]))

  const today       = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayOfMonth  = today.getDate()

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        <span className="text-sm font-medium text-gray-600">
          Total <span className="text-gray-900 font-semibold">£{total.toFixed(0)}</span>/mo
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {budgets.map((b) => {
          const cat         = catById.get(b.category_id)
          const isEditingCat = editingCatId === b.category_id
          const actual      = actuals.get(b.category_id) ?? 0
          const pct         = b.monthly_amount > 0 ? actual / b.monthly_amount : 0
          const over        = actual > b.monthly_amount && b.monthly_amount > 0
          const warn        = pct >= 0.8 && !over
          const projected   = dayOfMonth > 0 ? (actual / dayOfMonth) * daysInMonth : 0
          const projOver    = projected > b.monthly_amount && !b.is_fixed && b.monthly_amount > 0

          return (
            <div
              key={b.id}
              className={`px-5 py-4 transition-colors ${
                over        ? 'bg-red-50/60'
                : isEditingCat ? 'bg-indigo-50/60'
                : ''
              }`}
            >
              <div className="flex items-start gap-4">

                {/* Left: category name + progress bar */}
                <div className="flex-1 min-w-0">
                  {isEditingCat ? (
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <input
                        type="text" value={editCatName} onChange={(e) => onEditCatName(e.target.value)}
                        className="text-sm border border-indigo-300 rounded-lg px-2 py-1 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') onSaveCat(b.category_id); if (e.key === 'Escape') onCancelCat() }}
                      />
                      <input
                        type="color" value={editCatColour} onChange={(e) => onEditCatColour(e.target.value)}
                        className="w-8 h-8 border border-gray-300 rounded cursor-pointer p-0.5" title="Category colour"
                      />
                      <select
                        value={editCatFixed ? 'fixed' : 'variable'}
                        onChange={(e) => onEditCatFixed(e.target.value === 'fixed')}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1"
                      >
                        <option value="variable">Variable</option>
                        <option value="fixed">Fixed</option>
                      </select>
                      <button onClick={() => onSaveCat(b.category_id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check size={14} />
                      </button>
                      <button onClick={onCancelCat} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.colour }} />
                      <span className="text-sm font-medium text-gray-900">{b.category_name}</span>
                      {b.effective_to && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                          ends {b.effective_to}
                        </span>
                      )}
                      {cat && (
                        <button
                          onClick={() => onEditCat(cat)}
                          className="p-0.5 text-gray-300 hover:text-indigo-500 rounded"
                          title="Edit category"
                        >
                          <Edit2 size={11} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Progress bar (only when not editing category) */}
                  {!isEditingCat && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <ProgressBar pct={pct} over={over} warn={warn} />
                      </div>
                      <span className={`text-xs font-semibold tabular-nums w-8 text-right ${
                        over ? 'text-red-600' : warn ? 'text-amber-600' : 'text-gray-400'
                      }`}>
                        {Math.round(Math.min(pct, 1) * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: amounts + edit controls */}
                <div className="text-right flex-shrink-0">
                  {editingBudgetId === b.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">£</span>
                      <input
                        type="number" value={editAmount} onChange={(e) => onEditAmountChange(e.target.value)}
                        className="w-24 text-sm border border-indigo-300 rounded-lg px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') onSaveBudget(b.id); if (e.key === 'Escape') onCancelBudget() }}
                      />
                      <button onClick={() => onSaveBudget(b.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check size={14} />
                      </button>
                      <button onClick={onCancelBudget} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Spent / budget */}
                      <div className="flex items-baseline gap-1 justify-end">
                        <span className={`text-base font-bold tabular-nums ${over ? 'text-red-600' : 'text-gray-900'}`}>
                          £{actual.toFixed(0)}
                        </span>
                        <span className="text-xs text-gray-400">/ £{b.monthly_amount.toFixed(0)}</span>
                      </div>

                      {/* Projected end-of-month (variable only) */}
                      {!b.is_fixed && b.monthly_amount > 0 && projected > 0 && (
                        <div className={`text-xs mt-0.5 flex items-center justify-end gap-0.5 ${
                          projOver ? 'text-red-500 font-medium' : 'text-gray-400'
                        }`}>
                          {projOver
                            ? <TrendingUp size={10} />
                            : <TrendingDown size={10} />
                          }
                          proj. £{projected.toFixed(0)}
                        </div>
                      )}

                      {/* Remaining / over */}
                      {b.monthly_amount > 0 && (
                        <div className={`text-xs mt-0.5 ${over ? 'text-red-600 font-medium' : 'text-emerald-600'}`}>
                          {over
                            ? `£${(actual - b.monthly_amount).toFixed(0)} over`
                            : `£${(b.monthly_amount - actual).toFixed(0)} left`}
                        </div>
                      )}

                      <button
                        onClick={() => onEditBudget(b)}
                        className="mt-1.5 p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Edit budget amount"
                      >
                        <Edit2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {budgets.length === 0 && (
          <div className="px-5 py-6 text-center text-gray-400 text-sm">None</div>
        )}
      </div>
    </div>
  )
}
