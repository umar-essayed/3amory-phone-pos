import React, { useState } from 'react';
import {
  Package,
  Smartphone,
  Search,
  AlertTriangle,
  CheckCircle,
  Tag,
  Boxes,
  Zap,
} from 'lucide-react';
import type { Phone, Accessory } from '../../types';

interface MobileInventoryViewProps {
  phones: Phone[];
  accessories: Accessory[];
}

export function MobileInventoryView({ phones, accessories }: MobileInventoryViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'low_stock' | 'phones' | 'accessories'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const formatEgp = (amount: number) => {
    return (amount || 0).toLocaleString('ar-EG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  };

  const availablePhones = phones.filter((p) => p.status === 'available');
  const lowStockAccessories = accessories.filter((a) => {
    const minAlert = a.minStockAlert || 5;
    return (a.stockQuantity || 0) <= minAlert;
  });

  // Filter items based on activeTab and searchQuery
  const q = searchQuery.toLowerCase().trim();

  const filteredPhones = phones.filter((p) => {
    if (activeTab === 'accessories' || activeTab === 'low_stock') return false;
    if (!q) return true;
    return (
      p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.model?.toLowerCase().includes(q) ||
      p.imei1?.includes(q) ||
      p.color?.toLowerCase().includes(q)
    );
  });

  const filteredAccessories = accessories.filter((a) => {
    if (activeTab === 'phones') return false;
    if (activeTab === 'low_stock') {
      const minAlert = a.minStockAlert || 5;
      if ((a.stockQuantity || 0) > minAlert) return false;
    }
    if (!q) return true;
    return (
      a.name?.toLowerCase().includes(q) ||
      a.category?.toLowerCase().includes(q) ||
      a.barcode?.includes(q)
    );
  });

  return (
    <div className="space-y-4 pb-24 text-slate-100" dir="rtl">
      {/* ── Summary Counters ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center shadow-md">
          <Smartphone className="w-4 h-4 text-blue-400 mx-auto mb-1" />
          <span className="text-[10px] text-slate-400 block font-medium">الهواتف المتاحة</span>
          <span className="text-base font-black text-white font-mono mt-0.5 block">
            {availablePhones.length}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center shadow-md">
          <Boxes className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
          <span className="text-[10px] text-slate-400 block font-medium">أصناف الإكسسوار</span>
          <span className="text-base font-black text-white font-mono mt-0.5 block">
            {accessories.length}
          </span>
        </div>

        <div
          onClick={() => setActiveTab('low_stock')}
          className={`p-3 rounded-2xl border text-center shadow-md cursor-pointer transition-all active:scale-95 ${
            lowStockAccessories.length > 0
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-400 mx-auto mb-1" />
          <span className="text-[10px] block font-medium">النواقص الحرجة</span>
          <span className="text-base font-black font-mono mt-0.5 block text-rose-400">
            {lowStockAccessories.length}
          </span>
        </div>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────── */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
        <input
          type="text"
          placeholder="ابحث باسم المنتج، الموديل، السيريال أو IMEI..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pr-10 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 shadow-md"
        />
      </div>

      {/* ── Category Filter Tabs ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          الكل
        </button>

        <button
          onClick={() => setActiveTab('low_stock')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeTab === 'low_stock'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'bg-slate-900 text-rose-400 border border-slate-800'
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>النواقص ({lowStockAccessories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('phones')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeTab === 'phones'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          <Smartphone className="w-3 h-3" />
          <span>الهواتف ({phones.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('accessories')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeTab === 'accessories'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          <Package className="w-3 h-3" />
          <span>الإكسسوارات ({accessories.length})</span>
        </button>
      </div>

      {/* ── Products List ───────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Phones Section */}
        {filteredPhones.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 px-1 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              <span>الهواتف الذكية ({filteredPhones.length})</span>
            </h4>

            {filteredPhones.map((phone) => (
              <div
                key={phone.id}
                className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 shadow-md flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-black text-white truncate">
                      {phone.brand} {phone.model || phone.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                        phone.condition === 'new'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {phone.condition === 'new' ? 'جديد' : 'مستعمل'}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                        phone.status === 'available'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {phone.status === 'available' ? 'متاح' : 'تم البيع'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                    {phone.storage && <span>{phone.storage}</span>}
                    {phone.color && <span>• {phone.color}</span>}
                    {phone.batteryHealth && <span>• بطارية {phone.batteryHealth}%</span>}
                  </div>

                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                    IMEI: {phone.imei1}
                  </div>
                </div>

                <div className="text-left font-mono shrink-0 mr-3">
                  <div className="text-sm font-black text-emerald-400">
                    {formatEgp(phone.sellPrice)} <span className="text-[10px] font-sans">ج.م</span>
                  </div>
                  {phone.minSellPrice && (
                    <div className="text-[10px] text-slate-400">
                      أدنى: {formatEgp(phone.minSellPrice)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Accessories Section */}
        {filteredAccessories.length > 0 && (
          <div className="space-y-2 mt-4">
            <h4 className="text-xs font-bold text-slate-400 px-1 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-indigo-400" />
              <span>الإكسسوارات والقطع ({filteredAccessories.length})</span>
            </h4>

            {filteredAccessories.map((acc) => {
              const minAlert = acc.minStockAlert || 5;
              const isLow = (acc.stockQuantity || 0) <= minAlert;

              return (
                <div
                  key={acc.id}
                  className={`rounded-2xl bg-slate-900/90 border p-3.5 shadow-md flex items-center justify-between ${
                    isLow ? 'border-rose-500/40 bg-rose-950/10' : 'border-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-black text-white truncate">{acc.name}</span>
                      {acc.category && (
                        <span className="text-[9px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-md">
                          {acc.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      {acc.barcode && (
                        <span className="font-mono text-slate-500">{acc.barcode}</span>
                      )}
                      {acc.hasVariants && acc.variants && (
                        <span className="text-indigo-400 font-bold">
                          {acc.variants.length} خيارات/ألوان
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-left shrink-0 mr-3 font-mono">
                    <div className="text-sm font-black text-white">
                      {formatEgp(acc.sellPriceRetail)} <span className="text-[10px] font-sans">ج.م</span>
                    </div>
                    <div
                      className={`text-[10px] font-bold mt-0.5 ${
                        isLow ? 'text-rose-400 flex items-center gap-1 justify-end' : 'text-slate-400'
                      }`}
                    >
                      {isLow && <AlertTriangle className="w-3 h-3 text-rose-400 inline" />}
                      <span>المتاح: {acc.stockQuantity || 0} قطعة</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredPhones.length === 0 && filteredAccessories.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs font-semibold">
            لا توجد أصناف مطابقة لبحثك
          </div>
        )}
      </div>
    </div>
  );
}
