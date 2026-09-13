import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import JsBarcode from 'jsbarcode';
import {
  Package,
  Plus,
  Search,
  Barcode,
  Printer,
  AlertTriangle,
  Tag,
  Edit2,
  Trash2,
  Layers,
  X,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { db } from '../db';
import type { Accessory } from '../types';

const CATEGORIES = ['جرابات', 'سكرينات', 'شواحن', 'كابلات', 'سماعات', 'ساعات ذكية', 'باور بنك', 'قطع غيار', 'إكسسوارات', 'أخرى'];

const EMPTY_FORM = {
  name: '',
  category: 'جرابات',
  barcode: '',
  costPrice: '',
  sellPriceRetail: '',
  sellPriceWholesale: '',
  stockQuantity: '',
  minStockAlert: '5',
  location: '',
};

export const AccessoriesView: React.FC = () => {
  const accessories = useLiveQuery(() => db.accessories.orderBy('createdAt').reverse().toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Accessory | null>(null);
  const [barcodeModalItem, setBarcodeModalItem] = useState<Accessory | null>(null);
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const [saved, setSaved] = useState(false);

  // Add Form State
  const [form, setForm] = useState(EMPTY_FORM);

  const generateRandomBarcode = () => {
    const random = Math.floor(100000000000 + Math.random() * 900000000000);
    setForm((f) => ({ ...f, barcode: random.toString() }));
  };

  const handleAddAccessory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.sellPriceRetail || !form.stockQuantity) {
      alert('يرجى ملء الحقول الأساسية: الاسم، سعر القطاعي، والكمية.');
      return;
    }

    const finalBarcode = form.barcode.trim() || Math.floor(100000000000 + Math.random() * 900000000000).toString();

    const existing = await db.accessories.where('barcode').equals(finalBarcode).first();
    if (existing) {
      alert('تنبيه: هذا الباركود مسجل مسبقاً لصنف آخر!');
      return;
    }

    const newAcc: Accessory = {
      id: `acc_${Date.now()}`,
      name: form.name.trim(),
      category: form.category,
      barcode: finalBarcode,
      costPrice: parseFloat(form.costPrice) || 0,
      sellPriceRetail: parseFloat(form.sellPriceRetail),
      sellPriceWholesale: parseFloat(form.sellPriceWholesale) || parseFloat(form.sellPriceRetail),
      stockQuantity: parseInt(form.stockQuantity) || 0,
      minStockAlert: parseInt(form.minStockAlert) || 5,
      location: form.location.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    await db.accessories.add(newAcc);
    setShowAddModal(false);
    setForm(EMPTY_FORM);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAcc) return;
    await db.accessories.update(editingAcc.id, {
      name: editingAcc.name,
      category: editingAcc.category,
      costPrice: Number(editingAcc.costPrice),
      sellPriceRetail: Number(editingAcc.sellPriceRetail),
      sellPriceWholesale: Number(editingAcc.sellPriceWholesale),
      stockQuantity: Number(editingAcc.stockQuantity),
      minStockAlert: Number(editingAcc.minStockAlert),
      location: editingAcc.location,
    });
    setEditingAcc(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  useEffect(() => {
    if (barcodeModalItem && barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, barcodeModalItem.barcode, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          font: 'monospace',
        });
      } catch (err) {
        console.error('Barcode render error:', err);
      }
    }
  }, [barcodeModalItem]);

  const filteredAccessories = accessories.filter((acc) => {
    const matchesSearch =
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.barcode.includes(searchQuery) ||
      acc.category.includes(searchQuery);
    const matchesCat = selectedCategory === 'all' || acc.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const lowStockItems = accessories.filter((a) => a.stockQuantity <= a.minStockAlert);
  const totalStockItems = accessories.reduce((acc, a) => acc + a.stockQuantity, 0);
  const totalStockValue = accessories.reduce((acc, a) => acc + a.stockQuantity * a.sellPriceRetail, 0);
  const cur = settings?.currency || 'ج.م';

  // ─── MODAL: Add / Edit shared form fields ───────────────────────────────
  const ModalFields = ({
    v,
    setV,
    isEdit = false,
  }: {
    v: typeof EMPTY_FORM | Accessory;
    setV: any;
    isEdit?: boolean;
  }) => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الصنف بالكامل *</label>
        <input
          type="text"
          value={v.name}
          onChange={(e) => setV((p: any) => ({ ...p, name: e.target.value }))}
          placeholder="مثال: شاحن أنكر 20W فاست شارج..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold focus:border-blue-500 focus:bg-white focus:outline-none transition"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">التصنيف</label>
          <select
            value={v.category}
            onChange={(e) => setV((p: any) => ({ ...p, category: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold focus:border-blue-500 focus:outline-none"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {!isEdit && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">الباركود</label>
              <button
                type="button"
                onClick={generateRandomBarcode}
                className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                توليد تلقائي
              </button>
            </div>
            <input
              type="text"
              value={(v as any).barcode || ''}
              onChange={(e) => setV((p: any) => ({ ...p, barcode: e.target.value }))}
              placeholder="امسح أو اكتب الباركود"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Prices */}
      <div className="grid grid-cols-3 gap-3 bg-gradient-to-br from-blue-50 to-indigo-50/40 p-4 rounded-2xl border border-blue-100">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1.5">سعر التكلفة</label>
          <input
            type="number"
            value={v.costPrice as any}
            onChange={(e) => setV((p: any) => ({ ...p, costPrice: e.target.value }))}
            placeholder="0"
            className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none bg-white"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-blue-800 mb-1.5">سعر القطاعي *</label>
          <input
            type="number"
            value={v.sellPriceRetail as any}
            onChange={(e) => setV((p: any) => ({ ...p, sellPriceRetail: e.target.value }))}
            placeholder="0"
            className="w-full rounded-xl border-2 border-blue-400 p-2.5 text-sm font-black font-mono focus:border-blue-600 focus:outline-none bg-white"
            required
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1.5">سعر الجملة</label>
          <input
            type="number"
            value={v.sellPriceWholesale as any}
            onChange={(e) => setV((p: any) => ({ ...p, sellPriceWholesale: e.target.value }))}
            placeholder="0"
            className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">الكمية بالمخزن *</label>
          <input
            type="number"
            value={v.stockQuantity as any}
            onChange={(e) => setV((p: any) => ({ ...p, stockQuantity: e.target.value }))}
            placeholder="0"
            className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none bg-slate-50"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">حد التنبيه</label>
          <input
            type="number"
            value={v.minStockAlert as any}
            onChange={(e) => setV((p: any) => ({ ...p, minStockAlert: e.target.value }))}
            placeholder="5"
            className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none bg-slate-50"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">مكان التخزين</label>
          <input
            type="text"
            value={v.location || ''}
            onChange={(e) => setV((p: any) => ({ ...p, location: e.target.value }))}
            placeholder="رف A3"
            className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-slate-50"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-12">
      {/* Success Banner */}
      {saved && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500 text-white px-5 py-3.5 font-bold shadow-lg animate-bounce">
          <CheckCircle2 className="h-5 w-5" />
          <span>تم الحفظ بنجاح!</span>
        </div>
      )}

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">إجمالي الأصناف</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{accessories.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Layers className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">إجمالي القطع</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{totalStockItems.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
            <TrendingUp className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">قيمة المخزون</p>
            <p className="text-lg font-black text-slate-900 font-mono">{totalStockValue.toLocaleString()} {cur}</p>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-5 shadow-xs flex items-center gap-4 cursor-pointer transition ${
            lowStockItems.length > 0
              ? 'bg-red-50 border-red-200 animate-pulse'
              : 'bg-white border-slate-100'
          }`}
        >
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
            lowStockItems.length > 0 ? 'bg-red-100' : 'bg-slate-50'
          }`}>
            <AlertTriangle className={`h-6 w-6 ${lowStockItems.length > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">تنبيهات النواقص</p>
            <p className={`text-2xl font-black font-mono ${lowStockItems.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {lowStockItems.length}
            </p>
          </div>
        </div>
      </div>

      {/* Low Stock Alert Bar */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-red-800 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            أصناف وصلت حد الطلب وتحتاج إعادة توريد:
          </p>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((a) => (
              <span key={a.id} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-[11px] font-bold border border-red-200">
                {a.name} — متبقي: {a.stockQuantity}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الباركود أو التصنيف..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-4 text-sm font-semibold focus:border-blue-500 focus:bg-white focus:outline-none transition"
          />
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 md:pb-0 w-full md:w-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              selectedCategory === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                selectedCategory === c ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <button
          onClick={() => { setForm(EMPTY_FORM); setShowAddModal(true); }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs px-5 py-2.5 shadow-md transition shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>إضافة صنف</span>
        </button>
      </div>

      {/* Accessories Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
              <tr>
                <th className="p-4">الصنف</th>
                <th className="p-4">الباركود</th>
                <th className="p-4">الفئة</th>
                <th className="p-4 text-left">تكلفة</th>
                <th className="p-4 text-left">قطاعي</th>
                <th className="p-4 text-left">جملة</th>
                <th className="p-4 text-center">الكمية</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAccessories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    لا توجد أصناف مطابقة.
                  </td>
                </tr>
              ) : (
                filteredAccessories.map((acc) => {
                  const isLow = acc.stockQuantity <= acc.minStockAlert;
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/60 transition group">
                      <td className="p-4">
                        <p className="font-bold text-slate-900 group-hover:text-blue-700 transition">{acc.name}</p>
                        {acc.location && <p className="text-[10px] text-slate-400 mt-0.5">📍 {acc.location}</p>}
                      </td>
                      <td className="p-4 font-mono text-slate-600 text-[11px]">{acc.barcode}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-[11px] border border-indigo-100">
                          {acc.category}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-400 text-left">{acc.costPrice.toLocaleString()}</td>
                      <td className="p-4 font-mono font-black text-blue-700 text-sm text-left">
                        {acc.sellPriceRetail.toLocaleString()} {cur}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700 text-left">
                        {acc.sellPriceWholesale.toLocaleString()} {cur}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full font-mono font-black text-xs transition ${
                          isLow
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {acc.stockQuantity}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5 opacity-60 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => setBarcodeModalItem(acc)}
                            title="طباعة ستيكر باركود"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition cursor-pointer"
                          >
                            <Barcode className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAcc({ ...acc })}
                            title="تعديل"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`حذف الصنف (${acc.name})؟`)) {
                                await db.accessories.delete(acc.id);
                              }
                            }}
                            title="حذف"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-400 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Add New Accessory */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white">إضافة صنف إكسسوار جديد</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddAccessory} className="p-6 space-y-5">
              <ModalFields v={form} setV={setForm} isEdit={false} />
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-6 py-2.5 text-sm font-bold shadow-md transition cursor-pointer"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Accessory */}
      {editingAcc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Edit2 className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-display text-lg font-bold text-white">تعديل الصنف</h3>
              </div>
              <button
                onClick={() => setEditingAcc(null)}
                className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="p-6 space-y-5">
              <ModalFields v={editingAcc} setV={setEditingAcc} isEdit={true} />
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAcc(null)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-6 py-2.5 text-sm font-bold shadow-md transition cursor-pointer"
                >
                  تحديث وحفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Barcode Label Preview & Print */}
      {barcodeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4">
              <div className="flex items-center gap-2">
                <Barcode className="h-5 w-5 text-blue-400" />
                <h3 className="font-display font-bold text-white text-sm">ستيكر باركود الصنف</h3>
              </div>
              <button onClick={() => setBarcodeModalItem(null)} className="text-white/60 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-white flex flex-col items-center text-center">
                <p className="text-sm font-black text-slate-900">{settings?.storeName || 'المحل'}</p>
                <p className="text-xs font-bold text-slate-700 mt-1 max-w-[200px] line-clamp-2">{barcodeModalItem.name}</p>
                <div className="my-3">
                  <svg ref={barcodeSvgRef} className="max-w-full" />
                </div>
                <p className="text-lg font-black text-blue-700 font-mono">
                  {barcodeModalItem.sellPriceRetail.toLocaleString()} {cur}
                </p>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white text-xs font-bold py-2.5 hover:bg-slate-800 transition cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>طباعة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBarcodeModalItem(null)}
                  className="flex-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 py-2.5 hover:bg-slate-50 transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
