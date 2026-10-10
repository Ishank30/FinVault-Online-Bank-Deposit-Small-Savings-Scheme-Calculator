/**
 * Bank Rate Matrix & Dynamic Yield Helper
 * Provides client-side real-time rate lookup for the 5 Scheduled Commercial Banks
 * based on selected tenure (days) and investor age.
 */

export const BANK_FD_SLABS = {
  SBI: [
    [7, 45, 3.50, 4.00, 4.30],
    [46, 179, 5.50, 6.00, 6.30],
    [180, 210, 6.25, 6.75, 7.05],
    [211, 364, 6.50, 7.00, 7.30],
    [365, 443, 6.80, 7.30, 7.60],
    [444, 444, 7.25, 7.75, 8.05], // 444-Day Amrit Vrishti
    [445, 729, 6.80, 7.30, 7.60],
    [730, 1094, 7.00, 7.50, 7.80],
    [1095, 1825, 6.75, 7.25, 7.55],
    [1826, 3653, 6.50, 7.50, 7.80], // SBI WeCare (+100 bps seniors)
  ],
  PNB: [
    [7, 14, 3.50, 4.00, 4.30],
    [15, 45, 3.50, 4.00, 4.30],
    [46, 90, 4.50, 5.00, 5.30],
    [91, 179, 5.50, 6.00, 6.30],
    [180, 270, 6.00, 6.50, 6.80],
    [271, 299, 6.25, 6.75, 7.05],
    [300, 300, 7.05, 7.55, 7.85],
    [301, 364, 6.25, 6.75, 7.05],
    [365, 399, 6.80, 7.30, 7.60],
    [400, 400, 7.25, 7.75, 8.05], // 400-Day high yield
    [401, 729, 6.80, 7.30, 7.60],
    [730, 1095, 7.00, 7.50, 7.80],
    [1096, 1825, 6.50, 7.00, 7.30],
    [1826, 3653, 6.50, 7.30, 7.60],
  ],
  BOB: [
    [7, 14, 4.25, 4.75, 5.05],
    [15, 45, 4.50, 5.00, 5.30],
    [46, 90, 5.50, 6.00, 6.30],
    [91, 180, 5.60, 6.10, 6.40],
    [181, 270, 5.75, 6.25, 6.55],
    [271, 364, 6.15, 6.65, 6.95],
    [365, 398, 6.85, 7.35, 7.65],
    [399, 399, 7.15, 7.65, 7.95], // 399-Day Baroda Tiranga Plus
    [400, 443, 6.85, 7.35, 7.65],
    [444, 444, 7.30, 7.80, 8.10], // 444-Day Bob Square
    [445, 729, 6.85, 7.35, 7.65],
    [730, 1095, 7.15, 7.65, 7.95],
    [1096, 1825, 6.50, 7.15, 7.45],
    [1826, 3653, 6.50, 7.50, 7.80],
  ],
  HDFC: [
    [7, 14, 3.00, 3.50, 3.80],
    [15, 29, 3.00, 3.50, 3.80],
    [30, 45, 3.50, 4.00, 4.30],
    [46, 60, 4.50, 5.00, 5.30],
    [61, 89, 4.50, 5.00, 5.30],
    [90, 179, 5.25, 5.75, 6.05],
    [180, 270, 5.75, 6.25, 6.55],
    [271, 364, 6.00, 6.50, 6.80],
    [365, 455, 6.60, 7.10, 7.40],
    [456, 547, 7.10, 7.60, 7.90],
    [548, 638, 7.25, 7.75, 8.05], // 18m to 21m
    [639, 884, 7.00, 7.50, 7.80],
    [885, 1065, 7.15, 7.65, 7.95],
    [1066, 1825, 7.00, 7.50, 7.80],
    [1826, 3653, 7.00, 7.75, 8.00],
  ],
  ICICI: [
    [7, 14, 3.00, 3.50, 3.80],
    [15, 29, 3.00, 3.50, 3.80],
    [30, 45, 3.50, 4.00, 4.30],
    [46, 60, 4.25, 4.75, 5.05],
    [61, 90, 4.50, 5.00, 5.30],
    [91, 184, 4.75, 5.25, 5.55],
    [185, 270, 5.75, 6.25, 6.55],
    [271, 364, 6.00, 6.50, 6.80],
    [365, 455, 6.70, 7.20, 7.50],
    [456, 729, 7.20, 7.75, 8.05], // 15m to 2y peak
    [730, 1825, 7.00, 7.50, 7.80],
    [1826, 3653, 6.90, 7.50, 7.75],
  ]
};

export function lookupBankRate(bankCode, totalDays, age = 35) {
  const code = (bankCode || 'SBI').toUpperCase();
  const slabs = BANK_FD_SLABS[code];
  if (!slabs) return 6.80;

  const days = Math.max(7, Number(totalDays) || 365);
  let matched = null;

  for (const slab of slabs) {
    const [minD, maxD] = slab;
    if (days >= minD && days <= maxD) {
      matched = slab;
      break;
    }
  }

  if (!matched) {
    matched = days >= 1826 ? slabs[slabs.length - 1] : slabs[0];
  }

  const [, , regRate, senRate, superSenRate] = matched;

  if (age >= 80) return superSenRate;
  if (age >= 60) return senRate;
  return regRate;
}

export function computeBestYieldBank(totalDays, age = 35) {
  const bankCodes = ['SBI', 'PNB', 'BOB', 'HDFC', 'ICICI'];
  let maxRate = -1;
  let bestBank = 'SBI';
  const rates = {};

  bankCodes.forEach((code) => {
    const rate = lookupBankRate(code, totalDays, age);
    rates[code] = rate;
    if (rate > maxRate) {
      maxRate = rate;
      bestBank = code;
    }
  });

  return { bestBank, maxRate, rates };
}
