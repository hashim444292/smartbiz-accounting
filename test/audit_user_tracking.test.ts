import { describe, it, expect } from "vitest";
import {
  fallbackStore,
  storeAddSale,
  storeUpdateSale,
  storeAddPurchase,
  storeUpdatePurchase,
  storeAddExpense,
  storeUpdateExpense,
  storeDeleteExpense,
  storeGetAuditLogs,
} from "@/lib/fallbackStore";

describe("User Activity Tracking, Edit Detection & Audit Trail System", () => {
  it("1. Sale Invoice Creator Attribution: records creator id, creator name, and starts with isEdited=false", () => {
    const sale = storeAddSale(
      {
        businessId: "biz-101",
        customerName: "Tariq Traders",
        totalAmount: 45000,
        paidAmount: 20000,
        paymentStatus: "PARTIAL",
        paymentMethod: "CASH",
        branchId: "branch-101-1",
        items: [
          { productId: "prod-1", productName: "Redmi Note 13", quantity: 1, unitPrice: 45000, lineTotal: 45000 },
        ],
      },
      {
        userId: "usr-salesman",
        name: "Bilal Cashier",
        email: "bilal@hanifmobile.pk",
      }
    );

    expect(sale).toBeDefined();
    expect(sale.createdById).toBe("usr-salesman");
    expect(sale.createdByName).toBe("Bilal Cashier");
    expect(sale.isEdited).toBe(false);
    expect(sale.editCount).toBe(0);
    expect(sale.updatedByName).toBeFalsy();
  });

  it("2. Sale Invoice Modification: sets isEdited=true, tracks editor, editReason, and preserves original creator", () => {
    // Original creator is Bilal Cashier
    const originalSale = storeAddSale(
      {
        businessId: "biz-101",
        customerName: "Original Customer Name",
        totalAmount: 15000,
        paidAmount: 15000,
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        notes: "Original order note",
        items: [
          { productId: "prod-2", productName: "Samsung A15", quantity: 1, unitPrice: 15000, lineTotal: 15000 },
        ],
      },
      {
        userId: "usr-creator",
        name: "Usman Creator",
        email: "usman@hanifmobile.pk",
      }
    );

    const saleId = originalSale.id;
    expect(originalSale.createdByName).toBe("Usman Creator");

    // Later, an Admin or Manager edits the invoice
    const updatedSale = storeUpdateSale(
      saleId,
      {
        customerName: "Corrected Customer: Usman & Sons",
        paidAmount: 10000,
        paymentStatus: "PARTIAL",
        notes: "Updated walk-in discount applied",
      },
      {
        userId: "usr-owner",
        name: "Muhammad Hanif (Owner)",
        email: "hanif@hanifmobile.pk",
      },
      "Customer requested split payment and corrected invoice business title"
    );

    expect(updatedSale).toBeDefined();
    // Edit tracking flags
    expect(updatedSale?.isEdited).toBe(true);
    expect(updatedSale?.editCount).toBe(1);
    expect(updatedSale?.updatedById).toBe("usr-owner");
    expect(updatedSale?.updatedByName).toBe("Muhammad Hanif (Owner)");
    expect(updatedSale?.editReason).toBe("Customer requested split payment and corrected invoice business title");
    expect(updatedSale?.updatedAt).toBeDefined();

    // CRITICAL: Original creator MUST remain immutable!
    expect(updatedSale?.createdById).toBe("usr-creator");
    expect(updatedSale?.createdByName).toBe("Usman Creator");

    // Second edit increments editCount to 2
    const secondUpdate = storeUpdateSale(
      saleId,
      { notes: "Second modification" },
      { userId: "usr-auditor", name: "Shahid Auditor", email: "audit@hanifmobile.pk" },
      "Auditor verification note added"
    );
    expect(secondUpdate?.editCount).toBe(2);
    expect(secondUpdate?.updatedByName).toBe("Shahid Auditor");
    expect(secondUpdate?.createdByName).toBe("Usman Creator");
  });

  it("3. Purchase Order Creator Attribution & Edit Tracking: preserves creator and logs modification", () => {
    const purchase = storeAddPurchase(
      {
        businessId: "biz-101",
        supplierName: "Mega Mobile Importers",
        totalAmount: 180000,
        paidAmount: 100000,
        paymentStatus: "PARTIAL",
        paymentMethod: "BANK",
        branchId: "branch-101-1",
        items: [
          { productId: "prod-1", productName: "Redmi Note 13", quantity: 5, unitPrice: 36000, lineTotal: 180000 },
        ],
      },
      {
        userId: "usr-purchaser",
        name: "Kashif Procurement",
        email: "kashif@hanifmobile.pk",
      }
    );

    expect(purchase.createdById).toBe("usr-purchaser");
    expect(purchase.createdByName).toBe("Kashif Procurement");
    expect(purchase.isEdited).toBe(false);

    // Edit purchase order
    const updatedPurchase = storeUpdatePurchase(
      purchase.id,
      {
        supplierName: "Mega Mobile Importers Pvt Ltd",
        paidAmount: 180000,
        paymentStatus: "PAID",
      },
      {
        userId: "usr-admin",
        name: "Finance Manager",
        email: "finance@hanifmobile.pk",
      },
      "Cleared full supplier dues via Bank Transfer voucher"
    );

    expect(updatedPurchase?.isEdited).toBe(true);
    expect(updatedPurchase?.editCount).toBe(1);
    expect(updatedPurchase?.updatedByName).toBe("Finance Manager");
    expect(updatedPurchase?.editReason).toBe("Cleared full supplier dues via Bank Transfer voucher");
    expect(updatedPurchase?.createdByName).toBe("Kashif Procurement");
  });

  it("4. Daily Expense Creator Attribution & Edit Tracking: marks edited voucher and logs changes", () => {
    const expense = storeAddExpense(
      {
        businessId: "biz-101",
        categoryId: "exp-cat-1",
        amount: 8500,
        description: "Branch Electricity Bill",
        paymentMethod: "CASH",
        accountId: "acc-cash-1",
        paidTo: "K-Electric",
        branchId: "branch-101-1",
      },
      {
        userId: "usr-staff",
        name: "Ali Staff",
        email: "ali@hanifmobile.pk",
      }
    );

    expect(expense.createdById).toBe("usr-staff");
    expect(expense.createdByName).toBe("Ali Staff");
    expect(expense.isEdited).toBe(false);

    // Edit expense
    const updatedExpense = storeUpdateExpense(
      expense.id,
      {
        amount: 9200,
        description: "Branch Electricity Bill with fuel surcharge",
        paidTo: "K-Electric Karachi",
      },
      {
        userId: "usr-admin",
        name: "Admin Reviewer",
        email: "admin@hanifmobile.pk",
      },
      "Adjusted actual printed bill amount including sales tax & surcharge"
    );

    expect(updatedExpense?.isEdited).toBe(true);
    expect(updatedExpense?.editCount).toBe(1);
    expect(updatedExpense?.updatedByName).toBe("Admin Reviewer");
    expect(updatedExpense?.amount).toBe(9200);
    expect(updatedExpense?.createdByName).toBe("Ali Staff");
  });

  it("5. Expense Deletion Audit Trail: deleting an expense records full audit log with deletion reason", () => {
    const expense = storeAddExpense(
      {
        businessId: "biz-101",
        categoryId: "exp-cat-2",
        amount: 3200,
        description: "Duplicate tea voucher",
        paymentMethod: "CASH",
        accountId: "acc-cash-1",
        paidTo: "Tea Stall",
      },
      {
        userId: "usr-staff",
        name: "Ali Staff",
        email: "ali@hanifmobile.pk",
      }
    );

    const deleted = storeDeleteExpense(
      expense.id,
      {
        userId: "usr-admin",
        name: "Admin Reviewer",
        email: "admin@hanifmobile.pk",
      },
      "Duplicate entry recorded by error; cancelled voucher"
    );

    expect(deleted).toBe(true);
    const notFound = fallbackStore.expenses.find((e) => e.id === expense.id);
    expect(notFound).toBeUndefined();

    // Verify audit log has the deletion event
    const auditLogs = storeGetAuditLogs("biz-101", { entity: "Expense", action: "DELETE_EXPENSE" });
    const deleteEntry = auditLogs.find((l) => l.entityId === expense.id);
    expect(deleteEntry).toBeDefined();
    expect(deleteEntry?.userName).toBe("Admin Reviewer");
    expect(deleteEntry?.details).toContain("Duplicate entry recorded by error");
  });

  it("6. Comprehensive Audit Trail Querying: filters logs by entity and action with before/after diffs", () => {
    const saleLogs = storeGetAuditLogs("biz-101", { entity: "Sale" });
    expect(saleLogs.length).toBeGreaterThan(0);

    const updateLogs = saleLogs.filter((l) => l.action === "UPDATE_SALE");
    expect(updateLogs.length).toBeGreaterThan(0);

    const firstUpdate = updateLogs[0];
    expect(firstUpdate.changes).toBeDefined();

    const parsedChanges = JSON.parse(firstUpdate.changes || "{}");
    expect(parsedChanges.previous).toBeDefined();
    expect(parsedChanges.updated).toBeDefined();
  });
});
