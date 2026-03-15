import { useState, useEffect, useMemo } from 'react'
import { format, addMonths, subMonths, getDaysInMonth } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid, Legend,
  PieChart, Pie,
} from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Calendar, Check, Clock } from 'lucide-react'
import { AlertBanner } from '../components/AlertBanner'
import type { DashboardData, Alert } from '../types'

function monthKey(d: Date) {
  return format(d, 'yyyy-MM')
}

function fmt(n: number) {
  return `£${n.toFixed(2)}`
}

function computeAlerts(data: DashboardData, selectedMonth: string): Alert[] {
  const alerts: Alert[] = []
  const today = new Date()
  const isCurrentMonth = monthKey(today) === selectedMonth
  const dayOfMonth = today.getDate()
  const daysLeft = data.daysInMonth - dayOfMonth

  for (const cat of data.categoryActuals.filter((c) => !c.is_fixed && c.budget > 0)) {
    const pct = cat.actual / cat.budget
    if (pct >= 1) {
      alerts.push({ type: 'error', message: `${cat.category_name}: over budget (${fmt(cat.actual)} of ${fmt(cat.budget)})` })
    } else if (pct >= 0.8 && isCurrentMonth && daysLeft >= 10) {
      alerts.push({ type: 'warning', message: `${cat.category_name}: ${Math.round(pct * 100)}% of budget used with ${daysLeft} days left` })
    } else if (!isCurrentMonth && pct < 1 && cat.actual > 0) {
      alerts.push({ type: 'success', message: `${cat.category_name}: underspent by ${fmt(cat.budget - cat.actual)}` })
    }
  }

  // Pace warning (current month only)
  if (isCurrentMonth && data.dailySpending.length > 0) {
    const latest = data.dailySpending[data.dailySpending.length - 1]
    if (latest.pace > 0 && latest.cumulative > latest.pace * 1.2) {
      alerts.push({ type: 'warning', message: `Spending pace is ${Math.round((latest.cumulative / latest.pace - 1) * 100)}% above target` })
    }
  }

  // Uncategorised
  if (data.uncategorisedCount > 5) {
    alerts.push({ type: 'info', message: `${data.uncategorisedCount} transactions are uncategorised — visit Transactions to review` })
  }

  // Bills not yet paid (after 10th)
  if (isCurrentMonth && dayOfMonth >= 10) {
    for (const fc of data.fixedCosts.filter((f) => !f.paid)) {
      alerts.push({ type: 'info', message: `${fc.name}: bill not yet detected this month` })
    }
  }

  return alerts
}

// Custom tooltip for budget bar
function BudgetTooltip({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) {
  if (!active || !payload || !payload.length) return null
  const entries = payload as Array<{ name: string; value: number; fill: string }>
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-900 mb-2">{label}</p>
      {entries.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <span style={{ color: e.fill }}>{e.name}</span>
          <span className="font-medium text-gray-900">{fmt(e.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function DashboardPage({ onNavigateToTransactions }: { onNavigateToTransactions: (categoryId?: number) => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const month = monthKey(selectedDate)

  useEffect(() => {
    setLoading(true)
    window.electronAPI.getDashboardData(month).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [month])

  const alerts = useMemo(() => (data ? computeAlerts(data, month) : []), [data, month])

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  const variableCats = data.categoryActuals.filter((c) => !c.is_fixed)
  const totalBudget = data.variableBudget
  const remaining = totalBudget - data.totalSpent
  const today = new Date()
  const isCurrentMonth = monthKey(today) === month
  const daysLeft = isCurrentMonth ? data.daysInMonth - today.getDate() : 0

  // Pie data (variable categories with actual > 0)
  const pieData = variableCats.filter((c) => c.actual > 0).map((c) => ({
    name: c.category_name,
    value: c.actual,
    fill: c.colour,
  }))

  return (
    <div className="p-8 max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track your spending against budget</p>
        </div>
        {/* Month selector */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <button onClick={() => setSelectedDate((d) => subMonths(d, 1))} className="text-gray-400 hover:text-gray-700">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-900 w-28 text-center">
            {format(selectedDate, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setSelectedDate((d) => addMonths(d, 1))}
            disabled={isCurrentMonth}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <AlertBanner alerts={alerts} />

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          label="Total income"
          value={fmt(data.totalIncome)}
          Icon={TrendingUp}
          iconClass="text-green-500"
          sub="this month"
        />
        <SummaryCard
          label="Total spent"
          value={fmt(data.totalSpent)}
          Icon={TrendingDown}
          iconClass="text-red-500"
          sub="variable spending"
        />
        <SummaryCard
          label="Budget remaining"
          value={fmt(Math.max(remaining, 0))}
          Icon={Wallet}
          iconClass="text-indigo-500"
          sub={`of ${fmt(totalBudget)}`}
          warn={remaining < 0}
        />
        {isCurrentMonth ? (
          <SummaryCard
            label="Days left"
            value={String(daysLeft)}
            Icon={Calendar}
            iconClass="text-blue-500"
            sub={`of ${data.daysInMonth} days`}
          />
        ) : (
          <SummaryCard
            label="Month end"
            value={remaining >= 0 ? 'Under budget' : 'Over budget'}
            Icon={remaining >= 0 ? TrendingUp : TrendingDown}
            iconClass={remaining >= 0 ? 'text-green-500' : 'text-red-500'}
            sub={remaining >= 0 ? `Saved ${fmt(remaining)}` : `Over by ${fmt(-remaining)}`}
          />
        )}
      </div>

      {/* Budget vs Actual chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Budget vs Actual — Variable spending</h2>
        <ResponsiveContainer width="100%" height={variableCats.length * 40 + 40}>
          <BarChart
            data={variableCats}
            layout="vertical"
            barCategoryGap="25%"
            margin={{ top: 0, right: 60, left: 130, bottom: 0 }}
          >
            <XAxis type="number" tickFormatter={(v) => `£${v}`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="category_name" tick={{ fontSize: 12 }} width={120} />
            <Tooltip content={<BudgetTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="budget" name="Budget" fill="#e2e8f0" radius={[0, 3, 3, 0]} />
            <Bar dataKey="actual" name="Actual" radius={[0, 3, 3, 0]}>
              {variableCats.map((cat) => (
                <Cell
                  key={cat.category_id}
                  fill={cat.actual > cat.budget ? '#ef4444' : cat.colour}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Cumulative spending vs pace */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Spending pace</h2>
          {data.dailySpending.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No transactions yet this month</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.dailySpending} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(8)} />
                <YAxis tickFormatter={(v) => `£${v}`} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => [`£${Number(v).toFixed(2)}`]}
                  labelFormatter={(l) => format(new Date(l as string), 'd MMM')}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="pace" name="Budget pace" stroke="#94a3b8" strokeDasharray="4 2" fill="none" dot={false} />
                <Area type="monotone" dataKey="cumulative" name="Actual spend" stroke="#6366f1" fill="url(#spendGrad)" dot={false} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category donut */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Spending breakdown</h2>
          {pieData.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No transactions yet this month</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    onClick={(d) => {
                      const cat = variableCats.find((c) => c.category_name === d.name)
                      if (cat) onNavigateToTransactions(cat.category_id)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`£${Number(v).toFixed(2)}`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 overflow-auto max-h-52">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                    <span className="text-gray-600 flex-1 truncate">{d.name}</span>
                    <span className="text-gray-900 font-medium">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed costs status */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Fixed costs</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {data.fixedCosts.map((fc) => (
            <div
              key={fc.category_id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                fc.paid ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}
            >
              {fc.paid ? (
                <Check size={14} className="text-green-600 flex-shrink-0" />
              ) : (
                <Clock size={14} className="text-gray-400 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${fc.paid ? 'text-green-800' : 'text-gray-700'}`}>
                  {fc.name}
                </p>
                <p className="text-xs text-gray-400">{fmt(fc.expected)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  label, value, Icon, iconClass, sub, warn,
}: {
  label: string; value: string; Icon: React.ElementType; iconClass: string; sub: string; warn?: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</span>
        <Icon size={16} className={iconClass} />
      </div>
      <p className={`text-2xl font-bold ${warn ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}
