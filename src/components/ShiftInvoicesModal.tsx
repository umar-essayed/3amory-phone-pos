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
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  RefreshCw,
  Wallet as WalletIcon,
  CheckCircle2,
} from 'lucide-react';
import { db } from '../db';
import { triggerPrint } from '../services/printer';
import { ReturnInvoiceModal } from './ReturnInvoiceModal';
import type { SaleInvoice, WalletTransaction, StoreSettings } from '../types';

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
  // Navigation tab: 'invoices' or 'wallets'
  const [activeTab, setActiveTab] = useState<'invoices' | 'wallets'>('invoices');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'completed' | 'partially_returned' | 'returned'>('all');
  const [walletTypeFilter, setWalletTypeFilter] = useState<'all' | 'cash_in_from_customer' | 'cash_out_to_customer' | 'instapay_transfer' | 'internal_transfer'>('all');

  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [selectedInvoiceForReturn, setSelectedInvoiceForReturn] = useState<SaleInvoice | null>(null);

  const settings = useLiveQuery(() => db.settings.get(1));

  // Fetch sales invoices for this shift (or all if requested)
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

  // Fetch wallet / cash transactions for this shift (or all if requested)
  const walletTransactions =
    useLiveQuery(async () => {
      let list: WalletTransaction[] = [];
      if (shiftId === 'all') {
        list = await db.walletTransactions.orderBy('createdAt').reverse().toArray();
      } else {
        list = await db.walletTransactions.where('shiftId').equals(shiftId).reverse().sortBy('createdAt');
      }
      return list;
    }, [shiftId]) || [];

  // Filter invoices by query and status
  const filteredInvoices = invoices.filter((inv) => {
    if (invoiceStatusFilter !== 'all' && inv.status !== invoiceStatusFilter) {
      return false;
    }

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

  // Filter wallet transactions by query and operation type
  const filteredWalletTransactions = walletTransactions.filter((tx) => {
    if (walletTypeFilter !== 'all' && tx.type !== walletTypeFilter) {
      return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    const matchesId = tx.id.toLowerCase().includes(q);
    const matchesWallet = tx.walletName.toLowerCase().includes(q);
    const matchesCustomer =
      (tx.customerName && tx.customerName.toLowerCase().includes(q)) ||
      (tx.customerPhone && tx.customerPhone.includes(q));
    const matchesCashier = tx.cashierName.toLowerCase().includes(q);
    const matchesNotes = tx.notes ? tx.notes.toLowerCase().includes(q) : false;

    return matchesId || matchesWallet || matchesCustomer || matchesCashier || matchesNotes;
  });

  // Calculate Shift Metrics
  const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalReturned = invoices.reduce((sum, inv) => sum + (inv.returnedAmount || 0), 0);
  const totalWalletCommissions = walletTransactions.reduce(
    (sum, tx) => sum + (tx.netProfit ?? tx.commission ?? 0),
    0
  );
  const netRevenue = Math.max(0, totalSales - totalReturned + totalWalletCommissions);
  const returnedCount = invoices.filter((i) => i.status === 'returned' || i.status === 'partially_returned').length;

  const handlePrintInvoice = (inv: SaleInvoice) => {
    if (settings) {
      triggerPrint({
        type: 'sale_receipt',
        invoice: inv,
        settings,
      });
    }
  };

  const handlePrintWalletTx = (tx: WalletTransaction) => {
    if (settings) {
      triggerPrint({
        type: 'wallet_receipt',
        walletTx: tx,
        settings,
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedInvoiceId((prev) => (prev === id ? null : id));
  };

  const cur = settings?.currency || 'ج';

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
                      ? 'سجل كافة فواتير ومعاملات النظام'
                      : `فواتير ومعاملات الوردية رقم #${shiftNumber ?? ''}`}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    {invoices.length} فاتورة • {walletTransactions.length} معاملة كاش
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {shiftCashier && `الكاشير: ${shiftCashier} | `}
                  استعراض فواتير البيع، مرتجعات الأصناف، ومعاملات فودافون كاش وإنستاباي مع طباعة الإيصالات
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 bg-slate-100/70 border-b border-slate-200">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي مبيعات البضائع</span>
              <span className="text-lg sm:text-xl font-black font-mono text-slate-900 mt-1 block">
                {totalSales.toLocaleString()} {cur}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{invoices.length} فاتورة مسجلة</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-purple-200 shadow-2xs bg-gradient-to-br from-purple-50/40 to-white">
              <span className="text-[11px] font-bold text-purple-700 block">صافي أرباح الكاش (العمولات)</span>
              <span className="text-lg sm:text-xl font-black font-mono text-purple-900 mt-1 block">
                +{totalWalletCommissions.toLocaleString()} {cur}
              </span>
              <span className="text-[10px] text-purple-600 font-semibold">{walletTransactions.length} عملية كاش بالوردية</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs bg-gradient-to-br from-amber-50/40 to-white">
              <span className="text-[11px] font-bold text-amber-700 block">إجمالي المرتجعات ({returnedCount})</span>
              <span className="text-lg sm:text-xl font-black font-mono text-amber-700 mt-1 block">
                {totalReturned.toLocaleString()} {cur}
              </span>
              <span className="text-[10px] text-amber-600 font-semibold">مبالغ مستردة للعملاء</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-emerald-300 shadow-2xs bg-gradient-to-br from-emerald-50/50 to-white">
              <span className="text-[11px] font-bold text-emerald-800 block">صافي إيراد الوردية الفعلي</span>
              <span className="text-lg sm:text-xl font-black font-mono text-emerald-700 mt-1 block">
                {netRevenue.toLocaleString()} {cur}
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold">المبيعات + عمولات الكاش - المرتجع</span>
            </div>
          </div>

          {/* Primary View Switcher Tabs */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 pt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`flex items-center gap-2 pb-3 px-4 text-xs font-black border-b-2 transition cursor-pointer ${
                activeTab === 'invoices'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="h-4 w-4" />
              <span>فواتير المبيعات والمرتجعات</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'invoices' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {invoices.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('wallets')}
              className={`flex items-center gap-2 pb-3 px-4 text-xs font-black border-b-2 transition cursor-pointer ${
                activeTab === 'wallets'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span>معاملات الكاش والمحافظ (فودافون كاش وإنستاباي)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'wallets' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {walletTransactions.length}
              </span>
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
            <div className="relative w-full sm:w-80">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'invoices'
                    ? 'بحث برقم الفاتورة، العميل، الهاتف، الجهاز أو IMEI...'
                    : 'بحث بالمحفظة، هاتف العميل، رقم المعاملة، الكاشير...'
                }
                className="w-full pr-9 pl-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition"
              />
            </div>

            {/* Filter Tabs depending on active tab */}
            {activeTab === 'invoices' ? (
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
                    onClick={() => setInvoiceStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer border ${
                      invoiceStatusFilter === tab.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {(
                  [
                    { id: 'all', label: 'كافة العمليات' },
                    { id: 'cash_in_from_customer', label: 'سحب كاش' },
                    { id: 'cash_out_to_customer', label: 'تحويل كاش' },
                    { id: 'instapay_transfer', label: 'إنستاباي' },
                    { id: 'internal_transfer', label: 'تحويل داخلي' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWalletTypeFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer border ${
                      walletTypeFilter === tab.id
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content Body: Invoices or Wallets */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
            {activeTab === 'invoices' ? (
              /* INVOICES VIEW */
              filteredInvoices.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30 text-slate-500" />
                  <p className="text-sm font-bold text-slate-600">
                    {searchQuery ? 'لا توجد فواتير مطابقة لعملية البحث' : 'لا توجد فواتير بيع مسجلة في هذه الوردية بعد'}
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
                                {inv.total.toLocaleString()} {cur}
                              </span>
                              {inv.returnedAmount && inv.returnedAmount > 0 ? (
                                <span className="font-mono text-[11px] text-amber-700 font-bold block">
                                  (تم رد {inv.returnedAmount.toLocaleString()} {cur})
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
                                onClick={() => handlePrintInvoice(inv)}
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
                                      {item.totalPrice.toLocaleString()} {cur}
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
              )
            ) : (
              /* WALLETS / CASH TRANSACTIONS VIEW */
              filteredWalletTransactions.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Zap className="h-12 w-12 mx-auto mb-3 opacity-30 text-purple-500" />
                  <p className="text-sm font-bold text-slate-600">
                    {searchQuery ? 'لا توجد معاملات كاش مطابقة لعملية البحث' : 'لا توجد معاملات كاش ومحافظ في هذه الوردية بعد'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    أي عمليات تحويل أو سحب كاش أو إنستاباي ستظهر هنا فوراً مع صافي ربح العمولة.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredWalletTransactions.map((tx) => {
                    const isCashIn = tx.type === 'cash_in_from_customer';
                    const isCashOut = tx.type === 'cash_out_to_customer';
                    const isInstapay = tx.type === 'instapay_transfer';
                    const isInternal = tx.type === 'internal_transfer';
                    const profit = tx.netProfit ?? tx.commission ?? 0;

                    return (
                      <div
                        key={tx.id}
                        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-slate-300"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div
                            className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                              isCashIn
                                ? 'bg-emerald-100 text-emerald-700'
                                : isCashOut
                                ? 'bg-rose-100 text-rose-700'
                                : isInstapay
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {isCashIn && <ArrowUpRight className="h-5 w-5" />}
                            {isCashOut && <ArrowDownLeft className="h-5 w-5" />}
                            {isInstapay && <Send className="h-5 w-5" />}
                            {isInternal && <RefreshCw className="h-5 w-5" />}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  isCashIn
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isCashOut
                                    ? 'bg-rose-100 text-rose-800'
                                    : isInstapay
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {isCashIn && 'سحب كاش من العميل'}
                                {isCashOut && 'تحويل كاش للعميل'}
                                {isInstapay && 'تحويل إنستاباي'}
                                {isInternal && 'تحويل داخلي بين الخطوط'}
                              </span>

                              <span className="font-bold text-xs text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                                {tx.walletName}
                              </span>

                              <span className="font-mono text-[11px] text-slate-400">
                                #{tx.id.replace('tx_', '')}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>
                                {new Date(tx.createdAt).toLocaleString('ar-EG', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </span>
                              <span>الكاشير: <strong>{tx.cashierName}</strong></span>
                              {tx.customerPhone && (
                                <span className="text-slate-800 font-bold font-mono">
                                  الهاتف: {tx.customerPhone}
                                </span>
                              )}
                              {tx.customerName && (
                                <span className="text-slate-700">العميل: {tx.customerName}</span>
                              )}
                              {tx.notes && (
                                <span className="text-slate-500 italic">ملاحظات: {tx.notes}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Amount, Net Profit & Print Receipt */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <div className="text-left">
                            <span className="text-[11px] text-slate-400 block font-semibold">مبلغ المعاملة:</span>
                            <span className="font-mono font-black text-base text-slate-900 block">
                              {tx.amount.toLocaleString()} {cur}
                            </span>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-black text-[11px]">
                              +{profit.toLocaleString()} {cur} صافي ربح
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handlePrintWalletTx(tx)}
                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-700 transition cursor-pointer border border-slate-200 shrink-0"
                            title="طباعة إيصال معاملة الكاش"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-3.5 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {activeTab === 'invoices' ? (
                <>
                  معروض: <strong>{filteredInvoices.length}</strong> من أصل {invoices.length} فاتورة
                </>
              ) : (
                <>
                  معروض: <strong>{filteredWalletTransactions.length}</strong> من أصل {walletTransactions.length} معاملة كاش
                </>
              )}
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
