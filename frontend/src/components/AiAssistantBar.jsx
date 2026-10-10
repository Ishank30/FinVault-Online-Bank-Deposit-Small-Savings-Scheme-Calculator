import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  RefreshCw,
  AlertCircle,
  X,
  CheckCircle2,
  Lightbulb
} from 'lucide-react';

import { API_BASE_URL } from '../api/client';

const SAMPLE_PROMPTS = [
  {
    label: 'Girl Child SSY',
    icon: '👧',
    text: 'Save ₹50,000 yearly for my 5-year-old daughter'
  },
  {
    label: 'Senior Citizen SCSS',
    icon: '👴',
    text: 'Senior citizen aged 65 investing ₹15 Lakhs in SCSS'
  },
  {
    label: 'SBI 3-Yr FD',
    icon: '🏦',
    text: '₹5 Lakhs fixed deposit in SBI for 3 years'
  },
  {
    label: '5-Yr FD Ladder',
    icon: '🪜',
    text: '5-year FD ladder with ₹2.5 Lakhs capital'
  },
  {
    label: 'Tax-Free PPF',
    icon: '🛡️',
    text: 'Invest ₹1.5 Lakhs annually in PPF'
  }
];

export default function AiAssistantBar({ onFill, className = '' }) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  const handleSubmit = async (textToSubmit) => {
    const query = (typeof textToSubmit === 'string' ? textToSubmit : prompt).trim();
    if (!query) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/parse-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ prompt: query })
      });

      if (!response.ok) {
        throw new Error(`AI service returned status ${response.status}`);
      }

      const resData = await response.json();
      const extracted = resData.data || {};
      const keysFound = Object.keys(extracted).filter(k => extracted[k] !== undefined && extracted[k] !== null);

      if (keysFound.length === 0) {
        setErrorMessage('Could not extract parameters with high certainty. Try mentioning specific amounts (e.g. ₹50,000), schemes (SSY, PPF, SCSS), or tenure.');
      } else {
        if (typeof onFill === 'function') {
          onFill(extracted);
        }
        setSuccessInfo(`Applied ${keysFound.length} fields: ${keysFound.join(', ')}`);
        // Auto-dismiss success notification after 5 seconds
        setTimeout(() => setSuccessInfo(null), 5000);
      }
    } catch (err) {
      console.warn('AI Assistant intent parsing notice:', err);
      setErrorMessage('AI intent service temporarily unavailable. You can continue configuring the form manually.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChipClick = (sampleText) => {
    setPrompt(sampleText);
    handleSubmit(sampleText);
  };

  return (
    <div className={`bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-xl ${className}`}>
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Label */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm">
            <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              AI Natural Scenario Auto-Fill
            </span>
            <span className="hidden sm:inline text-[11px] text-slate-400 ml-2">
              Type freeform goals or click a scenario
            </span>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          Experimental
        </span>
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="relative flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. 'Save ₹50,000 yearly for my 5-year-old daughter' or '₹5 Lakhs FD in SBI for 3 years'"
            disabled={isLoading}
            className="w-full bg-slate-950/80 border border-slate-700/80 hover:border-indigo-500/50 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all pr-10 shadow-inner"
          />
          {prompt && (
            <button
              type="button"
              onClick={() => setPrompt('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="px-4 sm:px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-950/40 transition-all active:scale-95 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
          title="Auto-fill form with AI"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
              <span className="hidden sm:inline">Analyzing...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Auto-Fill</span>
            </>
          )}
        </button>
      </form>

      {/* Preset Chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-slate-800/80">
        <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
          <Lightbulb className="w-3 h-3 text-amber-400" /> Quick Scenarios:
        </span>
        {SAMPLE_PROMPTS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => handleChipClick(chip.text)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-indigo-300 border border-slate-700/60 hover:border-indigo-500/40 transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
          >
            <span>{chip.icon}</span>
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* Dismissible Error / Notice Toast */}
      {errorMessage && (
        <div className="mt-3 p-3 bg-amber-950/50 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-start justify-between gap-2 animate-fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-amber-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Success Notification */}
      {successInfo && (
        <div className="mt-3 p-2.5 bg-emerald-950/50 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{successInfo}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessInfo(null)}
            className="text-emerald-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
