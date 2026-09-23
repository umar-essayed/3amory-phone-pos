import React, { useState } from 'react';
import {
  ReceiptText,
  Search,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  CreditCard,
  Wallet,
  ShoppingBag,
  DollarSign,
} from 'lucide-react';
import type { SaleInvoice } from '../../types';

interface MobileInvoicesViewProps {
  invoices: SaleInvoice[];
}

export function MobileInvoicesView({ invoices }: MobileInvoicesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatEgp = (amount: number) => {
    return (amount || 0).toLocaleString('ar-EG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const invoicesToday = invoices.filter((inv) => inv.createdAt?.startsWith(todayStr));
  const totalSalesToday = invoicesToday.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalProfitToday = invoicesToday.reduce((sum, inv) => sum + (inv.totalProfit || 0), 0);

  const q = searchQuery.toLowerCase().trim();
  const filtered = invoices.filter((inv) => {
    if (!q) return true;
    return (
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.customerName?.toLowerCase().includes(q) ||
      inv.customerPhone?.includes(q) ||
      inv.cashierName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 pb-24 text-slate-100" dir="rtl">
      {/* ── Today's Header Summary ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-xs font-bold text-slate-400 block mb-1">إجمالي فواتير اليوم</span>
          <div className="text-xl font-black text-white font-mono">
            {formatEgp(totalSalesToday)} <span className="text-xs text-slate-400 font-sans">ج.م</span>
          </div>
          <span className="text-[10px] text-blue-400 font-semibold mt-1 block">
            {invoicesToday.length} فاتورة مسجلة
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <span className="text-xs font-bold text-slate-400 block mb-1">أرباح المبيعات اليوم</span>
          <div className="text-xl font-black text-emerald-400 font-mono">
            +{formatEgp(totalProfitToday)} <span className="text-xs text-emerald-300/70 font-sans">ج.م</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold mt-1 block">
            صافي هامش الربح
          </span>
        </div>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────── */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
        <input
          type="text"
          placeholder="ابحث برقم الفاتورة، اسم العميل أو الهاتف..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pr-10 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 shadow-md"
        />
      </div>

      {/* ── Invoices Feed ────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-semibold">
            لا توجد فواتير مطابقة لبحثك
          </div>
        ) : (
          filtered.map((inv) => {
            const isExpanded = expandedId === inv.id;
            const itemsCount = inv.items?.length || 0;

            const methodLabel =
              inv.paymentMethod === 'cash'
                ? 'كاش'
                : inv.paymentMethod === 'wallet'
                ? 'محفظة كاش'
                : inv.paymentMethod === 'instapay'
                ? 'إنستاباي'
                : inv.paymentMethod === 'debt'
                ? 'آجل'
                : 'دفع متعدد';

            const methodBadgeColor =
              inv.paymentMethod === 'cash'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : inv.paymentMethod === 'instapay'
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                : inv.paymentMethod === 'wallet'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

            return (
              <div
                key={inv.id}
                className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md overflow-hidden transition-all"
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-white font-mono">
                        #{inv.invoiceNumber || inv.id.slice(-6)}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.2 rounded-full border ${methodBadgeColor}`}
                      >
                        {methodLabel}
                      </span>
                      {inv.status === 'returned' && (
                        <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          مرتجع
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{inv.customerName || 'عميل نقدي'}</span>
                      <span>•</span>
                      <span>{itemsCount} أصناف</span>
                      <span>•</span>
                      <span>
                        {new Date(inv.createdAt).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 mr-2">
                    <div className="text-left font-mono">
                      <div className="text-sm font-black text-white">
                        {formatEgp(inv.total)} <span className="text-[10px] font-sans">ج.م</span>
                      </div>
                      <div className="text-[10px] font-bold text-emerald-400">
                        ربح: +{formatEgp(inv.totalProfit)}
                      </div>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-3.5 bg-slate-950/70 border-t border-slate-800/80 text-xs space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span>الكاشير: {inv.cashierName}</span>
                      </span>
                      <span className="font-mono">
                        {new Date(inv.createdAt).toLocaleString('ar-EG')}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-300 block">الأصناف المباعة:</span>
                      {inv.items?.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px]"
                        >
                          <div>
                            <span className="font-bold text-white block">{item.name}</span>
                            {item.imei && (
                              <span className="font-mono text-[10px] text-slate-400">
                                IMEI: {item.imei}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              الكمية: {item.quantity} × {formatEgp(item.unitPrice)} ج.م
                            </span>
                          </div>
                          <span className="font-mono font-bold text-emerald-400">
                            {formatEgp(item.totalPrice)} ج.م
                          </span>
                        </div>
                      ))}
                    </div>

                    {inv.paymentMethod === 'debt' && inv.remainingAmount > 0 && (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-between">
                        <span>المتبقي آجل على العميل:</span>
                        <span className="font-mono font-bold">{formatEgp(inv.remainingAmount)} ج.م</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
