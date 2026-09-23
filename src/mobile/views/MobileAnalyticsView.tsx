import React from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Smartphone,
  Package,
  Wallet,
  ArrowUpRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { MobileLiveState } from '../services/firestoreLiveService';

interface MobileAnalyticsViewProps {
  data: MobileLiveState;
}

export function MobileAnalyticsView({ data }: MobileAnalyticsViewProps) {
  const { summaryStats, openShift, invoices, walletTransactions, expenses } = data;

  const formatEgp = (amount: number) => {
    return (amount || 0).toLocaleString('ar-EG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const invoicesToday = invoices.filter((i) => i.createdAt?.startsWith(todayStr));

  // Phone sales vs accessories sales profit breakdown
  let phoneProfitToday = 0;
  let accProfitToday = 0;

  for (const inv of invoicesToday) {
    for (const item of inv.items || []) {
      const itemProfit = (item.unitPrice - item.costPrice) * (item.quantity || 1);
      if (item.type === 'phone') {
        phoneProfitToday += itemProfit;
      } else {
        accProfitToday += itemProfit;
      }
    }
  }

  const walletProfitToday = summaryStats.totalCommissionsToday;
  const fawryProfitToday = openShift?.fawryNetProfit || 0;
  const expensesToday = summaryStats.totalExpensesToday;
  const netProfitToday = summaryStats.totalProfitToday;

  return (
    <div className="space-y-4 pb-24 text-slate-100" dir="rtl">
      {/* ── Net Profit Hero Card ─────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-950/70 via-slate-900 to-indigo-950/70 p-5 border border-emerald-500/30 shadow-lg text-center">
        <span className="text-xs font-bold text-slate-300 block mb-1">
          صافي أرباح المحل اليوم (كافة الأقسام)
        </span>
        <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight my-1">
          +{formatEgp(netProfitToday)} <span className="text-sm font-sans">جنيه</span>
        </div>
        <span className="text-[11px] text-emerald-300/80 block mt-1">
          بعد خصم المصروفات والنثريات وتكلفة البضائع
        </span>
      </div>

      {/* ── Revenue vs Expenses ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-xs font-bold text-slate-400 block mb-1">إجمالي إيراد اليوم</span>
          <div className="text-xl font-black text-white font-mono">
            {formatEgp(summaryStats.totalRevenueToday)} <span className="text-xs text-slate-400 font-sans">ج.م</span>
          </div>
          <span className="text-[10px] text-blue-400 font-semibold mt-1 block">
            مبيعات المحل
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-xs font-bold text-slate-400 block mb-1">المصروفات اليوم</span>
          <div className="text-xl font-black text-rose-400 font-mono">
            -{formatEgp(expensesToday)} <span className="text-xs text-rose-300/70 font-sans">ج.م</span>
          </div>
          <span className="text-[10px] text-rose-400 font-semibold mt-1 block">
            نثريات ومصاريف تشغيل
          </span>
        </div>
      </div>

      {/* ── Sources Profit Breakdown ─────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900/90 p-4 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <PieChart className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">تفصيل مصادر الأرباح اليوم</h3>
        </div>

        {/* 1. Phone Profits */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-slate-200">أرباح بيع الهواتف:</span>
          </div>
          <span className="font-mono font-black text-blue-400">+{formatEgp(phoneProfitToday)} ج.م</span>
        </div>

        {/* 2. Accessories Profits */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-slate-200">أرباح الإكسسوارات والقطع:</span>
          </div>
          <span className="font-mono font-black text-indigo-400">+{formatEgp(accProfitToday)} ج.م</span>
        </div>

        {/* 3. Wallets Commissions */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-200">عمولات خطوط الكاش وإنستاباي:</span>
          </div>
          <span className="font-mono font-black text-emerald-400">+{formatEgp(walletProfitToday)} ج.م</span>
        </div>

        {/* 4. Fawry Net Profit */}
        {fawryProfitToday > 0 && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-slate-200">صافي ربح مكن فوري:</span>
            </div>
            <span className="font-mono font-black text-amber-400">+{formatEgp(fawryProfitToday)} ج.م</span>
          </div>
        )}

        {/* 5. Deductions */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/20 text-xs">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
            <span className="font-bold text-rose-300">إجمالي المصروفات المخصومة:</span>
          </div>
          <span className="font-mono font-black text-rose-400">-{formatEgp(expensesToday)} ج.م</span>
        </div>
      </div>
    </div>
  );
}
