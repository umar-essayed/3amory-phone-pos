import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Receipt,
  X,
  Search,
  Printer,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Package,
  Calendar,
  DollarSign,
  TrendingDown,
  Clock,
  Filter,
} from 'lucide-react';
import { db } from '../db';
import { triggerPrint } from '../services/printer';
import { ReturnInvoiceModal } from './ReturnInvoiceModal';
import type { SaleInvoice, Shift, StoreSettings } from '../types';

interface ShiftInvoicesModalProps {
  shiftId: string;
  shiftNumber?: number;
  shiftCashier?: string;
  activeShiftId: string;
  currentCashierName: string;
  onClose: () => void;
}

export const ShiftInvoicesModal: React.FC<ShiftInvoicesModalProps> = ({
  shiftId,
  shiftNumber,
  shiftCashier,
  activeShiftId,
  currentCashierName,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'partially_returned' | 'returned'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [selectedInvoiceForReturn, setSelectedInvoiceForReturn] = useState<SaleInvoice | null>(null);

  const settings = useLiveQuery(() => db.settings.get(1));

  // Fetch invoices for this shift (or all if requested)
  const invoices =
    useLiveQuery(async () => {
      let list: SaleInvoice[] = [];
      if (shiftId === 'all') {
        list = await db.invoices.orderBy('createdAt').reverse().toArray();
      } else {
        list = await db.invoices.where('shiftId').equals(shiftId).reverse().sortBy('createdAt');
      }
      return list;
    }, [shiftId]) || [];

  // Filter invoices by query and status
  const filteredInvoices = invoices.filter((inv) => {
    // Status filter
    if (statusFilter !== 'all' && inv.status !== statusFilter) {
      return false;
    }

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    const matchesNum = inv.invoiceNumber.toLowerCase().includes(q);
    const matchesCustomer =
      (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
      (inv.customerPhone && inv.customerPhone.includes(q));
    const matchesItems = inv.items.some(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.imei && item.imei.toLowerCase().includes(q))
    );

    return matchesNum || matchesCustomer || matchesItems;
  });

  // Calculate Shift Metrics
  const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalReturned = invoices.reduce((sum, inv) => sum + (inv.returnedAmount || 0), 0);
  const netRevenue = Math.max(0, totalSales - totalReturned);
  const returnedCount = invoices.filter((i) => i.status === 'returned' || i.status === 'partially_returned').length;

  const handlePrint = (inv: SaleInvoice) => {
    if (settings) {
      triggerPrint({
        type: 'sale_receipt',
        invoice: inv,
        settings,
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedInvoiceId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs">
        <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 border border-blue-500/20">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900">
                    {shiftId === 'all'
                      ? 'سجل كافة الفواتير والمبيعات'
                      : `فواتير الوردية رقم #${shiftNumber ?? ''}`}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    {invoices.length} فاتورة
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {shiftCashier && `الكاشير: ${shiftCashier} | `}
                  إدارة واستعراض فواتير البيع وإصدار المرتجعات وطباعة الإيصالات
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-slate-100/60 border-b border-slate-200">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي عدد الفواتير</span>
              <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
                {invoices.length}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي مبيعات الوردية</span>
              <span className="text-xl font-black font-mono text-emerald-600 mt-1 block">
                {totalSales.toLocaleString()} {settings?.currency || 'ج'}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي المرتجعات ({returnedCount})</span>
              <span className="text-xl font-black font-mono text-amber-600 mt-1 block">
                {totalReturned.toLocaleString()} {settings?.currency || 'ج'}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-blue-200 shadow-2xs bg-gradient-to-br from-blue-50/50 to-white">
              <span className="text-[11px] font-bold text-blue-700 block">صافي الإيراد الفعلي</span>
              <span className="text-xl font-black font-mono text-blue-900 mt-1 block">
                {netRevenue.toLocaleString()} {settings?.currency || 'ج'}
              </span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
            <div className="relative w-full sm:w-80">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الفاتورة، العميل، الهاتف، الجهاز أو IMEI..."
                className="w-full pr-9 pl-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  { id: 'all', label: 'كافة الفواتير' },
                  { id: 'completed', label: 'مكتملة فقط' },
                  { id: 'partially_returned', label: 'مرتجع جزئي' },
                  { id: 'returned', label: 'مرتجعة بالكامل' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer border ${
                    statusFilter === tab.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices List / Table */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
            {filteredInvoices.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30 text-slate-500" />
                <p className="text-sm font-bold text-slate-600">
                  {searchQuery ? 'لا توجد فواتير مطابقة لعملية البحث' : 'لا توجد فواتير مسجلة في هذه الوردية بعد'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  أي عمليات بيع تتم خلال الوردية ستظهر هنا فوراً مع تفاصيلها.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInvoices.map((inv) => {
                  const isExpanded = expandedInvoiceId === inv.id;
                  const canReturn = inv.status !== 'returned';

                  return (
                    <div
                      key={inv.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition hover:border-slate-300"
                    >
                      {/* Invoice Main Row */}
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleExpand(inv.id)}
                            className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer shrink-0"
                            title="عرض تفاصيل الأصناف"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-blue-700">
                                {inv.invoiceNumber}
                              </span>

                              {/* Status Badge */}
                              {inv.status === 'completed' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  مكتملة
                                </span>
                              )}
                              {inv.status === 'partially_returned' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  مرتجع جزئي
                                </span>
                              )}
                              {inv.status === 'returned' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                  مرتجعة بالكامل
                                </span>
                              )}

                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {inv.paymentMethod === 'cash' && 'كاش نقدياً'}
                                {inv.paymentMethod === 'wallet' && 'محفظة إلكترونية'}
                                {inv.paymentMethod === 'instapay' && 'إنستاباي'}
                                {inv.paymentMethod === 'debt' && 'آجل'}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>
                                {new Date(inv.createdAt).toLocaleString('ar-EG', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </span>
                              <span>الكاشير: <strong>{inv.cashierName}</strong></span>
                              {inv.customerName && (
                                <span className="text-slate-700 font-bold">
                                  العميل: {inv.customerName}
                                  {inv.customerPhone && ` (${inv.customerPhone})`}
                                </span>
                              )}
                              <span>{inv.items.length} أصناف</span>
                            </div>
                          </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <div className="text-left">
                            <span className="text-xs text-slate-400 block">الإجمالي:</span>
                            <span className="font-mono font-black text-base text-slate-900">
                              {inv.total.toLocaleString()} {settings?.currency || 'ج'}
                            </span>
                            {inv.returnedAmount && inv.returnedAmount > 0 ? (
                              <span className="font-mono text-[11px] text-amber-700 font-bold block">
                                (تم رد {inv.returnedAmount.toLocaleString()} ج)
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Return Button */}
                            {canReturn && (
                              <button
                                type="button"
                                onClick={() => setSelectedInvoiceForReturn(inv)}
                                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition border border-amber-200/80 cursor-pointer shadow-2xs"
                                title="إرجاع أصناف أو الفاتورة بالكامل"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                                <span>مرتجع</span>
                              </button>
                            )}

                            {/* Print Button */}
                            <button
                              type="button"
                              onClick={() => handlePrint(inv)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition cursor-pointer"
                              title="طباعة إيصال الفاتورة"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Items Drawer */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/80 p-4 animate-in fade-in duration-150">
                          <h4 className="text-xs font-bold text-slate-700 mb-2.5">
                            بنود ومحتويات الفاتورة:
                          </h4>

                          <div className="space-y-2">
                            {inv.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs"
                              >
                                <div className="flex items-center gap-2.5">
                                  {item.type === 'phone' ? (
                                    <Smartphone className="h-4 w-4 text-blue-600 shrink-0" />
                                  ) : (
                                    <Package className="h-4 w-4 text-indigo-600 shrink-0" />
                                  )}
                                  <div>
                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                      <span>{item.name}</span>
                                      <span className="text-[10px] text-slate-500 font-normal">
                                        ({item.type === 'phone' ? 'هاتف' : 'إكسسوار'})
                                      </span>
                                    </div>
                                    {item.imei && (
                                      <div className="font-mono text-[11px] text-slate-500">
                                        IMEI: {item.imei}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-4">
                                  <div className="text-slate-600">
                                    الكمية:{' '}
                                    <strong className="font-mono">{item.quantity}</strong>
                                    {item.returnedQuantity && item.returnedQuantity > 0 ? (
                                      <span className="text-amber-700 font-bold mr-1">
                                        (مرتجع: {item.returnedQuantity})
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="font-mono font-bold text-slate-900 min-w-[70px] text-left">
                                    {item.totalPrice.toLocaleString()} {settings?.currency || 'ج'}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {inv.returnReason && (
                            <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                              <RotateCcw className="h-4 w-4 text-amber-600 shrink-0" />
                              <span>
                                <strong>سبب المرتجع الأخير:</strong> {inv.returnReason}
                                {inv.returnedAt &&
                                  ` (${new Date(inv.returnedAt).toLocaleString('ar-EG')})`}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-3.5 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              عدد الفواتير المعروضة: <strong>{filteredInvoices.length}</strong> من أصل{' '}
              {invoices.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>

      {/* Return Invoice Modal Child */}
      {selectedInvoiceForReturn && (
        <ReturnInvoiceModal
          invoice={selectedInvoiceForReturn}
          activeShiftId={activeShiftId}
          cashierName={currentCashierName}
          settings={settings}
          onClose={() => setSelectedInvoiceForReturn(null)}
          onSuccess={() => setSelectedInvoiceForReturn(null)}
        />
      )}
    </>
  );
};
