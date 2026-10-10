import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Scale,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Coins,
  Calendar,
  Sparkles,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

export default function BreakVsLoanModal({ isOpen, onClose, principal, contractedRate, totalTenureMonths, age, selectedBank }) {
  if (!isOpen) return null;

  const maxLoanAllowed = Math.round(principal * 0.90);
  const minLoanAllowed = Math.max(500, Math.min(1000, Math.round(maxLoanAllowed * 0.10)));
  const effectiveMaxLoan = Math.max(minLoanAllowed, maxLoanAllowed);
  const defaultCash = Math.min(Math.max(minLoanAllowed, Math.round(principal * 0.50)), effectiveMaxLoan);
  const maxElapsed = Math.max(1, (totalTenureMonths || 12) - 1);

  // Modal Interactive States
  const [cashNeeded, setCashNeeded] = useState(defaultCash);
  const [elapsedMonths, setElapsedMonths] = useState(Math.min(6, maxElapsed));
  const [loanDurationMonths, setLoanDurationMonths] = useState(6);

  useEffect(() => {
    setCashNeeded(prev => {
      const current = prev || defaultCash;
      return Math.min(Math.max(minLoanAllowed, current), effectiveMaxLoan);
    });
  }, [minLoanAllowed, effectiveMaxLoan, defaultCash]);

  // --------------------------------------------------------------------------
  // Reactive Math Engine for Break vs Loan
  // --------------------------------------------------------------------------
  const analysis = useMemo(() => {
    const P = Number(principal);
    const r = Number(contractedRate);
    const totMonths = Number(totalTenureMonths || 12);
    const elapsedM = Number(elapsedMonths);
    const loanM = Number(loanDurationMonths);
    const cash = Math.min(Number(cashNeeded), P * 0.90);

    // 1. Contracted Full Maturity
    const totYears = totMonths / 12.0;
    const fullMaturity = P * Math.pow(1.0 + (r / 400.0), totYears * 4.0);
    const fullInterest = fullMaturity - P;

    // 2. Break FD Option:
    // Rate for run period is typically 0.5% - 1.0% below contracted, and penalty subtracts 1.00%
    const approxElapsedRate = Math.max(3.50, r - 0.50);
    const penalizedRate = Math.max(1.0, approxElapsedRate - 1.00);
    const elapsedYears = elapsedM / 12.0;
    const interestOnBreak = (elapsedM * 30 < 180)
      ? P * (penalizedRate / 100.0) * elapsedYears
      : P * Math.pow(1.0 + (penalizedRate / 400.0), elapsedYears * 4.0) - P;

    const futureInterestLost = Math.max(0, fullInterest - interestOnBreak);

    // 3. Overdraft Loan Option:
    // Loan interest rate is contracted rate + 1.00% margin
    const loanRate = r + 1.00;
    const loanInterestCost = cash * (loanRate / 100.0) * (loanM / 12.0);

    // Net financial gain from keeping FD intact:
    // (Full maturity interest) - (Loan interest cost paid)
    const netGainKeepingFD = fullInterest - loanInterestCost;

    // Difference between keeping FD and breaking
    const netDifference = netGainKeepingFD - interestOnBreak;
    const isLoanBetter = netDifference >= 0;

    return {
      cash,
      elapsedM,
      loanM,
      fullMaturity,
      fullInterest,
      penalizedRate,
      interestOnBreak,
      futureInterestLost,
      loanRate,
      loanInterestCost,
      netGainKeepingFD,
      netDifference: Math.abs(netDifference),
      isLoanBetter
    };
  }, [principal, contractedRate, totalTenureMonths, cashNeeded, elapsedMonths, loanDurationMonths]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Break FD vs. Overdraft Loan Analyzer</h3>
              <p className="text-xs text-slate-400">
                Liquidity strategy engine: Premature penalty loss vs. Overdraft borrowing cost.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Dynamic Verdict Banner */}
        {/* ------------------------------------------------------------------ */}
        <div className={`p-5 rounded-2xl border transition-all ${analysis.isLoanBetter
            ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/30'
            : 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/30'
          }`}>
          <div className="flex items-start gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${analysis.isLoanBetter
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
              {analysis.isLoanBetter ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${analysis.isLoanBetter
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                  }`}>
                  Verdict: {analysis.isLoanBetter ? 'Avail Overdraft Loan (Recommended)' : 'Liquidate / Break FD'}
                </span>
              </div>
              <h4 className="text-base font-bold text-white mt-1">
                {analysis.isLoanBetter
                  ? `Taking an Overdraft Loan saves you ₹${analysis.netDifference.toLocaleString('en-IN', { maximumFractionDigits: 0 })} net!`
                  : `Breaking the FD is financially favorable by ₹${analysis.netDifference.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.`}
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {analysis.isLoanBetter
                  ? `Your loan interest cost over ${analysis.loanM} months is only ₹${analysis.loanInterestCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}, while your FD continues earning ₹${analysis.fullInterest.toLocaleString('en-IN', { maximumFractionDigits: 0 })} at ${contractedRate.toFixed(2)}%. Breaking now triggers a 1.00% penalty, losing you ₹${analysis.futureInterestLost.toLocaleString('en-IN', { maximumFractionDigits: 0 })} in future yield.`
                  : `Because the loan repayment duration is long, borrowing charges exceed premature penalty losses. Liquidating yields ₹${analysis.interestOnBreak.toLocaleString('en-IN', { maximumFractionDigits: 0 })} up to month ${analysis.elapsedM} with no debt.`}
              </p>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Interactive Sliders & Inputs */}
        {/* ------------------------------------------------------------------ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* 1. Emergency Cash Needed */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Emergency Cash Needed</span>
              <span className="font-mono text-emerald-400 font-bold">
                ₹{Number(cashNeeded).toLocaleString('en-IN')}
              </span>
            </div>
            <input
              type="range"
              min={minLoanAllowed}
              max={effectiveMaxLoan}
              step="500"
              value={cashNeeded}
              onChange={(e) => setCashNeeded(Number(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Min: ₹{minLoanAllowed.toLocaleString('en-IN')}</span>
              <span>Max 90%: ₹{effectiveMaxLoan.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* 2. Elapsed Months */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Elapsed FD Duration</span>
              <span className="font-mono text-blue-400 font-bold">{elapsedMonths} Months</span>
            </div>
            <input
              type="range"
              min="1"
              max={maxElapsed}
              value={elapsedMonths}
              onChange={(e) => setElapsedMonths(Number(e.target.value))}
              className="w-full accent-blue-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>1 Month</span>
              <span>Total: {totalTenureMonths || 12}m</span>
            </div>
          </div>

          {/* 3. Loan Duration */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Expected Loan Duration</span>
              <span className="font-mono text-amber-400 font-bold">{loanDurationMonths} Months</span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              value={loanDurationMonths}
              onChange={(e) => setLoanDurationMonths(Number(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>1 Month</span>
              <span>24 Months</span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Side-by-Side Comparison Columns */}
        {/* ------------------------------------------------------------------ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          {/* Option A: Breaking the FD */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between font-sans">
              <span className="font-bold text-slate-300">Option A: Premature Break</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 font-mono">
                Penalty: -1.00%
              </span>
            </div>
            <div className="space-y-1.5 pt-1 text-slate-400">
              <div className="flex justify-between">
                <span>Contracted Rate:</span>
                <span className="text-white">{contractedRate.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Penalized Rate Applied:</span>
                <span className="text-red-400 font-bold">{analysis.penalizedRate.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Interest Earned at Break:</span>
                <span className="text-teal-400 font-semibold">+₹{analysis.interestOnBreak.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-1.5 font-sans font-bold text-slate-200">
                <span>Maturity Yield Lost:</span>
                <span className="text-rose-400 font-mono">-₹{analysis.futureInterestLost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>

          {/* Option B: Overdraft Loan against FD */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between font-sans">
              <span className="font-bold text-slate-300">Option B: Overdraft Loan</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                Margin: +1.00%
              </span>
            </div>
            <div className="space-y-1.5 pt-1 text-slate-400">
              <div className="flex justify-between">
                <span>Loan Interest Rate:</span>
                <span className="text-amber-300 font-bold">{analysis.loanRate.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Loan Cost ({analysis.loanM} mos):</span>
                <span className="text-amber-400 font-semibold">-₹{analysis.loanInterestCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between">
                <span>Full FD Interest Retained:</span>
                <span className="text-teal-400 font-semibold">+₹{analysis.fullInterest.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-1.5 font-sans font-bold text-slate-200">
                <span>Net FD Realization:</span>
                <span className="text-emerald-400 font-mono">+₹{analysis.netGainKeepingFD.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-all"
          >
            Close Analyzer
          </button>
        </div>
      </div>
    </div>
  );
}
