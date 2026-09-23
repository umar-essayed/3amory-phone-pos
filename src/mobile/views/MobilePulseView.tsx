import React from 'react';
import {
  TrendingUp,
  Vault,
  Wallet,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  User,
  ShoppingBag,
  AlertTriangle,
  ChevronLeft,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import type { MobileLiveState } from '../services/firestoreLiveService';
import type { MobileTabType } from '../components/MobileBottomNav';

interface MobilePulseViewProps {
  data: MobileLiveState;
  onNavigateTab: (tab: MobileTabType) => void;
}

export function MobilePulseView({ data, onNavigateTab }: MobilePulseViewProps) {
  const { openShift, summaryStats, walletTransactions, invoices, wallets, phones, accessories } = data;

  // Format currency
  const formatEgp = (amount: number) => {
    return (amount || 0).toLocaleString('ar-EG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  };

  // Recent activity stream (combining transactions and invoices)
  const recentActivities = [
    ...invoices.slice(0, 10).map((inv) => ({
      id: `inv_${inv.id}`,
      type: 'invoice' as const,
      title: `فاتورة بيع #${inv.invoiceNumber || inv.id.slice(-4)}`,
      amount: inv.total || 0,
      detail: inv.customerName || (inv.items ? `${inv.items.length} أصناف` : 'مبيعات نقدية'),
      time: inv.createdAt,
      isPositive: true,
    })),
    ...walletTransactions.slice(0, 10).map((tx) => ({
      id: `tx_${tx.id}`,
      type: 'wallet' as const,
      title:
        tx.type === 'cash_out_to_customer'
          ? `إيداع كاش لعميل (${tx.walletName})`
          : tx.type === 'cash_in_from_customer'
          ? `سحب كاش من عميل (${tx.walletName})`
          : tx.type === 'instapay_transfer'
          ? `تحويل إنستاباي (${tx.walletName})`
          : tx.type === 'instapay_receive'
          ? `استلام إنستاباي (${tx.walletName})`
          : `معاملة محفظة (${tx.walletName})`,
      amount: tx.amount || 0,
      profit: tx.netProfit !== undefined ? tx.netProfit : tx.commission || 0,
      detail: tx.customerPhone || tx.customerName || 'عميل محفظة',
      time: tx.createdAt,
      isPositive: tx.type.includes('receive') || tx.type.includes('in'),
    })),
  ]
    .sort((a, b) => new Date(b.time || '').getTime() - new Date(a.time || '').getTime())
    .slice(0, 8);

  return (
    <div className="space-y-4 pb-24 text-slate-100" dir="rtl">
      {/* ── 1. Live Shift Banner ─────────────────────────────────── */}
      {openShift ? (
        <div
          onClick={() => onNavigateTab('shift')}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900/80 via-slate-900 to-indigo-950/80 p-4 border border-blue-500/30 shadow-lg cursor-pointer active:scale-[0.99] transition-all"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-black text-emerald-400">وردية حالية مفتوحة</span>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                رقم #{openShift.shiftNumber}
              </span>
            </div>

            <div className="flex items-center text-xs text-blue-400 font-bold gap-1">
              <span>تفاصيل الدرج</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block font-medium">الكاش المتوقع بالدرج</span>
              <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                {formatEgp(summaryStats.cashDrawerExpected)} <span className="text-xs font-normal">ج.م</span>
              </div>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block font-medium">الكاشير المسؤول</span>
              <div className="text-sm font-bold text-slate-200 mt-1 truncate flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-400 inline" />
                <span>{openShift.cashierName || 'كاشير المحل'}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-amber-950/30 p-4 border border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-amber-300">لا توجد وردية مفتوحة الآن</h3>
              <p className="text-xs text-amber-200/70">درج الكاشير مغلق حالياً في المحل</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('shift')}
            className="text-xs font-bold bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30"
          >
            سجل الورديات
          </button>
        </div>
      )}

      {/* ── 2. Today's Core KPIs ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Sales */}
        <div
          onClick={() => onNavigateTab('invoices')}
          className="rounded-2xl bg-slate-900/90 p-3.5 border border-slate-800/80 shadow-md active:scale-[0.98] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-bold">مبيعات اليوم</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-white font-mono">
            {formatEgp(summaryStats.totalRevenueToday)}
            <span className="text-xs text-slate-400 mr-1 font-sans">ج.م</span>
          </div>
          <span className="text-[10px] text-blue-400 font-semibold mt-1 block">
            {invoices.length} فواتير مسجلة
          </span>
        </div>

        {/* Profit */}
        <div
          onClick={() => onNavigateTab('analytics')}
          className="rounded-2xl bg-slate-900/90 p-3.5 border border-slate-800/80 shadow-md active:scale-[0.98] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-bold">صافي الربح</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono">
            {formatEgp(summaryStats.totalProfitToday)}
            <span className="text-xs text-emerald-300/70 mr-1 font-sans">ج.م</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold mt-1 block">
            أرباح مبيعات وعمولات
          </span>
        </div>

        {/* Wallets Balance */}
        <div
          onClick={() => onNavigateTab('wallets')}
          className="rounded-2xl bg-slate-900/90 p-3.5 border border-slate-800/80 shadow-md active:scale-[0.98] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-bold">أرصدة المحافظ</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-indigo-300 font-mono">
            {formatEgp(summaryStats.totalWalletsBalance)}
            <span className="text-xs text-slate-400 mr-1 font-sans">ج.م</span>
          </div>
          <span className="text-[10px] text-indigo-400 font-semibold mt-1 block">
            {wallets.length} خط ومحفظة نشطة
          </span>
        </div>

        {/* Expenses */}
        <div className="rounded-2xl bg-slate-900/90 p-3.5 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-bold">مصروفات اليوم</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-400 font-mono">
            {formatEgp(summaryStats.totalExpensesToday)}
            <span className="text-xs text-rose-300/70 mr-1 font-sans">ج.م</span>
          </div>
          <span className="text-[10px] text-rose-400/80 font-semibold mt-1 block">
            مسجلة في الوردية
          </span>
        </div>
      </div>

      {/* ── 3. Wallets Snapshot ─────────────────────────────────── */}
      <div className="rounded-2xl bg-slate-900/80 p-4 border border-slate-800/80 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">أرصدة المحافظ والخطوط</h3>
          </div>
          <button
            onClick={() => onNavigateTab('wallets')}
            className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <span>عرض الكل</span>
            <ChevronLeft className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {wallets.slice(0, 4).map((wallet) => (
            <div
              key={wallet.id}
              className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-200 truncate">{wallet.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-800 text-slate-400">
                  {wallet.type === 'instapay' ? 'إنستا' : 'كاش'}
                </span>
              </div>
              <div className="text-sm font-black text-white font-mono">
                {formatEgp(wallet.balance)} <span className="text-[10px] font-normal text-slate-400">ج.م</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. Stock & Inventory Glance ─────────────────────────── */}
      <div
        onClick={() => onNavigateTab('inventory')}
        className="rounded-2xl bg-slate-900/80 p-4 border border-slate-800/80 shadow-md active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">نواقص المخزن والهواتف</h4>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <span>{summaryStats.totalPhonesInStock} هاتف متاح</span>
              <span>•</span>
              <span className={summaryStats.lowStockAccessoriesCount > 0 ? 'text-rose-400 font-bold' : ''}>
                {summaryStats.lowStockAccessoriesCount} قطع قاربت على النفاذ
              </span>
            </div>
          </div>
        </div>

        <ChevronLeft className="w-5 h-5 text-slate-400" />
      </div>

      {/* ── 5. Real-Time Activity Feed ──────────────────────────── */}
      <div className="rounded-2xl bg-slate-900/80 p-4 border border-slate-800/80 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">النشاط المباشر في المحل</h3>
          </div>
          <span className="text-[11px] text-slate-400">تحديث فوري</span>
        </div>

        {recentActivities.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs font-semibold">
            لا توجد حركات مسجلة مؤخراً
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentActivities.map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800/50 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      act.type === 'invoice'
                        ? 'bg-blue-500/10 text-blue-400'
                        : act.isPositive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {act.type === 'invoice' ? (
                      <Receipt className="w-3.5 h-3.5" />
                    ) : act.isPositive ? (
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">{act.title}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{act.detail}</span>
                  </div>
                </div>

                <div className="text-left shrink-0 mr-2">
                  <div className="text-xs font-bold font-mono text-white">
                    {formatEgp(act.amount)} <span className="text-[10px] font-normal text-slate-400">ج.م</span>
                  </div>
                  {act.time && (
                    <span className="text-[9px] text-slate-500 block font-mono">
                      {new Date(act.time).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
