import React, { useState } from 'react';
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
  Building,
  Edit2,
  X,
  Trash2,
} from 'lucide-react';
import { db } from '../db';
import { triggerPrint } from '../services/printer';
import { useModal } from '../context/ModalContext';
import type { StoreWallet, WalletTransaction, StoreSettings } from '../types';

export const WalletsView: React.FC<{ activeShiftId: string; cashierName: string }> = ({
  activeShiftId,
  cashierName,
}) => {
  const { showAlert, showConfirm, showToast } = useModal();
  const wallets = useLiveQuery(() => db.wallets.filter((w) => w.isActive).toArray()) || [];
  const transactions =
    useLiveQuery(() =>
      db.walletTransactions.orderBy('createdAt').reverse().limit(50).toArray()
    ) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  // Active operation form state
  const [txType, setTxType] = useState<'cash_out_to_customer' | 'cash_in_from_customer' | 'instapay_transfer' | 'internal_transfer'>('cash_out_to_customer');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [targetWalletId, setTargetWalletId] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [commission, setCommission] = useState<string>('');
  const [isAutoCommission, setIsAutoCommission] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // New Wallet Modal
  const [showNewWalletModal, setShowNewWalletModal] = useState<boolean>(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState<StoreWallet['type']>('vodafone');
  const [newWalletAccount, setNewWalletAccount] = useState('');
  const [newWalletBalance, setNewWalletBalance] = useState('');

  // Edit Wallet Modal
  const [editingWallet, setEditingWallet] = useState<StoreWallet | null>(null);

  // Default select first wallet
  React.useEffect(() => {
    if (wallets.length > 0 && !selectedWalletId) {
      setSelectedWalletId(wallets[0].id);
    }
  }, [wallets, selectedWalletId]);

  // Smart commission calculator standard for mobile shops in Egypt
  const calculateCommission = (val: number, type: string) => {
    if (!val || val <= 0) return 0;
    if (type === 'internal_transfer') return 0;

    // Egyptian Market Tiered Standard
    if (val <= 100) return 3;
    if (val <= 200) return 5;
    if (val <= 500) return 7;
    if (val <= 1000) return 10;
    if (val <= 2000) return 20;
    if (val <= 3000) return 30;
    if (val <= 5000) return 50;
    // 1% above 5000
    return Math.ceil(val * 0.01);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmount(val);
    if (isAutoCommission) {
      const num = parseFloat(val) || 0;
      const comm = calculateCommission(num, txType);
      setCommission(comm.toString());
    }
  };

  const handleExecuteTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    const numCommission = parseFloat(commission) || 0;

    if (!numAmount || numAmount <= 0) {
      showAlert('يرجى كتابة مبلغ صحيح أكبر من الصفر.', 'مبلغ غير صحيح', 'warning');
      return;
    }

    const currentWallet = wallets.find((w) => w.id === selectedWalletId);
    if (!currentWallet) {
      showAlert('يرجى اختيار المحفظة لتنفيذ العملية.', 'تحديد محفظة', 'warning');
      return;
    }

    // Balance check for cash out
    if (
      (txType === 'cash_out_to_customer' || txType === 'instapay_transfer' || txType === 'internal_transfer') &&
      currentWallet.balance < numAmount
    ) {
      const proceed = await showConfirm(
        `تنبيه: رصيد المحفظة الحالي (${currentWallet.balance.toLocaleString()} ج) أقل من المبلغ المطلوب تحويله (${numAmount.toLocaleString()} ج).\nهل ترغب في المتابعة على أية حال؟`,
        'رصيد المحفظة غير كافٍ',
        { confirmText: 'متابعة التحويل', cancelText: 'إلغاء العملية', danger: true }
      );
      if (!proceed) {
        return;
      }
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
      customerPhone: txType === 'internal_transfer' ? 'تحويل داخلي' : customerPhone,
      customerName: customerName || undefined,
      shiftId: activeShiftId,
      cashierName,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    // Update Wallet Balances in DB transaction
    await db.transaction('rw', [db.wallets, db.walletTransactions, db.shifts], async () => {
      // 1. Add Transaction
      await db.walletTransactions.add(newTx);

      // 2. Adjust Origin Wallet Balance
      if (txType === 'cash_out_to_customer' || txType === 'instapay_transfer') {
        // Deduct from wallet
        await db.wallets.update(currentWallet.id, {
          balance: currentWallet.balance - numAmount,
        });
      } else if (txType === 'cash_in_from_customer') {
        // Add to wallet
        await db.wallets.update(currentWallet.id, {
          balance: currentWallet.balance + numAmount,
        });
      } else if (txType === 'internal_transfer' && targetWalletId) {
        const targetWallet = await db.wallets.get(targetWalletId);
        if (targetWallet) {
          await db.wallets.update(currentWallet.id, { balance: currentWallet.balance - numAmount });
          await db.wallets.update(targetWallet.id, { balance: targetWallet.balance + numAmount });
        }
      }

      // 3. Update Shift stats
      const shift = await db.shifts.get(activeShiftId);
      if (shift) {
        if (txType === 'cash_out_to_customer' || txType === 'instapay_transfer') {
          // Cash in drawer increases by amount + commission
          await db.shifts.update(activeShiftId, {
            closingCashSystem: shift.closingCashSystem + numAmount + numCommission,
            totalWalletIn: shift.totalWalletIn + numAmount + numCommission,
            totalCommissions: shift.totalCommissions + numCommission,
          });
        } else if (txType === 'cash_in_from_customer') {
          // Cash in drawer decreases by (amount - commission)
          const cashGivenOut = numAmount - numCommission;
          await db.shifts.update(activeShiftId, {
            closingCashSystem: shift.closingCashSystem - cashGivenOut,
            totalWalletOut: shift.totalWalletOut + cashGivenOut,
            totalCommissions: shift.totalCommissions + numCommission,
          });
        }
      }
    });

    // Auto trigger receipt print if settings say so
    if (settings && settings.autoPrintReceipt) {
      triggerPrint({
        type: 'wallet_receipt',
        walletTx: newTx,
        settings,
      });
    }

    setSuccessBanner(`تمت العملية بنجاح! رقم الإيصال: ${txId.slice(-6)}`);
    setTimeout(() => setSuccessBanner(null), 4000);

    // Reset fields
    setAmount('');
    setCommission('');
    setCustomerPhone('');
    setCustomerName('');
    setNotes('');
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName || !newWalletAccount) {
      showAlert('يرجى كتابة اسم المحفظة ورقم الحساب/الهاتف.', 'بيانات ناقصة', 'warning');
      return;
    }

    const newId = `wlt_${Date.now()}`;
    const colors: Record<string, string> = {
      vodafone: '#e60000',
      instapay: '#800080',
      orange: '#ff6600',
      etisalat: '#719e19',
      we: '#551a8b',
      bank: '#1e3a8a',
      other: '#475569',
    };

    await db.wallets.add({
      id: newId,
      name: newWalletName,
      type: newWalletType,
      phoneNumberOrAccount: newWalletAccount,
      balance: parseFloat(newWalletBalance) || 0,
      color: colors[newWalletType] || '#2563eb',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    setShowNewWalletModal(false);
    setNewWalletName('');
    setNewWalletAccount('');
    setNewWalletBalance('');
  };

  // Quick stats calculation
  const totalWalletsBalance = wallets.reduce((acc, w) => acc + w.balance, 0);
  const todayTransactions = transactions.filter(
    (t) => new Date(t.createdAt).toDateString() === new Date().toDateString()
  );
  const todayCommissions = todayTransactions.reduce((acc, t) => acc + t.commission, 0);
  const todayTotalVolume = todayTransactions.reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="bg-gradient-to-br from-red-600 to-red-700 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-red-100 font-medium">إجمالي أرصدة المحافظ والخطوط</p>
            <h3 className="text-2xl font-black mt-1 font-mono">{totalWalletsBalance.toLocaleString()} {settings?.currency || 'ج.م'}</h3>
            <span className="text-[10px] text-red-200 mt-1 block">موزعة على {wallets.length} خطوط ومحافظ فعالة</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-100 font-medium">أرباح العمولات اليوم (صافي ربح)</p>
            <h3 className="text-2xl font-black mt-1 font-mono">+{todayCommissions.toLocaleString()} {settings?.currency || 'ج.م'}</h3>
            <span className="text-[10px] text-emerald-200 mt-1 block">من {todayTransactions.length} عملية تحويل وسحب</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-gradient-to-br from-purple-700 to-indigo-800 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-purple-100 font-medium">حجم تداول الكاش اليوم</p>
            <h3 className="text-2xl font-black mt-1 font-mono">{todayTotalVolume.toLocaleString()} {settings?.currency || 'ج.م'}</h3>
            <span className="text-[10px] text-purple-200 mt-1 block">إجمالي مبالغ التحويلات المنفذة</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Action Button: Add Wallet */}
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-5 flex flex-col justify-center items-center text-center hover:border-blue-500 transition cursor-pointer group" onClick={() => setShowNewWalletModal(true)}>
          <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
            <Plus className="h-5 w-5" />
          </div>
          <span className="font-bold text-sm text-slate-800">إضافة خط / محفظة جديدة</span>
          <span className="text-xs text-slate-400">فودافون كاش، إنستاباي، بنك</span>
        </div>
      </div>

      {/* Store Wallets Scrollable Bar */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">خطوط ومحافظ المحل المسجلة:</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {wallets.map((w) => {
            const isSelected = selectedWalletId === w.id;
            return (
              <div
                key={w.id}
                onClick={() => setSelectedWalletId(w.id)}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer relative overflow-hidden group ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className="absolute top-0 right-0 left-0 h-1.5"
                  style={{ backgroundColor: w.color }}
                />
                <div className="flex items-center justify-between mb-1 mt-1">
                  <span className="text-xs font-bold text-slate-800 truncate">{w.name}</span>
                  {w.type === 'instapay' ? (
                    <CreditCard className="h-4 w-4 text-purple-600 shrink-0" />
                  ) : (
                    <Smartphone className="h-4 w-4 text-slate-500 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] font-mono text-slate-500 truncate">{w.phoneNumberOrAccount}</p>
                <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-2">
                  <span className="text-[10px] text-slate-400">الرصيد:</span>
                  <span className="text-sm font-black font-mono text-slate-900">
                    {w.balance.toLocaleString()} {settings?.currency || 'ج'}
                  </span>
                </div>
                {/* Edit/Delete mini icons */}
                <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingWallet({ ...w }); }}
                    className="p-1 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 cursor-pointer"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const confirmed = await showConfirm(
                        `هل أنت متأكد من تعطيل/حذف المحفظة "${w.name}"؟`,
                        'تعطيل المحفظة',
                        { confirmText: 'نعم، تعطيل', cancelText: 'إلغاء', danger: true }
                      );
                      if (confirmed) {
                        await db.wallets.update(w.id, { isActive: false });
                        showToast(`تم تعطيل محفظة ${w.name}`);
                      }
                    }}
                    className="p-1 rounded-lg bg-red-100 text-red-500 hover:bg-red-200 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {successBanner && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-500 text-white p-4 font-bold shadow-md animate-bounce">
          <CheckCircle2 className="h-5 w-5" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Main Fast Transaction Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Main: Quick Operation Box (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
          <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs">
              ⚡
            </span>
            <span>تنفيذ عملية سريعة (تحويل / سحب / إيداع)</span>
          </h2>

          {/* Operation Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <button
              type="button"
              onClick={() => setTxType('cash_out_to_customer')}
              className={`p-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1.5 transition ${
                txType === 'cash_out_to_customer'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ArrowDownLeft className="h-5 w-5" />
              <span>إيداع للعميل (المحل يحول)</span>
            </button>

            <button
              type="button"
              onClick={() => setTxType('cash_in_from_customer')}
              className={`p-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1.5 transition ${
                txType === 'cash_in_from_customer'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ArrowUpRight className="h-5 w-5" />
              <span>سحب من العميل (العميل يحول)</span>
            </button>

            <button
              type="button"
              onClick={() => setTxType('instapay_transfer')}
              className={`p-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1.5 transition ${
                txType === 'instapay_transfer'
                  ? 'bg-purple-700 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <CreditCard className="h-5 w-5" />
              <span>تحويل إنستاباي بنكي</span>
            </button>

            <button
              type="button"
              onClick={() => setTxType('internal_transfer')}
              className={`p-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1.5 transition ${
                txType === 'internal_transfer'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <RefreshCw className="h-5 w-5" />
              <span>تحويل بين المحافظ</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleExecuteTransaction} className="space-y-4">
            {/* Origin & Target Wallets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {txType === 'internal_transfer' ? 'التحويل من محفظة:' : 'المحفظة المستخدمة للعملية:'}
                </label>
                <select
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm font-bold bg-white focus:border-blue-600 focus:outline-none"
                  required
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} (رصيد: {w.balance.toLocaleString()} ج)
                    </option>
                  ))}
                </select>
              </div>

              {txType === 'internal_transfer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التحويل إلى محفظة:</label>
                  <select
                    value={targetWalletId}
                    onChange={(e) => setTargetWalletId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm font-bold bg-white focus:border-blue-600 focus:outline-none"
                    required
                  >
                    <option value="">-- اختر المحفظة المستلمة --</option>
                    {wallets
                      .filter((w) => w.id !== selectedWalletId)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} (رصيد: {w.balance.toLocaleString()} ج)
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {txType !== 'internal_transfer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {txType === 'instapay_transfer'
                      ? 'عنوان إنستاباي (IPA) أو رقم هاتف العميل:'
                      : 'رقم هاتف العميل (المحفظة):'}
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={txType === 'instapay_transfer' ? 'user@instapay أو 010...' : '010XXXXXXXX'}
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm font-mono focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
              )}
            </div>

            {/* Amount and Commission */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ المطلوب تحويله / سحبه ({settings?.currency || 'ج.م'})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                    className="w-full rounded-xl border-2 border-slate-300 p-3 text-lg font-black font-mono text-blue-700 focus:border-blue-600 focus:outline-none"
                    required
                  />
                  <span className="absolute left-3 top-3.5 text-xs font-bold text-slate-400">
                    {settings?.currency || 'ج.م'}
                  </span>
                </div>
              </div>

              {txType !== 'internal_transfer' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      عمولة المحل (ربح الخدمة)
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-blue-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAutoCommission}
                        onChange={(e) => setIsAutoCommission(e.target.checked)}
                        className="rounded"
                      />
                      <span>حساب تلقائي ذكي</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={commission}
                      onChange={(e) => {
                        setCommission(e.target.value);
                        setIsAutoCommission(false);
                      }}
                      placeholder="0.00"
                      className="w-full rounded-xl border-2 border-emerald-300 bg-emerald-50/40 p-3 text-lg font-black font-mono text-emerald-800 focus:border-emerald-600 focus:outline-none"
                    />
                    <span className="absolute left-3 top-3.5 text-xs font-bold text-emerald-700">
                      {settings?.currency || 'ج.م'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Operation Live Calculation Summary Banner */}
            {amount && parseFloat(amount) > 0 && txType !== 'internal_transfer' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-600">
                    {txType === 'cash_out_to_customer' || txType === 'instapay_transfer'
                      ? 'الكاش المطلوب استلامه من العميل في الدرج:'
                      : 'الكاش المطلوب تسليمه للعميل يداً بيد:'}
                  </span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {txType === 'cash_out_to_customer' || txType === 'instapay_transfer'
                      ? (parseFloat(amount) + (parseFloat(commission) || 0)).toLocaleString()
                      : (parseFloat(amount) - (parseFloat(commission) || 0)).toLocaleString()}{' '}
                    {settings?.currency || 'ج.م'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>صافي ربح المحل المسجل من العملية:</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    +{(parseFloat(commission) || 0).toLocaleString()} {settings?.currency || 'ج.م'}
                  </span>
                </div>
              </div>
            )}

            {/* Optional Customer Name & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="اسم العميل (اختياري)"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
              />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات إضافية (اختياري)"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-base py-4 shadow-lg transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>تأكيد وتسجيل العملية والطباعة الفورية</span>
            </button>
          </form>
        </div>

        {/* Right: Today's Recent Transactions (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-xs border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-blue-600" />
                <span>سجل العمليات الأخيرة ({transactions.length})</span>
              </h3>
            </div>

            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  لا توجد عمليات تحويل مسجلة بعد.
                </div>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            tx.type === 'cash_out_to_customer'
                              ? 'bg-red-500'
                              : tx.type === 'cash_in_from_customer'
                              ? 'bg-emerald-500'
                              : 'bg-purple-500'
                          }`}
                        />
                        <span>{tx.walletName}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({tx.customerPhone})
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(tx.createdAt).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        | عمولة: <span className="font-bold text-emerald-600">+{tx.commission} ج</span>
                      </div>
                    </div>

                    <div className="text-left flex items-center gap-2">
                      <div>
                        <div className="font-black font-mono text-sm text-slate-900">
                          {tx.amount.toLocaleString()} ج
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {tx.type === 'cash_out_to_customer' && 'إيداع للعميل'}
                          {tx.type === 'cash_in_from_customer' && 'سحب من العميل'}
                          {tx.type === 'instapay_transfer' && 'إنستاباي'}
                          {tx.type === 'internal_transfer' && 'داخلي'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (settings) {
                            triggerPrint({
                              type: 'wallet_receipt',
                              walletTx: tx,
                              settings,
                            });
                          }
                        }}
                        title="طباعة إيصال"
                        className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create New Wallet */}
      {showNewWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-600" />
              <span>إضافة خط أو محفظة جديدة للنظام</span>
            </h3>

            <form onSubmit={handleCreateWallet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الخط / المحفظة</label>
                <input
                  type="text"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  placeholder="مثال: فودافون كاش - خط المعادي"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع المحفظة</label>
                <select
                  value={newWalletType}
                  onChange={(e) => setNewWalletType(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value="vodafone">فودافون كاش (Vodafone Cash)</option>
                  <option value="instapay">إنستاباي (InstaPay)</option>
                  <option value="orange">أورنج كاش (Orange Cash)</option>
                  <option value="etisalat">اتصالات كاش (Etisalat Cash)</option>
                  <option value="we">وي باي (WE Pay)</option>
                  <option value="bank">حساب بنكي مباشر</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف أو اسم الحساب
                </label>
                <input
                  type="text"
                  value={newWalletAccount}
                  onChange={(e) => setNewWalletAccount(e.target.value)}
                  placeholder="01012345678 أو store@instapay"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الرصيد الافتتاحي الحالي في المحفظة ({settings?.currency || 'ج.م'})
                </label>
                <input
                  type="number"
                  step="any"
                  value={newWalletBalance}
                  onChange={(e) => setNewWalletBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewWalletModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow"
                >
                  حفظ المحفظة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Wallet Modal */}
      {editingWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-white" />
                <h3 className="font-display text-lg font-bold text-white">تعديل بيانات المحفظة</h3>
              </div>
              <button onClick={() => setEditingWallet(null)} className="text-white/80 hover:text-white">
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
                });
                setEditingWallet(null);
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
                <label className="block text-xs font-bold text-slate-700 mb-1">الرصيد الحالي</label>
                <input
                  type="number"
                  step="any"
                  value={editingWallet.balance}
                  onChange={(e) => setEditingWallet({ ...editingWallet, balance: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono font-bold focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWallet(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold shadow-md"
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
