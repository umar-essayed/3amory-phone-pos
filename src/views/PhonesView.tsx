import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Smartphone,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  Printer,
  BatteryCharging,
  DollarSign,
  FileCheck2,
  Trash2,
  Edit,
  Tag,
  AlertCircle,
  Eye,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import { db, seedSampleData } from '../db';
import { triggerPrint } from '../services/printer';
import { useModal } from '../context/ModalContext';
import type { Phone, StoreSettings, User } from '../types';

interface PhonesViewProps {
  currentUser?: User | null;
}

export const PhonesView: React.FC<PhonesViewProps> = ({ currentUser }) => {
  const isAdmin = !currentUser || currentUser.role === 'owner' || currentUser.role === 'manager';
  const { showAlert, showConfirm, showToast } = useModal();
  const phones = useLiveQuery(() => db.phones.orderBy('createdAt').reverse().toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCondition, setFilterCondition] = useState<'all' | 'new' | 'used'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'sold'>('available');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPhone, setEditingPhone] = useState<Phone | null>(null);
  const [selectedPhoneForContract, setSelectedPhoneForContract] = useState<Phone | null>(null);

  // New Phone Form State
  const [phoneName, setPhoneName] = useState('');
  const [brand, setBrand] = useState('Apple');
  const [model, setModel] = useState('');
  const [condition, setCondition] = useState<'new' | 'used'>('new');
  const [imei1, setImei1] = useState('');
  const [imei2, setImei2] = useState('');
  const [storage, setStorage] = useState('128GB');
  const [color, setColor] = useState('');
  const [batteryHealth, setBatteryHealth] = useState('');
  const [physicalCondition, setPhysicalCondition] = useState('ممتاز - كسر زيرو');
  const [hasBox, setHasBox] = useState(true);
  const [hasOriginalAccessories, setHasOriginalAccessories] = useState(true);
  const [costPrice, setCostPrice] = useState('');
  const [minSellPrice, setMinSellPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [notes, setNotes] = useState('');

  // Seller info for used phones
  const [sellerName, setSellerName] = useState('');
  const [sellerNationalId, setSellerNationalId] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');

  const handleAddPhone = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneName || !imei1 || !sellPrice) {
      showAlert('يرجى كتابة اسم الجهاز ورقم الـ IMEI وسعر البيع على الأقل.', 'بيانات ناقصة', 'warning');
      return;
    }

    // IMEI duplicate check
    const existing = await db.phones.where('imei1').equals(imei1.trim()).first();
    if (existing) {
      showAlert(`تنبيه أمني: رقم الـ IMEI (${imei1}) مسجل مسبقاً في النظام باسم: ${existing.name}!`, 'IMEI مكرر', 'error');
      return;
    }

    const newId = `ph_${Date.now()}`;
    const newPhone: Phone = {
      id: newId,
      name: phoneName.trim(),
      brand: brand.trim(),
      model: model.trim() || phoneName.trim(),
      condition,
      imei1: imei1.trim(),
      imei2: imei2.trim() || undefined,
      storage,
      color: color.trim() || 'غير محدد',
      batteryHealth: condition === 'used' ? parseInt(batteryHealth) || undefined : undefined,
      physicalCondition: condition === 'used' ? physicalCondition : undefined,
      hasBox,
      hasOriginalAccessories,
      costPrice: parseFloat(costPrice) || 0,
      minSellPrice: parseFloat(minSellPrice) || parseFloat(sellPrice),
      sellPrice: parseFloat(sellPrice),
      status: 'available',
      sellerInfo:
        condition === 'used' && sellerName
          ? {
              name: sellerName.trim(),
              nationalId: sellerNationalId.trim(),
              phone: sellerPhone.trim(),
            }
          : undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    await db.phones.add(newPhone);
    showToast('تمت إضافة الهاتف بنجاح إلى مخزن الأجهزة');

    // If used phone, offer immediate legal contract printing
    if (condition === 'used' && sellerName && settings) {
      const wantPrint = await showConfirm(
        'تم تسجيل بيانات الهاتف المستعمل بنجاح!\nهل ترغب في طباعة عقد التنازل والإقرار القانوني المعتمد الآن؟',
        'طباعة عقد الشراء والتنازل',
        { confirmText: 'طباعة العقد الآن', cancelText: 'لاحقاً' }
      );
      if (wantPrint) {
        triggerPrint({
          type: 'used_phone_contract',
          phone: newPhone,
          settings,
        });
      }
    }

    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setPhoneName('');
    setBrand('Apple');
    setModel('');
    setCondition('new');
    setImei1('');
    setImei2('');
    setStorage('128GB');
    setColor('');
    setBatteryHealth('');
    setCostPrice('');
    setMinSellPrice('');
    setSellPrice('');
    setNotes('');
    setSellerName('');
    setSellerNationalId('');
    setSellerPhone('');
  };

  const filteredPhones = phones.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.imei1.includes(searchQuery) ||
      (p.imei2 && p.imei2.includes(searchQuery)) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCondition = filterCondition === 'all' || p.condition === filterCondition;
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;

    return matchesSearch && matchesCondition && matchesStatus;
  });

  const availablePhones = phones.filter((p) => p.status === 'available');
  const newCount = availablePhones.filter((p) => p.condition === 'new').length;
  const usedCount = availablePhones.filter((p) => p.condition === 'used').length;
  const totalStockValue = availablePhones.reduce((acc, p) => acc + p.sellPrice, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">الهواتف المتاحة للبيع</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">{availablePhones.length}</h3>
            <span className="text-[10px] text-blue-600 font-semibold">{newCount} جديد | {usedCount} مستعمل</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Smartphone className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">الهواتف الجديدة (كرتونة)</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">{newCount}</h3>
            <span className="text-[10px] text-emerald-600 font-semibold">بضمان ساري</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">الهواتف المستعملة (كسر زيرو)</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">{usedCount}</h3>
            <span className="text-[10px] text-purple-600 font-semibold">مفحوصة مع عقود تنازل</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <BatteryCharging className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold">القيمة السوقية للمخزون</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {totalStockValue.toLocaleString()} {settings?.currency || 'ج.م'}
            </h3>
            <span className="text-[10px] text-slate-400 font-semibold">حسب سعر البيع المعروض</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Add Button */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، الموديل، أو رقم IMEI..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-4 text-xs font-semibold focus:border-blue-600 focus:bg-white focus:outline-none"
          />
          <Search className="absolute right-3.5 top-3 h-4 w-4 text-slate-400" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <select
            value={filterCondition}
            onChange={(e) => setFilterCondition(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">كل الحالات (جديد ومستعمل)</option>
            <option value="new">الأجهزة الجديدة فقط</option>
            <option value="used">الأجهزة المستعملة فقط</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="available">المتاح للبيع فقط</option>
            <option value="sold">المباع سابقاً</option>
            <option value="all">كل الأجهزة</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 shadow-md transition shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة هاتف جديد / مستعمل</span>
          </button>
        </div>
      </div>

      {/* Phones Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPhones.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-sm flex flex-col items-center justify-center gap-3">
            <Smartphone className="h-10 w-10 text-slate-300" />
            <p className="font-bold text-slate-600">
              {phones.length === 0 ? 'لا توجد هواتف مسجلة بالمخزن حالياً' : 'لا توجد هواتف مطابقة لخيارات البحث.'}
            </p>
          </div>
        ) : (
          filteredPhones.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between ${
                p.status === 'sold' ? 'opacity-60 bg-slate-50 border-slate-200' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {p.brand}
                    </span>
                    <h4 className="text-base font-black text-slate-900 leading-snug">{p.name}</h4>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        p.condition === 'new'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}
                    >
                      {p.condition === 'new' ? 'جديد كرتونة' : 'مستعمل'}
                    </span>
                    {p.status === 'sold' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                        تم البيع
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Pills */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-3">
                  <div>
                    <span className="text-slate-400 text-[10px] block">السعة واللون:</span>
                    <strong className="text-slate-800">{p.storage} - {p.color}</strong>
                  </div>
                  {p.condition === 'used' && p.batteryHealth && (
                    <div>
                      <span className="text-slate-400 text-[10px] block">نسبة البطارية:</span>
                      <strong className="text-emerald-700 font-mono">{p.batteryHealth}%</strong>
                    </div>
                  )}
                  <div className="col-span-2 pt-1 border-t border-slate-200">
                    <span className="text-slate-400 text-[10px] block">رقم السيريال (IMEI 1):</span>
                    <span className="font-mono text-xs font-bold text-slate-800">{p.imei1}</span>
                  </div>
                </div>

                {/* Seller Info for Used Phones */}
                {p.condition === 'used' && p.sellerInfo && (
                  <div className="text-[11px] text-slate-500 bg-amber-50/70 border border-amber-200 p-2.5 rounded-xl mb-3">
                    <div className="flex items-center gap-1 font-bold text-amber-900">
                      <FileCheck2 className="h-3.5 w-3.5 text-amber-700" />
                      <span>بيانات البائع الموثقة:</span>
                    </div>
                    <div className="mt-1 text-slate-700">
                      {p.sellerInfo.name} | الرقم القومي: <span className="font-mono">{p.sellerInfo.nationalId}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Price & Action Buttons */}
              <div className="border-t border-slate-100 pt-3 mt-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">سعر البيع:</span>
                  <span className="text-lg font-black text-blue-700 font-mono">
                    {p.sellPrice.toLocaleString()} {settings?.currency || 'ج.م'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setEditingPhone(p)}
                      title="تعديل بيانات وسعر الهاتف (مسؤول)"
                      className="p-2 rounded-xl bg-slate-100 text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  {p.condition === 'used' && p.sellerInfo && (
                    <button
                      type="button"
                      onClick={() => {
                        if (settings) {
                          triggerPrint({
                            type: 'used_phone_contract',
                            phone: p,
                            settings,
                          });
                        }
                      }}
                      title="طباعة عقد وإقرار التنازل القانوني"
                      className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-800 transition cursor-pointer"
                    >
                      <FileCheck2 className="h-4 w-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = await showConfirm(
                          `هل أنت متأكد من حذف الجهاز (${p.name}) من المخزن نهائياً؟`,
                          'تأكيد حذف هاتف',
                          { confirmText: 'حذف الهاتف', cancelText: 'إلغاء', danger: true }
                        );
                        if (confirmed) {
                          await db.phones.delete(p.id);
                          showToast(`تم حذف ${p.name}`);
                        }
                      }}
                      className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Add New Phone */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-blue-600" />
                <span>إضافة هاتف جديد / مستعمل للمخزن</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPhone} className="space-y-4">
              {/* Condition Switcher */}
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setCondition('new')}
                  className={`flex-1 py-2 text-xs font-black rounded-lg transition ${
                    condition === 'new' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  ✨ جهاز جديد كرتونة (New)
                </button>
                <button
                  type="button"
                  onClick={() => setCondition('used')}
                  className={`flex-1 py-2 text-xs font-black rounded-lg transition ${
                    condition === 'used' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  📱 جهاز مستعمل / كسر زيرو (Used)
                </button>
              </div>

              {/* Brand & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الماركة (Brand)</label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white focus:border-blue-600 focus:outline-none"
                  >
                    <option value="Apple">Apple (آبل / آيفون)</option>
                    <option value="Samsung">Samsung (سامسونج)</option>
                    <option value="Xiaomi">Xiaomi (شاومي / ريدمي / بوكو)</option>
                    <option value="Oppo">Oppo (أوبو)</option>
                    <option value="Realme">Realme (ريلمي)</option>
                    <option value="Infinix">Infinix (إنفينكس)</option>
                    <option value="Vivo">Vivo (فيفو)</option>
                    <option value="Honor">Honor (هونر)</option>
                    <option value="Huawei">Huawei (هواوي)</option>
                    <option value="Other">أخرى</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم وموديل الهاتف الكامل</label>
                  <input
                    type="text"
                    value={phoneName}
                    onChange={(e) => setPhoneName(e.target.value)}
                    placeholder="مثال: iPhone 14 Pro Max أو Galaxy S23"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* IMEI 1 & 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم السيريال / الـ IMEI 1 (إلزامي)
                  </label>
                  <input
                    type="text"
                    value={imei1}
                    onChange={(e) => setImei1(e.target.value)}
                    placeholder="15 رقم - 35XXXXXXXXXXXXX"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الـ IMEI 2 (اختياري)</label>
                  <input
                    type="text"
                    value={imei2}
                    onChange={(e) => setImei2(e.target.value)}
                    placeholder="15 رقم للخط الثاني"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Storage, Color, Battery */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السعة التخزينية</label>
                  <select
                    value={storage}
                    onChange={(e) => setStorage(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white focus:border-blue-600 focus:outline-none"
                  >
                    <option value="64GB">64GB</option>
                    <option value="128GB">128GB</option>
                    <option value="256GB">256GB</option>
                    <option value="512GB">512GB</option>
                    <option value="1TB">1TB</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اللون</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="مثال: أسود، أزرق، تيتانيوم"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>

                {condition === 'used' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نسبة البطارية (%)</label>
                    <input
                      type="number"
                      max={100}
                      min={50}
                      value={batteryHealth}
                      onChange={(e) => setBatteryHealth(e.target.value)}
                      placeholder="مثال: 88"
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Prices */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر الشراء / التكلفة</label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر البيع الأدنى</label>
                  <input
                    type="number"
                    value={minSellPrice}
                    onChange={(e) => setMinSellPrice(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1">سعر البيع المعروض</label>
                  <input
                    type="number"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border-2 border-blue-400 p-2 text-xs font-black font-mono text-blue-700 focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Used Phone Seller Info (Legal Protection Section) */}
              {condition === 'used' && (
                <div className="border border-purple-200 bg-purple-50/50 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                    <ShieldCheck className="h-4 w-4 text-purple-700" />
                    <span>بيانات البائع القانونية (لإصدار عقد وشراء التنازل لحماية المحل)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم البائع بالكامل</label>
                      <input
                        type="text"
                        value={sellerName}
                        onChange={(e) => setSellerName(e.target.value)}
                        placeholder="الاسم الرباعي من البطاقة"
                        className="w-full rounded-xl border border-slate-300 p-2 text-xs focus:border-purple-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">الرقم القومي (14 رقم)</label>
                      <input
                        type="text"
                        value={sellerNationalId}
                        onChange={(e) => setSellerNationalId(e.target.value)}
                        placeholder="29XXXXXXXXXXXX"
                        className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono focus:border-purple-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم هاتف البائع</label>
                      <input
                        type="text"
                        value={sellerPhone}
                        onChange={(e) => setSellerPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono focus:border-purple-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-xs font-bold shadow-md transition cursor-pointer"
                >
                  حفظ الهاتف في المخزن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Edit Existing Phone (Admin Only) */}
      {editingPhone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Edit className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black">تعديل بيانات الهاتف الكاملة</h3>
                  <p className="text-[11px] text-slate-400">تعديل كافة تفاصيل الجهاز والأسعار والأرقام التسلسلية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPhone(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingPhone.name || !editingPhone.imei1 || !editingPhone.sellPrice) {
                  showAlert('يرجى ملء اسم الهاتف والـ IMEI وسعر البيع.', 'بيانات ناقصة', 'warning');
                  return;
                }

                // Check duplicate IMEI if changed
                const existing = await db.phones.where('imei1').equals(editingPhone.imei1.trim()).first();
                if (existing && existing.id !== editingPhone.id) {
                  showAlert(`تنبيه: رقم الـ IMEI (${editingPhone.imei1}) مسجل مسبقاً لجهاز آخر (${existing.name})!`, 'IMEI مكرر', 'error');
                  return;
                }

                await db.phones.update(editingPhone.id, {
                  name: editingPhone.name.trim(),
                  brand: editingPhone.brand || '',
                  model: editingPhone.model || '',
                  condition: editingPhone.condition,
                  imei1: editingPhone.imei1.trim(),
                  imei2: editingPhone.imei2?.trim() || '',
                  storage: editingPhone.storage || '',
                  color: editingPhone.color || '',
                  batteryHealth: editingPhone.condition === 'used' ? Number(editingPhone.batteryHealth) || undefined : undefined,
                  physicalCondition: editingPhone.physicalCondition || '',
                  hasBox: Boolean(editingPhone.hasBox),
                  hasOriginalAccessories: Boolean(editingPhone.hasOriginalAccessories),
                  costPrice: Number(editingPhone.costPrice) || 0,
                  minSellPrice: Number(editingPhone.minSellPrice) || 0,
                  sellPrice: Number(editingPhone.sellPrice) || 0,
                  status: editingPhone.status,
                  sellerInfo: editingPhone.sellerInfo,
                  notes: editingPhone.notes || '',
                });

                showToast(`تم حفظ تعديلات ${editingPhone.name} بنجاح`);
                setEditingPhone(null);
              }}
              className="flex-1 overflow-y-auto p-6 space-y-4 text-xs"
            >
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    اسم الهاتف بالكامل <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPhone.name}
                    onChange={(e) => setEditingPhone({ ...editingPhone, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الماركة (Brand)</label>
                  <input
                    type="text"
                    value={editingPhone.brand || ''}
                    onChange={(e) => setEditingPhone({ ...editingPhone, brand: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:outline-none"
                    placeholder="Apple, Samsung..."
                  />
                </div>
              </div>

              {/* IMEI & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    IMEI 1 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPhone.imei1}
                    onChange={(e) => setEditingPhone({ ...editingPhone, imei1: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2 font-mono font-bold focus:border-blue-600 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">IMEI 2 (اختياري)</label>
                  <input
                    type="text"
                    value={editingPhone.imei2 || ''}
                    onChange={(e) => setEditingPhone({ ...editingPhone, imei2: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2 font-mono focus:border-blue-600 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">حالة الجهاز</label>
                  <select
                    value={editingPhone.condition}
                    onChange={(e) => setEditingPhone({ ...editingPhone, condition: e.target.value as 'new' | 'used' })}
                    className="w-full rounded-xl border border-slate-300 p-2 font-bold bg-white focus:outline-none"
                  >
                    <option value="new">جديد (زيرو / متبرشم)</option>
                    <option value="used">مستعمل</option>
                  </select>
                </div>
              </div>

              {/* Specs: Storage, Color, Status, Battery */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">السعة التخزينية</label>
                  <input
                    type="text"
                    value={editingPhone.storage}
                    onChange={(e) => setEditingPhone({ ...editingPhone, storage: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2 focus:border-blue-600 focus:outline-none"
                    placeholder="128GB"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اللون</label>
                  <input
                    type="text"
                    value={editingPhone.color}
                    onChange={(e) => setEditingPhone({ ...editingPhone, color: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2 focus:border-blue-600 focus:outline-none"
                    placeholder="أزرق / أسود..."
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">حالة التوفر</label>
                  <select
                    value={editingPhone.status}
                    onChange={(e) => setEditingPhone({ ...editingPhone, status: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-300 p-2 font-bold bg-white focus:outline-none"
                  >
                    <option value="available">متاح للبيع</option>
                    <option value="sold">تم البيع</option>
                    <option value="returned">مرتجع</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نسبة البطارية (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingPhone.batteryHealth ?? ''}
                    onChange={(e) => setEditingPhone({ ...editingPhone, batteryHealth: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full rounded-xl border border-slate-300 p-2 font-mono focus:border-blue-600 focus:outline-none"
                    placeholder="100"
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-3 gap-3 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعر الشراء / التكلفة</label>
                  <input
                    type="number"
                    step="any"
                    value={editingPhone.costPrice}
                    onChange={(e) => setEditingPhone({ ...editingPhone, costPrice: Number(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 p-2 font-mono font-bold focus:border-blue-600 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الحد الأدنى للبيع</label>
                  <input
                    type="number"
                    step="any"
                    value={editingPhone.minSellPrice}
                    onChange={(e) => setEditingPhone({ ...editingPhone, minSellPrice: Number(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-300 p-2 font-mono font-bold focus:border-blue-600 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-blue-900 mb-1">
                    سعر البيع المعلن <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingPhone.sellPrice}
                    onChange={(e) => setEditingPhone({ ...editingPhone, sellPrice: Number(e.target.value) || 0 })}
                    className="w-full rounded-xl border-2 border-blue-500 p-2 font-mono font-black text-blue-700 focus:border-blue-600 focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* Used Phone Details: Condition & Accessories */}
              {editingPhone.condition === 'used' && (
                <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/60 space-y-3">
                  <div className="font-bold text-amber-900 text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-amber-600" />
                    بيانات الفحص والملحقات
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">الحالة الظاهرية</label>
                      <input
                        type="text"
                        value={editingPhone.physicalCondition || ''}
                        onChange={(e) => setEditingPhone({ ...editingPhone, physicalCondition: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 p-2 bg-white focus:outline-none"
                        placeholder="كسر زيرو / به خدوش بسيطة..."
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="editHasBox"
                        checked={Boolean(editingPhone.hasBox)}
                        onChange={(e) => setEditingPhone({ ...editingPhone, hasBox: e.target.checked })}
                        className="h-4 w-4 rounded text-blue-600"
                      />
                      <label htmlFor="editHasBox" className="font-bold text-slate-700 cursor-pointer">
                        الكرتونة متوفرة
                      </label>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="editHasOriginalAcc"
                        checked={Boolean(editingPhone.hasOriginalAccessories)}
                        onChange={(e) => setEditingPhone({ ...editingPhone, hasOriginalAccessories: e.target.checked })}
                        className="h-4 w-4 rounded text-blue-600"
                      />
                      <label htmlFor="editHasOriginalAcc" className="font-bold text-slate-700 cursor-pointer">
                        المشتملات الأصلية متوفرة
                      </label>
                    </div>
                  </div>

                  {/* Seller Info */}
                  <div className="pt-2 border-t border-amber-200/60">
                    <p className="font-bold text-slate-700 mb-2">بيانات البائع / المتنازل (لعقد الشراء):</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="اسم البائع"
                        value={editingPhone.sellerInfo?.name || ''}
                        onChange={(e) => setEditingPhone({
                          ...editingPhone,
                          sellerInfo: {
                            name: e.target.value,
                            nationalId: editingPhone.sellerInfo?.nationalId || '',
                            phone: editingPhone.sellerInfo?.phone || '',
                          }
                        })}
                        className="w-full rounded-xl border border-slate-300 p-2 bg-white focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="الرقم القومي"
                        value={editingPhone.sellerInfo?.nationalId || ''}
                        onChange={(e) => setEditingPhone({
                          ...editingPhone,
                          sellerInfo: {
                            name: editingPhone.sellerInfo?.name || '',
                            nationalId: e.target.value,
                            phone: editingPhone.sellerInfo?.phone || '',
                          }
                        })}
                        className="w-full rounded-xl border border-slate-300 p-2 bg-white focus:outline-none font-mono"
                      />
                      <input
                        type="text"
                        placeholder="رقم الهاتف"
                        value={editingPhone.sellerInfo?.phone || ''}
                        onChange={(e) => setEditingPhone({
                          ...editingPhone,
                          sellerInfo: {
                            name: editingPhone.sellerInfo?.name || '',
                            nationalId: editingPhone.sellerInfo?.nationalId || '',
                            phone: e.target.value,
                          }
                        })}
                        className="w-full rounded-xl border border-slate-300 p-2 bg-white focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <textarea
                  rows={2}
                  value={editingPhone.notes || ''}
                  onChange={(e) => setEditingPhone({ ...editingPhone, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:outline-none resize-none"
                  placeholder="أي ملاحظات حول الصيانة السابقة أو حالة الجهاز..."
                />
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingPhone(null)}
                  className="rounded-xl border border-slate-300 px-5 py-2 font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
                >
                  حفظ وتحديث الهاتف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
