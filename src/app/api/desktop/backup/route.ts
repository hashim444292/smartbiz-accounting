import { NextRequest, NextResponse } from "next/server";
import {
  exportDatabaseBackup,
  validateAndRestoreDatabaseBackup,
} from "@/lib/desktopDatabase";
import { fallbackStore } from "@/lib/fallbackStore";
import { getMachineId } from "@/lib/hardwareId";

/**
 * GET /api/desktop/backup
 * Downloads a cryptographic 1-click .sbz full backup file of the offline database.
 */
export async function GET() {
  try {
    const machineId = getMachineId();
    const backup = exportDatabaseBackup(fallbackStore, {
      machineId,
      businessName: fallbackStore?.business?.name,
    });

    return new NextResponse(backup.payloadString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${backup.filename}"`,
        "X-Backup-Checksum": backup.checksum,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate backup" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/desktop/backup
 * Restores the offline database from an uploaded .sbz backup file payload.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPayload = typeof body === "string" ? body : JSON.stringify(body);

    const restoreResult = validateAndRestoreDatabaseBackup(rawPayload);

    if (!restoreResult.success || !restoreResult.state) {
      return NextResponse.json(
        { success: false, error: restoreResult.error || "Invalid backup payload" },
        { status: 400 }
      );
    }

    // Rehydrate in-memory store
    Object.assign(fallbackStore, restoreResult.state);

    return NextResponse.json({
      success: true,
      message: "Database restored successfully!",
      metadata: restoreResult.metadata,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to restore backup" },
      { status: 500 }
    );
  }
}
