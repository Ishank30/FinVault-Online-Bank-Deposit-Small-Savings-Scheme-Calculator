import React from 'react';
import {
  FileText,
  TrendingDown,
  TrendingUp,
  Percent,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Scale
} from 'lucide-react';

export default function TaxBreakdownCard({ result }) {
  if (!result) return null;

  const {
    tax_status,
    is_tds_applicable,
    estimated_tds_amount,
    estimated_tax_payable,
    net_post_tax_maturity,
    post_tax_annualized_yield,
    inflation_rate,
    inflation_adjusted_maturity,
    real_rate_of_return,
    principal,
    maturity_amount,
    form_15g_15h_advisory
  } = result;

  const isEEE = tax_status === 'EEE';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Taxation & Real Inflation-Adjusted Wealth</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Section 194A TDS compliance, marginal tax liability, and real purchasing power.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            isEEE
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : is_tds_applicable
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
          }`}>
            {isEEE ? '100% Tax-Free (EEE)' : is_tds_applicable ? '10% TDS Applicable' : 'TDS Exempt / Within Threshold'}
          </span>
        </div>
      </div>

      {/* Form 15G / 15H Smart Eligibility Detector Alert */}
      {form_15g_15h_advisory && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-2xl flex items-start gap-3 shadow-lg animate-fade-in">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300 block">
              Form 15G / 15H Statutory Compliance Advisory
            </span>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              {form_15g_15h_advisory}
            </p>
          </div>
        </div>
      )}

      {/* Grid of Key Tax & Real Return Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Section 194A TDS Status & Amount */}
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Sec 194A TDS Deduction</span>
            {is_tds_applicable ? (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="text-xl font-bold font-mono text-white">
            ₹{Number(estimated_tds_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-slate-400">
            {is_tds_applicable
              ? 'Deducted by bank at source (threshold breached).'
              : isEEE
              ? 'Govt Sovereign Scheme (Zero TDS).'
              : 'No TDS (Form 15G/H or within ₹40k/₹50k limit).'}
          </p>
        </div>

        {/* Metric 2: Estimated Marginal Tax Liability */}
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Estimated Income Tax</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">
            ₹{Number(estimated_tax_payable).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-slate-400">
            {isEEE
              ? 'Exempt under Section 10(11) / 10(11A).'
              : 'As per marginal slab (with Sec 80TTB for seniors).'}
          </p>
        </div>

        {/* Metric 3: Net Post-Tax Realization */}
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Post-Tax Net Realization</span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-bold font-mono text-teal-300">
            ₹{Number(net_post_tax_maturity).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-teal-400/80">
            Net take-home after accounting for all tax dues.
          </p>
        </div>

        {/* Metric 4: Real Inflation-Adjusted Purchasing Power */}
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Real Purchasing Power</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-300">
            ₹{Number(inflation_adjusted_maturity).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-indigo-400/80">
            Real Return: <strong>{real_rate_of_return.toFixed(2)}%</strong> (at {(inflation_rate * 100).toFixed(1)}% inflation).
          </p>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Inflation Impact Visual Split Bar */}
      {/* -------------------------------------------------------------------- */}
      {(() => {
        const nominalVal = Number(maturity_amount) || 0;
        const realVal = Number(inflation_adjusted_maturity) || 0;
        const erosionVal = Math.max(0, nominalVal - realVal);
        const realPct = nominalVal > 0 ? Math.min(100, Math.max(0, (realVal / nominalVal) * 100)) : 100;
        const erosionPct = 100 - realPct;
        const inflationPercent = (Number(inflation_rate) * 100).toFixed(1);

        return (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Inflation Purchasing Power Erosion Analysis
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/90 px-2.5 py-0.5 rounded-full border border-slate-700/80">
                Assumed CPI Inflation: <strong className="text-amber-300 font-mono">{inflationPercent}% p.a.</strong>
              </span>
            </div>

            {/* Visual Dual Split-Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-700/80 shadow-inner p-0.5">
                {/* Real Purchasing Power (Teal/Indigo) */}
                <div
                  style={{ width: `${realPct.toFixed(1)}%` }}
                  className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-l-full transition-all duration-700 relative group"
                  title={`Real Value: ₹${Math.round(realVal).toLocaleString('en-IN')} (${realPct.toFixed(1)}%)`}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Inflation Haircut (Amber/Rose) */}
                <div
                  style={{ width: `${erosionPct.toFixed(1)}%` }}
                  className="h-full bg-gradient-to-r from-amber-500/90 to-rose-500/90 rounded-r-full transition-all duration-700 relative group"
                  title={`Inflation Loss: ₹${Math.round(erosionVal).toLocaleString('en-IN')} (${erosionPct.toFixed(1)}%)`}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Bar Subtext Metrics */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.5)] flex-shrink-0" />
                  <span className="text-slate-300 font-medium">
                    Real Purchasing Power: <strong className="text-teal-300 font-mono">₹{Math.round(realVal).toLocaleString('en-IN')}</strong> ({realPct.toFixed(1)}%)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)] flex-shrink-0" />
                  <span className="text-slate-300 font-medium">
                    Inflation Haircut: <strong className="text-rose-300 font-mono">-₹{Math.round(erosionVal).toLocaleString('en-IN')}</strong> ({erosionPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <span>Nominal Maturity: <strong className="text-white font-mono">₹{Math.round(nominalVal).toLocaleString('en-IN')}</strong></span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span>
                Net Real Wealth Growth:{' '}
                <strong className={real_rate_of_return >= 0 ? "text-emerald-400 font-mono" : "text-rose-400 font-mono"}>
                  {real_rate_of_return >= 0 ? "+" : ""}{real_rate_of_return.toFixed(2)}% p.a.
                </strong>{' '}
                above inflation
              </span>
            </div>
          </div>
        );
      })()}

      {/* Explanatory Walkthrough */}
      <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 text-xs text-slate-400 space-y-1.5 leading-relaxed">
        <div className="font-semibold text-slate-300 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span>Statutory Tax & Purchasing Power Rules</span>
        </div>
        <p>
          • <strong>Section 194A:</strong> Banks deduct 10% TDS if aggregate annual interest across all branches breaches ₹40,000 for regular depositors or ₹50,000 for senior citizens (Sec 80TTB). Form 15G (under 60) or Form 15H (60+) exempts TDS for qualifying individuals.
        </p>
        <p>
          • <strong>Fisher Real Return Equation:</strong> Because inflation erodes future fiat purchasing power, your nominal maturity of ₹{Number(maturity_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })} equates to ₹{Number(inflation_adjusted_maturity).toLocaleString('en-IN', { maximumFractionDigits: 0 })} in present-day rupees.
        </p>
      </div>
    </div>
  );
}
