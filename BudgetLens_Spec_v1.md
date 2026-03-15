# BudgetLens — Personal Finance Dashboard

## Product specification v1.0

---

## 1. Overview

BudgetLens is a desktop application for personal finance management. It allows the user to upload CSV bank statements from three specific UK bank accounts (Monzo, Amex, Nationwide), automatically categorises transactions, tracks spending against a predefined monthly budget, and provides a visual dashboard showing how actual spending compares to targets. It also alerts the user when spending in any category is approaching or exceeding the budget.

### 1.1 Core user story

As someone who has recently moved from a higher salary to a lower one, I want to upload my bank statements each month and instantly see whether I'm on track with my budget, so I can catch overspending early and adjust before it becomes a problem.

### 1.2 Key principles

- **Simple to use**: Upload CSVs, see results. No manual data entry.
- **Opinionated defaults**: Pre-loaded with the user's actual budget (see Section 5). Customisable later.
- **Honest and clear**: Show exactly where money is going — no hiding behind averages.
- **Desktop-first**: Built as an Electron app (or similar) that runs locally. All data stays on the user's machine.

---

## 2. Tech stack (recommended)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Electron + React | Cross-platform desktop, rich UI, good ecosystem |
| Language | TypeScript | Type safety for financial data handling |
| Styling | Tailwind CSS | Fast, consistent styling |
| Charts | Recharts or Chart.js | Flexible, well-documented charting |
| Data storage | SQLite (via better-sqlite3) | Local, no server needed, SQL for queries |
| CSV parsing | PapaParse | Robust CSV parser, handles edge cases |
| Date handling | date-fns | Lightweight date utilities |

All data is stored locally in a SQLite database on disk. No cloud services, no accounts, no login.

---

## 3. Data model

### 3.1 Tables

**accounts**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | e.g. "Monzo Joint", "Amex", "Nationwide" |
| bank_type | TEXT | ENUM: "monzo", "amex", "nationwide" |
| ownership_share | REAL | 0.0 to 1.0 — the user's share of this account (e.g. 0.5 for joint) |
| created_at | DATETIME | |

**transactions**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| account_id | INTEGER FK | References accounts.id |
| external_id | TEXT UNIQUE | Dedup key (transaction ID from bank, or hash of date+amount+description) |
| date | DATE | Transaction date |
| description | TEXT | Raw description from bank statement |
| amount | REAL | Positive = money out (spending), normalised across all banks |
| original_amount | REAL | Raw amount as it appears in the CSV |
| category_id | INTEGER FK | References categories.id |
| is_manually_categorised | BOOLEAN | Whether the user overrode the auto-category |
| notes | TEXT | Optional user notes |
| created_at | DATETIME | |

**categories**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | e.g. "Groceries", "Transport", "Eating out" |
| colour | TEXT | Hex colour for charts |
| is_fixed | BOOLEAN | TRUE = fixed cost (mortgage, bills), FALSE = variable |
| sort_order | INTEGER | Display order |

**budgets**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| category_id | INTEGER FK | References categories.id |
| monthly_amount | REAL | Target monthly spend |
| effective_from | DATE | When this budget starts (allows changing budgets over time) |
| effective_to | DATE NULL | NULL = current budget |

**imports**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| account_id | INTEGER FK | |
| filename | TEXT | Original filename |
| row_count | INTEGER | Rows imported |
| duplicates_skipped | INTEGER | Already-existing transactions skipped |
| imported_at | DATETIME | |

### 3.2 Deduplication

Each transaction gets a unique external_id:
- **Monzo**: Use the "Transaction ID" field directly (globally unique).
- **Amex**: Hash of (date + description + amount) since Amex CSVs have no transaction ID.
- **Nationwide**: Hash of (date + description + paid_out + paid_in + balance).

On import, skip any transaction whose external_id already exists. Report the count of duplicates skipped to the user.

---

## 4. CSV parsers

Each bank has a different CSV format. The app needs three dedicated parsers. Each parser must:
1. Detect and validate the file format (check headers match expected pattern).
2. Handle encoding (Nationwide uses Latin-1, not UTF-8).
3. Normalise amounts so that spending is always positive and income is always negative (internally).
4. Auto-categorise each transaction (see Section 6).
5. Return a structured array of transaction objects.

### 4.1 Monzo parser

| CSV field | Maps to |
|-----------|---------|
| Transaction ID | external_id |
| Date (dd/mm/yyyy) | date |
| Name | description (primary) |
| Category | Use for auto-categorisation hints |
| Amount | Negative = spending. Flip sign so spending is positive. |
| Money Out | Alternative amount source |
| Money In | Income (store as negative) |

**Notes**: Monzo includes a Category field — use this as a hint for auto-categorisation but allow overrides. The Monzo file is UTF-8 encoded.

### 4.2 Amex parser

| CSV field | Maps to |
|-----------|---------|
| Date (dd/mm/yyyy) | date |
| Description | description |
| Amount | Positive = spending (already correct). Negative = payment to Amex (ignore or categorise as transfer). |

**Notes**: Amex has no transaction ID — generate external_id as hash. Amex CSVs are simple 3-column files. Negative amounts are payments to the card — categorise these as "Transfer" and exclude from spending analysis.

### 4.3 Nationwide parser

| CSV field | Maps to |
|-----------|---------|
| Date (dd Mon yyyy) | date — note different date format |
| Transaction type | Use for categorisation hints |
| Description | description |
| Paid out | Spending amount (strip £ sign and commas) |
| Paid in | Income (store as negative) |
| Balance | Do not import, but could display for reference |

**Notes**: File is Latin-1 encoded (not UTF-8 — must convert). First 4 rows are account metadata (name, balance) — skip them. The header row starts with "Date","Transaction type". Amounts include £ symbols and commas that need stripping.

---

## 5. Default budget

Pre-load the app with the following budget based on the user's actual financial analysis. All amounts are monthly. The user should be able to edit these at any time.

### 5.1 Fixed costs (user's 50% share of joint account + personal)

| Category | Monthly budget | Notes |
|----------|---------------|-------|
| Mortgage | £615 | 50% share |
| Council tax | £87 | 50% share |
| Creation | £105 | 50% share. Ends October 2026 — set effective_to date |
| British Gas | £42 | 50% share |
| Water | £17 | 50% share |
| Sky | £14 | 50% share |
| Lloyds Bank | £14 | 50% share |
| Vitality Life | £9 | 50% share |
| Animal Friends | £4 | 50% share |
| Three (mobile) | £12 | 50% share |
| TapTap to mum | £200 | Personal — sent via TapTap Send |

**Total fixed: £1,118/month**

### 5.2 Variable costs

| Category | Monthly budget |
|----------|---------------|
| Transport | £280 |
| Groceries | £200 |
| Other / misc | £200 |
| Eating out | £50 |
| Emergency buffer | £50 |
| Shopping | £40 |
| Health / personal care | £30 |
| Subscriptions | £24 |

**Total variable: £874/month**

**Grand total: £1,992/month** (from take-home of £2,213)

---

## 6. Auto-categorisation

### 6.1 Rules engine

Use keyword matching on the transaction description to assign categories. The rules should be stored in the database (not hardcoded) so the user can add/edit them.

**categorisation_rules table:**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | |
| keyword | TEXT | Substring to match (case-insensitive) |
| category_id | INTEGER FK | Category to assign |
| priority | INTEGER | Higher = checked first (allows specific rules to override general ones) |

### 6.2 Default rules (pre-loaded)

| Keyword(s) | Category |
|------------|----------|
| Nationwide Mortgages | Mortgage |
| Mid Sussex District Council | Council tax |
| Creation | Creation |
| British Gas | British Gas |
| South East Water | Water |
| Sky | Sky |
| Lloyds Bank | Lloyds Bank |
| Vitality Life | Vitality Life |
| Animal Friends | Animal Friends |
| Three (mobile provider match) | Three |
| TapTap | TapTap to mum |
| Waitrose, Tesco, Sainsbury, Aldi, Lidl, Co-op, M&S Food, Asda, Ocado | Groceries |
| Trainline, TFL, Southern, Uber, Brighton Buses, Stagecoach, Govia, taxi, Oyster | Transport |
| Pret, Nando, Wagamama, restaurant, cafe, coffee, Pizza, McDonald, KFC, Gails, EAT, Itsu, Leon | Eating out |
| eBay, Etsy, Amazon, Asos, Zara, H&M, Reformation, Uniqlo, Next | Shopping |
| Apple.com, Anthropic, Netflix, Spotify, Disney, YouTube | Subscriptions |
| Holland, Boots, pharmacy, hair, dentist, optician, Lush, Boulder | Health / personal care |
| Booking.com, Hotels, Airbnb, Emirates, Kenya Airways, Vueling, Wightlink | Travel (over-budget alert only — no active budget) |

### 6.3 Categorisation flow

1. Check if external_id already exists → skip (duplicate).
2. Run keyword rules in priority order → first match wins.
3. If no match → assign to "Other / misc".
4. User can manually re-categorise any transaction. When they do, set is_manually_categorised = TRUE and the rule engine will not override it on future imports.
5. Optionally: when a user re-categorises a transaction, offer to create a new rule from that description for future auto-matching.

---

## 7. User interface

### 7.1 Navigation

Sidebar with four sections:
1. **Dashboard** (home screen)
2. **Transactions** (searchable list)
3. **Budget** (edit budget targets)
4. **Import** (upload CSVs)

### 7.2 Dashboard screen

This is the main screen the user sees. It should answer the question: "Am I on track this month?"

**Top bar:**
- Month/year selector (dropdown or arrows to navigate between months).
- Summary cards showing: Total income | Total spent | Budget remaining | Days left in month.

**Budget vs actual — bar chart:**
- Horizontal grouped bar chart.
- Each category as a row.
- Two bars per row: budget (muted/outline) and actual (filled).
- Bar colour changes to red/warning when actual exceeds budget.
- Only show variable categories here (fixed costs are predictable and less useful to chart).

**Spending over time — line/area chart:**
- Cumulative daily spending line for the current month.
- Overlay with a "pace line" showing where you should be if spending evenly across the month (budget ÷ days in month × day number).
- If the spending line is above the pace line, the user is ahead of budget (overspending).

**Fixed costs status:**
- Simple checklist or pill badges.
- Each fixed cost: name + expected amount + tick (paid) or clock (pending).
- Automatically detected from transactions matching the bill name.

**Category breakdown — donut/pie chart:**
- Total variable spending by category for the selected month.
- Clicking a segment filters the transactions list.

### 7.3 Transactions screen

- Sortable, filterable table of all transactions.
- Columns: Date | Description | Account | Category | Amount (your share).
- Filters: by account, by category, by date range, by amount range.
- Search bar for description text.
- Click any transaction to edit its category or add notes.
- "Your share" column shows amount × account ownership_share.
- Colour-code or badge uncategorised transactions ("Other / misc") to prompt the user to categorise them.

### 7.4 Budget screen

- Editable table of all categories and their monthly targets.
- Toggle between fixed and variable view.
- Inline editing — click a number to change it.
- Show effective_from / effective_to for time-limited budgets (like Creation ending Oct 2026).
- "Add category" and "Edit rules" buttons.
- Display total budget vs take-home salary, with the headroom calculated live as the user edits.

### 7.5 Import screen

- Drag-and-drop area or file picker.
- Auto-detect which bank the CSV is from (by checking headers).
- Show a preview of the first 5 transactions before confirming import.
- After import: summary showing rows imported, duplicates skipped, uncategorised count.
- Import history log (table of past imports with date, file, row count).

---

## 8. Alerts and warnings

The app should surface alerts in two places: on the dashboard as banners, and optionally as system notifications (Electron native notifications).

| Alert | Trigger | Severity |
|-------|---------|----------|
| Category over budget | Actual spend > budget for any variable category | Red banner |
| Category near budget | Actual spend > 80% of budget with 10+ days left in month | Amber banner |
| Pace warning | Cumulative daily spend is 20%+ above the pace line | Amber banner |
| Uncategorised transactions | More than 5 transactions in "Other / misc" this month | Info banner |
| Bill not yet paid | A fixed cost has not appeared by the 10th of the month | Info banner |
| Budget surplus | Underspend in a category at month end | Green banner (positive reinforcement) |

---

## 9. Ownership share handling

This is critical to get right. The Monzo account is a joint account where the user contributes 50%.

- Each account has an ownership_share (0.0 to 1.0).
- Default: Monzo = 0.5, Amex = 1.0, Nationwide = 1.0.
- When displaying amounts and calculating budget comparisons, always multiply: displayed_amount = transaction.amount × account.ownership_share.
- The budget targets are already set to the user's share (e.g. mortgage budget is £615, which is 50% of £1,229.20).
- Charts, totals, and alerts all use the share-adjusted amounts.

---

## 10. Data handling and privacy

- All data stored locally in SQLite. No cloud sync, no telemetry, no analytics.
- Database file location: user's app data directory (e.g. ~/Library/Application Support/BudgetLens/ on Mac).
- CSV files are parsed in memory and not stored after import — only the extracted transactions go to the database.
- Provide a "Export all data" option (CSV export of transactions table).
- Provide a "Delete all data" option with confirmation.

---

## 11. Future enhancements (out of scope for v1, but design for extensibility)

- Support for additional bank CSV formats (plug-in parser architecture).
- Monthly summary report generation (PDF export).
- Year-over-year comparison views.
- Savings goals tracking.
- Recurring transaction detection and forecasting.
- Dark mode / light mode toggle.

---

## 12. Acceptance criteria (definition of done)

The app is complete when:

1. The user can import CSV files from all three banks without errors.
2. Duplicate transactions are correctly detected and skipped.
3. At least 80% of transactions are auto-categorised correctly using the default rules.
4. The dashboard displays budget vs actual for the current month with correct share-adjusted amounts.
5. Alerts fire correctly when categories exceed 80% or 100% of budget.
6. The user can manually re-categorise any transaction and the change persists.
7. The user can edit budget amounts and see the dashboard update immediately.
8. The app runs as a standalone desktop application with no internet connection required.
9. All financial calculations are accurate to the penny (use appropriate rounding — 2 decimal places).
