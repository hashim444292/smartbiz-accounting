import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, getSession } from "@/lib/auth";
import { fallbackStore, storeAddUser } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. User directory is only accessible to Super Admin." },
        { status: 403 }
      );
    }
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          memberships: {
            include: { business: true },
          },
        },
      });

      const formatted = users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        platformRole: (u as any).platformRole || (u.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "TENANT_USER"),
        allowedModules: u.allowedModules || [],
        createdAt: u.createdAt,
        companies: u.memberships.map((m) => ({
          id: m.business.id,
          name: m.business.name,
          role: m.role,
        })),
      }));

      return NextResponse.json({ success: true, data: formatted });
    } catch {
      // Fallback
      const formatted = fallbackStore.users.map((u) => {
        const assignedCompanies = fallbackStore.companies.filter((c) =>
          u.companyIds.includes(c.id)
        );
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          platformRole: (u as any).platformRole || (u.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "TENANT_USER"),
          allowedModules: u.allowedModules || [],
          createdAt: u.createdAt,
          companies: assignedCompanies.map((c) => ({
            id: c.id,
            name: c.name,
            role: u.role,
          })),
        };
      });

      return NextResponse.json({ success: true, data: formatted, fallback: true });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Super Admin can create user accounts." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, email, password, role, companyIds, allowedModules, isPlatformUser, platformRole } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: "Name and Email are required" },
        { status: 400 }
      );
    }

    // Strict constraint: Only Hashim Khan is Super Admin. Nobody else can ever be created as Super Admin.
    if (role === "SUPER_ADMIN" || platformRole === "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "سپر ایڈمن کا درجہ صرف ہاشم خان کے لیے مخصوص ہے۔ کوئی دوسرا صارف سپر ایڈمن نہیں بن سکتا۔ (Super Admin is exclusively reserved for the platform owner)." },
        { status: 400 }
      );
    }

    let finalRole = role || "STAFF";
    let finalPlatformRole = "TENANT_USER";

    if (isPlatformUser) {
      const validPlatformRoles = ["WEBAPP_ADMIN", "WEBAPP_EDITOR", "WEBAPP_VIEWER"];
      if (!validPlatformRoles.includes(platformRole)) {
        return NextResponse.json(
          { success: false, error: "Invalid platform role. Must be WebApp Admin, WebApp Editor, or WebApp Viewer." },
          { status: 400 }
        );
      }
      finalRole = "ADMIN";
      finalPlatformRole = platformRole;
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check DB
    try {
      const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing) {
        return NextResponse.json(
          { success: false, error: "A user with this email already exists" },
          { status: 400 }
        );
      }

      const passwordHash = await hashPassword(password || "password123");
      const newUser = await prisma.user.create({
        data: {
          name,
          email: cleanEmail,
          passwordHash,
          role: finalRole as any,
          platformRole: finalPlatformRole,
          allowedModules: Array.isArray(allowedModules) ? allowedModules : [],
        },
      });

      // Assign companies if provided
      if (Array.isArray(companyIds) && companyIds.length > 0) {
        for (const bizId of companyIds) {
          await prisma.businessMember.create({
            data: {
              userId: newUser.id,
              businessId: bizId,
              role: finalRole as any,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: newUser,
        message: "User created successfully",
      });
    } catch {
      // Fallback
      const existing = fallbackStore.users.find(
        (u) => u.email.toLowerCase() === cleanEmail
      );
      if (existing) {
        return NextResponse.json(
          { success: false, error: "A user with this email already exists" },
          { status: 400 }
        );
      }

      const newUser = storeAddUser({
        name,
        email: cleanEmail,
        password: password || "password123",
        role: finalRole,
        platformRole: finalPlatformRole,
        allowedModules: Array.isArray(allowedModules) ? allowedModules : [],
        companyIds: Array.isArray(companyIds) && companyIds.length > 0 ? companyIds : [fallbackStore.activeBusinessId],
      });

      return NextResponse.json({
        success: true,
        data: newUser,
        message: "User created successfully in fallback store",
        fallback: true,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
