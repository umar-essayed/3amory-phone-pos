import React, { useState } from 'react';
import {
  Users,
  Building2,
  Crown,
  Search,
  Phone,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import type { Customer, Supplier } from '../../types';

interface MobileDebtsViewProps {
  customers: Customer[];
  suppliers: Supplier[];
}

export function MobileDebtsView({ customers, suppliers }: MobileDebtsViewProps) {
  const [activeTab, setActiveTab] = useState<'vip' | 'customers' | 'suppliers'>('vip');
  const [searchQuery, setSearchQuery] = useState('');

  const formatEgp = (amount: number) => {
    return (amount || 0).toLocaleString('ar-EG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  };

  const vipCustomers = customers.filter((c) => c.isVipCash);
  const regularDebtors = customers.filter((c) => (c.totalDebt || 0) > 0 && !c.isVipCash);
  const suppliersWithDues = suppliers.filter(
    (s) => (s.totalBalanceDue || s.totalOwed || 0) > 0
  );

  const totalVipUnsettled = vipCustomers.reduce((sum, c) => sum + (c.vipUnsettledProfit || 0), 0);
  const totalCustomerDebts = customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
  const totalSupplierDues = suppliers.reduce(
    (sum, s) => sum + (s.totalBalanceDue || s.totalOwed || 0),
    0
  );

  const q = searchQuery.toLowerCase().trim();

  const filteredVip = vipCustomers.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
  );

  const filteredCustomers = regularDebtors.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
  );

  const filteredSuppliers = suppliers.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))
  );

  return (
    <div className="space-y-4 pb-36 text-slate-100" dir="rtl">
      {/* ── Tabs Switcher ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 p-1 bg-slate-900 rounded-2xl border border-slate-800 shadow-md">
        <button
          onClick={() => setActiveTab('vip')}
          className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeTab === 'vip'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>عملاء VIP ({vipCustomers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeTab === 'customers'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>ديون العملاء ({regularDebtors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeTab === 'suppliers'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>الموردين ({suppliers.length})</span>
        </button>
      </div>

      {/* ── Summary Card ─────────────────────────────────────────── */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
        {activeTab === 'vip' ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-300 block mb-0.5">
                أرباح معلقة من عملاء كاش VIP
              </span>
              <span className="text-[11px] text-slate-400">تسمع في الدرج عند تسوية الحساب</span>
            </div>
            <div className="text-xl font-black text-amber-400 font-mono">
              +{formatEgp(totalVipUnsettled)} <span className="text-xs font-sans">ج.م</span>
            </div>
          </div>
        ) : activeTab === 'customers' ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-rose-300 block mb-0.5">
                إجمالي ديون العملاء (الآجل)
              </span>
              <span className="text-[11px] text-slate-400">مستحقات للمحل لدى العملاء</span>
            </div>
            <div className="text-xl font-black text-rose-400 font-mono">
              {formatEgp(totalCustomerDebts)} <span className="text-xs font-sans">ج.م</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-indigo-300 block mb-0.5">
                إجمالي مستحقات الموردين
              </span>
              <span className="text-[11px] text-slate-400">ديون والتزامات للمحل تجاه الموردين</span>
            </div>
            <div className="text-xl font-black text-indigo-400 font-mono">
              {formatEgp(totalSupplierDues)} <span className="text-xs font-sans">ج.م</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Search Bar ──────────────────────────────────────────── */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
        <input
          type="text"
          placeholder="ابحث بالاسم أو رقم الهاتف..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pr-10 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 shadow-md"
        />
      </div>

      {/* ── Content Lists ────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {/* VIP Tab */}
        {activeTab === 'vip' && (
          filteredVip.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-semibold">
              لا يوجد عملاء كاش مميزين مسجلين
            </div>
          ) : (
            filteredVip.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/30 shadow-md space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black text-white">{c.name}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">{c.phone || 'بدون هاتف'}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                  <div className="bg-slate-950/60 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">رصيد الحساب الجاري:</span>
                    <span
                      className={`font-mono font-bold ${
                        (c.vipBalance || 0) > 0
                          ? 'text-rose-400'
                          : (c.vipBalance || 0) < 0
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {(c.vipBalance || 0) > 0
                        ? `عليه ${formatEgp(c.vipBalance || 0)} ج.م`
                        : (c.vipBalance || 0) < 0
                        ? `له ${formatEgp(Math.abs(c.vipBalance || 0))} ج.م`
                        : 'خالص (0 ج.م)'}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">أرباح المحل منه اليوم:</span>
                    <span className="font-mono font-bold text-amber-400">
                      +{formatEgp(c.vipUnsettledProfit || 0)} ج.م
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                  <span>إجمالي التحويلات: {formatEgp(c.vipTotalSent || 0)} ج.م</span>
                  <span>إجمالي الاستلام: {formatEgp(c.vipTotalReceived || 0)} ج.م</span>
                </div>
              </div>
            ))
          )
        )}

        {/* Regular Debtors Tab */}
        {activeTab === 'customers' && (
          filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-semibold">
              لا توجد ديون مسجلة على العملاء
            </div>
          ) : (
            filteredCustomers.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">{c.name}</h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{c.phone || 'بدون هاتف'}</span>
                  </div>
                </div>

                <div className="text-left font-mono">
                  <span className="text-sm font-black text-rose-400">
                    {formatEgp(c.totalDebt)} <span className="text-[10px] font-sans">ج.م</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block">مستحق للمحل</span>
                </div>
              </div>
            ))
          )
        )}

        {/* Suppliers Tab */}
        {activeTab === 'suppliers' && (
          filteredSuppliers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-semibold">
              لا يوجد موردين مسجلين
            </div>
          ) : (
            filteredSuppliers.map((s) => {
              const due = s.totalBalanceDue !== undefined ? s.totalBalanceDue : s.totalOwed || 0;

              return (
                <div
                  key={s.id}
                  className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">
                      {s.name} {s.companyName ? `(${s.companyName})` : ''}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{s.phone || 'بدون هاتف'}</span>
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-sm font-black text-indigo-400">
                      {formatEgp(due)} <span className="text-[10px] font-sans">ج.م</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block">مستحق للمورد</span>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
