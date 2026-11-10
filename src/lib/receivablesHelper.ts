import { PrismaClient, Prisma } from "@prisma/client";
import { fallbackStore } from "@/lib/fallbackStore";
import { Decimal, round2, toDecimal } from "@/lib/decimal";

/**
 * Universal safe calculation of Total Receivables
 * Takes the maximum of customer balances and outstanding sales invoices
 * to ensure no orphaned receivables evaluate to 0.
 */
export function extractSaleReturns(sales: any[]): Array<{
  id: string;
  saleId: string;
  amount: number;
}> {
  const returns: Array<{
    id: string;
    saleId: string;
    amount: number;
  }> = [];

  sales.forEach((s) => {
    let parsedHistory: any[] = [];
    if (Array.isArray(s.returnHistory)) {
      parsedHistory = s.returnHistory;
    } else if (typeof s.notes === "string" && s.notes.includes("returnHistory")) {
      try {
        const parsed = JSON.parse(s.notes);
        if (Array.isArray(parsed.returnHistory)) {
          parsedHistory = parsed.returnHistory;
        }
      } catch {}
    }

    if (parsedHistory.length > 0) {
      parsedHistory.forEach((ret: any, idx: number) => {
        let retAmt = 0;
        if (ret.receivableReduction !== undefined) {
          retAmt = Number(ret.receivableReduction || 0);
        } else if (ret.cashRefund !== undefined) {
          retAmt = Math.max(0, Number(ret.totalRefundAmount || ret.totalAmount || ret.amount || 0) - Number(ret.cashRefund || 0));
        } else {
          retAmt = Number(ret.totalRefundAmount || ret.totalAmount || ret.amount || 0);
        }

        if (retAmt > 0) {
          returns.push({
            id: `cn-${s.id}-${idx}`,
            saleId: s.id,
            amount: retAmt,
          });
        }
      });
    } else if (Number(s.totalReturnedAmount || 0) > 0) {
      returns.push({
        id: `cn-tot-${s.id}`,
        saleId: s.id,
        amount: Number(s.totalReturnedAmount),
      });
    }
  });

  return returns;
}

/**
 * Universal safe calculation of Total Receivables
 * Prefers reconciled customer balances and falls back to sales remaining
 * to ensure accuracy after receipts.
 */
export function calculateTotalReceivables(customers: any[] = [], sales: any[] = []): number {
  const customerTotal = (customers || []).reduce(
    (sum, c) => sum + Math.max(0, Number(c?.currentBalance || 0)),
    0
  );
  const salesTotal = (sales || []).reduce(
    (sum, s) => {
      if (s?.status === "CANCELLED") return sum;
      return sum + Number(s?.remainingAmount || 0);
    },
    0
  );
  if (customerTotal > 0) return customerTotal;
  return salesTotal;
}

/**
 * Reconciles and synchronizes customer balances, sales invoice links, Account 1100 (Accounts Receivable),
 * and customer accounts for a business in PostgreSQL using complete double-entry subsidiary ledger math.
 */
export async function reconcileCustomerReceivables(
  prismaClient: PrismaClient | typeof import("@/lib/prisma").prisma,
  businessId: string
): Promise<{ totalReceivables: number; customerCount: number }> {
  if (!businessId) return { totalReceivables: 0, customerCount: 0 };

  try {
    // 1. Fetch all sales for this business
    const sales = await prismaClient.sale.findMany({
      where: { businessId },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        customerName: true,
        totalAmount: true,
        paidAmount: true,
        remainingAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        status: true,
        date: true,
        updatedAt: true,
        notes: true,
      },
    });

    // 2. Fetch all customer receipt payments
    const payments = await prismaClient.payment.findMany({
      where: {
        businessId,
        type: "RECEIPT",
      },
      select: {
        id: true,
        amount: true,
        customerId: true,
        partyName: true,
        partyType: true,
        referenceNumber: true,
        paymentMethod: true,
        allocations: {
          select: {
            saleId: true,
            amount: true,
          },
        },
      },
    });

    // 3. Fetch all registered customers
    const existingCustomers = await prismaClient.customer.findMany({
      where: { businessId },
    });

    const customerMap = new Map<
      string,
      {
        displayName: string;
        knownCustomerId: string | null;
        customerRecord: any | null;
      }
    >();

    for (const c of existingCustomers) {
      const normKey = (c.name || "").toLowerCase().trim();
      customerMap.set(normKey, {
        displayName: c.name,
        knownCustomerId: c.id,
        customerRecord: c,
      });
    }

    for (const s of sales) {
      const rawName = (s.customerName || "Walk In Customer").trim();
      const normKey = rawName.toLowerCase();
      if (!customerMap.has(normKey)) {
        customerMap.set(normKey, {
          displayName: rawName,
          knownCustomerId: s.customerId || null,
          customerRecord: null,
        });
      } else if (s.customerId && !customerMap.get(normKey)!.knownCustomerId) {
        customerMap.get(normKey)!.knownCustomerId = s.customerId;
      }
    }

    let grandRemaining = new Decimal(0);
    let customerCount = 0;

    // 4. Upsert / update Customer records with true subsidiary ledger balances
    for (const [normKey, data] of customerMap.entries()) {
      customerCount++;
      let targetCust: any =
        data.customerRecord ||
        existingCustomers.find(
          (c) => (data.knownCustomerId && c.id === data.knownCustomerId) || c.name.toLowerCase().trim() === normKey
        );

      const custSales = sales.filter((s) => {
        const matchesId = targetCust && s.customerId && s.customerId === targetCust.id;
        const matchesName = (s.customerName || "").toLowerCase().trim() === normKey;
        if (!matchesId && !matchesName) return false;
        if (s.status !== "CANCELLED") return true;
        const hasReturns = typeof s.notes === "string" && s.notes.includes("returnHistory");
        return hasReturns;
      });

      const custInvoiceNumbers = new Set(custSales.map((s) => (s.invoiceNumber || "").trim()).filter(Boolean));
      const custSaleIds = new Set(custSales.map((s) => s.id));

      const seenPaymentIds = new Set<string>();
      let custDbPayments = new Decimal(0);

      payments.forEach((p) => {
        if (seenPaymentIds.has(p.id)) return;
        const matchesId = targetCust && p.customerId && p.customerId === targetCust.id;
        const matchesName = p.partyType === "CUSTOMER" && (p.partyName || "").toLowerCase().trim() === normKey;
        const matchesRef = p.referenceNumber && custInvoiceNumbers.has(p.referenceNumber.trim());
        const matchesAlloc = Array.isArray(p.allocations) && p.allocations.some((a: any) => a.saleId && custSaleIds.has(a.saleId));

        if (matchesId || matchesName || matchesRef || matchesAlloc) {
          seenPaymentIds.add(p.id);
          custDbPayments = custDbPayments.add(toDecimal(p.amount || 0));
        }
      });

      const totalSalePaid = custSales.reduce((sum, s) => sum.add(toDecimal(s.paidAmount || 0)), new Decimal(0));
      const unrepresentedShortfall = Decimal.max(0, totalSalePaid.sub(custDbPayments));

      const returns = extractSaleReturns(custSales);
      const totalReturns = returns.reduce((sum, r) => sum.add(toDecimal(r.amount || 0)), new Decimal(0));

      const totalSalesAmount = custSales.reduce((sum, s) => sum.add(toDecimal(s.totalAmount || 0)), new Decimal(0));
      const opBal = targetCust ? toDecimal(targetCust.openingBalance || 0) : new Decimal(0);
      const curBal = targetCust ? toDecimal(targetCust.currentBalance || 0) : new Decimal(0);

      const openDues = custSales.reduce((sum, s) => {
        if (s.status === "CANCELLED") return sum;
        return sum.add(toDecimal(s.remainingAmount || 0));
      }, new Decimal(0));

      let calcReceivable = opBal.add(totalSalesAmount).sub(custDbPayments).sub(unrepresentedShortfall).sub(totalReturns);
      if (openDues.gt(0) && calcReceivable.lte(0)) {
        calcReceivable = opBal.add(openDues);
      } else if (custSales.length === 0 && custDbPayments.isZero() && curBal.gt(0) && opBal.isZero()) {
        calcReceivable = curBal;
      }

      const trueReceivable = round2(calcReceivable).toNumber();

      if (trueReceivable > 0) {
        grandRemaining = grandRemaining.add(toDecimal(trueReceivable));
      }

      if (!targetCust) {
        try {
          targetCust = await prismaClient.customer.create({
            data: {
              businessId,
              name: data.displayName,
              openingBalance: 0,
              currentBalance: trueReceivable,
              isActive: true,
            },
          });
        } catch {
          targetCust = await prismaClient.customer.findFirst({
            where: { businessId, name: { equals: data.displayName, mode: "insensitive" } },
          });
        }
      } else {
        const existingNum = Number(targetCust.currentBalance || 0);
        if (Math.abs(existingNum - trueReceivable) > 0.01) {
          try {
            await prismaClient.customer.update({
              where: { id: targetCust.id },
              data: { currentBalance: trueReceivable },
            });
          } catch (e) {
            console.error(`Failed to update customer balance for ${targetCust.id}:`, e);
          }
        }
      }

      // Link unlinked sales to this customer
      if (targetCust) {
        const unlinkedSales = custSales.filter((s) => !s.customerId);
        for (const unlinked of unlinkedSales) {
          try {
            await prismaClient.sale.update({
              where: { id: unlinked.id },
              data: { customerId: targetCust.id },
            });
          } catch (e) {
            console.error(`Failed to link sale ${unlinked.id} to customer ${targetCust.id}:`, e);
          }
        }
      }
    }

    // 5. Synchronize Account 1100 (Accounts Receivable)
    const totalReceivables = round2(grandRemaining).toNumber();
    try {
      const acc1100 = await prismaClient.account.findUnique({
        where: { businessId_code: { businessId, code: "1100" } },
      });
      if (acc1100) {
        if (Math.abs(Number(acc1100.balance || 0) - totalReceivables) > 0.01) {
          await prismaClient.account.update({
            where: { id: acc1100.id },
            data: { balance: totalReceivables },
          });
        }
      } else {
        await prismaClient.account.create({
          data: {
            businessId,
            code: "1100",
            name: "Accounts Receivable",
            type: "ASSET",
            subType: "Current Asset",
            balance: totalReceivables,
            isSystem: true,
          },
        });
      }
    } catch (e) {
      console.error("Failed to sync Account 1100 in DB:", e);
    }

    return { totalReceivables, customerCount };
  } catch (error: any) {
    console.error("reconcileCustomerReceivables DB notice:", error?.message || error);
    return storeReconcileCustomerReceivables(businessId);
  }
}

/**
 * Reconciles and synchronizes customer balances, sales links, and Account 1100
 * in the in-memory fallbackStore.
 */
export function storeReconcileCustomerReceivables(
  businessId: string
): { totalReceivables: number; customerCount: number } {
  if (!businessId) return { totalReceivables: 0, customerCount: 0 };

  const sales = fallbackStore.sales.filter(
    (s) => s.businessId === businessId && s.status !== "CANCELLED"
  );
  const payments = (fallbackStore.payments || []).filter(
    (p) => p.businessId === businessId && p.type === "RECEIPT"
  );
  const existingCustomers = fallbackStore.customers.filter((c) => c.businessId === businessId);

  const customerMap = new Map<
    string,
    {
      displayName: string;
      knownCustomerId: string | null;
      customerRecord: any | null;
    }
  >();

  for (const c of existingCustomers) {
    const normKey = (c.name || "").toLowerCase().trim();
    customerMap.set(normKey, {
      displayName: c.name,
      knownCustomerId: c.id,
      customerRecord: c,
    });
  }

  for (const s of sales) {
    const rawName = (s.customerName || "Walk In Customer").trim();
    const normKey = rawName.toLowerCase();
    if (!customerMap.has(normKey)) {
      customerMap.set(normKey, {
        displayName: rawName,
        knownCustomerId: s.customerId || null,
        customerRecord: null,
      });
    } else if (s.customerId && !customerMap.get(normKey)!.knownCustomerId) {
      customerMap.get(normKey)!.knownCustomerId = s.customerId;
    }
  }

  let grandRemaining = 0;
  let customerCount = 0;

  for (const [normKey, data] of customerMap.entries()) {
    customerCount++;
    let targetCust =
      data.customerRecord ||
      existingCustomers.find(
        (c) => (data.knownCustomerId && c.id === data.knownCustomerId) || c.name.toLowerCase().trim() === normKey
      );

    const custSales = sales.filter((s) => {
      const matchesId = targetCust && s.customerId && s.customerId === targetCust.id;
      const matchesName = (s.customerName || "").toLowerCase().trim() === normKey;
      return matchesId || matchesName;
    });

    const custInvoiceNumbers = new Set(custSales.map((s) => (s.invoiceNumber || "").trim()).filter(Boolean));
    const custSaleIds = new Set(custSales.map((s) => s.id));

    const seenPaymentIds = new Set<string>();
    let custDbPayments = 0;

    payments.forEach((p) => {
      if (seenPaymentIds.has(p.id)) return;
      const matchesId = targetCust && p.customerId && p.customerId === targetCust.id;
      const matchesName = p.partyType === "CUSTOMER" && (p.partyName || "").toLowerCase().trim() === normKey;
      const matchesRef = p.referenceNumber && custInvoiceNumbers.has(p.referenceNumber.trim());
      const matchesAlloc = Array.isArray(p.allocations) && p.allocations.some((a: any) => a.saleId && custSaleIds.has(a.saleId));

      if (matchesId || matchesName || matchesRef || matchesAlloc) {
        seenPaymentIds.add(p.id);
        custDbPayments += Number(p.amount || 0);
      }
    });

    const totalSalePaid = custSales.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
    const unrepresentedShortfall = Math.max(0, totalSalePaid - custDbPayments);

    const returns = extractSaleReturns(custSales);
    const totalReturns = returns.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const totalSalesAmount = custSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const opBal = Number(targetCust?.openingBalance || 0);
    const curBal = Number(targetCust?.currentBalance || 0);

    const openDues = custSales.reduce((sum, s) => {
      if (s.status === "CANCELLED") return sum;
      return sum + Number(s.remainingAmount || 0);
    }, 0);

    let trueReceivable = opBal + totalSalesAmount - custDbPayments - unrepresentedShortfall - totalReturns;
    if (openDues > 0 && trueReceivable <= 0) {
      trueReceivable = opBal + openDues;
    } else if (custSales.length === 0 && custDbPayments === 0 && curBal > 0 && opBal === 0) {
      trueReceivable = curBal;
    }

    if (trueReceivable > 0) {
      grandRemaining += trueReceivable;
    }

    if (!targetCust) {
      targetCust = {
        id: data.knownCustomerId || `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        businessId,
        name: data.displayName,
        phone: "",
        openingBalance: 0,
        currentBalance: trueReceivable,
        isActive: true,
      } as any;
      fallbackStore.customers.push(targetCust!);
    } else {
      targetCust.currentBalance = trueReceivable;
    }

    // Link unlinked sales
    sales
      .filter((s) => !s.customerId && (s.customerName || "").toLowerCase().trim() === normKey)
      .forEach((s) => {
        s.customerId = targetCust!.id;
      });
  }

  // Synchronize Account 1100
  let acc1100 = fallbackStore.accounts.find((a) => a.businessId === businessId && a.code === "1100");
  if (acc1100) {
    acc1100.balance = grandRemaining;
  } else {
    fallbackStore.accounts.push({
      id: `acc-1100-${businessId}`,
      businessId,
      code: "1100",
      name: "Accounts Receivable",
      type: "ASSET",
      subType: "Current Asset",
      balance: grandRemaining,
      isSystem: true,
    } as any);
  }

  return { totalReceivables: grandRemaining, customerCount };
}
