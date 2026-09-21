import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getPayablesSummaryReport } from "@/services/reportService";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId();
    const report = await getPayablesSummaryReport(businessId);
    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    let totalDebit = 0;
    let totalCredit = 0;

    const items = fallbackStore.suppliers.map((s, index) => {
      const bal = Number(s.currentBalance || 0);
      const debitAmt = bal < 0 ? Math.abs(bal) : 0; // Advance paid
      const creditAmt = bal > 0 ? bal : 0; // Payable

      totalDebit += debitAmt;
      totalCredit += creditAmt;

      const acCode = s.code || `ACP${String(index + 1).padStart(5, "0")}`;

      return {
        id: s.id,
        acCode,
        acName: s.name,
        businessName: s.businessName,
        debitAmt,
        creditAmt,
        telephone: s.phone || "—",
        currentBalance: bal,
      };
    });

    const fallbackReport = {
      businessName: fallbackStore.business.name || "HANIF",
      reportTitle: "ACCOUNTS PAYABLES SUMMARY",
      reportDate: new Date().toISOString(),
      printingTime: new Date().toISOString(),
      items,
      totals: {
        count: fallbackStore.suppliers.length,
        totalDebit,
        totalCredit,
        netPayable: totalCredit - totalDebit,
      },
    };

    return NextResponse.json({ success: true, data: fallbackReport, fallback: true });
  }
}
