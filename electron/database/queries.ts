import Database from 'better-sqlite3'
import type { ParsedTransaction } from '../parsers/types'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) throw new Error('Database not initialised')
  return _db
}

export function setDb(db: Database.Database): void {
  _db = db
}

// ── Categorisation ────────────────────────────────────────────────────────────

export function categoriseTransaction(description: string, monzoCat?: string): number | null {
  const db = getDb()
  const rules = db.prepare(`
    SELECT r.keyword, r.category_id
    FROM categorisation_rules r
    ORDER BY r.priority DESC
  `).all() as { keyword: string; category_id: number }[]

  const descLower = description.toLowerCase()
  for (const rule of rules) {
    if (descLower.includes(rule.keyword.toLowerCase())) {
      return rule.category_id
    }
  }

  // Fall back to "Other / misc"
  const other = db.prepare(`SELECT id FROM categories WHERE name = 'Other / misc'`).get() as { id: number } | undefined
  return other?.id ?? null
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export function getAccounts() {
  return getDb().prepare('SELECT * FROM accounts ORDER BY id').all()
}

export function addAccount(data: { name: string; bank_type: string; account_type: string; ownership_share: number }) {
  const db = getDb()
  const r = db.prepare(`
    INSERT INTO accounts (name, bank_type, account_type, ownership_share) VALUES (?,?,?,?)
  `).run(data.name, data.bank_type, data.account_type, data.ownership_share) as Database.RunResult
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(r.lastInsertRowid)
}

export function updateAccount(id: number, data: { name: string; account_type: string; ownership_share: number }) {
  getDb().prepare(`UPDATE accounts SET name = ?, account_type = ?, ownership_share = ? WHERE id = ?`)
    .run(data.name, data.account_type, data.ownership_share, id)
  return getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id)
}

// ── Import ────────────────────────────────────────────────────────────────────

export interface ImportData {
  accountId: number
  filename: string
  transactions: ParsedTransaction[]
}

export interface ImportResult {
  imported: number
  duplicates: number
  uncategorised: number
}

export function importTransactions(data: ImportData): ImportResult {
  const db = getDb()
  let imported = 0
  let duplicates = 0
  let uncategorised = 0

  const checkExists = db.prepare('SELECT id FROM transactions WHERE external_id = ?')
  const insert = db.prepare(`
    INSERT INTO transactions
      (account_id, external_id, date, description, amount, original_amount, category_id, is_manually_categorised)
    VALUES (?,?,?,?,?,?,?,0)
  `)
  const otherCat = db.prepare(`SELECT id FROM categories WHERE name = 'Other / misc'`).get() as { id: number } | undefined

  db.transaction(() => {
    for (const tx of data.transactions) {
      const existing = checkExists.get(tx.external_id)
      if (existing) {
        duplicates++
        continue
      }

      const categoryId = categoriseTransaction(tx.description, tx.monzo_category)
      if (categoryId === otherCat?.id) uncategorised++

      insert.run(
        data.accountId,
        tx.external_id,
        tx.date,
        tx.description,
        tx.amount,
        tx.original_amount,
        categoryId
      )
      imported++
    }

    db.prepare(`
      INSERT INTO imports (account_id, filename, row_count, duplicates_skipped)
      VALUES (?,?,?,?)
    `).run(data.accountId, data.filename, imported, duplicates)
  })()

  return { imported, duplicates, uncategorised }
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface TransactionFilters {
  month?: string      // 'YYYY-MM'
  category_id?: number | null
  account_id?: number
  search?: string
  min_amount?: number
  max_amount?: number
}

export function getTransactions(filters: TransactionFilters = {}) {
  const db = getDb()
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (filters.month) {
    conditions.push(`strftime('%Y-%m', t.date) = @month`)
    params.month = filters.month
  }
  if (filters.category_id !== undefined && filters.category_id !== null) {
    conditions.push(`t.category_id = @category_id`)
    params.category_id = filters.category_id
  }
  if (filters.account_id !== undefined) {
    conditions.push(`t.account_id = @account_id`)
    params.account_id = filters.account_id
  }
  if (filters.search) {
    conditions.push(`t.description LIKE @search`)
    params.search = `%${filters.search}%`
  }
  if (filters.min_amount !== undefined) {
    conditions.push(`(t.amount * a.ownership_share) >= @min_amount`)
    params.min_amount = filters.min_amount
  }
  if (filters.max_amount !== undefined) {
    conditions.push(`(t.amount * a.ownership_share) <= @max_amount`)
    params.max_amount = filters.max_amount
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  return db.prepare(`
    SELECT
      t.*,
      c.name  AS category_name,
      c.colour AS category_colour,
      c.is_fixed AS category_is_fixed,
      a.name  AS account_name,
      a.ownership_share AS account_ownership_share,
      COALESCE(t.ownership_share, a.ownership_share) AS ownership_share,
      ROUND(t.amount * COALESCE(t.ownership_share, a.ownership_share), 2) AS adjusted_amount
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    JOIN accounts a ON t.account_id = a.id
    ${where}
    ORDER BY t.date DESC, t.id DESC
  `).all(params)
}

export function updateTransaction(id: number, updates: { category_id?: number; notes?: string; ownership_share?: number | null }) {
  const db = getDb()
  const fields: string[] = []
  const params: Record<string, unknown> = { id }

  if (updates.category_id !== undefined) {
    fields.push('category_id = @category_id', 'is_manually_categorised = 1')
    params.category_id = updates.category_id
  }
  if (updates.notes !== undefined) {
    fields.push('notes = @notes')
    params.notes = updates.notes
  }
  if ('ownership_share' in updates) {
    fields.push('ownership_share = @ownership_share')
    params.ownership_share = updates.ownership_share
  }
  if ('is_transfer' in updates) {
    fields.push('is_transfer = @is_transfer')
    params.is_transfer = updates.is_transfer
  }
  if (fields.length === 0) return

  db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = @id`).run(params)
}

// ── Transfer detection ─────────────────────────────────────────────────────────

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

export function detectTransfers(windowDays = 5): TransferCandidate[] {
  return getDb().prepare(`
    SELECT
      t1.id AS out_id, t1.date AS out_date, t1.description AS out_desc,
      ROUND(t1.amount, 2) AS out_amount,
      a1.name AS out_account, a1.account_type AS out_account_type,
      t2.id AS in_id, t2.date AS in_date, t2.description AS in_desc,
      ROUND(t2.amount, 2) AS in_amount,
      a2.name AS in_account, a2.account_type AS in_account_type
    FROM transactions t1
    JOIN accounts a1 ON t1.account_id = a1.id
    JOIN transactions t2 ON t2.account_id != t1.account_id
    JOIN accounts a2 ON t2.account_id = a2.id
    WHERE t1.is_transfer = 0
      AND t2.is_transfer = 0
      AND t1.amount > 0
      AND t2.amount < 0
      AND ABS(t1.amount + t2.amount) < 0.02
      AND ABS(JULIANDAY(t1.date) - JULIANDAY(t2.date)) <= @windowDays
    ORDER BY t1.date DESC
    LIMIT 300
  `).all({ windowDays }) as TransferCandidate[]
}

export function applyTransfers(txIds: number[]): void {
  const db = getDb()
  const update = db.prepare('UPDATE transactions SET is_transfer = 1 WHERE id = ?')
  db.transaction(() => {
    for (const id of txIds) update.run(id)
  })()
}

export function toggleTransfer(id: number): void {
  getDb().prepare(`UPDATE transactions SET is_transfer = CASE WHEN is_transfer = 1 THEN 0 ELSE 1 END WHERE id = ?`).run(id)
}

// ── Categories ────────────────────────────────────────────────────────────────

export function getCategories() {
  return getDb().prepare('SELECT * FROM categories ORDER BY sort_order, name').all()
}

export function updateCategory(id: number, data: { name: string; colour: string; is_fixed: boolean }) {
  getDb().prepare(`UPDATE categories SET name = ?, colour = ?, is_fixed = ? WHERE id = ?`).run(data.name, data.colour, data.is_fixed ? 1 : 0, id)
  return getDb().prepare('SELECT * FROM categories WHERE id = ?').get(id)
}

export function addCategory(data: { name: string; colour: string; is_fixed: boolean }) {
  const db = getDb()
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM categories').get() as { m: number | null }).m ?? 0
  const r = db.prepare(`
    INSERT INTO categories (name, colour, is_fixed, sort_order) VALUES (?,?,?,?)
  `).run(data.name, data.colour, data.is_fixed ? 1 : 0, maxOrder + 1) as Database.RunResult
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(r.lastInsertRowid)
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export function getBudgets(forDate?: string) {
  const db = getDb()
  const date = forDate ?? new Date().toISOString().slice(0, 10)
  return db.prepare(`
    SELECT b.*, c.name AS category_name, c.colour, c.is_fixed, c.sort_order
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    WHERE b.effective_from <= @date
      AND (b.effective_to IS NULL OR b.effective_to >= @date)
    ORDER BY c.sort_order, c.name
  `).all({ date })
}

export function updateBudget(id: number, monthly_amount: number) {
  getDb().prepare('UPDATE budgets SET monthly_amount = ? WHERE id = ?').run(monthly_amount, id)
}

// ── Rules ─────────────────────────────────────────────────────────────────────

export function getCategorisationRules() {
  return getDb().prepare(`
    SELECT r.*, c.name AS category_name
    FROM categorisation_rules r
    JOIN categories c ON r.category_id = c.id
    ORDER BY r.priority DESC, r.keyword
  `).all()
}

export function addRule(data: { keyword: string; category_id: number; priority: number }) {
  const db = getDb()
  const r = db.prepare(`
    INSERT INTO categorisation_rules (keyword, category_id, priority) VALUES (?,?,?)
  `).run(data.keyword, data.category_id, data.priority) as Database.RunResult
  return db.prepare(`
    SELECT r.*, c.name AS category_name FROM categorisation_rules r
    JOIN categories c ON r.category_id = c.id WHERE r.id = ?
  `).get(r.lastInsertRowid)
}

export function deleteRule(id: number) {
  getDb().prepare('DELETE FROM categorisation_rules WHERE id = ?').run(id)
}

// ── Import history ────────────────────────────────────────────────────────────

export function getImportHistory() {
  return getDb().prepare(`
    SELECT i.*, a.name AS account_name, a.bank_type
    FROM imports i
    JOIN accounts a ON i.account_id = a.id
    ORDER BY i.imported_at DESC
  `).all()
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function getDashboardData(month: string) {
  const db = getDb()
  // month = 'YYYY-MM'
  const monthStart = `${month}-01`

  // Category actuals (excluding transfers)
  const categoryActuals = db.prepare(`
    SELECT
      c.id   AS category_id,
      c.name AS category_name,
      c.colour,
      c.is_fixed,
      c.sort_order,
      COALESCE(ROUND(SUM(CASE WHEN t.amount > 0 AND (t.is_transfer = 0 OR t.is_transfer IS NULL) THEN t.amount * a.ownership_share ELSE 0 END), 2), 0) AS actual,
      COALESCE(b.monthly_amount, 0) AS budget
    FROM categories c
    LEFT JOIN transactions t
      ON t.category_id = c.id
      AND strftime('%Y-%m', t.date) = @month
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN budgets b
      ON b.category_id = c.id
      AND b.effective_from <= @monthStart
      AND (b.effective_to IS NULL OR b.effective_to >= @monthStart)
    GROUP BY c.id
    ORDER BY c.sort_order, c.name
  `).all({ month, monthStart }) as Array<{
    category_id: number; category_name: string; colour: string
    is_fixed: number; sort_order: number; actual: number; budget: number
  }>

  // Daily spending (for chart, excluding transfers)
  const daily = db.prepare(`
    SELECT
      t.date,
      ROUND(SUM(t.amount * a.ownership_share), 2) AS daily_amount
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE strftime('%Y-%m', t.date) = @month
      AND t.amount > 0
      AND (t.is_transfer = 0 OR t.is_transfer IS NULL)
    GROUP BY t.date
    ORDER BY t.date
  `).all({ month }) as Array<{ date: string; daily_amount: number }>

  // Build cumulative with pace
  const variableBudget = categoryActuals
    .filter((c) => !c.is_fixed)
    .reduce((s, c) => s + c.budget, 0)

  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()

  let cumulative = 0
  const dailySpending = daily.map((d) => {
    cumulative = Math.round((cumulative + d.daily_amount) * 100) / 100
    const dayNum = parseInt(d.date.slice(8), 10)
    return {
      date: d.date,
      cumulative,
      pace: Math.round((variableBudget / daysInMonth) * dayNum * 100) / 100,
    }
  })

  // Total income (excluding transfers)
  const { total_income } = db.prepare(`
    SELECT COALESCE(ROUND(SUM(ABS(t.amount) * a.ownership_share), 2), 0) AS total_income
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE strftime('%Y-%m', t.date) = @month
      AND t.amount < 0
      AND (t.is_transfer = 0 OR t.is_transfer IS NULL)
  `).get({ month }) as { total_income: number }

  // Savings deposited this month (transfers going INTO savings accounts)
  const { savings_deposited } = db.prepare(`
    SELECT COALESCE(ROUND(SUM(ABS(t.amount) * COALESCE(t.ownership_share, a.ownership_share)), 2), 0) AS savings_deposited
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE strftime('%Y-%m', t.date) = @month
      AND t.amount < 0
      AND t.is_transfer = 1
      AND a.account_type = 'savings'
  `).get({ month }) as { savings_deposited: number }

  // Total spent (variable only)
  const totalSpent = categoryActuals
    .filter((c) => !c.is_fixed)
    .reduce((s, c) => s + c.actual, 0)

  // Fixed costs status (has a transaction appeared this month?)
  const fixedCosts = db.prepare(`
    SELECT
      c.id   AS category_id,
      c.name,
      c.colour,
      COALESCE(b.monthly_amount, 0) AS expected,
      CASE WHEN COUNT(t.id) > 0 THEN 1 ELSE 0 END AS paid
    FROM categories c
    JOIN budgets b
      ON b.category_id = c.id
      AND b.effective_from <= @monthStart
      AND (b.effective_to IS NULL OR b.effective_to >= @monthStart)
    LEFT JOIN transactions t
      ON t.category_id = c.id
      AND strftime('%Y-%m', t.date) = @month
      AND t.amount > 0
    WHERE c.is_fixed = 1
    GROUP BY c.id
    ORDER BY c.sort_order
  `).all({ month, monthStart })

  // Count uncategorised transactions (Other / misc) this month
  const otherCat = db.prepare(`SELECT id FROM categories WHERE name = 'Other / misc'`).get() as { id: number } | undefined
  let uncategorisedCount = 0
  if (otherCat) {
    const r = db.prepare(`
      SELECT COUNT(*) as n FROM transactions
      WHERE category_id = ? AND strftime('%Y-%m', date) = ?
    `).get(otherCat.id, month) as { n: number }
    uncategorisedCount = r.n
  }

  return {
    categoryActuals,
    dailySpending,
    fixedCosts,
    totalIncome: total_income,
    totalSpent: Math.round(totalSpent * 100) / 100,
    variableBudget,
    budgetTotal: categoryActuals.reduce((s, c) => s + c.budget, 0),
    daysInMonth,
    uncategorisedCount,
    savingsDeposited: savings_deposited,
  }
}

// ── Export / delete ───────────────────────────────────────────────────────────

export function exportAllData(): string {
  const rows = getDb().prepare(`
    SELECT t.date, t.description, a.name AS account, c.name AS category,
           ROUND(t.amount * a.ownership_share, 2) AS amount, t.notes
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    ORDER BY t.date DESC
  `).all() as Record<string, unknown>[]

  if (rows.length === 0) return 'date,description,account,category,amount,notes\n'

  const header = Object.keys(rows[0]).join(',')
  const lines = rows.map((r) =>
    Object.values(r)
      .map((v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`))
      .join(',')
  )
  return [header, ...lines].join('\n')
}

export function deleteAllData(): void {
  const db = getDb()
  db.transaction(() => {
    db.exec('DELETE FROM imports; DELETE FROM transactions;')
  })()
}
