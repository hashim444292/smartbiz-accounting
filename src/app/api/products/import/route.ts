import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import {
  detectColumns,
  validateImportRows,
  importValidatedRows,
  generateErrorReportCsv,
} from "@/services/productImportService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();
    const { action = "validate" } = body;

    if (action === "detect") {
      const headers = body.headers || [];
      const mapping = detectColumns(headers);
      return NextResponse.json({ success: true, mapping });
    }

    if (action === "validate") {
      const rawRows = body.rows || [];
      const columnMapping = body.columnMapping || {};
      const duplicateStrategy = body.duplicateStrategy || "UPDATE";

      const validationResult = await validateImportRows({
        rawRows,
        columnMapping,
        organizationId: businessId,
        duplicateStrategy,
      });

      return NextResponse.json({ success: true, data: validationResult });
    }

    if (action === "commit") {
      const validRows = body.validRows || [];
      const duplicateStrategy = body.duplicateStrategy || "UPDATE";

      const importResult = await importValidatedRows({
        validRows,
        organizationId: businessId,
        duplicateStrategy,
        userId: body.userId || "usr-1",
        userName: body.userName || "System Admin",
      });

      return NextResponse.json({ success: true, data: importResult });
    }

    if (action === "error_report") {
      const errors = body.errors || [];
      const csv = generateErrorReportCsv(errors);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="import_errors.csv"',
        },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
