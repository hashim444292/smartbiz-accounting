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
  storeAddPayment,
  storeTransferFunds,
  storeAdjustStock,
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

  it("7. Customer Payment Receipt: records who received cash, branch, and generates CUSTOMER_PAYMENT audit log", () => {
    const payment = storeAddPayment(
      {
        businessId: "biz-101",
        type: "IN",
        customerId: "cust-1",
        amount: 25000,
        paymentMethod: "CASH",
        branchId: "branch-101-1",
        notes: "Advance recovery for invoice #1002",
      },
      {
        userId: "usr-cashier-1",
        name: "Bilal Cashier",
        email: "bilal@hanifmobile.pk",
      }
    );

    expect(payment).toBeDefined();
    expect(payment.createdById).toBe("usr-cashier-1");
    expect(payment.createdByName).toBe("Bilal Cashier");
    expect(payment.branchId).toBe("branch-101-1");
    expect(payment.amount).toBe(25000);
    expect(payment.type).toBe("IN");

    // Verify audit log entry
    const auditLogs = storeGetAuditLogs("biz-101", { entity: "Payment", action: "CUSTOMER_PAYMENT" });
    const log = auditLogs.find((l) => l.entityId === payment.id);
    expect(log).toBeDefined();
    expect(log?.userName).toBe("Bilal Cashier");
    expect(log?.userId).toBe("usr-cashier-1");
    expect(log?.branchId).toBe("branch-101-1");
    expect(log?.details).toContain("Received Rs 25,000");
  });

  it("8. Supplier Payment Disbursement: records who paid supplier, branch, and generates SUPPLIER_PAYMENT audit log", () => {
    const payment = storeAddPayment(
      {
        businessId: "biz-101",
        type: "OUT",
        supplierId: "sup-1",
        amount: 50000,
        paymentMethod: "BANK",
        branchId: "branch-101-2",
        notes: "Cheque disbursement for raw mobile accessories",
      },
      {
        userId: "usr-finance-mgr",
        name: "Kamran Ali",
        email: "kamran@hanifmobile.pk",
      }
    );

    expect(payment).toBeDefined();
    expect(payment.createdById).toBe("usr-finance-mgr");
    expect(payment.createdByName).toBe("Kamran Ali");
    expect(payment.branchId).toBe("branch-101-2");
    expect(payment.type).toBe("OUT");

    // Verify audit log entry
    const auditLogs = storeGetAuditLogs("biz-101", { entity: "Payment", action: "SUPPLIER_PAYMENT" });
    const log = auditLogs.find((l) => l.entityId === payment.id);
    expect(log).toBeDefined();
    expect(log?.userName).toBe("Kamran Ali");
    expect(log?.branchId).toBe("branch-101-2");
    expect(log?.details).toContain("Disbursed Rs 50,000");
  });

  it("9. Fund Transfer: records who executed fund transfer between accounts and logs audit details", () => {
    const sourceAcc = fallbackStore.cashBankAccounts[0];
    const targetAcc = fallbackStore.cashBankAccounts[1];
    const initialSourceBalance = sourceAcc.balance;
    const initialTargetBalance = targetAcc.balance;
    const transferAmount = 15000;

    const transfer = storeTransferFunds(
      {
        businessId: "biz-101",
        fromAccountId: sourceAcc.id,
        toAccountId: targetAcc.id,
        amount: transferAmount,
        branchId: "branch-101-1",
        notes: "Daily cash deposit to HBL Main Branch account",
      },
      {
        userId: "usr-cashier-1",
        name: "Bilal Cashier",
        email: "bilal@hanifmobile.pk",
      }
    );

    expect(transfer).toBeDefined();
    expect(transfer.createdById).toBe("usr-cashier-1");
    expect(transfer.createdByName).toBe("Bilal Cashier");
    expect(transfer.branchId).toBe("branch-101-1");
    expect(transfer.type).toBe("TRANSFER");

    // Balances updated correctly
    expect(sourceAcc.balance).toBe(initialSourceBalance - transferAmount);
    expect(targetAcc.balance).toBe(initialTargetBalance + transferAmount);

    // Audit log
    const auditLogs = storeGetAuditLogs("biz-101", { entity: "Payment", action: "FUNDS_TRANSFER" });
    const log = auditLogs.find((l) => l.entityId === transfer.id);
    expect(log).toBeDefined();
    expect(log?.userName).toBe("Bilal Cashier");
    expect(log?.branchId).toBe("branch-101-1");
    expect(log?.details).toContain("Transferred Rs 15,000");
  });

  it("10. Stock Adjustment & Movement Accountability: records modifier, branch, and logs STOCK_ADJUSTMENT with diff", () => {
    const product = fallbackStore.products[0];
    const oldStock = product.currentStock;
    const targetStock = oldStock + 5;

    const result = storeAdjustStock(
      {
        businessId: "biz-101",
        productId: product.id,
        targetStock: targetStock,
        reason: "PHYSICAL_COUNT",
        notes: "Found extra unopened carton in warehouse back shelf",
        branchId: "branch-101-1",
      },
      {
        userId: "usr-owner-1",
        name: "Muhammad Hanif",
        email: "hanif@hanifmobile.pk",
      }
    );

    expect(result).toBeDefined();
    expect(result.product.currentStock).toBe(targetStock);
    expect(result.adjustmentQuantity).toBe(5);

    // Verify inventory transaction record
    expect(result.transaction.createdById).toBe("usr-owner-1");
    expect(result.transaction.createdByName).toBe("Muhammad Hanif");
    expect(result.transaction.branchId).toBe("branch-101-1");

    // Verify audit log with before/after diffs
    const auditLogs = storeGetAuditLogs("biz-101", { entity: "Product", action: "STOCK_ADJUSTMENT" });
    const log = auditLogs.find((l) => l.entityId === product.id);
    expect(log).toBeDefined();
    expect(log?.userName).toBe("Muhammad Hanif");
    expect(log?.branchId).toBe("branch-101-1");
    expect(log?.details).toContain(`from ${oldStock} to ${targetStock}`);

    const changes = JSON.parse(log?.changes || "{}");
    expect(changes.previous.stock).toBe(oldStock);
    expect(changes.updated.stock).toBe(targetStock);
    expect(changes.updated.reason).toBe("PHYSICAL_COUNT");
  });
});
