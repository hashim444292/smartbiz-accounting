import { PrismaClient, Prisma } from "@prisma/client";
import { fallbackStore } from "@/lib/fallbackStore";
import { Decimal, round2, toDecimal } from "@/lib/decimal";

/**
 * Universal safe calculation of Total Payables
 * Takes the maximum of supplier balances and outstanding purchase bills
 * to ensure no orphaned payables evaluate to 0.
 */
export function extractPurchaseReturns(purchases: any[]): Array<{
  id: string;
  purchaseId: string;
  amount: number;
}> {
  const returns: Array<{
    id: string;
    purchaseId: string;
    amount: number;
  }> = [];

  purchases.forEach((p) => {
    let parsedHistory: any[] = [];
    if (Array.isArray(p.returnHistory)) {
      parsedHistory = p.returnHistory;
    } else if (typeof p.notes === "string" && p.notes.includes("returnHistory")) {
      try {
        const parsed = JSON.parse(p.notes);
        if (Array.isArray(parsed.returnHistory)) {
          parsedHistory = parsed.returnHistory;
        }
      } catch {}
    }

    if (parsedHistory.length > 0) {
      parsedHistory.forEach((ret: any, idx: number) => {
        let retAmt = 0;
        if (ret.payableReduction !== undefined) {
          retAmt = Number(ret.payableReduction || 0);
        } else if (ret.cashRefund !== undefined) {
          retAmt = Math.max(0, Number(ret.totalRefundAmount || ret.totalAmount || ret.amount || 0) - Number(ret.cashRefund || 0));
        } else {
          retAmt = Number(ret.totalRefundAmount || ret.totalAmount || ret.amount || 0);
        }

        if (retAmt > 0) {
          returns.push({
            id: `dn-${p.id}-${idx}`,
            purchaseId: p.id,
            amount: retAmt,
          });
        }
      });
    } else if (Number(p.totalReturnedAmount || 0) > 0) {
      returns.push({
        id: `dn-tot-${p.id}`,
        purchaseId: p.id,
        amount: Number(p.totalReturnedAmount),
      });
    }
  });

  return returns;
}

/**
 * Universal safe calculation of Total Payables
 * Prefers reconciled supplier balances and falls back to purchase remaining
 * to ensure accuracy after disbursements.
 */
export function calculateTotalPayables(suppliers: any[] = [], purchases: any[] = []): number {
  const supplierTotal = (suppliers || []).reduce(
    (sum, s) => sum + Math.max(0, Number(s?.currentBalance || 0)),
    0
  );
  const purchaseTotal = (purchases || []).reduce(
    (sum, p) => {
      if (p?.status === "CANCELLED") return sum;
      return sum + Number(p?.remainingAmount || 0);
    },
    0
  );
  if (supplierTotal > 0) return supplierTotal;
  return purchaseTotal;
}

/**
 * Reconciles and synchronizes supplier balances, purchase links, Account 2010,
 * and double-entry purchase journal entries for a business in PostgreSQL using complete double-entry subsidiary ledger math.
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
        updatedAt: true,
        notes: true,
      },
    });

    // 2. Fetch all supplier disbursement payments
    const payments = await prismaClient.payment.findMany({
      where: {
        businessId,
        type: "DISBURSEMENT",
      },
      select: {
        id: true,
        amount: true,
        supplierId: true,
        partyName: true,
        partyType: true,
        referenceNumber: true,
        paymentMethod: true,
        allocations: {
          select: {
            purchaseId: true,
            amount: true,
          },
        },
      },
    });

    // 3. Fetch all registered suppliers
    const existingSuppliersList = await prismaClient.supplier.findMany({
      where: { businessId },
    });

    const supplierMap = new Map<
      string,
      {
        displayName: string;
        knownSupplierId: string | null;
        supplierRecord: any | null;
      }
    >();

    for (const s of existingSuppliersList) {
      const normKey = (s.name || "").toLowerCase().trim();
      supplierMap.set(normKey, {
        displayName: s.name,
        knownSupplierId: s.id,
        supplierRecord: s,
      });
    }

    for (const p of purchases) {
      const rawName = (p.supplierName || "General Supplier").trim();
      const normKey = rawName.toLowerCase();
      if (!supplierMap.has(normKey)) {
        supplierMap.set(normKey, {
          displayName: rawName,
          knownSupplierId: p.supplierId || null,
          supplierRecord: null,
        });
      } else if (p.supplierId && !supplierMap.get(normKey)!.knownSupplierId) {
        supplierMap.get(normKey)!.knownSupplierId = p.supplierId;
      }
    }

    let grandRemaining = new Decimal(0);
    let supplierCount = 0;

    for (const [normKey, data] of supplierMap.entries()) {
      supplierCount++;
      let targetSup: any =
        data.supplierRecord ||
        existingSuppliersList.find(
          (s) => (data.knownSupplierId && s.id === data.knownSupplierId) || s.name.toLowerCase().trim() === normKey
        );

      const suppPurchases = purchases.filter((p) => {
        const matchesId = targetSup && p.supplierId && p.supplierId === targetSup.id;
        const matchesName = (p.supplierName || "").toLowerCase().trim() === normKey;
        return matchesId || matchesName;
      });

      const suppPurchaseNumbers = new Set(suppPurchases.map((p) => (p.purchaseNumber || "").trim()).filter(Boolean));
      const suppPurchaseIds = new Set(suppPurchases.map((p) => p.id));

      const seenPaymentIds = new Set<string>();
      let suppDbPayments = new Decimal(0);

      payments.forEach((pm) => {
        if (seenPaymentIds.has(pm.id)) return;
        const matchesId = targetSup && pm.supplierId && pm.supplierId === targetSup.id;
        const matchesName = pm.partyType === "SUPPLIER" && (pm.partyName || "").toLowerCase().trim() === normKey;
        const matchesRef = pm.referenceNumber && suppPurchaseNumbers.has(pm.referenceNumber.trim());
        const matchesAlloc = Array.isArray(pm.allocations) && pm.allocations.some((a: any) => a.purchaseId && suppPurchaseIds.has(a.purchaseId));

        if (matchesId || matchesName || matchesRef || matchesAlloc) {
          seenPaymentIds.add(pm.id);
          suppDbPayments = suppDbPayments.add(toDecimal(pm.amount || 0));
        }
      });

      const totalPurPaid = suppPurchases.reduce((sum, p) => sum.add(toDecimal(p.paidAmount || 0)), new Decimal(0));
      const unrepresentedShortfall = Decimal.max(0, totalPurPaid.sub(suppDbPayments));

      const returns = extractPurchaseReturns(suppPurchases);
      const totalReturns = returns.reduce((sum, r) => sum.add(toDecimal(r.amount || 0)), new Decimal(0));

      const totalPurchasesAmount = suppPurchases.reduce((sum, p) => sum.add(toDecimal(p.totalAmount || 0)), new Decimal(0));
      const opBal = targetSup ? toDecimal(targetSup.openingBalance || 0) : new Decimal(0);
      const curBal = targetSup ? toDecimal(targetSup.currentBalance || 0) : new Decimal(0);

      const openPayables = suppPurchases.reduce(
        (sum, p) => sum.add(toDecimal(p.remainingAmount || 0)),
        new Decimal(0)
      );

      let calcPayable = opBal.add(totalPurchasesAmount).sub(suppDbPayments).sub(unrepresentedShortfall).sub(totalReturns);
      if (openPayables.gt(0) && calcPayable.lte(0)) {
        calcPayable = opBal.add(openPayables);
      } else if (suppPurchases.length === 0 && suppDbPayments.isZero() && curBal.gt(0) && opBal.isZero()) {
        calcPayable = curBal;
      }

      const truePayable = round2(calcPayable).toNumber();

      if (truePayable > 0) {
        grandRemaining = grandRemaining.add(toDecimal(truePayable));
      }

      let activeSupId = targetSup?.id;

      if (!targetSup) {
        try {
          const newSup = await prismaClient.supplier.create({
            data: {
              businessId,
              name: data.displayName,
              businessName: data.displayName,
              openingBalance: 0,
              currentBalance: truePayable,
              isActive: true,
            },
          });
          activeSupId = newSup.id;
        } catch {
          targetSup = await prismaClient.supplier.findFirst({
            where: { businessId, name: { equals: data.displayName, mode: "insensitive" } },
          });
          activeSupId = targetSup?.id;
        }
      } else {
        const existingNum = Number(targetSup.currentBalance || 0);
        if (Math.abs(existingNum - truePayable) > 0.01) {
          try {
            await prismaClient.supplier.update({
              where: { id: targetSup.id },
              data: { currentBalance: truePayable },
            });
          } catch (e) {
            console.error(`Failed to update supplier balance for ${targetSup.id}:`, e);
          }
        }
      }

      // Link unlinked purchases to this supplier
      if (activeSupId) {
        const unlinkedPurchases = suppPurchases.filter((p) => !p.supplierId || p.supplierId !== activeSupId);
        for (const unlinked of unlinkedPurchases) {
          try {
            await prismaClient.purchase.update({
              where: { id: unlinked.id },
              data: { supplierId: activeSupId },
            });
          } catch (e) {
            console.error(`Failed to link purchase ${unlinked.id} to supplier ${activeSupId}:`, e);
          }
        }
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
      if (Math.abs(Number(account2010.balance || 0) - payablesTotalNum) > 0.01) {
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
  const payments = (fallbackStore.payments || []).filter(
    (p) => p.businessId === businessId && p.type === "DISBURSEMENT"
  );
  const existingSuppliers = fallbackStore.suppliers.filter(
    (s) => s.businessId === businessId || !s.businessId
  );

  const supplierMap = new Map<
    string,
    {
      displayName: string;
      knownSupplierId: string | null;
      supplierRecord: any | null;
    }
  >();

  for (const s of existingSuppliers) {
    const normKey = (s.name || "").toLowerCase().trim();
    supplierMap.set(normKey, {
      displayName: s.name,
      knownSupplierId: s.id,
      supplierRecord: s,
    });
  }

  for (const p of purchases) {
    const rawName = (p.supplierName || "General Supplier").trim();
    const normKey = rawName.toLowerCase();
    if (!supplierMap.has(normKey)) {
      supplierMap.set(normKey, {
        displayName: rawName,
        knownSupplierId: p.supplierId || null,
        supplierRecord: null,
      });
    } else if (p.supplierId && !supplierMap.get(normKey)!.knownSupplierId) {
      supplierMap.get(normKey)!.knownSupplierId = p.supplierId;
    }
  }

  let grandRemaining = 0;
  let supplierCount = 0;

  for (const [normKey, data] of supplierMap.entries()) {
    supplierCount++;
    let sup =
      data.supplierRecord ||
      existingSuppliers.find(
        (s) =>
          (s.businessId === businessId || !s.businessId) &&
          (s.id === data.knownSupplierId || s.name.toLowerCase() === normKey)
      );

    const suppPurchases = purchases.filter((p) => {
      const matchesId = sup && p.supplierId && p.supplierId === sup.id;
      const matchesName = (p.supplierName || "").toLowerCase().trim() === normKey;
      return matchesId || matchesName;
    });

    const suppPurchaseNumbers = new Set(suppPurchases.map((p) => (p.purchaseNumber || "").trim()).filter(Boolean));
    const suppPurchaseIds = new Set(suppPurchases.map((p) => p.id));

    const seenPaymentIds = new Set<string>();
    let suppDbPayments = 0;

    payments.forEach((pm) => {
      if (seenPaymentIds.has(pm.id)) return;
      const matchesId = sup && pm.supplierId && pm.supplierId === sup.id;
      const matchesName = pm.partyType === "SUPPLIER" && (pm.partyName || "").toLowerCase().trim() === normKey;
      const matchesRef = pm.referenceNumber && suppPurchaseNumbers.has(pm.referenceNumber.trim());
      const matchesAlloc = Array.isArray(pm.allocations) && pm.allocations.some((a: any) => a.purchaseId && suppPurchaseIds.has(a.purchaseId));

      if (matchesId || matchesName || matchesRef || matchesAlloc) {
        seenPaymentIds.add(pm.id);
        suppDbPayments += Number(pm.amount || 0);
      }
    });

    const totalPurPaid = suppPurchases.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
    const unrepresentedShortfall = Math.max(0, totalPurPaid - suppDbPayments);

    const returns = extractPurchaseReturns(suppPurchases);
    const totalReturns = returns.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const totalPurchasesAmount = suppPurchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
    const opBal = Number(sup?.openingBalance || 0);
    const curBal = Number(sup?.currentBalance || 0);

    const openPayables = suppPurchases.reduce((sum, p) => {
      if (p.status === "CANCELLED") return sum;
      return sum + Number(p.remainingAmount || 0);
    }, 0);

    let truePayable = opBal + totalPurchasesAmount - suppDbPayments - unrepresentedShortfall - totalReturns;
    if (openPayables > 0 && truePayable <= 0) {
      truePayable = opBal + openPayables;
    } else if (suppPurchases.length === 0 && suppDbPayments === 0 && curBal > 0 && opBal === 0) {
      truePayable = curBal;
    }

    if (truePayable > 0) {
      grandRemaining += truePayable;
    }

    if (!sup) {
      sup = {
        id: data.knownSupplierId || `sup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        businessId,
        code: `ACP${String(fallbackStore.suppliers.length + 1).padStart(5, "0")}`,
        name: data.displayName,
        businessName: data.displayName,
        phone: null,
        email: null,
        address: "Karachi, Pakistan",
        openingBalance: 0,
        currentBalance: truePayable,
        isActive: true,
        purchases: [],
        payments: [],
        createdAt: new Date().toISOString(),
      };
      fallbackStore.suppliers.push(sup);
    } else {
      sup.businessId = businessId;
      sup.currentBalance = truePayable;
    }

    // Link purchases to this supplier
    suppPurchases.forEach((p) => {
      p.supplierId = sup!.id;
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
