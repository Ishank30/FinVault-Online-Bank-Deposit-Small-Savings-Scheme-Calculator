import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Sparkles,
  ShieldCheck,
  Building2,
  Calendar,
  Lock,
  Unlock,
  Clock,
  Info,
  CheckCircle2,
  RefreshCw,
  Coins,
  Scale,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function ComparisonTable({
  comparison,
  userAge,
  userGender,
  allowCrossCadenceToggle = true
}) {
  if (!comparison || !comparison.ranked_schemes || comparison.ranked_schemes.length === 0) {
    return null;
  }

  const {
    ranked_schemes = [],
    active_cadence = 'ONE_TIME',
    cross_cadence_reference = null,
    total_eligible_schemes = 0,
    user_tax_slab_percent = 20
  } = comparison;

  const [selectedFilter, setSelectedFilter] = useState('ALL'); // 'ALL' | 'BANKS' | 'GOVT'
  const [showPpfCrossReference, setShowPpfCrossReference] = useState(false);

  // Dynamic filter logic preserving cadence compatibility
  const filteredSchemes = useMemo(() => {
    let baseList = ranked_schemes.filter((item) => {
      if (selectedFilter === 'BANKS') {
        return item.category.startsWith('Commercial Bank');
      }
      if (selectedFilter === 'GOVT') {
        return item.category === 'Govt Small Savings';
      }
      return true;
    });

    // If user explicitly enables cross-cadence benchmark comparison
    if (showPpfCrossReference && cross_cadence_reference && (active_cadence === 'LUMP_SUM' || active_cadence === 'ONE_TIME')) {
      if (selectedFilter === 'ALL' || selectedFilter === 'GOVT') {
        baseList = [...baseList, cross_cadence_reference];
      }
    }

    return baseList;
  }, [ranked_schemes, selectedFilter, showPpfCrossReference, cross_cadence_reference, active_cadence]);

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

  const getTagBadgeStyle = (badge) => {
    if (!badge) return 'bg-slate-800 text-slate-300 border-slate-700';
    if (badge.includes('Best Overall') || badge.includes('🏆')) {
      return 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10';
    }
    if (badge.includes('Tax-Free') || badge.includes('EEE')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    if (badge.includes('Liquidity')) {
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    }
    if (badge.includes('Senior')) {
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    }
    if (badge.includes('Monthly')) {
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }
    if (badge.includes('Yearly Benchmark')) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const getCadenceTitle = () => {
    switch (active_cadence) {
      case 'MONTHLY':
        return {
          title: 'Monthly Recurring Savings Comparator',
          subtitle: 'Comparing Bank Recurring Deposits against Post Office RD on equivalent monthly installments.',
          badge: 'Cadence: Monthly',
          badgeIcon: RefreshCw,
          badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        };
      case 'YEARLY':
        return {
          title: 'Sovereign Annual Wealth Comparator',
          subtitle: 'Comparing Section 80C EEE wealth creation schemes (PPF vs Sukanya Samriddhi Yojana).',
          badge: 'Cadence: Yearly',
          badgeIcon: ShieldCheck,
          badgeColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
        };
      case 'LUMP_SUM':
      case 'ONE_TIME':
      default:
        return {
          title: 'Lump Sum Fixed Deposit & Sovereign Comparator',
          subtitle: 'Evaluating 5 Scheduled Commercial Banks and tenure-matched sovereign schemes (POTD, SCSS, POMIS, NSC).',
          badge: 'Cadence: Lump Sum',
          badgeIcon: Coins,
          badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
        };
    }
  };

  const cadenceInfo = getCadenceTitle();
  const CadenceIcon = cadenceInfo.badgeIcon;

  return (
    <div className="space-y-4">
      {/* -------------------------------------------------------------------- */}
      {/* Table Header Controls & Active Cadence Badge                        */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>{cadenceInfo.title}</span>
            </h4>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${cadenceInfo.badgeColor}`}>
              <CadenceIcon className="w-3 h-3" />
              <span>{cadenceInfo.badge}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {cadenceInfo.subtitle}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800 self-start md:self-center">
          <button
            type="button"
            onClick={() => setSelectedFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === 'ALL'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Compatible ({ranked_schemes.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('BANKS')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === 'BANKS'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Banks Only
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('GOVT')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === 'GOVT'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Govt Schemes
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Optional Cross-Cadence PPF Toggle for Lump Sum Mode                  */}
      {/* -------------------------------------------------------------------- */}
      {allowCrossCadenceToggle && (active_cadence === 'LUMP_SUM' || active_cadence === 'ONE_TIME') && cross_cadence_reference && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950/70 border border-slate-800/90 rounded-2xl">
          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Cross-Cadence Comparison:</strong> Yearly schemes (PPF / SSY) require 15-year annual installments and are excluded by default to avoid financial distortion.
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer self-start sm:self-center px-2.5 py-1 bg-slate-800/90 hover:bg-slate-800 rounded-xl border border-slate-700/80 transition-all select-none">
            <input
              type="checkbox"
              checked={showPpfCrossReference}
              onChange={(e) => setShowPpfCrossReference(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
            />
            <span className="text-[11px] font-semibold text-slate-200">
              Show 15-Year PPF Reference Benchmark
            </span>
          </label>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Table Container                                                      */}
      {/* -------------------------------------------------------------------- */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3.5 text-center w-14">Rank</th>
              <th className="p-3.5 min-w-[220px]">Scheme / Institution</th>
              <th className="p-3.5 text-center">Cadence</th>
              <th className="p-3.5 text-center">Tenure</th>
              <th className="p-3.5 text-center">Gross Rate</th>
              <th className="p-3.5 text-center font-bold text-amber-300">Post-Tax Yield</th>
              <th className="p-3.5 text-right">Gross Maturity</th>
              <th className="p-3.5 text-right font-extrabold text-emerald-400">Post-Tax Maturity</th>
              <th className="p-3.5 text-center">Liquidity</th>
              <th className="p-3.5 text-center">Distinction Badge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono">
            {filteredSchemes.map((scheme) => {
              const isWinner = scheme.is_best_pick && !scheme.is_cross_cadence;
              const isCrossCadence = scheme.is_cross_cadence;

              return (
                <tr
                  key={scheme.scheme_code}
                  className={`transition-colors ${
                    isWinner
                      ? 'bg-amber-500/10 hover:bg-amber-500/15 font-semibold text-white'
                      : isCrossCadence
                      ? 'bg-indigo-950/30 hover:bg-indigo-950/40 border-l-2 border-indigo-400 text-slate-200'
                      : 'hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  {/* Rank */}
                  <td className="p-3.5 text-center">
                    {isCrossCadence ? (
                      <span className="text-[10px] font-bold text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                        REF
                      </span>
                    ) : isWinner ? (
                      <div className="w-7 h-7 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-extrabold">
                        1
                      </div>
                    ) : (
                      <span className="font-bold text-slate-400">#{scheme.rank}</span>
                    )}
                  </td>

                  {/* Scheme Name & Category */}
                  <td className="p-3.5 font-sans">
                    <div className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>{scheme.scheme_name}</span>
                      {isWinner && (
                        <span className="text-[10px] text-amber-400 font-extrabold">&#9733;</span>
                      )}
                    </div>

                    {/* Contextual Tag for Cross-Cadence Benchmark */}
                    {scheme.contextual_tag && (
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <span>⚠️</span>
                          <span>{scheme.contextual_tag}</span>
                        </span>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span>{scheme.institution_or_issuer}</span>
                      <span>&bull;</span>
                      <span className="text-slate-400">{scheme.tax_treatment}</span>
                    </div>
                  </td>

                  {/* Cadence */}
                  <td className="p-3.5 text-center font-sans">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800/90 text-slate-300 border border-slate-700">
                      {scheme.cadence === 'ONE_TIME'
                        ? 'One-Time'
                        : scheme.cadence === 'MONTHLY'
                        ? 'Monthly'
                        : 'Yearly'}
                    </span>
                  </td>

                  {/* Tenure */}
                  <td className="p-3.5 text-center text-slate-300">
                    {scheme.tenure_display}
                  </td>

                  {/* Gross Rate */}
                  <td className="p-3.5 text-center font-bold text-slate-200">
                    {scheme.gross_interest_rate.toFixed(2)}%
                  </td>

                  {/* Post-Tax Effective Yield */}
                  <td className="p-3.5 text-center">
                    <span className="font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      {scheme.post_tax_effective_yield.toFixed(2)}%
                    </span>
                  </td>

                  {/* Gross Maturity */}
                  <td className="p-3.5 text-right text-slate-400">
                    ₹{Number(scheme.estimated_maturity_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>

                  {/* Net Post-Tax Maturity */}
                  <td className="p-3.5 text-right font-extrabold text-emerald-400 text-sm">
                    ₹{Number(scheme.post_tax_maturity_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>

                  {/* Liquidity Score */}
                  <td className="p-3.5 text-center font-sans">
                    {getLiquidityBadge(scheme.liquidity_score)}
                  </td>

                  {/* Strategic Distinction Badge */}
                  <td className="p-3.5 text-center font-sans">
                    {scheme.badge ? (
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getTagBadgeStyle(
                          scheme.badge
                        )}`}
                      >
                        {scheme.badge}
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Informational Guidance Footer                                        */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-2">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <span>
            <strong className="text-slate-200">Frequency Isolation Guarantee:</strong> Investments are benchmarked strictly against products with matching contribution cadence (One-Time vs Monthly RD vs Annual PPF/SSY) to prevent tenure and compounding distortions.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
          <span>
            <strong className="text-slate-200">Tax Optimization:</strong> Post-tax proceeds account for your{' '}
            <strong className="text-amber-300">{user_tax_slab_percent}% tax bracket</strong>. Section 10(11) EEE sovereign instruments suffer zero tax drag, while bank deposits benefit from Section 80TTB exemptions for seniors.
          </span>
        </div>
      </div>
    </div>
  );
}
