# SmartBiz | Complete Business Accounting, Inventory & AI-Powered Ledger Web App

A production-grade, full-stack business accounting and management platform built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **PostgreSQL**, **Prisma ORM**, **Decimal-safe calculations (`decimal.js`)**, a transaction-backed **inventory stock ledger**, strict **double-entry accounting engine**, and an **AI-powered document, camera, and voice data entry system** with human review workflows.

---

## 🌟 Key Capabilities & Modules

### 1. Business Owner Dashboard (`/`)
- **12 Live Financial Cards**: Today's Sales, Purchases, Receipts, Disbursements, Expenses, Gross Profit, Total Receivables, Total Payables, Inventory Valuation, Cash Balance, Bank Balance, and Net Profit.
- **Cash Flow & Operational Comparison**: Real-time comparative charts for sales vs. purchases vs. expenses.
- **Stock Alert Feed**: Immediate warning flags when catalog items hit minimum re-order thresholds.
- **Global Date Range Selector**: Filter metrics across Today, Yesterday, This Week, This Month, Last Month, or Custom Date Ranges.

### 2. Sales & Customer Invoicing (`/sales`, `/sales/create`, `/sales/[id]`)
- Itemized sales invoices with automatic sequential numbering (`INV-YYYY-XXXXX`).
- Live inventory lookup per line item with real-time stock indicator badges.
- Configurable negative stock policy (blocks selling unavailable stock by default).
- Support for **Walk-in Customers** and registered credit accounts.
- Automated balance tracking: cash receipts vs. customer receivables.
- **Atomic Double-Entry Posting**:
  - Debit: Cash / Bank (for paid amount)
  - Debit: Accounts Receivable (`1100`) (for credit amount)
  - Credit: Sales Revenue (`4010`) (for total invoice)
  - Perpetual Cost Entry: Debit COGS (`5010`), Credit Inventory (`1200`).
- Return & reversal workflows that automatically restock inventory via `SALE_RETURN` and credit customer ledgers.

### 3. Purchases & Supplier Inward Bills (`/purchases`, `/purchases/create`)
- Inward stock recording with supplier billing (`PUR-YYYY-XXXXX`).
- Automatic **Weighted Average Cost (WAC)** valuation adjustment on every receipt:
  $$\text{WAC} = \frac{(\text{Current Stock} \times \text{Current Cost}) + (\text{Inward Qty} \times \text{Unit Cost})}{\text{Current Stock} + \text{Inward Qty}}$$
- Immediate supplier payable tracking and cash/bank deductions.
- Double-entry posting: Debit Inventory (`1200`), Credit Cash/Bank & Accounts Payable (`2010`).

### 4. Real Inventory & Stock Movements Ledger (`/inventory`)
- Real transaction ledger: **Closing Stock = Opening Stock + Stock In - Stock Out + Adjustments**.
- Product catalog with SKU, Barcodes, Unit measurements, and cost/price margins.
- Stock Adjustments: Audits for physical count discrepancy, breakage, expiry, and write-offs with automatic loss/gain journals.
- CSV import and export for product catalogs and valuation schedules.

### 5. Customers & Suppliers Directory (`/customers`, `/suppliers`)
- Complete party profiles with credit limits, phone, address, and running balance.
- Party Ledger statement view detailing invoice history, payment receipts, and balance due.

### 6. Payments Hub (`/payments`)
- **Money Received**: Customer receipts allocated to specific sale invoices or general accounts.
- **Money Paid**: Vendor disbursements against purchase bills.
- **Account Transfers**: Inter-account fund transfers (Cash to Bank, Bank to Cash) with balanced journals.

### 7. Operating Expenses Tracker (`/expenses`)
- Categorized expense tracking (Rent, Salaries, Electricity, Fuel, Transport, Maintenance, Office Supplies, etc.).
- Balanced journal entry: Debit Expense Account, Credit Cash/Bank Account.

### 8. Double-Entry Accounting Engine (`/accounting`)
- Standard **Chart of Accounts** (Assets `1000s`, Liabilities `2000s`, Equity `3000s`, Revenue `4000s`, COGS `5000s`, Expenses `6000s`).
- Strict balance constraint: $\sum \text{Debits} \equiv \sum \text{Credits}$ validated before any journal entry is saved.
- General Journal Entries viewer with debit/credit balance indicators.
- Live **Trial Balance** statement.

### 9. AI Document, Camera & Voice Data Entry (`/ai-entry`)
- **3 Input Tabs**:
  1. **Daily Diary Notes**: Parses free-form daily accounting diaries in **English, Urdu, and Roman Urdu** (e.g. *"Ali Traders ko 25,000 ki sale hui, 10,000 cash received"*).
  2. **Picture & Camera Capture**: Live WebRTC camera capture or file upload for receipts and handwritten slips.
  3. **Voice Accounting**: Microphone recording with Web Speech API real-time transcript.
- **Party & Product Matching**: Fuzzy matching against existing customer and product records.
- **Duplicate Detection**: Flags identical transactions with warning badges.
- **Mandatory Review Screen**: Never silently posts transactions. Users review confidence scores, warnings, and approve individual or batch entries.

### 10. Comprehensive Business Reports (`/reports`)
- **Daily Report** (`/reports/daily`): Interactive itemized daily closing report with sales, purchases, receipts, disbursements, expenses, stock movements, and net cash movement.
- **Weekly Report** (`/reports/weekly`): Day-by-day charts and turnover metrics.
- **Monthly Business Closing Engine** (`/reports/monthly-closing`):
  - Sections A through K: Sales, Purchases, Customer Receivables, Supplier Payables, Receipts, Disbursements, Expenses by category, Inventory Closing valuation, Profit & Loss statement, Balance Sheet snapshot, Cash Flow.
  - **Section L: Pre-Closing Audit & Period Locking**: Detects unposted drafts and negative stock. Allows closing and locking the month to prevent retroactive tampering, with controlled administrative reopening.
- **Profit & Loss Statement** (`/reports/profit-loss`): Revenue, COGS, Gross Margin %, Operating Expenses, and Net Profit.
- **Balance Sheet** (`/reports/balance-sheet`): Statement of financial position ($Assets = Liabilities + Equity$).
- **Cash Flow Statement** (`/reports/cash-flow`): Operating cash flow movements.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js 14 (App Router) | Server Actions, API Routes, SSR & React Server Components |
| **Language** | TypeScript | Strict type safety across database models and API contracts |
| **Styling** | Tailwind CSS | Clean, responsive blue/white enterprise dashboard design |
| **Database** | PostgreSQL | Relational transactional database |
| **ORM** | Prisma ORM | Schema migrations, type-safe queries, transaction rollbacks |
| **Precision** | Decimal.js | Zero-rounding floating point precision for monetary figures |
| **Data Viz** | Recharts | Interactive financial trends and cash flow charts |
| **Icons** | Lucide React | Modern iconography |
| **Testing** | Vitest | Automated tests for 20 accounting and business scenarios |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ (tested on Node v24)
- PostgreSQL database (Local, Supabase, Neon, or Docker)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Set your database connection string in `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/business_accounting?schema=public"
JWT_SECRET="your-secure-jwt-secret-key"
OPENAI_API_KEY="sk-..."  # Optional for live OpenAI OCR; fallback intelligent parser is built-in
```

### 3. Database Migration & Seeding
Push the Prisma schema to create all tables and indexes:
```bash
npx prisma db push
```
Seed the database with sample products, accounts, customers, and opening balances:
```bash
npm run db:seed
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the application.

---

## 🧪 Automated Testing

Run the automated test suite covering all 20 required financial scenarios (cash sales, credit sales, partial payments, WAC valuation, inventory formulas, journal balance constraints, and AI diary parsing):
```bash
npm test
```

Build production bundle:
```bash
npm run build
```
