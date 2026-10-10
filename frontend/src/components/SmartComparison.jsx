import React from 'react';
import {
  Trophy,
  Sparkles,
  Scale,
  Unlock,
  Clock,
  Lock
} from 'lucide-react';
import ComparisonTable from './ComparisonTable';

export default function SmartComparison({ comparison, userAge, userGender }) {
  if (!comparison || !comparison.ranked_schemes || comparison.ranked_schemes.length === 0) {
    return null;
  }

  const {
    best_pick,
    recommendation_headline,
    recommendation_rationale,
    total_eligible_schemes,
    user_tax_slab_percent,
    active_cadence
  } = comparison;

  const getLiquidityBadge = (score) => {
    switch (score) {
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Unlock className="w-3 h-3 text-emerald-400" />
            <span>High (Instant Loan/Break)</span>
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Medium (5-Yr Lock-in)</span>
          </span>
        );
      case 'Low':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Lock className="w-3 h-3 text-indigo-400" />
            <span>Low (Statutory Lock-in)</span>
          </span>
        );
      default:
        return <span>{score}</span>;
    }
  };

  const getCadenceLabel = (cadence) => {
    const norm = (cadence || '').toUpperCase();
    if (norm === 'MONTHLY') return 'Monthly';
    if (norm === 'YEARLY') return 'Yearly';
    return 'Lump Sum';
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-xl">
      {/* Decorative ambient gradient backdrop */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* -------------------------------------------------------------------- */}
      {/* Header: "Which is Better?" Recommendation Banner                     */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/90 relative z-10">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10 flex-shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-white tracking-tight">
                Which is Better? Smart Scheme Comparison
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>AI Ranked by Post-Tax Wealth</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Filtered algorithmic benchmark comparing eligible schemes strictly within your selected{' '}
              <strong className="text-emerald-400">{getCadenceLabel(active_cadence)}</strong> cadence.
            </p>
          </div>
        </div>

        {/* Profile Demographics Chips */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-center text-[11px] font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/80">
            Cadence: <strong className="text-emerald-400">{getCadenceLabel(active_cadence)}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/80">
            Age: <strong className="text-white">{userAge || 30}y</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/80">
            Tax Slab: <strong className="text-amber-300">{user_tax_slab_percent}%</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/80">
            Eligible: <strong className="text-emerald-400">{total_eligible_schemes} Options</strong>
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* #1 Winner Card: Top Recommended Scheme Banner                        */}
      {/* -------------------------------------------------------------------- */}
      {best_pick && (
        <div className="relative group bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 border-2 border-amber-500/40 hover:border-amber-500/60 rounded-2xl p-5 sm:p-6 transition-all duration-300 shadow-xl shadow-amber-950/20 overflow-hidden">
          {/* Subtle gold glow pulse */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl group-hover:bg-amber-500/25 transition-all pointer-events-none" />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            {/* Winner Identity & Trophy */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-0.5 shadow-xl shadow-amber-500/30 flex-shrink-0 animate-bounce-subtle">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Trophy className="w-7 h-7 text-amber-400" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/25 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span>#1 Top Recommended Pick</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {best_pick.category}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    Tenure: {best_pick.tenure_display}
                  </span>
                </div>

                <h4 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {best_pick.scheme_name}
                </h4>
                <p className="text-xs text-slate-400">
                  Issued by <span className="text-slate-200 font-semibold">{best_pick.institution_or_issuer}</span> &bull; {best_pick.tax_treatment}
                </p>
              </div>
            </div>

            {/* Winner Key Financial Metrics Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              {/* Metric 1: Net Post-Tax Maturity */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 shadow-inner">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Net Post-Tax Maturity
                </span>
                <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono tracking-tight block mt-0.5">
                  ₹{Number(best_pick.post_tax_maturity_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Gross: ₹{Number(best_pick.estimated_maturity_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Metric 2: Post-Tax Effective Yield */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 shadow-inner">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Post-Tax Yield
                </span>
                <span className="text-lg sm:text-xl font-black text-amber-300 font-mono tracking-tight block mt-0.5">
                  {best_pick.post_tax_effective_yield.toFixed(2)}%
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Gross: {best_pick.gross_interest_rate.toFixed(2)}% p.a.
                </span>
              </div>

              {/* Metric 3: Liquidity Rating */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 shadow-inner col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Liquidity Score
                </span>
                <div className="mt-1">
                  {getLiquidityBadge(best_pick.liquidity_score)}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {best_pick.liquidity_score === 'High' ? 'Overdraft Loan up to 90%' : 'Fixed lock-in tenure'}
                </span>
              </div>
            </div>
          </div>

          {/* Winner 1-2 Sentence Decision Rationale */}
          <div className="mt-4 pt-4 border-t border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className="text-xs font-bold text-amber-300 block">
                {recommendation_headline}
              </span>
              <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                {recommendation_rationale}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Cadence-Filtered Comparison Matrix Table                            */}
      {/* -------------------------------------------------------------------- */}
      <ComparisonTable
        comparison={comparison}
        userAge={userAge}
        userGender={userGender}
        allowCrossCadenceToggle={true}
      />
    </section>
  );
}

export { SmartComparison, SmartComparison as Comparison };

