import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

function enrichCustomer(c: any) {
  let ntn = c.ntn || "";
  let cnic = c.cnic || "";
  let province = c.province || "Sindh";
  let taxStatus = c.taxStatus || "UNREGISTERED";

  if (c.notes) {
    try {
      if (typeof c.notes === "string" && c.notes.trim().startsWith("{")) {
        const meta = JSON.parse(c.notes);
        if (meta.ntn) ntn = meta.ntn;
        if (meta.cnic) cnic = meta.cnic;
        if (meta.province) province = meta.province;
        if (meta.taxStatus) taxStatus = meta.taxStatus;
      } else if (typeof c.notes === "string") {
        const ntnMatch = c.notes.match(/NTN:\s*([A-Za-z0-9-]+)/i);
        const cnicMatch = c.notes.match(/CNIC:\s*([0-9-]+)/i);
        const provMatch = c.notes.match(/Province:\s*([A-Za-z\s]+)/i);
        if (ntnMatch) ntn = ntnMatch[1].trim();
        if (cnicMatch) cnic = cnicMatch[1].trim();
        if (provMatch) province = provMatch[1].trim();
        if (ntn) taxStatus = "REGISTERED";
      }
    } catch {}
  }

  return {
    ...c,
    ntn,
    cnic,
    province,
    taxStatus: ntn ? "REGISTERED" : taxStatus,
  };
}

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

  const taxProfile = {
    ntn: body.ntn ? String(body.ntn).trim() : null,
    cnic: body.cnic ? String(body.cnic).trim().replace(/[^0-9]/g, "") : null,
    province: body.province ? String(body.province).trim() : "Sindh",
    taxStatus: body.taxStatus || (body.ntn ? "REGISTERED" : "UNREGISTERED"),
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
