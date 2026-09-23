import React, { useState } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Send,
  Download,
  Search,
  Filter,
} from 'lucide-react';
import type { StoreWallet, WalletTransaction } from '../../types';

interface MobileWalletsViewProps {
  wallets: StoreWallet[];
  transactions: WalletTransaction[];
}

export function MobileWalletsView({ wallets, transactions }: MobileWalletsViewProps) {
  const [activeTab, setActiveTab] = useState<'cash' | 'instapay'>('cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);

  const formatEgp = (amount: number) => {
    return (amount || 0).toLocaleString('ar-EG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  // Filter wallets by type
  const cashWallets = wallets.filter((w) => w.type !== 'instapay');
  const instapayWallets = wallets.filter((w) => w.type === 'instapay');
  const displayedWallets = activeTab === 'cash' ? cashWallets : instapayWallets;

  // Compute daily & monthly transfers and profits for a specific wallet
  const getWalletStats = (walletId: string) => {
    const walletTx = transactions.filter((t) => t.walletId === walletId);

    // Only actual outbound transfers count against limit
    const transfersToday = walletTx
      .filter(
        (t) =>
          t.createdAt?.startsWith(todayStr) &&
          (t.type === 'cash_out_to_customer' || t.type === 'instapay_transfer')
      )
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const transfersMonth = walletTx
      .filter(
        (t) =>
          t.createdAt?.startsWith(currentMonthStr) &&
          (t.type === 'cash_out_to_customer' || t.type === 'instapay_transfer')
      )
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const profitToday = walletTx
      .filter((t) => t.createdAt?.startsWith(todayStr))
      .reduce(
        (sum, t) =>
          sum + (t.netProfit !== undefined ? t.netProfit : t.commission || 0),
        0
      );

    const profitMonth = walletTx
      .filter((t) => t.createdAt?.startsWith(currentMonthStr))
      .reduce(
        (sum, t) =>
          sum + (t.netProfit !== undefined ? t.netProfit : t.commission || 0),
        0
      );

    return {
      transfersToday,
      transfersMonth,
      profitToday,
      profitMonth,
    };
  };

  // Filtered transactions for the stream
  const filteredTransactions = transactions
    .filter((tx) => {
      if (selectedWalletId && tx.walletId !== selectedWalletId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = tx.customerName?.toLowerCase().includes(q);
        const matchPhone = tx.customerPhone?.toLowerCase().includes(q);
        const matchWallet = tx.walletName?.toLowerCase().includes(q);
        return matchName || matchPhone || matchWallet;
      }
      return true;
    })
    .slice(0, 30);

  return (
    <div className="space-y-4 pb-24 text-slate-100" dir="rtl">
      {/* ── Category Switcher ────────────────────────────────────── */}
      <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-2xl border border-slate-800 shadow-md">
        <button
          onClick={() => {
            setActiveTab('cash');
            setSelectedWalletId(null);
          }}
          className={`py-2 text-xs font-black rounded-xl transition-all ${
            activeTab === 'cash'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          خطوط الكاش ({cashWallets.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('instapay');
            setSelectedWalletId(null);
          }}
          className={`py-2 text-xs font-black rounded-xl transition-all ${
            activeTab === 'instapay'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          إنستاباي والحسابات ({instapayWallets.length})
        </button>
      </div>

      {/* ── Wallets Cards Grid ───────────────────────────────────── */}
      <div className="space-y-3">
        {displayedWallets.map((wallet) => {
          const stats = getWalletStats(wallet.id);
          const isSelected = selectedWalletId === wallet.id;

          const dailyLimit = wallet.dailyLimit || 60000;
          const monthlyLimit = wallet.monthlyLimit || 200000;

          const dailyPercent = Math.min(100, Math.round((stats.transfersToday / dailyLimit) * 100));
          const monthlyPercent = Math.min(100, Math.round((stats.transfersMonth / monthlyLimit) * 100));

          return (
            <div
              key={wallet.id}
              onClick={() => setSelectedWalletId(isSelected ? null : wallet.id)}
              className={`rounded-2xl bg-slate-900/90 border p-4 shadow-md transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-500 shadow-blue-500/20 ring-1 ring-blue-500'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: wallet.color || '#3b82f6' }}
                  />
                  <h4 className="text-sm font-black text-white">{wallet.name}</h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {wallet.phoneNumberOrAccount}
                  </span>
                </div>

                <div className="text-left font-mono">
                  <span className="text-base font-black text-emerald-400">
                    {formatEgp(wallet.balance)}
                  </span>
                  <span className="text-[10px] text-slate-400 mr-1 font-sans">ج.م</span>
                </div>
              </div>

              {/* Progress Bars: Daily & Monthly Limits */}
              <div className="space-y-2 mt-3 pt-3 border-t border-slate-800/80">
                {/* Daily limit */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>الليميت اليومي:</span>
                    <span className="font-mono">
                      {formatEgp(stats.transfersToday)} / {formatEgp(dailyLimit)} ج.م ({dailyPercent}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        dailyPercent > 85 ? 'bg-rose-500' : dailyPercent > 60 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${dailyPercent}%` }}
                    />
                  </div>
                </div>

                {/* Monthly limit */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>الليميت الشهري:</span>
                    <span className="font-mono">
                      {formatEgp(stats.transfersMonth)} / {formatEgp(monthlyLimit)} ج.م ({monthlyPercent}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        monthlyPercent > 85 ? 'bg-rose-500' : monthlyPercent > 60 ? 'bg-amber-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${monthlyPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Line Profits Today & Month */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-xs">
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/50">
                  <span className="text-[10px] text-slate-400 block font-medium">أرباح الخط اليوم:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    +{formatEgp(stats.profitToday)} ج.م
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/50">
                  <span className="text-[10px] text-slate-400 block font-medium">أرباح الخط هذا الشهر:</span>
                  <span className="font-mono font-bold text-indigo-400">
                    +{formatEgp(stats.profitMonth)} ج.م
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Real-Time Transactions Feed ─────────────────────────── */}
      <div className="rounded-2xl bg-slate-900/90 p-4 border border-slate-800 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">حركات المعاملات اللحظية</h3>
          </div>
          {selectedWalletId && (
            <button
              onClick={() => setSelectedWalletId(null)}
              className="text-[11px] text-blue-400 underline font-semibold"
            >
              إلغاء التصفية
            </button>
          )}
        </div>

        {/* Search Filter */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث برقم الهاتف أو العميل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
          />
        </div>

        {/* Transactions List */}
        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs font-semibold">
              لا توجد معاملات مسجلة
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const isSend = tx.type === 'cash_out_to_customer' || tx.type === 'instapay_transfer';
              const isInsta = tx.type.startsWith('instapay');

              return (
                <div
                  key={tx.id}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isSend
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {isSend ? (
                        <Send className="w-4 h-4" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {tx.walletName}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            isInsta ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {isInsta ? 'إنستاباي' : 'كاش'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {tx.customerPhone || tx.customerName || 'عميل محفظة'}
                        {tx.notes ? ` • ${tx.notes}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-left shrink-0 mr-2 font-mono">
                    <div className="text-xs font-black text-white">
                      {isSend ? '-' : '+'}{formatEgp(tx.amount)} ج.م
                    </div>
                    <div className="text-[10px] font-bold text-emerald-400">
                      ربح: +{formatEgp(tx.netProfit !== undefined ? tx.netProfit : tx.commission || 0)} ج.م
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
