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
} from 'lucide-react';
import { db } from '../db';
import { useModal } from '../context/ModalContext';
import type { Customer, Supplier } from '../types';

export const AccountsView: React.FC = () => {
  const { showAlert, showConfirm, showToast } = useModal();
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [notes, setNotes] = useState('');

  // Edit Modal
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Pay Debt Modal
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const cur = settings?.currency || 'ج.م';

  const resetForm = () => {
    setName('');
    setCompany('');
    setPhone('');
    setInitialBalance('');
    setNotes('');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      showAlert('الاسم ورقم الهاتف حقول مطلوبة.', 'بيانات ناقصة', 'warning');
      return;
    }

    if (activeTab === 'customers') {
      const newCustomer: Customer = {
        id: `cust_${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        totalDebt: parseFloat(initialBalance) || 0,
        totalPaid: 0,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      await db.customers.add(newCustomer);
    } else {
      const newSupplier: Supplier = {
        id: `sup_${Date.now()}`,
        name: name.trim(),
        company: company.trim() || undefined,
        phone: phone.trim(),
        totalOwed: parseFloat(initialBalance) || 0,
        totalPaid: 0,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      await db.suppliers.add(newSupplier);
    }
    setShowAddModal(false);
    resetForm();
  };

  const handlePayCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    await db.customers.update(payingCustomer.id, {
      totalPaid: (payingCustomer.totalPaid || 0) + amt,
      totalDebt: Math.max(0, (payingCustomer.totalDebt || 0) - amt),
    });
    setPayingCustomer(null);
    setPayAmount('');
  };

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    await db.suppliers.update(payingSupplier.id, {
      totalPaid: (payingSupplier.totalPaid || 0) + amt,
      totalOwed: Math.max(0, (payingSupplier.totalOwed || 0) - amt),
    });
    setPayingSupplier(null);
    setPayAmount('');
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
                    <p className="font-black text-slate-900 text-sm">{customer.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{customer.phone}</p>
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

                  <div className="flex flex-col gap-1.5 shrink-0">
                    {debt > 0 && (
                      <button
                        onClick={() => { setPayingCustomer(customer); setPayAmount(''); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        تسديد
                      </button>
                    )}
                    <button
                      onClick={() => setEditingCustomer({ ...customer })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[11px] font-bold hover:bg-blue-100 transition cursor-pointer"
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
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-[11px] font-bold hover:bg-red-100 transition cursor-pointer"
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

                  <div className="flex flex-col gap-1.5 shrink-0">
                    {owed > 0 && (
                      <button
                        onClick={() => { setPayingSupplier(supplier); setPayAmount(''); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        دفع
                      </button>
                    )}
                    <button
                      onClick={() => setEditingSupplier({ ...supplier })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[11px] font-bold hover:bg-blue-100 transition cursor-pointer"
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
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-[11px] font-bold hover:bg-red-100 transition cursor-pointer"
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
                  notes: editingCustomer.notes,
                });
                setEditingCustomer(null);
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
    </div>
  );
};
