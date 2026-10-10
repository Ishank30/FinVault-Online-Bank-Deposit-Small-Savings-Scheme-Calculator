import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Split,
  ChevronDown,
  ChevronUp,
  Building2,
  CheckCircle2,
  Info
} from 'lucide-react';

export default function DicgcAlert({ dicgcData, principal }) {
  const [showSplitPlan, setShowSplitPlan] = useState(false);

  if (!dicgcData) return null;

  const {
    total_exposure,
    insurance_limit,
    is_fully_insured,
    uninsured_amount,
    safe_principal_limit,
    recommendation,
    auto_split_plan
  } = dicgcData;

  return (
    <div className="w-full space-y-4">
      {is_fully_insured ? (
        // --------------------------------------------------------------------
        // Green Banner: Fully Insured under DICGC
        // --------------------------------------------------------------------
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 shadow-lg shadow-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">100% Sovereign DICGC Insured Deposit</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Fully Covered
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Total maturity proceeds (₹{Number(total_exposure).toLocaleString('en-IN')}) are within the statutory ₹5,00,000 DICGC insurance ceiling per depositor.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono text-emerald-400 font-semibold self-start sm:self-auto bg-emerald-900/40 px-3 py-1.5 rounded-lg border border-emerald-700/40 whitespace-nowrap">
            ₹0.00 Uninsured Risk
          </div>
        </div>
      ) : (
        // --------------------------------------------------------------------
        // Amber Alert: Exceeds ₹5 Lakh DICGC Ceiling
        // --------------------------------------------------------------------
        <div className="p-5 sm:p-6 rounded-2xl bg-amber-950/40 border border-amber-500/50 shadow-xl shadow-amber-950/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-amber-200">
                    Deposit Proceeds Exceed DICGC Cover (₹5,00,000 Limit)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Over-Exposed by ₹{Number(uninsured_amount).toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {recommendation}
                </p>
              </div>
            </div>

            {/* Trigger Button */}
            {auto_split_plan && auto_split_plan.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSplitPlan(!showSplitPlan)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-950/40 flex items-center gap-2 self-start sm:self-center transition-all whitespace-nowrap active:scale-95"
              >
                <Split className="w-4 h-4" />
                <span>{showSplitPlan ? 'Hide Auto-Split Strategy' : 'Auto-Split Across Banks'}</span>
                {showSplitPlan ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Expanded Multi-Bank Auto-Split Allocation Strategy */}
          {showSplitPlan && auto_split_plan && (
            <div className="pt-3 border-t border-amber-800/40 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  Recommended Multi-Bank DICGC Safe Distribution (Capped at ₹4,25,000 per bank)
                </span>
                <span className="text-[11px] text-slate-400">100% Insured Guarantee</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {auto_split_plan.map((split, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        {split.bank} ({split.bank_name})
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        100% Insured
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-xs">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Principal Allocation:</span>
                        <span className="text-white font-semibold">₹{split.principal_allocated.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Projected Interest:</span>
                        <span className="text-teal-400 font-semibold">+₹{split.projected_interest.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800 font-bold">
                        <span>Estimated Maturity:</span>
                        <span className="text-emerald-400">₹{split.projected_maturity.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                <span>
                  By maintaining principal deposits under ₹4,25,000 per bank, accrued compound interest stays comfortably below the ₹5,00,000 ceiling, ensuring complete protection under RBI's DICGC Act.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
