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
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { db } from '../db';
import type { Accessory, StoreSettings } from '../types';

export const AccessoriesView: React.FC = () => {
  const accessories = useLiveQuery(() => db.accessories.orderBy('createdAt').reverse().toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [barcodeModalItem, setBarcodeModalItem] = useState<Accessory | null>(null);
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  // Add Item Form
  const [name, setName] = useState('');
  const [category, setCategory] = useState('جرابات');
  const [barcode, setBarcode] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellPriceRetail, setSellPriceRetail] = useState('');
  const [sellPriceWholesale, setSellPriceWholesale] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('5');
  const [location, setLocation] = useState('');

  const categories = ['جرابات', 'سكرينات', 'شواحن', 'كابلات', 'سماعات', 'ساعات ذكية', 'باور بنك', 'قطع غيار', 'أخرى'];

  const generateRandomBarcode = () => {
    // Generate 12-digit EAN/Code128 barcode
    const random = Math.floor(100000000000 + Math.random() * 900000000000);
    setBarcode(random.toString());
  };

  const handleAddAccessory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sellPriceRetail || !stockQuantity) {
      alert('يرجى ملء الحقول الأساسية: الاسم، سعر القطاعي، والكمية.');
      return;
    }

    const finalBarcode = barcode.trim() || Math.floor(100000000000 + Math.random() * 900000000000).toString();

    // Check duplicate barcode
    const existing = await db.accessories.where('barcode').equals(finalBarcode).first();
    if (existing) {
      alert('تنبيه: هذا الباركود مسجل مسبقاً لصنف آخر!');
      return;
    }

    const newAcc: Accessory = {
      id: `acc_${Date.now()}`,
      name: name.trim(),
      category,
      barcode: finalBarcode,
      costPrice: parseFloat(costPrice) || 0,
      sellPriceRetail: parseFloat(sellPriceRetail),
      sellPriceWholesale: parseFloat(sellPriceWholesale) || parseFloat(sellPriceRetail),
      stockQuantity: parseInt(stockQuantity) || 0,
      minStockAlert: parseInt(minStockAlert) || 5,
      location: location.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    await db.accessories.add(newAcc);
    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setCategory('جرابات');
    setBarcode('');
    setCostPrice('');
    setSellPriceRetail('');
    setSellPriceWholesale('');
    setStockQuantity('');
    setMinStockAlert('5');
    setLocation('');
  };

  // Render barcode in modal when item selected
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

  const lowStockCount = accessories.filter((a) => a.stockQuantity <= a.minStockAlert).length;
  const totalStockItems = accessories.reduce((acc, a) => acc + a.stockQuantity, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">إجمالي أصناف الإكسسوارات</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">{accessories.length} صنف</h3>
            <span className="text-[10px] text-blue-600 font-semibold">{totalStockItems} قطعة في المخزن</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Package className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">تنبيهات النواقص (حد الطلب)</p>
            <h3 className="text-2xl font-black text-red-600 mt-1 font-mono">{lowStockCount}</h3>
            <span className="text-[10px] text-red-500 font-semibold">تحتاج لإعادة طلب وتوريد</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">التصنيفات المتاحة</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">{categories.length}</h3>
            <span className="text-[10px] text-emerald-600 font-semibold">شواحن، جرابات، سكرينات...</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Category Filter, and Add Button */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الباركود..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-4 text-xs font-semibold focus:border-blue-600 focus:bg-white focus:outline-none"
          />
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-slate-400" />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
              selectedCategory === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedCategory === c ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 shadow-md transition shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>إضافة صنف إكسسوار جديد</span>
        </button>
      </div>

      {/* Accessories Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-4">الصنف</th>
                <th className="p-4">الباركود</th>
                <th className="p-4">التصنيف</th>
                <th className="p-4">سعر التكلفة</th>
                <th className="p-4">سعر القطاعي</th>
                <th className="p-4">سعر الجملة</th>
                <th className="p-4 text-center">الكمية بالمخزن</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccessories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    لا توجد أصناف مسجلة مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filteredAccessories.map((acc) => {
                  const isLow = acc.stockQuantity <= acc.minStockAlert;
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50 transition">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{acc.name}</div>
                        {acc.location && (
                          <div className="text-[10px] text-slate-400 mt-0.5">المكان: {acc.location}</div>
                        )}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700">{acc.barcode}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {acc.category}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-500">
                        {acc.costPrice.toLocaleString()} {settings?.currency || 'ج'}
                      </td>
                      <td className="p-4 font-mono font-black text-blue-700 text-sm">
                        {acc.sellPriceRetail.toLocaleString()} {settings?.currency || 'ج'}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-800">
                        {acc.sellPriceWholesale.toLocaleString()} {settings?.currency || 'ج'}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full font-mono font-black text-xs ${
                            isLow
                              ? 'bg-red-100 text-red-700 border border-red-200 animate-pulse'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {acc.stockQuantity} قطعة
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setBarcodeModalItem(acc)}
                            title="طباعة ستيكر باركود للصنف"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition cursor-pointer"
                          >
                            <Barcode className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const newQty = prompt('أدخل الكمية الجديدة للمخزن:', acc.stockQuantity.toString());
                              if (newQty !== null && !isNaN(parseInt(newQty))) {
                                await db.accessories.update(acc.id, { stockQuantity: parseInt(newQty) });
                              }
                            }}
                            title="تعديل الكمية"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 transition cursor-pointer"
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

      {/* Modal: Add New Accessory */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                <span>إضافة صنف إكسسوار / قطعة غيار للمحل</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAccessory} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصنف بالكامل</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: شاحن أنكر 20W فاست شارج أو سكرينة 11D آيفون 15"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white focus:border-blue-600 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">الباركود</label>
                    <button
                      type="button"
                      onClick={generateRandomBarcode}
                      className="text-[11px] text-blue-600 hover:underline font-semibold"
                    >
                      توليد كود تلقائي
                    </button>
                  </div>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="امسح بالباركود سكانر أو ولد كود"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر التكلفة (الشراء)</label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1">سعر البيع (قطاعي)</label>
                  <input
                    type="number"
                    value={sellPriceRetail}
                    onChange={(e) => setSellPriceRetail(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border-2 border-blue-400 p-2 text-xs font-bold font-mono focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر الجملة (لأصحاب المحلات)</label>
                  <input
                    type="number"
                    value={sellPriceWholesale}
                    onChange={(e) => setSellPriceWholesale(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الكمية المتوفرة بالمخزن</label>
                  <input
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حد تنبيه النواقص</label>
                  <input
                    type="number"
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(e.target.value)}
                    placeholder="5"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مكان التخزين (الرف / الدرج)</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="مثال: رف A3 أو فاترينة 1"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold shadow transition"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Barcode Label Sticker Preview & Print */}
      {barcodeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-center gap-2">
              <Barcode className="h-5 w-5 text-blue-600" />
              <span>ستيكر باركود الصنف للمحل</span>
            </h3>

            {/* Printable Sticker Box */}
            <div className="border border-slate-300 rounded-xl p-4 bg-white shadow-inner flex flex-col items-center justify-center">
              <span className="text-xs font-black text-slate-900">{settings?.storeName}</span>
              <span className="text-[11px] font-bold text-slate-700 mt-1 max-w-[220px] truncate">
                {barcodeModalItem.name}
              </span>
              <div className="my-2">
                <svg ref={barcodeSvgRef} className="max-w-full"></svg>
              </div>
              <span className="text-base font-black text-blue-800 font-mono">
                {barcodeModalItem.sellPriceRetail.toLocaleString()} {settings?.currency || 'ج.م'}
              </span>
            </div>

            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة الستيكر</span>
              </button>
              <button
                type="button"
                onClick={() => setBarcodeModalItem(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
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
