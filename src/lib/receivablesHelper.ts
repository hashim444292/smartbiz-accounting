import { PrismaClient, Prisma } from "@prisma/client";
import { fallbackStore } from "@/lib/fallbackStore";
import { Decimal, round2, toDecimal } from "@/lib/decimal";

/**
 * Universal safe calculation of Total Receivables
 * Takes the maximum of customer balances and outstanding sales invoices
 * to ensure no orphaned receivables evaluate to 0.
 */
export function calculateTotalReceivables(customers: any[] = [], sales: any[] = []): number {
  const customerTotal = (customers || []).reduce(
    (sum, c) => sum + Number(c?.currentBalance || 0),
    0
  );
  const salesTotal = (sales || []).reduce(
    (sum, s) => {
      if (s?.status === "CANCELLED") return sum;
      return sum + Number(s?.remainingAmount || 0);
    },
    0
  );
  return Math.max(customerTotal, salesTotal);
}

/**
 * Reconciles and synchronizes customer balances, sales invoice links, Account 1100 (Accounts Receivable),
 * and customer accounts for a business in PostgreSQL.
 */
export async function reconcileCustomerReceivables(
  prismaClient: PrismaClient | typeof import("@/lib/prisma").prisma,
  businessId: string
): Promise<{ totalReceivables: number; customerCount: number }> {
  if (!businessId) return { totalReceivables: 0, customerCount: 0 };

  try {
    // 1. Fetch all sales for this business
    const sales = await prismaClient.sale.findMany({
      where: { businessId, status: { not: "CANCELLED" } },
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
        date: true,
      },
    });

    // 2. Fetch all registered customers
    const existingCustomers = await prismaClient.customer.findMany({
      where: { businessId },
    });

    const customerMap = new Map<
      string,
      {
        displayName: string;
        knownCustomerId: string | null;
        totalRemaining: Decimal;
        totalSales: Decimal;
        totalPaid: Decimal;
        saleIds: string[];
      }
    >();

    let grandRemaining = new Decimal(0);

    // Group sales by normalized customer name
    for (const s of sales) {
      const rawName = (s.customerName || "Walk In Customer").trim();
      const normKey = rawName.toLowerCase();
      const rem = toDecimal(s.remainingAmount || 0);
      const tot = toDecimal(s.totalAmount || 0);
      const paid = toDecimal(s.paidAmount || 0);

      grandRemaining = grandRemaining.add(rem);

      const entry = customerMap.get(normKey) || {
        displayName: rawName,
        knownCustomerId: s.customerId || null,
        totalRemaining: new Decimal(0),
        totalSales: new Decimal(0),
        totalPaid: new Decimal(0),
        saleIds: [] as string[],
      };

      entry.totalRemaining = entry.totalRemaining.add(rem);
      entry.totalSales = entry.totalSales.add(tot);
      entry.totalPaid = entry.totalPaid.add(paid);
      entry.saleIds.push(s.id);
      if (!entry.knownCustomerId && s.customerId) {
        entry.knownCustomerId = s.customerId;
      }

      customerMap.set(normKey, entry);
    }

    // Include existing customers with openingBalance who might not have sales yet
    for (const c of existingCustomers) {
      const normKey = (c.name || "").toLowerCase().trim();
      if (!customerMap.has(normKey)) {
        const opBal = toDecimal(c.openingBalance || 0);
        const curBal = toDecimal(c.currentBalance || 0);
        const effectiveBal = opBal.gt(curBal) ? opBal : curBal;
        customerMap.set(normKey, {
          displayName: c.name,
          knownCustomerId: c.id,
          totalRemaining: effectiveBal,
          totalSales: new Decimal(0),
          totalPaid: new Decimal(0),
          saleIds: [] as string[],
        });
        grandRemaining = grandRemaining.add(effectiveBal);
      }
    }

    let customerCount = 0;

    // 3. Upsert / update Customer records and link unlinked sales
    for (const [normKey, data] of customerMap.entries()) {
      customerCount++;
      let targetCust: any = existingCustomers.find(
        (c) => (data.knownCustomerId && c.id === data.knownCustomerId) || c.name.toLowerCase().trim() === normKey
      );

      const trueReceivable = round2(data.totalRemaining).toNumber();

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
        // If currentBalance is 0 or less than the real remaining sales amount, auto-heal it
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
        const unlinkedSales = sales.filter(
          (s) => !s.customerId && (s.customerName || "").toLowerCase().trim() === normKey
        );
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

    // 4. Synchronize Account 1100 (Accounts Receivable)
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
  const existingCustomers = fallbackStore.customers.filter((c) => c.businessId === businessId);

  const customerMap = new Map<
    string,
    {
      displayName: string;
      knownCustomerId: string | null;
      totalRemaining: number;
      saleIds: string[];
    }
  >();

  let grandRemaining = 0;

  for (const s of sales) {
    const rawName = (s.customerName || "Walk In Customer").trim();
    const normKey = rawName.toLowerCase();
    const rem = Number(s.remainingAmount || 0);

    grandRemaining += rem;

    const entry = customerMap.get(normKey) || {
      displayName: rawName,
      knownCustomerId: s.customerId || null,
      totalRemaining: 0,
      saleIds: [] as string[],
    };

    entry.totalRemaining += rem;
    entry.saleIds.push(s.id);
    if (!entry.knownCustomerId && s.customerId) {
      entry.knownCustomerId = s.customerId;
    }

    customerMap.set(normKey, entry);
  }

  // Include existing customers with balances
  for (const c of existingCustomers) {
    const normKey = (c.name || "").toLowerCase().trim();
    if (!customerMap.has(normKey)) {
      const bal = Number(c.currentBalance || c.openingBalance || 0);
      customerMap.set(normKey, {
        displayName: c.name,
        knownCustomerId: c.id,
        totalRemaining: bal,
        saleIds: [] as string[],
      });
      grandRemaining += bal;
    }
  }

  let customerCount = 0;

  for (const [normKey, data] of customerMap.entries()) {
    customerCount++;
    let targetCust = existingCustomers.find(
      (c) => (data.knownCustomerId && c.id === data.knownCustomerId) || c.name.toLowerCase().trim() === normKey
    );

    const trueReceivable = data.totalRemaining;

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
