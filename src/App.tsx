import { useState } from 'react'
import { Sidebar, type Page } from './components/Sidebar'
import { DashboardPage } from './pages/Dashboard'
import { ImportPage } from './pages/Import'
import { TransactionsPage } from './pages/Transactions'
import { BudgetPage } from './pages/Budget'
import { AccountsPage } from './pages/Accounts'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [transactionCategoryFilter, setTransactionCategoryFilter] = useState<number | null>(null)

  function navigateToTransactions(categoryId?: number) {
    setTransactionCategoryFilter(categoryId ?? null)
    setPage('transactions')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar current={page} onChange={(p) => setPage(p)} />
      <main className="flex-1 overflow-auto">
        {page === 'dashboard' && (
          <DashboardPage onNavigateToTransactions={navigateToTransactions} />
        )}
        {page === 'import' && <ImportPage />}
        {page === 'transactions' && (
          <TransactionsPage initialCategoryId={transactionCategoryFilter} />
        )}
        {page === 'budget' && <BudgetPage />}
        {page === 'accounts' && <AccountsPage />}
      </main>
    </div>
  )
}
