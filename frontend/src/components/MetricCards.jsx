import React, { useState } from 'react';
import {
  Coins,
  TrendingUp,
  Percent,
  Landmark,
  ShieldCheck,
  ArrowUpRight,
  Sparkles,
  Flame,
  TrendingDown
} from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';

export default function MetricCards({ result }) {
  if (!result) return null;

  const [adjustForInflation, setAdjustForInflation] = useState(false);

  const {
    principal,
    applicable_interest_rate,
    regular_rate,
    senior_rate,
    super_senior_rate,
    apy,
    total_interest_earned,
    maturity_amount,
    effective_annual_yield,
    fractional_years = 1.0,
    inflation_rate = 0.06,
    inflation_adjusted_maturity
  } = result;

  // Real purchasing power calculation: Real Value = Maturity / (1 + 0.06)^T
  const tenureY = Math.max(Number(fractional_years) || 1.0, 0.08);
  const realValue = inflation_adjusted_maturity || (maturity_amount / Math.pow(1.0 + (inflation_rate || 0.06), tenureY));
  const realPct = maturity_amount > 0 ? Math.min(100, Math.round((realValue / maturity_amount) * 100)) : 100;
  const inflationLoss = Math.max(0, maturity_amount - realValue);

  return (
    <div className="space-y-4">
      {/* 4 Core Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Principal Invested */}
        <div className="relative group bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all duration-300 shadow-xl overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Invested</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
              <AnimatedNumber value={principal} prefix="₹" duration={750} />
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span>Base Principal Deposit</span>
            </div>
          </div>
        </div>

        {/* 2. Applicable Card Rate + APY Badge & Comparison Tag */}
        <div className="relative group bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all duration-300 shadow-xl overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Applicable Rate</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-400 font-mono tracking-tight drop-shadow-sm">
                <AnimatedNumber value={applicable_interest_rate} suffix="%" decimals={2} duration={750} />
              </div>
              {apy && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {apy.toFixed(2)}% APY
                </span>
              )}
            </div>

            {/* Comparison Tag: Regular vs Senior vs Super Senior */}
            {regular_rate !== undefined && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                <span title="Regular (<60y)">Reg: <strong className="text-slate-300">{regular_rate.toFixed(2)}%</strong></span>
                <span className="text-slate-600">•</span>
                <span title="Senior (60-79y)">Sr: <strong className="text-amber-300">{senior_rate.toFixed(2)}%</strong></span>
                <span className="text-slate-600">•</span>
                <span title="Super Senior (80+y)">Super: <strong className="text-emerald-300">{super_senior_rate.toFixed(2)}%</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Total Interest Earned */}
        <div className="relative group bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all duration-300 shadow-xl overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Interest Earned</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-400 font-mono tracking-tight drop-shadow-sm">
              <AnimatedNumber value={total_interest_earned} prefix="+₹" duration={750} />
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-teal-400/90">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Effective Yield: {effective_annual_yield?.toFixed(2) || applicable_interest_rate.toFixed(2)}% p.a.</span>
            </div>
          </div>
        </div>

        {/* 4. Maturity Amount + Real-Yield Inflation Toggle */}
        <div className="relative group bg-gradient-to-br from-slate-900 to-slate-900/90 border border-emerald-500/40 hover:border-emerald-500/70 rounded-2xl p-5 transition-all duration-300 shadow-xl shadow-emerald-950/20 overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Gross Maturity</span>
            <button
              type="button"
              onClick={() => setAdjustForInflation(prev => !prev)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 ${
                adjustForInflation
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Toggle Inflation Discounting (~6% p.a.)"
            >
              <Flame className={`w-3 h-3 ${adjustForInflation ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{adjustForInflation ? 'Inflation On' : 'Adjust 6%'}</span>
            </button>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-[0_0_12px_rgba(16,185,129,0.25)]">
              <AnimatedNumber
                value={adjustForInflation ? realValue : maturity_amount}
                prefix="₹"
                duration={750}
              />
            </div>
            <div className="flex items-center justify-between gap-1.5 mt-2 text-xs">
              <span className={adjustForInflation ? 'text-amber-300 font-semibold' : 'text-slate-300'}>
                {adjustForInflation ? 'Real Purchasing Power' : 'Nominal Maturity Value'}
              </span>
              {adjustForInflation && (
                <span className="text-[11px] font-mono text-amber-400 font-bold">
                  {realPct}% of nominal
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real-Yield Inflation Discounting Split Comparative Bar */}
      {adjustForInflation && (
        <div className="p-4 bg-slate-900/90 border border-amber-500/30 rounded-2xl space-y-2.5 animate-fade-in shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <span className="font-bold text-slate-200">
                Inflation Discounting Analysis (~{(inflation_rate * 100).toFixed(0)}% p.a. over {tenureY.toFixed(1)}y):
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-slate-300">
                Nominal: <strong className="text-white">₹{Math.round(maturity_amount).toLocaleString('en-IN')}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-300">
                Real: <strong className="text-amber-400">₹{Math.round(realValue).toLocaleString('en-IN')}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-rose-400">
                Lost Drag: -₹{Math.round(inflationLoss).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Visual Comparative Split Bar */}
          <div className="space-y-1">
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${realPct}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 relative"
                title={`Real Purchasing Power: ₹${Math.round(realValue).toLocaleString('en-IN')} (${realPct}%)`}
              />
              <div
                style={{ width: `${100 - realPct}%` }}
                className="h-full bg-gradient-to-r from-rose-500/80 to-amber-500/80 transition-all duration-500"
                title={`Inflation Drag: ₹${Math.round(inflationLoss).toLocaleString('en-IN')} (${100 - realPct}%)`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span className="text-emerald-400 font-semibold">Real Purchasing Power: {realPct}%</span>
              <span className="text-rose-400 font-semibold">Purchasing Power Eroded: {(100 - realPct)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
