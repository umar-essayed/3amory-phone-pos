import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Users,
  Truck,
  Plus,
  DollarSign,
  Search,
  CheckCircle2,
  Trash2,
  UserCheck,
  CreditCard,
  Edit2,
  X,
  Phone,
  Building2,
  AlertCircle,
  BookOpen,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Printer,
  Zap,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { db } from '../db';
import { useModal } from '../context/ModalContext';
import type { Customer, Supplier, DebtTransaction, StoreWallet } from '../types';

export const AccountsView: React.FC = () => {
  const { showAlert, showConfirm, showToast } = useModal();
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const wallets = useLiveQuery(() => db.wallets.filter((w) => w.isActive).toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));
  const activeShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());

  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [isVipCash, setIsVipCash] = useState(false);
  const [defaultWalletId, setDefaultWalletId] = useState('');

  // Edit Modal
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // VIP Cash Customer Modal & Operations
  const [vipCustomer, setVipCustomer] = useState<Customer | null>(null);
  const [vipActiveSection, setVipActiveSection] = useState<'operations' | 'settlement'>('operations');
  const [vipOpType, setVipOpType] = useState<'transfer' | 'receive'>('transfer');
  const [vipWalletId, setVipWalletId] = useState<string>('');
  const [vipAmount, setVipAmount] = useState<string>('');
  const [vipCommission, setVipCommission] = useState<string>('');
  const [isCustomVipComm, setIsCustomVipComm] = useState<boolean>(false);
  const [vipNotes, setVipNotes] = useState<string>('');
  const [vipSettleAmount, setVipSettleAmount] = useState<string>('');
  const [vipSettleNotes, setVipSettleNotes] = useState<string>('');

  // Pay Debt Modal
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

  // Manual Debt Adjustment Modal
  const [adjustParty, setAdjustParty] = useState<{ type: 'customer' | 'supplier'; party: Customer | Supplier } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  // Ledger / Agenda Statement Modal
  const [viewingLedgerParty, setViewingLedgerParty] = useState<{ type: 'customer' | 'supplier'; party: Customer | Supplier } | null>(null);

  const cur = settings?.currency || 'ج.م';

  // Ledger queries
  const ledgerTransactions = useLiveQuery(async () => {
    if (!viewingLedgerParty) return [];
    return await db.debtTransactions
      .where('partyId')
      .equals(viewingLedgerParty.party.id)
      .reverse()
      .sortBy('createdAt');
  }, [viewingLedgerParty?.party.id]) || [];

  // VIP Customer live query & transactions
  const liveVipCustomer = customers.find((c) => c.id === vipCustomer?.id) || vipCustomer;

  const vipTransactions = useLiveQuery(async () => {
    if (!vipCustomer) return [];
    return await db.debtTransactions
      .where('partyId')
      .equals(vipCustomer.id)
      .reverse()
      .sortBy('createdAt');
  }, [vipCustomer?.id]) || [];

  const calcVipCommission = (val: number, op: 'transfer' | 'receive') => {
    if (!val || val <= 0) return 0;
    const rules = settings?.commissionRules;
    if (op === 'transfer') {
      const feePerThousand = rules?.transferFeePerThousand ?? 10;
      const minFee = rules?.minTransferFee ?? 5;
      return Math.max(minFee, Math.ceil((val / 1000) * feePerThousand));
    } else {
      const feePerThousand = rules?.withdrawFeePerThousand ?? 10;
      const minFee = rules?.minWithdrawFee ?? 5;
      return Math.max(minFee, Math.ceil((val / 1000) * feePerThousand));
    }
  };

  const handleVipAmountChange = (valStr: string) => {
    setVipAmount(valStr);
    if (!isCustomVipComm) {
      const val = parseFloat(valStr) || 0;
      const autoFee = calcVipCommission(val, vipOpType);
      setVipCommission(autoFee > 0 ? autoFee.toString() : '');
    }
  };

  const handleVipOpTypeChange = (op: 'transfer' | 'receive') => {
    setVipOpType(op);
    if (!isCustomVipComm) {
      const val = parseFloat(vipAmount) || 0;
      const autoFee = calcVipCommission(val, op);
      setVipCommission(autoFee > 0 ? autoFee.toString() : '');
    }
  };

  const openVipModal = (customer: Customer) => {
    setVipCustomer(customer);
    setVipActiveSection('operations');
    setVipOpType('transfer');
    setVipAmount('');
    setVipCommission('');
    setIsCustomVipComm(false);
    setVipNotes('');
    setVipSettleAmount(customer.vipBalance ? Math.abs(customer.vipBalance).toString() : '');
    setVipSettleNotes('');
    setVipWalletId(customer.defaultWalletId || (wallets[0]?.id ?? ''));
  };

  const resetForm = () => {
    setName('');
    setCompany('');
    setPhone('');
    setInitialBalance('');
    setNotes('');
    setIsVipCash(false);
    setDefaultWalletId('');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      showAlert('الاسم ورقم الهاتف حقول مطلوبة.', 'بيانات ناقصة', 'warning');
      return;
    }

    const initBal = parseFloat(initialBalance) || 0;

    if (activeTab === 'customers') {
      const newCustomer: Customer = {
        id: `cust_${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        totalDebt: initBal,
        totalPaid: 0,
        isVipCash: isVipCash,
        defaultWalletId: isVipCash && defaultWalletId ? defaultWalletId : undefined,
        vipBalance: 0,
        vipTotalSent: 0,
        vipTotalReceived: 0,
        vipTotalProfit: 0,
        vipUnsettledProfit: 0,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      await db.customers.add(newCustomer);

      if (initBal > 0) {
        await db.debtTransactions.add({
          id: `dt_${Date.now()}`,
          partyType: 'customer',
          partyId: newCustomer.id,
          partyName: newCustomer.name,
          shiftId: activeShift?.id,
          type: 'debt_increase',
          amount: initBal,
          balanceBefore: 0,
          balanceAfter: initBal,
          notes: 'رصيد ديون افتتاحي عند إنشاء الحساب',
          recordedBy: activeShift?.cashierName || 'المدير',
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      const newSupplier: Supplier = {
        id: `sup_${Date.now()}`,
        name: name.trim(),
        company: company.trim() || undefined,
        phone: phone.trim(),
        totalOwed: initBal,
        totalPaid: 0,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      await db.suppliers.add(newSupplier);

      if (initBal > 0) {
        await db.debtTransactions.add({
          id: `dt_${Date.now()}`,
          partyType: 'supplier',
          partyId: newSupplier.id,
          partyName: newSupplier.name,
          shiftId: activeShift?.id,
          type: 'debt_increase',
          amount: initBal,
          balanceBefore: 0,
          balanceAfter: initBal,
          notes: 'رصيد مستحقات افتتاحي عند إنشاء الحساب',
          recordedBy: activeShift?.cashierName || 'المدير',
          createdAt: new Date().toISOString(),
        });
      }
    }
    setShowAddModal(false);
    resetForm();
    showToast(`تمت إضافة ${activeTab === 'customers' ? 'العميل' : 'المورد'} بنجاح`);
  };

  const handleExecuteVipOp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveVipCustomer) return;
    if (!activeShift) {
      showAlert('يرجى فتح وردية أولاً لتنفيذ معاملات كاش المحافظ.', 'وردية مغلقة', 'warning');
      return;
    }
    const numAmount = parseFloat(vipAmount);
    if (!numAmount || numAmount <= 0) {
      showAlert('يرجى إدخال مبلغ صحيح أكبر من الصفر.', 'مبلغ غير صحيح', 'warning');
      return;
    }
    const numCommission = parseFloat(vipCommission) || 0;
    const selectedWallet = wallets.find((w) => w.id === vipWalletId);
    if (!selectedWallet) {
      showAlert('يرجى اختيار المحفظة المراد التعامل معها.', 'محفظة غير محددة', 'warning');
      return;
    }

    if (vipOpType === 'transfer') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      const allWtx = await db.walletTransactions.where('walletId').equals(selectedWallet.id).toArray();
      const outgoingTxs = allWtx.filter((t) => t.type === 'cash_out_to_customer' || t.type === 'instapay_transfer');

      // 1. Daily Limit Check (strictly uses pure transfer principal numAmount)
      if (selectedWallet.dailyLimit && selectedWallet.dailyLimit > 0) {
        const todayOut = outgoingTxs
          .filter((t) => new Date(t.createdAt).getTime() >= startOfToday)
          .reduce((s, t) => s + t.amount, 0);

        if (todayOut + numAmount > selectedWallet.dailyLimit) {
          const proceed = await showConfirm(
            `تنبيه: تحويل مبلغ ${numAmount.toLocaleString()} ${cur} سيتجاوز الحد اليومي المحدد للخط (${selectedWallet.dailyLimit.toLocaleString()} ${cur})!\nالمحول اليوم حتى الآن: ${todayOut.toLocaleString()} ${cur} (أصل التحويل بدون عمولات)\n\nهل تريد المتابعة وتأكيد العملية؟`,
            'تجاوز الليميت اليومي',
            { confirmText: 'متابعة التحويل', cancelText: 'إلغاء', danger: true }
          );
          if (!proceed) return;
        }
      }

      // 2. Monthly Limit Check (strictly uses pure transfer principal numAmount)
      if (selectedWallet.monthlyLimit && selectedWallet.monthlyLimit > 0) {
        const monthOut = outgoingTxs
          .filter((t) => new Date(t.createdAt).getTime() >= startOfMonth)
          .reduce((s, t) => s + t.amount, 0);

        if (monthOut + numAmount > selectedWallet.monthlyLimit) {
          const proceed = await showConfirm(
            `تنبيه: تحويل مبلغ ${numAmount.toLocaleString()} ${cur} سيتجاوز الحد الشهري المحدد للخط (${selectedWallet.monthlyLimit.toLocaleString()} ${cur})!\nالمحول خلال الشهر: ${monthOut.toLocaleString()} ${cur} (أصل التحويل بدون عمولات)\n\nهل تريد المتابعة وتأكيد العملية؟`,
            'تجاوز الليميت الشهري',
            { confirmText: 'متابعة التحويل', cancelText: 'إلغاء', danger: true }
          );
          if (!proceed) return;
        }
      }

      if (selectedWallet.balance < numAmount) {
        const proceed = await showConfirm(
          `رصيد المحفظة الحالي (${selectedWallet.balance.toLocaleString()} ${cur}) أقل من المبلغ المطلوب تحويله (${numAmount.toLocaleString()} ${cur}). هل تريد المتابعة على أية حال؟`,
          'رصيد المحفظة منخفض',
          { confirmText: 'متابعة التحويل', cancelText: 'إلغاء', danger: true }
        );
        if (!proceed) return;
      }

      const prevBal = liveVipCustomer.vipBalance || 0;
      const newBal = prevBal + numAmount + numCommission;
      const newTotalSent = (liveVipCustomer.vipTotalSent || 0) + numAmount;
      const newTotalProfit = (liveVipCustomer.vipTotalProfit || 0) + numCommission;
      const newUnsettledProfit = (liveVipCustomer.vipUnsettledProfit || 0) + numCommission;

      await db.transaction('rw', [db.wallets, db.walletTransactions, db.customers, db.debtTransactions], async () => {
        await db.wallets.update(selectedWallet.id, { balance: selectedWallet.balance - numAmount });

        await db.walletTransactions.add({
          id: `wtx_${Date.now()}`,
          walletId: selectedWallet.id,
          walletName: selectedWallet.name,
          type: 'cash_out_to_customer',
          amount: numAmount,
          commission: numCommission,
          networkFee: 0,
          netProfit: numCommission,
          customerPhone: liveVipCustomer.phone,
          customerName: liveVipCustomer.name,
          shiftId: activeShift.id,
          cashierName: activeShift.cashierName || 'المدير',
          notes: `تحويل لعميل كاش مميز (${liveVipCustomer.name}) - ${vipNotes || 'أجندة جارية'}`.trim(),
          createdAt: new Date().toISOString(),
        });

        await db.customers.update(liveVipCustomer.id, {
          vipBalance: newBal,
          vipTotalSent: newTotalSent,
          vipTotalProfit: newTotalProfit,
          vipUnsettledProfit: newUnsettledProfit,
        });

        await db.debtTransactions.add({
          id: `dt_${Date.now()}`,
          partyType: 'customer',
          partyId: liveVipCustomer.id,
          partyName: liveVipCustomer.name,
          shiftId: activeShift.id,
          type: 'vip_cash_transfer',
          amount: numAmount,
          commission: numCommission,
          walletId: selectedWallet.id,
          walletName: selectedWallet.name,
          balanceBefore: prevBal,
          balanceAfter: newBal,
          notes: vipNotes.trim() || `تحويل كاش من محفظة [${selectedWallet.name}] - عمولة: ${numCommission} ${cur}`,
          recordedBy: activeShift.cashierName || 'المدير',
          createdAt: new Date().toISOString(),
        });
      });

      showToast(`⚡ تم تحويل ${numAmount.toLocaleString()} ${cur} بنجاح إلى حساب ${liveVipCustomer.name}`);
    } else {
      const prevBal = liveVipCustomer.vipBalance || 0;
      const newBal = prevBal - (numAmount - numCommission);
      const newTotalReceived = (liveVipCustomer.vipTotalReceived || 0) + numAmount;
      const newTotalProfit = (liveVipCustomer.vipTotalProfit || 0) + numCommission;
      const newUnsettledProfit = (liveVipCustomer.vipUnsettledProfit || 0) + numCommission;

      await db.transaction('rw', [db.wallets, db.walletTransactions, db.customers, db.debtTransactions], async () => {
        await db.wallets.update(selectedWallet.id, { balance: selectedWallet.balance + numAmount });

        await db.walletTransactions.add({
          id: `wtx_${Date.now()}`,
          walletId: selectedWallet.id,
          walletName: selectedWallet.name,
          type: 'cash_in_from_customer',
          amount: numAmount,
          commission: numCommission,
          networkFee: 0,
          netProfit: numCommission,
          customerPhone: liveVipCustomer.phone,
          customerName: liveVipCustomer.name,
          shiftId: activeShift.id,
          cashierName: activeShift.cashierName || 'المدير',
          notes: `استلام من عميل كاش مميز (${liveVipCustomer.name}) - ${vipNotes || 'أجندة جارية'}`.trim(),
          createdAt: new Date().toISOString(),
        });

        await db.customers.update(liveVipCustomer.id, {
          vipBalance: newBal,
          vipTotalReceived: newTotalReceived,
          vipTotalProfit: newTotalProfit,
          vipUnsettledProfit: newUnsettledProfit,
        });

        await db.debtTransactions.add({
          id: `dt_${Date.now()}`,
          partyType: 'customer',
          partyId: liveVipCustomer.id,
          partyName: liveVipCustomer.name,
          shiftId: activeShift.id,
          type: 'vip_cash_receive',
          amount: numAmount,
          commission: numCommission,
          walletId: selectedWallet.id,
          walletName: selectedWallet.name,
          balanceBefore: prevBal,
          balanceAfter: newBal,
          notes: vipNotes.trim() || `استلام كاش على محفظة [${selectedWallet.name}] - عمولة: ${numCommission} ${cur}`,
          recordedBy: activeShift.cashierName || 'المدير',
          createdAt: new Date().toISOString(),
        });
      });

      showToast(`⚡ تم استلام ${numAmount.toLocaleString()} ${cur} بنجاح وقيدها في حساب ${liveVipCustomer.name}`);
    }

    setVipAmount('');
    setVipCommission('');
    setIsCustomVipComm(false);
    setVipNotes('');
  };

  const handleSettleVipAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveVipCustomer) return;
    if (!activeShift) {
      showAlert('يرجى فتح وردية أولاً لتسوية الحساب وربطه بدرج الكاش والأرباح.', 'وردية مغلقة', 'warning');
      return;
    }
    const settleAmt = parseFloat(vipSettleAmount);
    if (!settleAmt || settleAmt <= 0) {
      showAlert('يرجى إدخال مبلغ تسوية صحيح أكبر من الصفر.', 'مبلغ غير صحيح', 'warning');
      return;
    }

    const currentBal = liveVipCustomer.vipBalance || 0;
    if (currentBal === 0) {
      showAlert('حساب العميل متزن وخالص بالفعل (0 ج). لا توجد مبالغ لتسويتها.', 'الحساب متزن', 'info');
      return;
    }

    const customerOwesStore = currentBal > 0;
    const maxSettle = Math.abs(currentBal);
    if (settleAmt > maxSettle) {
      showAlert(`مبلغ التسوية (${settleAmt.toLocaleString()} ${cur}) أكبر من إجمالي الرصيد المستحق (${maxSettle.toLocaleString()} ${cur}).`, 'مبلغ زائد', 'warning');
      return;
    }

    const newBal = customerOwesStore ? currentBal - settleAmt : currentBal + settleAmt;
    const unsettledProfit = liveVipCustomer.vipUnsettledProfit || 0;

    await db.transaction('rw', [db.shifts, db.customers, db.debtTransactions], async () => {
      const shift = await db.shifts.get(activeShift.id);
      if (shift) {
        const cashDelta = customerOwesStore ? settleAmt : -settleAmt;
        await db.shifts.update(activeShift.id, {
          closingCashSystem: shift.closingCashSystem + cashDelta,
          totalCommissions: (shift.totalCommissions || 0) + unsettledProfit,
        });
      }

      await db.customers.update(liveVipCustomer.id, {
        vipBalance: newBal,
        vipUnsettledProfit: 0,
      });

      await db.debtTransactions.add({
        id: `dt_${Date.now()}`,
        partyType: 'customer',
        partyId: liveVipCustomer.id,
        partyName: liveVipCustomer.name,
        shiftId: activeShift.id,
        type: 'vip_cash_settlement',
        amount: settleAmt,
        commission: unsettledProfit,
        balanceBefore: currentBal,
        balanceAfter: newBal,
        notes: vipSettleNotes.trim() || (customerOwesStore
          ? `تسوية حساب مع درج الوردية (توريد كاش +${settleAmt.toLocaleString()} ${cur} وتسميع أرباح +${unsettledProfit.toLocaleString()} ${cur})`
          : `تسوية حساب مع درج الوردية (صرف كاش للعميل -${settleAmt.toLocaleString()} ${cur} وتسميع أرباح +${unsettledProfit.toLocaleString()} ${cur})`),
        recordedBy: activeShift.cashierName || 'المدير',
        createdAt: new Date().toISOString(),
      });
    });

    showToast(`✅ تمت تسوية مبلغ ${settleAmt.toLocaleString()} ${cur} بنجاح وربطه بالدرج وتسميع الأرباح!`);
    setVipSettleAmount('');
    setVipSettleNotes('');
    setVipActiveSection('operations');
  };

  const handlePayCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    const prevDebt = payingCustomer.totalDebt || 0;
    const newDebt = Math.max(0, prevDebt - amt);

    await db.customers.update(payingCustomer.id, {
      totalPaid: (payingCustomer.totalPaid || 0) + amt,
      totalDebt: newDebt,
    });

    const tx: DebtTransaction = {
      id: `dt_${Date.now()}`,
      partyType: 'customer',
      partyId: payingCustomer.id,
      partyName: payingCustomer.name,
      shiftId: activeShift?.id,
      type: 'payment',
      amount: amt,
      balanceBefore: prevDebt,
      balanceAfter: newDebt,
      notes: payNote.trim() || 'تسديد دفعة حساب',
      recordedBy: activeShift?.cashierName || 'المدير',
      createdAt: new Date().toISOString(),
    };
    await db.debtTransactions.add(tx);

    showToast(`تم تسجيل دفعة بقيمة ${amt.toLocaleString()} ${cur} للعميل ${payingCustomer.name}`);
    setPayingCustomer(null);
    setPayAmount('');
    setPayNote('');
  };

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    const prevOwed = payingSupplier.totalOwed || 0;
    const newOwed = Math.max(0, prevOwed - amt);

    await db.suppliers.update(payingSupplier.id, {
      totalPaid: (payingSupplier.totalPaid || 0) + amt,
      totalOwed: newOwed,
    });

    const tx: DebtTransaction = {
      id: `dt_${Date.now()}`,
      partyType: 'supplier',
      partyId: payingSupplier.id,
      partyName: payingSupplier.name,
      shiftId: activeShift?.id,
      type: 'payment',
      amount: amt,
      balanceBefore: prevOwed,
      balanceAfter: newOwed,
      notes: payNote.trim() || 'دفع دفعة للمورد',
      recordedBy: activeShift?.cashierName || 'المدير',
      createdAt: new Date().toISOString(),
    };
    await db.debtTransactions.add(tx);

    showToast(`تم تسجيل دفعة بقيمة ${amt.toLocaleString()} ${cur} للمورد ${payingSupplier.name}`);
    setPayingSupplier(null);
    setPayAmount('');
    setPayNote('');
  };

  const handleAdjustDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustParty) return;
    const amt = parseFloat(adjustAmount);
    if (!amt || amt <= 0) {
      showAlert('يرجى إدخال مبلغ صحيح أكبر من الصفر.', 'مبلغ غير صحيح', 'warning');
      return;
    }

    if (adjustParty.type === 'customer') {
      const cust = adjustParty.party as Customer;
      const prevDebt = cust.totalDebt || 0;
      const newDebt = prevDebt + amt;
      await db.customers.update(cust.id, {
        totalDebt: newDebt,
      });

      const tx: DebtTransaction = {
        id: `dt_${Date.now()}`,
        partyType: 'customer',
        partyId: cust.id,
        partyName: cust.name,
        shiftId: activeShift?.id,
        type: 'debt_increase',
        amount: amt,
        balanceBefore: prevDebt,
        balanceAfter: newDebt,
        notes: adjustNote.trim() || 'زيادة دين يدوية',
        recordedBy: activeShift?.cashierName || 'المدير',
        createdAt: new Date().toISOString(),
      };
      await db.debtTransactions.add(tx);
      showToast(`تمت إضافة دين بقيمة ${amt.toLocaleString()} ${cur} للعميل ${cust.name}`);
    } else {
      const supp = adjustParty.party as Supplier;
      const prevOwed = supp.totalOwed || 0;
      const newOwed = prevOwed + amt;
      await db.suppliers.update(supp.id, {
        totalOwed: newOwed,
      });

      const tx: DebtTransaction = {
        id: `dt_${Date.now()}`,
        partyType: 'supplier',
        partyId: supp.id,
        partyName: supp.name,
        shiftId: activeShift?.id,
        type: 'debt_increase',
        amount: amt,
        balanceBefore: prevOwed,
        balanceAfter: newOwed,
        notes: adjustNote.trim() || 'إضافة مستحقات يدوية',
        recordedBy: activeShift?.cashierName || 'المدير',
        createdAt: new Date().toISOString(),
      };
      await db.debtTransactions.add(tx);
      showToast(`تمت إضافة مستحقات بقيمة ${amt.toLocaleString()} ${cur} للمورد ${supp.name}`);
    }

    setAdjustParty(null);
    setAdjustAmount('');
    setAdjustNote('');
  };

  const totalCustomerDebt = customers.reduce((s, c) => s + (c.totalDebt || 0), 0);
  const totalSupplierDebt = suppliers.reduce((s, s2) => s + (s2.totalOwed || 0), 0);

  const filteredCustomers = customers.filter(
    (c) => c.name.includes(searchQuery) || c.phone.includes(searchQuery)
  );
  const filteredSuppliers = suppliers.filter(
    (s) => s.name.includes(searchQuery) || s.phone.includes(searchQuery)
  );

  const renderModalForm = () => (
    <form onSubmit={handleAdd} className="p-6 space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">الاسم الكامل *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={activeTab === 'customers' ? 'اسم العميل' : 'اسم المورد'}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold focus:border-blue-500 focus:outline-none"
          required
          autoFocus
        />
      </div>

      {activeTab === 'suppliers' && (
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الشركة / العلامة التجارية</label>
          <div className="relative">
            <Building2 className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="اختياري"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 pr-10 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم الهاتف *</label>
        <div className="relative">
          <Phone className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 pr-10 text-sm font-mono focus:border-blue-500 focus:outline-none"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          {activeTab === 'customers' ? 'رصيد ديون أولي (إن وجد)' : 'مبلغ مستحق للمورد (إن وجد)'}
        </label>
        <div className="relative">
          <DollarSign className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="number"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 pr-10 text-sm font-mono focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {activeTab === 'customers' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2.5">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isVipCash}
              onChange={(e) => {
                setIsVipCash(e.target.checked);
                if (e.target.checked && !defaultWalletId && wallets.length > 0) {
                  setDefaultWalletId(wallets[0].id);
                }
              }}
              className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950">
              <Zap className="h-4 w-4 text-amber-600 fill-amber-500" />
              <span>عميل كاش مميز (محافظ إلكترونية وأجندة كاش)</span>
            </div>
          </label>

          {isVipCash && (
            <div>
              <label className="block text-[11px] font-bold text-amber-900 mb-1">
                المحفظة الافتراضية للتعامل
              </label>
              <select
                value={defaultWalletId}
                onChange={(e) => setDefaultWalletId(e.target.value)}
                className="w-full rounded-xl border border-amber-200 bg-white p-2.5 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none"
              >
                <option value="">بدون محفظة افتراضية (اختيار يدوي عند العملية)</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.balance.toLocaleString()} {cur})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="أي معلومات إضافية..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-blue-500 focus:outline-none resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => { setShowAddModal(false); resetForm(); }}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
        >
          إلغاء
        </button>
        <button
          type="submit"
          className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-2.5 text-sm font-bold shadow-sm transition cursor-pointer"
        >
          إضافة {activeTab === 'customers' ? 'عميل' : 'مورد'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-5 pb-12">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">عملاء / ديون مستحقة</p>
            <p className="text-xl font-black text-slate-900">
              {customers.length} عميل
            </p>
            {totalCustomerDebt > 0 && (
              <p className="text-xs text-red-600 font-bold mt-0.5">إجمالي ديون: {totalCustomerDebt.toLocaleString()} {cur}</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center">
            <Truck className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">موردين / مستحق لهم</p>
            <p className="text-xl font-black text-slate-900">
              {suppliers.length} مورد
            </p>
            {totalSupplierDebt > 0 && (
              <p className="text-xs text-amber-600 font-bold mt-0.5">إجمالي مستحق: {totalSupplierDebt.toLocaleString()} {cur}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs + Search + Add */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-xl overflow-hidden border border-slate-200 shrink-0">
            <button
              onClick={() => setActiveTab('customers')}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-bold transition cursor-pointer ${
                activeTab === 'customers' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Users className="h-4 w-4" />
              عملاء ({customers.length})
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-bold transition cursor-pointer ${
                activeTab === 'suppliers' ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Truck className="h-4 w-4" />
              موردون ({suppliers.length})
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو الهاتف..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-10 pl-4 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold px-5 py-2.5 shadow-sm transition shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة {activeTab === 'customers' ? 'عميل' : 'مورد'}</span>
          </button>
        </div>
      </div>

      {/* Customers List */}
      {activeTab === 'customers' && (
        <div className="space-y-3">
          {filteredCustomers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
              لا يوجد عملاء مضافون بعد
            </div>
          ) : (
            filteredCustomers.map((customer) => {
              const debt = customer.totalDebt || 0;
              const paid = customer.totalPaid || 0;
              return (
                <div
                  key={customer.id}
                  className={`bg-white rounded-2xl border shadow-xs p-5 flex items-center gap-4 transition hover:shadow-sm ${
                    debt > 0 ? 'border-red-100' : 'border-slate-100'
                  }`}
                >
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${
                    debt > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {customer.name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-slate-900 text-sm">{customer.name}</p>
                      {customer.isVipCash && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-200">
                          <Zap className="h-3 w-3 fill-amber-500 text-amber-500" />
                          عميل كاش مميز
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{customer.phone}</p>
                    {customer.isVipCash && (
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-mono font-black px-2 py-0.5 rounded-md ${
                          (customer.vipBalance || 0) > 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                            : (customer.vipBalance || 0) < 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          حساب الكاش:{' '}
                          {(customer.vipBalance || 0) > 0
                            ? `عليه ${(customer.vipBalance || 0).toLocaleString()} ${cur}`
                            : (customer.vipBalance || 0) < 0
                            ? `له ${Math.abs(customer.vipBalance || 0).toLocaleString()} ${cur}`
                            : `خالص (0)`}
                        </span>
                        {customer.defaultWalletId && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                            المحفظة:{' '}
                            {wallets.find((w) => w.id === customer.defaultWalletId)?.name || 'محددة'}
                          </span>
                        )}
                      </div>
                    )}
                    {customer.notes && <p className="text-[11px] text-slate-400 mt-1 truncate">{customer.notes}</p>}
                  </div>

                  <div className="text-left shrink-0 space-y-1">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">الدين</p>
                      <p className={`font-mono font-black text-sm ${debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {debt.toLocaleString()} {cur}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">مدفوع</p>
                      <p className="font-mono font-bold text-[11px] text-slate-600">{paid.toLocaleString()} {cur}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-[320px] justify-end">
                    {customer.isVipCash && (
                      <button
                        onClick={() => openVipModal(customer)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-[11px] font-black shadow-xs transition cursor-pointer"
                        title="فتح كاش وأجندة العميل المميز"
                      >
                        <Zap className="h-3.5 w-3.5 fill-white" />
                        <span>أجندة الكاش</span>
                      </button>
                    )}
                    <button
                      onClick={() => setViewingLedgerParty({ type: 'customer', party: customer })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 text-[11px] font-bold hover:bg-purple-100 transition cursor-pointer"
                      title="عرض كشف الحساب والأجندة"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      الأجندة
                    </button>
                    <button
                      onClick={() => { setAdjustParty({ type: 'customer', party: customer }); setAdjustAmount(''); setAdjustNote(''); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-[11px] font-bold hover:bg-rose-100 transition cursor-pointer"
                      title="إضافة دين يدوياً"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      + دين
                    </button>
                    {debt > 0 && (
                      <button
                        onClick={() => { setPayingCustomer(customer); setPayAmount(''); setPayNote(''); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        تسديد
                      </button>
                    )}
                    <button
                      onClick={() => setEditingCustomer({ ...customer })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[11px] font-bold hover:bg-blue-100 transition cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      تعديل
                    </button>
                    <button
                      onClick={async () => {
                        const confirmed = await showConfirm(
                          `هل أنت متأكد من حذف حساب العميل "${customer.name}"؟`,
                          'تأكيد حذف عميل',
                          { confirmText: 'حذف العميل', cancelText: 'إلغاء', danger: true }
                        );
                        if (confirmed) {
                          await db.customers.delete(customer.id);
                          showToast(`تم حذف العميل ${customer.name}`);
                        }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 text-red-600 text-[11px] font-bold hover:bg-red-100 transition cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Suppliers List */}
      {activeTab === 'suppliers' && (
        <div className="space-y-3">
          {filteredSuppliers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
              لا يوجد موردون مضافون بعد
            </div>
          ) : (
            filteredSuppliers.map((supplier) => {
              const owed = supplier.totalOwed || 0;
              const paid = supplier.totalPaid || 0;
              return (
                <div
                  key={supplier.id}
                  className={`bg-white rounded-2xl border shadow-xs p-5 flex items-center gap-4 transition hover:shadow-sm ${
                    owed > 0 ? 'border-amber-100' : 'border-slate-100'
                  }`}
                >
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${
                    owed > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {supplier.name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-sm">{supplier.name}</p>
                    {supplier.company && (
                      <p className="text-xs text-blue-600 font-semibold mt-0.5">{supplier.company}</p>
                    )}
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{supplier.phone}</p>
                  </div>

                  <div className="text-left shrink-0 space-y-1">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">مستحق</p>
                      <p className={`font-mono font-black text-sm ${owed > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {owed.toLocaleString()} {cur}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">مدفوع</p>
                      <p className="font-mono font-bold text-[11px] text-slate-600">{paid.toLocaleString()} {cur}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-[280px] justify-end">
                    <button
                      onClick={() => setViewingLedgerParty({ type: 'supplier', party: supplier })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 text-[11px] font-bold hover:bg-purple-100 transition cursor-pointer"
                      title="عرض كشف الحساب والأجندة"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      الأجندة
                    </button>
                    <button
                      onClick={() => { setAdjustParty({ type: 'supplier', party: supplier }); setAdjustAmount(''); setAdjustNote(''); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-[11px] font-bold hover:bg-amber-100 transition cursor-pointer"
                      title="إضافة مستحقات يدوياً"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      + مستحق
                    </button>
                    {owed > 0 && (
                      <button
                        onClick={() => { setPayingSupplier(supplier); setPayAmount(''); setPayNote(''); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        دفع
                      </button>
                    )}
                    <button
                      onClick={() => setEditingSupplier({ ...supplier })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[11px] font-bold hover:bg-blue-100 transition cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      تعديل
                    </button>
                    <button
                      onClick={async () => {
                        const confirmed = await showConfirm(
                          `هل أنت متأكد من حذف حساب المورد "${supplier.name}"؟`,
                          'تأكيد حذف مورد',
                          { confirmText: 'حذف المورد', cancelText: 'إلغاء', danger: true }
                        );
                        if (confirmed) {
                          await db.suppliers.delete(supplier.id);
                          showToast(`تم حذف المورد ${supplier.name}`);
                        }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 text-red-600 text-[11px] font-bold hover:bg-red-100 transition cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL: Add Customer/Supplier */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className={`flex items-center justify-between px-6 py-4 ${
              activeTab === 'customers'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700'
                : 'bg-gradient-to-r from-amber-500 to-orange-500'
            }`}>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                  {activeTab === 'customers' ? <UserCheck className="h-5 w-5 text-white" /> : <Truck className="h-5 w-5 text-white" />}
                </div>
                <h3 className="font-display text-lg font-bold text-white">
                  إضافة {activeTab === 'customers' ? 'عميل جديد' : 'مورد جديد'}
                </h3>
              </div>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderModalForm()}
          </div>
        </div>
      )}

      {/* MODAL: Edit Customer */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <Edit2 className="h-5 w-5 text-white" />
                <h3 className="font-display text-lg font-bold text-white">تعديل بيانات العميل</h3>
              </div>
              <button onClick={() => setEditingCustomer(null)} className="text-white/70 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await db.customers.update(editingCustomer.id, {
                  name: editingCustomer.name,
                  phone: editingCustomer.phone,
                  isVipCash: editingCustomer.isVipCash,
                  defaultWalletId: editingCustomer.isVipCash ? editingCustomer.defaultWalletId : undefined,
                  notes: editingCustomer.notes,
                });
                setEditingCustomer(null);
                showToast('تم حفظ التعديلات بنجاح');
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الاسم *</label>
                <input
                  type="text"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer((p) => p ? { ...p, name: e.target.value } : null)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الهاتف *</label>
                <input
                  type="tel"
                  value={editingCustomer.phone}
                  onChange={(e) => setEditingCustomer((p) => p ? { ...p, phone: e.target.value } : null)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-mono focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingCustomer.isVipCash || false}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditingCustomer((p) =>
                        p ? {
                          ...p,
                          isVipCash: checked,
                          defaultWalletId: checked && !p.defaultWalletId && wallets.length > 0 ? wallets[0].id : p.defaultWalletId,
                        } : null
                      );
                    }}
                    className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950">
                    <Zap className="h-4 w-4 text-amber-600 fill-amber-500" />
                    <span>عميل كاش مميز (محافظ إلكترونية وأجندة كاش)</span>
                  </div>
                </label>

                {editingCustomer.isVipCash && (
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      المحفظة الافتراضية
                    </label>
                    <select
                      value={editingCustomer.defaultWalletId || ''}
                      onChange={(e) =>
                        setEditingCustomer((p) => (p ? { ...p, defaultWalletId: e.target.value } : null))
                      }
                      className="w-full rounded-xl border border-amber-200 bg-white p-2.5 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">بدون محفظة افتراضية</option>
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.balance.toLocaleString()} {cur})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات</label>
                <textarea
                  value={editingCustomer.notes || ''}
                  onChange={(e) => setEditingCustomer((p) => p ? { ...p, notes: e.target.value } : null)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-2.5 text-sm font-bold shadow-sm transition cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Supplier */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <Edit2 className="h-5 w-5 text-white" />
                <h3 className="font-display text-lg font-bold text-white">تعديل بيانات المورد</h3>
              </div>
              <button onClick={() => setEditingSupplier(null)} className="text-white/70 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await db.suppliers.update(editingSupplier.id, {
                  name: editingSupplier.name,
                  company: editingSupplier.company,
                  phone: editingSupplier.phone,
                  notes: editingSupplier.notes,
                });
                setEditingSupplier(null);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المورد *</label>
                <input
                  type="text"
                  value={editingSupplier.name}
                  onChange={(e) => setEditingSupplier((p) => p ? { ...p, name: e.target.value } : null)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الشركة</label>
                <input
                  type="text"
                  value={editingSupplier.company || ''}
                  onChange={(e) => setEditingSupplier((p) => p ? { ...p, company: e.target.value } : null)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الهاتف *</label>
                <input
                  type="tel"
                  value={editingSupplier.phone}
                  onChange={(e) => setEditingSupplier((p) => p ? { ...p, phone: e.target.value } : null)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-mono focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات</label>
                <textarea
                  value={editingSupplier.notes || ''}
                  onChange={(e) => setEditingSupplier((p) => p ? { ...p, notes: e.target.value } : null)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white py-2.5 text-sm font-bold shadow-sm transition cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Pay Customer Debt */}
      {payingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-white" />
                <h3 className="font-display font-bold text-white">تسديد دين عميل</h3>
              </div>
              <button onClick={() => setPayingCustomer(null)} className="text-white/70 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handlePayCustomer} className="p-6 space-y-4">
              <div className="bg-red-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-500">الدين المتبقي</p>
                <p className="text-2xl font-black text-red-700 font-mono">{payingCustomer.totalDebt.toLocaleString()} {cur}</p>
                <p className="text-sm font-bold text-slate-700 mt-1">{payingCustomer.name}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">المبلغ المدفوع</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0"
                  max={payingCustomer.totalDebt}
                  className="w-full rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 text-center text-xl font-mono font-black focus:border-emerald-500 focus:outline-none"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات على الدفعة (اختياري)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="مثال: دفعة كاش، تحويل، إيصال..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPayingCustomer(null)}
                  className="flex-1 rounded-xl border py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-2.5 text-sm font-bold transition cursor-pointer"
                >
                  تسجيل التسديد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Pay Supplier */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-white" />
                <h3 className="font-display font-bold text-white">دفع للمورد</h3>
              </div>
              <button onClick={() => setPayingSupplier(null)} className="text-white/70 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handlePaySupplier} className="p-6 space-y-4">
              <div className="bg-amber-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-500">المبلغ المستحق</p>
                <p className="text-2xl font-black text-amber-700 font-mono">{payingSupplier.totalOwed.toLocaleString()} {cur}</p>
                <p className="text-sm font-bold text-slate-700 mt-1">{payingSupplier.name}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">المبلغ المدفوع</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0"
                  max={payingSupplier.totalOwed}
                  className="w-full rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-center text-xl font-mono font-black focus:border-amber-500 focus:outline-none"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات على الدفعة (اختياري)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="مثال: سداد بضاعة، كاش، تحويل..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="flex-1 rounded-xl border py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white py-2.5 text-sm font-bold transition cursor-pointer"
                >
                  تسجيل الدفع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Manual Debt Adjustment */}
      {adjustParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className={`flex items-center justify-between px-6 py-4 ${
              adjustParty.type === 'customer'
                ? 'bg-gradient-to-r from-rose-600 to-red-600'
                : 'bg-gradient-to-r from-amber-600 to-orange-600'
            }`}>
              <div className="flex items-center gap-3">
                <PlusCircle className="h-5 w-5 text-white" />
                <h3 className="font-display font-bold text-white">
                  {adjustParty.type === 'customer' ? 'زيادة دين العميل يدوياً' : 'إضافة مستحقات للمورد يدوياً'}
                </h3>
              </div>
              <button onClick={() => setAdjustParty(null)} className="text-white/70 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAdjustDebt} className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
                <p className="text-xs text-slate-500 font-semibold">{adjustParty.party.name}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{adjustParty.party.phone}</p>
                <p className="text-xs text-slate-600 mt-2 font-bold">
                  الرصيد الحالي:{' '}
                  <span className="font-mono text-sm text-red-600">
                    {((adjustParty.type === 'customer'
                      ? (adjustParty.party as Customer).totalDebt
                      : (adjustParty.party as Supplier).totalOwed) || 0).toLocaleString()} {cur}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">المبلغ الإضافي المراد تسجيله *</label>
                <div className="relative">
                  <DollarSign className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="number"
                    step="any"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 pr-10 text-center font-mono text-lg font-black focus:border-red-500 focus:outline-none"
                    autoFocus
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">سبب المعاملة / ملاحظات *</label>
                <textarea
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  rows={2}
                  placeholder="مثال: فاتورة صيانة خارج السيستم، بضاعة يدوية، سلفة..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs focus:border-red-500 focus:outline-none resize-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustParty(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition cursor-pointer active:scale-95 ${
                    adjustParty.type === 'customer'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  تأكيد الإضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Ledger Statement */}
      {viewingLedgerParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[90vh] rounded-3xl bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-700 to-indigo-700 text-white shrink-0">
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6" />
                <div>
                  <h3 className="font-display font-bold text-lg">
                    كشف حساب وأجندة {viewingLedgerParty.type === 'customer' ? 'العميل' : 'المورد'}: {viewingLedgerParty.party.name}
                  </h3>
                  <p className="text-xs text-purple-200 font-mono mt-0.5">{viewingLedgerParty.party.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>طباعة الكشف</span>
                </button>
                <button
                  onClick={() => setViewingLedgerParty(null)}
                  className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Summary Banner */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-3 shrink-0 text-center">
              <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
                <p className="text-[11px] text-slate-400 font-semibold">
                  {viewingLedgerParty.type === 'customer' ? 'الدين المتبقي' : 'المستحق الحالي'}
                </p>
                <p className="text-lg font-black font-mono text-red-600">
                  {((viewingLedgerParty.type === 'customer'
                    ? (viewingLedgerParty.party as Customer).totalDebt
                    : (viewingLedgerParty.party as Supplier).totalOwed) || 0).toLocaleString()} {cur}
                </p>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
                <p className="text-[11px] text-slate-400 font-semibold">إجمالي المسدد</p>
                <p className="text-lg font-black font-mono text-emerald-600">
                  {(viewingLedgerParty.party.totalPaid || 0).toLocaleString()} {cur}
                </p>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
                <p className="text-[11px] text-slate-400 font-semibold">عدد الحركات بالأجندة</p>
                <p className="text-lg font-black font-mono text-purple-700">
                  {ledgerTransactions.length} حركة
                </p>
              </div>
            </div>

            {/* Transaction List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {ledgerTransactions.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-medium">
                  لا توجد حركات مسجلة في أجندة هذا الحساب بعد.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">التاريخ والوقت</th>
                        <th className="py-2.5 px-3">نوع الحركة</th>
                        <th className="py-2.5 px-3">المبلغ</th>
                        <th className="py-2.5 px-3">قبل / بعد</th>
                        <th className="py-2.5 px-3">البيان / ملاحظات</th>
                        <th className="py-2.5 px-3">المسؤول</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerTransactions.map((tx) => {
                        const isPayment = tx.type === 'payment';
                        const dateStr = new Date(tx.createdAt).toLocaleString('ar-EG', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        });
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">{dateStr}</td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] ${
                                isPayment ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {isPayment ? (
                                  <>
                                    <ArrowDownLeft className="h-3 w-3" />
                                    سداد دفعة
                                  </>
                                ) : (
                                  <>
                                    <ArrowUpRight className="h-3 w-3" />
                                    زيادة دين / فاتورة
                                  </>
                                )}
                              </span>
                            </td>
                            <td className={`py-3 px-3 font-mono font-black text-sm ${isPayment ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isPayment ? '-' : '+'}{tx.amount.toLocaleString()} {cur}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                              {tx.balanceBefore.toLocaleString()} ➔ {tx.balanceAfter.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-medium max-w-xs truncate" title={tx.notes}>
                              {tx.notes || '—'}
                            </td>
                            <td className="py-3 px-3 text-slate-400 font-semibold">{tx.recordedBy}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setViewingLedgerParty(null)}
                className="px-6 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: VIP Cash Customer Console & Agenda */}
      {vipCustomer && liveVipCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[92vh] rounded-3xl bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-600 via-amber-700 to-orange-600 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-white fill-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-lg">
                      أجندة وكاش العميل المميز: {liveVipCustomer.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold">
                      عميل كاش مميز
                    </span>
                  </div>
                  <p className="text-xs text-amber-200 font-mono mt-0.5">
                    {liveVipCustomer.phone}
                    {liveVipCustomer.defaultWalletId && (
                      <span className="mr-3 text-amber-100 font-sans">
                        • المحفظة الافتراضية: {wallets.find((w) => w.id === liveVipCustomer.defaultWalletId)?.name || 'غير محددة'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition cursor-pointer"
                  title="طباعة كشف حساب كاش العميل"
                >
                  <Printer className="h-4 w-4" />
                  <span>طباعة الكشف</span>
                </button>
                <button
                  onClick={() => setVipCustomer(null)}
                  className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Analytics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between text-amber-700">
                    <span className="text-[11px] font-bold">إجمالي التحويلات (صادر)</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-black font-mono text-slate-900 mt-1">
                    {(liveVipCustomer.vipTotalSent || 0).toLocaleString()} <span className="text-xs text-slate-500 font-normal">{cur}</span>
                  </p>
                </div>

                <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between text-blue-700">
                    <span className="text-[11px] font-bold">إجمالي الاستلامات (وارد)</span>
                    <ArrowDownLeft className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-black font-mono text-slate-900 mt-1">
                    {(liveVipCustomer.vipTotalReceived || 0).toLocaleString()} <span className="text-xs text-slate-500 font-normal">{cur}</span>
                  </p>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between text-emerald-700">
                    <span className="text-[11px] font-bold">أرباح وعمولات المحل</span>
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-black font-mono text-emerald-700 mt-1">
                    +{(liveVipCustomer.vipTotalProfit || 0).toLocaleString()} <span className="text-xs text-emerald-600 font-normal">{cur}</span>
                  </p>
                  {(liveVipCustomer.vipUnsettledProfit || 0) > 0 && (
                    <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                      قيد التقفيل: {(liveVipCustomer.vipUnsettledProfit || 0).toLocaleString()} {cur}
                    </p>
                  )}
                </div>

                <div className={`border rounded-2xl p-3.5 ${
                  (liveVipCustomer.vipBalance || 0) > 0
                    ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                    : (liveVipCustomer.vipBalance || 0) < 0
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}>
                  <span className="text-[11px] font-bold block">موقف رصيد الكاش الجاري</span>
                  <p className="text-lg font-black font-mono mt-1">
                    {(liveVipCustomer.vipBalance || 0) > 0
                      ? `عليه ${(liveVipCustomer.vipBalance || 0).toLocaleString()} ${cur}`
                      : (liveVipCustomer.vipBalance || 0) < 0
                      ? `له ${Math.abs(liveVipCustomer.vipBalance || 0).toLocaleString()} ${cur}`
                      : `خالص (0 ${cur})`}
                  </p>
                  <p className="text-[10px] font-semibold opacity-75 mt-0.5">
                    {(liveVipCustomer.vipBalance || 0) > 0
                      ? 'مطلوب تحصيله من العميل'
                      : (liveVipCustomer.vipBalance || 0) < 0
                      ? 'مستحق صرفه للعميل'
                      : 'الحساب متزن تماماً'}
                  </p>
                </div>
              </div>

              {/* Sub-Tabs: Operations vs Settlement */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setVipActiveSection('operations')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    vipActiveSection === 'operations'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  <span>معاملة كاش سريعة (تحويل / استلام)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVipActiveSection('settlement');
                    setVipSettleAmount(liveVipCustomer.vipBalance ? Math.abs(liveVipCustomer.vipBalance).toString() : '');
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    vipActiveSection === 'settlement'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <DollarSign className="h-4 w-4" />
                  <span>تقفيل وتسوية الحساب مع الدرج</span>
                </button>
              </div>

              {/* SECTION 1: OPERATIONS */}
              {vipActiveSection === 'operations' && (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => handleVipOpTypeChange('transfer')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
                        vipOpType === 'transfer'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      <span>تحويل للعميل (إرسال كاش من محفظة المحل)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVipOpTypeChange('receive')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
                        vipOpType === 'receive'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <ArrowDownLeft className="h-4 w-4" />
                      <span>استلام من العميل (استقبال كاش بمحفظة المحل)</span>
                    </button>
                  </div>

                  <form onSubmit={handleExecuteVipOp} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">المحفظة المستخدمة *</label>
                        <select
                          value={vipWalletId}
                          onChange={(e) => setVipWalletId(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none"
                          required
                        >
                          {wallets.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} (رصيدها: {w.balance.toLocaleString()} {cur})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">مبلغ المعاملة *</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={vipAmount}
                            onChange={(e) => handleVipAmountChange(e.target.value)}
                            placeholder="0"
                            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-mono font-black focus:border-amber-500 focus:outline-none text-center"
                            required
                            autoFocus
                          />
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">{cur}</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700">العمولة المستحقة</label>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomVipComm(!isCustomVipComm);
                              if (isCustomVipComm) {
                                const val = parseFloat(vipAmount) || 0;
                                const autoFee = calcVipCommission(val, vipOpType);
                                setVipCommission(autoFee > 0 ? autoFee.toString() : '');
                              }
                            }}
                            className="text-[10px] text-amber-700 font-bold hover:underline"
                          >
                            {isCustomVipComm ? 'إلغاء التعديل اليدوي' : 'تعديل يدوي'}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={vipCommission}
                            onChange={(e) => {
                              setVipCommission(e.target.value);
                              setIsCustomVipComm(true);
                            }}
                            placeholder="0"
                            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-mono font-black focus:border-amber-500 focus:outline-none text-center text-amber-700"
                          />
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">{cur}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات المعاملة (اختياري)</label>
                      <input
                        type="text"
                        value={vipNotes}
                        onChange={(e) => setVipNotes(e.target.value)}
                        placeholder="مثال: تحويل دفعة لمحل كذا، رقم المحفظة المحول لها..."
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    {/* Quick calculation notice */}
                    {parseFloat(vipAmount) > 0 && (
                      <div className="p-3 rounded-2xl bg-amber-100/70 border border-amber-200 text-xs text-amber-950 font-medium">
                        {vipOpType === 'transfer' ? (
                          <span>
                            📌 سيتم خصم <b>{parseFloat(vipAmount).toLocaleString()} {cur}</b> من المحفظة، ويزيد حساب دين العميل بمبلغ{' '}
                            <b>{((parseFloat(vipAmount) || 0) + (parseFloat(vipCommission) || 0)).toLocaleString()} {cur}</b> شامل العمولة.
                          </span>
                        ) : (
                          <span>
                            📌 سيتم إضافة <b>{parseFloat(vipAmount).toLocaleString()} {cur}</b> للمحفظة، ويقل حساب دين العميل بمبلغ{' '}
                            <b>{Math.max(0, (parseFloat(vipAmount) || 0) - (parseFloat(vipCommission) || 0)).toLocaleString()} {cur}</b> بعد خصم العمولة.
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className={`px-6 py-2.5 rounded-xl text-white text-xs font-black shadow-sm transition cursor-pointer active:scale-95 ${
                          vipOpType === 'transfer' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {vipOpType === 'transfer' ? 'تأكيد التحويل وقيده بالأجندة' : 'تأكيد الاستلام وقيده بالأجندة'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* SECTION 2: SETTLEMENT WITH DRAWER */}
              {vipActiveSection === 'settlement' && (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-3xl p-5 space-y-4">
                  <div className="bg-white border border-emerald-200 rounded-2xl p-4">
                    <p className="text-xs font-bold text-slate-700">الموقف الحالي للتسوية مع درج الكاش:</p>
                    {(liveVipCustomer.vipBalance || 0) > 0 ? (
                      <p className="text-sm font-semibold text-rose-700 mt-1">
                        العميل مدين للمحل بمبلغ{' '}
                        <span className="font-mono font-black text-base">{(liveVipCustomer.vipBalance || 0).toLocaleString()} {cur}</span>.
                        عند تأكيد التسوية، يدفع العميل المبلغ كاش ويُضاف فوراً لدرج الوردية المفتوحة وتُسجل أرباحه بالوردية.
                      </p>
                    ) : (liveVipCustomer.vipBalance || 0) < 0 ? (
                      <p className="text-sm font-semibold text-emerald-700 mt-1">
                        المحل مدين للعميل بمبلغ{' '}
                        <span className="font-mono font-black text-base">{Math.abs(liveVipCustomer.vipBalance || 0).toLocaleString()} {cur}</span>.
                        عند تأكيد التسوية، يصرف الكاشير المبلغ كاش للعميل من درج الوردية المفتوحة وتُسجل أرباحه بالوردية.
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-slate-600 mt-1">
                        حساب العميل خالص ومتزن تماماً (0 {cur}). لا توجد مبالغ لتسويتها حالياً.
                      </p>
                    )}
                  </div>

                  <form onSubmit={handleSettleVipAccount} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">مبلغ التسوية المطلوب تقفيله *</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={vipSettleAmount}
                            onChange={(e) => setVipSettleAmount(e.target.value)}
                            placeholder="0"
                            max={Math.abs(liveVipCustomer.vipBalance || 0)}
                            className="w-full rounded-xl border border-emerald-300 bg-white p-3 text-center text-lg font-mono font-black focus:border-emerald-500 focus:outline-none"
                            required
                          />
                          <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">{cur}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات التسوية (اختياري)</label>
                        <input
                          type="text"
                          value={vipSettleNotes}
                          onChange={(e) => setVipSettleNotes(e.target.value)}
                          placeholder="مثال: تصفية حساب اليوم كاش بالكامل..."
                          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setVipSettleAmount(Math.abs(liveVipCustomer.vipBalance || 0).toString())}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        تسوية الرصيد بالكامل (100%)
                      </button>
                      <button
                        type="submit"
                        disabled={!liveVipCustomer.vipBalance || liveVipCustomer.vipBalance === 0}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        تأكيد التسوية وربطها بالدرج والأرباح
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Transactions History Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-amber-600" />
                    <span>سجل وأجندة حركات العميل المميز ({vipTransactions.length})</span>
                  </h4>
                </div>

                {vipTransactions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                    لا توجد حركات كاش مسجلة لهذا العميل بعد.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">التاريخ والوقت</th>
                          <th className="py-2.5 px-3">نوع الحركة</th>
                          <th className="py-2.5 px-3">المبلغ</th>
                          <th className="py-2.5 px-3">العمولة</th>
                          <th className="py-2.5 px-3">المحفظة</th>
                          <th className="py-2.5 px-3">الرصيد (قبل ➔ بعد)</th>
                          <th className="py-2.5 px-3">البيان وملاحظات</th>
                          <th className="py-2.5 px-3">المسؤول</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {vipTransactions.map((tx) => {
                          const isTransfer = tx.type === 'vip_cash_transfer';
                          const isReceive = tx.type === 'vip_cash_receive';
                          const isSettle = tx.type === 'vip_cash_settlement';
                          const dateStr = new Date(tx.createdAt).toLocaleString('ar-EG', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          });
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50 transition">
                              <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">{dateStr}</td>
                              <td className="py-3 px-3">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] ${
                                  isTransfer
                                    ? 'bg-rose-100 text-rose-800'
                                    : isReceive
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isSettle
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-slate-100 text-slate-800'
                                }`}>
                                  {isTransfer && <ArrowUpRight className="h-3 w-3" />}
                                  {isReceive && <ArrowDownLeft className="h-3 w-3" />}
                                  {isSettle && <DollarSign className="h-3 w-3" />}
                                  {isTransfer
                                    ? 'تحويل كاش (إرسال)'
                                    : isReceive
                                    ? 'استلام كاش (استقبال)'
                                    : isSettle
                                    ? 'تسوية مع الدرج'
                                    : tx.type === 'payment'
                                    ? 'سداد دفعة'
                                    : 'زيادة دين'}
                                </span>
                              </td>
                              <td className={`py-3 px-3 font-mono font-black text-sm ${
                                isTransfer ? 'text-rose-600' : isReceive ? 'text-emerald-600' : 'text-purple-600'
                              }`}>
                                {tx.amount.toLocaleString()} {cur}
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-amber-700">
                                {tx.commission ? `+${tx.commission.toLocaleString()} ${cur}` : '—'}
                              </td>
                              <td className="py-3 px-3 text-slate-600 font-medium">
                                {tx.walletName || '—'}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                                {tx.balanceBefore.toLocaleString()} ➔ {tx.balanceAfter.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-slate-700 font-medium max-w-xs truncate" title={tx.notes}>
                                {tx.notes || '—'}
                              </td>
                              <td className="py-3 px-3 text-slate-400 font-semibold">{tx.recordedBy}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setVipCustomer(null)}
                className="px-6 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
