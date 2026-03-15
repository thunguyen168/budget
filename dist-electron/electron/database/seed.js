"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
function seedDatabase(db) {
    const alreadySeeded = db.prepare('SELECT COUNT(*) as n FROM categories').get().n > 0;
    if (alreadySeeded)
        return;
    // ── Accounts ────────────────────────────────────────────────────────────────
    const insertAccount = db.prepare(`
    INSERT INTO accounts (name, bank_type, ownership_share) VALUES (?,?,?)
  `);
    db.transaction(() => {
        insertAccount.run('Monzo Joint', 'monzo', 0.5);
        insertAccount.run('Amex', 'amex', 1.0);
        insertAccount.run('Nationwide', 'nationwide', 1.0);
    })();
    // ── Categories ──────────────────────────────────────────────────────────────
    const insertCat = db.prepare(`
    INSERT INTO categories (name, colour, is_fixed, sort_order) VALUES (?,?,?,?)
  `);
    const fixedCats = [
        ['Mortgage', '#1d4ed8', 1],
        ['Council Tax', '#1e40af', 2],
        ['Creation', '#1e3a8a', 3],
        ['British Gas', '#f97316', 4],
        ['Water', '#0ea5e9', 5],
        ['Sky', '#7c3aed', 6],
        ['Lloyds Bank', '#065f46', 7],
        ['Vitality Life', '#be185d', 8],
        ['Animal Friends', '#92400e', 9],
        ['Three', '#dc2626', 10],
        ['TapTap to Mum', '#7c2d12', 11],
    ];
    const varCats = [
        ['Transport', '#0891b2', 12],
        ['Groceries', '#16a34a', 13],
        ['Other / misc', '#6b7280', 14],
        ['Eating out', '#ea580c', 15],
        ['Emergency buffer', '#ca8a04', 16],
        ['Shopping', '#db2777', 17],
        ['Health / personal care', '#0d9488', 18],
        ['Subscriptions', '#8b5cf6', 19],
        ['Travel', '#64748b', 20],
        ['Transfer', '#94a3b8', 21],
        ['Income', '#22c55e', 22],
    ];
    const catIds = {};
    db.transaction(() => {
        for (const [name, colour, order] of fixedCats) {
            const r = insertCat.run(name, colour, 1, order);
            catIds[name] = r.lastInsertRowid;
        }
        for (const [name, colour, order] of varCats) {
            const r = insertCat.run(name, colour, 0, order);
            catIds[name] = r.lastInsertRowid;
        }
    })();
    // ── Budgets ─────────────────────────────────────────────────────────────────
    const insertBudget = db.prepare(`
    INSERT INTO budgets (category_id, monthly_amount, effective_from, effective_to)
    VALUES (?,?,?,?)
  `);
    const FROM = '2024-01-01';
    db.transaction(() => {
        insertBudget.run(catIds['Mortgage'], 615, FROM, null);
        insertBudget.run(catIds['Council Tax'], 87, FROM, null);
        insertBudget.run(catIds['Creation'], 105, FROM, '2026-10-31');
        insertBudget.run(catIds['British Gas'], 42, FROM, null);
        insertBudget.run(catIds['Water'], 17, FROM, null);
        insertBudget.run(catIds['Sky'], 14, FROM, null);
        insertBudget.run(catIds['Lloyds Bank'], 14, FROM, null);
        insertBudget.run(catIds['Vitality Life'], 9, FROM, null);
        insertBudget.run(catIds['Animal Friends'], 4, FROM, null);
        insertBudget.run(catIds['Three'], 12, FROM, null);
        insertBudget.run(catIds['TapTap to Mum'], 200, FROM, null);
        insertBudget.run(catIds['Transport'], 280, FROM, null);
        insertBudget.run(catIds['Groceries'], 200, FROM, null);
        insertBudget.run(catIds['Other / misc'], 200, FROM, null);
        insertBudget.run(catIds['Eating out'], 50, FROM, null);
        insertBudget.run(catIds['Emergency buffer'], 50, FROM, null);
        insertBudget.run(catIds['Shopping'], 40, FROM, null);
        insertBudget.run(catIds['Health / personal care'], 30, FROM, null);
        insertBudget.run(catIds['Subscriptions'], 24, FROM, null);
    })();
    // ── Categorisation rules ────────────────────────────────────────────────────
    const insertRule = db.prepare(`
    INSERT INTO categorisation_rules (keyword, category_id, priority) VALUES (?,?,?)
  `);
    // priority 100 = fixed-cost exact matches (checked first)
    // priority 50  = variable merchant matches
    const rules = [
        // Fixed costs (high priority)
        ['nationwide mortgage', 'Mortgage', 100],
        ['mortgage', 'Mortgage', 90],
        ['mid sussex district', 'Council Tax', 100],
        ['council tax', 'Council Tax', 90],
        ['creation', 'Creation', 100],
        ['british gas', 'British Gas', 100],
        ['south east water', 'Water', 100],
        ['water', 'Water', 80],
        ['sky', 'Sky', 100],
        ['lloyds bank', 'Lloyds Bank', 100],
        ['vitality', 'Vitality Life', 100],
        ['animal friends', 'Animal Friends', 100],
        ['three mobile', 'Three', 100],
        ['taptap', 'TapTap to Mum', 100],
        ['taptap send', 'TapTap to Mum', 110],
        // Groceries
        ['waitrose', 'Groceries', 50],
        ['tesco', 'Groceries', 50],
        ['sainsbury', 'Groceries', 50],
        ['aldi', 'Groceries', 50],
        ['lidl', 'Groceries', 50],
        ['co-op', 'Groceries', 50],
        ['coop', 'Groceries', 50],
        ['m&s food', 'Groceries', 50],
        ['marks & spencer food', 'Groceries', 50],
        ['asda', 'Groceries', 50],
        ['ocado', 'Groceries', 50],
        // Transport
        ['trainline', 'Transport', 50],
        ['tfl', 'Transport', 50],
        ['southern rail', 'Transport', 50],
        ['govia', 'Transport', 50],
        ['stagecoach', 'Transport', 50],
        ['brighton bus', 'Transport', 50],
        ['oyster', 'Transport', 50],
        ['uber', 'Transport', 50],
        ['taxi', 'Transport', 50],
        ['bolt', 'Transport', 50],
        // Eating out
        ['pret', 'Eating out', 50],
        ['nando', 'Eating out', 50],
        ['wagamama', 'Eating out', 50],
        ['restaurant', 'Eating out', 40],
        ['cafe', 'Eating out', 40],
        ['coffee', 'Eating out', 40],
        ['pizza', 'Eating out', 50],
        ['mcdonald', 'Eating out', 50],
        ['kfc', 'Eating out', 50],
        ['gails', 'Eating out', 50],
        ['leon', 'Eating out', 50],
        ['itsu', 'Eating out', 50],
        ['eat.', 'Eating out', 50],
        ['costa', 'Eating out', 50],
        ['starbucks', 'Eating out', 50],
        // Shopping
        ['ebay', 'Shopping', 50],
        ['etsy', 'Shopping', 50],
        ['amazon', 'Shopping', 50],
        ['asos', 'Shopping', 50],
        ['zara', 'Shopping', 50],
        ['h&m', 'Shopping', 50],
        ['reformation', 'Shopping', 50],
        ['uniqlo', 'Shopping', 50],
        ['next', 'Shopping', 40],
        // Subscriptions
        ['apple.com', 'Subscriptions', 50],
        ['anthropic', 'Subscriptions', 50],
        ['netflix', 'Subscriptions', 50],
        ['spotify', 'Subscriptions', 50],
        ['disney', 'Subscriptions', 50],
        ['youtube', 'Subscriptions', 50],
        ['google one', 'Subscriptions', 50],
        // Health
        ['holland', 'Health / personal care', 50],
        ['boots', 'Health / personal care', 50],
        ['pharmacy', 'Health / personal care', 50],
        ['dentist', 'Health / personal care', 50],
        ['optician', 'Health / personal care', 50],
        ['lush', 'Health / personal care', 50],
        ['boulder', 'Health / personal care', 50],
        ['gym', 'Health / personal care', 40],
        ['hair', 'Health / personal care', 40],
        // Travel (over-budget alert only)
        ['booking.com', 'Travel', 50],
        ['airbnb', 'Travel', 50],
        ['emirates', 'Travel', 50],
        ['kenya airways', 'Travel', 50],
        ['vueling', 'Travel', 50],
        ['wightlink', 'Travel', 50],
        ['hotel', 'Travel', 40],
        // Transfers (negative amounts / payments)
        ['payment received', 'Transfer', 30],
        ['balance transfer', 'Transfer', 30],
        ['amex payment', 'Transfer', 30],
    ];
    db.transaction(() => {
        for (const [keyword, catName, priority] of rules) {
            if (catIds[catName] !== undefined) {
                insertRule.run(keyword, catIds[catName], priority);
            }
        }
    })();
}
