import { LayoutDashboard, Upload, List, PiggyBank, Landmark } from 'lucide-react'

export type Page = 'dashboard' | 'import' | 'transactions' | 'budget' | 'accounts'

interface Props {
  current: Page
  onChange: (p: Page) => void
}

const nav: { id: Page; label: string; Icon: React.ElementType }[] = [
  { id: 'dashboard',    label: 'Dashboard',     Icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions',   Icon: List },
  { id: 'budget',       label: 'Budget',         Icon: PiggyBank },
  { id: 'accounts',     label: 'Accounts',       Icon: Landmark },
  { id: 'import',       label: 'Import',         Icon: Upload },
]

export function Sidebar({ current, onChange }: Props) {
  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-gray-800">
        <span className="text-white font-semibold text-lg tracking-tight">
          💰 BudgetLens
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-3">
        {nav.map(({ id, label, Icon }) => {
          const active = current === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="px-5 py-4 text-gray-600 text-xs border-t border-gray-800">
        All data stored locally
      </div>
    </aside>
  )
}
