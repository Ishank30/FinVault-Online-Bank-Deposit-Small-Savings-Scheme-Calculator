import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Quote
} from 'lucide-react';

import { API_BASE_URL } from '../api/config';

export default function AiExecutiveSummaryCard({ results, result, className = '' }) {
  // Support both 'results' and 'result' prop naming for total caller flexibility
  const data = results || result;

  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const fetchInsights = async (calcData) => {
    if (!calcData || typeof calcData !== 'object') {
      setSummary('');
      return;
    }

    setIsLoading(true);
    setHasError(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/generate-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ results: calcData })
      });

      if (!response.ok) {
        throw new Error(`AI Insights returned status ${response.status}`);
      }

      const resData = await response.json();
      const insightText = resData.summary || resData.insights || '';

      if (insightText && typeof insightText === 'string' && insightText.trim().length > 0) {
        setSummary(insightText.trim());
      } else {
        setSummary('');
      }
    } catch (err) {
      console.warn('AI Executive Summary notice (graceful silent fallback):', err);
      setHasError(true);
      setSummary('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (data) {
      fetchInsights(data);
    } else {
      setSummary('');
    }
  }, [
    data?.principal,
    data?.maturity_amount,
    data?.institution_or_scheme_name,
    data?.applicable_interest_rate,
    data?.net_post_tax_maturity
  ]);

  // If there is an error or no summary and not loading, gracefully render nothing
  if (!data || (!isLoading && !summary)) {
    return null;
  }

  return (
    <div
      className={`rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 p-6 sm:p-7 shadow-2xl relative overflow-hidden backdrop-blur-xl transition-all duration-300 ${className}`}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-indigo-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center justify-between gap-4 mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-teal-400/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shadow-md">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>✨ AI Advisory Takeaway</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Grounded commentary on post-tax yield & sovereign statutory benefits
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" />
            Verified Math
          </span>

          <button
            type="button"
            onClick={() => fetchInsights(data)}
            disabled={isLoading}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all active:scale-95 shadow-sm disabled:opacity-50"
            title="Refresh AI Insights"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Card Content or Loading Skeleton */}
      <div className="relative z-10">
        {isLoading ? (
          <div className="space-y-2.5 py-2 animate-pulse">
            <div className="h-4 bg-slate-800 rounded-lg w-full" />
            <div className="h-4 bg-slate-800 rounded-lg w-5/6" />
            <div className="h-4 bg-slate-800 rounded-lg w-2/3" />
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-slate-200 text-sm leading-relaxed relative shadow-inner">
            <Quote className="w-4 h-4 text-indigo-400/40 absolute top-3 left-3 pointer-events-none" />
            <p className="pl-4 font-normal text-slate-200">
              {summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
