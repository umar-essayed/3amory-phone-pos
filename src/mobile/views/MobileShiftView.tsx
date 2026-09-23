import React, { useState } from 'react';
import {
  Vault,
  Clock,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Shift } from '../../types';

interface MobileShiftViewProps {
  openShift: Shift | null;
  shifts: Shift[];
}

export function MobileShiftView({ openShift, shifts }: MobileShiftViewProps) {
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);

  const formatEgp = (amount: number) => {
    return (amount || 0).toLocaleString('ar-EG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  };

  // Drawer breakdown values
  const opening = openShift?.openingCash || 0;
  const salesCash = openShift?.totalSalesCash || 0;
  const walletIn = openShift?.totalWalletIn || 0;
  const fawrySales = openShift?.fawrySalesTotal || 0;
  const walletOut = openShift?.totalWalletOut || 0;
  const expenses = openShift?.totalExpenses || 0;
  const returns = openShift?.totalReturnsCash || 0;
  const expectedDrawer = Math.max(
    0,
    opening + salesCash + walletIn + fawrySales - walletOut - expenses - returns
  );

  return (
    <div className="space-y-4 pb-24 text-slate-100" dir="rtl">
      {/* ── Sub Navigation Tabs ─────────────────────────────────── */}
      <div className="grid grid-cols-2 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md">
        <button
          onClick={() => setTab('current')}
          className={`py-2 text-xs font-black rounded-xl transition-all ${
            tab === 'current'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          الوردية الحالية والدرج
        </button>
        <button
          onClick={() => setTab('history')}
          className={`py-2 text-xs font-black rounded-xl transition-all ${
            tab === 'history'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          سجل الورديات السابقة ({shifts.length})
        </button>
      </div>

      {tab === 'current' ? (
        openShift ? (
          <div className="space-y-4">
            {/* Header Status Card */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 p-4 border border-emerald-500/30 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-black text-emerald-400">وردية مفتوحة قيد العمل</span>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700">
                  وردية #{openShift.shiftNumber}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300 border-t border-slate-800/80 pt-2.5">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>الكاشير: <strong>{openShift.cashierName}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    بدأت:{' '}
                    {new Date(openShift.startTime).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Cash Drawer Hero Display */}
            <div className="rounded-2xl bg-slate-900 p-4 border border-slate-800 shadow-md text-center">
              <span className="text-xs font-bold text-slate-400 mb-1 block">
                الكاش المتوقع حالياً في درج الكاشير
              </span>
              <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight my-1">
                {formatEgp(expectedDrawer)} <span className="text-sm font-sans">جنيه</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                محسوب آلياً من المبيعات، المحافظ، المصروفات وفوري
              </span>
            </div>

            {/* Detailed Drawer Equation Breakdown */}
            <div className="rounded-2xl bg-slate-900/90 p-4 border border-slate-800 shadow-md space-y-2.5">
              <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                <Vault className="w-4 h-4 text-blue-400" />
                <span>حركة الكاش والدرج في هذه الوردية</span>
              </h3>

              {/* Opening Cash */}
              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-slate-800/50">
                <span className="text-slate-300 font-medium">رصيد افتتاح الدرج</span>
                <span className="font-mono font-bold text-white">{formatEgp(opening)} ج.م</span>
              </div>

              {/* Cash Sales (+) */}
              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-slate-800/50">
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>مبيعات كاش (+):</span>
                </span>
                <span className="font-mono font-bold text-emerald-400">+{formatEgp(salesCash)} ج.م</span>
              </div>

              {/* Wallet In (+) */}
              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-slate-800/50">
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>استلام كاش تحويلات ومحافظ (+):</span>
                </span>
                <span className="font-mono font-bold text-emerald-400">+{formatEgp(walletIn)} ج.م</span>
              </div>

              {/* Fawry Cash (+) */}
              {fawrySales > 0 && (
                <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-slate-800/50">
                  <span className="text-indigo-400 font-medium flex items-center gap-1">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>مبيعات مكنة فوري (+):</span>
                  </span>
                  <span className="font-mono font-bold text-indigo-400">+{formatEgp(fawrySales)} ج.م</span>
                </div>
              )}

              {/* Wallet Out (-) */}
              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-slate-800/50">
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>كاش مسلّم للعملاء سحب محافظ (-):</span>
                </span>
                <span className="font-mono font-bold text-rose-400">-{formatEgp(walletOut)} ج.م</span>
              </div>

              {/* Expenses (-) */}
              <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-slate-800/50">
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>مصروفات ونثريات (-):</span>
                </span>
                <span className="font-mono font-bold text-rose-400">-{formatEgp(expenses)} ج.م</span>
              </div>

              {/* Returns (-) */}
              {returns > 0 && (
                <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-950/60 border border-slate-800/50">
                  <span className="text-amber-400 font-medium flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>مرتجعات كاش (-):</span>
                  </span>
                  <span className="font-mono font-bold text-amber-400">-{formatEgp(returns)} ج.م</span>
                </div>
              )}
            </div>

            {/* Profits in Shift */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-400 block font-medium">عمولات المحافظ</span>
                <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
                  {formatEgp(openShift.totalCommissions || 0)} ج.م
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-400 block font-medium">صافي ربح فوري</span>
                <span className="text-base font-black text-indigo-400 font-mono mt-0.5 block">
                  {formatEgp(openShift.fawryNetProfit || 0)} ج.م
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-900/60 rounded-2xl border border-slate-800 p-6">
            <Vault className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">الوردية مغلقة حالياً</h3>
            <p className="text-xs text-slate-400">
              لا توجد وردية مفتوحة في الوقت الراهن. يمكنك استعراض سجل الورديات السابقة.
            </p>
          </div>
        )
      ) : (
        /* History Tab */
        <div className="space-y-3">
          {shifts.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs font-semibold">
              لا يوجد سجل للورديات السابقة
            </div>
          ) : (
            shifts.map((shift) => {
              const isExpanded = expandedShiftId === shift.id;
              const isClosed = shift.status === 'closed';
              const diff = shift.cashDifference || 0;

              return (
                <div
                  key={shift.id}
                  className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedShiftId(isExpanded ? null : shift.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white font-mono">
                          وردية #{shift.shiftNumber}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                            isClosed
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {isClosed ? 'مغلقة' : 'مفتوحة'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                        <span>{shift.cashierName}</span>
                        <span>•</span>
                        <span>
                          {new Date(shift.startTime).toLocaleDateString('ar-EG', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <div className="text-xs font-black font-mono text-white">
                          {formatEgp(shift.closingCashActual || shift.closingCashSystem || 0)} ج.م
                        </div>
                        {isClosed && (
                          <div
                            className={`text-[10px] font-bold font-mono ${
                              diff === 0
                                ? 'text-emerald-400'
                                : diff > 0
                                ? 'text-blue-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {diff === 0
                              ? 'متطابق تماماً'
                              : diff > 0
                              ? `زيادة +${formatEgp(diff)}`
                              : `عجز ${formatEgp(diff)}`}
                          </div>
                        )}
                      </div>

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 bg-slate-950/70 border-t border-slate-800/80 text-xs space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-slate-300">
                        <div>
                          رصيد الافتتاح: <strong className="font-mono text-white">{formatEgp(shift.openingCash)} ج.م</strong>
                        </div>
                        <div>
                          كاش النظام: <strong className="font-mono text-white">{formatEgp(shift.closingCashSystem || 0)} ج.م</strong>
                        </div>
                        <div>
                          المبيعات كاش: <strong className="font-mono text-white">{formatEgp(shift.totalSalesCash || 0)} ج.م</strong>
                        </div>
                        <div>
                          المصروفات: <strong className="font-mono text-rose-400">{formatEgp(shift.totalExpenses || 0)} ج.م</strong>
                        </div>
                        <div>
                          عمولات المحافظ: <strong className="font-mono text-emerald-400">{formatEgp(shift.totalCommissions || 0)} ج.م</strong>
                        </div>
                        <div>
                          دخل فوري: <strong className="font-mono text-indigo-400">{formatEgp(shift.fawrySalesTotal || 0)} ج.م</strong>
                        </div>
                      </div>

                      {shift.notes && (
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 mt-2">
                          <span className="font-bold text-slate-400 block mb-0.5">ملاحظات الإغلاق:</span>
                          {shift.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
