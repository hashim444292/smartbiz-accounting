import { prisma } from "@/lib/prisma";
import { fallbackStore, storeEnsureStandardAccounts } from "@/lib/fallbackStore";
import { Decimal, round2, toDecimal } from "@/lib/decimal";
import { STANDARD_ACCOUNTS, ensureStandardAccounts } from "@/services/accountingService";
import { getProductEffectiveCost } from "@/lib/accountingConstants";
import { createSafeAuditLog } from "@/lib/auditHelper";

export interface OpeningBalanceInput {
  asOfDate?: string | Date;
  capital: {
    amount: number;
    drawings?: number;
    notes?: string;
  };
  cashBank: Array<{
    id?: string;
    name: string;
    type: "CASH" | "BANK";
    accountNumber?: string;
    bankName?: string;
    balance: number;
  }>;
  inventory: Array<{
    productId?: string;
    name: string;
    sku?: string;
    quantity: number;
    unitCost: number;
  }>;
  customers: Array<{
    customerId?: string;
    name: string;
    phone?: string;
    ntn?: string;
    cnic?: string;
    balance: number;
  }>;
  suppliers: Array<{
    supplierId?: string;
    name: string;
    phone?: string;
    balance: number;
  }>;
  autoBalanceWithCapital?: boolean;
}

/**
 * Retrieves the consolidated opening balance state for a business.
 */
export async function getOpeningBalances(businessId: string) {
  if (process.env.DATABASE_URL) {
    try {
      // Auto-heal missing product costs across purchasePrice, averageCost, and openingCost
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "Product" 
           SET "openingCost" = "purchasePrice" 
           WHERE "businessId" = $1 
             AND ("openingCost" = 0 OR "openingCost" IS NULL) 
             AND "purchasePrice" > 0`,
          businessId
        );
        await prisma.$executeRawUnsafe(
          `UPDATE "Product" 
           SET "averageCost" = "purchasePrice" 
           WHERE "businessId" = $1 
             AND ("averageCost" = 0 OR "averageCost" IS NULL) 
             AND "purchasePrice" > 0`,
          businessId
        );
        await prisma.$executeRawUnsafe(
          `UPDATE "Product" 
           SET "purchasePrice" = "openingCost" 
           WHERE "businessId" = $1 
             AND ("purchasePrice" = 0 OR "purchasePrice" IS NULL) 
             AND "openingCost" > 0`,
          businessId
        );
      } catch {
        // Fallback or non-PostgreSQL environment
      }

      const [
        accounts,
        cashBankAccounts,
        products,
        customers,
        suppliers,
        openingJournal,
      ] = await Promise.all([
        prisma.account.findMany({
          where: { businessId, isActive: true },
        }),
        prisma.cashBankAccount.findMany({
          where: { businessId, isActive: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.product.findMany({
          where: { businessId, isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.customer.findMany({
          where: { businessId, isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.supplier.findMany({
          where: { businessId, isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.journalEntry.findFirst({
          where: { businessId, referenceType: "OPENING_BALANCE" },
          include: { lines: { include: { account: true } } },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Calculate totals
      const capitalAcc = accounts.find((a) => a.code === "3010");
      const capitalDrawingsAcc = accounts.find((a) => a.code === "3020");
      const cashAcc = accounts.find((a) => a.code === "1010");
      const bankAcc = accounts.find((a) => a.code === "1020");

      let cashTotal = 0;
      let bankTotal = 0;
      let inventoryTotal = 0;
      let receivablesTotal = 0;
      let payablesTotal = 0;
      let capitalAmount = 0;

      if (openingJournal && openingJournal.lines?.length > 0) {
        // Read strictly from historical opening journal snapshot
        for (const line of openingJournal.lines) {
          const code = line.account?.code;
          const dr = Number(line.debit || 0);
          const cr = Number(line.credit || 0);
          if (code === "1010") cashTotal += dr;
          else if (code === "1020") bankTotal += dr;
          else if (code === "1200") inventoryTotal += dr;
          else if (code === "1100") receivablesTotal += dr;
          else if (code === "2010") payablesTotal += cr;
          else if (code === "3010") capitalAmount += cr;
        }
      } else {
        // Unsaved initial state: calculate strictly from opening balances (never operational running stock)
        cashTotal = cashBankAccounts
          .filter((c) => c.type === "CASH")
          .reduce((sum, c) => sum + Number(c.balance || 0), 0) || Number(cashAcc?.balance || 0);

        bankTotal = cashBankAccounts
          .filter((c) => c.type === "BANK")
          .reduce((sum, c) => sum + Number(c.balance || 0), 0) || Number(bankAcc?.balance || 0);

        inventoryTotal = products.reduce((sum, p) => {
          const qty = Number(p.openingQuantity || 0);
          const cost = getProductEffectiveCost(p);
          return sum + qty * cost;
        }, 0);

        receivablesTotal = customers.reduce(
          (sum, c) => sum + Number(c.openingBalance || 0),
          0
        );

        payablesTotal = suppliers.reduce(
          (sum, s) => sum + Number(s.openingBalance || 0),
          0
        );

        capitalAmount = Number(capitalAcc?.balance || 0);
      }

      const totalAssets = cashTotal + bankTotal + inventoryTotal + receivablesTotal;
      const totalLiabilities = payablesTotal;
      const difference = round2(totalAssets - (totalLiabilities + capitalAmount)).toNumber();
      const isBalanced = Math.abs(difference) < 0.01;

      return {
        asOfDate: openingJournal?.date ? new Date(openingJournal.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        capital: {
          amount: capitalAmount,
          drawings: Number(capitalDrawingsAcc?.balance || 0),
          notes: openingJournal?.description || "Initial Business Capital Setup",
        },
        cashBank: cashBankAccounts.length > 0 ? cashBankAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type as "CASH" | "BANK",
          accountNumber: a.accountNumber || "",
          bankName: a.bankName || "",
          balance: Number(a.balance || 0),
        })) : [
          { id: "cash-default", name: "Cash in Hand (نقد رقم)", type: "CASH" as const, balance: cashTotal },
          { id: "bank-default", name: "Primary Bank Account (بینک اکاؤنٹ)", type: "BANK" as const, balance: bankTotal },
        ],
        inventory: products
          .filter((p) => Number(p.openingQuantity || 0) > 0)
          .map((p) => {
            const unitCost = getProductEffectiveCost(p);
            const quantity = Number(p.openingQuantity || 0);
            return {
              productId: p.id,
              name: p.name,
              sku: p.sku || "",
              quantity,
              unitCost,
              totalValue: quantity * unitCost,
            };
          }),
        customers: customers
          .filter((c) => (openingJournal ? Number(c.openingBalance || 0) > 0 : true))
          .map((c) => ({
            customerId: c.id,
            name: c.name,
            phone: c.phone || "",
            balance: Number(c.openingBalance || 0),
          })),
        suppliers: suppliers
          .filter((s) => (openingJournal ? Number(s.openingBalance || 0) > 0 : true))
          .map((s) => ({
            supplierId: s.id,
            name: s.name,
            phone: s.phone || "",
            balance: Number(s.openingBalance || 0),
          })),
        summary: {
          cashTotal: round2(cashTotal).toNumber(),
          bankTotal: round2(bankTotal).toNumber(),
          inventoryTotal: round2(inventoryTotal).toNumber(),
          receivablesTotal: round2(receivablesTotal).toNumber(),
          totalAssets: round2(totalAssets).toNumber(),
          payablesTotal: round2(payablesTotal).toNumber(),
          totalLiabilities: round2(totalLiabilities).toNumber(),
          capitalAmount: round2(capitalAmount).toNumber(),
          difference,
          isBalanced,
        },
        hasExistingSetup: Boolean(openingJournal),
      };
    } catch (err: any) {
      console.error("Database error in getOpeningBalances, falling back:", err);
    }
  }

  // Fallback store implementation
  const cashAccounts = fallbackStore.cashBankAccounts.filter((a) => a.businessId === businessId);
  const products = fallbackStore.products.filter((p) => p.businessId === businessId);
  const customers = fallbackStore.customers.filter((c) => c.businessId === businessId);
  const suppliers = fallbackStore.suppliers.filter((s) => s.businessId === businessId);
  const capitalAcc = fallbackStore.accounts.find((a) => a.businessId === businessId && a.code === "3010");
  const fallbackOpeningJournal = fallbackStore.journalEntries?.find(
    (j) => j.businessId === businessId && j.referenceType === "OPENING_BALANCE"
  );

  let cashTotal = 0;
  let bankTotal = 0;
  let inventoryTotal = 0;
  let receivablesTotal = 0;
  let payablesTotal = 0;
  let capitalAmount = 0;

  if (fallbackOpeningJournal && fallbackOpeningJournal.lines?.length > 0) {
    for (const line of fallbackOpeningJournal.lines) {
      const code = line.account?.code || (line as any).accountCode;
      const dr = Number(line.debit || 0);
      const cr = Number(line.credit || 0);
      if (code === "1010") cashTotal += dr;
      else if (code === "1020") bankTotal += dr;
      else if (code === "1200") inventoryTotal += dr;
      else if (code === "1100") receivablesTotal += dr;
      else if (code === "2010") payablesTotal += cr;
      else if (code === "3010") capitalAmount += cr;
    }
  } else {
    cashTotal = cashAccounts.filter((a) => a.type === "CASH").reduce((sum, a) => sum + Number(a.balance || 0), 0);
    bankTotal = cashAccounts.filter((a) => a.type === "BANK").reduce((sum, a) => sum + Number(a.balance || 0), 0);
    inventoryTotal = products.reduce((sum, p) => sum + Number(p.openingQuantity || 0) * getProductEffectiveCost(p), 0);
    receivablesTotal = customers.reduce((sum, c) => sum + Number(c.openingBalance || 0), 0);
    payablesTotal = suppliers.reduce((sum, s) => sum + Number(s.openingBalance || 0), 0);
    capitalAmount = Number(capitalAcc?.balance || 0);
  }

  const totalAssets = cashTotal + bankTotal + inventoryTotal + receivablesTotal;
  const totalLiabilities = payablesTotal;
  const difference = round2(totalAssets - (totalLiabilities + capitalAmount)).toNumber();

  return {
    asOfDate: fallbackOpeningJournal?.date ? new Date(fallbackOpeningJournal.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    capital: {
      amount: capitalAmount,
      drawings: 0,
      notes: fallbackOpeningJournal?.description || "Initial Business Capital Setup",
    },
    cashBank: cashAccounts.length > 0 ? cashAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as "CASH" | "BANK",
      accountNumber: a.accountNumber || "",
      bankName: a.bankName || "",
      balance: Number(a.balance || 0),
    })) : [
      { id: "cash-default", name: "Cash in Hand", type: "CASH" as const, balance: cashTotal },
      { id: "bank-default", name: "Main Bank Account", type: "BANK" as const, balance: bankTotal },
    ],
    inventory: products
      .filter((p) => Number(p.openingQuantity || 0) > 0)
      .map((p) => {
        const unitCost = getProductEffectiveCost(p);
        const quantity = Number(p.openingQuantity || 0);
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku || "",
          quantity,
          unitCost,
          totalValue: quantity * unitCost,
        };
      }),
    customers: customers
      .filter((c) => (fallbackOpeningJournal ? Number(c.openingBalance || 0) > 0 : true))
      .map((c) => ({
        customerId: c.id,
        name: c.name,
        phone: c.phone || "",
        balance: Number(c.openingBalance || 0),
      })),
    suppliers: suppliers
      .filter((s) => (fallbackOpeningJournal ? Number(s.openingBalance || 0) > 0 : true))
      .map((s) => ({
        supplierId: s.id,
        name: s.name,
        phone: s.phone || "",
        balance: Number(s.openingBalance || 0),
      })),
    summary: {
      cashTotal: round2(cashTotal).toNumber(),
      bankTotal: round2(bankTotal).toNumber(),
      inventoryTotal: round2(inventoryTotal).toNumber(),
      receivablesTotal: round2(receivablesTotal).toNumber(),
      totalAssets: round2(totalAssets).toNumber(),
      payablesTotal: round2(payablesTotal).toNumber(),
      totalLiabilities: round2(totalLiabilities).toNumber(),
      capitalAmount: round2(capitalAmount).toNumber(),
      difference,
      isBalanced: Math.abs(difference) < 0.01,
    },
    hasExistingSetup: Boolean(fallbackOpeningJournal),
  };
}

/**
 * Saves and posts balanced opening balances across Capital, Cash/Bank, Stock, Receivables, and Payables.
 */
export async function saveOpeningBalances(
  businessId: string,
  input: OpeningBalanceInput,
  user?: { userId?: string; userName?: string; userEmail?: string }
) {
  const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();

  // 1. Calculate live totals
  let cashTotal = 0;
  let bankTotal = 0;
  (input.cashBank || []).forEach((cb) => {
    const bal = Number(cb.balance || 0);
    if (cb.type === "BANK") bankTotal += bal;
    else cashTotal += bal;
  });

  let inventoryTotal = 0;
  (input.inventory || []).forEach((item) => {
    const q = Number(item.quantity || 0);
    const c = Number(item.unitCost || 0);
    inventoryTotal += q * c;
  });

  let receivablesTotal = 0;
  (input.customers || []).forEach((cust) => {
    receivablesTotal += Number(cust.balance || 0);
  });

  let payablesTotal = 0;
  (input.suppliers || []).forEach((sup) => {
    payablesTotal += Number(sup.balance || 0);
  });

  const totalAssets = round2(cashTotal + bankTotal + inventoryTotal + receivablesTotal).toNumber();
  const totalLiabilities = round2(payablesTotal).toNumber();

  let capitalAmount = Number(input.capital?.amount || 0);
  if (input.autoBalanceWithCapital || (capitalAmount === 0 && totalAssets > totalLiabilities)) {
    capitalAmount = round2(totalAssets - totalLiabilities).toNumber();
  }

  // Double-Entry verification
  const totalCredits = round2(totalLiabilities + capitalAmount).toNumber();
  const diff = round2(totalAssets - totalCredits).toNumber();
  if (Math.abs(diff) > 0.01) {
    throw new Error(
      `Opening balances must be mathematically balanced. Total Assets (Rs. ${totalAssets.toLocaleString()}) does not equal Total Liabilities + Capital (Rs. ${totalCredits.toLocaleString()}). Difference: Rs. ${diff.toLocaleString()}. Please click 'Auto-Balance Capital' or adjust your amounts.`
    );
  }

  if (process.env.DATABASE_URL) {
    try {
      return await prisma.$transaction(async (tx) => {
        // A. Upsert Cash & Bank accounts
        for (const cb of input.cashBank || []) {
          if (cb.id && !cb.id.startsWith("cash-") && !cb.id.startsWith("bank-")) {
            await tx.cashBankAccount.update({
              where: { id: cb.id },
              data: {
                balance: Number(cb.balance || 0),
                name: cb.name,
                type: cb.type,
                accountNumber: cb.accountNumber || null,
                bankName: cb.bankName || null,
              },
            });
          } else {
            await tx.cashBankAccount.create({
              data: {
                businessId,
                name: cb.name,
                type: cb.type,
                accountNumber: cb.accountNumber || null,
                bankName: cb.bankName || null,
                balance: Number(cb.balance || 0),
                isActive: true,
              },
            });
          }
        }

        // B. Update Products & Stock
        for (const item of input.inventory || []) {
          const qty = Number(item.quantity || 0);
          const cost = Number(item.unitCost || 0);

          let prodId = item.productId;
          if (prodId) {
            await tx.product.update({
              where: { id: prodId },
              data: {
                currentStock: qty,
                openingQuantity: qty,
                openingCost: cost,
                averageCost: cost,
                purchasePrice: cost,
              },
            });
          } else if (item.name) {
            const newProd = await tx.product.create({
              data: {
                businessId,
                name: item.name,
                sku: item.sku || `SKU-${Date.now().toString().slice(-6)}`,
                currentStock: qty,
                openingQuantity: qty,
                openingCost: cost,
                averageCost: cost,
                purchasePrice: cost,
                retailPrice: cost * 1.2,
                sellingPrice: cost * 1.2,
              },
            });
            prodId = newProd.id;
          }

          // Record Opening Inventory Transaction
          if (prodId && qty > 0) {
            await tx.inventoryTransaction.create({
              data: {
                businessId,
                productId: prodId,
                type: "OPENING",
                quantity: qty,
                unitCost: cost,
                totalCost: qty * cost,
                referenceType: "OPENING_BALANCE",
                notes: `Initial opening inventory stock setup`,
                createdById: user?.userId || null,
                createdByName: user?.userName || "Accountant",
                date: asOfDate,
              },
            });
          }
        }

        // C. Update Customers
        for (const cust of input.customers || []) {
          const bal = Number(cust.balance || 0);
          if (cust.customerId) {
            await tx.customer.update({
              where: { id: cust.customerId },
              data: {
                openingBalance: bal,
                currentBalance: bal,
              },
            });
          } else if (cust.name) {
            await tx.customer.create({
              data: {
                businessId,
                name: cust.name,
                phone: cust.phone || null,
                openingBalance: bal,
                currentBalance: bal,
                notes: JSON.stringify({
                  ntn: cust.ntn || "",
                  cnic: cust.cnic || "",
                  taxStatus: cust.ntn ? "REGISTERED" : "UNREGISTERED",
                }),
              },
            });
          }
        }

        // D. Update Suppliers
        for (const sup of input.suppliers || []) {
          const bal = Number(sup.balance || 0);
          if (sup.supplierId) {
            await tx.supplier.update({
              where: { id: sup.supplierId },
              data: {
                openingBalance: bal,
                currentBalance: bal,
              },
            });
          } else if (sup.name) {
            await tx.supplier.create({
              data: {
                businessId,
                name: sup.name,
                phone: sup.phone || null,
                openingBalance: bal,
                currentBalance: bal,
              },
            });
          }
        }

        // E. Ensure Standard Accounts Exist (Assets, Liabilities, Capital, Revenue, Expenses)
        await ensureStandardAccounts(tx, businessId);

        // F. Remove any prior Opening Balance Journal Entries to prevent duplicate postings
        const existingJournals = await tx.journalEntry.findMany({
          where: { businessId, referenceType: "OPENING_BALANCE" },
          select: { id: true },
        });

        if (existingJournals.length > 0) {
          const journalIds = existingJournals.map((j) => j.id);
          await tx.journalLine.deleteMany({
            where: { journalEntryId: { in: journalIds } },
          });
          await tx.journalEntry.deleteMany({
            where: { id: { in: journalIds } },
          });
        }

        // G. Create Fresh Master Opening Journal Entry
        const journalLinesData: Array<{
          accountCode: string;
          debit: number;
          credit: number;
          description: string;
        }> = [];

        if (cashTotal > 0) {
          journalLinesData.push({
            accountCode: "1010",
            debit: cashTotal,
            credit: 0,
            description: "Opening Cash in Hand (ابتائی نقد)",
          });
        }
        if (bankTotal > 0) {
          journalLinesData.push({
            accountCode: "1020",
            debit: bankTotal,
            credit: 0,
            description: "Opening Bank Accounts (ابتدائی بینک بیلنس)",
          });
        }
        if (inventoryTotal > 0) {
          journalLinesData.push({
            accountCode: "1200",
            debit: inventoryTotal,
            credit: 0,
            description: "Opening Merchandise Inventory (موجودہ اسٹاک)",
          });
        }
        if (receivablesTotal > 0) {
          journalLinesData.push({
            accountCode: "1100",
            debit: receivablesTotal,
            credit: 0,
            description: "Opening Accounts Receivable (گاہکوں سے واجب الوصول)",
          });
        }
        if (payablesTotal > 0) {
          journalLinesData.push({
            accountCode: "2010",
            debit: 0,
            credit: payablesTotal,
            description: "Opening Accounts Payable (سپلائرز کے واجب الادا)",
          });
        }
        if (capitalAmount > 0) {
          journalLinesData.push({
            accountCode: "3010",
            debit: 0,
            credit: capitalAmount,
            description: input.capital?.notes || "Owner's Opening Capital Setup (مالک کا ابتدائی سرمایہ)",
          });
        }

        // Map account codes to IDs
        const resolvedLines: Array<{ accountId: string; debit: number; credit: number; description: string }> = [];
        for (const l of journalLinesData) {
          const acc = await tx.account.findUnique({
            where: { businessId_code: { businessId, code: l.accountCode } },
          });
          if (acc) {
            resolvedLines.push({
              accountId: acc.id,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            });

            // Update account balance
            const isAsset = ["ASSET", "EXPENSE", "COGS"].includes(acc.type);
            const netChange = isAsset ? (l.debit - l.credit) : (l.credit - l.debit);
            await tx.account.update({
              where: { id: acc.id },
              data: { balance: netChange },
            });
          }
        }

        const journalEntry = await tx.journalEntry.create({
          data: {
            businessId,
            entryNumber: `OB-${asOfDate.getFullYear()}-0001`,
            date: asOfDate,
            description: "Official Opening Balance Sheet & Capital Assignment",
            referenceType: "OPENING_BALANCE",
            referenceId: businessId,
            isBalanced: true,
            status: "POSTED",
            createdById: user?.userId || null,
            lines: {
              create: resolvedLines,
            },
          },
          include: { lines: true },
        });

        // H. Safe Audit Log
        await createSafeAuditLog(tx, {
          businessId,
          userId: user?.userId || null,
          userName: user?.userName || "Accountant",
          userEmail: user?.userEmail || null,
          action: "OPENING_BALANCES_CONFIGURED",
          entity: "JournalEntry",
          entityId: journalEntry.id,
          details: `Configured Opening Balances: Capital Rs. ${capitalAmount.toLocaleString()}, Stock Rs. ${inventoryTotal.toLocaleString()}, Receivables Rs. ${receivablesTotal.toLocaleString()}, Payables Rs. ${payablesTotal.toLocaleString()}.`,
        });

        return {
          success: true,
          journalEntry,
          summary: {
            cashTotal,
            bankTotal,
            inventoryTotal,
            receivablesTotal,
            totalAssets,
            payablesTotal,
            totalLiabilities,
            capitalAmount,
            isBalanced: true,
          },
        };
      });
    } catch (err: any) {
      console.error("Database transaction error in saveOpeningBalances, falling back:", err);
      if (err?.message?.includes("must be mathematically balanced")) {
        throw err;
      }
      // Continue to fallbackStore update below
    }
  }

  // Fallback store update
  storeEnsureStandardAccounts(businessId);
  let capitalAcc = fallbackStore.accounts.find((a) => a.businessId === businessId && a.code === "3010");
  if (capitalAcc) {
    capitalAcc.balance = capitalAmount;
  } else {
    fallbackStore.accounts.push({
      id: `acc-3010-${businessId}`,
      businessId,
      code: "3010",
      name: "Owner's Capital",
      type: "EQUITY",
      subType: "Capital",
      balance: capitalAmount,
    });
  }

  // Update fallback customers
  for (const cust of input.customers || []) {
    const existing = fallbackStore.customers.find((c) => c.id === cust.customerId || c.name.toLowerCase() === cust.name.toLowerCase());
    if (existing) {
      existing.openingBalance = cust.balance;
      existing.currentBalance = cust.balance;
    } else if (cust.name) {
      fallbackStore.customers.push({
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        businessId,
        name: cust.name,
        phone: cust.phone || "",
        openingBalance: cust.balance,
        currentBalance: cust.balance,
      });
    }
  }

  // Update fallback suppliers
  for (const sup of input.suppliers || []) {
    const existing = fallbackStore.suppliers.find((s) => s.id === sup.supplierId || s.name.toLowerCase() === sup.name.toLowerCase());
    if (existing) {
      existing.openingBalance = sup.balance;
      existing.currentBalance = sup.balance;
    } else if (sup.name) {
      fallbackStore.suppliers.push({
        id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        businessId,
        name: sup.name,
        phone: sup.phone || "",
        openingBalance: sup.balance,
        currentBalance: sup.balance,
      });
    }
  }

  // Update fallback cash & bank accounts
  for (const cb of input.cashBank || []) {
    const existing = fallbackStore.cashBankAccounts.find(
      (a) => a.id === cb.id || (a.businessId === businessId && a.name.toLowerCase() === cb.name.toLowerCase())
    );
    if (existing) {
      existing.balance = cb.balance;
      existing.name = cb.name;
      existing.type = cb.type;
    } else {
      fallbackStore.cashBankAccounts.push({
        id: cb.id || `cb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        businessId,
        name: cb.name,
        type: cb.type,
        accountNumber: cb.accountNumber || null,
        bankName: cb.bankName || null,
        balance: cb.balance,
        isActive: true,
      } as any);
    }
  }

  // Update fallback products
  for (const item of input.inventory || []) {
    const existing = fallbackStore.products.find((p) => p.id === item.productId || p.name.toLowerCase() === item.name.toLowerCase());
    if (existing) {
      existing.currentStock = item.quantity;
      existing.openingQuantity = item.quantity;
      existing.purchasePrice = item.unitCost;
    } else if (item.name) {
      fallbackStore.products.push({
        id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        businessId,
        name: item.name,
        sku: item.sku || `SKU-${Date.now().toString().slice(-4)}`,
        currentStock: item.quantity,
        openingQuantity: item.quantity,
        purchasePrice: item.unitCost,
        sellingPrice: item.unitCost * 1.2,
      });
    }
  }

  // Record master opening journal in fallbackStore
  if (!fallbackStore.journalEntries) fallbackStore.journalEntries = [];
  fallbackStore.journalEntries = fallbackStore.journalEntries.filter(
    (j) => !(j.businessId === businessId && j.referenceType === "OPENING_BALANCE")
  );

  const fallbackLines: any[] = [];
  if (cashTotal > 0) fallbackLines.push({ accountCode: "1010", debit: cashTotal, credit: 0, description: "Opening Cash in Hand" });
  if (bankTotal > 0) fallbackLines.push({ accountCode: "1020", debit: bankTotal, credit: 0, description: "Opening Bank Accounts" });
  if (inventoryTotal > 0) fallbackLines.push({ accountCode: "1200", debit: inventoryTotal, credit: 0, description: "Opening Stock" });
  if (receivablesTotal > 0) fallbackLines.push({ accountCode: "1100", debit: receivablesTotal, credit: 0, description: "Opening Receivables" });
  if (payablesTotal > 0) fallbackLines.push({ accountCode: "2010", debit: 0, credit: payablesTotal, description: "Opening Payables" });
  if (capitalAmount > 0) fallbackLines.push({ accountCode: "3010", debit: 0, credit: capitalAmount, description: "Owner's Capital" });

  fallbackStore.journalEntries.push({
    id: `ob-jnl-${Date.now()}`,
    businessId,
    entryNumber: `OB-${asOfDate.getFullYear()}-0001`,
    date: asOfDate,
    description: "Official Opening Balance Sheet & Capital Assignment",
    referenceType: "OPENING_BALANCE",
    referenceId: businessId,
    isBalanced: true,
    status: "POSTED",
    lines: fallbackLines,
  } as any);

  return {
    success: true,
    fallback: true,
    summary: {
      cashTotal,
      bankTotal,
      inventoryTotal,
      receivablesTotal,
      totalAssets,
      payablesTotal,
      totalLiabilities,
      capitalAmount,
      isBalanced: true,
    },
  };
}
