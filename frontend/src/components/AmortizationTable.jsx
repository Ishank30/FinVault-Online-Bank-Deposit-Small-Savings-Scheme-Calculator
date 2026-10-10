import React from 'react';
import {
  Table,
  FileSpreadsheet,
  Printer,
  Calendar,
  Coins,
  TrendingUp,
  Percent,
  Download
} from 'lucide-react';
import { exportToCSV, triggerPrintReport } from '../utils/exportUtils';

export default function AmortizationTable({ schedule, schemeName, principal, maturityAmount }) {
  if (!schedule || schedule.length === 0) return null;

  // Calculate Column Totals
  const totalDeposits = schedule.reduce((acc, row) => acc + row.deposit_added, 0);
  const totalInterest = schedule.reduce((acc, row) => acc + row.interest_credited, 0);
  const totalTds = schedule.reduce((acc, row) => acc + row.tds_deducted, 0);
  const finalBalance = schedule[schedule.length - 1].closing_balance;

  const handleExportCSV = () => {
    exportToCSV(schedule, {
      schemeName: schemeName || 'Indian Bank Deposit / Govt Scheme',
      principal,
      maturityAmount
    });
  };

  const handlePrint = () => {
    triggerPrintReport();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
      {/* Header with Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Table className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Amortization & Wealth Accumulation Ledger
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Year-by-Year
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Annual progression of opening capital, recurring contributions, compounding interest, and TDS.
            </p>
          </div>
        </div>

        {/* Action Buttons: Export CSV & Print PDF */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-md"
            title="Download CSV Spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-md"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4 text-indigo-400" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Structured Ledger Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[11px] tracking-wider">
            <tr>
              <th className="p-3.5 text-center w-16">Year</th>
              <th className="p-3.5 text-right">Opening Balance</th>
              <th className="p-3.5 text-right">Deposit Added</th>
              <th className="p-3.5 text-right">Interest Credited</th>
              <th className="p-3.5 text-right">TDS Deducted</th>
              <th className="p-3.5 text-right font-bold text-slate-200">Closing Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono">
            {schedule.map((row) => (
              <tr
                key={row.year}
                className="hover:bg-slate-800/40 transition-colors"
              >
                <td className="p-3.5 text-center font-bold text-indigo-400 font-sans">
                  Yr {row.year}
                </td>
                <td className="p-3.5 text-right text-slate-300">
                  ₹{row.opening_balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-3.5 text-right text-blue-400">
                  {row.deposit_added > 0 ? (
                    `+₹${row.deposit_added.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="p-3.5 text-right text-teal-400 font-semibold">
                  +₹{row.interest_credited.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-3.5 text-right text-rose-400">
                  {row.tds_deducted > 0 ? (
                    `-₹${row.tds_deducted.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  ) : (
                    <span className="text-slate-600 font-sans text-[11px]">₹0.00</span>
                  )}
                </td>
                <td className="p-3.5 text-right font-bold text-emerald-400">
                  ₹{row.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Table Summary Footer */}
          <tfoot className="bg-slate-800/90 font-mono font-bold text-white border-t-2 border-slate-700">
            <tr>
              <td className="p-3.5 text-center font-sans text-xs uppercase text-slate-400">
                Totals
              </td>
              <td className="p-3.5 text-right text-slate-400">
                —
              </td>
              <td className="p-3.5 text-right text-blue-300">
                ₹{totalDeposits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="p-3.5 text-right text-teal-300">
                +₹{totalInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="p-3.5 text-right text-rose-400">
                -₹{totalTds.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="p-3.5 text-right text-emerald-300 text-sm">
                ₹{finalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
