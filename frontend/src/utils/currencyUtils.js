/**
 * FinVault India - Indian Currency Word Conversion Utilities
 */

export function formatIndianCurrencyWords(value) {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  if (isNaN(num) || num <= 0) return '';

  if (num >= 10000000) {
    const cr = num / 10000000;
    const formatted = cr % 1 === 0 ? cr : parseFloat(cr.toFixed(2));
    return `₹${formatted} Crore`;
  }
  if (num >= 100000) {
    const lk = num / 100000;
    const formatted = lk % 1 === 0 ? lk : parseFloat(lk.toFixed(2));
    return `₹${formatted} Lakh`;
  }
  if (num >= 1000) {
    const th = num / 1000;
    const formatted = th % 1 === 0 ? th : parseFloat(th.toFixed(2));
    return `₹${formatted} Thousand`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
}

export function formatRupees(amount) {
  if (amount === '' || amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}
