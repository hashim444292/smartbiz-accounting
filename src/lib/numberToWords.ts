/**
 * Converts PKR numerical currency amounts into English words for Pakistani vouchers and cheques.
 * Example: 50000 -> "Rupees Fifty Thousand Only"
 * Example: 1250000 -> "Rupees Twelve Lac Fifty Thousand Only"
 */
export function numberToWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return "Rupees Zero Only";
  const num = Math.floor(Math.abs(amount));

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertLessThanOneThousand(n: number): string {
    let s = "";
    if (n >= 100) {
      s += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      s += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      s += ones[n] + " ";
    }
    return s.trim();
  }

  let remaining = num;
  let words = "";

  // 1 Crore = 10,000,000
  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;

  // 1 Lac = 100,000
  const lac = Math.floor(remaining / 100000);
  remaining %= 100000;

  // 1 Thousand = 1,000
  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;

  if (crore > 0) {
    words += convertLessThanOneThousand(crore) + " Crore ";
  }
  if (lac > 0) {
    words += convertLessThanOneThousand(lac) + " Lac ";
  }
  if (thousand > 0) {
    words += convertLessThanOneThousand(thousand) + " Thousand ";
  }
  if (remaining > 0) {
    words += convertLessThanOneThousand(remaining) + " ";
  }

  return `Rupees ${words.trim()} Only`;
}
