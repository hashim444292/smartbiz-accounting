import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const suppliers = await prisma.supplier.findMany({
      where: { businessId, isActive: true },
      include: {
        purchases: { take: 5, orderBy: { date: "desc" } },
        payments: { take: 5, orderBy: { date: "desc" } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: suppliers });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const filtered = fallbackStore.suppliers.filter((s) => s.businessId === businessId);
    return NextResponse.json({ success: true, data: filtered, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const businessId = await getActiveBusinessId(req);
    const supplier = await prisma.supplier.create({
      data: {
        businessId,
        name: body.name,
        businessName: body.businessName || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        openingBalance: Number(body.openingBalance || 0),
        currentBalance: Number(body.openingBalance || 0),
      },
    });

    return NextResponse.json({ success: true, data: supplier });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const newSup = {
      id: `sup-${Date.now()}`,
      businessId,
      name: body.name,
      businessName: body.businessName || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      openingBalance: Number(body.openingBalance || 0),
      currentBalance: Number(body.openingBalance || 0),
      purchases: [],
      payments: [],
    };
    fallbackStore.suppliers.push(newSup);
    return NextResponse.json({ success: true, data: newSup, fallback: true });
  }
}
