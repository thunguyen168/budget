"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.setDb = setDb;
exports.categoriseTransaction = categoriseTransaction;
exports.getAccounts = getAccounts;
exports.addAccount = addAccount;
exports.updateAccount = updateAccount;
exports.importTransactions = importTransactions;
exports.getTransactions = getTransactions;
exports.updateTransaction = updateTransaction;
exports.detectTransfers = detectTransfers;
exports.applyTransfers = applyTransfers;
exports.toggleTransfer = toggleTransfer;
exports.getCategories = getCategories;
exports.updateCategory = updateCategory;
exports.addCategory = addCategory;
exports.deleteCategory = deleteCategory;
exports.getSavingsHistory = getSavingsHistory;
exports.getBudgets = getBudgets;
exports.updateBudget = updateBudget;
exports.getCategorisationRules = getCategorisationRules;
exports.addRule = addRule;
exports.updateRule = updateRule;
exports.deleteRule = deleteRule;
exports.getImportHistory = getImportHistory;
exports.getDashboardData = getDashboardData;
exports.exportAllData = exportAllData;
exports.deleteAllData = deleteAllData;
let _db = null;
function getDb() {
    if (!_db)
        throw new Error('Database not initialised');
    return _db;
}
function setDb(db) {
    _db = db;
}
// ── Categorisation ────────────────────────────────────────────────────────────
function categoriseTransaction(description, monzoCat) {
    const db = getDb();
    const rules = db.prepare(`
    SELECT r.keyword, r.category_id
    FROM categorisation_rules r
    ORDER BY r.priority DESC
  `).all();
    const descLower = description.toLowerCase();
    for (const rule of rules) {
        if (descLower.includes(rule.keyword.toLowerCase())) {
            return rule.category_id;
        }
    }
    // Fall back to "Other / misc"
    const other = db.prepare(`SELECT id FROM categories WHERE name = 'Other / misc'`).get();
    return other?.id ?? null;
}
// ── Accounts ──────────────────────────────────────────────────────────────────
function getAccounts() {
    return getDb().prepare('SELECT * FROM accounts ORDER BY id').all();
}
function addAccount(data) {
    const db = getDb();
    const r = db.prepare(`
    INSERT INTO accounts (name, bank_type, account_type, ownership_share) VALUES (?,?,?,?)
  `).run(data.name, data.bank_type, data.account_type, data.ownership_share);
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(r.lastInsertRowid);
}
function updateAccount(id, data) {
    getDb().prepare(`UPDATE accounts SET name = ?, account_type = ?, ownership_share = ? WHERE id = ?`)
        .run(data.name, data.account_type, data.ownership_share, id);
    return getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id);
}
function importTransactions(data) {
    const db = getDb();
    let imported = 0;
    let duplicates = 0;
    let uncategorised = 0;
    const checkExists = db.prepare('SELECT id FROM transactions WHERE external_id = ?');
    const insert = db.prepare(`
    INSERT INTO transactions
      (account_id, external_id, date, description, amount, original_amount, category_id, is_manually_categorised)
    VALUES (?,?,?,?,?,?,?,0)
  `);
    const otherCat = db.prepare(`SELECT id FROM categories WHERE name = 'Other / misc'`).get();
    db.transaction(() => {
        for (const tx of data.transactions) {
            const existing = checkExists.get(tx.external_id);
            if (existing) {
                duplicates++;
                continue;
            }
            const categoryId = categoriseTransaction(tx.description, tx.monzo_category);
            if (categoryId === otherCat?.id)
                uncategorised++;
            insert.run(data.accountId, tx.external_id, tx.date, tx.description, tx.amount, tx.original_amount, categoryId);
            imported++;
        }
        db.prepare(`
      INSERT INTO imports (account_id, filename, row_count, duplicates_skipped)
      VALUES (?,?,?,?)
    `).run(data.accountId, data.filename, imported, duplicates);
    })();
    return { imported, duplicates, uncategorised };
}
function getTransactions(filters = {}) {
    const db = getDb();
    const conditions = [];
    const params = {};
    if (filters.month) {
        conditions.push(`strftime('%Y-%m', t.date) = @month`);
        params.month = filters.month;
    }
    if (filters.category_id !== undefined && filters.category_id !== null) {
        conditions.push(`t.category_id = @category_id`);
        params.category_id = filters.category_id;
    }
    if (filters.account_id !== undefined) {
        conditions.push(`t.account_id = @account_id`);
        params.account_id = filters.account_id;
    }
    if (filters.search) {
        conditions.push(`t.description LIKE @search`);
        params.search = `%${filters.search}%`;
    }
    if (filters.min_amount !== undefined) {
        conditions.push(`(t.amount * a.ownership_share) >= @min_amount`);
        params.min_amount = filters.min_amount;
    }
    if (filters.max_amount !== undefined) {
        conditions.push(`(t.amount * a.ownership_share) <= @max_amount`);
        params.max_amount = filters.max_amount;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
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
  `).all(params);
}
function updateTransaction(id, updates) {
    const db = getDb();
    const fields = [];
    const params = { id };
    if (updates.category_id !== undefined) {
        fields.push('category_id = @category_id', 'is_manually_categorised = 1');
        params.category_id = updates.category_id;
    }
    if (updates.notes !== undefined) {
        fields.push('notes = @notes');
        params.notes = updates.notes;
    }
    if ('ownership_share' in updates) {
        fields.push('ownership_share = @ownership_share');
        params.ownership_share = updates.ownership_share;
    }
    if ('is_transfer' in updates) {
        fields.push('is_transfer = @is_transfer');
        params.is_transfer = updates.is_transfer;
    }
    if (fields.length === 0)
        return;
    db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = @id`).run(params);
}
function detectTransfers(windowDays = 5) {
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
  `).all({ windowDays });
}
function applyTransfers(txIds) {
    const db = getDb();
    const update = db.prepare('UPDATE transactions SET is_transfer = 1 WHERE id = ?');
    db.transaction(() => {
        for (const id of txIds)
            update.run(id);
    })();
}
function toggleTransfer(id) {
    getDb().prepare(`UPDATE transactions SET is_transfer = CASE WHEN is_transfer = 1 THEN 0 ELSE 1 END WHERE id = ?`).run(id);
}
// ── Categories ────────────────────────────────────────────────────────────────
function getCategories() {
    return getDb().prepare('SELECT * FROM categories ORDER BY sort_order, name').all();
}
function updateCategory(id, data) {
    const db = getDb();
    const existing = db.prepare(`SELECT id FROM categories WHERE name = ? AND id != ?`).get(data.name, id);
    if (existing)
        throw new Error(`A category named "${data.name}" already exists.`);
    db.prepare(`UPDATE categories SET name = ?, colour = ?, is_fixed = ? WHERE id = ?`).run(data.name, data.colour, data.is_fixed ? 1 : 0, id);
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}
function addCategory(data) {
    const db = getDb();
    const existing = db.prepare(`SELECT id FROM categories WHERE name = ?`).get(data.name);
    if (existing)
        throw new Error(`A category named "${data.name}" already exists.`);
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get().m ?? 0;
    const r = db.prepare(`
    INSERT INTO categories (name, colour, is_fixed, sort_order) VALUES (?,?,?,?)
  `).run(data.name, data.colour, data.is_fixed ? 1 : 0, maxOrder + 1);
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(r.lastInsertRowid);
}
function deleteCategory(id) {
    const db = getDb();
    db.transaction(() => {
        // Unassign any transactions using this category
        db.prepare('UPDATE transactions SET category_id = NULL, is_manually_categorised = 0 WHERE category_id = ?').run(id);
        // Remove budget entries for this category
        db.prepare('DELETE FROM budgets WHERE category_id = ?').run(id);
        // Remove categorisation rules for this category
        db.prepare('DELETE FROM categorisation_rules WHERE category_id = ?').run(id);
        // Delete the category
        db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    })();
}
function getSavingsHistory() {
    return getDb().prepare(`
    SELECT
      strftime('%Y-%m', t.date) AS month,
      ROUND(SUM(ABS(t.amount) * COALESCE(t.ownership_share, a.ownership_share)), 2) AS amount
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE t.amount < 0
      AND t.is_transfer = 1
      AND a.account_type = 'savings'
    GROUP BY strftime('%Y-%m', t.date)
    ORDER BY month ASC
  `).all();
}
// ── Budgets ───────────────────────────────────────────────────────────────────
function getBudgets(forDate) {
    const db = getDb();
    const date = forDate ?? new Date().toISOString().slice(0, 10);
    return db.prepare(`
    SELECT b.*, c.name AS category_name, c.colour, c.is_fixed, c.sort_order
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    WHERE b.effective_from <= @date
      AND (b.effective_to IS NULL OR b.effective_to >= @date)
    ORDER BY c.sort_order, c.name
  `).all({ date });
}
function updateBudget(id, monthly_amount) {
    getDb().prepare('UPDATE budgets SET monthly_amount = ? WHERE id = ?').run(monthly_amount, id);
}
// ── Rules ─────────────────────────────────────────────────────────────────────
function getCategorisationRules() {
    return getDb().prepare(`
    SELECT r.*, c.name AS category_name
    FROM categorisation_rules r
    JOIN categories c ON r.category_id = c.id
    ORDER BY r.priority DESC, r.keyword
  `).all();
}
function addRule(data) {
    const db = getDb();
    const r = db.prepare(`
    INSERT INTO categorisation_rules (keyword, category_id, priority) VALUES (?,?,?)
  `).run(data.keyword, data.category_id, data.priority);
    return db.prepare(`
    SELECT r.*, c.name AS category_name FROM categorisation_rules r
    JOIN categories c ON r.category_id = c.id WHERE r.id = ?
  `).get(r.lastInsertRowid);
}
function updateRule(id, data) {
    getDb().prepare(`UPDATE categorisation_rules SET keyword = ?, category_id = ?, priority = ? WHERE id = ?`)
        .run(data.keyword, data.category_id, data.priority, id);
    return getDb().prepare(`
    SELECT r.*, c.name AS category_name FROM categorisation_rules r
    JOIN categories c ON r.category_id = c.id WHERE r.id = ?
  `).get(id);
}
function deleteRule(id) {
    getDb().prepare('DELETE FROM categorisation_rules WHERE id = ?').run(id);
}
// ── Import history ────────────────────────────────────────────────────────────
function getImportHistory() {
    return getDb().prepare(`
    SELECT i.*, a.name AS account_name, a.bank_type
    FROM imports i
    JOIN accounts a ON i.account_id = a.id
    ORDER BY i.imported_at DESC
  `).all();
}
// ── Dashboard ─────────────────────────────────────────────────────────────────
function getDashboardData(month) {
    const db = getDb();
    const monthStart = `${month}-01`;
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
  `).all({ month, monthStart });
    // Raw daily spending from DB (only days that have transactions)
    const rawDaily = db.prepare(`
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
  `).all({ month });
    // Variable budget total
    const variableBudget = categoryActuals
        .filter((c) => !c.is_fixed)
        .reduce((s, c) => s + c.budget, 0);
    // ── KEY FIX: Fill every day so the pace line never disappears ─────────────
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === y && (today.getMonth() + 1) === m;
    // For the current month only go up to today; for past months fill the whole month
    const lastDay = isCurrentMonth ? today.getDate() : daysInMonth;
    const dailyMap = new Map(rawDaily.map((d) => [d.date, d.daily_amount]));
    let cumulative = 0;
    const dailySpending = [];
    for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${month}-${String(day).padStart(2, '0')}`;
        const dayAmt = dailyMap.get(dateStr) ?? 0;
        cumulative = Math.round((cumulative + dayAmt) * 100) / 100;
        dailySpending.push({
            date: dateStr,
            cumulative,
            pace: Math.round((variableBudget / daysInMonth) * day * 100) / 100,
        });
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Total income (excluding transfers)
    const { total_income } = db.prepare(`
    SELECT COALESCE(ROUND(SUM(ABS(t.amount) * a.ownership_share), 2), 0) AS total_income
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE strftime('%Y-%m', t.date) = @month
      AND t.amount < 0
      AND (t.is_transfer = 0 OR t.is_transfer IS NULL)
  `).get({ month });
    // Savings deposited this month
    const { savings_deposited } = db.prepare(`
    SELECT COALESCE(ROUND(SUM(ABS(t.amount) * COALESCE(t.ownership_share, a.ownership_share)), 2), 0) AS savings_deposited
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE strftime('%Y-%m', t.date) = @month
      AND t.amount < 0
      AND t.is_transfer = 1
      AND a.account_type = 'savings'
  `).get({ month });
    // Total spent (variable only)
    const totalSpent = categoryActuals
        .filter((c) => !c.is_fixed)
        .reduce((s, c) => s + c.actual, 0);
    // Fixed costs status
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
  `).all({ month, monthStart });
    // Uncategorised count
    const otherCat = db.prepare(`SELECT id FROM categories WHERE name = 'Other / misc'`).get();
    let uncategorisedCount = 0;
    if (otherCat) {
        const r = db.prepare(`
      SELECT COUNT(*) as n FROM transactions
      WHERE category_id = ? AND strftime('%Y-%m', date) = ?
    `).get(otherCat.id, month);
        uncategorisedCount = r.n;
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
    };
}
// ── Export / delete ───────────────────────────────────────────────────────────
function exportAllData() {
    const rows = getDb().prepare(`
    SELECT t.date, t.description, a.name AS account, c.name AS category,
           ROUND(t.amount * a.ownership_share, 2) AS amount, t.notes
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    ORDER BY t.date DESC
  `).all();
    if (rows.length === 0)
        return 'date,description,account,category,amount,notes\n';
    const header = Object.keys(rows[0]).join(',');
    const lines = rows.map((r) => Object.values(r)
        .map((v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`))
        .join(','));
    return [header, ...lines].join('\n');
}
function deleteAllData() {
    const db = getDb();
    db.transaction(() => {
        db.exec('DELETE FROM imports; DELETE FROM transactions;');
    })();
}
