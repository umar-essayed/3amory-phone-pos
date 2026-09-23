import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  Smartphone,
  Package,
  Wallet,
  ArrowUpRight,
  Layers,
  Sparkles,
  Calendar,
  BarChart2,
  Percent,
  CheckCircle2,
  ChevronDown,
  ArrowDownLeft,
} from 'lucide-react';
import type { MobileLiveState } from '../services/firestoreLiveService';

interface MobileAnalyticsViewProps {
  data: MobileLiveState;
}

type TimeRange = 'today' | '7days' | 'month';

export function MobileAnalyticsView({ data }: MobileAnalyticsViewProps) {
  const { summaryStats, openShift, invoices, walletTransactions, expenses, shifts } = data;
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const formatEgp = (amount: number) => {
    return Math.round(amount || 0).toLocaleString('ar-EG');
  };

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentMonthStr = now.toISOString().slice(0, 7);

  // ── 1. Filter Data based on selected timeRange ────────────────
  const filteredInvoices = useMemo(() => {
    if (timeRange === 'today') {
      return invoices.filter((i) => i.createdAt?.startsWith(todayStr));
    }
    if (timeRange === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return invoices.filter((i) => new Date(i.createdAt || '') >= sevenDaysAgo);
    }
    // month
    return invoices.filter((i) => i.createdAt?.startsWith(currentMonthStr));
  }, [invoices, timeRange, todayStr, currentMonthStr]);

  const filteredTx = useMemo(() => {
    if (timeRange === 'today') {
      return walletTransactions.filter((t) => t.createdAt?.startsWith(todayStr));
    }
    if (timeRange === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return walletTransactions.filter((t) => new Date(t.createdAt || '') >= sevenDaysAgo);
    }
    return walletTransactions.filter((t) => t.createdAt?.startsWith(currentMonthStr));
  }, [walletTransactions, timeRange, todayStr, currentMonthStr]);

  const filteredExpenses = useMemo(() => {
    if (timeRange === 'today') {
      return expenses.filter((e) => e.createdAt?.startsWith(todayStr));
    }
    if (timeRange === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return expenses.filter((e) => new Date(e.createdAt || '') >= sevenDaysAgo);
    }
    return expenses.filter((e) => e.createdAt?.startsWith(currentMonthStr));
  }, [expenses, timeRange, todayStr, currentMonthStr]);

  // Aggregate metrics
  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  // Categories profit breakdown
  let phoneProfit = 0;
  let accProfit = 0;
  for (const inv of filteredInvoices) {
    for (const item of inv.items || []) {
      const profit = (item.unitPrice - item.costPrice) * (item.quantity || 1);
      if (item.type === 'phone') {
        phoneProfit += profit;
      } else {
        accProfit += profit;
      }
    }
  }

  const walletProfit = filteredTx.reduce(
    (sum, tx) => sum + (tx.netProfit !== undefined ? tx.netProfit : tx.commission || 0),
    0
  );
  const fawryProfit = openShift?.fawryNetProfit || 0;
  const netProfit = Math.max(0, phoneProfit + accProfit + walletProfit + fawryProfit - totalExpenses);

  // Overall margin
  const profitMarginPercent = totalRevenue > 0 ? Math.min(100, Math.round((netProfit / totalRevenue) * 100)) : 0;

  // ── 2. Build 7-Day Trend Chart Data ──────────────────────────
  const last7DaysData = useMemo(() => {
    const days: Array<{
      dateStr: string;
      dayName: string;
      sales: number;
      profit: number;
      invoicesCount: number;
    }> = [];

    const arabicDays = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dStr = d.toISOString().slice(0, 10);
      const dayInvoices = invoices.filter((inv) => inv.createdAt?.startsWith(dStr));
      const dayTx = walletTransactions.filter((tx) => tx.createdAt?.startsWith(dStr));

      const sales = dayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const invProfit = dayInvoices.reduce((sum, inv) => sum + (inv.totalProfit || 0), 0);
      const txProfit = dayTx.reduce(
        (sum, tx) => sum + (tx.netProfit !== undefined ? tx.netProfit : tx.commission || 0),
        0
      );

      days.push({
        dateStr: dStr,
        dayName: i === 0 ? 'اليوم' : arabicDays[d.getDay()],
        sales,
        profit: invProfit + txProfit,
        invoicesCount: dayInvoices.length,
      });
    }
    return days;
  }, [invoices, walletTransactions, now]);

  const maxChartValue = Math.max(
    1000,
    ...last7DaysData.map((d) => Math.max(d.sales, d.profit))
  );

  // ── 3. Profit Sources Breakdown for Donut / Progress ─────────
  const profitSources = [
    {
      id: 'phones',
      label: 'مبيعات الهواتف',
      profit: phoneProfit,
      color: '#3b82f6', // Blue
      bgClass: 'bg-blue-500',
      icon: Smartphone,
    },
    {
      id: 'accessories',
      label: 'الإكسسوارات والقطع',
      profit: accProfit,
      color: '#8b5cf6', // Violet
      bgClass: 'bg-violet-500',
      icon: Package,
    },
    {
      id: 'wallets',
      label: 'عمولات الكاش وإنستا',
      profit: walletProfit,
      color: '#10b981', // Emerald
      bgClass: 'bg-emerald-500',
      icon: Wallet,
    },
    {
      id: 'fawry',
      label: 'صافي مكن فوري',
      profit: fawryProfit,
      color: '#f59e0b', // Amber
      bgClass: 'bg-amber-500',
      icon: Sparkles,
    },
  ];

  const totalSourcesProfit = profitSources.reduce((sum, s) => sum + s.profit, 0) || 1;

  // Selected Day in Trend Chart
  const selectedDay = selectedDayIndex !== null ? last7DaysData[selectedDayIndex] : last7DaysData[last7DaysData.length - 1];

  // ── 4. Payment Methods Distribution ──────────────────────────
  const paymentMethods = useMemo(() => {
    let cash = 0;
    let instapay = 0;
    let wallet = 0;
    let debt = 0;

    for (const inv of filteredInvoices) {
      if (inv.paymentMethod === 'cash') cash += inv.total || 0;
      else if (inv.paymentMethod === 'instapay') instapay += inv.total || 0;
      else if (inv.paymentMethod === 'wallet') wallet += inv.total || 0;
      else if (inv.paymentMethod === 'debt') debt += inv.total || 0;
      else cash += inv.total || 0;
    }

    const total = cash + instapay + wallet + debt || 1;
    return [
      { name: 'كاش بالدرج', amount: cash, pct: Math.round((cash / total) * 100), color: 'bg-emerald-500' },
      { name: 'إنستاباي', amount: instapay, pct: Math.round((instapay / total) * 100), color: 'bg-indigo-500' },
      { name: 'محافظ إلكترونية', amount: wallet, pct: Math.round((wallet / total) * 100), color: 'bg-blue-500' },
      { name: 'آجل على العملاء', amount: debt, pct: Math.round((debt / total) * 100), color: 'bg-amber-500' },
    ];
  }, [filteredInvoices]);

  return (
    <div className="space-y-4 pb-36 text-slate-100 select-none" dir="rtl">
      {/* ── Time Period Filter Bar ──────────────────────────────── */}
      <div className="grid grid-cols-3 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md">
        <button
          onClick={() => setTimeRange('today')}
          className={`py-2 text-xs font-black rounded-xl transition-all ${
            timeRange === 'today'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          اليوم
        </button>
        <button
          onClick={() => setTimeRange('7days')}
          className={`py-2 text-xs font-black rounded-xl transition-all ${
            timeRange === '7days'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          آخر 7 أيام
        </button>
        <button
          onClick={() => setTimeRange('month')}
          className={`py-2 text-xs font-black rounded-xl transition-all ${
            timeRange === 'month'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          هذا الشهر
        </button>
      </div>

      {/* ── Net Profit Hero Card ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-indigo-950/80 p-5 border border-emerald-500/30 shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-300">
            {timeRange === 'today'
              ? 'صافي أرباح اليوم'
              : timeRange === '7days'
              ? 'صافي أرباح آخر 7 أيام'
              : 'صافي أرباح الشهر'}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>محسوب بدقة</span>
          </span>
        </div>

        <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight my-1">
          +{formatEgp(netProfit)} <span className="text-sm font-sans">جنيه</span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3 mt-3">
          <div>
            إجمالي الإيرادات:{' '}
            <strong className="text-white font-mono">{formatEgp(totalRevenue)} ج.م</strong>
          </div>
          <div>
            نسبة هامش الربح:{' '}
            <strong className="text-emerald-400 font-mono">{profitMarginPercent}%</strong>
          </div>
        </div>
      </div>

      {/* ── 2. Interactive 7-Day Trend Chart (رسم بياني تفاعلي) ──── */}
      <div className="rounded-3xl bg-slate-900/90 p-4 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white">منحنى المبيعات والأرباح (آخر 7 أيام)</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">المس أي يوم للتفاصيل</span>
        </div>

        {/* Selected Day Info Pill */}
        {selectedDay && (
          <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-blue-500/30 flex items-center justify-between text-xs transition-all">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-bold text-[10px]">
                {selectedDay.dayName}
              </span>
              <span className="text-slate-400 text-[11px] font-mono">{selectedDay.dateStr}</span>
            </div>
            <div className="flex items-center gap-3 font-mono">
              <div>
                مبيعات: <span className="text-blue-400 font-bold">{formatEgp(selectedDay.sales)}</span>
              </div>
              <div>
                أرباح: <span className="text-emerald-400 font-bold">+{formatEgp(selectedDay.profit)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Bars Container */}
        <div className="pt-4 pb-2 px-1">
          <div className="h-40 flex items-end justify-between gap-2 border-b border-slate-800 pb-2">
            {last7DaysData.map((d, idx) => {
              const isSelected = selectedDayIndex === idx || (selectedDayIndex === null && idx === last7DaysData.length - 1);
              const salesHeight = Math.max(8, Math.round((d.sales / maxChartValue) * 100));
              const profitHeight = Math.max(6, Math.round((d.profit / maxChartValue) * 100));

              return (
                <div
                  key={d.dateStr}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`flex-1 flex flex-col items-center justify-end h-full cursor-pointer transition-all active:scale-95 group ${
                    isSelected ? 'opacity-100 scale-105' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {/* Bars Pair */}
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    {/* Sales Bar */}
                    <div
                      style={{ height: `${salesHeight}%` }}
                      className={`w-2.5 sm:w-3.5 rounded-t-md transition-all duration-300 ${
                        isSelected
                          ? 'bg-gradient-to-t from-blue-600 to-indigo-400 shadow-md shadow-blue-500/40'
                          : 'bg-blue-600/60'
                      }`}
                    />
                    {/* Profit Bar */}
                    <div
                      style={{ height: `${profitHeight}%` }}
                      className={`w-2.5 sm:w-3.5 rounded-t-md transition-all duration-300 ${
                        isSelected
                          ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-md shadow-emerald-500/40'
                          : 'bg-emerald-600/60'
                      }`}
                    />
                  </div>

                  {/* Day Label */}
                  <span
                    className={`text-[10px] font-bold mt-2 truncate ${
                      isSelected ? 'text-blue-400 font-black' : 'text-slate-400'
                    }`}
                  >
                    {d.dayName}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-500" />
              <span>المبيعات الكلية</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
              <span>صافي الأرباح</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Visual Sources Donut / Progress Distribution ────── */}
      <div className="rounded-3xl bg-slate-900/90 p-4 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">توزيع مصادر الأرباح (بالأقسام)</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            إجمالي: {formatEgp(netProfit)} ج.م
          </span>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex p-0.5 border border-slate-800">
          {profitSources.map((source) => {
            const pct = Math.max(0, Math.round((source.profit / totalSourcesProfit) * 100));
            if (pct <= 0) return null;
            return (
              <div
                key={source.id}
                style={{ width: `${pct}%`, backgroundColor: source.color }}
                className="h-full first:rounded-r-full last:rounded-l-full transition-all duration-300"
                title={`${source.label}: ${pct}%`}
              />
            );
          })}
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {profitSources.map((source) => {
            const Icon = source.icon;
            const pct = Math.max(0, Math.round((source.profit / totalSourcesProfit) * 100));
            const isSelected = selectedCategory === source.id;

            return (
              <div
                key={source.id}
                onClick={() => setSelectedCategory(isSelected ? null : source.id)}
                className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 border-blue-500 shadow-md shadow-blue-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: source.color }}
                    />
                    <span className="text-[11px] font-bold text-slate-200 truncate">
                      {source.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {pct}%
                  </span>
                </div>

                <div className="text-sm font-black font-mono text-white mt-1">
                  +{formatEgp(source.profit)} <span className="text-[10px] font-sans font-normal text-slate-400">ج.م</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. Payment Methods Distribution ────────────────────── */}
      <div className="rounded-3xl bg-slate-900/90 p-4 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-white">طرق الدفع وتحصيل المبيعات</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {formatEgp(totalRevenue)} ج.م
          </span>
        </div>

        <div className="space-y-2">
          {paymentMethods.map((pm) => (
            <div key={pm.name} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-medium">{pm.name}</span>
                <span className="font-mono text-slate-400">
                  <strong className="text-white">{formatEgp(pm.amount)}</strong> ج.م ({pm.pct}%)
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${pm.color}`}
                  style={{ width: `${pm.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Revenue vs Expenses Balance Card ──────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <span className="text-xs font-bold text-slate-400 block mb-1">إجمالي المبيعات</span>
          <div className="text-lg font-black text-white font-mono">
            {formatEgp(totalRevenue)} <span className="text-xs text-slate-400 font-sans">ج.م</span>
          </div>
          <span className="text-[10px] text-blue-400 font-semibold mt-1 block">
            {filteredInvoices.length} فواتير مسجلة
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <span className="text-xs font-bold text-slate-400 block mb-1">المصروفات التشغيلية</span>
          <div className="text-lg font-black text-rose-400 font-mono">
            -{formatEgp(totalExpenses)} <span className="text-xs text-rose-300/70 font-sans">ج.م</span>
          </div>
          <span className="text-[10px] text-rose-400/80 font-semibold mt-1 block">
            {filteredExpenses.length} بنود مصروف
          </span>
        </div>
      </div>
    </div>
  );
}
