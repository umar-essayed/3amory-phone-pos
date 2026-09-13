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
} from 'lucide-react';
import { db } from '../db';
import { triggerPrint } from '../services/printer';
import type { SaleInvoice, StoreSettings } from '../types';

export const AnalyticsView: React.FC = () => {
  const invoices = useLiveQuery(() => db.invoices.orderBy('createdAt').reverse().toArray()) || [];
  const walletTx = useLiveQuery(() => db.walletTransactions.toArray()) || [];
  const repairs = useLiveQuery(() => db.repairs.where('status').equals('delivered').toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Date filtering logic
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

  return (
    <div className="space-y-6 pb-12">
      {/* Date Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <span className="text-xs font-bold text-slate-700">الفترة الزمنية للتحليلات:</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDateFilter('today')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              dateFilter === 'today'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => setDateFilter('week')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              dateFilter === 'week'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            آخر 7 أيام
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              dateFilter === 'month'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            هذا الشهر
          </button>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              dateFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
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
            <p className="text-xs text-emerald-100 font-bold">إجمالي الأرباح الصافية (Net Profit)</p>
            <h3 className="text-3xl font-black mt-1 font-mono">
              +{grandNetProfit.toLocaleString()} {settings?.currency || 'ج.م'}
            </h3>
            <span className="text-[10px] text-emerald-200 mt-1 block font-medium">
              أجهزة + إكسسوارات + عمولات كاش + صيانة
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Total Sales Revenue */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">مبيعات الأجهزة والإكسسوارات</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {totalSalesRevenue.toLocaleString()} {settings?.currency || 'ج.م'}
            </h3>
            <span className="text-[10px] text-emerald-600 font-semibold font-mono">
              ربح: +{totalSalesProfit.toLocaleString()} ج
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShoppingCart className="h-6 w-6" />
          </div>
        </div>

        {/* Total Wallet Commissions */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">أرباح فودافون كاش وإنستاباي</p>
            <h3 className="text-2xl font-black text-purple-700 mt-1 font-mono">
              +{totalWalletCommissions.toLocaleString()} {settings?.currency || 'ج.م'}
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
            <p className="text-xs text-slate-500 font-bold">دخل ومصنعيات الصيانة</p>
            <h3 className="text-2xl font-black text-amber-700 mt-1 font-mono">
              {totalRepairRevenue.toLocaleString()} {settings?.currency || 'ج.م'}
            </h3>
            <span className="text-[10px] text-emerald-600 font-semibold font-mono">
              صافي ربح الصيانة: +{totalRepairProfit.toLocaleString()} ج
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Wrench className="h-6 w-6" />
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
                    لا توجد فواتير مطابقة للفترة المحددة.
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
                        <span className="text-slate-400">عميل نقدي سريع</span>
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
                      {inv.total.toLocaleString()} {settings?.currency || 'ج'}
                    </td>
                    <td className="p-3 font-mono font-black text-emerald-600">
                      +{inv.totalProfit.toLocaleString()} ج
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
