import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";
import { enrichCustomer } from "@/lib/customerHelper";

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

    const parsedCustomers = customers.map(enrichCustomer);
    return NextResponse.json({ success: true, data: parsedCustomers });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const filtered = fallbackStore.customers
      .filter((c) => !businessId || c.businessId === businessId)
      .map(enrichCustomer);
    return NextResponse.json({ success: true, data: filtered, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const name = body.name ? String(body.name).trim() : "";
  if (!name) {
    return NextResponse.json({ success: false, error: "Customer name is required" }, { status: 400 });
  }

  const cleanNtn = body.ntn ? String(body.ntn).trim().replace(/[^0-9]/g, "") : "";
  const cleanCnic = body.cnic ? String(body.cnic).trim().replace(/[^0-9]/g, "") : "";
  const requestedStatus = body.taxStatus || (cleanNtn.length >= 7 ? "REGISTERED" : "UNREGISTERED");

  // Statutory requirement: If Registered -> 7-8 digit NTN required.
  // If Unregistered (no NTN) -> 13-digit CNIC is MANDATORY.
  if (requestedStatus === "REGISTERED" || cleanNtn.length >= 7) {
    if (cleanNtn.length < 7) {
      return NextResponse.json(
        { success: false, error: "Registered taxpayers require a valid 7 or 8-digit NTN (e.g. 1234567-8)." },
        { status: 400 }
      );
    }
  } else {
    if (!cleanCnic) {
      return NextResponse.json(
        { success: false, error: "Customer does not have an NTN, so providing a 13-digit CNIC / NIC is mandatory." },
        { status: 400 }
      );
    }
    if (cleanCnic.length !== 13) {
      return NextResponse.json(
        { success: false, error: "CNIC / NIC must be exactly 13 digits (e.g. 42101-1234567-1)." },
        { status: 400 }
      );
    }
  }

  const formattedCnic = cleanCnic.length === 13 ? `${cleanCnic.slice(0, 5)}-${cleanCnic.slice(5, 12)}-${cleanCnic.slice(12)}` : null;

  const taxProfile = {
    ntn: cleanNtn.length >= 7 ? (body.ntn ? String(body.ntn).trim() : cleanNtn) : null,
    cnic: formattedCnic || (cleanCnic ? cleanCnic : null),
    province: body.province ? String(body.province).trim() : "Sindh",
    taxStatus: (cleanNtn.length >= 7 || requestedStatus === "REGISTERED") ? "REGISTERED" : "UNREGISTERED",
    userNotes: body.notes || null,
  };
  const notesJson = JSON.stringify(taxProfile);

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
        notes: notesJson,
      },
    });

    const enriched = {
      ...customer,
      ntn: taxProfile.ntn || "",
      cnic: taxProfile.cnic || "",
      province: taxProfile.province,
      taxStatus: taxProfile.taxStatus,
    };

    return NextResponse.json({ success: true, data: enriched });
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
      ntn: taxProfile.ntn || "",
      cnic: taxProfile.cnic || "",
      province: taxProfile.province,
      taxStatus: taxProfile.taxStatus,
      notes: notesJson,
      sales: [],
      payments: [],
    };
    fallbackStore.customers.push(newCust as any);
    return NextResponse.json({ success: true, data: newCust, fallback: true });
  }
}
