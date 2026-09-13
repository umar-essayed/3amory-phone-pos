import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Printer,
  Smartphone,
  Tag,
  Wrench,
  Search,
  FileText,
  Percent,
  Calendar,
  Layers,
  CreditCard,
  Zap,
  BarChart3,
  PieChart,
  ArrowUpRight,
} from 'lucide-react';
import { db } from '../db';
import { triggerPrint } from '../services/printer';
import type { SaleInvoice } from '../types';

export const AnalyticsView: React.FC = () => {
  const invoices = useLiveQuery(() => db.invoices.orderBy('createdAt').reverse().toArray()) || [];
  const walletTx = useLiveQuery(() => db.walletTransactions.toArray()) || [];
  const repairs = useLiveQuery(() => db.repairs.where('status').equals('delivered').toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('week');
  const [searchQuery, setSearchQuery] = useState('');

  const now = new Date();
  const filterDate = (dateStr: string) => {
    if (dateFilter === 'all') return true;
    const d = new Date(dateStr);
    if (dateFilter === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (dateFilter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= oneWeekAgo;
    }
    if (dateFilter === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesDate = filterDate(inv.createdAt);
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customerName && inv.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inv.customerPhone && inv.customerPhone.includes(searchQuery));
    return matchesDate && matchesSearch;
  });

  // Calculate totals
  const totalSalesRevenue = filteredInvoices.reduce((acc, inv) => acc + inv.total, 0);
  const totalSalesProfit = filteredInvoices.reduce((acc, inv) => acc + inv.totalProfit, 0);

  const filteredWalletTx = walletTx.filter((t) => filterDate(t.createdAt));
  const totalWalletCommissions = filteredWalletTx.reduce((acc, t) => acc + t.commission, 0);

  const filteredRepairs = repairs.filter((r) => r.deliveredAt && filterDate(r.deliveredAt));
  const totalRepairRevenue = filteredRepairs.reduce((acc, r) => acc + r.finalCost, 0);
  const totalRepairProfit = filteredRepairs.reduce(
    (acc, r) => acc + (r.finalCost - r.sparePartsCost - r.technicianCommission),
    0
  );

  const grandNetProfit = totalSalesProfit + totalWalletCommissions + totalRepairProfit;
  const totalGrossRevenue = totalSalesRevenue + totalRepairRevenue + totalWalletCommissions;
  const profitMarginPercent = totalGrossRevenue > 0 ? Math.round((grandNetProfit / totalGrossRevenue) * 100) : 0;
  const avgTicket = filteredInvoices.length > 0 ? Math.round(totalSalesRevenue / filteredInvoices.length) : 0;

  // Payment methods breakdown
  const payCash = filteredInvoices.filter((i) => i.paymentMethod === 'cash').reduce((a, b) => a + b.total, 0);
  const payWallet = filteredInvoices.filter((i) => i.paymentMethod === 'wallet').reduce((a, b) => a + b.total, 0);
  const payInstapay = filteredInvoices.filter((i) => i.paymentMethod === 'instapay').reduce((a, b) => a + b.total, 0);
  const payDebt = filteredInvoices.filter((i) => i.paymentMethod === 'debt').reduce((a, b) => a + b.total, 0);

  // Daily Trend Data (Last 7 days)
  const daysData = Array.from({ length: 7 }).map((_, idx) => {
    const targetDate = new Date();
    targetDate.setDate(now.getDate() - (6 - idx));
    const dateStr = targetDate.toISOString().split('T')[0];
    const dayLabel = targetDate.toLocaleDateString('ar-EG', { weekday: 'short' });

    const dayInvoices = invoices.filter((i) => i.createdAt.startsWith(dateStr));
    const dayRevenue = dayInvoices.reduce((a, b) => a + b.total, 0);
    const dayProfit = dayInvoices.reduce((a, b) => a + b.totalProfit, 0);

    return {
      date: dateStr,
      label: dayLabel,
      revenue: dayRevenue,
      profit: dayProfit,
    };
  });

  const maxDayVal = Math.max(...daysData.map((d) => Math.max(d.revenue, d.profit)), 1000);
  const cur = settings?.currency || 'ج.م';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <span className="text-xs font-bold text-slate-700">الفترة الزمنية للتقارير والتحليلات:</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDateFilter('today')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              dateFilter === 'today'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => setDateFilter('week')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              dateFilter === 'week'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            آخر 7 أيام
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              dateFilter === 'month'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            هذا الشهر
          </button>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              dateFilter === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            كل الفترات
          </button>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Grand Net Profit */}
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-5 rounded-2xl shadow-md flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-100 font-bold">إجمالي صافي الربح الحقيقي</p>
            <h3 className="text-3xl font-black mt-1 font-mono">
              +{grandNetProfit.toLocaleString()} {cur}
            </h3>
            <span className="text-[10px] text-emerald-200 mt-1 block font-medium">
              هامش الربح العام: {profitMarginPercent}%
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Sales Revenue */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">إجمالي مبيعات البضائع</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {totalSalesRevenue.toLocaleString()} {cur}
            </h3>
            <span className="text-[10px] text-emerald-600 font-semibold font-mono">
              ربح المبيعات: +{totalSalesProfit.toLocaleString()} {cur}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShoppingCart className="h-6 w-6" />
          </div>
        </div>

        {/* Wallet Commissions */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">أرباح العمولات والمحافظ</p>
            <h3 className="text-2xl font-black text-purple-700 mt-1 font-mono">
              +{totalWalletCommissions.toLocaleString()} {cur}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">
              من {filteredWalletTx.length} عملية تحويل وسحب
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
            <Percent className="h-6 w-6" />
          </div>
        </div>

        {/* Maintenance Revenue */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">أرباح ورشة الصيانة</p>
            <h3 className="text-2xl font-black text-amber-700 mt-1 font-mono">
              +{totalRepairProfit.toLocaleString()} {cur}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">
              إجمالي دخل الصيانة: {totalRepairRevenue.toLocaleString()} {cur}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Wrench className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Bar Chart: Daily Sales & Profit */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h3 className="font-display font-bold text-slate-900 text-sm">
                مخطط المبيعات والأرباح اليومية (آخر 7 أيام)
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-blue-600" />
                <span className="text-slate-600">المبيعات</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="text-slate-600">صافي الربح</span>
              </div>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="h-64 flex items-end justify-between gap-3 pt-6 pb-2 border-b border-slate-100">
            {daysData.map((d, i) => {
              const revHeight = maxDayVal > 0 ? (d.revenue / maxDayVal) * 100 : 0;
              const profitHeight = maxDayVal > 0 ? (d.profit / maxDayVal) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 mb-2 bg-slate-900 text-white text-[10px] p-2 rounded-xl shadow-lg pointer-events-none whitespace-nowrap z-10">
                    <p className="font-bold">{d.label} ({d.date})</p>
                    <p className="text-blue-300">مبيعات: {d.revenue.toLocaleString()} {cur}</p>
                    <p className="text-emerald-300">أرباح: +{d.profit.toLocaleString()} {cur}</p>
                  </div>

                  {/* Dual Bars */}
                  <div className="w-full flex items-end justify-center gap-1.5 h-44">
                    <div
                      style={{ height: `${Math.max(revHeight, 6)}%` }}
                      className="w-4 sm:w-6 bg-gradient-to-t from-blue-700 to-blue-500 rounded-t-lg transition-all duration-300 hover:brightness-110 shadow-xs"
                    />
                    <div
                      style={{ height: `${Math.max(profitHeight, 6)}%` }}
                      className="w-4 sm:w-6 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all duration-300 hover:brightness-110 shadow-xs"
                    />
                  </div>

                  {/* Day Label */}
                  <span className="text-[11px] font-bold text-slate-500 mt-3 group-hover:text-blue-600 transition">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3">
            <span>متوسط قيمة الفاتورة: <strong>{avgTicket.toLocaleString()} {cur}</strong></span>
            <span>عدد فواتير الفترة: <strong>{filteredInvoices.length} فاتورة</strong></span>
          </div>
        </div>

        {/* Side Donut & Payment Methods */}
        <div className="lg:col-span-4 space-y-6">
          {/* Payment Methods Breakdown */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-indigo-600" />
              <h3 className="font-display font-bold text-slate-900 text-sm">طرق تحصيل المبيعات</h3>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">كاش بالدرج</span>
                  <span className="font-mono text-slate-900">{payCash.toLocaleString()} {cur}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${totalSalesRevenue > 0 ? (payCash / totalSalesRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">محافظ (فودافون كاش)</span>
                  <span className="font-mono text-slate-900">{payWallet.toLocaleString()} {cur}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${totalSalesRevenue > 0 ? (payWallet / totalSalesRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">إنستاباي (InstaPay)</span>
                  <span className="font-mono text-slate-900">{payInstapay.toLocaleString()} {cur}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{ width: `${totalSalesRevenue > 0 ? (payInstapay / totalSalesRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">آجل / ديون عملاء</span>
                  <span className="font-mono text-slate-900">{payDebt.toLocaleString()} {cur}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${totalSalesRevenue > 0 ? (payDebt / totalSalesRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Distribution Card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xs">
            <h4 className="font-display text-sm font-bold mb-3 text-slate-200">توزيع مصادر الدخل العام</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/10">
                <span className="text-slate-300">مبيعات البضائع:</span>
                <span className="font-mono font-bold">{totalSalesRevenue.toLocaleString()} {cur}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/10">
                <span className="text-slate-300">ورشة الصيانة:</span>
                <span className="font-mono font-bold">{totalRepairRevenue.toLocaleString()} {cur}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/10">
                <span className="text-slate-300">عمولات المحافظ:</span>
                <span className="font-mono font-bold">+{totalWalletCommissions.toLocaleString()} {cur}</span>
              </div>
              <div className="flex justify-between items-center pt-2 font-bold text-emerald-400">
                <span>إجمالي الدخل المحصل:</span>
                <span className="font-mono text-sm">{totalGrossRevenue.toLocaleString()} {cur}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices History Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span>سجل فواتير المبيعات الصادرة ({filteredInvoices.length})</span>
          </h3>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الفاتورة أو العميل..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-9 pl-3 text-xs font-semibold focus:border-blue-600 focus:bg-white focus:outline-none"
            />
            <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3">رقم الفاتورة</th>
                <th className="p-3">التاريخ والوقت</th>
                <th className="p-3">العميل</th>
                <th className="p-3">الأصناف المباعة</th>
                <th className="p-3">طريقة الدفع</th>
                <th className="p-3">المبلغ الإجمالي</th>
                <th className="p-3">الربح الصافي</th>
                <th className="p-3 text-center">طباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    لا توجد فواتير مسجلة في الفترة المحددة.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-blue-700">{inv.invoiceNumber}</td>
                    <td className="p-3 text-slate-500 font-mono">
                      {new Date(inv.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-3">
                      {inv.customerName ? (
                        <span className="font-semibold text-slate-800">
                          {inv.customerName} {inv.customerPhone && `(${inv.customerPhone})`}
                        </span>
                      ) : (
                        <span className="text-slate-400">عميل نقدي</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="max-w-[220px] truncate text-slate-700">
                        {inv.items.map((i) => `${i.name} (×${i.quantity})`).join('، ')}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-[10px]">
                        {inv.paymentMethod === 'cash' && 'كاش'}
                        {inv.paymentMethod === 'wallet' && 'محفظة'}
                        {inv.paymentMethod === 'instapay' && 'إنستاباي'}
                        {inv.paymentMethod === 'debt' && 'آجل'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-black text-slate-900">
                      {inv.total.toLocaleString()} {cur}
                    </td>
                    <td className="p-3 font-mono font-black text-emerald-600">
                      +{inv.totalProfit.toLocaleString()} {cur}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (settings) {
                            triggerPrint({
                              type: 'sale_receipt',
                              invoice: inv,
                              settings,
                            });
                          }
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
