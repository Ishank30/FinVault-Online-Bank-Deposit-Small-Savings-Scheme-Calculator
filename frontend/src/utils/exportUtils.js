/**
 * Export and Print Utilities for FinVault India
 * Scope 2: CSV download generator and clean browser PDF printing layout.
 */

export function exportToCSV(schedule, meta = {}) {
  if (!schedule || schedule.length === 0) {
    alert('No amortization schedule available to export.');
    return;
  }

  const {
    schemeName = 'Fixed_Deposit',
    principal = 0,
    maturityAmount = 0
  } = meta;

  // Clean scheme name for filename (e.g. "Public Provident Fund (PPF)" -> "PPF" or "Public_Provident_Fund")
  const cleanScheme = (schemeName || 'Deposit')
    .replace(/[\(\)]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  
  // Format: FinVault_Amortization_<Scheme>_<Timestamp>.csv
  const filename = `FinVault_Amortization_${cleanScheme}_${timestamp}.csv`;

  // Standard Header as specified in Scope of Work:
  // "Year, Opening Balance, Deposit Added, Interest Credited, TDS Deducted, Closing Balance"
  const csvLines = [
    `Year, Opening Balance, Deposit Added, Interest Credited, TDS Deducted, Closing Balance`
  ];

  // Schedule Rows
  schedule.forEach((row) => {
    csvLines.push(
      [
        row.year,
        Number(row.opening_balance || 0).toFixed(2),
        Number(row.deposit_added || 0).toFixed(2),
        Number(row.interest_credited || 0).toFixed(2),
        Number(row.tds_deducted || 0).toFixed(2),
        Number(row.closing_balance || 0).toFixed(2)
      ].join(', ')
    );
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvLines.join('\r\n'));
  const link = document.createElement('a');
  link.setAttribute('href', csvContent);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function triggerPrintReport() {
  window.print();
}
