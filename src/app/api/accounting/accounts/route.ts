import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore, storeEnsureStandardAccounts, storeCreateAccount } from "@/lib/fallbackStore";
import { ensureStandardAccounts, STANDARD_ACCOUNTS } from "@/services/accountingService";
import { createSafeAuditLog } from "@/lib/auditHelper";

export const dynamic = "force-dynamic";

const VALID_ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE"] as const;

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);

    if (!process.env.DATABASE_URL) {
      storeEnsureStandardAccounts(businessId);
      const accounts = fallbackStore.accounts.filter(
        (a) => a.businessId === businessId && a.isActive !== false
      );
      return NextResponse.json({
        success: true,
        data: accounts,
        fallback: true,
      });
    }

    try {
      await ensureStandardAccounts(prisma, businessId);
    } catch (e) {
      console.warn("Notice: ensureStandardAccounts error in accounts route:", e);
    }

    const accounts = await prisma.account.findMany({
      where: { businessId, isActive: true },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error: any) {
    console.error("GET /api/accounting/accounts error:", error);
    const businessId = await getActiveBusinessId(req);
    storeEnsureStandardAccounts(businessId);
    const accounts = fallbackStore.accounts.filter(
      (a) => a.businessId === businessId && a.isActive !== false
    );
    return NextResponse.json({
      success: true,
      data: accounts,
      fallback: true,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();

    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    const type = String(body.type || "").toUpperCase().trim();
    const subType = String(body.subType || "").trim() || "General";
    const balance = Number(body.balance || 0);
    const notes = body.notes ? String(body.notes).trim() : null;

    // 1. Validation
    if (!code) {
      return NextResponse.json(
        { success: false, error: "Account code is required (e.g. 1025, 6095)." },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Account name is required." },
        { status: 400 }
      );
    }
    if (!VALID_ACCOUNT_TYPES.includes(type as any)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid account type '${type}'. Must be one of: ${VALID_ACCOUNT_TYPES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // 2. Database or Fallback creation
    if (process.env.DATABASE_URL) {
      try {
        await ensureStandardAccounts(prisma, businessId);

        // Check if code already exists
        const existing = await prisma.account.findUnique({
          where: {
            businessId_code: {
              businessId,
              code,
            },
          },
        });

        if (existing) {
          return NextResponse.json(
            { success: false, error: `Account code '${code}' is already in use by '${existing.name}'.` },
            { status: 400 }
          );
        }

        const newAccount = await prisma.account.create({
          data: {
            businessId,
            code,
            name,
            type: type as any,
            subType,
            balance,
            isSystem: false,
            isActive: true,
          },
        });

        // If subType is Bank or Cash, link a CashBankAccount record
        if (subType.toLowerCase() === "bank" || type === "ASSET" && subType.toLowerCase().includes("bank")) {
          try {
            await prisma.cashBankAccount.create({
              data: {
                businessId,
                accountId: newAccount.id,
                name,
                type: "BANK",
                bankName: name,
                balance,
                isActive: true,
                isDefault: false,
              },
            });
          } catch (cbErr) {
            console.warn("Could not create cashBankAccount link:", cbErr);
          }
        } else if (subType.toLowerCase() === "cash" || type === "ASSET" && subType.toLowerCase().includes("cash")) {
          try {
            await prisma.cashBankAccount.create({
              data: {
                businessId,
                accountId: newAccount.id,
                name,
                type: "CASH",
                balance,
                isActive: true,
                isDefault: false,
              },
            });
          } catch (cbErr) {
            console.warn("Could not create cashBankAccount link:", cbErr);
          }
        }

        await createSafeAuditLog(prisma, {
          businessId,
          action: "CREATE_ACCOUNT",
          entity: "Account",
          entityId: newAccount.id,
          details: `Created new ledger account ${code} - ${name} (${type} / ${subType})`,
        });

        return NextResponse.json({
          success: true,
          data: newAccount,
        });
      } catch (dbErr: any) {
        console.error("Database account creation failed, falling back to in-memory:", dbErr);
        if (dbErr?.message?.includes("already in use")) {
          return NextResponse.json({ success: false, error: dbErr.message }, { status: 400 });
        }
      }
    }

    // Fallback store creation
    try {
      const created = storeCreateAccount({
        businessId,
        code,
        name,
        type,
        subType,
        balance,
        notes: notes || undefined,
      });

      return NextResponse.json({
        success: true,
        data: created,
        fallback: true,
      });
    } catch (storeErr: any) {
      return NextResponse.json(
        { success: false, error: storeErr?.message || "Failed to create account in fallback store." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("POST /api/accounting/accounts error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error creating account." },
      { status: 500 }
    );
  }
}
