import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { PieChart as PieIcon, TrendingUp, Sparkles, Coins } from 'lucide-react';

const DONUT_COLORS = ['#10b981', '#06b6d4']; // Emerald (Principal), Cyan/Teal (Interest)

export default function GrowthCharts({ result }) {
  if (!result) return null;

  const { principal, total_interest_earned, maturity_amount, schedule } = result;

  // Donut data: Principal vs Interest
  const donutData = [
    { name: 'Principal Invested', value: Math.round(principal) },
    { name: 'Interest Earned', value: Math.round(total_interest_earned) },
  ];

  const total = principal + total_interest_earned;
  const principalPct = total > 0 ? ((principal / total) * 100).toFixed(1) : '0.0';
  const interestPct = total > 0 ? ((total_interest_earned / total) * 100).toFixed(1) : '0.0';
  const wealthMultiplier = principal > 0 ? (maturity_amount / principal).toFixed(2) : '1.00';

  // Area chart data: wealth accumulation curve from amortization schedule
  const areaData = React.useMemo(() => {
    if (!schedule || schedule.length === 0) {
      return [
        { name: 'Year 0', balance: principal, invested: principal },
        { name: 'Maturity', balance: maturity_amount, invested: principal }
      ];
    }

    const data = [
      {
        name: 'Year 0',
        balance: Math.round(schedule[0].opening_balance || principal),
        invested: Math.round(schedule[0].deposit_added || principal),
        interest: 0
      }
    ];

    let cumDeposit = 0;
    schedule.forEach((row) => {
      cumDeposit += row.deposit_added;
      data.push({
        name: `Year ${row.year}`,
        balance: Math.round(row.closing_balance),
        invested: Math.round(cumDeposit > 0 ? cumDeposit : principal),
        interestCredited: Math.round(row.interest_credited)
      });
    });

    return data;
  }, [schedule, principal, maturity_amount]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <PieIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Visual Growth & Capital Distribution
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">
                Interactive Charts
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Capital breakdown and year-by-year compounding trajectory.
            </p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Donut Chart (Principal vs Interest) */}
        <div className="lg:col-span-5 bg-slate-800/40 border border-slate-800 rounded-2xl p-5 flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold text-slate-300">Capital Breakdown</span>
            <span>Total: ₹{Math.round(maturity_amount).toLocaleString('en-IN')}</span>
          </div>

          <div className="w-full h-60 relative flex items-center justify-center">
            {/* Glowing Backdrop Aura */}
            <div className="absolute w-40 h-40 rounded-full bg-gradient-to-tr from-emerald-500/20 via-cyan-500/15 to-transparent blur-2xl pointer-events-none" />

            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <filter id="emerald-glow" x="-25%" y="-25%" width="150%" height="150%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.45" />
                  </filter>
                  <filter id="cyan-glow" x="-25%" y="-25%" width="150%" height="150%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#06b6d4" floodOpacity="0.45" />
                  </filter>
                </defs>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                      stroke="#020617"
                      strokeWidth={3}
                      filter={index === 0 ? "url(#emerald-glow)" : "url(#cyan-glow)"}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs">
                          <p className="text-slate-300 font-semibold">{data.name}</p>
                          <p className="font-mono text-emerald-400 font-bold mt-0.5">
                            ₹{Number(data.value).toLocaleString('en-IN')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Glowing Donut Centerpiece: Wealth Multiplier */}
            <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center z-10 px-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full shadow-sm shadow-emerald-500/20 mb-0.5">
                Wealth Multiplier
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]">
                {wealthMultiplier}x
              </span>
              <span className="text-[10px] font-bold text-cyan-300 tracking-wide mt-0.5">
                +{interestPct}% from interest
              </span>
            </div>
          </div>

          {/* Donut Legend */}
          <div className="grid grid-cols-2 gap-3 w-full mt-2 pt-3 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
              <div>
                <span className="text-slate-400 block text-[11px]">Principal</span>
                <span className="text-white font-mono font-semibold">
                  {principalPct}% (₹{Math.round(principal).toLocaleString('en-IN')})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400 flex-shrink-0" />
              <div>
                <span className="text-slate-400 block text-[11px]">Interest</span>
                <span className="text-teal-300 font-mono font-semibold">
                  {interestPct}% (₹{Math.round(total_interest_earned).toLocaleString('en-IN')})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Area Chart (Wealth Accumulation Curve) */}
        <div className="lg:col-span-7 bg-slate-800/40 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Wealth Accumulation Trajectory
            </span>
            <span className="text-[11px] text-emerald-400 font-mono font-semibold">
              Compounded Balance (₹)
            </span>
          </div>

          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={areaData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-1">
                          <p className="text-white font-bold">{label}</p>
                          <p className="font-mono text-emerald-400">
                            Closing Balance: ₹{Number(payload[0]?.value || 0).toLocaleString('en-IN')}
                          </p>
                          {payload[1] && (
                            <p className="font-mono text-cyan-400 text-[11px]">
                              Cumulative Invested: ₹{Number(payload[1]?.value || 0).toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name="Closing Balance"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#balanceGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="invested"
                  name="Cumulative Principal"
                  stroke="#0ea5e9"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#investedGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
              <span>Compounded Maturity Value</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-cyan-400 border-dashed inline-block" />
              <span>Total Principal Invested</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
