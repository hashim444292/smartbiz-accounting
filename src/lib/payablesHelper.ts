import { PrismaClient, Prisma } from "@prisma/client";
import { fallbackStore } from "@/lib/fallbackStore";
import { Decimal, round2, toDecimal } from "@/lib/decimal";

/**
 * Universal safe calculation of Total Payables
 * Takes the maximum of supplier balances and outstanding purchase bills
 * to ensure no orphaned payables evaluate to 0.
 */
export function calculateTotalPayables(suppliers: any[] = [], purchases: any[] = []): number {
  const supplierTotal = (suppliers || []).reduce(
    (sum, s) => sum + Number(s?.currentBalance || 0),
    0
  );
  const purchaseTotal = (purchases || []).reduce(
    (sum, p) => {
      if (p?.status === "CANCELLED") return sum;
      return sum + Number(p?.remainingAmount || 0);
    },
    0
  );
  return Math.max(supplierTotal, purchaseTotal);
}

/**
 * Reconciles and synchronizes supplier balances, purchase links, Account 2010,
 * and double-entry purchase journal entries for a business in PostgreSQL.
 */
export async function reconcileSupplierPayables(
  prismaClient: PrismaClient | typeof import("@/lib/prisma").prisma,
  businessId: string
): Promise<{ totalPayables: number; supplierCount: number }> {
  if (!businessId) return { totalPayables: 0, supplierCount: 0 };

  try {
    // 1. Fetch all purchases for this business
    const purchases = await prismaClient.purchase.findMany({
      where: { businessId },
      select: {
        id: true,
        purchaseNumber: true,
        supplierId: true,
        supplierName: true,
        totalAmount: true,
        paidAmount: true,
        remainingAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        date: true,
      },
    });

    if (!purchases || purchases.length === 0) {
      return { totalPayables: 0, supplierCount: 0 };
    }

    // 2. Group purchases by supplier name (normalized lowercase)
    const supplierMap = new Map<
      string,
      {
        displayName: string;
        knownSupplierId: string | null;
        totalRemaining: Decimal;
        totalPurchases: Decimal;
        totalPaid: Decimal;
        purchaseIds: string[];
      }
    >();

    let grandRemaining = new Decimal(0);

    for (const p of purchases) {
      const rawName = (p.supplierName || "General Supplier").trim();
      const normKey = rawName.toLowerCase();
      const rem = toDecimal(p.remainingAmount || 0);
      const tot = toDecimal(p.totalAmount || 0);
      const paid = toDecimal(p.paidAmount || 0);

      grandRemaining = grandRemaining.add(rem);

      const entry = supplierMap.get(normKey) || {
        displayName: rawName,
        knownSupplierId: p.supplierId || null,
        totalRemaining: new Decimal(0),
        totalPurchases: new Decimal(0),
        totalPaid: new Decimal(0),
        purchaseIds: [],
      };

      entry.totalRemaining = entry.totalRemaining.add(rem);
      entry.totalPurchases = entry.totalPurchases.add(tot);
      entry.totalPaid = entry.totalPaid.add(paid);
      entry.purchaseIds.push(p.id);
      if (!entry.knownSupplierId && p.supplierId) {
        entry.knownSupplierId = p.supplierId;
      }

      supplierMap.set(normKey, entry);
    }

    // 3. Reconcile / Auto-provision Supplier records in PostgreSQL
    for (const [normKey, data] of supplierMap.entries()) {
      let existingSupplier: any = null;

      if (data.knownSupplierId) {
        existingSupplier = await prismaClient.supplier.findUnique({
          where: { id: data.knownSupplierId },
        });
      }

      if (!existingSupplier) {
        existingSupplier = await prismaClient.supplier.findFirst({
          where: {
            businessId,
            name: { equals: data.displayName, mode: "insensitive" },
          },
        });
      }

      let activeSupId = existingSupplier?.id;

      if (!existingSupplier) {
        // Auto-provision supplier record
        const newSup = await prismaClient.supplier.create({
          data: {
            businessId,
            name: data.displayName,
            businessName: data.displayName,
            openingBalance: 0,
            currentBalance: data.totalRemaining.toNumber(),
            isActive: true,
          },
        });
        activeSupId = newSup.id;
      } else {
        // Ensure current balance reflects at least the remaining open payables
        const currentBal = toDecimal(existingSupplier.currentBalance || 0);
        if (currentBal.lt(data.totalRemaining) || currentBal.isZero()) {
          await prismaClient.supplier.update({
            where: { id: existingSupplier.id },
            data: { currentBalance: data.totalRemaining.toNumber() },
          });
        }
      }

      // Link any unlinked purchases to this supplier record
      if (activeSupId) {
        await prismaClient.purchase.updateMany({
          where: {
            businessId,
            id: { in: data.purchaseIds },
            OR: [{ supplierId: null }, { supplierId: { not: activeSupId } }],
          },
          data: { supplierId: activeSupId },
        });
      }
    }

    // 4. Reconcile Account 2010 (Accounts Payable) in Chart of Accounts
    const payablesTotalNum = round2(grandRemaining).toNumber();

    let account2010 = await prismaClient.account.findUnique({
      where: { businessId_code: { businessId, code: "2010" } },
    });

    if (!account2010) {
      account2010 = await prismaClient.account.create({
        data: {
          businessId,
          code: "2010",
          name: "Accounts Payable",
          type: "LIABILITY",
          subType: "Payable",
          balance: payablesTotalNum,
          isSystem: true,
          isActive: true,
        },
      });
    } else {
      const currentAccBal = toDecimal(account2010.balance || 0);
      if (payablesTotalNum > 0 && (currentAccBal.isZero() || currentAccBal.lt(grandRemaining))) {
        await prismaClient.account.update({
          where: { id: account2010.id },
          data: { balance: payablesTotalNum },
        });
      }
    }

    // 5. Ensure Balanced Double-Entry Journal Entries exist for open purchases
    const account1200 = await prismaClient.account.findUnique({
      where: { businessId_code: { businessId, code: "1200" } },
    });
    const account1010 = await prismaClient.account.findUnique({
      where: { businessId_code: { businessId, code: "1010" } },
    });
    const account1020 = await prismaClient.account.findUnique({
      where: { businessId_code: { businessId, code: "1020" } },
    });

    if (account2010 && account1200) {
      for (const p of purchases) {
        const rem = toDecimal(p.remainingAmount || 0);
        if (rem.gt(0)) {
          const existingEntry = await prismaClient.journalEntry.findFirst({
            where: {
              businessId,
              referenceType: "PURCHASE",
              referenceId: p.id,
            },
            select: { id: true },
          });

          if (!existingEntry) {
            const paid = toDecimal(p.paidAmount || 0);
            const tot = toDecimal(p.totalAmount || 0);
            const isBank = p.paymentMethod === "BANK";
            const cashBankAccId = isBank ? (account1020?.id || account1010?.id) : (account1010?.id || account1020?.id);

            const jLines: Array<{ accountId: string; debit: number; credit: number; description?: string }> = [
              {
                accountId: account1200.id,
                debit: tot.toNumber(),
                credit: 0,
                description: `Purchased merchandise on #${p.purchaseNumber}`,
              },
            ];

            if (paid.gt(0) && cashBankAccId) {
              jLines.push({
                accountId: cashBankAccId,
                debit: 0,
                credit: paid.toNumber(),
                description: `Payment for purchase #${p.purchaseNumber}`,
              });
            }

            jLines.push({
              accountId: account2010.id,
              debit: 0,
              credit: rem.toNumber(),
              description: `Payable to ${p.supplierName} for #${p.purchaseNumber}`,
            });

            const pDate = p.date ? new Date(p.date) : new Date();
            const entryNumber = `JE-PUR-${p.purchaseNumber}`;

            await prismaClient.journalEntry.create({
              data: {
                businessId,
                entryNumber,
                date: pDate,
                description: `Purchase Bill #${p.purchaseNumber} from ${p.supplierName}`,
                referenceType: "PURCHASE",
                referenceId: p.id,
                isBalanced: true,
                status: "POSTED",
                lines: {
                  create: jLines,
                },
              },
            }).catch(() => null); // Ignore if duplicate entryNumber
          }
        }
      }
    }

    return { totalPayables: payablesTotalNum, supplierCount: supplierMap.size };
  } catch (err: any) {
    console.warn("reconcileSupplierPayables DB notice:", err?.message || err);
    return storeReconcileSupplierPayables(businessId);
  }
}

/**
 * Reconciles and synchronizes supplier balances, purchase links, Account 2010,
 * and double-entry purchase journal entries for fallbackStore.
 */
export function storeReconcileSupplierPayables(businessId: string): {
  totalPayables: number;
  supplierCount: number;
} {
  if (!businessId) return { totalPayables: 0, supplierCount: 0 };

  const purchases = fallbackStore.purchases.filter(
    (p) => p.businessId === businessId && p.status !== "CANCELLED"
  );

  if (!purchases || purchases.length === 0) {
    const suppliers = fallbackStore.suppliers.filter((s) => s.businessId === businessId);
    const supTotal = suppliers.reduce((sum, s) => sum + Number(s.currentBalance || 0), 0);
    return { totalPayables: supTotal, supplierCount: suppliers.length };
  }

  const supplierMap = new Map<
    string,
    {
      displayName: string;
      knownSupplierId: string | null;
      totalRemaining: number;
      purchaseIds: string[];
    }
  >();

  let grandRemaining = 0;

  for (const p of purchases) {
    const rawName = (p.supplierName || "General Supplier").trim();
    const normKey = rawName.toLowerCase();
    const rem = Number(p.remainingAmount || 0);

    grandRemaining += rem;

    const entry = supplierMap.get(normKey) || {
      displayName: rawName,
      knownSupplierId: p.supplierId || null,
      totalRemaining: 0,
      purchaseIds: [] as string[],
    };

    entry.totalRemaining += rem;
    entry.purchaseIds.push(p.id);
    if (!entry.knownSupplierId && p.supplierId) {
      entry.knownSupplierId = p.supplierId;
    }

    supplierMap.set(normKey, entry);
  }

  // 1. Reconcile suppliers in fallbackStore
  for (const [normKey, data] of supplierMap.entries()) {
    let sup = fallbackStore.suppliers.find(
      (s) =>
        (s.businessId === businessId || !s.businessId) &&
        (s.id === data.knownSupplierId || s.name.toLowerCase() === normKey)
    );

    if (!sup) {
      sup = {
        id: `sup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        businessId,
        code: `ACP${String(fallbackStore.suppliers.length + 1).padStart(5, "0")}`,
        name: data.displayName,
        businessName: data.displayName,
        phone: null,
        email: null,
        address: "Karachi, Pakistan",
        openingBalance: 0,
        currentBalance: data.totalRemaining,
        isActive: true,
        purchases: [],
        payments: [],
        createdAt: new Date().toISOString(),
      };
      fallbackStore.suppliers.push(sup);
    } else {
      sup.businessId = businessId;
      if (sup.currentBalance < data.totalRemaining || sup.currentBalance === 0) {
        sup.currentBalance = data.totalRemaining;
      }
    }

    // Link purchases to this supplier
    purchases.forEach((p) => {
      if (data.purchaseIds.includes(p.id)) {
        p.supplierId = sup!.id;
      }
    });
  }

  // 2. Reconcile Account 2010 in fallbackStore
  let acc2010 = fallbackStore.accounts.find(
    (a) => a.businessId === businessId && a.code === "2010"
  );
  if (!acc2010) {
    acc2010 = {
      id: `acc-2010-${businessId}`,
      businessId,
      code: "2010",
      name: "Accounts Payable",
      type: "LIABILITY",
      subType: "Payable",
      balance: grandRemaining,
    };
    fallbackStore.accounts.push(acc2010);
  } else {
    if (acc2010.balance < grandRemaining || acc2010.balance === 0) {
      acc2010.balance = grandRemaining;
    }
  }

  // 3. Ensure balanced journal entries in fallbackStore
  let acc1200 = fallbackStore.accounts.find(
    (a) => a.businessId === businessId && a.code === "1200"
  );
  if (!acc1200) {
    acc1200 = {
      id: `acc-1200-${businessId}`,
      businessId,
      code: "1200",
      name: "Merchandise Inventory",
      type: "ASSET",
      subType: "Inventory",
      balance: 0,
    };
    fallbackStore.accounts.push(acc1200);
  }

  let acc1010 = fallbackStore.accounts.find(
    (a) => a.businessId === businessId && a.code === "1010"
  );
  if (!acc1010) {
    acc1010 = {
      id: `acc-1010-${businessId}`,
      businessId,
      code: "1010",
      name: "Cash in Hand",
      type: "ASSET",
      subType: "Cash",
      balance: 0,
    };
    fallbackStore.accounts.push(acc1010);
  }

  for (const p of purchases) {
    const rem = Number(p.remainingAmount || 0);
    if (rem > 0) {
      const exists = fallbackStore.journalEntries.some(
        (j: any) => j.referenceType === "PURCHASE" && j.referenceId === p.id
      );
      if (!exists && acc2010 && acc1200) {
        const tot = Number(p.totalAmount || 0);
        const paid = Number(p.paidAmount || 0);
        const jId = `je-pur-${p.id}`;

        const lines: any[] = [
          {
            id: `jl-${jId}-1`,
            journalEntryId: jId,
            accountId: acc1200.id,
            debit: tot,
            credit: 0,
            description: `Purchased merchandise on #${p.purchaseNumber}`,
          },
        ];

        if (paid > 0 && acc1010) {
          lines.push({
            id: `jl-${jId}-2`,
            journalEntryId: jId,
            accountId: acc1010.id,
            debit: 0,
            credit: paid,
            description: `Payment for purchase #${p.purchaseNumber}`,
          });
        }

        lines.push({
          id: `jl-${jId}-3`,
          journalEntryId: jId,
          accountId: acc2010.id,
          debit: 0,
          credit: rem,
          description: `Payable to ${p.supplierName} for #${p.purchaseNumber}`,
        });

        fallbackStore.journalEntries.unshift({
          id: jId,
          businessId,
          entryNumber: `JE-${p.purchaseNumber}`,
          date: p.date || new Date().toISOString(),
          description: `Purchase Bill #${p.purchaseNumber} from ${p.supplierName}`,
          referenceType: "PURCHASE",
          referenceId: p.id,
          isBalanced: true,
          status: "POSTED",
          lines,
        });
      }
    }
  }

  return { totalPayables: grandRemaining, supplierCount: supplierMap.size };
}
