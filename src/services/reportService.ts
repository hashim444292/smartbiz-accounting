import { prisma } from "@/lib/prisma";
import { Decimal, round2, toDecimal } from "@/lib/decimal";
import { createSafeAuditLog } from "@/lib/auditHelper";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export async function getDashboardMetrics(businessId: string, range?: DateRange) {
  const now = new Date();
  const startOfDay = range ? range.startDate : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = range ? range.endDate : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // 1. Sales in range
  const sales = await prisma.sale.findMany({
    where: {
      businessId,
      status: "POSTED",
      date: { gte: startOfDay, lte: endOfDay },
    },
    include: { items: true },
  });

  let totalSales = new Decimal(0);
  let totalCOGS = new Decimal(0);

  for (const s of sales) {
    totalSales = totalSales.add(toDecimal(s.totalAmount));
    for (const item of s.items) {
      const q = toDecimal(item.quantity);
      const c = toDecimal(item.costPrice);
      totalCOGS = totalCOGS.add(q.mul(c));
    }
  }

  // 2. Purchases in range
  const purchases = await prisma.purchase.findMany({
    where: {
      businessId,
      date: { gte: startOfDay, lte: endOfDay },
    },
  });

  let totalPurchases = new Decimal(0);
  for (const p of purchases) {
    totalPurchases = totalPurchases.add(toDecimal(p.totalAmount));
  }

  // 3. Payments in range
  const payments = await prisma.payment.findMany({
    where: {
      businessId,
      date: { gte: startOfDay, lte: endOfDay },
    },
  });

  let paymentsReceived = new Decimal(0);
  let paymentsMade = new Decimal(0);

  for (const p of payments) {
    const amt = toDecimal(p.amount);
    if (p.type === "RECEIPT") paymentsReceived = paymentsReceived.add(amt);
    if (p.type === "DISBURSEMENT") paymentsMade = paymentsMade.add(amt);
  }

  // 4. Expenses in range
  const expenses = await prisma.expense.findMany({
    where: {
      businessId,
      date: { gte: startOfDay, lte: endOfDay },
    },
  });

  let totalExpenses = new Decimal(0);
  for (const e of expenses) {
    totalExpenses = totalExpenses.add(toDecimal(e.amount));
  }

  // 5. Total Receivables & Payables
  const customers = await prisma.customer.findMany({
    where: { businessId, isActive: true },
    select: { currentBalance: true },
  });
  let totalReceivables = new Decimal(0);
  for (const c of customers) {
    totalReceivables = totalReceivables.add(toDecimal(c.currentBalance));
  }

  const suppliers = await prisma.supplier.findMany({
    where: { businessId, isActive: true },
    select: { currentBalance: true },
  });
  let totalPayables = new Decimal(0);
  for (const s of suppliers) {
    totalPayables = totalPayables.add(toDecimal(s.currentBalance));
  }

  // 6. Inventory Valuation
  const products = await prisma.product.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true, sku: true, currentStock: true, averageCost: true, minStockLevel: true },
  });

  let totalInventoryValue = new Decimal(0);
  const lowStockAlerts: Array<{ id: string; name: string; sku: string | null; stock: number; min: number }> = [];

  for (const prod of products) {
    const stock = toDecimal(prod.currentStock);
    const cost = toDecimal(prod.averageCost);
    totalInventoryValue = totalInventoryValue.add(stock.mul(cost));

    const min = toDecimal(prod.minStockLevel);
    if (stock.lte(min) && min.gt(0)) {
      lowStockAlerts.push({
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        stock: stock.toNumber(),
        min: min.toNumber(),
      });
    }
  }

  // 7. Cash & Bank Balances
  const cashAccounts = await prisma.cashBankAccount.findMany({
    where: { businessId, isActive: true },
  });

  let cashBalance = new Decimal(0);
  let bankBalance = new Decimal(0);

  for (const acc of cashAccounts) {
    const bal = toDecimal(acc.balance);
    if (acc.type === "BANK") {
      bankBalance = bankBalance.add(bal);
    } else {
      cashBalance = cashBalance.add(bal);
    }
  }

  // Calculations
  const grossProfit = round2(totalSales.sub(totalCOGS));
  const netProfit = round2(grossProfit.sub(totalExpenses));

  return {
    totalSales: round2(totalSales).toNumber(),
    totalPurchases: round2(totalPurchases).toNumber(),
    paymentsReceived: round2(paymentsReceived).toNumber(),
    paymentsMade: round2(paymentsMade).toNumber(),
    totalExpenses: round2(totalExpenses).toNumber(),
    grossProfit: grossProfit.toNumber(),
    netProfit: netProfit.toNumber(),
    totalReceivables: round2(totalReceivables).toNumber(),
    totalPayables: round2(totalPayables).toNumber(),
    totalInventoryValue: round2(totalInventoryValue).toNumber(),
    cashBalance: round2(cashBalance).toNumber(),
    bankBalance: round2(bankBalance).toNumber(),
    lowStockCount: lowStockAlerts.length,
    lowStockAlerts: lowStockAlerts.slice(0, 10),
  };
}

export async function getDailyReport(businessId: string, targetDate: Date) {
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
  const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

  // Sales
  const sales = await prisma.sale.findMany({
    where: { businessId, date: { gte: startOfDay, lte: endOfDay } },
    include: { items: true },
    orderBy: { date: "asc" },
  });

  let totalSalesAmount = new Decimal(0);
  let cashSales = new Decimal(0);
  let creditSales = new Decimal(0);
  let salesPaidAmount = new Decimal(0);
  let salesRemainingReceivable = new Decimal(0);
  let salesCOGS = new Decimal(0);

  for (const s of sales) {
    if (s.status === "POSTED") {
      const tot = toDecimal(s.totalAmount);
      const paid = toDecimal(s.paidAmount);
      const rem = toDecimal(s.remainingAmount);

      totalSalesAmount = totalSalesAmount.add(tot);
      salesPaidAmount = salesPaidAmount.add(paid);
      salesRemainingReceivable = salesRemainingReceivable.add(rem);

      if (rem.isZero()) cashSales = cashSales.add(tot);
      else creditSales = creditSales.add(tot);

      for (const item of s.items) {
        salesCOGS = salesCOGS.add(toDecimal(item.quantity).mul(toDecimal(item.costPrice)));
      }
    }
  }

  // Purchases
  const purchases = await prisma.purchase.findMany({
    where: { businessId, date: { gte: startOfDay, lte: endOfDay } },
    include: { supplier: true, items: true },
    orderBy: { date: "asc" },
  });

  let totalPurchasesAmount = new Decimal(0);
  let cashPurchases = new Decimal(0);
  let creditPurchases = new Decimal(0);
  let purchasePaidAmount = new Decimal(0);
  let purchaseRemainingPayable = new Decimal(0);

  for (const p of purchases) {
    const tot = toDecimal(p.totalAmount);
    const paid = toDecimal(p.paidAmount);
    const rem = toDecimal(p.remainingAmount);

    totalPurchasesAmount = totalPurchasesAmount.add(tot);
    purchasePaidAmount = purchasePaidAmount.add(paid);
    purchaseRemainingPayable = purchaseRemainingPayable.add(rem);

    if (rem.isZero()) cashPurchases = cashPurchases.add(tot);
    else creditPurchases = creditPurchases.add(tot);
  }

  // Payments received today
  const receipts = await prisma.payment.findMany({
    where: { businessId, type: "RECEIPT", date: { gte: startOfDay, lte: endOfDay } },
    include: { customer: true, account: true },
    orderBy: { date: "asc" },
  });

  let totalMoneyReceived = new Decimal(0);
  for (const r of receipts) totalMoneyReceived = totalMoneyReceived.add(toDecimal(r.amount));

  // Payments made today
  const disbursements = await prisma.payment.findMany({
    where: { businessId, type: "DISBURSEMENT", date: { gte: startOfDay, lte: endOfDay } },
    include: { supplier: true, account: true },
    orderBy: { date: "asc" },
  });

  let totalMoneyPaid = new Decimal(0);
  for (const d of disbursements) totalMoneyPaid = totalMoneyPaid.add(toDecimal(d.amount));

  // Expenses today
  const expenses = await prisma.expense.findMany({
    where: { businessId, date: { gte: startOfDay, lte: endOfDay } },
    include: { category: true, account: true },
    orderBy: { date: "asc" },
  });

  let totalExpenses = new Decimal(0);
  for (const e of expenses) totalExpenses = totalExpenses.add(toDecimal(e.amount));

  // Stock movements today
  const stockMovements = await prisma.inventoryTransaction.findMany({
    where: { businessId, date: { gte: startOfDay, lte: endOfDay } },
    include: { product: true },
    orderBy: { date: "asc" },
  });

  // Net Cash Movement = Money Received - (Money Paid + Expenses)
  const netCashMovement = round2(totalMoneyReceived.sub(totalMoneyPaid).sub(totalExpenses));
  const grossProfit = round2(totalSalesAmount.sub(salesCOGS));
  const netProfit = round2(grossProfit.sub(totalExpenses));

  return {
    date: targetDate,
    sales: {
      count: sales.length,
      total: round2(totalSalesAmount).toNumber(),
      cash: round2(cashSales).toNumber(),
      credit: round2(creditSales).toNumber(),
      paid: round2(salesPaidAmount).toNumber(),
      receivable: round2(salesRemainingReceivable).toNumber(),
      items: sales,
    },
    purchases: {
      count: purchases.length,
      total: round2(totalPurchasesAmount).toNumber(),
      cash: round2(cashPurchases).toNumber(),
      credit: round2(creditPurchases).toNumber(),
      paid: round2(purchasePaidAmount).toNumber(),
      payable: round2(purchaseRemainingPayable).toNumber(),
      items: purchases,
    },
    receipts: {
      total: round2(totalMoneyReceived).toNumber(),
      items: receipts,
    },
    disbursements: {
      total: round2(totalMoneyPaid).toNumber(),
      items: disbursements,
    },
    expenses: {
      total: round2(totalExpenses).toNumber(),
      items: expenses,
    },
    stockMovements,
    financialSummary: {
      totalMoneyReceived: round2(totalMoneyReceived).toNumber(),
      totalMoneyPaid: round2(totalMoneyPaid).toNumber(),
      totalExpenses: round2(totalExpenses).toNumber(),
      netCashMovement: netCashMovement.toNumber(),
      salesRevenue: round2(totalSalesAmount).toNumber(),
      totalPurchases: round2(totalPurchasesAmount).toNumber(),
      grossProfit: grossProfit.toNumber(),
      netProfit: netProfit.toNumber(),
    },
  };
}

export async function getMonthlyClosingReport(businessId: string, year: number, month: number) {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Check accounting period lock
  const period = await prisma.accountingPeriod.findUnique({
    where: {
      businessId_year_month: { businessId, year, month },
    },
  });

  // A. Monthly Sales
  const sales = await prisma.sale.findMany({
    where: { businessId, status: "POSTED", date: { gte: startDate, lte: endDate } },
    include: { items: true, customer: true },
  });

  let totalSales = new Decimal(0);
  let cashSales = new Decimal(0);
  let creditSales = new Decimal(0);
  let totalDiscounts = new Decimal(0);
  let totalTaxes = new Decimal(0);
  let totalCOGS = new Decimal(0);

  const salesByProductMap = new Map<string, { name: string; quantity: Decimal; total: Decimal }>();
  const salesByCustomerMap = new Map<string, { name: string; count: number; total: Decimal }>();

  for (const s of sales) {
    const tot = toDecimal(s.totalAmount);
    totalSales = totalSales.add(tot);
    totalDiscounts = totalDiscounts.add(toDecimal(s.discountAmount));
    totalTaxes = totalTaxes.add(toDecimal(s.taxAmount));

    if (toDecimal(s.remainingAmount).isZero()) cashSales = cashSales.add(tot);
    else creditSales = creditSales.add(tot);

    const custName = s.customerName || "Walk-in";
    const custEntry = salesByCustomerMap.get(custName) || { name: custName, count: 0, total: new Decimal(0) };
    custEntry.count += 1;
    custEntry.total = custEntry.total.add(tot);
    salesByCustomerMap.set(custName, custEntry);

    for (const item of s.items) {
      const q = toDecimal(item.quantity);
      const lt = toDecimal(item.lineTotal);
      const cp = toDecimal(item.costPrice);
      totalCOGS = totalCOGS.add(q.mul(cp));

      const pEntry = salesByProductMap.get(item.productName) || {
        name: item.productName,
        quantity: new Decimal(0),
        total: new Decimal(0),
      };
      pEntry.quantity = pEntry.quantity.add(q);
      pEntry.total = pEntry.total.add(lt);
      salesByProductMap.set(item.productName, pEntry);
    }
  }

  // B. Monthly Purchases
  const purchases = await prisma.purchase.findMany({
    where: { businessId, date: { gte: startDate, lte: endDate } },
    include: { items: true, supplier: true },
  });

  let totalPurchases = new Decimal(0);
  let cashPurchases = new Decimal(0);
  let creditPurchases = new Decimal(0);

  for (const p of purchases) {
    const tot = toDecimal(p.totalAmount);
    totalPurchases = totalPurchases.add(tot);
    if (toDecimal(p.remainingAmount).isZero()) cashPurchases = cashPurchases.add(tot);
    else creditPurchases = creditPurchases.add(tot);
  }

  // C. Customer Receivables Reconciliation
  const customers = await prisma.customer.findMany({
    where: { businessId, isActive: true },
  });

  let totalCustomerReceivables = new Decimal(0);
  for (const c of customers) totalCustomerReceivables = totalCustomerReceivables.add(toDecimal(c.currentBalance));

  // D. Supplier Payables Reconciliation
  const suppliers = await prisma.supplier.findMany({
    where: { businessId, isActive: true },
  });

  let totalSupplierPayables = new Decimal(0);
  for (const s of suppliers) totalSupplierPayables = totalSupplierPayables.add(toDecimal(s.currentBalance));

  // E & F. Money Received & Paid
  const payments = await prisma.payment.findMany({
    where: { businessId, date: { gte: startDate, lte: endDate } },
    include: { account: true },
  });

  let totalCashReceived = new Decimal(0);
  let totalBankReceived = new Decimal(0);
  let totalCashPaid = new Decimal(0);
  let totalBankPaid = new Decimal(0);

  for (const p of payments) {
    const amt = toDecimal(p.amount);
    const isBank = p.account?.type === "BANK";

    if (p.type === "RECEIPT") {
      if (isBank) totalBankReceived = totalBankReceived.add(amt);
      else totalCashReceived = totalCashReceived.add(amt);
    } else if (p.type === "DISBURSEMENT") {
      if (isBank) totalBankPaid = totalBankPaid.add(amt);
      else totalCashPaid = totalCashPaid.add(amt);
    }
  }

  // G. Monthly Expenses by category
  const expenses = await prisma.expense.findMany({
    where: { businessId, date: { gte: startDate, lte: endDate } },
    include: { category: true },
  });

  let totalExpenses = new Decimal(0);
  const expenseByCategoryMap = new Map<string, { name: string; count: number; total: Decimal }>();

  for (const e of expenses) {
    const amt = toDecimal(e.amount);
    totalExpenses = totalExpenses.add(amt);

    const catName = e.category.name;
    const catEntry = expenseByCategoryMap.get(catName) || { name: catName, count: 0, total: new Decimal(0) };
    catEntry.count += 1;
    catEntry.total = catEntry.total.add(amt);
    expenseByCategoryMap.set(catName, catEntry);
  }

  const categoryBreakdown = Array.from(expenseByCategoryMap.values()).map((c) => ({
    name: c.name,
    count: c.count,
    total: round2(c.total).toNumber(),
    percentage: totalExpenses.gt(0) ? round2(c.total.div(totalExpenses).mul(100)).toNumber() : 0,
  }));

  // H. Inventory Closing
  const products = await prisma.product.findMany({
    where: { businessId, isActive: true },
  });

  let closingStockValue = new Decimal(0);
  const lowStockItems = [];

  for (const pr of products) {
    const s = toDecimal(pr.currentStock);
    const c = toDecimal(pr.averageCost);
    closingStockValue = closingStockValue.add(s.mul(c));

    const min = toDecimal(pr.minStockLevel);
    if (s.lte(min) && min.gt(0)) {
      lowStockItems.push({ name: pr.name, currentStock: s.toNumber(), minStock: min.toNumber() });
    }
  }

  // I. Profit & Loss
  const grossProfit = round2(totalSales.sub(totalCOGS));
  const netProfit = round2(grossProfit.sub(totalExpenses));

  // J. Cash & Bank Balances
  const bankAccounts = await prisma.cashBankAccount.findMany({
    where: { businessId, isActive: true },
  });

  let cashTotal = new Decimal(0);
  let bankTotal = new Decimal(0);

  for (const b of bankAccounts) {
    const bal = toDecimal(b.balance);
    if (b.type === "BANK") bankTotal = bankTotal.add(bal);
    else cashTotal = cashTotal.add(bal);
  }

  // Pre-closing Audit Warnings
  const warnings: string[] = [];
  const unpostedSales = await prisma.sale.count({ where: { businessId, status: "DRAFT", date: { gte: startDate, lte: endDate } } });
  if (unpostedSales > 0) warnings.push(`There are ${unpostedSales} unposted draft sales in this period.`);

  const negativeStockProducts = products.filter((p) => toDecimal(p.currentStock).lt(0));
  if (negativeStockProducts.length > 0) {
    warnings.push(`${negativeStockProducts.length} product(s) have negative stock balances.`);
  }

  return {
    year,
    month,
    periodName: period?.name || `${new Date(year, month - 1).toLocaleString("default", { month: "long" })} ${year}`,
    isClosed: period?.isClosed || false,
    closedAt: period?.closedAt,
    sales: {
      total: round2(totalSales).toNumber(),
      invoiceCount: sales.length,
      cash: round2(cashSales).toNumber(),
      credit: round2(creditSales).toNumber(),
      discounts: round2(totalDiscounts).toNumber(),
      taxes: round2(totalTaxes).toNumber(),
      cogs: round2(totalCOGS).toNumber(),
      grossProfit: grossProfit.toNumber(),
      byProduct: Array.from(salesByProductMap.values()).map((p) => ({
        name: p.name,
        quantity: p.quantity.toNumber(),
        total: round2(p.total).toNumber(),
      })),
      byCustomer: Array.from(salesByCustomerMap.values()).map((c) => ({
        name: c.name,
        count: c.count,
        total: round2(c.total).toNumber(),
      })),
    },
    purchases: {
      total: round2(totalPurchases).toNumber(),
      invoiceCount: purchases.length,
      cash: round2(cashPurchases).toNumber(),
      credit: round2(creditPurchases).toNumber(),
    },
    receivables: {
      total: round2(totalCustomerReceivables).toNumber(),
      count: customers.length,
    },
    payables: {
      total: round2(totalSupplierPayables).toNumber(),
      count: suppliers.length,
    },
    cashFlow: {
      cashReceived: round2(totalCashReceived).toNumber(),
      bankReceived: round2(totalBankReceived).toNumber(),
      cashPaid: round2(totalCashPaid).toNumber(),
      bankPaid: round2(totalBankPaid).toNumber(),
      netCash: round2(totalCashReceived.sub(totalCashPaid)).toNumber(),
      netBank: round2(totalBankReceived.sub(totalBankPaid)).toNumber(),
      closingCash: round2(cashTotal).toNumber(),
      closingBank: round2(bankTotal).toNumber(),
    },
    expenses: {
      total: round2(totalExpenses).toNumber(),
      categories: categoryBreakdown,
    },
    inventory: {
      totalValue: round2(closingStockValue).toNumber(),
      productCount: products.length,
      lowStockItems,
    },
    profitAndLoss: {
      netSales: round2(totalSales).toNumber(),
      cogs: round2(totalCOGS).toNumber(),
      grossProfit: grossProfit.toNumber(),
      grossMargin: totalSales.gt(0) ? round2(grossProfit.div(totalSales).mul(100)).toNumber() : 0,
      expenses: round2(totalExpenses).toNumber(),
      netProfit: netProfit.toNumber(),
    },
    warnings,
  };
}

/**
 * Closes an accounting period and locks all historical transactions within it.
 */
export async function closeAccountingPeriod(
  businessId: string,
  year: number,
  month: number,
  userId: string,
  notes?: string
) {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
  const name = `${monthName} ${year}`;

  const period = await prisma.accountingPeriod.upsert({
    where: {
      businessId_year_month: { businessId, year, month },
    },
    update: {
      isClosed: true,
      closedAt: new Date(),
      closedById: userId,
      preClosingNotes: notes,
    },
    create: {
      businessId,
      year,
      month,
      name,
      startDate,
      endDate,
      isClosed: true,
      closedAt: new Date(),
      closedById: userId,
      preClosingNotes: notes,
    },
  });

  await createSafeAuditLog(prisma, {
    businessId,
    userId,
    action: "CLOSE_ACCOUNTING_PERIOD",
    entity: "AccountingPeriod",
    entityId: period.id,
    details: JSON.stringify({ year, month, name, notes }),
  });

  return period;
}

/**
 * Reopens a previously closed accounting period (Admin only).
 */
export async function reopenAccountingPeriod(
  businessId: string,
  year: number,
  month: number,
  userId: string,
  reason: string
) {
  const period = await prisma.accountingPeriod.findUnique({
    where: {
      businessId_year_month: { businessId, year, month },
    },
  });

  if (!period) throw new Error("Accounting period record not found.");

  const updated = await prisma.accountingPeriod.update({
    where: { id: period.id },
    data: {
      isClosed: false,
      preClosingNotes: `${period.preClosingNotes || ""}\n[REOPENED by ${userId}]: ${reason}`,
    },
  });

  await createSafeAuditLog(prisma, {
    businessId,
    userId,
    action: "REOPEN_ACCOUNTING_PERIOD",
    entity: "AccountingPeriod",
    entityId: period.id,
    details: JSON.stringify({ year, month, reason }),
  });

  return updated;
}

/**
 * Items Summary Report (Opening, In, Out, Balance grouped by Category)
 * Matching the client's printed Items Summary sheet (Image 1 & 2)
 */
export async function getItemsSummaryReport(
  businessId: string,
  startDate?: Date,
  endDate?: Date
) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });

  const sDate = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const eDate = endDate || new Date();

  // Fetch all active products with their categories
  const products = await prisma.product.findMany({
    where: { businessId, isActive: true },
    include: { category: true },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  });

  // Fetch inventory transactions
  const allTx = await prisma.inventoryTransaction.findMany({
    where: { businessId },
    orderBy: { date: "asc" },
  });

  // Group by category
  const categoryMap = new Map<string, any>();

  let grandOp = 0;
  let grandIn = 0;
  let grandOut = 0;
  let grandBal = 0;

  for (const prod of products) {
    const catName = prod.category?.name || "MIX MOBILE";
    if (!categoryMap.has(catName)) {
      categoryMap.set(catName, {
        name: catName,
        items: [],
        totals: { count: 0, op: 0, in: 0, out: 0, bal: 0 },
      });
    }

    const catGroup = categoryMap.get(catName)!;

    // Filter transactions for this product
    const prodTx = allTx.filter((t) => t.productId === prod.id);

    // Opening Stock before sDate: openingQuantity + prior IN - prior OUT
    let priorIn = 0;
    let priorOut = 0;
    let rangeIn = 0;
    let rangeOut = 0;

    for (const t of prodTx) {
      const isPositive = ["STOCK_IN", "PURCHASE", "OPENING", "SALE_RETURN"].includes(t.type);
      const isNegative = ["STOCK_OUT", "SALE", "DAMAGE", "PURCHASE_RETURN"].includes(t.type);
      const q = Math.abs(Number(t.quantity));

      const tDate = new Date(t.date);
      if (tDate < sDate) {
        if (isPositive) priorIn += q;
        if (isNegative) priorOut += q;
      } else if (tDate <= eDate) {
        if (isPositive) rangeIn += q;
        if (isNegative) rangeOut += q;
      }
    }

    const op = Number(prod.openingQuantity || 0) + priorIn - priorOut;
    const currentBal = op + rangeIn - rangeOut;

    catGroup.items.push({
      id: prod.id,
      description: prod.name,
      sku: prod.sku,
      unit: prod.unit,
      op,
      in: rangeIn,
      out: rangeOut,
      bal: currentBal,
    });

    catGroup.totals.count += 1;
    catGroup.totals.op += op;
    catGroup.totals.in += rangeIn;
    catGroup.totals.out += rangeOut;
    catGroup.totals.bal += currentBal;

    grandOp += op;
    grandIn += rangeIn;
    grandOut += rangeOut;
    grandBal += currentBal;
  }

  return {
    businessName: business?.name || "HANIF",
    reportTitle: "ITEMS SUMMARY",
    fromDate: sDate.toISOString(),
    toDate: eDate.toISOString(),
    printingTime: new Date().toISOString(),
    categories: Array.from(categoryMap.values()),
    grandTotal: {
      totalItems: products.length,
      op: grandOp,
      in: grandIn,
      out: grandOut,
      bal: grandBal,
    },
  };
}

/**
 * Accounts Receivables Summary Report
 * Matching Image 2 (A/C CODE, A/C NAME, DEBIT AMT., CREDIT AMT., TELEPHONE #)
 */
export async function getReceivablesSummaryReport(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });

  const customers = await prisma.customer.findMany({
    where: { businessId, isActive: true },
    orderBy: { name: "asc" },
  });

  let totalDebit = 0;
  let totalCredit = 0;

  const items = customers.map((c, index) => {
    const bal = Number(c.currentBalance || 0);
    const debitAmt = bal > 0 ? bal : 0;
    const creditAmt = bal < 0 ? Math.abs(bal) : 0;

    totalDebit += debitAmt;
    totalCredit += creditAmt;

    const acCode = `ACR${String(index + 1).padStart(5, "0")}`;

    return {
      id: c.id,
      acCode,
      acName: c.name,
      businessName: c.businessName,
      debitAmt,
      creditAmt,
      telephone: c.phone || "—",
      currentBalance: bal,
    };
  });

  return {
    businessName: business?.name || "HANIF",
    reportTitle: "ACCOUNTS RECEIVABLES SUMMARY",
    reportDate: new Date().toISOString(),
    printingTime: new Date().toISOString(),
    items,
    totals: {
      count: customers.length,
      totalDebit,
      totalCredit,
      netReceivable: totalDebit - totalCredit,
    },
  };
}

/**
 * Accounts Payables Summary Report
 * Matching Image 2 structure for Suppliers
 */
export async function getPayablesSummaryReport(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });

  const suppliers = await prisma.supplier.findMany({
    where: { businessId, isActive: true },
    orderBy: { name: "asc" },
  });

  let totalDebit = 0;
  let totalCredit = 0;

  const items = suppliers.map((s, index) => {
    const bal = Number(s.currentBalance || 0);
    const debitAmt = bal < 0 ? Math.abs(bal) : 0; // Advance paid
    const creditAmt = bal > 0 ? bal : 0; // Payable

    totalDebit += debitAmt;
    totalCredit += creditAmt;

    const acCode = `ACP${String(index + 1).padStart(5, "0")}`;

    return {
      id: s.id,
      acCode,
      acName: s.name,
      businessName: s.businessName,
      debitAmt,
      creditAmt,
      telephone: s.phone || "—",
      currentBalance: bal,
    };
  });

  return {
    businessName: business?.name || "HANIF",
    reportTitle: "ACCOUNTS PAYABLES SUMMARY",
    reportDate: new Date().toISOString(),
    printingTime: new Date().toISOString(),
    items,
    totals: {
      count: suppliers.length,
      totalDebit,
      totalCredit,
      netPayable: totalCredit - totalDebit,
    },
  };
}
