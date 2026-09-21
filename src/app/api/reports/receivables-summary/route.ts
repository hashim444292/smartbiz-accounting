import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getReceivablesSummaryReport } from "@/services/reportService";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId();
    const report = await getReceivablesSummaryReport(businessId);
    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    let totalDebit = 0;
    let totalCredit = 0;

    const items = fallbackStore.customers.map((c, index) => {
      const bal = Number(c.currentBalance || 0);
      const debitAmt = bal > 0 ? bal : 0;
      const creditAmt = bal < 0 ? Math.abs(bal) : 0;

      totalDebit += debitAmt;
      totalCredit += creditAmt;

      const acCode = c.code || `ACR${String(index + 1).padStart(5, "0")}`;

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

    const fallbackReport = {
      businessName: fallbackStore.business.name || "HANIF",
      reportTitle: "ACCOUNTS RECEIVABLES SUMMARY",
      reportDate: new Date().toISOString(),
      printingTime: new Date().toISOString(),
      items,
      totals: {
        count: fallbackStore.customers.length,
        totalDebit,
        totalCredit,
        netReceivable: totalDebit - totalCredit,
      },
    };

    return NextResponse.json({ success: true, data: fallbackReport, fallback: true });
  }
}
