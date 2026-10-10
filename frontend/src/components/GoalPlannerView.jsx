import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Coins,
  Calendar,
  Sparkles,
  Trophy,
  ArrowRight,
  Landmark,
  TrendingUp,
  Percent,
  CheckCircle2,
  RefreshCw,
  User,
  Sliders
} from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';
import { API_BASE_URL } from '../api/client';

// Helper function to convert numeric rupee amounts to Indian words
export function formatIndianCurrencyWords(num) {
  if (num === '' || num === null || num === undefined || isNaN(num)) return '';
  const n = Number(num);
  if (n <= 0) return '';
  if (n < 1000) return `₹${Math.round(n).toLocaleString('en-IN')}`;
  if (n < 100000) {
    const k = n / 1000;
    return `₹${k % 1 === 0 ? k : parseFloat(k.toFixed(2))} Thousand`;
  }
  if (n < 10000000) {
    const lakh = n / 100000;
    return `₹${lakh % 1 === 0 ? lakh : parseFloat(lakh.toFixed(2))} Lakh`;
  }
  const crore = n / 10000000;
  return `₹${crore % 1 === 0 ? crore : parseFloat(crore.toFixed(2))} Crore`;
}

export default function GoalPlannerView({ initialAge = 35 }) {
  const [targetAmount, setTargetAmount] = useState(1000000);
  const [tenureYears, setTenureYears] = useState(5);
  const [tenureMonths, setTenureMonths] = useState(0);
  const [age, setAge] = useState(initialAge);
  const [loading, setLoading] = useState(false);
  const [goalData, setGoalData] = useState(null);
  const [activePlanTab, setActivePlanTab] = useState('LUMP_SUM'); // 'LUMP_SUM' | 'MONTHLY'

  const fetchGoalPlan = async (target, years, months, userAge) => {
    if (!target || target <= 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/goal-planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_amount: Number(target),
          tenure_years: Number(years),
          tenure_months: Number(months),
          tenure_days: 0,
          age: Number(userAge)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setGoalData(data);
      }
    } catch (err) {
      console.warn('API error in goal planner, falling back to local computation:', err);
      // Deterministic client fallback calculation
      computeLocalGoalPlan(target, years, months, userAge);
    } finally {
      setLoading(false);
    }
  };

  // Deterministic client-side fallback if backend network is unreachable
  const computeLocalGoalPlan = (target, years, months, userAge) => {
    const totMonths = Math.max(6, (Number(years) * 12) + Number(months));
    const fracYears = totMonths / 12.0;
    const isSenior = Number(userAge) >= 60;
    const isSuperSenior = Number(userAge) >= 80;

    const banks = [
      { name: 'Bank of Baroda', code: 'BOB', baseRate: 7.15 },
      { name: 'State Bank of India', code: 'SBI', baseRate: 7.00 },
      { name: 'Punjab National Bank', code: 'PNB', baseRate: 7.00 },
      { name: 'HDFC Bank', code: 'HDFC', baseRate: 7.15 },
      { name: 'ICICI Bank', code: 'ICICI', baseRate: 7.00 },
      { name: 'Post Office Time Deposit / RD', code: 'POST_OFFICE', baseRate: 7.10 }
    ];

    const options = banks.map(b => {
      let r = b.baseRate;
      if (isSuperSenior) r += 0.80;
      else if (isSenior) r += 0.50;

      const lump = target / Math.pow(1.0 + (r / 400.0), fracYears * 4.0);
      let denom = 0;
      for (let k = 1; k <= totMonths; k++) {
        denom += Math.pow(1.0 + (r / 400.0), k / 3.0);
      }
      const monthly = target / (denom || 1);

      return {
        institution_or_scheme: b.name,
        scheme_code: b.code,
        category: b.code === 'POST_OFFICE' ? 'Post Office' : 'Commercial Bank',
        applicable_rate: Number(r.toFixed(2)),
        tenure_display: `${years}y ${months}m`,
        required_lump_sum: Math.round(lump),
        lump_sum_interest_earned: Math.round(target - lump),
        required_monthly_rd: Math.round(monthly),
        monthly_rd_total_invested: Math.round(monthly * totMonths),
        monthly_rd_interest_earned: Math.round(target - (monthly * totMonths)),
        is_best_lump_sum: false,
        is_best_monthly: false
      };
    });

    const bestLump = [...options].sort((a, b) => a.required_lump_sum - b.required_lump_sum)[0];
    bestLump.is_best_lump_sum = true;
    const bestMonthly = [...options].sort((a, b) => a.required_monthly_rd - b.required_monthly_rd)[0];
    bestMonthly.is_best_monthly = true;

    setGoalData({
      target_amount: target,
      tenure_display: `${years}y ${months}m`,
      total_months: totMonths,
      total_days: Math.round(fracYears * 365),
      fractional_years: fracYears,
      best_lump_sum_option: bestLump,
      best_monthly_option: bestMonthly,
      options
    });
  };

  useEffect(() => {
    fetchGoalPlan(targetAmount, tenureYears, tenureMonths, age);
  }, [targetAmount, tenureYears, tenureMonths, age]);

  const targetWords = formatIndianCurrencyWords(targetAmount);

  return (
    <div className="space-y-6">
      {/* Target Goal Input Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Reverse Financial Engineering
            </h3>
            <p className="text-xs text-slate-400">
              Calculate exact lump sum or monthly installment required today to achieve your goal.
            </p>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          {/* 1. Target Corpus Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-400" />
                Target Corpus Goal (INR)
              </label>
              <span className="font-mono text-emerald-400 font-bold">
                ₹{Number(targetAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                min="10000"
                step="any"
                value={targetAmount ?? ''}
                onChange={(e) => setTargetAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 1000000"
                className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-white font-mono text-base focus:outline-none transition-all"
              />
            </div>

            {/* Indian Currency Words Subtext */}
            {targetWords && (
              <div className="text-xs font-semibold text-emerald-400 font-mono flex items-center gap-1.5 pt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>{targetWords}</span>
              </div>
            )}

            {/* Quick-Target Preset Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
              {[
                { label: '₹5 Lakh', val: 500000 },
                { label: '₹10 Lakh', val: 1000000 },
                { label: '₹25 Lakh', val: 2500000 },
                { label: '₹50 Lakh', val: 5000000 },
                { label: '₹1 Crore', val: 10000000 }
              ].map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setTargetAmount(chip.val)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
                    targetAmount === chip.val
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-300 border-slate-700'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Target Tenure & Age */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Tenure (Years)</label>
              <input
                type="number"
                min="0"
                max="25"
                step="any"
                value={tenureYears ?? ''}
                onChange={(e) => setTenureYears(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Tenure (Months)</label>
              <input
                type="number"
                min="0"
                max="11"
                step="any"
                value={tenureMonths ?? ''}
                onChange={(e) => setTenureMonths(e.target.value === '' ? '' : Math.max(0, Math.min(11, parseInt(e.target.value, 10))))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Investor Age</label>
              <input
                type="number"
                min="0"
                max="120"
                step="any"
                value={age ?? ''}
                onChange={(e) => setAge(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Tenure Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {[
              { label: '1 Year', y: 1 },
              { label: '2 Years', y: 2 },
              { label: '3 Years', y: 3 },
              { label: '5 Years', y: 5 },
              { label: '10 Years', y: 10 }
            ].map(tc => (
              <button
                key={tc.label}
                type="button"
                onClick={() => { setTenureYears(tc.y); setTenureMonths(0); }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                  tenureYears === tc.y && tenureMonths === 0
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700/80 hover:text-slate-200'
                }`}
              >
                {tc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Goal Action Results Section */}
      {goalData && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Segmented Action Card: Lump Sum vs Monthly RD */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border-2 border-indigo-500/50 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/20">
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-indigo-400" />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-400 block">
                    Goal Achievement Blueprint
                  </span>
                  <h4 className="text-xl font-black text-white tracking-tight">
                    Required Capital for ₹{Number(goalData.target_amount).toLocaleString('en-IN')}
                  </h4>
                </div>
              </div>

              {/* Plan Mode Selector */}
              <div className="bg-slate-800/90 p-1 rounded-xl flex items-center border border-slate-700 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setActivePlanTab('LUMP_SUM')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activePlanTab === 'LUMP_SUM'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  One-Time Lump Sum
                </button>
                <button
                  type="button"
                  onClick={() => setActivePlanTab('MONTHLY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activePlanTab === 'MONTHLY'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly Installment
                </button>
              </div>
            </div>

            {/* Active Plan Recommendation Banner */}
            {activePlanTab === 'LUMP_SUM' && goalData.best_lump_sum_option && (
              <div className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">
                      Required Deposit Today
                    </span>
                    <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                      ₹{Number(goalData.best_lump_sum_option.required_lump_sum).toLocaleString('en-IN')}
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Best rate: {goalData.best_lump_sum_option.applicable_rate}% p.a.
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">
                      Pure Compounding Gain
                    </span>
                    <div className="text-2xl font-black text-indigo-400 font-mono mt-1">
                      +₹{Number(goalData.best_lump_sum_option.lump_sum_interest_earned).toLocaleString('en-IN')}
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Earned without lifting a finger
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">
                      Recommended Institution
                    </span>
                    <div className="text-base font-bold text-white mt-1 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{goalData.best_lump_sum_option.institution_or_scheme}</span>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-semibold mt-1 block">
                      Lowest upfront capital required
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pt-1">
                  💡 By depositing <strong className="text-emerald-400">₹{Number(goalData.best_lump_sum_option.required_lump_sum).toLocaleString('en-IN')}</strong> in {goalData.best_lump_sum_option.institution_or_scheme} today, quarterly compounding at {goalData.best_lump_sum_option.applicable_rate}% p.a. generates <strong className="text-indigo-400">₹{Number(goalData.best_lump_sum_option.lump_sum_interest_earned).toLocaleString('en-IN')}</strong> in pure interest over {goalData.tenure_display}, hitting your ₹{Number(goalData.target_amount).toLocaleString('en-IN')} target right on schedule.
                </p>
              </div>
            )}

            {activePlanTab === 'MONTHLY' && goalData.best_monthly_option && (
              <div className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">
                      Required Monthly Deposit
                    </span>
                    <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                      ₹{Number(goalData.best_monthly_option.required_monthly_rd).toLocaleString('en-IN')} <span className="text-xs text-slate-400">/mo</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      For {goalData.total_months} months
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">
                      Total Capital Invested
                    </span>
                    <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                      ₹{Number(goalData.best_monthly_option.monthly_rd_total_invested).toLocaleString('en-IN')}
                    </div>
                    <span className="text-[11px] text-teal-400 mt-1 block">
                      +₹{Number(goalData.best_monthly_option.monthly_rd_interest_earned).toLocaleString('en-IN')} interest earned
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">
                      Recommended RD Provider
                    </span>
                    <div className="text-base font-bold text-white mt-1 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{goalData.best_monthly_option.institution_or_scheme}</span>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-semibold mt-1 block">
                      Highest recurring card rate
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pt-1">
                  💡 A disciplined monthly contribution of <strong className="text-emerald-400">₹{Number(goalData.best_monthly_option.required_monthly_rd).toLocaleString('en-IN')}</strong> in {goalData.best_monthly_option.institution_or_scheme} accumulates your full target of ₹{Number(goalData.target_amount).toLocaleString('en-IN')} over {goalData.total_months} months, yielding <strong className="text-teal-400">₹{Number(goalData.best_monthly_option.monthly_rd_interest_earned).toLocaleString('en-IN')}</strong> in compounding returns.
                </p>
              </div>
            )}
          </div>

          {/* Institutional Comparison Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white">
                  Commercial Banks vs. Post Office Comparison
                </h4>
                <p className="text-xs text-slate-400">
                  Exact capital required across institutions to achieve your ₹{Number(goalData.target_amount).toLocaleString('en-IN')} goal.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-sans">
                    <th className="py-3 px-3">Institution / Scheme</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Card Rate</th>
                    <th className="py-3 px-3">Lump Sum Today</th>
                    <th className="py-3 px-3">Monthly RD</th>
                    <th className="py-3 px-3 text-right">Interest Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {goalData.options.map((opt) => (
                    <tr
                      key={opt.institution_or_scheme}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        (activePlanTab === 'LUMP_SUM' && opt.is_best_lump_sum) ||
                        (activePlanTab === 'MONTHLY' && opt.is_best_monthly)
                          ? 'bg-indigo-950/30'
                          : ''
                      }`}
                    >
                      <td className="py-3.5 px-3 font-medium text-white font-sans flex items-center gap-2">
                        <span>{opt.institution_or_scheme}</span>
                        {opt.is_best_lump_sum && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Best Lump Sum
                          </span>
                        )}
                        {opt.is_best_monthly && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Best Monthly
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-400 font-sans">
                        {opt.category}
                      </td>
                      <td className="py-3.5 px-3 text-amber-300 font-bold">
                        {opt.applicable_rate.toFixed(2)}%
                      </td>
                      <td className="py-3.5 px-3 text-emerald-400 font-bold">
                        ₹{Number(opt.required_lump_sum).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3 text-indigo-300 font-bold">
                        {opt.required_monthly_rd ? `₹${Number(opt.required_monthly_rd).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right text-teal-400 font-semibold">
                        +₹{Number(activePlanTab === 'LUMP_SUM' ? opt.lump_sum_interest_earned : opt.monthly_rd_interest_earned).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
