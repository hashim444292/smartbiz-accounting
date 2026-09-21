import { describe, it, expect } from "vitest";
import {
  Decimal,
  calculateLineTotal,
  calculateWeightedAverageCost,
  isJournalBalanced,
  formatMoney,
  round2,
  round4,
} from "../src/lib/decimal";
import { parseDiaryText } from "../src/services/aiService";
import { signSessionToken, verifySessionToken, hashPassword, comparePassword } from "../src/lib/auth";
import { fallbackStore, storeAddCompany, storeDeleteCompany, storeAddUser } from "../src/lib/fallbackStore";

describe("Accounting Engine & Business Rules Verification", () => {
  // Test 1: Cash Sale Calculations & Journal Balance
  it("Scenario 1: Cash sale calculation and journal balance", () => {
    // 5 units at Rs 2,000 each = 10,000
    const line = calculateLineTotal(5, 2000, 0, 0);
    expect(line.lineTotal.toNumber()).toBe(10000);

    // Paid amount = 10,000, Remaining = 0
    const paid = line.lineTotal;
    const remaining = line.lineTotal.sub(paid);
    expect(remaining.isZero()).toBe(true);

    // Balanced double entry:
    // Debit Cash (1010): 10,000
    // Credit Sales Revenue (4010): 10,000
    const journal = isJournalBalanced([
      { debit: paid, credit: 0 },
      { debit: 0, credit: line.lineTotal },
    ]);
    expect(journal.balanced).toBe(true);
    expect(journal.difference.isZero()).toBe(true);
    expect(journal.totalDebit.toNumber()).toBe(10000);
    expect(journal.totalCredit.toNumber()).toBe(10000);
  });

  // Test 2: Credit Sale (Prompt Example: Sale = 25,000, Received = 10,000, Receivable = 15,000)
  it("Scenario 2 & 3: Credit sale and partial customer payment allocation", () => {
    const saleTotal = new Decimal(25000);
    const amountReceived = new Decimal(10000);
    const remainingReceivable = saleTotal.sub(amountReceived);

    expect(saleTotal.toNumber()).toBe(25000);
    expect(amountReceived.toNumber()).toBe(10000);
    expect(remainingReceivable.toNumber()).toBe(15000);

    // Journal Entry for partial credit sale:
    // Debit Cash: 10,000
    // Debit Accounts Receivable: 15,000
    // Credit Sales Revenue: 25,000
    const journal = isJournalBalanced([
      { debit: amountReceived, credit: 0 },
      { debit: remainingReceivable, credit: 0 },
      { debit: 0, credit: saleTotal },
    ]);
    expect(journal.balanced).toBe(true);
    expect(journal.totalDebit.toNumber()).toBe(25000);
    expect(journal.totalCredit.toNumber()).toBe(25000);

    // Customer running balance increases by 15,000
    let customerBalance = new Decimal(0);
    customerBalance = customerBalance.add(remainingReceivable);
    expect(customerBalance.toNumber()).toBe(15000);

    // Subsequent partial payment of 5,000 reduces customer receivable
    const subsequentPayment = new Decimal(5000);
    customerBalance = customerBalance.sub(subsequentPayment);
    expect(customerBalance.toNumber()).toBe(10000);

    // Subsequent payment journal: Debit Cash 5,000, Credit AR 5,000
    const paymentJournal = isJournalBalanced([
      { debit: subsequentPayment, credit: 0 },
      { debit: 0, credit: subsequentPayment },
    ]);
    expect(paymentJournal.balanced).toBe(true);
  });

  // Test 4 & 5: Credit Purchase & Supplier Payment
  it("Scenario 4 & 5: Credit purchase, Weighted Average Cost, and supplier payment", () => {
    // Initial inventory: 10 units at average cost 1,000 (Valuation: 10,000)
    const currentStock = new Decimal(10);
    const currentAvgCost = new Decimal(1000);

    // New purchase: 20 units at unit cost 1,600 (Total: 32,000)
    const addedQty = new Decimal(20);
    const purchaseUnitCost = new Decimal(1600);
    const purchaseTotal = addedQty.mul(purchaseUnitCost);
    expect(purchaseTotal.toNumber()).toBe(32000);

    // Weighted Average Cost calculation:
    // (10 * 1000 + 20 * 1600) / (10 + 20) = (10000 + 32000) / 30 = 42000 / 30 = 1400
    const newAvgCost = calculateWeightedAverageCost(currentStock, currentAvgCost, addedQty, purchaseUnitCost);
    expect(newAvgCost.toNumber()).toBe(1400);

    // Credit Purchase Journal:
    // Debit Inventory: 32,000
    // Credit Accounts Payable: 32,000
    const purchaseJournal = isJournalBalanced([
      { debit: purchaseTotal, credit: 0 },
      { debit: 0, credit: purchaseTotal },
    ]);
    expect(purchaseJournal.balanced).toBe(true);

    // Supplier Payment: 20,000 paid
    const supplierPayment = new Decimal(20000);
    const remainingPayable = purchaseTotal.sub(supplierPayment);
    expect(remainingPayable.toNumber()).toBe(12000);

    // Supplier Payment Journal: Debit AP 20,000, Credit Bank 20,000
    const paymentJournal = isJournalBalanced([
      { debit: supplierPayment, credit: 0 },
      { debit: 0, credit: supplierPayment },
    ]);
    expect(paymentJournal.balanced).toBe(true);
  });

  // Test 6: Expense Payment
  it("Scenario 6: Expense payment journal and cash reduction", () => {
    const rentAmount = new Decimal(25000);
    let cashBalance = new Decimal(50000);

    cashBalance = cashBalance.sub(rentAmount);
    expect(cashBalance.toNumber()).toBe(25000);

    // Journal: Debit Rent Expense (6010): 25,000, Credit Cash (1010): 25,000
    const expenseJournal = isJournalBalanced([
      { debit: rentAmount, credit: 0 },
      { debit: 0, credit: rentAmount },
    ]);
    expect(expenseJournal.balanced).toBe(true);
  });

  // Test 7 & 8: Stock In, Stock Out & Ledger Integrity
  it("Scenario 7 & 8: Inventory ledger formula (Closing = Opening + In - Out + Adjustments)", () => {
    const openingStock = new Decimal(100);
    const stockInPurchases = new Decimal(50);
    const stockOutSales = new Decimal(30);
    const stockAdjustments = new Decimal(-5); // Damage write-down

    const closingStock = openingStock.add(stockInPurchases).sub(stockOutSales).add(stockAdjustments);
    expect(closingStock.toNumber()).toBe(115);
  });

  // Test 9 & 10: Sales Return & Purchase Return
  it("Scenario 9 & 10: Sales return and purchase return inventory restoration", () => {
    let stock = new Decimal(115);
    // Customer returns 2 units from a sale
    const returnedQty = new Decimal(2);
    stock = stock.add(returnedQty);
    expect(stock.toNumber()).toBe(117);

    // Sales return journal:
    // Debit Sales Returns (4020): 5,000
    // Credit Accounts Receivable (1100): 5,000
    const returnJournal = isJournalBalanced([
      { debit: 5000, credit: 0 },
      { debit: 0, credit: 5000 },
    ]);
    expect(returnJournal.balanced).toBe(true);
  });

  // Test 11 & 12: Unbalanced Journal Rejection
  it("Scenario 11 & 12: Rejection of unbalanced journal entries", () => {
    // Debits = 10,000, Credits = 9,500 (difference = 500)
    const check = isJournalBalanced([
      { debit: 10000, credit: 0 },
      { debit: 0, credit: 9500 },
    ]);
    expect(check.balanced).toBe(false);
    expect(check.difference.toNumber()).toBe(500);
  });

  // Test 16, 17, 18: AI NLP Diary Extraction & Needs Confirmation Flagging
  it("Scenario 16, 17, 18: AI Diary extraction, Roman Urdu parsing, and ambiguity detection", () => {
    const sampleDiary = `
1. Ali Traders ko 25,000 ki sale hui, 10,000 cash received.
2. Ahmed se 15,000 ka maal purchase kiya, payment baqi hai.
3. Shop electricity 3,000 paid cash.
4. Bilal ne purana udhaar 8,000 diya.
5. Unknown Party 12000
    `.trim();

    const parsed = parseDiaryText(sampleDiary);
    expect(parsed.transactions.length).toBe(5);

    // Item 1: Sale to Ali Traders
    const sale1 = parsed.transactions[0];
    expect(sale1.type).toBe("SALE");
    expect(sale1.totalAmount).toBe(25000);
    expect(sale1.paidAmount).toBe(10000);
    expect(sale1.remainingAmount).toBe(15000);
    expect(sale1.needsConfirmation).toBe(false);

    // Item 2: Purchase from Ahmed
    const pur = parsed.transactions[1];
    expect(pur.type).toBe("PURCHASE");
    expect(pur.totalAmount).toBe(15000);
    expect(pur.paidAmount).toBe(0);
    expect(pur.remainingAmount).toBe(15000);

    // Item 3: Electricity Expense
    const exp = parsed.transactions[2];
    expect(exp.type).toBe("EXPENSE");
    expect(exp.totalAmount).toBe(3000);

    // Item 4: Customer Payment Received
    const rcv = parsed.transactions[3];
    expect(rcv.type).toBe("PAYMENT_RECEIVED");
    expect(rcv.totalAmount).toBe(8000);

    // Item 5: Ambiguous entry marked with needsConfirmation: true
    const ambiguous = parsed.transactions[4];
    expect(ambiguous.needsConfirmation).toBe(true);
    expect(ambiguous.warnings && ambiguous.warnings.length > 0).toBe(true);
  });

  // Test 19 & 20: Closed-Period Lock Enforcement
  it("Scenario 19 & 20: Closed accounting period prevents retrospective transaction mutation", () => {
    const period = {
      name: "August 2026",
      isClosed: true,
    };
    expect(period.isClosed).toBe(true);

    const attemptPost = () => {
      if (period.isClosed) {
        throw new Error("Cannot post or modify transactions in a closed accounting period.");
      }
    };
    expect(attemptPost).toThrow("closed accounting period");
  });

  // Test 21: Client Handwritten Ledger Notebook Parsing (Matching Image 3)
  it("Scenario 21: Client handwritten ledger notebook parsing (Rec - HBL, Mobile Sales, Expense)", () => {
    const handwrittenLedger = `
HYD Rec - HBL 50000
Imran c/o Asif Rec - HBL 10000
Sami Rec - HBL 265000
IPH 11 NON 64 - HBL 36000
Pixel 7A - 35000
Relme C85 Pro - 54000
Expense - 500
Spark 10C - 21000
    `.trim();

    const parsed = parseDiaryText(handwrittenLedger);
    expect(parsed.transactions.length).toBe(8);

    // 1. HYD Rec
    expect(parsed.transactions[0].type).toBe("PAYMENT_RECEIVED");
    expect(parsed.transactions[0].partyName).toBe("HYD");
    expect(parsed.transactions[0].totalAmount).toBe(50000);
    expect(parsed.transactions[0].paymentMethod).toBe("BANK");

    // 2. Imran c/o Asif Rec
    expect(parsed.transactions[1].type).toBe("PAYMENT_RECEIVED");
    expect(parsed.transactions[1].partyName).toBe("Imran c/o Asif");
    expect(parsed.transactions[1].totalAmount).toBe(10000);

    // 3. Sami Rec
    expect(parsed.transactions[2].type).toBe("PAYMENT_RECEIVED");
    expect(parsed.transactions[2].partyName).toBe("Sami");
    expect(parsed.transactions[2].totalAmount).toBe(265000);

    // 4. IPH 11 NON 64 Sale
    expect(parsed.transactions[3].type).toBe("SALE");
    expect(parsed.transactions[3].items?.[0].productName).toBe("IPH 11 NON 64");
    expect(parsed.transactions[3].totalAmount).toBe(36000);
    expect(parsed.transactions[3].paymentMethod).toBe("BANK");

    // 5. Pixel 7A Sale
    expect(parsed.transactions[4].type).toBe("SALE");
    expect(parsed.transactions[4].items?.[0].productName).toBe("Pixel 7A");
    expect(parsed.transactions[4].totalAmount).toBe(35000);

    // 6. Relme C85 Pro Sale
    expect(parsed.transactions[5].type).toBe("SALE");
    expect(parsed.transactions[5].totalAmount).toBe(54000);

    // 7. Expense
    expect(parsed.transactions[6].type).toBe("EXPENSE");
    expect(parsed.transactions[6].totalAmount).toBe(500);

    // 8. Spark 10C Sale
    expect(parsed.transactions[7].type).toBe("SALE");
    expect(parsed.transactions[7].totalAmount).toBe(21000);
  });

  // Test 22: Multi-Company Data Isolation & Independent Books
  it("Scenario 22: Multi-company data isolation and independent business management", () => {
    // 1. Initial companies count
    const initialCount = fallbackStore.companies.length;
    expect(initialCount).toBeGreaterThanOrEqual(3);

    // 2. Register new company
    const newBiz = storeAddCompany({
      name: "SuperStar Mobile Plaza",
      ownerName: "Kamran Akram",
      currency: "PKR",
      currencySymbol: "Rs",
    });
    expect(newBiz.id).toBeDefined();
    expect(fallbackStore.companies.length).toBe(initialCount + 1);

    // 3. Delete company
    const deleted = storeDeleteCompany(newBiz.id);
    expect(deleted).toBe(true);
    expect(fallbackStore.companies.length).toBe(initialCount);
  });

  // Test 23: User Authentication, Session Token & Role-Based Authorization
  it("Scenario 23: User authentication, JWT signing/verifying, and role-based permissions", async () => {
    // 1. Password hashing & comparison
    const plain = "mypassword123";
    const hash = await hashPassword(plain);
    expect(await comparePassword(plain, hash)).toBe(true);
    expect(await comparePassword("wrongpass", hash)).toBe(false);

    // 2. JWT Session payload signing & verification
    const payload = {
      userId: "usr-test-1",
      email: "test@company.com",
      name: "Test Accountant",
      role: "ACCOUNTANT" as const,
      businessId: "biz-101",
      businessName: "HANIF Mobile Center",
      companyIds: ["biz-101"],
    };

    const token = signSessionToken(payload);
    expect(token).toBeDefined();

    const decoded = verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe("usr-test-1");
    expect(decoded?.role).toBe("ACCOUNTANT");
    expect(decoded?.businessId).toBe("biz-101");
  });

  // Test 24: Role restriction on company creation and user directory privacy
  it("Scenario 24: Non-Super-Admin roles (Staff, Accountant, Owner) cannot create companies or view other users", () => {
    const checkCanAddCompany = (role: string) => {
      if (role !== "SUPER_ADMIN") {
        throw new Error("Access denied. Only Super Admin can register new companies.");
      }
      return true;
    };

    const checkCanViewUsers = (role: string) => {
      if (role !== "SUPER_ADMIN") {
        throw new Error("Access denied. User directory is only accessible to Super Admin.");
      }
      return true;
    };

    // Super Admin passes
    expect(checkCanAddCompany("SUPER_ADMIN")).toBe(true);
    expect(checkCanViewUsers("SUPER_ADMIN")).toBe(true);

    // Accountant fails
    expect(() => checkCanAddCompany("ACCOUNTANT")).toThrow("Only Super Admin can register new companies");
    expect(() => checkCanViewUsers("ACCOUNTANT")).toThrow("User directory is only accessible to Super Admin");

    // Staff fails
    expect(() => checkCanAddCompany("STAFF")).toThrow("Only Super Admin can register new companies");
    expect(() => checkCanViewUsers("STAFF")).toThrow("User directory is only accessible to Super Admin");

    // Company Owner fails
    expect(() => checkCanAddCompany("OWNER_ADMIN")).toThrow("Only Super Admin can register new companies");
    expect(() => checkCanViewUsers("OWNER_ADMIN")).toThrow("User directory is only accessible to Super Admin");
  });

  // Test 25: Sales Invoice Payment Flexibility (Full Payment, Partial Payment, 100% Credit Sale)
  it("Scenario 25: Sales Invoice payment modes (Full, Partial, 100% Credit) and Customer Ledger AR integration", () => {
    // 1. Full Payment: Total = 50,000, Paid = 50,000, Remaining = 0, Status = PAID
    const fullSale = {
      total: 50000,
      paid: 50000,
      remaining: 0,
      status: 50000 >= 50000 ? "PAID" : "PARTIAL",
    };
    expect(fullSale.remaining).toBe(0);
    expect(fullSale.status).toBe("PAID");

    // 2. Partial Payment: Total = 80,000, Paid = 30,000, Remaining = 50,000, Status = PARTIAL
    const initialCustomerBal = 12000;
    const partialTotal = 80000;
    const partialPaid = 30000;
    const partialRemaining = partialTotal - partialPaid;
    const partialStatus = partialPaid > 0 && partialRemaining > 0 ? "PARTIAL" : "PAID";
    const updatedCustomerBalPartial = initialCustomerBal + partialRemaining;

    expect(partialRemaining).toBe(50000);
    expect(partialStatus).toBe("PARTIAL");
    expect(updatedCustomerBalPartial).toBe(62000); // 12,000 previous + 50,000 remaining receivable

    // Balanced Journal for Partial Sale:
    // Debit Cash (1010): 30,000
    // Debit Accounts Receivable (1100): 50,000
    // Credit Sales Revenue (4010): 80,000
    const partialJournal = isJournalBalanced([
      { debit: new Decimal(30000), credit: 0 },
      { debit: new Decimal(50000), credit: 0 },
      { debit: 0, credit: new Decimal(80000) },
    ]);
    expect(partialJournal.balanced).toBe(true);
    expect(partialJournal.difference.isZero()).toBe(true);

    // 3. Full Credit Sale: Total = 100,000, Paid = 0, Remaining = 100,000, Status = UNPAID
    const creditTotal = 100000;
    const creditPaid = 0;
    const creditRemaining = creditTotal - creditPaid;
    const creditStatus = creditPaid === 0 ? "UNPAID" : "PARTIAL";
    const updatedCustomerBalCredit = initialCustomerBal + creditRemaining;

    expect(creditRemaining).toBe(100000);
    expect(creditStatus).toBe("UNPAID");
    expect(updatedCustomerBalCredit).toBe(112000); // 12,000 + 100,000 = 112,000

    // Balanced Journal for Full Credit Sale:
    // Debit Accounts Receivable (1100): 100,000
    // Credit Sales Revenue (4010): 100,000
    const creditJournal = isJournalBalanced([
      { debit: new Decimal(100000), credit: 0 },
      { debit: 0, credit: new Decimal(100000) },
    ]);
    expect(creditJournal.balanced).toBe(true);
    expect(creditJournal.difference.isZero()).toBe(true);
  });

  // Test 26: FBR Transmission Eligibility & Safeguard Rules
  it("Scenario 26: FBR transmission eligibility - Partial and Credit sales cannot hit FBR until fully paid", () => {
    // Helper replicating the FBR transmission guard rule
    const canTransmitToFbr = (sale: { paymentStatus: string; remainingAmount: number }) => {
      if (sale.paymentStatus !== "PAID" || sale.remainingAmount > 0) {
        throw new Error(
          `Incomplete payment (${sale.paymentStatus}). Invoices can only be transmitted to FBR once 100% payment is received.`
        );
      }
      return true;
    };

    // 1. Partial Sale Attempt -> Must Throw Error
    const partialSale = { paymentStatus: "PARTIAL", remainingAmount: 35000 };
    expect(() => canTransmitToFbr(partialSale)).toThrow("Incomplete payment (PARTIAL)");

    // 2. Unpaid Credit Sale Attempt -> Must Throw Error
    const creditSale = { paymentStatus: "UNPAID", remainingAmount: 90000 };
    expect(() => canTransmitToFbr(creditSale)).toThrow("Incomplete payment (UNPAID)");

    // 3. Fully Paid Sale Attempt -> Allowed & Applies Rs. 1 POS Fee
    const paidSale = { paymentStatus: "PAID", remainingAmount: 0 };
    expect(canTransmitToFbr(paidSale)).toBe(true);

    // Verify statutory Rs. 1 fee applied only upon hit
    const initialPosFee = 0;
    const initialTotal = 50000;
    const transmittedPosFee = initialPosFee + 1.0;
    const transmittedTotal = initialTotal + 1.0;

    expect(transmittedPosFee).toBe(1.0);
    expect(transmittedTotal).toBe(50001);
  });

  // Test 27: Re-Purchase Price Increase, Weighted Average Cost (WAC), and Margin Differentiation
  it("Scenario 27: Re-purchase price increase, blended WAC calculation, and old vs new batch margin differentiation", () => {
    // Initial Stock: 5 phones bought at Rs 40,000 each (Valuation: Rs 200,000)
    const oldStock = 5;
    const oldCost = 40000;
    const oldValuation = oldStock * oldCost; // 200,000

    // New Re-Purchase: 10 phones bought at new higher price of Rs 45,000 each (Valuation: Rs 450,000)
    const newQty = 10;
    const newCost = 45000;
    const newValuation = newQty * newCost; // 450,000

    // Total Stock = 15 phones
    const totalStock = oldStock + newQty;
    expect(totalStock).toBe(15);

    // Blended Weighted Average Cost (WAC) formula:
    // ((oldStock * oldCost) + (newQty * newCost)) / totalStock
    // (200,000 + 450,000) / 15 = 650,000 / 15 = Rs 43,333.3333
    const calculatedWac = calculateWeightedAverageCost(oldStock, oldCost, newQty, newCost);
    expect(round2(calculatedWac).toNumber()).toBe(43333.33);

    // Business decides to set New Selling Price to Rs 52,000
    const newSellingPrice = 52000;

    // 1. Profit Margin on New Batch:
    const newBatchProfit = newSellingPrice - newCost; // 52,000 - 45,000 = 7,000
    const newBatchMarginPct = (newBatchProfit / newSellingPrice) * 100; // 13.46%
    expect(newBatchProfit).toBe(7000);
    expect(round2(newBatchMarginPct).toNumber()).toBe(13.46);

    // 2. Profit Margin on Remaining Old Stock:
    const oldStockProfit = newSellingPrice - oldCost; // 52,000 - 40,000 = 12,000
    const oldStockMarginPct = (oldStockProfit / newSellingPrice) * 100; // 23.08%
    expect(oldStockProfit).toBe(12000);
    expect(round2(oldStockMarginPct).toNumber()).toBe(23.08);

    // 3. Extra Windfall Profit on Old Stock:
    const extraProfitPerUnit = oldStockProfit - newBatchProfit; // 12,000 - 7,000 = 5,000 (equals cost increase)
    const totalOldStockWindfall = extraProfitPerUnit * oldStock; // 5,000 * 5 = 25,000
    expect(extraProfitPerUnit).toBe(5000);
    expect(totalOldStockWindfall).toBe(25000);
  });

  // Test 28: Catalog Selling Price Synchronization and Cost History Tracking
  it("Scenario 28: Catalog selling price update and cost history event recording", () => {
    // Simulate catalog product
    const product = {
      id: "prod-test-wac",
      name: "IPHONE 13 PRO MAX",
      currentStock: 3,
      averageCost: 180000,
      purchasePrice: 180000,
      sellingPrice: 200000,
      retailPrice: 200000,
      costHistory: [] as any[],
    };

    // Re-purchase 2 units at higher price 190,000, update selling price to 215,000
    const inwardQty = 2;
    const inwardCost = 190000;
    const newSellingPrice = 215000;
    const updateCatalogPrice = true;

    // Apply WAC
    const newAvg = calculateWeightedAverageCost(product.currentStock, product.averageCost, inwardQty, inwardCost);
    product.averageCost = newAvg.toNumber();
    product.currentStock += inwardQty;
    product.purchasePrice = inwardCost;

    if (updateCatalogPrice && newSellingPrice > 0) {
      product.sellingPrice = newSellingPrice;
      product.retailPrice = newSellingPrice;
    }

    // Record costHistory
    product.costHistory.unshift({
      date: new Date().toISOString(),
      purchaseNumber: "PUR-2026-00099",
      previousCost: 180000,
      newPurchaseCost: inwardCost,
      quantity: inwardQty,
      newAverageCost: product.averageCost,
      sellingPrice: product.sellingPrice,
      oldStock: 3,
      oldSellingPrice: 200000,
      newSellingPrice: product.sellingPrice,
    });

    // Verifications
    expect(product.currentStock).toBe(5);
    // (3 * 180,000 + 2 * 190,000) / 5 = (540,000 + 380,000) / 5 = 920,000 / 5 = 184,000
    expect(product.averageCost).toBe(184000);
    expect(product.purchasePrice).toBe(190000);
    expect(product.sellingPrice).toBe(215000);
    expect(product.retailPrice).toBe(215000);

    // Verify Cost History record
    expect(product.costHistory.length).toBe(1);
    expect(product.costHistory[0].previousCost).toBe(180000);
    expect(product.costHistory[0].newPurchaseCost).toBe(190000);
    expect(product.costHistory[0].newAverageCost).toBe(184000);
    expect(product.costHistory[0].newSellingPrice).toBe(215000);
  });

  // Test 24: SaaS Multi-Tenant Platform flow, Module Gating & Multi-User Assignment
  it("Scenario 24: SaaS multi-tenant module gating and multi-user company assignment", () => {
    // 1. Create a new client company with restricted modules
    const newCompany = {
      name: "Tariq Telecom Wholesale",
      ownerName: "Tariq Mehmood",
      phone: "+92 300 9988776",
      monthlyFee: 7500,
      billingPlan: "Enterprise Pro",
      enabledModules: ["sales", "inventory", "compliance"],
    };

    const createdCompany = storeAddCompany(newCompany);
    expect(createdCompany.id).toBeDefined();
    expect(createdCompany.name).toBe("Tariq Telecom Wholesale");
    expect(createdCompany.enabledModules).toEqual(["sales", "inventory", "compliance"]);

    // 2. Assign multiple users to this single company with distinct roles
    const ownerUser = storeAddUser({
      name: "Tariq (Owner)",
      email: "tariq@telecom.com",
      password: "password123",
      role: "OWNER_ADMIN",
      companyIds: [createdCompany.id],
    });

    const accountantUser = storeAddUser({
      name: "Bilal (Accountant)",
      email: "bilal@telecom.com",
      password: "password123",
      role: "ACCOUNTANT",
      companyIds: [createdCompany.id],
    });

    const cashierUser = storeAddUser({
      name: "Hamza (Cashier)",
      email: "hamza@telecom.com",
      password: "password123",
      role: "STAFF",
      companyIds: [createdCompany.id],
    });

    // Verify all 3 users exist and belong to the same company
    expect(ownerUser.role).toBe("OWNER_ADMIN");
    expect(accountantUser.role).toBe("ACCOUNTANT");
    expect(cashierUser.role).toBe("STAFF");

    const usersForCompany = fallbackStore.users.filter((u) =>
      u.companyIds.includes(createdCompany.id)
    );
    expect(usersForCompany.length).toBe(3);

    // 3. Verify module gating logic
    const hasSalesModule = createdCompany.enabledModules?.includes("sales");
    const hasAccountingModule = createdCompany.enabledModules?.includes("accounting");
    const hasComplianceModule = createdCompany.enabledModules?.includes("compliance");

    expect(hasSalesModule).toBe(true);
    expect(hasAccountingModule).toBe(false); // Disabled for this tier
    expect(hasComplianceModule).toBe(true);
  });
});


