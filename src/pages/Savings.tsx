import { useState, useEffect } from 'react'
import { format, subMonths } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts'
import { PiggyBank, TrendingUp } from 'lucide-react'

interface MonthlySaving {
  month: string
  amount: number
}

function fmt(n: number) {
  return `£${n.toFixed(2)}`
}

export function SavingsPage() {
  const [history, setHistory] = useState<MonthlySaving[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.getSavingsHistory().then((data) => {
      setHistory(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  const total = history.reduce((s, m) => s + m.amount, 0)
  const thisMonth = format(new Date(), 'yyyy-MM')
  const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM')
  const thisMonthAmt = history.find((m) => m.month === thisMonth)?.amount ?? 0
  const lastMonthAmt = history.find((m) => m.month === lastMonth)?.amount ?? 0
  const avgMonthly = history.length > 0 ? total / history.length : 0

  // Running cumulative for display
  let running = 0
  const chartData = history.map((m) => {
    running += m.amount
    return {
      month: m.month,
      label: format(new Date(m.month + '-01'), 'MMM yy'),
      amount: m.amount,
      cumulative: Math.round(running * 100) / 100,
    }
  })

  return (
    <div className="p-8 w-full space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Savings</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Payments into savings accounts — transfers tagged as savings
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total saved</span>
            <PiggyBank size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(total)}</p>
          <p className="text-xs text-gray-400 mt-0.5">all time</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">This month</span>
            <TrendingUp size={16} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(thisMonthAmt)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{format(new Date(), 'MMMM yyyy')}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Last month</span>
            <TrendingUp size={16} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(lastMonthAmt)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{format(subMonths(new Date(), 1), 'MMMM yyyy')}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Monthly average</span>
            <PiggyBank size={16} className="text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(avgMonthly)}</p>
          <p className="text-xs text-gray-400 mt-0.5">over {history.length} month{history.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <PiggyBank size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No savings found</p>
          <p className="text-gray-400 text-sm mt-1">
            Make sure you have savings accounts set up and transfers marked correctly.
          </p>
        </div>
      ) : (
        <>
          {/* Monthly savings bar chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Monthly savings</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `£${v}`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [fmt(Number(v)), 'Saved']}
                  labelFormatter={(l) => `Month: ${l}`}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={chartData[i].month === thisMonth ? '#10b981' : '#6366f1'}
                      fillOpacity={chartData[i].month === thisMonth ? 1 : 0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly breakdown table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">History</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left">Month</th>
                  <th className="px-5 py-3 text-right">Saved</th>
                  <th className="px-5 py-3 text-right">Running total</th>
                </tr>
              </thead>
              <tbody>
                {[...chartData].reverse().map((row) => (
                  <tr key={row.month} className={`border-t border-gray-100 ${row.month === thisMonth ? 'bg-emerald-50/40' : 'hover:bg-gray-50'}`}>
                    <td className="px-5 py-3 text-gray-900 font-medium">
                      {format(new Date(row.month + '-01'), 'MMMM yyyy')}
                      {row.month === thisMonth && (
                        <span className="ml-2 text-xs text-emerald-600 font-medium">current</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(row.amount)}</td>
                    <td className="px-5 py-3 text-right text-gray-500">{fmt(row.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
