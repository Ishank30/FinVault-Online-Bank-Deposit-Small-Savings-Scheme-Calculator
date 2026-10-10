import React from 'react';
import {
  Split,
  Calendar,
  Sparkles,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function LadderView({ ladderSchedule, blendedRate, totalPrincipal, totalMaturity }) {
  if (!ladderSchedule || ladderSchedule.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Split className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              5-Year Staggered FD Ladder Architecture
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Staggered Liquidity
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Capital partitioned into 5 tranches (20% each) to eliminate interest rate timing risk.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400 block text-[10px]">Blended Portfolio APY</span>
            <span className="font-bold text-indigo-300 font-mono text-sm">
              {blendedRate?.toFixed(2) || '7.15'}% p.a.
            </span>
          </div>
        </div>
      </div>

      {/* Staircase Step Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {ladderSchedule.map((tranche, idx) => {
          const stepHeights = ['h-auto', 'h-auto', 'h-auto', 'h-auto', 'h-auto'];
          const accentColors = [
            'border-blue-500/40 hover:border-blue-500',
            'border-teal-500/40 hover:border-teal-500',
            'border-emerald-500/40 hover:border-emerald-500',
            'border-indigo-500/40 hover:border-indigo-500',
            'border-purple-500/40 hover:border-purple-500'
          ];

          return (
            <div
              key={tranche.tranche_number}
              className={`relative bg-slate-800/50 border ${accentColors[idx]} rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 space-y-3`}
            >
              {/* Top Tag & Tranche Number */}
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/90 text-indigo-300 border border-slate-700 font-mono">
                  Tranche #{tranche.tranche_number}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                  <Clock className="w-3 h-3 text-indigo-400" />
                  {tranche.tenure_years} {tranche.tenure_years === 1 ? 'Year' : 'Years'}
                </span>
              </div>

              {/* Principal Allocated */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block">Principal (20%)</span>
                <div className="text-base font-extrabold text-white font-mono">
                  ₹{tranche.principal_allocated.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Rate & Interest Badge */}
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Rate:</span>
                  <span className="text-emerald-400 font-bold">{tranche.interest_rate.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Interest:</span>
                  <span className="text-teal-300 font-semibold">+₹{tranche.interest_earned.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {/* Maturity Value Output */}
              <div className="pt-2 border-t border-slate-700/60 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Maturity Payout
                </span>
                <div className="text-sm sm:text-base font-bold text-teal-300 font-mono">
                  ₹{tranche.maturity_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Liquid in {tranche.tenure_years * 12} months
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Banner */}
      <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            <strong>Roll-Over Rule:</strong> When Tranche #1 matures after 12 months, roll the proceeds into a fresh 5-Year FD at prevailing rates to keep the perpetual ladder running.
          </span>
        </div>
        <div className="font-mono text-emerald-400 font-bold whitespace-nowrap">
          Total Maturity: ₹{Math.round(totalMaturity || 0).toLocaleString('en-IN')}
        </div>
      </div>
    </div>
  );
}
