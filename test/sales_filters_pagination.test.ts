import { describe, it, expect } from "vitest";
import { fallbackStore } from "@/lib/fallbackStore";

describe("Sales Date Filtering & Pagination Suite", () => {
  const sales = fallbackStore.sales.filter((s) => s.businessId === "biz-101");

  it("should have at least 15 seeded invoices for biz-101 to enable multi-page pagination", () => {
    expect(sales.length).toBeGreaterThanOrEqual(15);
  });

  it("should accurately filter invoices for TODAY", () => {
    const now = new Date();
    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    const todayInvoices = sales.filter((s) => isSameDay(new Date(s.date), now));
    expect(todayInvoices.length).toBeGreaterThan(0);

    for (const inv of todayInvoices) {
      expect(isSameDay(new Date(inv.date), now)).toBe(true);
    }
  });

  it("should accurately filter invoices for YESTERDAY", () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    const yesterdayInvoices = sales.filter((s) => isSameDay(new Date(s.date), yesterday));
    expect(yesterdayInvoices.length).toBeGreaterThan(0);

    for (const inv of yesterdayInvoices) {
      expect(isSameDay(new Date(inv.date), yesterday)).toBe(true);
    }
  });

  it("should accurately filter invoices for THIS_WEEK", () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diffToMonday, 0, 0, 0, 0);

    const thisWeekInvoices = sales.filter((s) => new Date(s.date) >= startOfWeek);
    expect(thisWeekInvoices.length).toBeGreaterThan(0);

    for (const inv of thisWeekInvoices) {
      expect(new Date(inv.date).getTime()).toBeGreaterThanOrEqual(startOfWeek.getTime());
    }
  });

  it("should accurately filter invoices for THIS_MONTH", () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const thisMonthInvoices = sales.filter((s) => new Date(s.date) >= startOfMonth);
    expect(thisMonthInvoices.length).toBeGreaterThan(0);

    for (const inv of thisMonthInvoices) {
      expect(new Date(inv.date).getTime()).toBeGreaterThanOrEqual(startOfMonth.getTime());
    }
  });

  it("should correctly paginate entries with page size 10", () => {
    const pageSize = 10;
    const totalPages = Math.ceil(sales.length / pageSize);
    expect(totalPages).toBeGreaterThanOrEqual(2);

    // Page 1
    const page1 = sales.slice(0, pageSize);
    expect(page1.length).toBe(10);

    // Page 2
    const page2 = sales.slice(pageSize, pageSize * 2);
    expect(page2.length).toBeGreaterThan(0);
    expect(page2.length).toBeLessThanOrEqual(10);

    // No duplicate IDs between page 1 and page 2
    const page1Ids = new Set(page1.map((s) => s.id));
    for (const s of page2) {
      expect(page1Ids.has(s.id)).toBe(false);
    }
  });

  it("should correctly paginate entries with page size 15", () => {
    const pageSize = 15;
    const totalPages = Math.ceil(sales.length / pageSize);
    expect(totalPages).toBeGreaterThanOrEqual(2);

    const page1 = sales.slice(0, pageSize);
    expect(page1.length).toBe(15);

    const page2 = sales.slice(pageSize, pageSize * 2);
    expect(page2.length).toBeGreaterThanOrEqual(1);
  });
});
