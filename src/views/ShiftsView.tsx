import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Clock,
  DollarSign,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Layers,
  History,
} from 'lucide-react';
import { db } from '../db';
import { triggerPrint } from '../services/printer';
import { useModal } from '../context/ModalContext';
import { ShiftInvoicesModal } from '../components/ShiftInvoicesModal';
import type { Shift, Expense, StoreSettings, User } from '../types';

export const ShiftsView: React.FC<{
  activeShiftId: string;
  cashierName: string;
  currentUser?: User | null;
}> = ({
  activeShiftId,
  cashierName,
  currentUser,
}) => {
  const { showAlert, showToast } = useModal();
  const activeShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());
  const shiftsHistory =
    useLiveQuery(() => db.shifts.orderBy('startTime').reverse().limit(50).toArray()) || [];
  const currentShiftId = activeShift?.id || (activeShiftId !== 'shift_default' ? activeShiftId : '');
  const expenses =
    useLiveQuery(() => (currentShiftId ? db.expenses.where('shiftId').equals(currentShiftId).toArray() : [])) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  // Active shift invoices count
  const activeShiftInvoicesCount =
    useLiveQuery(() => (currentShiftId ? db.invoices.where('shiftId').equals(currentShiftId).count() : 0)) || 0;
  // Active shift wallet transactions count
  const activeShiftWalletCount =
    useLiveQuery(() => (currentShiftId ? db.walletTransactions.where('shiftId').equals(currentShiftId).count() : 0)) || 0;

  // Auto-heal active shift if drawer balance is negative
  React.useEffect(() => {
    if (activeShift && activeShift.closingCashSystem < 0) {
      const repaired = Math.max(
        0,
        (activeShift.openingCash || 0) +
          (activeShift.totalSalesCash || 0) +
          (activeShift.totalCommissions || 0) -
          (activeShift.totalExpenses || 0) -
          (activeShift.totalReturnsCash || 0)
      );
      db.shifts.update(activeShift.id, { closingCashSystem: repaired });
    }
  }, [activeShift]);

  // Selected shift for viewing invoices modal
  const [selectedShiftForInvoices, setSelectedShiftForInvoices] = useState<{
    id: string;
    number?: number;
    cashier?: string;
  } | null>(null);

  // Close shift modal state
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCashInput, setActualCashInput] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [fawrySalesTotalInput, setFawrySalesTotalInput] = useState('');
  const [fawryNetProfitInput, setFawryNetProfitInput] = useState('');

  // Open shift modal state
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openCashInput, setOpenCashInput] = useState('0');
  const [openShiftNotes, setOpenShiftNotes] = useState('');

  // Last closed shift and its balance
  const lastClosedShift = shiftsHistory.find((s) => s.status === 'closed');
  const lastClosingBalance = lastClosedShift ? lastClosedShift.closingCashActual : 0;
  const isCashier = currentUser?.role === 'cashier';

  // Add Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('نثريات وبوفيه');

  // Handle Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShiftId) {
      showAlert('يرجى فتح وردية أولاً لتسجيل المصروفات.', 'لا توجد وردية', 'warning');
      return;
    }
    const amountNum = parseFloat(expenseAmount);
    if (!expenseTitle || !amountNum || amountNum <= 0) {
      showAlert('يرجى كتابة بيان المصروف والمبلغ بشكل صحيح.', 'بيانات ناقصة', 'warning');
      return;
    }

    const newExpense: Expense = {
      id: `exp_${Date.now()}`,
      title: expenseTitle.trim(),
      amount: amountNum,
      category: expenseCategory,
      shiftId: currentShiftId,
      recordedBy: cashierName,
      createdAt: new Date().toISOString(),
    };

    await db.transaction('rw', [db.expenses, db.shifts], async () => {
      await db.expenses.add(newExpense);
      const shift = await db.shifts.get(currentShiftId);
      if (shift) {
        await db.shifts.update(currentShiftId, {
          closingCashSystem: shift.closingCashSystem - amountNum,
          totalExpenses: shift.totalExpenses + amountNum,
        });
      }
    });

    setShowExpenseModal(false);
    setExpenseTitle('');
    setExpenseAmount('');
    showToast('تم تسجيل المصروف النثري وخصمه من الدرج بنجاح');
  };

  // Handle Close Shift
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const shiftToClose = activeShift;
    const actual = parseFloat(actualCashInput) || 0;
    const fawrySales = parseFloat(fawrySalesTotalInput) || 0;
    const fawryProfit = parseFloat(fawryNetProfitInput) || 0;

    // Immediately close modal to avoid any race condition
    setShowCloseModal(false);

    try {
      // Calculate breakdown of shift invoices
      const shiftInvoices = await db.invoices.where('shiftId').equals(shiftToClose.id).toArray();
      const cashSales = shiftInvoices
        .filter((inv) => inv.paymentMethod === 'cash' && inv.status !== 'canceled')
        .reduce((sum, inv) => sum + inv.total, 0);
      const walletSales = shiftInvoices
        .filter((inv) => (inv.paymentMethod === 'wallet' || inv.paymentMethod === 'instapay') && inv.status !== 'canceled')
        .reduce((sum, inv) => sum + inv.total, 0);
      const debtSales = shiftInvoices
        .filter((inv) => inv.paymentMethod === 'debt' && inv.status !== 'canceled')
        .reduce((sum, inv) => sum + inv.total, 0);
      const totalSalesCount = shiftInvoices.filter((inv) => inv.status !== 'canceled').length;

      // If Fawry profit entered, record transaction & add to commissions and drawer
      if (fawryProfit > 0) {
        await db.walletTransactions.add({
          id: `wtx_fawry_${Date.now()}`,
          walletId: 'fawry_system',
          walletName: 'مكن فوري / دفع إلكتروني',
          type: 'cash_in_from_customer',
          amount: fawrySales || fawryProfit,
          networkFee: 0,
          commission: fawryProfit,
          netProfit: fawryProfit,
          shiftId: shiftToClose.id,
          cashierName,
          notes: 'دخل / أرباح مكن فوري وكروت شحن',
          createdAt: new Date().toISOString(),
        });
      }

      const updatedCommissions = (shiftToClose.totalCommissions || 0) + fawryProfit;
      const updatedSystemCash = shiftToClose.closingCashSystem + fawryProfit;
      const diff = actual - updatedSystemCash;
      const closedTime = new Date().toISOString();

      await db.shifts.update(shiftToClose.id, {
        status: 'closed',
        endTime: closedTime,
        closedAt: closedTime,
        closingCashActual: actual,
        closingCashSystem: updatedSystemCash,
        cashDifference: diff,
        totalSalesCash: cashSales,
        totalSalesWallet: walletSales,
        totalSalesDebt: debtSales,
        totalSalesCount,
        totalCommissions: updatedCommissions,
        fawrySalesTotal: fawrySales,
        fawryNetProfit: fawryProfit,
        notes: closingNotes.trim() || undefined,
      });

      if (settings) {
        triggerPrint({
          type: 'shift_report',
          shift: {
            ...shiftToClose,
            status: 'closed',
            endTime: closedTime,
            closingCashActual: actual,
            closingCashSystem: updatedSystemCash,
            cashDifference: diff,
            totalSalesCash: cashSales,
            totalSalesWallet: walletSales,
            totalSalesDebt: debtSales,
            totalSalesCount,
            totalCommissions: updatedCommissions,
            fawrySalesTotal: fawrySales,
            fawryNetProfit: fawryProfit,
          },
          settings,
        });
      }

      showToast('تم تقفيل الوردية وجرد الدرج بنجاح!');
    } catch (err: any) {
      console.error('Error closing shift:', err);
      showAlert(`حدث خطأ أثناء تقفيل الوردية: ${err?.message || err}`, 'خطأ في التقفيل', 'error');
    }
  };

  // Open New Shift Dialog
  const openNewShiftDialog = () => {
    setOpenCashInput(lastClosingBalance.toString());
    setOpenShiftNotes('');
    setShowOpenModal(true);
  };

  // Confirm Start Shift
  const handleConfirmStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const numOpening = parseFloat(openCashInput) || 0;
    const newShiftNum = (shiftsHistory[0]?.shiftNumber || 0) + 1;
    const newShiftId = `shift_${Date.now()}`;

    await db.shifts.add({
      id: newShiftId,
      shiftNumber: newShiftNum,
      cashierId: currentUser?.id || 'usr_cashier',
      cashierName,
      startTime: new Date().toISOString(),
      status: 'open',
      openingCash: numOpening,
      openingWallets: {},
      closingCashSystem: numOpening,
      closingCashActual: 0,
      cashDifference: 0,
      totalSalesCash: 0,
      totalSalesWallet: 0,
      totalSalesDebt: 0,
      totalSalesCount: 0,
      totalWalletIn: 0,
      totalWalletOut: 0,
      totalCommissions: 0,
      totalExpenses: 0,
      notes: openShiftNotes.trim() || 'وردية جديدة',
    });

    setShowOpenModal(false);
    showToast(`تم فتح الوردية #${newShiftNum} بنجاح!`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Active Shift Banner */}
      {activeShift && activeShift.status === 'open' ? (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-indigo-900/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-indigo-800/40 pb-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black">الوردية الحالية #{activeShift.shiftNumber}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    نشطة ومفتوحة
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  الكاشير: <strong>{activeShift.cashierName}</strong> | بدأت:{' '}
                  {new Date(activeShift.startTime).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedShiftForInvoices({
                    id: activeShift.id,
                    number: activeShift.shiftNumber,
                    cashier: activeShift.cashierName,
                  })
                }
                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 text-xs font-black shadow-md hover:shadow-lg transition active:scale-95 cursor-pointer border border-blue-400/40"
              >
                <Receipt className="h-4 w-4" />
                <span>فواتير ومعاملات الوردية</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold">
                  {activeShiftInvoicesCount + activeShiftWalletCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowExpenseModal(true)}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 text-xs font-bold transition cursor-pointer"
              >
                <Plus className="h-4 w-4 text-amber-400" />
                <span>تسجيل مصروف نثري</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActualCashInput(activeShift.closingCashSystem.toString());
                  setShowCloseModal(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 text-xs font-black shadow transition cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>تقفيل وإغلاق الوردية (الجرد)</span>
              </button>
            </div>
          </div>

          {/* Quick Shift Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
            <div>
              <span className="text-xs text-slate-400 block">الكاش الافتتاحي:</span>
              <span className="text-lg font-black font-mono mt-1 block">
                {activeShift.openingCash.toLocaleString()} {settings?.currency || 'ج'}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400 block">مبيعات نقدية في الوردية:</span>
              <span className="text-lg font-black font-mono text-emerald-400 mt-1 block">
                +{activeShift.totalSalesCash.toLocaleString()} {settings?.currency || 'ج'}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400 block">أرباح عمولات الكاش (صافي الربح):</span>
              <span className="text-lg font-black font-mono text-purple-400 mt-1 block">
                +{activeShift.totalCommissions.toLocaleString()} {settings?.currency || 'ج'}
              </span>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-xs text-indigo-300 block font-bold">الكاش المفترض بالدرج الآن:</span>
              <span className="text-2xl font-black font-mono text-white mt-0.5 block">
                {activeShift.closingCashSystem.toLocaleString()} {settings?.currency || 'ج'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
            <div>
              <h3 className="font-bold text-amber-900 text-base">لا توجد وردية مفتوحة حالياً</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                يرجى فتح وردية جديدة وتحديد العهدة الافتتاحية لبدء تسجيل المبيعات.
              </p>
            </div>
          </div>
          <button
            onClick={openNewShiftDialog}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-3 rounded-xl shadow transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>فتح وردية جديدة</span>
          </button>
        </div>
      )}

      {/* Expenses in Active Shift */}
      {expenses.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-red-500" />
            <span>المصروفات النثرية المسجلة بالوردية ({expenses.length})</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {expenses.map((exp) => (
              <div key={exp.id} className="p-3 rounded-xl bg-red-50/50 border border-red-100 flex justify-between items-center text-xs">
                <div>
                  <strong className="text-slate-800 block">{exp.title}</strong>
                  <span className="text-[10px] text-slate-400">{exp.category}</span>
                </div>
                <span className="font-mono font-black text-red-700 text-sm">
                  -{exp.amount.toLocaleString()} {settings?.currency || 'ج'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shifts History Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <History className="h-4 w-4 text-blue-600" />
            <span>سجل الورديات السابقة وتقفيل الدرج</span>
          </h3>

          <button
            type="button"
            onClick={() =>
              setSelectedShiftForInvoices({
                id: 'all',
                number: undefined,
                cashier: undefined,
              })
            }
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer border border-slate-200 shadow-2xs self-start sm:self-auto"
          >
            <Receipt className="h-4 w-4 text-blue-600" />
            <span>كافة فواتير ومعاملات النظام (المبيعات والكاش)</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3">رقم الوردية</th>
                <th className="p-3">الكاشير</th>
                <th className="p-3">وقت الفتح</th>
                <th className="p-3">وقت الإغلاق</th>
                <th className="p-3">الكاش النظامي</th>
                <th className="p-3">الكاش الفعلي</th>
                <th className="p-3">العجز / الزيادة</th>
                <th className="p-3 text-center">فواتير ومعاملات الوردية</th>
                <th className="p-3 text-center">تقرير التقفيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shiftsHistory.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono font-black text-blue-700">#{s.shiftNumber}</td>
                  <td className="p-3 font-semibold">{s.cashierName}</td>
                  <td className="p-3 text-slate-500 font-mono">
                    {new Date(s.startTime).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="p-3 text-slate-500 font-mono">
                    {s.endTime
                      ? new Date(s.endTime).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })
                      : 'مفتوحة'}
                  </td>
                  <td className="p-3 font-mono font-bold">{s.closingCashSystem.toLocaleString()} ج</td>
                  <td className="p-3 font-mono font-bold">
                    {s.status === 'closed' ? `${s.closingCashActual.toLocaleString()} ج` : '-'}
                  </td>
                  <td className="p-3 font-mono">
                    {s.status === 'closed' ? (
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded font-bold ${
                          s.cashDifference === 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.cashDifference > 0
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {s.cashDifference === 0
                          ? 'مطابق (0)'
                          : s.cashDifference > 0
                          ? `+${s.cashDifference} ج`
                          : `${s.cashDifference} ج`}
                      </span>
                    ) : (
                      <span className="text-slate-400">قيد العمل</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedShiftForInvoices({
                          id: s.id,
                          number: s.shiftNumber,
                          cashier: s.cashierName,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition cursor-pointer border border-blue-200/80 shadow-2xs active:scale-95"
                      title="استعراض فواتير ومعاملات كاش ومرتجعات هذه الوردية"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      <span>فواتير ومعاملات</span>
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (settings) {
                          triggerPrint({
                            type: 'shift_report',
                            shift: s,
                            settings,
                          });
                        }
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition cursor-pointer"
                      title="طباعة تقرير الوردية Z-Report"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Close Shift */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-red-600" />
              <span>تقفيل وإغلاق الوردية (جرد الدرج)</span>
            </h3>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span>الكاش المفترض بالدرج (حسابات السيستم):</span>
                <strong className="font-mono text-sm text-blue-700">
                  {activeShift.closingCashSystem.toLocaleString()} {settings?.currency || 'ج.م'}
                </strong>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>إجمالي مبيعات الكاش بالوردية:</span>
                <span className="font-mono">{activeShift.totalSalesCash.toLocaleString()} ج</span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ الفعلي المعدود بالدرج يدوياً ({settings?.currency || 'ج.م'})
                </label>
                <input
                  type="number"
                  step="any"
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="w-full rounded-xl border-2 border-red-300 p-3 text-lg font-black font-mono text-slate-900 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              {actualCashInput && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex justify-between ${
                    parseFloat(actualCashInput) - activeShift.closingCashSystem === 0
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : parseFloat(actualCashInput) - activeShift.closingCashSystem > 0
                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  <span>الفارق المحسوب:</span>
                  <span>
                    {parseFloat(actualCashInput) - activeShift.closingCashSystem === 0 && 'مطابق تماماً (لا عجز ولا زيادة)'}
                    {parseFloat(actualCashInput) - activeShift.closingCashSystem > 0 &&
                      `زيادة بالدرج +${(parseFloat(actualCashInput) - activeShift.closingCashSystem).toLocaleString()} ج`}
                    {parseFloat(actualCashInput) - activeShift.closingCashSystem < 0 &&
                      `عجز بالدرج ${(parseFloat(actualCashInput) - activeShift.closingCashSystem).toLocaleString()} ج`}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-purple-50/60 p-3 rounded-xl border border-purple-200/80">
                <div>
                  <label className="block text-xs font-bold text-purple-950 mb-1">
                    إجمالي مبيعات مكن فوري / الكروت (اختياري)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fawrySalesTotalInput}
                    onChange={(e) => setFawrySalesTotalInput(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-purple-200 bg-white p-2.5 text-sm font-mono text-slate-900 focus:border-purple-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-950 mb-1">
                    صافي ربح فوري / الكروت (اختياري - يضاف للدرج)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={fawryNetProfitInput}
                    onChange={(e) => setFawryNetProfitInput(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-purple-200 bg-white p-2.5 text-sm font-mono text-slate-900 focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات التقفيل</label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="أي ملاحظات حول العجز أو النثريات..."
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs focus:border-red-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-2 text-xs font-bold shadow"
                >
                  تأكيد الإغلاق والطباعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Open New Shift */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span>فتح وردية عمل جديدة</span>
            </h3>

            {/* Last shift closing cash banner */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-4 text-xs">
              <div className="flex justify-between items-center mb-2">
                <span className="text-blue-900 font-bold">آخر رصيد تم إغلاق الدرج به:</span>
                <span className="font-mono text-base font-black text-blue-700">
                  {lastClosingBalance.toLocaleString()} {settings?.currency || 'ج.م'}
                </span>
              </div>
              {!isCashier ? (
                <button
                  type="button"
                  onClick={() => setOpenCashInput(lastClosingBalance.toString())}
                  className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  استخدام رصيد الإغلاق السابق ({lastClosingBalance.toLocaleString()} ج)
                </button>
              ) : (
                <p className="text-[11px] text-blue-800 font-semibold">
                  ⚠️ حساب الكاشير مقفول إجبارياً على استلام عهدة مطابقة لآخر رصيد إغلاق بالدرج.
                </p>
              )}
            </div>

            <form onSubmit={handleConfirmStartShift} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رصيد الكاش الافتتاحي في الدرج ({settings?.currency || 'ج.م'}) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={openCashInput}
                  onChange={(e) => setOpenCashInput(e.target.value)}
                  disabled={isCashier}
                  className={`w-full rounded-xl border-2 p-3 text-lg font-black font-mono focus:outline-none ${
                    isCashier
                      ? 'bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed'
                      : 'border-blue-300 focus:border-blue-600 text-slate-900'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات البداية (اختياري)</label>
                <input
                  type="text"
                  value={openShiftNotes}
                  onChange={(e) => setOpenShiftNotes(e.target.value)}
                  placeholder="مثال: استلام العهدة كاملة من الكاشير السابق..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold shadow cursor-pointer"
                >
                  تأكيد فتح الوردية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Expense */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-600" />
              <span>تسجيل مصروف نثري من الدرج</span>
            </h3>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">بيان المصروف</label>
                <input
                  type="text"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="مثال: شاي وسكر، بوفيه، إكرامية نقل..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value="نثريات وبوفيه">نثريات وبوفيه</option>
                  <option value="فواتير وكهرباء">فواتير وكهرباء</option>
                  <option value="صيانة المحل">صيانة المحل</option>
                  <option value="رواتب وسلف">رواتب وسلف</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المخصوم من الدرج</label>
                <input
                  type="number"
                  step="any"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 text-xs font-bold shadow"
                >
                  خصم من الدرج وحفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Shift Invoices & Returns Inspector */}
      {selectedShiftForInvoices && (
        <ShiftInvoicesModal
          shiftId={selectedShiftForInvoices.id}
          shiftNumber={selectedShiftForInvoices.number}
          shiftCashier={selectedShiftForInvoices.cashier}
          activeShiftId={activeShiftId}
          currentCashierName={cashierName}
          onClose={() => setSelectedShiftForInvoices(null)}
        />
      )}
    </div>
  );
};
