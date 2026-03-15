import { useState } from 'react'
import { Sidebar, type Page } from './components/Sidebar'
import { DashboardPage } from './pages/Dashboard'
import { ImportPage } from './pages/Import'
import { TransactionsPage } from './pages/Transactions'
import { BudgetPage } from './pages/Budget'
import { AccountsPage } from './pages/Accounts'
import { SavingsPage } from './pages/Savings'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [transactionCategoryFilter, setTransactionCategoryFilter] = useState<number | null>(null)

  function navigateToTransactions(categoryId?: number) {
    setTransactionCategoryFilter(categoryId ?? null)
    setPage('transactions')
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-50" style={{ display: 'grid', gridTemplateColumns: '14rem 1fr' }}>
      <Sidebar current={page} onChange={(p) => setPage(p)} />
      <main className="overflow-auto min-w-0">
        {page === 'dashboard' && (
          <DashboardPage onNavigateToTransactions={navigateToTransactions} />
        )}
        {page === 'import' && <ImportPage />}
        {page === 'transactions' && (
          <TransactionsPage initialCategoryId={transactionCategoryFilter} />
        )}
        {page === 'budget' && <BudgetPage />}
        {page === 'savings' && <SavingsPage />}
        {page === 'accounts' && <AccountsPage />}
      </main>
    </div>
  )
}
