import React from 'react';
import {
  Building2,
  Trophy,
  Award,
  TrendingUp,
  Percent,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function BankComparisonTable({ comparisons, selectedBank }) {
  if (!comparisons || comparisons.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              5-Bank Simultaneous Comparator
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Live Slab Matrix
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked yields across India's top 5 public and private scheduled commercial banks.
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Ranked by <strong>Gross Maturity Proceeds</strong>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[11px] tracking-wider">
            <tr>
              <th className="p-3.5 text-center w-14">Rank</th>
              <th className="p-3.5">Bank / Institution</th>
              <th className="p-3.5 text-center">Regular</th>
              <th className="p-3.5 text-center">Senior (60-79)</th>
              <th className="p-3.5 text-center">Super Sr (80+)</th>
              <th className="p-3.5 text-center">Your Rate</th>
              <th className="p-3.5 text-center">APY</th>
              <th className="p-3.5 text-right">Interest Earned</th>
              <th className="p-3.5 text-right font-bold text-slate-200">Maturity Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono">
            {comparisons.map((b) => {
              const isSelected = selectedBank === b.bank_code;
              return (
                <tr
                  key={b.bank_code}
                  className={`transition-all ${
                    b.is_best_rate
                      ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                      : isSelected
                      ? 'bg-slate-800/40 hover:bg-slate-800/60'
                      : 'hover:bg-slate-800/30'
                  }`}
                >
                  {/* Rank */}
                  <td className="p-3.5 text-center font-bold">
                    {b.rank === 1 ? (
                      <span className="w-6 h-6 mx-auto rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-xs">
                        🥇
                      </span>
                    ) : b.rank === 2 ? (
                      <span className="w-6 h-6 mx-auto rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/30 flex items-center justify-center text-xs">
                        🥈
                      </span>
                    ) : b.rank === 3 ? (
                      <span className="w-6 h-6 mx-auto rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/30 flex items-center justify-center text-xs">
                        🥉
                      </span>
                    ) : (
                      <span className="text-slate-400 font-sans">#{b.rank}</span>
                    )}
                  </td>

                  {/* Bank Name */}
                  <td className="p-3.5 font-sans">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {b.bank_name} ({b.bank_code})
                          {b.is_best_rate && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-sans">
                              <Sparkles className="w-2.5 h-2.5" /> Best Rate
                            </span>
                          )}
                          {isSelected && !b.is_best_rate && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 font-sans">
                              Selected
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {b.bank_type}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Rate Tiers */}
                  <td className="p-3.5 text-center text-slate-300 font-mono">{b.regular_rate.toFixed(2)}%</td>
                  <td className="p-3.5 text-center text-amber-300 font-mono">{b.senior_rate.toFixed(2)}%</td>
                  <td className="p-3.5 text-center text-emerald-300 font-mono">{b.super_senior_rate.toFixed(2)}%</td>

                  {/* Applicable Rate */}
                  <td className="p-3.5 text-center font-bold text-blue-400 font-mono">
                    {b.applicable_rate.toFixed(2)}%
                  </td>

                  {/* APY */}
                  <td className="p-3.5 text-center text-slate-400 font-mono">
                    {b.apy.toFixed(2)}%
                  </td>

                  {/* Total Interest */}
                  <td className="p-3.5 text-right font-mono text-teal-400 font-semibold">
                    +₹{b.interest_earned.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>

                  {/* Maturity Value */}
                  <td className="p-3.5 text-right font-mono font-bold text-white text-sm">
                    ₹{b.maturity_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
