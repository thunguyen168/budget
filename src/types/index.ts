export interface Account {
  id: number
  name: string
  bank_type: 'monzo' | 'amex' | 'nationwide'
  account_type: 'spending' | 'savings' | 'credit'
  ownership_share: number
  created_at: string
}

export interface TransferCandidate {
  out_id: number
  out_date: string
  out_desc: string
  out_amount: number
  out_account: string
  out_account_type: string
  in_id: number
  in_date: string
  in_desc: string
  in_amount: number
  in_account: string
  in_account_type: string
}

export interface Category {
  id: number
  name: string
  colour: string
  is_fixed: number
  sort_order: number
}

export interface Budget {
  id: number
  category_id: number
  monthly_amount: number
  effective_from: string
  effective_to: string | null
  category_name: string
  colour: string
  is_fixed: number
  sort_order: number
}

export interface Transaction {
  id: number
  account_id: number
  external_id: string
  date: string
  description: string
  amount: number
  original_amount: number
  category_id: number | null
  is_manually_categorised: number
  notes: string | null
  is_transfer: number
  created_at: string
  // joined
  category_name?: string
  category_colour?: string
  category_is_fixed?: number
  account_name?: string
  account_ownership_share?: number
  ownership_share?: number
  adjusted_amount?: number
}

export interface ImportRecord {
  id: number
  account_id: number
  filename: string
  row_count: number
  duplicates_skipped: number
  imported_at: string
  account_name: string
  bank_type: string
}

export interface CategorisationRule {
  id: number
  keyword: string
  category_id: number
  priority: number
  category_name: string
}

export interface ParsedTransaction {
  external_id: string
  date: string
  description: string
  amount: number
  original_amount: number
  monzo_category?: string
}

export type BankType = 'monzo' | 'amex' | 'nationwide'

export interface ParseResult {
  transactions: ParsedTransaction[]
  bankType: BankType
  error?: string
}

export interface ImportResult {
  imported: number
  duplicates: number
  uncategorised: number
}

export interface TransactionFilters {
  month?: string
  category_id?: number | null
  account_id?: number
  search?: string
  min_amount?: number
  max_amount?: number
}

export interface CategoryActual {
  category_id: number
  category_name: string
  colour: string
  is_fixed: number
  sort_order: number
  actual: number
  budget: number
}

export interface DailySpending {
  date: string
  cumulative: number
  pace: number
}

export interface FixedCost {
  category_id: number
  name: string
  colour: string
  expected: number
  paid: number
}

export interface DashboardData {
  categoryActuals: CategoryActual[]
  dailySpending: DailySpending[]
  fixedCosts: FixedCost[]
  totalIncome: number
  totalSpent: number
  variableBudget: number
  budgetTotal: number
  daysInMonth: number
  uncategorisedCount: number
  savingsDeposited: number
}

export interface Alert {
  type: 'error' | 'warning' | 'info' | 'success'
  message: string
}

// Extend window with our API
declare global {
  interface Window {
    electronAPI: {
      openFileDialog(): Promise<string[]>
      parseCSVFile(filePath: string): Promise<ParseResult>
      getAccounts(): Promise<Account[]>
      addAccount(data: { name: string; bank_type: string; account_type: string; ownership_share: number }): Promise<Account>
      updateAccount(id: number, data: { name: string; account_type: string; ownership_share: number }): Promise<Account>
      detectTransfers(windowDays: number): Promise<TransferCandidate[]>
      applyTransfers(txIds: number[]): Promise<void>
      toggleTransfer(id: number): Promise<void>
      importTransactions(data: { accountId: number; filename: string; transactions: ParsedTransaction[] }): Promise<ImportResult>
      getImportHistory(): Promise<ImportRecord[]>
      getTransactions(filters?: TransactionFilters): Promise<Transaction[]>
      updateTransaction(id: number, updates: { category_id?: number; notes?: string; ownership_share?: number | null }): Promise<void>
      getCategories(): Promise<Category[]>
      addCategory(data: { name: string; colour: string; is_fixed: boolean }): Promise<Category>
      updateCategory(id: number, data: { name: string; colour: string; is_fixed: boolean }): Promise<Category>
      getBudgets(forDate?: string): Promise<Budget[]>
      updateBudget(id: number, amount: number): Promise<void>
      getCategorisationRules(): Promise<CategorisationRule[]>
      addRule(data: { keyword: string; category_id: number; priority: number }): Promise<CategorisationRule>
      deleteRule(id: number): Promise<void>
      getDashboardData(month: string): Promise<DashboardData>
      exportData(): Promise<string>
      deleteAllData(): Promise<void>
    }
  }
}
