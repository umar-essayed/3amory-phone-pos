import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Store,
  Upload,
  Phone,
  Printer,
  Cloud,
  FileText,
  Save,
  CheckCircle2,
  RefreshCw,
  Download,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { db, DEFAULT_SETTINGS } from '../db';
import { syncDataToFirebase } from '../services/firebase';
import type { StoreSettings } from '../types';

export const SettingsView: React.FC = () => {
  const currentSettings = useLiveQuery(() => db.settings.get(1));
  const [formData, setFormData] = useState<StoreSettings | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'store' | 'receipt' | 'firebase' | 'backup'>('store');

  useEffect(() => {
    if (currentSettings) {
      setFormData(currentSettings);
    }
  }, [currentSettings]);

  if (!formData) {
    return <div className="p-8 text-center text-slate-500">جاري تحميل إعدادات المحل...</div>;
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData({ ...formData, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.settings.put(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSyncNow = async () => {
    setSyncLoading(true);
    setSyncMessage(null);
    const res = await syncDataToFirebase();
    setSyncLoading(false);
    setSyncMessage(res.message);
  };

  const handleExportBackup = async () => {
    const allData = {
      settings: await db.settings.toArray(),
      users: await db.users.toArray(),
      phones: await db.phones.toArray(),
      accessories: await db.accessories.toArray(),
      wallets: await db.wallets.toArray(),
      walletTransactions: await db.walletTransactions.toArray(),
      invoices: await db.invoices.toArray(),
      repairs: await db.repairs.toArray(),
      shifts: await db.shifts.toArray(),
      expenses: await db.expenses.toArray(),
      customers: await db.customers.toArray(),
      suppliers: await db.suppliers.toArray(),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mobile_pos_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('تحذير هام: استعادة النسخة الاحتياطية ستستبدل البيانات الحالية. هل أنت متأكد من المتابعة؟')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result as string);
        await db.transaction('rw', db.tables, async () => {
          if (imported.settings) {
            await db.settings.clear();
            await db.settings.bulkAdd(imported.settings);
          }
          if (imported.users) {
            await db.users.clear();
            await db.users.bulkAdd(imported.users);
          }
          if (imported.phones) {
            await db.phones.clear();
            await db.phones.bulkAdd(imported.phones);
          }
          if (imported.accessories) {
            await db.accessories.clear();
            await db.accessories.bulkAdd(imported.accessories);
          }
          if (imported.wallets) {
            await db.wallets.clear();
            await db.wallets.bulkAdd(imported.wallets);
          }
          if (imported.walletTransactions) {
            await db.walletTransactions.clear();
            await db.walletTransactions.bulkAdd(imported.walletTransactions);
          }
          if (imported.invoices) {
            await db.invoices.clear();
            await db.invoices.bulkAdd(imported.invoices);
          }
          if (imported.repairs) {
            await db.repairs.clear();
            await db.repairs.bulkAdd(imported.repairs);
          }
          if (imported.shifts) {
            await db.shifts.clear();
            await db.shifts.bulkAdd(imported.shifts);
          }
          if (imported.expenses) {
            await db.expenses.clear();
            await db.expenses.bulkAdd(imported.expenses);
          }
        });
        alert('تمت استعادة البيانات والنسخة الاحتياطية بنجاح!');
        window.location.reload();
      } catch (err) {
        alert('حدث خطأ أثناء قراءة ملف النسخة الاحتياطية.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
            <Store className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">تخصيص وإعدادات المحل</h1>
            <p className="text-sm text-slate-500">
              تحكم كامل في هوية وشعار المحل، الفواتير، الطباعة، وربط السحابة والنسخ الاحتياطي
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-md transition hover:bg-blue-700 active:scale-95 cursor-pointer"
        >
          <Save className="h-5 w-5" />
          <span>حفظ التعديلات</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span className="font-semibold text-sm">تم حفظ وتحديث إعدادات المحل بنجاح! سيتم تطبيقها فوراً على كل شاشات وفواتير النظام.</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-2 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('store')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'store'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Store className="h-4 w-4" />
          <span>بيانات وهوية المحل (White-label)</span>
        </button>
        <button
          onClick={() => setActiveTab('receipt')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'receipt'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Printer className="h-4 w-4" />
          <span>إعدادات الفواتير والطباعة</span>
        </button>
        <button
          onClick={() => setActiveTab('firebase')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'firebase'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cloud className="h-4 w-4" />
          <span>سحابة Firebase والمزامنة</span>
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'backup'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Download className="h-4 w-4" />
          <span>النسخ الاحتياطي واستعادة البيانات</span>
        </button>
      </div>

      <div className="bg-white p-6 rounded-b-2xl shadow-xs border border-t-0 border-slate-200">
        {/* TAB 1: STORE & IDENTITY */}
        {activeTab === 'store' && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="border-b pb-6">
              <h3 className="text-base font-bold text-slate-800 mb-1">شعار المحل (Logo)</h3>
              <p className="text-xs text-slate-500 mb-4">يظهر الشعار في أعلى الفواتير الحرارية، كروت الصيانة، وشريط النظام العلوي.</p>
              
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative h-28 w-28 rounded-2xl border-2 border-dashed border-slate-300 p-2 flex items-center justify-center bg-slate-50 overflow-hidden shadow-inner">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Store Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Store className="h-10 w-10 text-slate-400" />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 cursor-pointer border border-slate-300 transition">
                    <Upload className="h-4 w-4 text-blue-600" />
                    <span>رفع لوجو المحل من الجهاز</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, logoUrl: '/logo.jpeg' })}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>استعادة اللوجو الافتراضي</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المحل (بالعربي)</label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  placeholder="مثال: البرنس فون لتجارة الهواتف"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المحل (بالإنجليزي - اختياري)</label>
                <input
                  type="text"
                  value={formData.storeNameEn}
                  onChange={(e) => setFormData({ ...formData, storeNameEn: e.target.value })}
                  placeholder="مثال: El-Prince Mobile Store"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم هاتف المحل الأساسي (كاشير/مبيعات)</label>
                <input
                  type="text"
                  value={formData.phone1}
                  onChange={(e) => setFormData({ ...formData, phone1: e.target.value })}
                  placeholder="01012345678"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm font-mono focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم هاتف إضافي (اختياري)</label>
                <input
                  type="text"
                  value={formData.phone2}
                  onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                  placeholder="01298765432"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm font-mono focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الواتساب الرسمي لخدمة العملاء</label>
                <input
                  type="text"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="01012345678"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm font-mono focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العملة الافتراضية</label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="ج.م"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوان المحل وموقعه الجغرافي</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="مثال: القاهرة - شارع التحرير الرئيسي أمام محطة المترو"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم السجل التجاري (اختياري)</label>
                <input
                  type="text"
                  value={formData.commercialReg}
                  onChange={(e) => setFormData({ ...formData, commercialReg: e.target.value })}
                  placeholder="987654"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm font-mono focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم البطاقة الضريبية (اختياري)</label>
                <input
                  type="text"
                  value={formData.taxNumber}
                  onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  placeholder="123-456-789"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm font-mono focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: RECEIPT & PRINTING */}
        {activeTab === 'receipt' && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مقاس ورق الطابعة الحرارية</label>
                <select
                  value={formData.paperSize}
                  onChange={(e) => setFormData({ ...formData, paperSize: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm font-bold bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value="80mm">80 ملم (طابعات الفواتير الكبيرة القياسية)</option>
                  <option value="58mm">58 ملم (طابعات الفواتير الصغيرة المحمولة / البلوتوث)</option>
                </select>
              </div>

              <div className="space-y-3 pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoPrintReceipt}
                    onChange={(e) => setFormData({ ...formData, autoPrintReceipt: e.target.checked })}
                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-slate-700">فتح نافذة الطباعة تلقائياً بمجرد إتمام البيع</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showImeiOnReceipt}
                    onChange={(e) => setFormData({ ...formData, showImeiOnReceipt: e.target.checked })}
                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-slate-700">إظهار رقم الـ IMEI أسفل اسم الهاتف في الفاتورة</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">جملة الترحيب أعلى الفاتورة (Header)</label>
                <input
                  type="text"
                  value={formData.receiptHeader}
                  onChange={(e) => setFormData({ ...formData, receiptHeader: e.target.value })}
                  placeholder="أهلاً بكم في محلكم المفضل لخدمات ومبيعات الهواتف الذكية"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">جملة الشكر أسفل الفاتورة (Footer)</label>
                <input
                  type="text"
                  value={formData.receiptFooter}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  placeholder="شكراً لتعاملكم معنا ونتشرف بزيارتكم دائماً"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سياسة الاستبدال والضمان (تظهر بأسفل الفاتورة)</label>
                <textarea
                  rows={2}
                  value={formData.receiptNotes}
                  onChange={(e) => setFormData({ ...formData, receiptNotes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نص إقرار بيع وتنازل الهاتف المستعمل (لحماية المحل قانونياً)
                </label>
                <textarea
                  rows={3}
                  value={formData.usedPhoneLegalDisclaimer}
                  onChange={(e) => setFormData({ ...formData, usedPhoneLegalDisclaimer: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-600 focus:outline-none text-slate-800 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">شروط وإخلاء مسؤولية استلام الصيانة</label>
                <textarea
                  rows={2}
                  value={formData.maintenanceTerms}
                  onChange={(e) => setFormData({ ...formData, maintenanceTerms: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </form>
        )}

        {/* TAB 3: FIREBASE CLOUD SYNC */}
        {activeTab === 'firebase' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between bg-blue-50 border border-blue-200 p-4 rounded-xl">
              <div className="flex gap-3">
                <Cloud className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-blue-900 text-sm">المزامنة السحابية عبر Firebase</h4>
                  <p className="text-xs text-blue-700 mt-1">
                    يعمل النظام <strong>أوفلاين 100%</strong> محلياً دون أي انقطاع. عند تفعيل Firebase، يتم رفع نسخ مشفرة
                    من المعاملات والملخصات للسحابة لمتابعة مبيعات المحل من هاتفك في أي وقت ومن أي مكان.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enableCloudSync}
                  onChange={(e) => setFormData({ ...formData, enableCloudSync: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Firebase API Key</label>
                <input
                  type="text"
                  value={formData.firebaseConfig?.apiKey || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      firebaseConfig: { ...formData.firebaseConfig, apiKey: e.target.value },
                    })
                  }
                  placeholder="AIzaSy..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Project ID</label>
                <input
                  type="text"
                  value={formData.firebaseConfig?.projectId || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      firebaseConfig: { ...formData.firebaseConfig, projectId: e.target.value },
                    })
                  }
                  placeholder="my-mobile-store-pos"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Auth Domain</label>
                <input
                  type="text"
                  value={formData.firebaseConfig?.authDomain || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      firebaseConfig: { ...formData.firebaseConfig, authDomain: e.target.value },
                    })
                  }
                  placeholder="my-mobile-store-pos.firebaseapp.com"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Storage Bucket</label>
                <input
                  type="text"
                  value={formData.firebaseConfig?.storageBucket || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      firebaseConfig: { ...formData.firebaseConfig, storageBucket: e.target.value },
                    })
                  }
                  placeholder="my-mobile-store-pos.appspot.com"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between border-t pt-4 gap-4">
              <div className="text-xs text-slate-500">
                {formData.lastSyncTime
                  ? `آخر مزامنة ناجحة: ${new Date(formData.lastSyncTime).toLocaleString('ar-EG')}`
                  : 'لم تتم المزامنة بعد.'}
              </div>

              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncLoading}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-sm font-bold shadow transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${syncLoading ? 'animate-spin' : ''}`} />
                <span>{syncLoading ? 'جاري المزامنة...' : 'مزامنة البيانات الآن للسحابة'}</span>
              </button>
            </div>

            {syncMessage && (
              <div className="text-xs p-3 rounded-xl bg-slate-100 border text-slate-700 font-semibold">
                {syncMessage}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: BACKUP & RESTORE */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Export Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white mb-4">
                    <Download className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-base text-slate-800 mb-1">تصدير نسخة احتياطية كاملة (Backup)</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    قم بتحميل ملف JSON يحتوي على كامل قاعدة بيانات المحل (الأجهزة، الإكسسوارات، فودافون كاش، الصيانة، الفواتير، والورديات) وحفظها بأمان على فلاشة أو قرص خارجي.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 shadow transition cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>تصدير وتحميل النسخة الاحتياطية</span>
                </button>
              </div>

              {/* Import Card */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600 text-white mb-4">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-base text-slate-800 mb-1">استعادة نسخة احتياطية سابقة (Restore)</h4>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    يمكنك استعادة بيانات المحل بالكامل من ملف Backup تم تصديره مسبقاً في حال تغيير الجهاز أو تثبيت نسخة جديدة للنظام.
                  </p>
                </div>
                <label className="flex items-center justify-center gap-2 w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm py-3 shadow transition cursor-pointer text-center">
                  <Upload className="h-4 w-4" />
                  <span>اختيار ملف النسخة الاحتياطية واستعادتها</span>
                  <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
