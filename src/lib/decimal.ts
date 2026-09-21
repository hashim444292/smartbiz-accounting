import Decimal from "decimal.js";

// Configure Decimal.js for financial safety
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function toDecimal(val: Decimal.Value | null | undefined): Decimal {
  if (val === null || val === undefined || val === "") {
    return new Decimal(0);
  }
  try {
    return new Decimal(val);
  } catch {
    return new Decimal(0);
  }
}

export function formatMoney(
  amount: Decimal.Value | null | undefined,
  currency = "PKR",
  symbol = "Rs"
): string {
  const dec = toDecimal(amount);
  const formattedNumber = dec.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${symbol} ${formattedNumber}`;
}

export function formatQty(
  qty: Decimal.Value | null | undefined,
  unit = ""
): string {
  const dec = toDecimal(qty);
  const formatted = dec.toFixed(dec.decimalPlaces() > 2 ? 4 : 2).replace(/\.?0+$/, "");
  return unit ? `${formatted} ${unit}` : formatted;
}

export function round2(val: Decimal.Value): Decimal {
  return toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function round4(val: Decimal.Value): Decimal {
  return toDecimal(val).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/**
 * Calculates line item total:
 * base = quantity * unitPrice
 * afterDiscount = base - discount
 * tax = afterDiscount * (taxRate / 100)
 * total = afterDiscount + tax
 */
export function calculateLineTotal(
  quantity: Decimal.Value,
  unitPrice: Decimal.Value,
  discount: Decimal.Value = 0,
  taxRate: Decimal.Value = 0
): { lineTotal: Decimal; taxAmount: Decimal; subtotal: Decimal } {
  const q = toDecimal(quantity);
  const p = toDecimal(unitPrice);
  const d = toDecimal(discount);
  const tr = toDecimal(taxRate);

  const subtotal = round2(q.mul(p));
  const afterDiscount = Decimal.max(0, subtotal.sub(d));
  const taxAmount = round2(afterDiscount.mul(tr.div(100)));
  const lineTotal = round2(afterDiscount.add(taxAmount));

  return { lineTotal, taxAmount, subtotal };
}

/**
 * Calculates new Weighted Average Cost (WAC) when new stock arrives:
 * (currentStock * currentAvgCost + addedQty * unitCost) / (currentStock + addedQty)
 */
export function calculateWeightedAverageCost(
  currentStock: Decimal.Value,
  currentAvgCost: Decimal.Value,
  addedQty: Decimal.Value,
  unitCost: Decimal.Value
): Decimal {
  const s1 = toDecimal(currentStock);
  const c1 = toDecimal(currentAvgCost);
  const s2 = toDecimal(addedQty);
  const c2 = toDecimal(unitCost);

  const totalQty = s1.add(s2);
  if (totalQty.lte(0)) {
    return c2.gt(0) ? round2(c2) : round2(c1);
  }

  const currentValue = s1.mul(c1);
  const addedValue = s2.mul(c2);
  const totalValue = currentValue.add(addedValue);

  return round2(totalValue.div(totalQty));
}

/**
 * Verifies double-entry balancing: Debits must equal Credits
 */
export function isJournalBalanced(
  lines: Array<{ debit: Decimal.Value; credit: Decimal.Value }>
): { balanced: boolean; totalDebit: Decimal; totalCredit: Decimal; difference: Decimal } {
  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);

  for (const line of lines) {
    totalDebit = totalDebit.add(toDecimal(line.debit));
    totalCredit = totalCredit.add(toDecimal(line.credit));
  }

  totalDebit = round2(totalDebit);
  totalCredit = round2(totalCredit);
  const difference = round2(totalDebit.sub(totalCredit).abs());

  return {
    balanced: difference.isZero(),
    totalDebit,
    totalCredit,
    difference,
  };
}
