"use client";

import React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Calendar,
  CalendarRange,
  Lock,
  TrendingUp,
  Scale,
  Wallet,
  ArrowRight,
  Package,
  Receipt,
  ShieldCheck,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function ReportsHubPage() {
  const { activeCompany } = useAuth();
  const isFbrInvoicingOnly = activeCompany?.packageType === "FBR_INVOICING_ONLY";

  const standardReports = [
    {
      title: "Items Summary (Stock In/Out)",
      description: "Client standard format: Opening, In, Out, and Balance stock ledger grouped by category.",
      icon: Package,
      href: "/reports/items-summary",
      badge: "Client Format",
    },
    {
      title: "Accounts Receivables Summary",
      description: "Client standard format: Customer account codes, debit balances, credit balances, and contacts.",
      icon: Wallet,
      href: "/reports/receivables-summary",
      badge: "Client Format",
    },
    {
      title: "Accounts Payables Summary",
      description: "Supplier outstanding balances, vendor codes, debit advances, payable credits, and phone numbers.",
      icon: Scale,
      href: "/reports/payables-summary",
      badge: "Client Format",
    },
    {
      title: "Daily Operational Report",
      description: "Complete daily business snapshot: sales, purchases, receipts, disbursements, expenses, and stock movements.",
      icon: Calendar,
      href: "/reports/daily",
      badge: "Essential Daily",
    },
    {
      title: "Monthly Business Closing Report",
      description: "Formal month-end reconciliation, receivables/payables audit, P&L, balance sheet, and period locking controls.",
      icon: Lock,
      href: "/reports/monthly-closing",
      badge: "Closing Engine",
    },
    {
      title: "Weekly Business Report",
      description: "Day-by-day weekly comparison of turnover, cash flow, top-selling items, and supplier payables.",
      icon: CalendarRange,
      href: "/reports/weekly",
    },
    {
      title: "Profit & Loss Statement",
      description: "Income, cost of goods sold, gross margin, operating expenses, and net net profit.",
      icon: TrendingUp,
      href: "/reports/profit-loss",
    },
    {
      title: "Balance Sheet Statement",
      description: "Assets, liabilities, and owner equity snapshot for evaluating overall business financial health.",
      icon: Scale,
      href: "/reports/balance-sheet",
    },
    {
      title: "Cash Flow Statement",
      description: "Operating, investing, and financing cash movements tracking cash and bank liquid balances.",
      icon: Wallet,
      href: "/reports/cash-flow",
    },
  ];

  const fbrInvoicingReports = [
    {
      title: "Sales Invoices Register & Downloads",
      description: "Complete chronological sales register with filterable dates, customer details, PDF invoice download, and print receipts.",
      icon: Receipt,
      href: "/sales",
      badge: "Primary Sales",
    },
    {
      title: "Daily Sales & Tax Breakdown",
      description: "Daily gross sales totals, 18% GST collected, 3% further tax, POS fee reconciliation, and verified invoice counts.",
      icon: Calendar,
      href: "/reports/daily",
      badge: "Daily Tax",
    },
    {
      title: "Weekly Sales Performance",
      description: "Day-by-day turnover summary, weekly comparisons, and invoice velocity analysis.",
      icon: CalendarRange,
      href: "/reports/weekly",
      badge: "Weekly Summary",
    },
    {
      title: "Monthly Sales Closing & Audit",
      description: "Monthly gross revenue, total tax breakdown, payment collections, and period reconciliation.",
      icon: Lock,
      href: "/reports/monthly-closing",
      badge: "Monthly Closing",
    },
    {
      title: "Sales Report (Custom Date Range)",
      description: "Select custom Start Date and End Date to filter, print, and download comprehensive sales summaries.",
      icon: CalendarRange,
      href: "/sales?date=CUSTOM",
      badge: "Custom Range",
    },
    {
      title: "FBR Digital Invoicing & Fiscal Audit",
      description: "Live FBR transmission status, official FBR invoice numbers, scannable QR verification, and retry queue.",
      icon: ShieldCheck,
      href: "/compliance/fbr",
      badge: "FBR Official",
    },
    {
      title: "Excel / CSV Bulk Export & Imports",
      description: "Download CSV invoice templates, historical batch import sheets, and bulk sales spreadsheet exports.",
      icon: FileSpreadsheet,
      href: "/sales/import",
      badge: "Spreadsheet",
    },
  ];

  const reports = isFbrInvoicingOnly ? fbrInvoicingReports : standardReports;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isFbrInvoicingOnly ? "Sales Invoicing & FBR Compliance Reports" : "Financial & Managerial Reports"}
        </h2>
        <p className="text-xs text-slate-500">
          {isFbrInvoicingOnly
            ? "Simple sales invoice logs, FBR tax breakdowns, and spreadsheet export downloads"
            : "Audited financial statements, daily sales/cash logs, and monthly closing reconciliations"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.title} href={r.href} className="group">
              <Card className="h-full transition hover:border-blue-300 hover:shadow-md dark:hover:border-blue-900">
                <CardHeader>
                  <div className="flex items-center justify-between mb-1">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    {r.badge && (
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {r.badge}
                      </span>
                    )}
                  </div>
                  <CardTitle className="group-hover:text-blue-600 transition-colors">{r.title}</CardTitle>
                  <CardDescription>{r.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <span>Generate Report</span>
                    <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
