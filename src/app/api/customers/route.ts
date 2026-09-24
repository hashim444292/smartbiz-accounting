import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const customers = await prisma.customer.findMany({
      where: { businessId, isActive: true },
      include: {
        sales: { take: 5, orderBy: { date: "desc" } },
        payments: { take: 5, orderBy: { date: "desc" } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: customers });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const filtered = fallbackStore.customers.filter((c) => c.businessId === businessId);
    return NextResponse.json({ success: true, data: filtered, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const businessId = await getActiveBusinessId(req);
    const customer = await prisma.customer.create({
      data: {
        businessId,
        name: body.name,
        businessName: body.businessName || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        openingBalance: Number(body.openingBalance || 0),
        currentBalance: Number(body.openingBalance || 0),
        creditLimit: body.creditLimit ? Number(body.creditLimit) : null,
      },
    });

    return NextResponse.json({ success: true, data: customer });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const newCust = {
      id: `cust-${Date.now()}`,
      businessId,
      name: body.name,
      businessName: body.businessName || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      openingBalance: Number(body.openingBalance || 0),
      currentBalance: Number(body.openingBalance || 0),
      creditLimit: body.creditLimit ? Number(body.creditLimit) : null,
      sales: [],
      payments: [],
    };
    fallbackStore.customers.push(newCust);
    return NextResponse.json({ success: true, data: newCust, fallback: true });
  }
}
