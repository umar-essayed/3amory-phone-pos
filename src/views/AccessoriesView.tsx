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
  Boxes,
  Palette,
  ArrowUpRight,
  Filter,
  Sparkles,
} from 'lucide-react';
import { db, seedSampleData } from '../db';
import { useModal } from '../context/ModalContext';
import type { Accessory, ProductVariant } from '../types';

const CATEGORIES = [
  'جرابات',
  'سكرينات',
  'شواحن',
  'كابلات',
  'سماعات',
  'ساعات ذكية',
  'باور بنك',
  'قطع غيار',
  'إكسسوارات',
  'أخرى',
];

interface FormState {
  name: string;
  category: string;
  barcode: string;
  costPrice: string;
  sellPriceRetail: string;
  sellPriceWholesale: string;
  stockQuantity: string;
  minStockAlert: string;
  location: string;
  hasVariants: boolean;
  variants: ProductVariant[];
}

const EMPTY_FORM: FormState = {
  name: '',
  category: 'جرابات',
  barcode: '',
  costPrice: '',
  sellPriceRetail: '',
  sellPriceWholesale: '',
  stockQuantity: '',
  minStockAlert: '5',
  location: '',
  hasVariants: false,
  variants: [],
};

export const AccessoriesView: React.FC = () => {
  const { showAlert, showConfirm, showToast } = useModal();
  const accessories = useLiveQuery(() => db.accessories.orderBy('createdAt').reverse().toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Add / Edit Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingAcc, setEditingAcc] = useState<Accessory | null>(null);

  // Quick Stock Replenishment Modal
  const [quickStockItem, setQuickStockItem] = useState<Accessory | null>(null);
  const [quickAddQty, setQuickAddQty] = useState('10');
  const [selectedVariantForQuickAdd, setSelectedVariantForQuickAdd] = useState<string>('all');

  // Variant helper state for active form
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantQty, setNewVariantQty] = useState('5');
  const [newVariantExtraPrice, setNewVariantExtraPrice] = useState('');

  // Barcode Preview Modal
  const [barcodeModalItem, setBarcodeModalItem] = useState<Accessory | null>(null);
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const [saved, setSaved] = useState(false);

  const generateRandomBarcode = () => {
    const random = Math.floor(100000000000 + Math.random() * 900000000000);
    setForm((f) => ({ ...f, barcode: random.toString() }));
  };

  // Add accessory handler
  const handleAddAccessory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.sellPriceRetail) {
      showAlert('يرجى ملء الحقول الأساسية: الاسم وسعر القطاعي.', 'بيانات ناقصة', 'warning');
      return;
    }

    // Compute stock from variants if variants exist
    let totalStock = parseInt(form.stockQuantity) || 0;
    if (form.hasVariants && form.variants.length > 0) {
      totalStock = form.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
    }

    const finalBarcode = form.barcode.trim() || Math.floor(100000000000 + Math.random() * 900000000000).toString();

    const existing = await db.accessories.where('barcode').equals(finalBarcode).first();
    if (existing) {
      showAlert('تنبيه: هذا الباركود مسجل مسبقاً لصنف آخر في المخزن!', 'باركود مكرر', 'error');
      return;
    }

    const wholesalePrice = parseFloat(form.sellPriceWholesale) || parseFloat(form.costPrice) || 0;

    const newAcc: Accessory = {
      id: `acc_${Date.now()}`,
      name: form.name.trim(),
      category: form.category,
      barcode: finalBarcode,
      costPrice: wholesalePrice,
      sellPriceRetail: parseFloat(form.sellPriceRetail),
      sellPriceWholesale: wholesalePrice,
      stockQuantity: totalStock,
      minStockAlert: parseInt(form.minStockAlert) || 5,
      location: form.location.trim() || undefined,
      hasVariants: form.hasVariants,
      variants: form.hasVariants ? form.variants : undefined,
      createdAt: new Date().toISOString(),
    };

    await db.accessories.add(newAcc);
    setShowAddModal(false);
    setForm(EMPTY_FORM);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    showToast(`تمت إضافة الصنف "${newAcc.name}" بنجاح!`);
  };

  // Edit accessory handler
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAcc) return;

    let totalStock = Number(editingAcc.stockQuantity) || 0;
    if (editingAcc.hasVariants && editingAcc.variants && editingAcc.variants.length > 0) {
      totalStock = editingAcc.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
    }

    const wholesale = Number(editingAcc.sellPriceWholesale) || Number(editingAcc.costPrice) || 0;

    await db.accessories.update(editingAcc.id, {
      name: editingAcc.name.trim(),
      category: editingAcc.category,
      costPrice: wholesale,
      sellPriceRetail: Number(editingAcc.sellPriceRetail),
      sellPriceWholesale: wholesale,
      stockQuantity: totalStock,
      minStockAlert: Number(editingAcc.minStockAlert) || 5,
      location: editingAcc.location?.trim() || undefined,
      hasVariants: editingAcc.hasVariants,
      variants: editingAcc.hasVariants ? editingAcc.variants : undefined,
    });

    setEditingAcc(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    showToast(`تم تحديث الصنف بنجاح!`);
  };

  // Quick Stock Replenish handler
  const handleQuickAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickStockItem) return;

    const qtyToAdd = parseInt(quickAddQty);
    if (!qtyToAdd || qtyToAdd <= 0) {
      showAlert('يرجى كتابة عدد القطع المطلوب إضافتها.', 'الكمية غير صحيحة', 'warning');
      return;
    }

    let newTotal = quickStockItem.stockQuantity + qtyToAdd;
    let updatedVariants = quickStockItem.variants ? [...quickStockItem.variants] : undefined;

    if (quickStockItem.hasVariants && updatedVariants && updatedVariants.length > 0) {
      if (selectedVariantForQuickAdd !== 'all') {
        const vIndex = updatedVariants.findIndex((v) => v.id === selectedVariantForQuickAdd);
        if (vIndex > -1) {
          updatedVariants[vIndex] = {
            ...updatedVariants[vIndex],
            stockQuantity: updatedVariants[vIndex].stockQuantity + qtyToAdd,
          };
          newTotal = updatedVariants.reduce((sum, v) => sum + v.stockQuantity, 0);
        }
      } else {
        // Distribute evenly among variants or add to total
        const perVariant = Math.floor(qtyToAdd / updatedVariants.length);
        const remainder = qtyToAdd % updatedVariants.length;
        updatedVariants = updatedVariants.map((v, i) => ({
          ...v,
          stockQuantity: v.stockQuantity + perVariant + (i === 0 ? remainder : 0),
        }));
        newTotal = updatedVariants.reduce((sum, v) => sum + v.stockQuantity, 0);
      }
    }

    await db.accessories.update(quickStockItem.id, {
      stockQuantity: newTotal,
      variants: updatedVariants,
    });

    showToast(`⚡ تم تزويد المخزون بنجاح! الرصيد الجديد: ${newTotal} قطعة`);
    setQuickStockItem(null);
    setQuickAddQty('10');
    setSelectedVariantForQuickAdd('all');
  };

  // Barcode rendering effect
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

  // Filter accessories list
  const filteredAccessories = accessories.filter((acc) => {
    if (filterLowStockOnly && acc.stockQuantity > acc.minStockAlert) {
      return false;
    }
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

  // Add a variant to the active form
  const handleAddVariantToForm = (isEditing: boolean) => {
    if (!newVariantName.trim()) {
      showAlert('يرجى كتابة اسم المتغير (مثلاً: أسود، أبيض، Type-C...).', 'بيانات ناقصة', 'warning');
      return;
    }
    const qty = parseInt(newVariantQty) || 0;
    const extraPrice = parseFloat(newVariantExtraPrice) || 0;

    const newVariant: ProductVariant = {
      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: newVariantName.trim(),
      stockQuantity: qty,
      additionalPrice: extraPrice > 0 ? extraPrice : undefined,
    };

    if (isEditing && editingAcc) {
      const currentVars = editingAcc.variants || [];
      const updated = [...currentVars, newVariant];
      const newStock = updated.reduce((s, v) => s + v.stockQuantity, 0);
      setEditingAcc({
        ...editingAcc,
        hasVariants: true,
        variants: updated,
        stockQuantity: newStock,
      });
    } else {
      const updated = [...form.variants, newVariant];
      const newStock = updated.reduce((s, v) => s + v.stockQuantity, 0);
      setForm((f) => ({
        ...f,
        hasVariants: true,
        variants: updated,
        stockQuantity: newStock.toString(),
      }));
    }

    setNewVariantName('');
    setNewVariantQty('5');
    setNewVariantExtraPrice('');
  };

  const handleRemoveVariantFromForm = (variantId: string, isEditing: boolean) => {
    if (isEditing && editingAcc) {
      const updated = (editingAcc.variants || []).filter((v) => v.id !== variantId);
      const newStock = updated.reduce((s, v) => s + v.stockQuantity, 0);
      setEditingAcc({
        ...editingAcc,
        variants: updated,
        hasVariants: updated.length > 0,
        stockQuantity: newStock,
      });
    } else {
      const updated = form.variants.filter((v) => v.id !== variantId);
      const newStock = updated.reduce((s, v) => s + v.stockQuantity, 0);
      setForm((f) => ({
        ...f,
        variants: updated,
        hasVariants: updated.length > 0,
        stockQuantity: newStock.toString(),
      }));
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Success Notification Banner */}
      {saved && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500 text-white px-5 py-3.5 font-bold shadow-lg animate-in fade-in zoom-in-95">
          <CheckCircle2 className="h-5 w-5" />
          <span>تم الحفظ والتحديث بنجاح!</span>
        </div>
      )}

      {/* Top Stats & Low Stock Alert Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">إجمالي أصناف الإكسسوار</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{accessories.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Layers className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">إجمالي عدد القطع بالمخزن</p>
            <p className="text-2xl font-black text-slate-900 font-mono">{totalStockItems.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
            <TrendingUp className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">قيمة المخزون بسعر البيع</p>
            <p className="text-lg font-black text-slate-900 font-mono">{totalStockValue.toLocaleString()} {cur}</p>
          </div>
        </div>

        {/* Low Stock Filter Card */}
        <div
          onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
          className={`rounded-2xl border p-5 shadow-xs flex items-center gap-4 cursor-pointer transition ${
            lowStockItems.length > 0
              ? filterLowStockOnly
                ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-red-50/80 border-red-200 hover:bg-red-100/80'
              : 'bg-white border-slate-100'
          }`}
          title="اضغط للتصفية وعرض النواقص فقط"
        >
          <div
            className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
              filterLowStockOnly
                ? 'bg-white/20 text-white'
                : lowStockItems.length > 0
                ? 'bg-red-100 text-red-600'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className={`text-[11px] font-bold ${filterLowStockOnly ? 'text-red-100' : 'text-slate-500'}`}>
              تنبيهات النواقص {filterLowStockOnly && '(مفلترة)'}
            </p>
            <div className="flex items-center gap-2">
              <p
                className={`text-2xl font-black font-mono ${
                  filterLowStockOnly ? 'text-white' : lowStockItems.length > 0 ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {lowStockItems.length}
              </p>
              {lowStockItems.length > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  filterLowStockOnly ? 'bg-white text-red-700' : 'bg-red-200 text-red-900'
                }`}>
                  {filterLowStockOnly ? 'إلغاء التصفية' : 'عرض النواقص'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert Action Bar */}
      {lowStockItems.length > 0 && !filterLowStockOnly && (
        <div className="bg-gradient-to-r from-red-50 via-amber-50 to-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
            <p className="text-xs font-black text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span>تنبيه: {lowStockItems.length} أصناف أوشكت على النفاد وتحتاج إلى تزويد المخزون فوراً:</span>
            </p>
            <button
              type="button"
              onClick={() => setFilterLowStockOnly(true)}
              className="text-xs font-bold text-red-700 hover:text-red-900 underline cursor-pointer self-start sm:self-auto"
            >
              عرض وتزويد كافة النواقص ({lowStockItems.length})
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {lowStockItems.slice(0, 8).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setQuickStockItem(a)}
                className="px-3 py-1 bg-white hover:bg-red-100 text-red-800 rounded-xl text-xs font-bold border border-red-200 shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                title="اضغط لتزويد كمية هذا الصنف فوراً"
              >
                <span>{a.name}</span>
                <span className="font-mono bg-red-100 text-red-900 px-1.5 py-0.2 rounded font-black">
                  متبقي {a.stockQuantity}
                </span>
                <Plus className="h-3 w-3 text-emerald-600" />
              </button>
            ))}
            {lowStockItems.length > 8 && (
              <span className="text-xs text-red-600 font-bold self-center">
                + {lowStockItems.length - 8} أصناف أخرى...
              </span>
            )}
          </div>
        </div>
      )}

      {/* Control Bar: Search, Category Filter, and Add Button */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الباركود أو التصنيف أو الموديل..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-4 text-sm font-semibold focus:border-blue-500 focus:bg-white focus:outline-none transition"
          />
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 md:pb-0 w-full md:w-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                selectedCategory === c
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setForm(EMPTY_FORM);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs px-5 py-2.5 shadow-md transition shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>إضافة صنف جديد</span>
        </button>
      </div>

      {/* Accessories Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
              <tr>
                <th className="p-4">الصنف والمتغيرات</th>
                <th className="p-4">الباركود</th>
                <th className="p-4">الفئة</th>
                <th className="p-4 text-left">سعر الجملة</th>
                <th className="p-4 text-left">سعر البيع (القطاعي)</th>
                <th className="p-4 text-center">حالة المخزون</th>
                <th className="p-4 text-center">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAccessories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30 text-slate-400" />
                    <p className="font-bold text-slate-600">
                      {filterLowStockOnly
                        ? 'لا توجد أصناف ناقصة حالياً'
                        : accessories.length === 0
                        ? 'لا توجد أصناف إكسسوارات مسجلة بالمخزن حالياً'
                        : 'لا توجد أصناف مطابقة لعملية البحث.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAccessories.map((acc) => {
                  const isOutOfStock = acc.stockQuantity <= 0;
                  const isLow = acc.stockQuantity <= acc.minStockAlert;
                  const hasVars = acc.hasVariants && acc.variants && acc.variants.length > 0;

                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/60 transition group">
                      <td className="p-4 max-w-xs">
                        <div className="font-bold text-slate-900 group-hover:text-blue-700 transition flex items-center gap-1.5">
                          <span>{acc.name}</span>
                          {hasVars && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold">
                              {acc.variants!.length} متغيرات
                            </span>
                          )}
                        </div>

                        {/* Variants Preview Badges */}
                        {hasVars && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {acc.variants!.map((v) => (
                              <span
                                key={v.id}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                                  v.stockQuantity <= 0
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {v.name}: {v.stockQuantity}
                              </span>
                            ))}
                          </div>
                        )}

                        {acc.location && (
                          <p className="text-[10px] text-slate-400 mt-1">📍 {acc.location}</p>
                        )}
                      </td>

                      <td className="p-4 font-mono text-slate-600 text-[11px]">{acc.barcode}</td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-[11px] border border-indigo-100">
                          {acc.category}
                        </span>
                      </td>

                      <td className="p-4 font-mono font-bold text-slate-600 text-left">
                        {(acc.sellPriceWholesale || acc.costPrice || 0).toLocaleString()} {cur}
                      </td>

                      <td className="p-4 font-mono font-black text-blue-700 text-sm text-left">
                        {acc.sellPriceRetail.toLocaleString()} {cur}
                      </td>

                      {/* Stock Status Badge */}
                      <td className="p-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full font-mono font-black text-xs border ${
                            isOutOfStock
                              ? 'bg-red-100 text-red-800 border-red-300 animate-pulse'
                              : isLow
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {isOutOfStock
                            ? 'نفد (0)'
                            : isLow
                            ? `نواقص (${acc.stockQuantity})`
                            : `${acc.stockQuantity} قطعة`}
                        </span>
                      </td>

                      {/* Quick Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Quick Stock Replenish Button */}
                          <button
                            type="button"
                            onClick={() => setQuickStockItem(acc)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition cursor-pointer shadow-2xs active:scale-95"
                            title="تزويد عدد القطع بالمخزن فوراً"
                          >
                            <Plus className="h-3.5 w-3.5 text-emerald-600" />
                            <span>تزويد</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setBarcodeModalItem(acc)}
                            title="طباعة ستيكر باركود"
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition cursor-pointer"
                          >
                            <Barcode className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingAcc({ ...acc })}
                            title="تعديل"
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 transition cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              const confirmed = await showConfirm(
                                `هل أنت متأكد من حذف الصنف (${acc.name})؟`,
                                'تأكيد حذف صنف',
                                { confirmText: 'حذف الصنف', cancelText: 'إلغاء', danger: true }
                              );
                              if (confirmed) {
                                await db.accessories.delete(acc.id);
                                showToast(`تم حذف الصنف ${acc.name}`);
                              }
                            }}
                            title="حذف"
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-400 transition cursor-pointer"
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

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Quick Stock Replenishment (تزويد المخزون مباشرة)
      ───────────────────────────────────────────────────────────── */}
      {quickStockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Boxes className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">تزويد كمية المخزون فورياً</h3>
                  <p className="text-xs text-white/80">{quickStockItem.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickStockItem(null)}
                className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddStock} className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">الرصيد الحالي بالمخزن:</span>
                  <strong className="font-mono text-sm text-slate-900 font-black">
                    {quickStockItem.stockQuantity} قطعة
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">حد التنبيه:</span>
                  <span className="font-mono font-bold text-amber-700">{quickStockItem.minStockAlert} قطعة</span>
                </div>
              </div>

              {/* If item has variants, select variant */}
              {quickStockItem.hasVariants && quickStockItem.variants && quickStockItem.variants.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تزويد لمتغير محدد:
                  </label>
                  <select
                    value={selectedVariantForQuickAdd}
                    onChange={(e) => setSelectedVariantForQuickAdd(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="all">توزيع الإضافة على كافة المتغيرات بالتساوي</option>
                    {quickStockItem.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} (المخزون الحالي: {v.stockQuantity} قطعة)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الكمية المطلوب إضافتها (+):
                </label>
                <input
                  type="number"
                  min="1"
                  value={quickAddQty}
                  onChange={(e) => setQuickAddQty(e.target.value)}
                  className="w-full rounded-xl border-2 border-emerald-400 p-3 text-lg font-mono font-black text-slate-900 focus:border-emerald-600 focus:outline-none bg-emerald-50/20"
                  required
                  autoFocus
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">إضافة سريعة:</span>
                {[5, 10, 20, 50, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQuickAddQty(val.toString())}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 text-xs font-mono font-bold transition cursor-pointer"
                  >
                    +{val}
                  </button>
                ))}
              </div>

              {/* Preview calculation */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex justify-between items-center text-emerald-900">
                <span>المخزون المتوقع بعد التزويد:</span>
                <strong className="font-mono text-base font-black text-emerald-800">
                  {quickStockItem.stockQuantity + (parseInt(quickAddQty) || 0)} قطعة
                </strong>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickStockItem(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-xs font-bold shadow-md cursor-pointer"
                >
                  تأكيد وتزويد المخزون
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Add New Accessory
      ───────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden my-auto">
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold">إضافة صنف إكسسوار جديد</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddAccessory} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الصنف بالكامل *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: شاحن أنكر 20W فاست شارج..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold focus:border-blue-500 focus:bg-white focus:outline-none transition"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">التصنيف</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold focus:border-blue-500 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

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
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="امسح أو اكتب الباركود"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-2 gap-4 bg-gradient-to-br from-blue-50 to-indigo-50/40 p-4 rounded-2xl border border-blue-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">سعر الجملة (الشراء)</label>
                  <input
                    type="number"
                    step="any"
                    value={form.sellPriceWholesale || form.costPrice}
                    onChange={(e) => setForm({ ...form, sellPriceWholesale: e.target.value, costPrice: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-800 mb-1.5">سعر البيع (القطاعي) *</label>
                  <input
                    type="number"
                    step="any"
                    value={form.sellPriceRetail}
                    onChange={(e) => setForm({ ...form, sellPriceRetail: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-xl border-2 border-blue-400 p-2.5 text-sm font-black font-mono focus:border-blue-600 focus:outline-none bg-white"
                    required
                  />
                </div>
              </div>

              {/* Stock and Location */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {form.hasVariants ? 'إجمالي الكمية (محسوبة)' : 'الكمية بالمخزن *'}
                  </label>
                  <input
                    type="number"
                    value={form.stockQuantity}
                    onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                    disabled={form.hasVariants}
                    placeholder="0"
                    className={`w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none ${
                      form.hasVariants ? 'bg-slate-200/60 cursor-not-allowed font-bold' : 'bg-slate-50'
                    }`}
                    required={!form.hasVariants}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">حد تنبيه النواقص</label>
                  <input
                    type="number"
                    value={form.minStockAlert}
                    onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })}
                    placeholder="5"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">مكان التخزين (الرف)</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="رف A3"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-slate-50"
                  />
                </div>
              </div>

              {/* ─── PRODUCT VARIANTS SECTION ─── */}
              <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-black text-purple-950">
                      متغيرات المنتج (ألوان / مقاسات / موديلات)
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-900">
                    <input
                      type="checkbox"
                      checked={form.hasVariants}
                      onChange={(e) => setForm({ ...form, hasVariants: e.target.checked })}
                      className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span>تفعيل المتغيرات</span>
                  </label>
                </div>

                {form.hasVariants && (
                  <div className="space-y-3 pt-2">
                    {/* Add Variant Form */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-3 rounded-xl border border-purple-200">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={newVariantName}
                          onChange={(e) => setNewVariantName(e.target.value)}
                          placeholder="اسم المتغير (مثلاً: أسود، أزرق، 128G...)"
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs font-semibold focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          value={newVariantQty}
                          onChange={(e) => setNewVariantQty(e.target.value)}
                          placeholder="الكمية"
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddVariantToForm(false)}
                        className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-3 transition cursor-pointer"
                      >
                        + إضافة متغير
                      </button>
                    </div>

                    {/* List of Added Variants */}
                    {form.variants.length > 0 ? (
                      <div className="space-y-1.5">
                        {form.variants.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-white border border-purple-100 text-xs"
                          >
                            <span className="font-bold text-slate-800">{v.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-md">
                                {v.stockQuantity} قطعة
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveVariantFromForm(v.id, false)}
                                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-purple-700 font-semibold text-center py-2">
                        لم يتم إضافة متغيرات بعد. اكتب اسم المتغير واضغط (+ إضافة متغير).
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
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
                  حفظ الصنف بالمخزن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Edit Accessory
      ───────────────────────────────────────────────────────────── */}
      {editingAcc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden my-auto">
            <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Edit2 className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold">تعديل بيانات الصنف</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAcc(null)}
                className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الصنف بالكامل *</label>
                <input
                  type="text"
                  value={editingAcc.name}
                  onChange={(e) => setEditingAcc({ ...editingAcc, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold focus:border-indigo-500 focus:bg-white focus:outline-none transition"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">التصنيف</label>
                  <select
                    value={editingAcc.category}
                    onChange={(e) => setEditingAcc({ ...editingAcc, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold focus:border-indigo-500 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الباركود</label>
                  <input
                    type="text"
                    value={editingAcc.barcode}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm font-mono text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-2 gap-4 bg-gradient-to-br from-indigo-50 to-purple-50/40 p-4 rounded-2xl border border-indigo-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">سعر الجملة (الشراء)</label>
                  <input
                    type="number"
                    step="any"
                    value={editingAcc.sellPriceWholesale || editingAcc.costPrice || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setEditingAcc({ ...editingAcc, sellPriceWholesale: v, costPrice: v });
                    }}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-800 mb-1.5">سعر البيع (القطاعي) *</label>
                  <input
                    type="number"
                    step="any"
                    value={editingAcc.sellPriceRetail}
                    onChange={(e) => setEditingAcc({ ...editingAcc, sellPriceRetail: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border-2 border-indigo-400 p-2.5 text-sm font-black font-mono focus:border-indigo-600 focus:outline-none bg-white"
                    required
                  />
                </div>
              </div>

              {/* Stock and Location */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {editingAcc.hasVariants ? 'إجمالي الكمية (محسوبة)' : 'الكمية بالمخزن *'}
                  </label>
                  <input
                    type="number"
                    value={editingAcc.stockQuantity}
                    onChange={(e) => setEditingAcc({ ...editingAcc, stockQuantity: parseInt(e.target.value) || 0 })}
                    disabled={editingAcc.hasVariants}
                    className={`w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-indigo-500 focus:outline-none ${
                      editingAcc.hasVariants ? 'bg-slate-200/60 cursor-not-allowed font-bold' : 'bg-slate-50'
                    }`}
                    required={!editingAcc.hasVariants}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">حد تنبيه النواقص</label>
                  <input
                    type="number"
                    value={editingAcc.minStockAlert}
                    onChange={(e) => setEditingAcc({ ...editingAcc, minStockAlert: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono focus:border-indigo-500 focus:outline-none bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">مكان التخزين (الرف)</label>
                  <input
                    type="text"
                    value={editingAcc.location || ''}
                    onChange={(e) => setEditingAcc({ ...editingAcc, location: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-500 focus:outline-none bg-slate-50"
                  />
                </div>
              </div>

              {/* ─── PRODUCT VARIANTS SECTION IN EDIT ─── */}
              <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-black text-purple-950">
                      متغيرات المنتج (ألوان / مقاسات / موديلات)
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-900">
                    <input
                      type="checkbox"
                      checked={!!editingAcc.hasVariants}
                      onChange={(e) => setEditingAcc({ ...editingAcc, hasVariants: e.target.checked })}
                      className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span>تفعيل المتغيرات</span>
                  </label>
                </div>

                {editingAcc.hasVariants && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-3 rounded-xl border border-purple-200">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={newVariantName}
                          onChange={(e) => setNewVariantName(e.target.value)}
                          placeholder="اسم المتغير (مثلاً: أسود، أبيض...)"
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs font-semibold focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          value={newVariantQty}
                          onChange={(e) => setNewVariantQty(e.target.value)}
                          placeholder="الكمية"
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-bold focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddVariantToForm(true)}
                        className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-3 transition cursor-pointer"
                      >
                        + إضافة متغير
                      </button>
                    </div>

                    {editingAcc.variants && editingAcc.variants.length > 0 ? (
                      <div className="space-y-1.5">
                        {editingAcc.variants.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-white border border-purple-100 text-xs"
                          >
                            <span className="font-bold text-slate-800">{v.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-md">
                                {v.stockQuantity} قطعة
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveVariantFromForm(v.id, true)}
                                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-purple-700 font-semibold text-center py-2">
                        لم يتم إضافة متغيرات بعد.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
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

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Barcode Label Preview & Print
      ───────────────────────────────────────────────────────────── */}
      {barcodeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xs rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <Barcode className="h-5 w-5 text-blue-400" />
                <h3 className="font-display font-bold text-sm">ستيكر باركود الصنف</h3>
              </div>
              <button
                type="button"
                onClick={() => setBarcodeModalItem(null)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-white flex flex-col items-center text-center">
                <p className="text-sm font-black text-slate-900">{settings?.storeName || 'المحل'}</p>
                <p className="text-xs font-bold text-slate-700 mt-1 max-w-[200px] line-clamp-2">
                  {barcodeModalItem.name}
                </p>
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
