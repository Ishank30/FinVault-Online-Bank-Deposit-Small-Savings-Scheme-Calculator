import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Coins,
  Info,
  Calendar,
  User,
  Percent,
  Award,
  Sparkles,
  RefreshCw,
  Lock,
  ArrowRight,
  Landmark,
  Scale,
  FileCheck,
  Split,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
  Target
} from 'lucide-react';

import MetricCards from './MetricCards';
import DicgcAlert from './DicgcAlert';
import TaxBreakdownCard from './TaxBreakdownCard';
import BankComparisonTable from './BankComparisonTable';
import BreakVsLoanModal from './BreakVsLoanModal';
import { getSchemeRule, formatAmountLimitLabel } from '../utils/schemeRules';
import { computeBestYieldBank } from '../utils/bankRates';
import { formatIndianCurrencyWords } from '../utils/currencyUtils';

import { API_BASE_URL } from '../api/config';
import { calculateInvestmentApi } from '../api/client';

// Pre-defined static rates & scheme metadata for instant reactive UI preview
const BANK_OPTIONS = [
  { id: 'SBI', name: 'State Bank of India', type: 'Public Sector', peakRate: '7.25%' },
  { id: 'PNB', name: 'Punjab National Bank', type: 'Public Sector', peakRate: '7.25%' },
  { id: 'BOB', name: 'Bank of Baroda', type: 'Public Sector', peakRate: '7.30%' },
  { id: 'HDFC', name: 'HDFC Bank', type: 'Private Sector', peakRate: '7.25%' },
  { id: 'ICICI', name: 'ICICI Bank', type: 'Private Sector', peakRate: '7.20%' },
];

const GOVT_SCHEMES = [
  {
    id: 'PPF',
    name: 'Public Provident Fund (PPF)',
    rate: '7.10%',
    tenure: '15 Years',
    tax: 'EEE (100% Tax-Free)',
    badge: 'Wealth Creation'
  },
  {
    id: 'SSY',
    name: 'Sukanya Samriddhi Yojana (SSY)',
    rate: '8.20%',
    tenure: '21 Years (15y deposit)',
    tax: 'EEE (100% Tax-Free)',
    badge: 'Girl Child Exclusive'
  },
  {
    id: 'SCSS',
    name: 'Senior Citizen Savings Scheme (SCSS)',
    rate: '8.20%',
    tenure: '5 Years',
    tax: 'Quarterly Payout (Sec 80C)',
    badge: 'Ages 60+ Only'
  },
  {
    id: 'POMIS',
    name: 'Post Office Monthly Income Scheme (POMIS)',
    rate: '7.40%',
    tenure: '5 Years',
    tax: 'Monthly Payout',
    badge: 'Steady Monthly Cashflow'
  },
  {
    id: 'NSC',
    name: 'National Savings Certificate (NSC)',
    rate: '7.70%',
    tenure: '5 Years',
    tax: 'Compounded (Sec 80C)',
    badge: 'Reinvestment Tax Benefit'
  },
];

const TAX_SLABS = [
  { label: '0% (Exempt / Nil)', value: 0.0 },
  { label: '5% (Basic Bracket)', value: 0.05 },
  { label: '10% (Middle Bracket)', value: 0.10 },
  { label: '15% (New Tax Regime)', value: 0.15 },
  { label: '20% (High Bracket)', value: 0.20 },
  { label: '30% (Peak Bracket)', value: 0.30 },
];

export const INITIAL_FORM_STATE = {
  calculationMode: 'STANDARD',
  investmentFrequency: 'LUMP_SUM',
  lumpSumSubtype: 'BANK_FD',
  category: 'BANK_FD',
  selectedBank: 'SBI',
  selectedScheme: 'PPF',
  amount: 10000,
  age: 35,
  gender: 'MALE',
  residentStatus: 'RESIDENT',
  accountType: 'SINGLE',
  tenureYears: 1,
  tenureMonths: 0,
  tenureDays: 0,
  payoutType: 'CUMULATIVE',
  taxSlab: 0.20,
  hasForm15G15H: false,
  inflationRate: 0.06,
};

export default function CalculatorForm({
  onCalculationResult,
  onCalculationStart,
  onError,
  hideInlineOutput = false,
  onSwitchToGoalPlanner
}) {
  // --------------------------------------------------------------------------
  // Dynamic Form State & Controlled Input Model
  // --------------------------------------------------------------------------
  const [formData, setFormData] = useState({ ...INITIAL_FORM_STATE });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [result, setResult] = useState(null);
  const [isBreakLoanModalOpen, setIsBreakLoanModalOpen] = useState(false);
  const [isTaxAdvancedOpen, setIsTaxAdvancedOpen] = useState(false);

  // --------------------------------------------------------------------------
  // Offline LocalStorage State Preservation
  // --------------------------------------------------------------------------
  useEffect(() => {
    try {
      const cached = localStorage.getItem('finvault_form_state');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          setFormData((prev) => ({
            ...prev,
            ...parsed
          }));
        }
      }
    } catch (err) {
      console.warn('Failed to load saved state from localStorage:', err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('finvault_form_state', JSON.stringify(formData));
    } catch (err) {
      console.warn('Failed to save state to localStorage:', err);
    }
  }, [formData]);

  const {
    calculationMode,
    investmentFrequency = 'LUMP_SUM',
    lumpSumSubtype = 'BANK_FD',
    category,
    selectedBank,
    selectedScheme,
    amount,
    age,
    gender,
    residentStatus,
    accountType,
    tenureYears,
    tenureMonths,
    tenureDays,
    payoutType,
    taxSlab,
    hasForm15G15H,
    inflationRate,
  } = formData;

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  const handleReset = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      localStorage.removeItem('finvault_form_state');
    } catch (err) {
      console.warn('Failed to remove state from localStorage:', err);
    }
    setFormData({ ...INITIAL_FORM_STATE });
    setErrors({});
    setApiError(null);
    setResult(null);
    if (onError) onError(null);
  };

  const applyGovtSanitization = (schemeToApply, state) => {
    const numAmount = Number(state.amount) || 0;
    const numAge = Number(state.age) || 0;

    if (schemeToApply === 'PPF') {
      state.tenureYears = 15;
      state.tenureMonths = 0;
      state.tenureDays = 0;
      if (numAmount > 150000) state.amount = 150000;
    } else if (schemeToApply === 'SSY') {
      state.tenureYears = 21;
      state.tenureMonths = 0;
      state.tenureDays = 0;
      state.gender = 'FEMALE';
      if (numAge > 10) state.age = 7;
      if (numAmount > 150000) state.amount = 150000;
    } else if (schemeToApply === 'SCSS') {
      state.tenureYears = 5;
      state.tenureMonths = 0;
      state.tenureDays = 0;
      if (numAge < 60) state.age = 60;
      if (numAmount > 3000000) state.amount = 1000000;
    } else if (schemeToApply === 'POMIS') {
      state.tenureYears = 5;
      state.tenureMonths = 0;
      state.tenureDays = 0;
      const pomisCap = state.accountType === 'JOINT' ? 1500000 : 900000;
      if (numAmount > pomisCap) state.amount = pomisCap;
    } else if (schemeToApply === 'NSC') {
      state.tenureYears = 5;
      state.tenureMonths = 0;
      state.tenureDays = 0;
    }
  };

  const handleFrequencySwitch = (targetFrequency) => {
    setApiError(null);
    setErrors({});
    setFormData((prev) => {
      const next = { ...prev, investmentFrequency: targetFrequency };
      if (targetFrequency === 'LUMP_SUM') {
        if (next.lumpSumSubtype === 'BANK_FD') {
          next.category = 'BANK_FD';
          next.tenureYears = 1;
          next.tenureMonths = 0;
          next.tenureDays = 0;
        } else {
          next.category = 'GOVT_SCHEME';
          if (!['SCSS', 'POMIS', 'NSC'].includes(next.selectedScheme)) {
            next.selectedScheme = 'SCSS';
          }
          applyGovtSanitization(next.selectedScheme, next);
        }
      } else if (targetFrequency === 'MONTHLY') {
        next.category = 'BANK_RD';
        next.tenureYears = 1;
        next.tenureMonths = 0;
        next.tenureDays = 0;
      } else if (targetFrequency === 'YEARLY') {
        next.category = 'GOVT_SCHEME';
        if (!['PPF', 'SSY'].includes(next.selectedScheme)) {
          next.selectedScheme = 'PPF';
        }
        applyGovtSanitization(next.selectedScheme, next);
      }
      return next;
    });
  };

  const handleLumpSumSubtypeChange = (targetSubtype) => {
    setApiError(null);
    setErrors({});
    setFormData((prev) => {
      const next = { ...prev, lumpSumSubtype: targetSubtype };
      if (targetSubtype === 'BANK_FD') {
        next.category = 'BANK_FD';
        next.tenureYears = 1;
        next.tenureMonths = 0;
        next.tenureDays = 0;
      } else {
        next.category = 'GOVT_SCHEME';
        if (!['SCSS', 'POMIS', 'NSC'].includes(next.selectedScheme)) {
          next.selectedScheme = 'SCSS';
        }
        applyGovtSanitization(next.selectedScheme, next);
      }
      return next;
    });
  };

  const handleSchemeSwitch = (targetScheme) => {
    setApiError(null);
    setErrors({});
    setFormData((prev) => {
      const next = { ...prev, selectedScheme: targetScheme };
      applyGovtSanitization(targetScheme, next);
      return next;
    });
  };

  const handleCalculationModeChange = (mode) => {
    setFormData((prev) => {
      const next = { ...prev, calculationMode: mode };
      if (mode === 'LADDER') {
        next.investmentFrequency = 'LUMP_SUM';
        next.lumpSumSubtype = 'BANK_FD';
        next.category = 'BANK_FD';
        next.tenureYears = 5;
        next.tenureMonths = 0;
        next.tenureDays = 0;
        if (Number(next.amount) < 50000) next.amount = 50000;
      }
      return next;
    });
  };

  // Dynamic Tenure in Days for Real-Time Bank Rate Benchmarking
  const currentTotalDays = useMemo(() => {
    const y = Number(tenureYears) || 0;
    const m = Number(tenureMonths) || 0;
    const d = Number(tenureDays) || 0;
    return (y * 365) + (m * 30) + d;
  }, [tenureYears, tenureMonths, tenureDays]);

  // Compute Best Yielding Bank for Currently Configured Tenure & Age
  const bestBankYieldInfo = useMemo(() => {
    return computeBestYieldBank(currentTotalDays, Number(age) || 35);
  }, [currentTotalDays, age]);

  // Quick-Preset Amount Helpers
  const handleIncrementAmount = (delta, e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setFormData((prev) => {
      const current = Number(prev.amount) || 0;
      let next = current + delta;
      if (currentRule.maxAmount && next > currentRule.maxAmount) {
        next = currentRule.maxAmount;
      }
      return { ...prev, amount: next };
    });
  };

  const handleSetExactAmount = (exactValue, e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setFormData((prev) => {
      let next = exactValue;
      if (currentRule.maxAmount && next > currentRule.maxAmount) {
        next = currentRule.maxAmount;
      }
      return { ...prev, amount: next };
    });
  };

  const handleResetAmount = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setFormData((prev) => ({
      ...prev,
      amount: INITIAL_FORM_STATE.amount
    }));
  };

  const amountLabel = useMemo(() => {
    if (investmentFrequency === 'MONTHLY' || category === 'BANK_RD') {
      return 'Monthly Deposit Amount (₹)';
    }
    if (investmentFrequency === 'YEARLY' || (category === 'GOVT_SCHEME' && (selectedScheme === 'PPF' || selectedScheme === 'SSY'))) {
      return 'Annual Deposit Amount (₹) [Max ₹1,50,000]';
    }
    if (calculationMode === 'LADDER') {
      return 'Total Capital for 5-Year Ladder (₹)';
    }
    return 'Deposit Amount (₹)';
  }, [investmentFrequency, category, selectedScheme, calculationMode]);

  const isTenureLocked = category === 'GOVT_SCHEME' || calculationMode === 'LADDER';

  // --------------------------------------------------------------------------
  // Statutory Scheme Rule Resolution
  // --------------------------------------------------------------------------
  const currentRule = useMemo(() => {
    return getSchemeRule(category, selectedScheme, accountType);
  }, [category, selectedScheme, accountType]);

  // --------------------------------------------------------------------------
  // Client-Side Boundary Feedback
  // --------------------------------------------------------------------------
  const clientWarnings = useMemo(() => {
    const warnings = [];

    const isAmountEmpty = amount === '' || amount === null || amount === undefined;
    const numAmount = isAmountEmpty ? 0 : Number(amount);

    const isAgeEmpty = age === '' || age === null || age === undefined;
    const numAge = isAgeEmpty ? 0 : Number(age);

    const isYearsEmpty = tenureYears === '' || tenureYears === null || tenureYears === undefined;
    const numYears = isYearsEmpty ? 0 : Number(tenureYears);

    const isMonthsEmpty = tenureMonths === '' || tenureMonths === null || tenureMonths === undefined;
    const numMonths = isMonthsEmpty ? 0 : Number(tenureMonths);

    const isDaysEmpty = tenureDays === '' || tenureDays === null || tenureDays === undefined;
    const numDays = isDaysEmpty ? 0 : Number(tenureDays);

    // 1. Amount Validations based on Statutory Boundaries
    if (isAmountEmpty || isNaN(numAmount) || numAmount <= 0) {
      warnings.push({
        field: 'amount',
        text: 'Please enter a valid investment deposit amount greater than ₹0.',
        severity: 'error'
      });
    } else if (numAmount < currentRule.minAmount) {
      warnings.push({
        field: 'amount',
        text: `Statutory minimum for ${currentRule.name} is ₹${Number(currentRule.minAmount).toLocaleString('en-IN')}.`,
        severity: 'error'
      });
    } else if (currentRule.maxAmount !== null && currentRule.maxAmount !== undefined && numAmount > currentRule.maxAmount) {
      warnings.push({
        field: 'amount',
        text: `Statutory maximum cap for ${currentRule.name} is ₹${Number(currentRule.maxAmount).toLocaleString('en-IN')}.`,
        severity: 'error'
      });
    }

    if (calculationMode === 'LADDER' && numAmount < 50000) {
      warnings.push({
        field: 'amount',
        text: 'Recommended minimum capital for a 5-Year FD Ladder is ₹50,000 (₹10,000 per tranche).',
        severity: 'error'
      });
    }

    if (category === 'BANK_FD' && numAmount > 500000) {
      warnings.push({
        field: 'amount',
        text: 'Principal exceeds the DICGC ₹5,00,000 insurance limit. Use the Auto-Splitter to diversify safely.',
        severity: 'info'
      });
    }

    // 2. Beneficiary Age Validations
    if (isAgeEmpty || isNaN(numAge) || numAge < 0) {
      warnings.push({
        field: 'age',
        text: 'Please enter a valid age (0 years or older).',
        severity: 'error'
      });
    }

    // SCSS strictly requires 60+
    if (category === 'GOVT_SCHEME' && selectedScheme === 'SCSS' && numAge < 60) {
      warnings.push({
        field: 'age',
        text: 'Senior Citizen Savings Scheme (SCSS) requires age 60 or above.',
        severity: 'error'
      });
    }

    // SSY strictly requires girl child <= 10
    if (category === 'GOVT_SCHEME' && selectedScheme === 'SSY' && numAge > 10) {
      warnings.push({
        field: 'age',
        text: `Sukanya Samriddhi Yojana (SSY) can only be opened for a girl child up to 10 years of age. Current age: ${numAge}.`,
        severity: 'error'
      });
    }

    // POMIS requires age >= 10 for self-operated account
    if (category === 'GOVT_SCHEME' && selectedScheme === 'POMIS' && numAge < 10) {
      warnings.push({
        field: 'age',
        text: 'Post Office Monthly Income Scheme (POMIS) requires the account holder to be at least 10 years of age.',
        severity: 'error'
      });
    }

    // 3. Gender Validations (SSY strictly requires FEMALE)
    if (category === 'GOVT_SCHEME' && selectedScheme === 'SSY' && gender !== 'FEMALE') {
      warnings.push({
        field: 'gender',
        text: 'Sukanya Samriddhi Yojana (SSY) is strictly restricted to girl child beneficiaries (Gender must be Female).',
        severity: 'error'
      });
    }

    // 4. Tenure Validations
    const totalDays = (numYears * 365) + (numMonths * 30) + numDays;
    if (category === 'BANK_FD' && calculationMode !== 'LADDER' && totalDays < 7) {
      warnings.push({
        field: 'tenure',
        text: 'Bank Fixed Deposit requires a minimum tenure of 7 days.',
        severity: 'error'
      });
    }

    if (category === 'BANK_RD') {
      const totalMonths = (numYears * 12) + numMonths + Math.floor(numDays / 30);
      if (totalMonths < 6) {
        warnings.push({
          field: 'tenure',
          text: 'Recurring Deposit (RD) requires a minimum tenure of 6 months.',
          severity: 'error'
        });
      }
    }

    // 5. Resident Status
    if (category === 'GOVT_SCHEME' && (residentStatus === 'NRI_NRE' || residentStatus === 'NRI_NRO')) {
      warnings.push({
        field: 'residentStatus',
        text: 'Non-Resident Indians (NRIs) are prohibited from opening fresh Government Small Savings accounts under statutory rules.',
        severity: 'error'
      });
    }

    return warnings;
  }, [category, selectedScheme, age, gender, amount, accountType, residentStatus, calculationMode, tenureYears, tenureMonths, tenureDays, currentRule]);

  const hasBlockingErrors = clientWarnings.some(w => w.severity === 'error');
  const getFieldWarning = (fieldName) => clientWarnings.find(w => w.field === fieldName);

  // --------------------------------------------------------------------------
  // Form Submission & API Pipeline
  // --------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (hasBlockingErrors) {
      setApiError({
        title: 'Statutory Guardrail Constraint',
        message: 'Please resolve statutory guardrail errors highlighted above before calculating.'
      });
      return;
    }

    setLoading(true);
    setApiError(null);
    if (onCalculationStart) onCalculationStart();

    const cleanAge = (age === '' || age === null || age === undefined) ? 0 : parseInt(age, 10);
    const cleanAmount = (amount === '' || amount === null || amount === undefined) ? 0 : parseFloat(amount);
    const cleanYears = (tenureYears === '' || tenureYears === null || tenureYears === undefined) ? 0 : parseInt(tenureYears, 10);
    const cleanMonths = (tenureMonths === '' || tenureMonths === null || tenureMonths === undefined) ? 0 : parseInt(tenureMonths, 10);
    const cleanDays = (tenureDays === '' || tenureDays === null || tenureDays === undefined) ? 0 : parseInt(tenureDays, 10);
    const cleanTaxSlab = (taxSlab === '' || taxSlab === null || taxSlab === undefined) ? 0.0 : parseFloat(taxSlab);
    const cleanInflation = (inflationRate === '' || inflationRate === null || inflationRate === undefined) ? 0.06 : parseFloat(inflationRate);

    const payload = {
      age: cleanAge,
      amount: cleanAmount,
      tenure_years: cleanYears,
      tenure_months: cleanMonths,
      tenure_days: cleanDays,
      category,
      investment_frequency: investmentFrequency,
      selected_bank: category !== 'GOVT_SCHEME' ? selectedBank : null,
      selected_scheme: category === 'GOVT_SCHEME' ? selectedScheme : null,
      calculation_mode: calculationMode,
      payout_type: payoutType,
      resident_status: residentStatus,
      gender,
      account_type: accountType,
      tax_slab: cleanTaxSlab,
      has_form_15g_15h: Boolean(hasForm15G15H),
      inflation_rate: cleanInflation
    };

    try {
      const data = await calculateInvestmentApi(payload);

      setResult(data);
      if (onCalculationResult) {
        onCalculationResult(data, {
          category,
          investmentFrequency,
          selectedBank,
          selectedScheme,
          age: parseInt(age, 10),
          gender,
          taxSlab: parseFloat(taxSlab),
          calculationMode,
          amount: parseFloat(amount)
        });
      }
    } catch (err) {
      console.error('Calculation API request failed:', err);

      let errorObj;
      if (err.statusCode === 422 || err.status === 422 || err.type === 'VALIDATION_ERROR') {
        errorObj = {
          title: 'Regulatory / Guardrail Validation Error',
          message: err.message
        };
      } else if (err.statusCode >= 500 || err.status >= 500 || err.type === 'SERVER_ERROR') {
        errorObj = {
          title: 'Internal Server Error',
          message: err.message
        };
      } else if (err.name === 'TypeError' || (err.message && err.message.toLowerCase().includes('fetch'))) {
        const isLocal = typeof window !== "undefined" && 
          (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
        const errorMsg = isLocal
          ? `Cannot reach local backend on ${API_BASE_URL}. Ensure uvicorn is running.`
          : `Cannot reach backend service at ${API_BASE_URL}. If waking from idle on free cloud, please wait ~30 seconds and retry.`;
        errorObj = {
          title: 'Backend Server Unreachable',
          message: errorMsg
        };
      } else {
        errorObj = {
          title: 'Calculation Request Failed',
          message: err.message || 'An unexpected error occurred while communicating with the backend.'
        };
      }

      setApiError(errorObj);
      if (onError) onError(errorObj.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 font-sans pb-20 lg:pb-0">
      {/* -------------------------------------------------------------------- */}
      {/* Header Banner & Mode Selector */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Phase 1 to 4 Complete
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                RBI & Small Savings Compliant
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <Landmark className="w-8 h-8 text-emerald-400" />
              Indian Deposit & Sovereign Schemes Calculator
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Multi-tier bank slabs, Section 194A TDS, DICGC Auto-Splitter, 5-Bank Comparison, and Liquidity Analyzer.
            </p>
          </div>

          {/* Mode Toggle Switch & Reset to Defaults */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-800/90 p-1.5 rounded-xl border border-slate-700/80 inline-flex self-start md:self-center shadow-inner">
              <button
                type="button"
                onClick={() => handleCalculationModeChange('STANDARD')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  calculationMode === 'STANDARD'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Coins className="w-4 h-4" />
                Standard Calculation
              </button>
              <button
                type="button"
                onClick={() => handleCalculationModeChange('LADDER')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  calculationMode === 'LADDER'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Split className="w-4 h-4" />
                5-Year FD Ladder
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 transition-all shadow-sm active:scale-95"
              title="Reset all inputs, tenure, and errors to initial recommended defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset to Defaults</span>
            </button>
          </div>
        </div>

        {calculationMode === 'LADDER' && (
          <div className="mt-4 p-3.5 bg-indigo-950/60 border border-indigo-800/60 rounded-xl text-xs text-indigo-300 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>
              <strong>5-Year FD Ladder Strategy Activated:</strong> Your capital is partitioned into 5 equal 20% tranches (1y, 2y, 3y, 4y, 5y) to ensure staggered liquidity every 12 months with minimal reinvestment friction.
            </span>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Primary Category Selector Cards (Investment Frequency) */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: One-Time (Lump Sum) */}
        <button
          type="button"
          onClick={() => handleFrequencySwitch('LUMP_SUM')}
          className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-center justify-between ${
            investmentFrequency === 'LUMP_SUM'
              ? 'bg-slate-800 border-emerald-500/80 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500/50'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-800/40'
          }`}
        >
          <div className="pr-2">
            <div className="flex items-center gap-2">
              <Coins className={`w-5 h-5 ${investmentFrequency === 'LUMP_SUM' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className={`font-semibold text-sm sm:text-base ${investmentFrequency === 'LUMP_SUM' ? 'text-white' : 'text-slate-300'}`}>
                One-Time (Lump Sum)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Bank FD, SCSS, POMIS, NSC • High single deposit yields
            </p>
          </div>
          {investmentFrequency === 'LUMP_SUM' && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm flex-shrink-0" />
          )}
        </button>

        {/* Card 2: Monthly (Recurring) */}
        <button
          type="button"
          disabled={calculationMode === 'LADDER'}
          onClick={() => handleFrequencySwitch('MONTHLY')}
          className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-center justify-between ${
            calculationMode === 'LADDER'
              ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800'
              : investmentFrequency === 'MONTHLY'
              ? 'bg-slate-800 border-emerald-500/80 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500/50'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-800/40'
          }`}
        >
          <div className="pr-2">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-5 h-5 ${investmentFrequency === 'MONTHLY' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className={`font-semibold text-sm sm:text-base ${investmentFrequency === 'MONTHLY' ? 'text-white' : 'text-slate-300'}`}>
                Monthly (Recurring)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Bank RD, Post Office RD • Systematic monthly savings
            </p>
          </div>
          {investmentFrequency === 'MONTHLY' && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm flex-shrink-0" />
          )}
        </button>

        {/* Card 3: Yearly / Flexible */}
        <button
          type="button"
          disabled={calculationMode === 'LADDER'}
          onClick={() => handleFrequencySwitch('YEARLY')}
          className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-center justify-between ${
            calculationMode === 'LADDER'
              ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800'
              : investmentFrequency === 'YEARLY'
              ? 'bg-slate-800 border-indigo-500/80 shadow-lg shadow-indigo-950/20 ring-1 ring-indigo-500/50'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-800/40'
          }`}
        >
          <div className="pr-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 ${investmentFrequency === 'YEARLY' ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span className={`font-semibold text-sm sm:text-base ${investmentFrequency === 'YEARLY' ? 'text-white' : 'text-slate-300'}`}>
                Yearly / Flexible
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              PPF, Sukanya Samriddhi (SSY) • Sovereign tax-exempt wealth
            </p>
          </div>
          {investmentFrequency === 'YEARLY' && (
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-sm flex-shrink-0" />
          )}
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Main Interactive Form */}
      {/* -------------------------------------------------------------------- */}
      <form onSubmit={handleSubmit} noValidate className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-xl">
        {/* ================================================================== */}
        {/* Progressive Secondary Selector                                     */}
        {/* ================================================================== */}
        {investmentFrequency === 'LUMP_SUM' && (
          <div className="space-y-4">
            {/* Toggle: [ Commercial Bank FD ] | [ Government Schemes (SCSS / POMIS / NSC) ] */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-2 px-3 py-1 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Select Product Class</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleLumpSumSubtypeChange('BANK_FD')}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    lumpSumSubtype === 'BANK_FD'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Commercial Bank FD</span>
                </button>
                <button
                  type="button"
                  disabled={calculationMode === 'LADDER'}
                  onClick={() => handleLumpSumSubtypeChange('GOVT_SCHEMES')}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    calculationMode === 'LADDER'
                      ? 'opacity-40 cursor-not-allowed text-slate-500'
                      : lumpSumSubtype === 'GOVT_SCHEMES'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40 ring-1 ring-indigo-400/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Government Schemes (SCSS / POMIS / NSC)</span>
                </button>
              </div>
            </div>

            {/* If Commercial Bank FD is selected */}
            {lumpSumSubtype === 'BANK_FD' ? (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    Select Scheduled Commercial Bank
                  </span>
                  <span className="text-xs text-slate-500">RBI Regulated Banks</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {BANK_OPTIONS.map((bank) => {
                    const bankRateForTenure = bestBankYieldInfo.rates[bank.id];
                    const isBestYield = bestBankYieldInfo.bestBank === bank.id;

                    return (
                      <button
                        key={bank.id}
                        type="button"
                        onClick={() => updateField('selectedBank', bank.id)}
                        className={`p-3.5 rounded-xl border text-center transition-all relative group ${
                          selectedBank === bank.id
                            ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30'
                            : isBestYield
                            ? 'bg-slate-800/80 border-emerald-500/50 text-slate-300 hover:border-emerald-400'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                        }`}
                      >
                        {isBestYield && (
                          <span className="absolute -top-2.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/30 ring-1 ring-white/30 flex items-center gap-1 animate-pulse">
                            <Sparkles className="w-2.5 h-2.5 text-slate-950" />
                            Best Yield
                          </span>
                        )}
                        <div className="font-bold text-base text-white">{bank.id}</div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{bank.name}</div>
                        <div className="text-[11px] font-bold text-emerald-400 mt-1.5 flex items-center justify-center gap-1">
                          <span>{bankRateForTenure?.toFixed(2)}%</span>
                          <span className="text-[9px] text-slate-400 font-normal">p.a.</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* If Government Schemes (SCSS / POMIS / NSC) is selected */
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    Select Sovereign One-Time Scheme (SCSS / POMIS / NSC)
                  </span>
                  <span className="text-xs text-indigo-400 font-medium">100% Sovereign Backed</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {GOVT_SCHEMES.filter(s => ['SCSS', 'POMIS', 'NSC'].includes(s.id)).map((scheme) => (
                    <button
                      key={scheme.id}
                      type="button"
                      onClick={() => handleSchemeSwitch(scheme.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        selectedScheme === scheme.id
                          ? 'bg-indigo-950/40 border-indigo-500 text-white ring-2 ring-indigo-500/30'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base text-white">{scheme.id}</span>
                        <span className="text-xs font-bold text-indigo-400 bg-indigo-900/50 px-2 py-0.5 rounded">
                          {scheme.rate}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 font-medium mt-1 truncate">{scheme.name}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{scheme.tenure}</div>
                      <div className="text-[10px] text-emerald-400 font-medium mt-1">{scheme.tax}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* When Monthly is active */}
        {investmentFrequency === 'MONTHLY' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                Select Scheduled Commercial Bank for Recurring Deposit (RD)
              </span>
              <span className="text-xs text-slate-500">RBI Regulated Banks</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {BANK_OPTIONS.map((bank) => {
                const bankRateForTenure = bestBankYieldInfo.rates[bank.id];
                const isBestYield = bestBankYieldInfo.bestBank === bank.id;

                return (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => updateField('selectedBank', bank.id)}
                    className={`p-3.5 rounded-xl border text-center transition-all relative group ${
                      selectedBank === bank.id
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30'
                        : isBestYield
                        ? 'bg-slate-800/80 border-emerald-500/50 text-slate-300 hover:border-emerald-400'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    {isBestYield && (
                      <span className="absolute -top-2.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/30 ring-1 ring-white/30 flex items-center gap-1 animate-pulse">
                        <Sparkles className="w-2.5 h-2.5 text-slate-950" />
                        Best Yield
                      </span>
                    )}
                    <div className="font-bold text-base text-white">{bank.id}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{bank.name}</div>
                    <div className="text-[11px] font-bold text-emerald-400 mt-1.5 flex items-center justify-center gap-1">
                      <span>{bankRateForTenure?.toFixed(2)}%</span>
                      <span className="text-[9px] text-slate-400 font-normal">p.a.</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* When Yearly is active */}
        {investmentFrequency === 'YEARLY' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Select Sovereign Annual Small Savings Scheme (PPF / SSY)
              </span>
              <span className="text-xs text-indigo-400 font-medium">100% Sovereign Backed • EEE Tax Status</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GOVT_SCHEMES.filter(s => ['PPF', 'SSY'].includes(s.id)).map((scheme) => (
                <button
                  key={scheme.id}
                  type="button"
                  onClick={() => handleSchemeSwitch(scheme.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedScheme === scheme.id
                      ? 'bg-indigo-950/40 border-indigo-500 text-white ring-2 ring-indigo-500/30'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg text-white">{scheme.id}</span>
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-900/50 px-2.5 py-1 rounded">
                      {scheme.rate}
                    </span>
                  </div>
                  <div className="text-sm text-slate-200 font-medium mt-1.5 truncate">{scheme.name}</div>
                  <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-700/60">
                    <span className="text-slate-400">{scheme.tenure}</span>
                    <span className="text-emerald-400 font-semibold">{scheme.tax}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Amount, Age, Gender Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-400" />
                {amountLabel}
              </label>
              <span className="text-xs text-slate-400 font-mono">
                ₹{Number(amount === '' || amount === null || amount === undefined ? 0 : amount).toLocaleString('en-IN')}
              </span>
            </div>
            <input
              type="number"
              min={currentRule.minAmount}
              max={currentRule.maxAmount ?? undefined}
              step="any"
              value={formData.amount ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                updateField('amount', val === '' ? '' : Number(val));
              }}
              placeholder={`Min ₹${Number(currentRule.minAmount).toLocaleString('en-IN')}`}
              className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white font-mono text-base focus:outline-none transition-all ${
                getFieldWarning('amount')?.severity === 'error'
                  ? 'border-red-500 ring-1 ring-red-500 focus:border-red-400'
                  : 'border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
              }`}
            />

            {/* Real-Time Rupee Word Conversion Subtext */}
            {formatIndianCurrencyWords(formData.amount) && (
              <div className="text-xs font-semibold text-emerald-400 font-mono flex items-center gap-1.5 pt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{formatIndianCurrencyWords(formData.amount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span>{formatAmountLimitLabel(currentRule)}</span>
            </div>

            {/* Tactile Quick-Amount Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={(e) => handleIncrementAmount(10000, e)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700/80 hover:border-emerald-500/50 transition-all duration-150 active:scale-95 shadow-sm"
              >
                + ₹10k
              </button>
              <button
                type="button"
                onClick={(e) => handleIncrementAmount(50000, e)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700/80 hover:border-emerald-500/50 transition-all duration-150 active:scale-95 shadow-sm"
              >
                + ₹50k
              </button>
              <button
                type="button"
                onClick={(e) => handleIncrementAmount(100000, e)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700/80 hover:border-emerald-500/50 transition-all duration-150 active:scale-95 shadow-sm"
              >
                + ₹1 Lakh
              </button>
              <button
                type="button"
                onClick={(e) => handleSetExactAmount(150000, e)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 hover:text-indigo-200 border border-indigo-700/60 hover:border-indigo-500/50 transition-all duration-150 active:scale-95 shadow-sm"
              >
                Max 80C (₹1.5L)
              </button>
              <button
                type="button"
                onClick={(e) => handleSetExactAmount(500000, e)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 hover:text-emerald-200 border border-emerald-700/60 hover:border-emerald-500/50 transition-all duration-150 active:scale-95 shadow-sm"
              >
                DICGC Cap (₹5L)
              </button>
              <button
                type="button"
                onClick={handleResetAmount}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800/50 hover:bg-slate-700/70 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-500/40 transition-all duration-150 active:scale-95"
                title="Reset deposit amount to default"
              >
                Reset
              </button>
            </div>

            {getFieldWarning('amount') && (
              <p className={`text-xs mt-1.5 flex items-start gap-1 ${
                getFieldWarning('amount').severity === 'error' ? 'text-red-400' : 'text-amber-400'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{getFieldWarning('amount').text}</span>
              </p>
            )}
          </div>

          {/* Age */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-400" />
                Investor / Beneficiary Age
              </label>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {Number(age) >= 80 ? 'Super Senior (80+)' : Number(age) >= 60 ? 'Senior (60-79)' : 'Regular (<60)'}
              </span>
            </div>
            <input
              type="number"
              min={currentRule.minAge}
              max={currentRule.maxAge ?? undefined}
              step="any"
              value={formData.age ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                updateField('age', val === '' ? '' : parseInt(val, 10));
              }}
              placeholder="Enter age in years"
              className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white font-mono text-base focus:outline-none transition-all ${
                getFieldWarning('age')?.severity === 'error'
                  ? 'border-red-500 ring-1 ring-red-500 focus:border-red-400'
                  : 'border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
              }`}
            />
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Info className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span>{currentRule.ageHint}</span>
            </div>
            {getFieldWarning('age') && (
              <p className="text-xs text-red-400 mt-1.5 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{getFieldWarning('age').text}</span>
              </p>
            )}
          </div>

          {/* Gender */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-400" />
                Gender of Beneficiary
              </label>
              {selectedScheme === 'SSY' && category === 'GOVT_SCHEME' && (
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Statutory: Female
                </span>
              )}
            </div>
            <select
              value={formData.gender ?? ''}
              onChange={(e) => updateField('gender', e.target.value)}
              className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-all ${
                getFieldWarning('gender')?.severity === 'error'
                  ? 'border-red-500 ring-1 ring-red-500'
                  : 'border-slate-700 focus:border-emerald-500'
              }`}
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female (Required for SSY)</option>
              <option value="OTHER">Other</option>
            </select>
            {getFieldWarning('gender') && (
              <p className="text-xs text-red-400 mt-1.5 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{getFieldWarning('gender').text}</span>
              </p>
            )}
          </div>
        </div>

        {/* Tenure Section */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Investment Tenure Specification</span>
              {isTenureLocked && (
                <span className="flex items-center gap-1 text-[11px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> Statutory Fixed Lock-in
                </span>
              )}
            </div>
            {category === 'BANK_FD' && calculationMode !== 'LADDER' && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">Popular Slabs:</span>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tenureYears: 0, tenureMonths: 0, tenureDays: 444 }))}
                  className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-emerald-300 rounded text-[11px]"
                >
                  444d (Amrit Vrishti)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tenureYears: 1, tenureMonths: 0, tenureDays: 0 }))}
                  className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[11px]"
                >
                  1 Year
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tenureYears: 3, tenureMonths: 0, tenureDays: 0 }))}
                  className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[11px]"
                >
                  3 Years
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tenureYears: 5, tenureMonths: 0, tenureDays: 0 }))}
                  className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[11px]"
                >
                  5 Years
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Years</label>
              <input
                type="number"
                min="0"
                max="25"
                step="any"
                disabled={isTenureLocked}
                value={formData.tenureYears ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateField('tenureYears', val === '' ? '' : Math.max(0, parseInt(val, 10)));
                }}
                className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-white font-mono text-sm ${
                  isTenureLocked
                    ? 'opacity-60 cursor-not-allowed border-slate-700 bg-slate-900/80 text-slate-400'
                    : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Months</label>
              <input
                type="number"
                min="0"
                max="11"
                step="any"
                disabled={isTenureLocked}
                value={formData.tenureMonths ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateField('tenureMonths', val === '' ? '' : Math.max(0, Math.min(11, parseInt(val, 10))));
                }}
                className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-white font-mono text-sm ${
                  isTenureLocked
                    ? 'opacity-60 cursor-not-allowed border-slate-700 bg-slate-900/80 text-slate-400'
                    : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Days</label>
              <input
                type="number"
                min="0"
                max="3653"
                step="any"
                disabled={isTenureLocked}
                value={formData.tenureDays ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateField('tenureDays', val === '' ? '' : Math.max(0, parseInt(val, 10)));
                }}
                className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-white font-mono text-sm ${
                  isTenureLocked
                    ? 'opacity-60 cursor-not-allowed border-slate-700 bg-slate-900/80 text-slate-400'
                    : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          {getFieldWarning('tenure') && (
            <p className="text-xs text-red-400 mt-2 flex items-start gap-1">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{getFieldWarning('tenure').text}</span>
            </p>
          )}
        </div>

        {/* ================================================================== */}
        {/* Progressive Disclosure: Collapsible Tax & Advanced Options Accordion */}
        {/* ================================================================== */}
        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setIsTaxAdvancedOpen(!isTaxAdvancedOpen);
            }}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-sm font-semibold text-white block">Tax & Advanced Options</span>
                <span className="text-[11px] text-slate-400 block -mt-0.5">
                  Income Tax Bracket ({(Number(taxSlab || 0) * 100).toFixed(0)}%), Form 15G/15H, Residency, Payout & Inflation
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                {isTaxAdvancedOpen ? 'Collapse' : 'Expand Options'}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isTaxAdvancedOpen ? 'rotate-180 text-emerald-400' : ''}`} />
            </div>
          </button>

          {isTaxAdvancedOpen && (
            <div className="p-5 pt-3 border-t border-slate-800/80 space-y-5 animate-fade-in">
              {/* Modifiers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Compounding / Payout Frequency</label>
                  <select
                    value={formData.payoutType ?? ''}
                    disabled={category === 'GOVT_SCHEME'}
                    onChange={(e) => updateField('payoutType', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="CUMULATIVE">Cumulative (Compounded)</option>
                    <option value="MONTHLY">Monthly Income Payout</option>
                    <option value="QUARTERLY">Quarterly Income Payout</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Income Tax Bracket</span>
                    <Percent className="w-3.5 h-3.5 text-slate-400" />
                  </label>
                  <select
                    value={formData.taxSlab ?? ''}
                    onChange={(e) => updateField('taxSlab', Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    {TAX_SLABS.map(ts => (
                      <option key={ts.value} value={ts.value}>{ts.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Account Holding Mode</label>
                  <select
                    value={formData.accountType ?? ''}
                    onChange={(e) => updateField('accountType', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="SINGLE">Single Account</option>
                    <option value="JOINT">Joint Account (Max ₹15L POMIS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Residency Status</label>
                  <select
                    value={formData.residentStatus ?? ''}
                    onChange={(e) => updateField('residentStatus', e.target.value)}
                    className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none ${
                      getFieldWarning('residentStatus') ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-700 focus:border-emerald-500'
                    }`}
                  >
                    <option value="RESIDENT">Resident Indian</option>
                    <option value="NRI_NRE">NRI (NRE Account - Tax Exempt)</option>
                    <option value="NRI_NRO">NRI (NRO Account - 30% TDS)</option>
                  </select>
                </div>
              </div>

              {/* Form 15G/H & Inflation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.hasForm15G15H)}
                    onChange={(e) => updateField('hasForm15G15H', e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-300">
                    Submitted Form 15G / 15H (Zero TDS deduction on bank deposit)
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Assumed Inflation Rate:</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="0.15"
                    value={formData.inflationRate ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateField('inflationRate', val === '' ? '' : parseFloat(val));
                    }}
                    className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                  />
                  <span className="text-xs text-slate-400">
                    ({(((inflationRate === '' || inflationRate === null || inflationRate === undefined) ? 0 : inflationRate) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {apiError && (
          <div className="p-4 bg-red-950/60 border border-red-800/80 rounded-xl text-sm text-red-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-200">
                {typeof apiError === 'object' ? apiError.title : 'Calculation Error'}
              </p>
              <p className="text-xs text-red-300/90 mt-1 whitespace-pre-line leading-relaxed">
                {typeof apiError === 'object' ? apiError.message : apiError}
              </p>
            </div>
          </div>
        )}

        {/* Submit & Reset Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            disabled={loading || hasBlockingErrors}
            className={`w-full sm:flex-1 py-4 px-6 rounded-xl font-bold text-white text-base shadow-xl flex items-center justify-center gap-3 transition-all ${
              hasBlockingErrors
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : loading
                ? 'bg-emerald-700 opacity-80 cursor-wait'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-950/40 active:scale-[0.99]'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Computing Financial Output...</span>
              </>
            ) : (
              <>
                <span>Calculate Returns & Run Analytics</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="w-full sm:w-auto px-5 py-4 rounded-xl font-semibold text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition-all flex items-center justify-center gap-2 text-sm shadow-sm active:scale-95"
            title="Clear all errors and restore initial recommended defaults"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span>Reset to Defaults</span>
          </button>
        </div>

        {/* Mobile Sticky Bottom Action Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl flex items-center gap-3 print-hide">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || hasBlockingErrors}
            className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-white text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${
              hasBlockingErrors
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : loading
                ? 'bg-emerald-700 opacity-80 cursor-wait'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-950/40 active:scale-[0.99]'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Computing...</span>
              </>
            ) : (
              <>
                <Coins className="w-4 h-4" />
                <span>Calculate Returns</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* -------------------------------------------------------------------- */}
      {/* Complete Phase 1 - 5 Analytics Showcase */}
      {/* -------------------------------------------------------------------- */}
      {!hideInlineOutput && result && (
        <div className="space-y-8 animate-fade-in">
          {/* 1. Metric Cards Component */}
          <MetricCards result={result} />

          {/* 2. DICGC Alert & Auto-Splitter Component */}
          <DicgcAlert dicgcData={result.dicgc_analysis} principal={result.principal} />

          {/* Quick Action Bar: Break vs Loan Strategy Engine */}
          {category === 'BANK_FD' && calculationMode !== 'LADDER' && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-900/90 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-950/40 flex items-center gap-2 self-start sm:self-center transition-all active:scale-95"
              >
                <Scale className="w-4 h-4" />
                <span>Break FD vs. Loan Analyzer</span>
              </button>
            </div>
          )}

          {/* 3. Tax Breakdown & Real Purchasing Power Card */}
          <TaxBreakdownCard result={result} />

          {/* 4. 5-Bank Simultaneous Comparator (for Bank FD/RD) */}
          {result.bank_comparisons && result.bank_comparisons.length > 0 && (
            <BankComparisonTable
              comparisons={result.bank_comparisons}
              selectedBank={selectedBank}
            />
          )}

          {/* 5. 5-Year Ladder Table if Ladder Mode */}
          {result.calculation_mode === 'LADDER' && result.ladder_schedule && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Split className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">5-Year Staggered Maturity Schedule</h3>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="p-3.5">Tranche</th>
                      <th className="p-3.5">Tenure</th>
                      <th className="p-3.5">Principal</th>
                      <th className="p-3.5">Card Rate</th>
                      <th className="p-3.5">Interest Earned</th>
                      <th className="p-3.5">Maturity Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {result.ladder_schedule.map((tranche) => (
                      <tr key={tranche.tranche_number} className="hover:bg-slate-800/30">
                        <td className="p-3.5 font-semibold text-indigo-400">Tranche #{tranche.tranche_number}</td>
                        <td className="p-3.5 text-slate-200">{tranche.tenure_years} Year{tranche.tenure_years > 1 ? 's' : ''}</td>
                        <td className="p-3.5">₹{tranche.principal_allocated.toLocaleString('en-IN')}</td>
                        <td className="p-3.5 text-emerald-400 font-semibold">{tranche.interest_rate.toFixed(2)}%</td>
                        <td className="p-3.5 text-teal-400">+₹{tranche.interest_earned.toLocaleString('en-IN')}</td>
                        <td className="p-3.5 font-bold text-white">₹{tranche.maturity_amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Interactive Break FD vs Overdraft Loan Modal */}
          <BreakVsLoanModal
            isOpen={isBreakLoanModalOpen}
            onClose={() => setIsBreakLoanModalOpen(false)}
            principal={result.principal}
            contractedRate={result.applicable_interest_rate}
            totalTenureMonths={result.total_tenure_months || 12}
            age={age}
            selectedBank={selectedBank}
          />
        </div>
      )}
    </div>
  );
}
