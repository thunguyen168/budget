"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSchema = createSchema;
function createSchema(db) {
    db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bank_type TEXT NOT NULL CHECK (bank_type IN ('monzo','amex','nationwide')),
      ownership_share REAL NOT NULL DEFAULT 1.0,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      colour TEXT NOT NULL DEFAULT '#6366f1',
      is_fixed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 99
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      monthly_amount REAL NOT NULL,
      effective_from DATE NOT NULL,
      effective_to DATE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      external_id TEXT NOT NULL UNIQUE,
      date DATE NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      original_amount REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      is_manually_categorised INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      filename TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      duplicates_skipped INTEGER NOT NULL DEFAULT 0,
      imported_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categorisation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      priority INTEGER NOT NULL DEFAULT 10
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions(external_id);
  `);
    // Migrations for existing databases
    const txCols = db.prepare(`PRAGMA table_info(transactions)`).all().map((c) => c.name);
    if (!txCols.includes('ownership_share')) {
        db.exec(`ALTER TABLE transactions ADD COLUMN ownership_share REAL`);
    }
    if (!txCols.includes('is_transfer')) {
        db.exec(`ALTER TABLE transactions ADD COLUMN is_transfer INTEGER NOT NULL DEFAULT 0`);
    }
    const accCols = db.prepare(`PRAGMA table_info(accounts)`).all().map((c) => c.name);
    if (!accCols.includes('account_type')) {
        db.exec(`ALTER TABLE accounts ADD COLUMN account_type TEXT NOT NULL DEFAULT 'spending'`);
        // Set sensible defaults for seeded accounts based on bank_type
        db.exec(`UPDATE accounts SET account_type = 'credit' WHERE bank_type = 'amex'`);
    }
}
