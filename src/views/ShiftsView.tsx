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
import type { Shift, Expense, StoreSettings } from '../types';

export const ShiftsView: React.FC<{ activeShiftId: string; cashierName: string }> = ({
  activeShiftId,
  cashierName,
}) => {
  const activeShift = useLiveQuery(() => db.shifts.get(activeShiftId));
  const shiftsHistory =
    useLiveQuery(() => db.shifts.orderBy('startTime').reverse().limit(30).toArray()) || [];
  const expenses =
    useLiveQuery(() => db.expenses.where('shiftId').equals(activeShiftId).toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  // Close shift modal state
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCashInput, setActualCashInput] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // Add Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('نثريات وبوفيه');

  // Handle Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseAmount);
    if (!expenseTitle || !amountNum || amountNum <= 0) {
      alert('يرجى كتابة بيان المصروف والمبلغ بشكل صحيح.');
      return;
    }

    const newExpense: Expense = {
      id: `exp_${Date.now()}`,
      title: expenseTitle.trim(),
      amount: amountNum,
      category: expenseCategory,
      shiftId: activeShiftId,
      recordedBy: cashierName,
      createdAt: new Date().toISOString(),
    };

    await db.transaction('rw', [db.expenses, db.shifts], async () => {
      await db.expenses.add(newExpense);
      const shift = await db.shifts.get(activeShiftId);
      if (shift) {
        await db.shifts.update(activeShiftId, {
          closingCashSystem: shift.closingCashSystem - amountNum,
          totalExpenses: shift.totalExpenses + amountNum,
        });
      }
    });

    setShowExpenseModal(false);
    setExpenseTitle('');
    setExpenseAmount('');
  };

  // Handle Close Shift
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const actual = parseFloat(actualCashInput) || 0;
    const diff = actual - activeShift.closingCashSystem;

    await db.shifts.update(activeShiftId, {
      status: 'closed',
      endTime: new Date().toISOString(),
      closingCashActual: actual,
      cashDifference: diff,
      notes: closingNotes.trim() || undefined,
    });

    if (settings) {
      triggerPrint({
        type: 'shift_report',
        shift: {
          ...activeShift,
          status: 'closed',
          endTime: new Date().toISOString(),
          closingCashActual: actual,
          cashDifference: diff,
        },
        settings,
      });
    }

    setShowCloseModal(false);
    alert('تم إغلاق الوردية بنجاح!');
  };

  // Start New Shift
  const handleStartNewShift = async () => {
    const openingCash = prompt('أدخل رصيد الكاش الافتتاحي في الدرج للوردية الجديدة (ج.م):', '0');
    if (openingCash === null) return;

    const numOpening = parseFloat(openingCash) || 0;
    const newShiftNum = (shiftsHistory[0]?.shiftNumber || 0) + 1;
    const newShiftId = `shift_${Date.now()}`;

    await db.shifts.add({
      id: newShiftId,
      shiftNumber: newShiftNum,
      cashierId: 'usr_cashier',
      cashierName,
      startTime: new Date().toISOString(),
      status: 'open',
      openingCash: numOpening,
      openingWallets: {},
      closingCashSystem: numOpening,
      closingCashActual: 0,
      cashDifference: 0,
      totalSalesCash: 0,
      totalWalletIn: 0,
      totalWalletOut: 0,
      totalCommissions: 0,
      totalExpenses: 0,
      notes: 'وردية جديدة',
    });

    window.location.reload();
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

            <div className="flex items-center gap-2">
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
              <span className="text-xs text-slate-400 block">أرباح عمولات الكاش:</span>
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
            onClick={handleStartNewShift}
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
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-blue-600" />
          <span>سجل الورديات السابقة وتقفيل الدرج</span>
        </h3>

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
                <th className="p-3 text-center">طباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shiftsHistory.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
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
    </div>
  );
};
