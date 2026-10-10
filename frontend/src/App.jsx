import React, { useState, useEffect } from 'react';
import {
  Landmark,
  ShieldCheck,
  FileSpreadsheet,
  Printer,
  Sparkles,
  RefreshCw,
  Coins,
  Scale,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Info,
  X,
  Target,
  MessageCircle
} from 'lucide-react';

import CalculatorForm from './components/CalculatorForm';
import MetricCards from './components/MetricCards';
import Comparison from './components/Comparison';
import SmartComparison from './components/SmartComparison';
import DicgcAlert from './components/DicgcAlert';
import GrowthCharts from './components/GrowthCharts';
import LadderView from './components/LadderView';
import TaxBreakdownCard from './components/TaxBreakdownCard';
import BankComparisonTable from './components/BankComparisonTable';
import AmortizationTable from './components/AmortizationTable';
import BreakVsLoanModal from './components/BreakVsLoanModal';
import GoalPlannerView from './components/GoalPlannerView';
import { exportToCSV, triggerPrintReport } from './utils/exportUtils';
import { checkBackendHealth } from './api/client';

export default function App() {
  const [appMode, setAppMode] = useState('FORWARD'); // 'FORWARD' | 'GOAL_PLANNER'
  const [result, setResult] = useState(null);
  const [formMeta, setFormMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isBreakLoanModalOpen, setIsBreakLoanModalOpen] = useState(false);
  const [isColdStarting, setIsColdStarting] = useState(false);
  const [engineStatus, setEngineStatus] = useState('CHECKING'); // 'CHECKING' | 'READY' | 'WAKING_UP' | 'OFFLINE'

  // Cold-start background warmup probe on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      // If health check takes longer than 3 seconds, alert user about free-tier cloud wake-up
      setIsColdStarting(true);
      setEngineStatus('WAKING_UP');
    }, 3000);

    checkBackendHealth()
      .then((res) => {
        clearTimeout(timer);
        if (res.healthy) {
          setIsColdStarting(false);
          setEngineStatus('READY');
        } else {
          setEngineStatus('OFFLINE');
        }
      })
      .catch(() => {
        clearTimeout(timer);
        setEngineStatus('OFFLINE');
      });

    return () => clearTimeout(timer);
  }, []);

  // Also trigger cold-start banner if active calculation takes > 3 seconds
  useEffect(() => {
    let calcTimer;
    if (isLoading) {
      calcTimer = setTimeout(() => {
        setIsColdStarting(true);
      }, 3000);
    } else {
      // If we finished loading and engine is ready, clear the banner
      if (engineStatus === 'READY') {
        setIsColdStarting(false);
      }
    }
    return () => clearTimeout(calcTimer);
  }, [isLoading, engineStatus]);

  const handleCalculationStart = () => {
    setIsLoading(true);
    setErrorMessage(null);
  };

  const handleCalculationResult = (data, meta) => {
    setResult(data);
    setFormMeta(meta);
    setIsLoading(false);
    setIsColdStarting(false);
    setEngineStatus('READY');
  };

  const handleCalculationError = (errorMsg) => {
    setErrorMessage(errorMsg);
    setIsLoading(false);
  };

  const handleExportCSV = () => {
    if (!result || !result.schedule) return;
    exportToCSV(result.schedule, {
      schemeName: result.institution_or_scheme_name,
      principal: result.principal,
      maturityAmount: result.maturity_amount
    });
  };

  const handleShareWhatsApp = () => {
    if (!result) return;
    const amountStr = Number(result.principal).toLocaleString('en-IN');
    const schemeStr = result.institution_or_scheme_name || 'Deposit';
    const tenureStr = result.tenure_description || `${result.total_tenure_months || 12} Months`;
    const maturityStr = Number(result.maturity_amount).toLocaleString('en-IN');
    const rateStr = result.applicable_interest_rate ? result.applicable_interest_rate.toFixed(2) : '0.00';
    const postTaxGain = result.post_tax_gain !== undefined && result.post_tax_gain !== null
      ? Number(result.post_tax_gain).toLocaleString('en-IN')
      : Number((result.total_interest || 0) - (result.total_tax_deducted || 0)).toLocaleString('en-IN');

    const summaryText = `📊 FinVault Summary: ₹${amountStr} invested in ${schemeStr} for ${tenureStr} yields ₹${maturityStr} at ${rateStr}% p.a. Post-tax gain: ₹${postTaxGain}.`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white font-sans antialiased">
      {/* -------------------------------------------------------------------- */}
      {/* Top Application Navigation Bar */}
      {/* -------------------------------------------------------------------- */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-40 print-hide">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Landmark className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base tracking-tight block">
                  FinVault <span className="text-emerald-400 font-mono text-xs px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full font-bold ml-1">India</span>
                </span>
                {engineStatus === 'READY' && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Engine Online
                  </span>
                )}
                {engineStatus === 'WAKING_UP' && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Waking Up...
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 block -mt-0.5">
                Bank Deposit & Small Savings Scheme Calculator
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {result && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-xs font-semibold text-white border border-emerald-600/50 transition-all active:scale-95 shadow-sm"
                  title="Share FinVault Summary to WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-200" />
                  <span className="hidden sm:inline">Share to WhatsApp</span>
                  <span className="sm:hidden">WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all active:scale-95 shadow-sm"
                  title="Export Amortization Ledger to CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={triggerPrintReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 shadow-sm transition-all active:scale-95"
                  title="Print Report or Save PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------------- */}
      {/* Cloud Cold-Start Graceful Notification Banner */}
      {/* -------------------------------------------------------------------- */}
      {isColdStarting && (
        <aside
          role="status"
          aria-live="polite"
          className="bg-amber-950/70 border-b border-amber-500/40 text-amber-100 px-4 py-2.5 print-hide transition-all shadow-md"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
              </span>
              <p className="font-medium text-amber-200 leading-snug">
                <span className="font-semibold text-amber-300 mr-1.5">
                  Waking up the sovereign calculation engine on free-tier cloud...
                </span>
                <span className="text-amber-200/90">
                  This initial run may take ~30 seconds.
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsColdStarting(false)}
              className="text-amber-400/80 hover:text-amber-100 p-1 rounded transition-colors shrink-0"
              title="Dismiss notice"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Top Segmented Mode Toggle: [ Forward Calculator ] | [ Target Goal Planner ] */}
      {/* -------------------------------------------------------------------- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 print-hide">
        <div className="flex items-center justify-center">
          <div className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 inline-flex shadow-xl">
            <button
              type="button"
              onClick={() => setAppMode('FORWARD')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                appMode === 'FORWARD'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Forward Calculator</span>
            </button>
            <button
              type="button"
              onClick={() => setAppMode('GOAL_PLANNER')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                appMode === 'GOAL_PLANNER'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-400/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>Target Goal Planner</span>
            </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Toast Error Alert */}
      {/* -------------------------------------------------------------------- */}
      {errorMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 print-hide">
          <div className="p-4 bg-rose-950/80 border border-rose-800/80 rounded-2xl text-xs text-rose-300 flex items-start justify-between gap-3 shadow-xl">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-200 block">Calculation Request Notice</span>
                <span className="text-rose-300/90 whitespace-pre-line">{errorMessage}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Main View Area: Dual Mode Switching */}
      {/* -------------------------------------------------------------------- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {appMode === 'GOAL_PLANNER' ? (
          /* ================================================================ */
          /* Mode 2: Goal-Based Reverse Planner View                           */
          /* ================================================================ */
          <div className="animate-fade-in">
            <GoalPlannerView initialAge={formMeta?.age || 35} />
          </div>
        ) : (
          /* ================================================================ */
          /* Mode 1: Forward Calculator View (2-Column Grid)                  */
          /* ================================================================ */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Form & Configuration (5 cols) */}
            <div className="lg:col-span-5 space-y-6 print-hide">
              <CalculatorForm
                onCalculationStart={handleCalculationStart}
                onCalculationResult={handleCalculationResult}
                onError={handleCalculationError}
                hideInlineOutput={true}
                onSwitchToGoalPlanner={() => setAppMode('GOAL_PLANNER')}
              />
            </div>

            {/* Right Column: Analytics, Charts, Tables & Guardrails (7 cols) */}
            <div className="lg:col-span-7 space-y-8">
              {isLoading ? (
                // Loading State Skeleton
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-xl">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-spin">
                    <RefreshCw className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">Computing Multi-Tier Financial Analytics...</h3>
                    <p className="text-xs text-slate-400">
                      Applying RBI quarterly compounding, Section 194A TDS thresholds, and 5-bank benchmarks.
                    </p>
                  </div>
                </div>
              ) : result ? (
                // Results Presentation
                <div className="space-y-8 animate-fade-in">
                  {/* Institutional Printable Report Banner (Only visible during PDF print) */}
                  <div className="print-report-banner pb-4 mb-6 border-b-2 border-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <h1 className="text-xl font-extrabold text-slate-900">
                          FinVault India — Portfolio & Statutory Amortization Report
                        </h1>
                        <p className="text-xs text-slate-600 mt-1">
                          Product: <strong className="text-slate-900">{result.institution_or_scheme_name}</strong> |
                          Principal: <strong className="text-slate-900">₹{Number(result.principal).toLocaleString('en-IN')}</strong> |
                          Maturity: <strong className="text-slate-900">₹{Number(result.maturity_amount).toLocaleString('en-IN')}</strong>
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-slate-500 font-mono">
                        <div>Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div className="text-emerald-700 font-semibold mt-0.5">RBI & Sovereign Compliant</div>
                      </div>
                    </div>
                  </div>

                  {/* 1. Metric Cards Component */}
                  <MetricCards result={result} />

                  {/* Smart Scheme Comparison & Recommendation Engine */}
                  {result.comparison && (
                    <Comparison
                      comparison={result.comparison}
                      userAge={formMeta?.age}
                      userGender={formMeta?.gender}
                    />
                  )}

                  {/* 2. DICGC Alert & Auto-Splitter Component */}
                  <DicgcAlert
                    dicgcData={result.dicgc_analysis}
                    principal={result.principal}
                  />

                  {/* Quick Action Bar: Break vs Loan Strategy Engine */}
                  {formMeta?.category === 'BANK_FD' && formMeta?.calculationMode !== 'LADDER' && (
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-900/90 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 print-hide">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                          <Scale className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Emergency Liquidity Strategy Analyzer</h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Compare premature liquidation penalty vs borrowing at base rate + 1.00% via overdraft loan.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsBreakLoanModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-950/40 flex items-center gap-2 self-start sm:self-center transition-all active:scale-95 whitespace-nowrap"
                      >
                        <Scale className="w-4 h-4" />
                        <span>Break FD vs. Loan Analyzer</span>
                      </button>
                    </div>
                  )}

                  {/* 3. 5-Year Ladder Staircase View (If Ladder Mode) */}
                  {result.calculation_mode === 'LADDER' && result.ladder_schedule && (
                    <LadderView
                      ladderSchedule={result.ladder_schedule}
                      blendedRate={result.applicable_interest_rate}
                      totalPrincipal={result.principal}
                      totalMaturity={result.maturity_amount}
                    />
                  )}

                  {/* 4. Visual Growth Charts (Donut + Wealth Area Chart) */}
                  <GrowthCharts result={result} />

                  {/* 5. Tax Breakdown & Inflation-Adjusted Real Returns */}
                  <TaxBreakdownCard result={result} />

                  {/* 6. 5-Bank Simultaneous Comparator (FD & RD only) */}
                  {result.bank_comparisons && result.bank_comparisons.length > 0 && (
                    <BankComparisonTable
                      comparisons={result.bank_comparisons}
                      selectedBank={formMeta?.selectedBank || 'SBI'}
                    />
                  )}

                  {/* 7. Year-by-Year Amortization Schedule Table */}
                  {result.schedule && result.schedule.length > 0 && (
                    <AmortizationTable
                      schedule={result.schedule}
                      schemeName={result.institution_or_scheme_name}
                      principal={result.principal}
                      maturityAmount={result.maturity_amount}
                    />
                  )}

                  {/* Interactive Break vs Loan Modal */}
                  <BreakVsLoanModal
                    isOpen={isBreakLoanModalOpen}
                    onClose={() => setIsBreakLoanModalOpen(false)}
                    principal={result.principal}
                    contractedRate={result.applicable_interest_rate}
                    totalTenureMonths={result.total_tenure_months || 12}
                    age={formMeta?.age || 35}
                    selectedBank={formMeta?.selectedBank || 'SBI'}
                  />
                </div>
              ) : (
                // Clean Onboarding Empty State
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                  <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 shadow-inner">
                    <Coins className="w-8 h-8" />
                  </div>

                  <div className="max-w-md mx-auto space-y-2">
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      Ready to Calculate Wealth & Tax Impact
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Configure your investment parameters on the left to instantly compute RBI-compliant quarterly compounding, Section 194A TDS deductions, and compare yields across 5 major banks.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 max-w-lg mx-auto text-left text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                      <span className="font-bold text-emerald-400 block">DICGC Shield</span>
                      <span className="text-slate-400 text-[11px] block">
                        Guaranteed protection up to ₹5 Lakhs per bank.
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                      <span className="font-bold text-blue-400 block">Senior Privileges</span>
                      <span className="text-slate-400 text-[11px] block">
                        +0.50% Senior & +0.80% Super Senior boosters.
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                      <span className="font-bold text-teal-400 block">Sovereign Schemes</span>
                      <span className="text-slate-400 text-[11px] block">
                        100% Tax-Free PPF, SSY & high-yield SCSS/POMIS.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
