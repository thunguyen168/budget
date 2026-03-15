import { useState, useEffect } from 'react'
import { Edit2, Check, X, Plus, Trash2 } from 'lucide-react'
import type { Budget, Category, CategorisationRule } from '../types'

type Tab = 'budgets' | 'rules'

const SALARY = 2213

export function BudgetPage() {
  const [tab, setTab] = useState<Tab>('budgets')
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<CategorisationRule[]>([])
  const [loading, setLoading] = useState(true)

  // Editing budget
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null)
  const [editAmount, setEditAmount] = useState<string>('')

  // Editing category
  const [editingCatId, setEditingCatId] = useState<number | null>(null)
  const [editCatName, setEditCatName] = useState<string>('')
  const [editCatColour, setEditCatColour] = useState<string>('#6366f1')
  const [editCatFixed, setEditCatFixed] = useState<boolean>(false)

  // New category
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColour, setNewCatColour] = useState('#6366f1')
  const [newCatFixed, setNewCatFixed] = useState(false)

  // New rule
  const [showAddRule, setShowAddRule] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newRuleCatId, setNewRuleCatId] = useState<string>('')
  const [newRulePriority, setNewRulePriority] = useState<string>('50')

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    Promise.all([
      window.electronAPI.getBudgets(today),
      window.electronAPI.getCategories(),
      window.electronAPI.getCategorisationRules(),
    ]).then(([b, c, r]) => {
      setBudgets(b)
      setCategories(c)
      setRules(r)
      setLoading(false)
    })
  }, [])

  const saveBudget = async (id: number) => {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount < 0) return
    await window.electronAPI.updateBudget(id, amount)
    setBudgets((prev) => prev.map((b) => b.id === id ? { ...b, monthly_amount: amount } : b))
    setEditingBudgetId(null)
  }

  const startEditCat = (cat: Category) => {
    setEditingCatId(cat.id)
    setEditCatName(cat.name)
    setEditCatColour(cat.colour)
    setEditCatFixed(cat.is_fixed === 1)
  }

  const saveEditCat = async (id: number) => {
    if (!editCatName.trim()) return
    const updated = await window.electronAPI.updateCategory(id, {
      name: editCatName.trim(),
      colour: editCatColour,
      is_fixed: editCatFixed,
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
      name: newCatName.trim(),
      colour: newCatColour,
      is_fixed: newCatFixed,
    })
    if (cat) {
      setCategories((prev) => [...prev, cat])
      setShowAddCat(false)
      setNewCatName('')
    }
  }

  const addRule = async () => {
    if (!newKeyword.trim() || !newRuleCatId) return
    const rule = await window.electronAPI.addRule({
      keyword: newKeyword.trim(),
      category_id: Number(newRuleCatId),
      priority: Number(newRulePriority) || 50,
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

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>

  const fixedBudgets = budgets.filter((b) => b.is_fixed)
  const varBudgets = budgets.filter((b) => !b.is_fixed)
  const totalBudget = budgets.reduce((s, b) => s + b.monthly_amount, 0)
  const headroom = SALARY - totalBudget

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Budget</h1>
          <p className="text-gray-500 text-sm mt-0.5">Edit monthly targets and categorisation rules</p>
        </div>
        {/* Headroom indicator */}
        <div className={`text-right px-4 py-2 rounded-lg border ${headroom >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm font-semibold ${headroom >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            £{Math.abs(headroom).toFixed(0)} {headroom >= 0 ? 'headroom' : 'over salary'}
          </p>
          <p className="text-xs text-gray-500">£{totalBudget.toFixed(0)} budgeted of £{SALARY} take-home</p>
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

      {tab === 'budgets' && (
        <div className="space-y-6">
          <BudgetSection
            title="Fixed costs"
            subtitle="Predictable monthly bills"
            budgets={fixedBudgets}
            categories={categories}
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
            subtitle="Day-to-day spending"
            budgets={varBudgets}
            categories={categories}
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
          <div>
            {showAddCat ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <p className="text-sm font-medium text-gray-900">Add new category</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Name</label>
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="e.g. Gym"
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
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
        </div>
      )}

      {tab === 'rules' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Rules match transaction descriptions case-insensitively. Higher priority rules are checked first.
          </p>

          {/* Add rule */}
          {showAddRule ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <p className="text-sm font-medium text-gray-900">Add new rule</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Keyword (substring match)</label>
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="e.g. Tesco"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Category</label>
                  <select
                    value={newRuleCatId}
                    onChange={(e) => setNewRuleCatId(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                  >
                    <option value="">Select…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Priority</label>
                  <input
                    type="number"
                    value={newRulePriority}
                    onChange={(e) => setNewRulePriority(e.target.value)}
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
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-gray-800">{r.keyword}</td>
                    <td className="px-4 py-2.5 text-gray-700">{r.category_name}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{r.priority}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => deleteRule(r.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No rules defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function BudgetSection({
  title, subtitle, budgets, categories,
  editingBudgetId, editAmount,
  editingCatId, editCatName, editCatColour, editCatFixed,
  onEditBudget, onSaveBudget, onCancelBudget, onEditAmountChange,
  onEditCat, onSaveCat, onCancelCat, onEditCatName, onEditCatColour, onEditCatFixed,
}: {
  title: string
  subtitle: string
  budgets: Budget[]
  categories: Category[]
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
  const total = budgets.reduce((s, b) => s + b.monthly_amount, 0)

  // Map budget category_id to a Category object for editing
  const catById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        <span className="text-sm font-medium text-gray-700">Total: £{total.toFixed(0)}/mo</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {budgets.map((b) => {
            const cat = catById.get(b.category_id)
            const isEditingCat = editingCatId === b.category_id

            return (
              <tr key={b.id} className={`border-t border-gray-100 hover:bg-gray-50 ${isEditingCat ? 'bg-indigo-50' : ''}`}>
                <td className="px-5 py-3">
                  {isEditingCat ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={editCatName}
                        onChange={(e) => onEditCatName(e.target.value)}
                        className="text-sm border border-indigo-300 rounded-lg px-2 py-1 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') onSaveCat(b.category_id); if (e.key === 'Escape') onCancelCat() }}
                      />
                      <input
                        type="color"
                        value={editCatColour}
                        onChange={(e) => onEditCatColour(e.target.value)}
                        className="w-8 h-8 border border-gray-300 rounded cursor-pointer p-0.5"
                        title="Category colour"
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
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: b.colour }}
                      />
                      <span className="text-gray-900">{b.category_name}</span>
                      {b.effective_to && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          ends {b.effective_to}
                        </span>
                      )}
                      {cat && (
                        <button
                          onClick={() => onEditCat(cat)}
                          className="p-0.5 text-gray-300 hover:text-indigo-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit category"
                        >
                          <Edit2 size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {editingBudgetId === b.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-gray-400">£</span>
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => onEditAmountChange(e.target.value)}
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
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-medium text-gray-900">£{b.monthly_amount.toFixed(0)}/mo</span>
                      <button
                        onClick={() => onEditBudget(b)}
                        className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Edit budget amount"
                      >
                        <Edit2 size={13} />
                      </button>
                      {cat && !isEditingCat && (
                        <button
                          onClick={() => onEditCat(cat)}
                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Edit category name/colour/type"
                        >
                          <Edit2 size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
          {budgets.length === 0 && (
            <tr><td colSpan={2} className="px-5 py-4 text-center text-gray-400 text-sm">None</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
