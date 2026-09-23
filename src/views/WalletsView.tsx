import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Printer,
  Smartphone,
  CreditCard,
  Search,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Percent,
  History,
  Edit2,
  X,
  Trash2,
  Zap,
  Check,
} from 'lucide-react';
import { db } from '../db';
import { triggerPrint } from '../services/printer';
import { syncDataToFirebase } from '../services/firebase';
import { useModal } from '../context/ModalContext';
import type { StoreWallet, WalletTransaction } from '../types';

export const WalletsView: React.FC<{ activeShiftId: string; cashierName: string }> = ({
  activeShiftId,
  cashierName,
}) => {
  const { showAlert, showConfirm, showToast } = useModal();
  const openShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());
  const wallets = useLiveQuery(() => db.wallets.filter((w) => w.isActive).toArray()) || [];
  const allTransactions = useLiveQuery(() => db.walletTransactions.toArray()) || [];
  const transactions =
    useLiveQuery(() =>
      db.walletTransactions.orderBy('createdAt').reverse().limit(50).toArray()
    ) || [];
  const settings = useLiveQuery(async () => {
    const s = await db.settings.get(1);
    if (s) return s;
    return await db.settings.toCollection().first();
  });

  // Quick Operation Form State
  const [txType, setTxType] = useState<'cash_in_from_customer' | 'cash_out_to_customer' | 'instapay_transfer' | 'internal_transfer'>('cash_in_from_customer');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [targetWalletId, setTargetWalletId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [commission, setCommission] = useState<string>('');
  const [isCustomCommission, setIsCustomCommission] = useState<boolean>(false);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [showOptionalFields, setShowOptionalFields] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Modals
  const [showNewWalletModal, setShowNewWalletModal] = useState<boolean>(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState<StoreWallet['type']>('vodafone');
  const [newWalletAccount, setNewWalletAccount] = useState('');
  const [newWalletBalance, setNewWalletBalance] = useState('');
  const [newWalletDailyLimit, setNewWalletDailyLimit] = useState('');
  const [newWalletMonthlyLimit, setNewWalletMonthlyLimit] = useState('');
  const [editingWallet, setEditingWallet] = useState<StoreWallet | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Auto-select first wallet if none selected
  useEffect(() => {
    if (wallets.length > 0 && (!selectedWalletId || !wallets.find((w) => w.id === selectedWalletId))) {
      setSelectedWalletId(wallets[0].id);
    }
  }, [wallets, selectedWalletId]);

  // Calculate Commission based on store settings (Rate per 1,000 + Minimum fee)
  const calculateDefaultCommission = (val: number, type: string) => {
    if (!val || val <= 0 || type === 'internal_transfer') return 0;

    const rules = settings?.commissionRules;
    let feePerThousand = 10;
    let minFee = 5;

    if (type === 'cash_out_to_customer') {
      feePerThousand = rules?.transferFeePerThousand ?? 10;
      minFee = rules?.minTransferFee ?? 5;
    } else if (type === 'cash_in_from_customer') {
      feePerThousand = rules?.withdrawFeePerThousand ?? 10;
      minFee = rules?.minWithdrawFee ?? 5;
    } else if (type === 'instapay_transfer') {
      feePerThousand = rules?.instapayFeePerThousand ?? 5;
      minFee = rules?.minInstapayFee ?? 5;
    }

    const calculated = Math.ceil((val / 1000) * feePerThousand);
    return Math.max(minFee, calculated);
  };

  // Active rate rule for current transaction type
  const activeRateRule = useMemo(() => {
    const rules = settings?.commissionRules;
    if (txType === 'cash_out_to_customer') {
      return {
        label: 'تحويل كاش للعميل',
        feePerThousand: rules?.transferFeePerThousand ?? 10,
        minFee: rules?.minTransferFee ?? 5,
      };
    }
    if (txType === 'cash_in_from_customer') {
      return {
        label: 'سحب كاش من العميل',
        feePerThousand: rules?.withdrawFeePerThousand ?? 10,
        minFee: rules?.minWithdrawFee ?? 5,
      };
    }
    if (txType === 'instapay_transfer') {
      return {
        label: 'تحويل إنستاباي',
        feePerThousand: rules?.instapayFeePerThousand ?? 5,
        minFee: rules?.minInstapayFee ?? 5,
      };
    }
    return null;
  }, [settings, txType]);

  // Auto-update commission directly from settings whenever amount, type, or settings change
  useEffect(() => {
    const num = parseFloat(amount) || 0;
    if (!isCustomCommission && num > 0) {
      setCommission(calculateDefaultCommission(num, txType).toString());
    } else if (!isCustomCommission && !amount) {
      setCommission('');
    }
  }, [settings, txType, amount, isCustomCommission]);

  const handleAmountChange = (valStr: string) => {
    setAmount(valStr);
    const num = parseFloat(valStr) || 0;
    if (!isCustomCommission) {
      setCommission(num > 0 ? calculateDefaultCommission(num, txType).toString() : '');
    }
  };

  const handleTypeChange = (type: typeof txType) => {
    setTxType(type);
    setIsCustomCommission(false);
    const num = parseFloat(amount) || 0;
    if (num > 0) {
      setCommission(calculateDefaultCommission(num, type).toString());
    }
    amountInputRef.current?.focus();
  };

  const setQuickAmount = (val: number) => {
    handleAmountChange(val.toString());
    amountInputRef.current?.focus();
  };

  // Ultra-Fast Transaction Execution
  const handleExecuteTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const numAmount = parseFloat(amount);
    const numCommission = parseFloat(commission) || 0;

    if (!numAmount || numAmount <= 0) {
      showAlert('يرجى كتابة المبلغ المطلوب أولاً.', 'أدخل المبلغ', 'warning');
      amountInputRef.current?.focus();
      return;
    }

    if (wallets.length === 0) {
      showAlert('لا توجد محافظ مسجلة! يرجى إضافة محفظة أو خط أولاً من زر (+) بالأعلى.', 'لا توجد محافظ', 'warning');
      setShowNewWalletModal(true);
      return;
    }

    if (!openShift) {
      showAlert('لا يمكن تنفيذ أي عملية تحويل بدون وجود وردية عمل مفتوحة حالياً! يرجى فتح وردية أولاً من قسم الورديات.', 'الوردية مغلقة', 'warning');
      return;
    }

    const currentWallet = wallets.find((w) => w.id === selectedWalletId) || wallets[0];

    // Daily Limit verification for Outgoing Transfers (Cash Out / Instapay)
    // Rule: Deposits from customer (Cash In) are unlimited and do not consume limit.
    const isOutgoing = txType === 'cash_out_to_customer' || txType === 'instapay_transfer';
    if (isOutgoing && currentWallet.dailyLimit && currentWallet.dailyLimit > 0) {
      const todayStr = new Date().toDateString();
      const currentTodayOut = allTransactions
        .filter(
          (t) =>
            t.walletId === currentWallet.id &&
            (t.type === 'cash_out_to_customer' || t.type === 'instapay_transfer') &&
            new Date(t.createdAt).toDateString() === todayStr
        )
        .reduce((sum, t) => sum + t.amount, 0);

      if (currentTodayOut + numAmount > currentWallet.dailyLimit) {
        const proceed = await showConfirm(
          `تنبيه: هذه العملية ستتجاوز الحد اليومي للتحويلات الصادرة على هذا الخط!\n\n` +
          `الحد اليومي المحدد: ${currentWallet.dailyLimit.toLocaleString()} ج\n` +
          `المحول اليوم حتى الآن: ${currentTodayOut.toLocaleString()} ج\n` +
          `المطلوب تحويله الآن: ${numAmount.toLocaleString()} ج\n` +
          `الإجمالي سيكون: ${(currentTodayOut + numAmount).toLocaleString()} ج\n\n` +
          `هل تريد المتابعة وتأكيد العملية؟`,
          'تجاوز الليميت اليومي',
          { confirmText: 'نعم، متابعة التحويل', cancelText: 'إلغاء', danger: true }
        );
        if (!proceed) return;
      }
    }

    // Balance check for cash out / transfers
    if (
      (txType === 'cash_out_to_customer' || txType === 'instapay_transfer' || txType === 'internal_transfer') &&
      currentWallet.balance < numAmount
    ) {
      const proceed = await showConfirm(
        `تنبيه: رصيد المحفظة الحالي (${currentWallet.balance.toLocaleString()} ج) أقل من المبلغ المطلوب (${numAmount.toLocaleString()} ج).\nهل تريد المتابعة على أية حال؟`,
        'رصيد المحفظة أقل من المبلغ',
        { confirmText: 'نعم، متابعة', cancelText: 'إلغاء', danger: true }
      );
      if (!proceed) return;
    }

    const txId = `tx_${Date.now()}`;
    const newTx: WalletTransaction = {
      id: txId,
      walletId: currentWallet.id,
      walletName: currentWallet.name,
      type: txType,
      amount: numAmount,
      commission: numCommission,
      networkFee: 0,
      netProfit: numCommission,
      customerPhone: customerPhone.trim() || undefined,
      customerName: customerName.trim() || undefined,
      shiftId: openShift.id,
      cashierName,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    // DB Transaction
    await db.transaction('rw', [db.wallets, db.walletTransactions, db.shifts], async () => {
      await db.walletTransactions.add(newTx);

      if (txType === 'cash_out_to_customer' || txType === 'instapay_transfer') {
        await db.wallets.update(currentWallet.id, { balance: currentWallet.balance - numAmount });
      } else if (txType === 'cash_in_from_customer') {
        await db.wallets.update(currentWallet.id, { balance: currentWallet.balance + numAmount });
      } else if (txType === 'internal_transfer' && targetWalletId) {
        const targetWallet = await db.wallets.get(targetWalletId);
        if (targetWallet) {
          await db.wallets.update(currentWallet.id, { balance: currentWallet.balance - numAmount });
          await db.wallets.update(targetWallet.id, { balance: targetWallet.balance + numAmount });
        }
      }

      const shift = await db.shifts.get(openShift.id);
      if (shift) {
        let cashDelta = 0;
        if (txType === 'cash_out_to_customer' || txType === 'instapay_transfer') {
          // العميل يعطي المحل كاش (المبلغ المراد تحويله + العمولة)
          cashDelta = numAmount + numCommission;
        } else if (txType === 'cash_in_from_customer') {
          // المحل يسلم العميل كاش من الدرج (المبلغ المستلم إلكترونياً ناقص العمولة)
          cashDelta = -(numAmount - numCommission);
        }

        await db.shifts.update(openShift.id, {
          closingCashSystem: shift.closingCashSystem + cashDelta,
          totalCommissions: (shift.totalCommissions || 0) + numCommission,
          totalWalletIn: txType === 'cash_out_to_customer' ? (shift.totalWalletIn || 0) + numAmount : shift.totalWalletIn,
          totalWalletOut: txType === 'cash_in_from_customer' ? (shift.totalWalletOut || 0) + numAmount : shift.totalWalletOut,
        });
      }
    });

    showToast(`⚡ تم تنفيذ العملية بنجاح! ربح عمولة: +${numCommission} ج`, 'success');

    // Reset for next transaction immediately
    setAmount('');
    setCommission('');
    setCustomerPhone('');
    setCustomerName('');
    setNotes('');
    setIsCustomCommission(false);
    setShowOptionalFields(false);
    amountInputRef.current?.focus();
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName || !newWalletAccount) {
      showAlert('يرجى كتابة اسم المحفظة ورقم الحساب/الهاتف.', 'بيانات ناقصة', 'warning');
      return;
    }

    const colors: Record<string, string> = {
      vodafone: '#e60000',
      instapay: '#800080',
      orange: '#ff6600',
      etisalat: '#719e19',
      we: '#551a8b',
      bank: '#1e3a8a',
      other: '#475569',
    };

    const dLimit = parseFloat(newWalletDailyLimit) || undefined;
    const mLimit = parseFloat(newWalletMonthlyLimit) || undefined;

    await db.wallets.add({
      id: `wlt_${Date.now()}`,
      name: newWalletName.trim(),
      type: newWalletType,
      phoneNumberOrAccount: newWalletAccount.trim(),
      balance: parseFloat(newWalletBalance) || 0,
      dailyLimit: dLimit,
      monthlyLimit: mLimit,
      color: colors[newWalletType] || '#2563eb',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    setShowNewWalletModal(false);
    setNewWalletName('');
    setNewWalletAccount('');
    setNewWalletBalance('');
    setNewWalletDailyLimit('');
    setNewWalletMonthlyLimit('');
    showToast('تمت إضافة المحفظة بنجاح');
  };

  const totalWalletsBalance = wallets.reduce((acc, w) => acc + w.balance, 0);
  const todayTransactions = transactions.filter(
    (t) => new Date(t.createdAt).toDateString() === new Date().toDateString()
  );
  const todayCommissions = todayTransactions.reduce((acc, t) => acc + t.commission, 0);
  const cur = settings?.currency || 'ج.م';
  const numAmount = parseFloat(amount) || 0;
  const numComm = parseFloat(commission) || 0;

  return (
    <div className="space-y-5 pb-12 font-sans">
      {/* ═══════════════════════════════════════════════════════════════
          ULTRA-FAST ACTION BOX: 3 STEPS (TYPE -> AMOUNT -> CONFIRM)
      ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 p-5 sm:p-7 overflow-hidden relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-md">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-slate-900 leading-tight">
                عملية سريعة فودافون كاش وإنستاباي
              </h2>
              <p className="text-xs text-slate-500 font-bold">
                حدد العملية ← المبلغ ← تنفيذ بلمسة واحدة
              </p>
            </div>
          </div>

          {/* Active Wallet Selector Pill */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 pr-2">المحفظة:</span>
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="bg-white font-bold text-xs text-slate-800 py-1.5 px-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-400 cursor-pointer shadow-xs"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} (رصيد: {w.balance.toLocaleString()} ج)
                </option>
              ))}
            </select>
          </div>
        </div>

        <form onSubmit={handleExecuteTransaction} className="space-y-5">
          {/* STEP 1: OPERATION TYPE (LARGE CLICKABLE TILES) */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">
              1. نوع العملية:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => handleTypeChange('cash_in_from_customer')}
                className={`p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                  txType === 'cash_in_from_customer'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/15'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-emerald-300'
                }`}
              >
                <ArrowUpRight className="h-5 w-5" />
                <span className="font-black text-sm">سحب من العميل</span>
                <span className="text-[10px] opacity-80">العميل يحول ونعطيه كاش</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('cash_out_to_customer')}
                className={`p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                  txType === 'cash_out_to_customer'
                    ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-600/15'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-red-300'
                }`}
              >
                <ArrowDownLeft className="h-5 w-5" />
                <span className="font-black text-sm">تحويل للعميل</span>
                <span className="text-[10px] opacity-80">المحل يحول ويستلم كاش</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('instapay_transfer')}
                className={`p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                  txType === 'instapay_transfer'
                    ? 'bg-purple-700 border-purple-700 text-white shadow-md shadow-purple-700/15'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-purple-300'
                }`}
              >
                <CreditCard className="h-5 w-5" />
                <span className="font-black text-sm">إنستاباي (InstaPay)</span>
                <span className="text-[10px] opacity-80">تحويل بنكي / عنوان دفع</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('internal_transfer')}
                className={`p-3.5 rounded-2xl font-bold text-xs flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                  txType === 'internal_transfer'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/15'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300'
                }`}
              >
                <RefreshCw className="h-5 w-5" />
                <span className="font-black text-sm">بين المحافظ</span>
                <span className="text-[10px] opacity-80">نقل رصيد بين خطوط المحل</span>
              </button>
            </div>
          </div>

          {/* Internal Transfer Target Wallet Selector */}
          {txType === 'internal_transfer' && (
            <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200/80">
              <label className="block text-xs font-bold text-blue-900 mb-1.5">
                المحفظة المحول إليها (المستلمة):
              </label>
              <select
                value={targetWalletId}
                onChange={(e) => setTargetWalletId(e.target.value)}
                className="w-full bg-white font-bold text-sm text-slate-800 p-2.5 rounded-xl border border-blue-300 focus:outline-none"
                required
              >
                <option value="">-- اختر محفظة الاستلام --</option>
                {wallets
                  .filter((w) => w.id !== selectedWalletId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} (الرصيد: {w.balance.toLocaleString()} ج)
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* STEP 2: AMOUNT & COMMISSION (SMOOTH ELEGANT INPUTS) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Amount Input */}
            <div className="md:col-span-8 bg-slate-50/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-200">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-black text-slate-600">
                  2. المبلغ المطلوب تحويله / سحبه:
                </label>
                {numAmount > 0 && (
                  <span className="text-xs font-bold text-blue-600 font-mono">
                    الصافي للعميل: {numAmount.toLocaleString()} ج
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={amountInputRef}
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="w-full bg-transparent text-3xl sm:text-4xl font-black font-mono text-slate-900 border-none outline-none focus:outline-none focus:ring-0 p-0 tracking-tight"
                />
                <span className="text-lg font-black text-slate-400 shrink-0">ج.م</span>
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-200/60">
                {[50, 100, 200, 300, 500, 1000, 2000, 3000, 5000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQuickAmount(val)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 font-mono font-bold text-xs hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 active:scale-95 transition-all duration-150 cursor-pointer shadow-xs"
                  >
                    {val} ج
                  </button>
                ))}
              </div>
            </div>

            {/* Commission Box (Clean, Elegant, Directly Linked to Settings) */}
            <div className="md:col-span-4 bg-emerald-50/40 p-4 sm:p-5 rounded-2xl border border-emerald-200/70 flex flex-col justify-between h-full transition-all duration-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-emerald-900 flex items-center gap-1">
                  <Percent className="h-3.5 w-3.5 text-emerald-600" />
                  <span>عمولة المحل (ربح):</span>
                </label>
                {isCustomCommission && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCommission(false);
                      const num = parseFloat(amount) || 0;
                      setCommission(num > 0 ? calculateDefaultCommission(num, txType).toString() : '');
                    }}
                    className="text-[10px] font-bold text-emerald-700 underline cursor-pointer"
                  >
                    استعادة التلقائي
                  </button>
                )}
              </div>

              {/* Clean Active Rate subtitle from settings */}
              {activeRateRule && (
                <div className="mt-1 text-[11px] font-bold font-mono text-emerald-800">
                  تلقائي من الإعدادات: {activeRateRule.feePerThousand} ج / ألف (أدنى {activeRateRule.minFee} ج)
                </div>
              )}

              <div className="flex items-baseline gap-1 my-2">
                <input
                  type="number"
                  step="any"
                  value={commission}
                  onChange={(e) => {
                    setIsCustomCommission(true);
                    setCommission(e.target.value);
                  }}
                  className="w-24 bg-white border border-emerald-300/80 rounded-xl px-2.5 py-1 text-xl font-black font-mono text-emerald-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="text-xs font-bold text-emerald-700">ج.م</span>
              </div>

              <div className="text-[11px] font-bold text-emerald-800 border-t border-emerald-200/60 pt-2 mt-1">
                {txType === 'cash_in_from_customer' ? (
                  <span>يدفع العميل بالمحل: <strong>{(numAmount - numComm).toLocaleString()} ج</strong> كاش</span>
                ) : (
                  <span>يستلم المحل من العميل: <strong>{(numAmount + numComm).toLocaleString()} ج</strong> كاش</span>
                )}
              </div>
            </div>
          </div>

          {/* Optional phone field toggle */}
          <div>
            {!showOptionalFields ? (
              <button
                type="button"
                onClick={() => setShowOptionalFields(true)}
                className="text-xs font-bold text-slate-500 hover:text-blue-600 transition flex items-center gap-1 cursor-pointer"
              >
                <span>+ تسجيل رقم هاتف العميل واسمه (اختياري)</span>
              </button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 animate-slide-down">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">رقم هاتف العميل (اختياري)</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="w-full bg-white rounded-xl border border-slate-300 p-2 text-sm font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">اسم العميل (اختياري)</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اسم العميل..."
                    className="w-full bg-white rounded-xl border border-slate-300 p-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: LARGE ONE-CLICK EXECUTE BUTTON */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:brightness-105 active:scale-[0.98] text-white font-display text-lg font-black shadow-xl shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Zap className="h-6 w-6" />
            <span>تأكيد وتنفيذ العملية فوراً (Enter)</span>
          </button>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          STORE WALLETS OVERVIEW & MANAGEMENT CARDS
      ═══════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-bold text-slate-800">
            خطوط ومحافظ المحل ({wallets.length}):
          </h3>
          <button
            onClick={() => setShowNewWalletModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>إضافة خط / محفظة جديدة</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {wallets.map((w) => {
            const isSelected = selectedWalletId === w.id;
            const now = new Date();
            const todayStr = now.toDateString();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const curMonth = now.getMonth();
            const curYear = now.getFullYear();

            // Outgoing transfers (cash out / instapay) - only outgoing counts towards limit
            const walletOutgoing = allTransactions.filter(
              (t) => t.walletId === w.id && (t.type === 'cash_out_to_customer' || t.type === 'instapay_transfer')
            );
            const todayOut = walletOutgoing
              .filter((t) => new Date(t.createdAt).toDateString() === todayStr)
              .reduce((s, t) => s + t.amount, 0);

            const monthOut = walletOutgoing
              .filter((t) => {
                const d = new Date(t.createdAt);
                return d.getMonth() === curMonth && d.getFullYear() === curYear;
              })
              .reduce((s, t) => s + t.amount, 0);

            // Profits from commissions
            const walletTxList = allTransactions.filter((t) => t.walletId === w.id);
            const profitToday = walletTxList
              .filter((t) => new Date(t.createdAt).toDateString() === todayStr)
              .reduce((s, t) => s + t.commission, 0);
            const profitWeek = walletTxList
              .filter((t) => new Date(t.createdAt) >= oneWeekAgo)
              .reduce((s, t) => s + t.commission, 0);
            const profitMonth = walletTxList
              .filter((t) => {
                const d = new Date(t.createdAt);
                return d.getMonth() === curMonth && d.getFullYear() === curYear;
              })
              .reduce((s, t) => s + t.commission, 0);

            return (
              <div
                key={w.id}
                onClick={() => setSelectedWalletId(w.id)}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/60 shadow-md ring-2 ring-blue-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="absolute top-0 right-0 left-0 h-1.5" style={{ backgroundColor: w.color }} />
                  <div className="flex items-center justify-between mb-1 mt-1">
                    <span className="text-xs font-black text-slate-800 truncate">{w.name}</span>
                    {w.type === 'instapay' ? (
                      <CreditCard className="h-4 w-4 text-purple-600 shrink-0" />
                    ) : (
                      <Smartphone className="h-4 w-4 text-slate-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-slate-500 truncate">{w.phoneNumberOrAccount}</p>
                  
                  <div className="mt-2 flex items-baseline justify-between border-t border-slate-100 pt-2">
                    <span className="text-[10px] text-slate-400">الرصيد:</span>
                    <span className="text-sm font-black font-mono text-slate-900">
                      {w.balance.toLocaleString()} {cur}
                    </span>
                  </div>

                  {/* Outgoing Transfer Limits Progress Bars */}
                  <div className="mt-2 space-y-1.5 bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-[10px]">
                    {w.dailyLimit && w.dailyLimit > 0 ? (
                      <div>
                        <div className="flex justify-between font-bold text-slate-600 mb-0.5">
                          <span>ليميت اليوم:</span>
                          <span className="font-mono text-[9px]">
                            {todayOut.toLocaleString()} / {w.dailyLimit.toLocaleString()} ج ({Math.min(100, Math.round((todayOut / w.dailyLimit) * 100))}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              todayOut / w.dailyLimit >= 0.9 ? 'bg-red-500' : todayOut / w.dailyLimit >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.round((todayOut / w.dailyLimit) * 100))}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-[9px] text-slate-400">الليميت اليومي: مفتوح</div>
                    )}

                    {w.monthlyLimit && w.monthlyLimit > 0 && (
                      <div className="pt-0.5">
                        <div className="flex justify-between font-bold text-slate-600 mb-0.5">
                          <span>ليميت الشهر:</span>
                          <span className="font-mono text-[9px]">
                            {monthOut.toLocaleString()} / {w.monthlyLimit.toLocaleString()} ج ({Math.min(100, Math.round((monthOut / w.monthlyLimit) * 100))}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              monthOut / w.monthlyLimit >= 0.9 ? 'bg-red-500' : monthOut / w.monthlyLimit >= 0.7 ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.round((monthOut / w.monthlyLimit) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Net Profits Badges */}
                  <div className="grid grid-cols-3 gap-1 mt-2 text-center">
                    <div className="bg-emerald-50 p-1 rounded-lg border border-emerald-100">
                      <span className="block text-[8px] text-emerald-800 font-bold">اليوم</span>
                      <span className="text-[10px] font-mono font-black text-emerald-700">+{profitToday}</span>
                    </div>
                    <div className="bg-blue-50 p-1 rounded-lg border border-blue-100">
                      <span className="block text-[8px] text-blue-800 font-bold">أسبوع</span>
                      <span className="text-[10px] font-mono font-black text-blue-700">+{profitWeek}</span>
                    </div>
                    <div className="bg-purple-50 p-1 rounded-lg border border-purple-100">
                      <span className="block text-[8px] text-purple-800 font-bold">شهر</span>
                      <span className="text-[10px] font-mono font-black text-purple-700">+{profitMonth}</span>
                    </div>
                  </div>
                </div>

                {/* Edit & Delete Mini Buttons */}
                <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-slate-100 opacity-80 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingWallet({ ...w });
                    }}
                    className="p-1 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 cursor-pointer"
                    title="تعديل"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const confirmed = await showConfirm(
                        `هل أنت متأكد من حذف/تعطيل المحفظة "${w.name}"؟`,
                        'تعطيل المحفظة',
                        { confirmText: 'تعطيل', cancelText: 'إلغاء', danger: true }
                      );
                      if (confirmed) {
                        await db.wallets.update(w.id, { isActive: false });
                        showToast(`تم تعطيل محفظة ${w.name}`);
                      }
                    }}
                    className="p-1 rounded-lg bg-red-100 text-red-500 hover:bg-red-200 cursor-pointer"
                    title="حذف"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          RECENT TRANSACTIONS LOG
      ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-600" />
            <h3 className="font-display font-bold text-sm text-slate-800">
              سجل التحويلات والعمليات الأخيرة ({transactions.length})
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="text-slate-500">
              أرباح اليوم: <strong className="text-emerald-600 font-mono">+{todayCommissions.toLocaleString()} {cur}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">
              إجمالي أرصدة الخطوط: <strong className="text-slate-900 font-mono">{totalWalletsBalance.toLocaleString()} {cur}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3">نوع العملية</th>
                <th className="p-3">المحفظة / الخط</th>
                <th className="p-3">المبلغ</th>
                <th className="p-3">العمولة (الربح)</th>
                <th className="p-3">العميل / الهاتف</th>
                <th className="p-3">الوقت والتاريخ</th>
                <th className="p-3 text-center">طباعة إيصال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-semibold">
                    لا توجد عمليات تحويل مسجلة حتى الآن.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          t.type === 'cash_in_from_customer'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.type === 'cash_out_to_customer'
                            ? 'bg-red-100 text-red-800'
                            : t.type === 'instapay_transfer'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {t.type === 'cash_in_from_customer' && 'سحب من العميل'}
                        {t.type === 'cash_out_to_customer' && 'تحويل للعميل'}
                        {t.type === 'instapay_transfer' && 'إنستاباي'}
                        {t.type === 'internal_transfer' && 'تحويل داخلي'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-800">{t.walletName}</td>
                    <td className="p-3 font-mono font-black text-slate-900">
                      {t.amount.toLocaleString()} {cur}
                    </td>
                    <td className="p-3 font-mono font-black text-emerald-600">
                      +{t.commission.toLocaleString()} {cur}
                    </td>
                    <td className="p-3 text-slate-600">
                      {t.customerPhone || t.customerName || '—'}
                    </td>
                    <td className="p-3 text-slate-500 font-mono">
                      {new Date(t.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (settings) {
                            triggerPrint({
                              type: 'wallet_receipt',
                              walletTx: t,
                              settings,
                            });
                          }
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition cursor-pointer"
                        title="طباعة إيصال"
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

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: ADD NEW WALLET
      ═══════════════════════════════════════════════════════════════ */}
      {showNewWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <h3 className="font-display text-base font-bold text-white">إضافة محفظة أو خط كاش جديد</h3>
              <button onClick={() => setShowNewWalletModal(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateWallet} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المحفظة / الخط *</label>
                <input
                  type="text"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  placeholder="مثال: فودافون كاش - خط 1"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع المحفظة</label>
                <select
                  value={newWalletType}
                  onChange={(e) => setNewWalletType(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value="vodafone">فودافون كاش (Vodafone Cash)</option>
                  <option value="instapay">إنستاباي (InstaPay)</option>
                  <option value="orange">أورنج كاش (Orange Cash)</option>
                  <option value="etisalat">اتصالات كاش (Etisalat Cash)</option>
                  <option value="we">وي باي (WE Pay)</option>
                  <option value="bank">حساب بنكي</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف أو عنوان الحساب *</label>
                <input
                  type="text"
                  value={newWalletAccount}
                  onChange={(e) => setNewWalletAccount(e.target.value)}
                  placeholder="010xxxxxxxx أو username@instapay"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الرصيد الافتتاحي الحالي (ج.م)</label>
                <input
                  type="number"
                  step="any"
                  value={newWalletBalance}
                  onChange={(e) => setNewWalletBalance(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono font-bold focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد اليومي للتحويل (ج.م)</label>
                  <input
                    type="number"
                    step="any"
                    value={newWalletDailyLimit}
                    onChange={(e) => setNewWalletDailyLimit(e.target.value)}
                    placeholder="0 = مفتوح"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الشهري للتحويل (ج.م)</label>
                  <input
                    type="number"
                    step="any"
                    value={newWalletMonthlyLimit}
                    onChange={(e) => setNewWalletMonthlyLimit(e.target.value)}
                    placeholder="0 = مفتوح"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewWalletModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold shadow-md cursor-pointer"
                >
                  حفظ المحفظة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: EDIT WALLET
      ═══════════════════════════════════════════════════════════════ */}
      {editingWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-white" />
                <h3 className="font-display text-base font-bold text-white">تعديل بيانات المحفظة والليميت</h3>
              </div>
              <button onClick={() => setEditingWallet(null)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await db.wallets.update(editingWallet.id, {
                  name: editingWallet.name,
                  phoneNumberOrAccount: editingWallet.phoneNumberOrAccount,
                  balance: Number(editingWallet.balance),
                  dailyLimit: editingWallet.dailyLimit ? Number(editingWallet.dailyLimit) : undefined,
                  monthlyLimit: editingWallet.monthlyLimit ? Number(editingWallet.monthlyLimit) : undefined,
                });
                setEditingWallet(null);
                showToast('تم تعديل المحفظة والليميت بنجاح');
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المحفظة / الخط</label>
                <input
                  type="text"
                  value={editingWallet.name}
                  onChange={(e) => setEditingWallet({ ...editingWallet, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-bold focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف أو الحساب</label>
                <input
                  type="text"
                  value={editingWallet.phoneNumberOrAccount}
                  onChange={(e) => setEditingWallet({ ...editingWallet, phoneNumberOrAccount: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الرصيد الحالي (ج.م)</label>
                <input
                  type="number"
                  step="any"
                  value={editingWallet.balance}
                  onChange={(e) => setEditingWallet({ ...editingWallet, balance: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono font-bold focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد اليومي (ج.م)</label>
                  <input
                    type="number"
                    step="any"
                    value={editingWallet.dailyLimit ?? ''}
                    onChange={(e) =>
                      setEditingWallet({
                        ...editingWallet,
                        dailyLimit: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="0 = مفتوح"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الحد الشهري (ج.م)</label>
                  <input
                    type="number"
                    step="any"
                    value={editingWallet.monthlyLimit ?? ''}
                    onChange={(e) =>
                      setEditingWallet({
                        ...editingWallet,
                        monthlyLimit: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="0 = مفتوح"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWallet(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold shadow-md cursor-pointer"
                >
                  حفظ التعديل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
