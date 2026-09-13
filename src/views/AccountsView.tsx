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
} from 'lucide-react';
import { db } from '../db';
import type { Customer, Supplier, StoreSettings } from '../types';

export const AccountsView: React.FC = () => {
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      alert('يرجى كتابة الاسم ورقم الهاتف.');
      return;
    }

    const numBal = parseFloat(initialBalance) || 0;

    if (activeTab === 'customers') {
      await db.customers.add({
        id: `cust_${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        totalDebt: numBal,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
    } else {
      await db.suppliers.add({
        id: `supp_${Date.now()}`,
        name: name.trim(),
        companyName: company.trim() || undefined,
        phone: phone.trim(),
        totalBalanceDue: numBal,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
    }

    setShowModal(false);
    setName('');
    setCompany('');
    setPhone('');
    setInitialBalance('');
    setNotes('');
  };

  const filteredCustomers = customers.filter(
    (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)
  );

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.companyName && s.companyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.phone.includes(searchQuery)
  );

  const totalCustomerDebt = customers.reduce((acc, c) => acc + c.totalDebt, 0);
  const totalSupplierDue = suppliers.reduce((acc, s) => acc + s.totalBalanceDue, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">إجمالي ديون العملاء (لنا في السوق)</p>
            <h3 className="text-2xl font-black text-blue-700 mt-1 font-mono">
              {totalCustomerDebt.toLocaleString()} {settings?.currency || 'ج.م'}
            </h3>
            <span className="text-[10px] text-slate-400">على {customers.length} عميل مسجل</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">مستحقات الموردين (علينا للبضاعة)</p>
            <h3 className="text-2xl font-black text-red-600 mt-1 font-mono">
              {totalSupplierDue.toLocaleString()} {settings?.currency || 'ج.م'}
            </h3>
            <span className="text-[10px] text-slate-400">لـ {suppliers.length} مورد بضاعة وأجهزة</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <Truck className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Tabs & Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex rounded-xl bg-slate-100 p-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex-1 sm:flex-initial px-5 py-2 text-xs font-black rounded-lg transition ${
              activeTab === 'customers' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            حسابات وديون العملاء ({customers.length})
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex-1 sm:flex-initial px-5 py-2 text-xs font-black rounded-lg transition ${
              activeTab === 'suppliers' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            حسابات ومستحقات الموردين ({suppliers.length})
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو الهاتف..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-9 pl-3 text-xs font-semibold focus:border-blue-600 focus:bg-white focus:outline-none"
            />
            <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 shadow-xs transition shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{activeTab === 'customers' ? 'إضافة عميل' : 'إضافة مورد'}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
            <tr>
              <th className="p-4">الاسم</th>
              {activeTab === 'suppliers' && <th className="p-4">الشركة / النشاط</th>}
              <th className="p-4">رقم الهاتف</th>
              <th className="p-4">{activeTab === 'customers' ? 'المديونية الحالية' : 'المستحق له'}</th>
              <th className="p-4">ملاحظات</th>
              <th className="p-4 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeTab === 'customers' ? (
              filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    لا يوجد عملاء مسجلين.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-900">{c.name}</td>
                    <td className="p-4 font-mono text-slate-600">{c.phone}</td>
                    <td className="p-4 font-mono font-black text-sm text-blue-700">
                      {c.totalDebt.toLocaleString()} {settings?.currency || 'ج'}
                    </td>
                    <td className="p-4 text-slate-500">{c.notes || '-'}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={async () => {
                            const p = prompt('أدخل قيمة الدفعة المسددة من العميل (ج.م):');
                            if (p && !isNaN(parseFloat(p))) {
                              await db.customers.update(c.id, {
                                totalDebt: Math.max(0, c.totalDebt - parseFloat(p)),
                              });
                            }
                          }}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-[11px] hover:bg-emerald-100 cursor-pointer"
                        >
                          تسديد دفعة
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`حذف العميل (${c.name})؟`)) {
                              await db.customers.delete(c.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )
            ) : filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  لا يوجد موردين مسجلين.
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-4 font-bold text-slate-900">{s.name}</td>
                  <td className="p-4 font-semibold text-slate-700">{s.companyName || '-'}</td>
                  <td className="p-4 font-mono text-slate-600">{s.phone}</td>
                  <td className="p-4 font-mono font-black text-sm text-red-600">
                    {s.totalBalanceDue.toLocaleString()} {settings?.currency || 'ج'}
                  </td>
                  <td className="p-4 text-slate-500">{s.notes || '-'}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={async () => {
                          const p = prompt('أدخل قيمة الدفعة المسددة للمورد (ج.م):');
                          if (p && !isNaN(parseFloat(p))) {
                            await db.suppliers.update(s.id, {
                              totalBalanceDue: Math.max(0, s.totalBalanceDue - parseFloat(p)),
                            });
                          }
                        }}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold text-[11px] hover:bg-blue-100 cursor-pointer"
                      >
                        سداد دفعة
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`حذف المورد (${s.name})؟`)) {
                            await db.suppliers.delete(s.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Add Customer / Supplier */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span>{activeTab === 'customers' ? 'إضافة حساب عميل جديد' : 'إضافة حساب مورد بضاعة جديد'}</span>
            </h3>

            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: محمود الشامي"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              {activeTab === 'suppliers' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الشركة / المخزن</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="مثال: شركة النور لتوزيع الهواتف"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {activeTab === 'customers' ? 'المديونية الافتتاحية السابقة' : 'المستحق الافتتاحي له'}
                </label>
                <input
                  type="number"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات أو عنوان العميل..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold shadow"
                >
                  حفظ الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
