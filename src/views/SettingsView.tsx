import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Store,
  Upload,
  Phone,
  Printer,
  FileText,
  Save,
  CheckCircle2,
  Download,
  ShieldAlert,
  RotateCcw,
  Cloud,
  Percent,
  Zap,
  RefreshCw,
  Wifi,
  WifiOff,
  Server,
  Sparkles,
  FolderOpen,
  Camera,
  Terminal,
  AlertCircle,
  Trash2,
  Calendar,
  Database,
  ExternalLink,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { db, seedSampleData } from '../db';
import { triggerPrint, kickCashDrawer } from '../services/printer';
import { syncDataToFirebase } from '../services/firebase';
import { systemLogger } from '../services/logger';
import { backupService } from '../services/backupService';
import { syncService } from '../services/syncService';
import { printerScanner, type DiscoveredPrinter } from '../services/printerScanner';
import { useModal } from '../context/ModalContext';
import { getStoreLogo, DEFAULT_LOGO } from '../constants/logo';
import { UsersView } from './UsersView';
import type { StoreSettings } from '../types';

export const SettingsView: React.FC = () => {
  const currentSettings = useLiveQuery(async () => {
    const s = await db.settings.get(1);
    if (s) return s;
    return await db.settings.toCollection().first();
  });
  const { showAlert, showConfirm, showToast } = useModal();

  const [formData, setFormData] = useState<StoreSettings | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'store' | 'receipt' | 'commissions' | 'backup' | 'logs' | 'users'>('store');
  const [simAmount, setSimAmount] = useState<number>(1000);
  const [availablePrinters, setAvailablePrinters] = useState<DiscoveredPrinter[]>([]);
  const [scanningPrinters, setScanningPrinters] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);
  const [restoringCloud, setRestoringCloud] = useState(false);

  const loadAllPrinters = async () => {
    setScanningPrinters(true);
    try {
      const list = await printerScanner.getAllPrinters();
      setAvailablePrinters(list);
      if (list.length > 0 && formData && !formData.selectedPrinter) {
        const defaultP = list.find((p) => p.isDefault) || list[0];
        setFormData((prev) => (prev ? {
          ...prev,
          selectedPrinter: defaultP.name,
        } : null));
      }
    } catch (err) {
      console.warn('Load printers note:', err);
    } finally {
      setScanningPrinters(false);
    }
  };

  useEffect(() => {
    loadAllPrinters();
  }, []);

  const handleManualBackupNow = async () => {
    const res = await backupService.saveManualBackup();
    if (res.success) {
      showToast(`تم حفظ النسخة الاحتياطية بنجاح: ${res.filename} 💾`);
    } else {
      showAlert('حدث خطأ أثناء حفظ النسخة الاحتياطية.', 'خطأ في النسخ', 'error');
    }
  };

  const handleRestoreFromCloud = async () => {
    const confirm = await showConfirm(
      'سيقوم هذا الإجراء بمزامنة واسترجاع كافة البيانات والعمليات المحفوظة على سحابة Firebase إلى قاعدة البيانات المحلية على هذا الجهاز. هل تريد المتابعة؟',
      'استعادة من السحابة',
      { confirmText: 'بدء الاستعادة', cancelText: 'إلغاء' }
    );
    if (!confirm) return;

    setRestoringCloud(true);
    const res = await syncService.restoreEntireDatabaseFromCloud();
    setRestoringCloud(false);

    if (res.success) {
      showToast(res.message);
    } else {
      showAlert(res.message, 'تنبيه الاستعادة', 'error');
    }
  };

  const handleFullDbReset = async () => {
    const confirm = await showConfirm(
      'تحذير أمني هام: سيتم تصفير وتنظيف كافة معاملات المحل والمخزون والورديات بالكامل.\n\nسيقوم النظام تلقائياً بإنشاء نسخة احتياطية آمنة في مجلد السجلات قبل المسح. هل أنت متأكد؟',
      'تصفير قاعدة البيانات',
      { danger: true, confirmText: 'نعم، تصفير الآن', cancelText: 'تراجع' }
    );
    if (!confirm) return;

    setResettingDb(true);
    syncService.muteSync();
    try {
      const res = await backupService.fullDatabaseResetWithMandatoryBackup();
      if (res.success) {
        await showAlert(
          `تم تصفير وتنظيف قاعدة البيانات بنجاح!\nتم حفظ نسخة الأمان الإلزامية في مجلد النسخ الاحتياطية:\n${res.backupPath || '~/elghandour-pos-backups/'}`,
          'تم التصفير بنجاح',
          'info'
        );
        window.location.reload();
      } else {
        showAlert('حدث خطأ أثناء تصفير قاعدة البيانات.', 'خطأ', 'error');
      }
    } finally {
      syncService.unmuteSync();
      setResettingDb(false);
    }
  };

  useEffect(() => {
    if (currentSettings) {
      setFormData(currentSettings);
    }
  }, [currentSettings]);

  if (!formData) {
    return <div className="p-8 text-center text-slate-500 font-bold">جاري تحميل إعدادات المحل...</div>;
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setFormData((prev) => (prev ? { ...prev, logoUrl: base64 } : null));
        await db.settings.update(1, { logoUrl: base64 });
        showToast('تم رفع وتطبيق الشعار الجديد بنجاح في جميع الشاشات والفواتير! 🖼️');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData) return;
    await db.settings.put({ ...formData, id: 1 });
    syncDataToFirebase().catch(console.warn);
    setSavedSuccess(true);
    showToast('تم حفظ إعدادات وقواعد المحل وتطبيقها فوراً في شاشة الكاش!');
    setTimeout(() => setSavedSuccess(false), 3000);
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
    showToast('تم تصدير النسخة الاحتياطية وتنزيلها بأمان');
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = await showConfirm(
      'تحذير هام: استعادة النسخة الاحتياطية ستستبدل البيانات الحالية في النظام.\nهل أنت متأكد من المتابعة؟',
      'تأكيد استعادة النسخة الاحتياطية',
      { confirmText: 'نعم، استعد البيانات', cancelText: 'إلغاء', danger: true }
    );

    if (!confirmed) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        await db.transaction(
          'rw',
          [
            db.settings,
            db.users,
            db.phones,
            db.accessories,
            db.wallets,
            db.walletTransactions,
            db.invoices,
            db.repairs,
            db.shifts,
            db.expenses,
            db.customers,
            db.suppliers,
          ],
          async () => {
            if (data.settings?.length) {
              await db.settings.clear();
              await db.settings.bulkPut(data.settings);
            }
            if (data.users?.length) {
              await db.users.clear();
              await db.users.bulkPut(data.users);
            }
            if (data.phones?.length) {
              await db.phones.clear();
              await db.phones.bulkPut(data.phones);
            }
            if (data.accessories?.length) {
              await db.accessories.clear();
              await db.accessories.bulkPut(data.accessories);
            }
            if (data.wallets?.length) {
              await db.wallets.clear();
              await db.wallets.bulkPut(data.wallets);
            }
            if (data.invoices?.length) {
              await db.invoices.clear();
              await db.invoices.bulkPut(data.invoices);
            }
            if (data.repairs?.length) {
              await db.repairs.clear();
              await db.repairs.bulkPut(data.repairs);
            }
            if (data.shifts?.length) {
              await db.shifts.clear();
              await db.shifts.bulkPut(data.shifts);
            }
            if (data.customers?.length) {
              await db.customers.clear();
              await db.customers.bulkPut(data.customers);
            }
            if (data.suppliers?.length) {
              await db.suppliers.clear();
              await db.suppliers.bulkPut(data.suppliers);
            }
          }
        );
        await showAlert('تمت استعادة البيانات والنسخة الاحتياطية بنجاح!', 'تمت العملية', 'success');
      } catch (err) {
        await showAlert('حدث خطأ أثناء قراءة ملف النسخة الاحتياطية. يرجى التأكد من صحة الملف.', 'فشلت الاستعادة', 'error');
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
            <h1 className="font-display text-2xl font-black text-slate-800">تخصيص وهوية المحل</h1>
            <p className="text-sm text-slate-500">
              تحكم كامل في اسم المحل، اللوجو، الفواتير، الطباعة الحرارية، والنسخ الاحتياطي
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-md transition hover:bg-blue-700 active:scale-95 cursor-pointer text-xs sm:text-sm"
        >
          <Save className="h-5 w-5" />
          <span>حفظ التعديلات</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span className="font-semibold text-sm">تم حفظ إعدادات المحل بنجاح وتطبيقها في جميع الشاشات.</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-2 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('store')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'store'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Store className="h-4 w-4" />
          <span>بيانات وهوية المحل</span>
        </button>
        <button
          onClick={() => setActiveTab('receipt')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'receipt'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Printer className="h-4 w-4" />
          <span>إعدادات الفواتير والطباعة</span>
        </button>
        <button
          onClick={() => setActiveTab('commissions')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'commissions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Percent className="h-4 w-4" />
          <span>عمولات الكاش والتحويلات</span>
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'backup'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Download className="h-4 w-4" />
          <span>النسخ الاحتياطي والأمان</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderOpen className="h-4 w-4" />
          <span>سجلات النظام والتشغيل (Logs)</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>المستخدمون والصلاحيات والحسابات</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="bg-white rounded-b-2xl p-6 shadow-xs border-x border-b border-slate-200">
        {/* TAB 1: STORE INFO */}
        {activeTab === 'store' && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="relative h-24 w-24 rounded-2xl border-2 border-dashed border-slate-300 p-2 bg-white flex items-center justify-center overflow-hidden shadow-xs">
                <img
                  src={getStoreLogo(formData.logoUrl)}
                  alt="Logo"
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_LOGO;
                  }}
                />
              </div>

              <div className="flex-1 text-center sm:text-right space-y-2">
                <h4 className="font-bold text-sm text-slate-800">شعار المحل (Logo)</h4>
                <p className="text-xs text-slate-500">
                  يظهر هذا الشعار على رأس الفواتير الورقية وعقود البيع والشريط العلوي للنظام فور رفعه.
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  <label className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer">
                    <Upload className="h-3.5 w-3.5 text-blue-600" />
                    <span>تغيير الشعار</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {formData.logoUrl && formData.logoUrl !== DEFAULT_LOGO && (
                    <button
                      type="button"
                      onClick={async () => {
                        setFormData({ ...formData, logoUrl: DEFAULT_LOGO });
                        await db.settings.update(1, { logoUrl: DEFAULT_LOGO });
                        showToast('تمت استعادة الشعار الأصلي بنجاح');
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-red-600 cursor-pointer"
                    >
                      استعادة الشعار الأصلي
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المحل باللغة العربية *</label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  placeholder="مثال: البرنس لمهمات المحمول"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المحل بالإنجليزية (اختياري)</label>
                <input
                  type="text"
                  value={formData.storeNameEn}
                  onChange={(e) => setFormData({ ...formData, storeNameEn: e.target.value })}
                  placeholder="Smart Mobile Store"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف الأساسي (خدمة العملاء) *</label>
                <input
                  type="text"
                  value={formData.phone1}
                  onChange={(e) => setFormData({ ...formData, phone1: e.target.value })}
                  placeholder="010xxxxxxxx"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف الإضافي / واتساب</label>
                <input
                  type="text"
                  value={formData.phone2}
                  onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                  placeholder="011xxxxxxxx"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">العنوان بالتفصيل</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="المدينة - الشارع - علامة مميزة"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الرقم الضريبي (إن وجد)</label>
                <input
                  type="text"
                  value={formData.taxNumber}
                  onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  placeholder="123-456-789"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السجل التجاري (إن وجد)</label>
                <input
                  type="text"
                  value={formData.commercialReg}
                  onChange={(e) => setFormData({ ...formData, commercialReg: e.target.value })}
                  placeholder="987654"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: RECEIPT SETTINGS */}
        {activeTab === 'receipt' && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العملة الافتراضية</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value="ج.م">جنيه مصري (ج.م)</option>
                  <option value="ر.س">ريال سعودي (ر.س)</option>
                  <option value="د.إ">درهم إماراتي (د.إ)</option>
                  <option value="$">دولار ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مقاس ورق الطابعة الحرارية</label>
                <select
                  value={formData.paperSize}
                  onChange={(e) => setFormData({ ...formData, paperSize: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value="80mm">طابعة كاشير 80 مم (الافتراضي والمعياري)</option>
                  <option value="58mm">طابعة كاشير صغيرة 58 مم</option>
                </select>
              </div>

              <div className="flex flex-col justify-center space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.autoPrintReceipt}
                    onChange={(e) => setFormData({ ...formData, autoPrintReceipt: e.target.checked })}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span>فتح نافذة الطباعة تلقائياً عند إتمام البيع</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.showImeiOnReceipt}
                    onChange={(e) => setFormData({ ...formData, showImeiOnReceipt: e.target.checked })}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span>طباعة رقم الـ IMEI على فاتورة الهاتف</span>
                </label>
              </div>
            </div>

            {/* Hardware Printers Engine Panel (Native Desktop & OS Spooler) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md border border-slate-700/60 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Printer className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-white flex items-center gap-2">
                      محرك طابعات الفواتير وملصقات الباركود
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                        {availablePrinters.length} طابعة مكتشفة
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      طباعة صامتة ومباشرة عبر طابعات النظام الرسمية مع دعم فتح درج الكاشير وطباعة الباركود.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={loadAllPrinters}
                    disabled={scanningPrinters}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${scanningPrinters ? 'animate-spin text-blue-400' : ''}`} />
                    <span>{scanningPrinters ? 'جاري الفحص...' : 'تحديث قائمة الطابعات'}</span>
                  </button>
                </div>
              </div>

              {/* Printer Selection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-700/40 text-xs">
                {/* 1. Thermal Receipt Printer */}
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">
                    🖨️ طابعة إيصالات الكاشير الحرارية (80mm / 58mm)
                  </label>
                  <select
                    value={formData.selectedPrinter || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        selectedPrinter: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-slate-800 border border-slate-600 p-2.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- الطابعة الافتراضية للنظام --</option>
                    {availablePrinters.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName} {p.isDefault ? '(الافتراضية)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    الطابعة المستخدمة في طباعة فواتير المبيعات وتقارير الوردية وإيصالات الصيانة.
                  </p>
                </div>

                {/* 2. Barcode Label Printer */}
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">
                    🏷️ طابعة ملصقات واستيكرات الباركود (Barcode Printer)
                  </label>
                  <select
                    value={formData.barcodePrinter || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        barcodePrinter: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-slate-800 border border-slate-600 p-2.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- نفس طابعة الكاشير / افتراضية النظام --</option>
                    {availablePrinters.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    طابعة الرول المخصصة لملصقات المنتجات (Xprinter, TSC, Zebra, Rongta, etc.).
                  </p>
                </div>

                {/* 3. Silent Print Toggle */}
                <div className="md:col-span-2 pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={formData.silentPrintEnabled ?? true}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          silentPrintEnabled: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded text-blue-600 bg-slate-800 border-slate-600 focus:ring-0"
                    />
                    <span>تفعيل الطباعة الصامتة المباشرة (Direct Silent Print)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    طباعة فورية إلى طابعات الكاشير والباركود بدون فتح نوافذ منبثقة أو حوارات اختيار الطابعة.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    const kicked = await kickCashDrawer(formData.selectedPrinter);
                    if (kicked) {
                      showToast('تم إرسال نبضة فتح درج الكاشير بنجاح! ⚡');
                    } else {
                      showToast('تم إرسال أمر فتح الدرج عبر الطابعة');
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>فتح درج الكاشير</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerPrint({
                      type: 'sale_receipt',
                      invoice: {
                        id: 'test_inv',
                        invoiceNumber: 'TEST-0001',
                        shiftId: 'shift_1',
                        cashierName: 'كاشير تجريبي',
                        customerName: 'عميل تجريبي',
                        customerPhone: '01012345678',
                        items: [
                          { itemId: '1', type: 'accessory', name: 'شاحن سريع 20W', quantity: 1, unitPrice: 250, totalPrice: 250, costPrice: 150 },
                          { itemId: '2', type: 'accessory', name: 'كابل شحن Type-C', quantity: 2, unitPrice: 50, totalPrice: 100, costPrice: 30 },
                        ],
                        subtotal: 350,
                        discount: 0,
                        tax: 0,
                        total: 350,
                        paidAmount: 350,
                        remainingAmount: 0,
                        paymentMethod: 'cash',
                        totalProfit: 140,
                        status: 'completed',
                        createdAt: new Date().toISOString(),
                      },
                      settings: formData,
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>طباعة فاتورة تجريبية</span>
                </button>
              </div>
            </div>


            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رسالة الترحيب في رأس الفاتورة</label>
                <input
                  type="text"
                  value={formData.receiptHeader}
                  onChange={(e) => setFormData({ ...formData, receiptHeader: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رسالة الشكر أسفل الفاتورة</label>
                <input
                  type="text"
                  value={formData.receiptFooter}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات وسياسة الاسترجاع بالفاتورة</label>
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

        {/* TAB 3: COMMISSIONS & FEES CONFIGURATION */}
        {activeTab === 'commissions' && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-5 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <Percent className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-base">
                    قواعد احتساب عمولات الكاش والتحويلات الذكية
                  </h3>
                  <p className="text-xs text-slate-600">
                    حدد عمولة المحل لكل 1000 جنيه والحد الأدنى لأي عملية، وسيقوم النظام باحتساب العمولة تلقائياً عند كتابة المبلغ.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1. Cash Out (المحل يحول للعميل) */}
              <div className="rounded-2xl border-2 border-red-200 bg-red-50/30 p-5 space-y-4">
                <div className="flex items-center gap-2 text-red-700 font-display font-black text-sm border-b border-red-200 pb-2">
                  <Zap className="h-4 w-4" />
                  <span>تحويل كاش للعميل (المحل يحول)</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    العمولة لكل 1000 جنيه (ج.م):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.commissionRules?.transferFeePerThousand ?? 10}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commissionRules: {
                          ...(formData.commissionRules || {
                            transferFeePerThousand: 10,
                            minTransferFee: 5,
                            withdrawFeePerThousand: 10,
                            minWithdrawFee: 5,
                            instapayFeePerThousand: 5,
                            minInstapayFee: 5,
                          }),
                          transferFeePerThousand: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full bg-white rounded-xl border border-red-300 p-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-red-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">مثلاً: 10 ج على كل 1000 ج</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الحد الأدنى للعمولة (أقل مبلغ ربح):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.commissionRules?.minTransferFee ?? 5}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commissionRules: {
                          ...(formData.commissionRules || {
                            transferFeePerThousand: 10,
                            minTransferFee: 5,
                            withdrawFeePerThousand: 10,
                            minWithdrawFee: 5,
                            instapayFeePerThousand: 5,
                            minInstapayFee: 5,
                          }),
                          minTransferFee: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full bg-white rounded-xl border border-red-300 p-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-red-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">أقل عمولة للعمليات الصغيرة (مثلاً 5 ج)</span>
                </div>
              </div>

              {/* 2. Cash In (العميل يحول للمحل ونعطيه كاش) */}
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 p-5 space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 font-display font-black text-sm border-b border-emerald-200 pb-2">
                  <Zap className="h-4 w-4" />
                  <span>سحب كاش من العميل (العميل يحول)</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    العمولة لكل 1000 جنيه (ج.م):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.commissionRules?.withdrawFeePerThousand ?? 10}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commissionRules: {
                          ...(formData.commissionRules || {
                            transferFeePerThousand: 10,
                            minTransferFee: 5,
                            withdrawFeePerThousand: 10,
                            minWithdrawFee: 5,
                            instapayFeePerThousand: 5,
                            minInstapayFee: 5,
                          }),
                          withdrawFeePerThousand: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full bg-white rounded-xl border border-emerald-300 p-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">مثلاً: 10 ج على كل 1000 ج</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الحد الأدنى للعمولة (أقل مبلغ ربح):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.commissionRules?.minWithdrawFee ?? 5}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commissionRules: {
                          ...(formData.commissionRules || {
                            transferFeePerThousand: 10,
                            minTransferFee: 5,
                            withdrawFeePerThousand: 10,
                            minWithdrawFee: 5,
                            instapayFeePerThousand: 5,
                            minInstapayFee: 5,
                          }),
                          minWithdrawFee: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full bg-white rounded-xl border border-emerald-300 p-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">أقل عمولة للعمليات الصغيرة (مثلاً 5 ج)</span>
                </div>
              </div>

              {/* 3. InstaPay */}
              <div className="rounded-2xl border-2 border-purple-200 bg-purple-50/30 p-5 space-y-4">
                <div className="flex items-center gap-2 text-purple-700 font-display font-black text-sm border-b border-purple-200 pb-2">
                  <Zap className="h-4 w-4" />
                  <span>تحويلات إنستاباي (InstaPay)</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    العمولة لكل 1000 جنيه (ج.م):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.commissionRules?.instapayFeePerThousand ?? 5}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commissionRules: {
                          ...(formData.commissionRules || {
                            transferFeePerThousand: 10,
                            minTransferFee: 5,
                            withdrawFeePerThousand: 10,
                            minWithdrawFee: 5,
                            instapayFeePerThousand: 5,
                            minInstapayFee: 5,
                          }),
                          instapayFeePerThousand: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full bg-white rounded-xl border border-purple-300 p-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">مثلاً: 5 ج على كل 1000 ج</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الحد الأدنى للعمولة (أقل مبلغ ربح):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.commissionRules?.minInstapayFee ?? 5}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commissionRules: {
                          ...(formData.commissionRules || {
                            transferFeePerThousand: 10,
                            minTransferFee: 5,
                            withdrawFeePerThousand: 10,
                            minWithdrawFee: 5,
                            instapayFeePerThousand: 5,
                            minInstapayFee: 5,
                          }),
                          minInstapayFee: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full bg-white rounded-xl border border-purple-300 p-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">أقل عمولة للعمليات الصغيرة (مثلاً 5 ج)</span>
                </div>
              </div>
            </div>

            {/* Live Rate Simulator Box */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span>محاكي فوري لحساب العمولات (Live Rate Simulator):</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    جرب كتابة أي مبلغ لتتأكد من الحسبة والنسبة قبل الحفظ
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">مبلغ التجربة:</span>
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1">
                    <input
                      type="number"
                      value={simAmount}
                      onChange={(e) => setSimAmount(parseFloat(e.target.value) || 0)}
                      className="w-20 text-center font-mono font-bold text-xs focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-400">ج.م</span>
                  </div>
                </div>
              </div>

              {/* 3 Sim Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* 1. Cash out sim */}
                {(() => {
                  const perThousand = formData.commissionRules?.transferFeePerThousand ?? 10;
                  const minFee = formData.commissionRules?.minTransferFee ?? 5;
                  const fee = simAmount > 0 ? Math.max(minFee, Math.ceil((simAmount / 1000) * perThousand)) : 0;
                  const pct = simAmount > 0 ? ((fee / simAmount) * 100).toFixed(1) : '0';
                  return (
                    <div className="p-3 bg-red-50/60 rounded-xl border border-red-200/80">
                      <strong className="text-red-900 block mb-1">تحويل كاش للعميل</strong>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">عمولة المحل:</span>
                        <strong className="text-red-700">{fee} ج ({pct}%)</strong>
                      </div>
                      <div className="flex justify-between font-mono mt-1 text-[11px]">
                        <span className="text-slate-500">المحل يستلم:</span>
                        <span className="font-bold text-slate-800">{simAmount + fee} ج</span>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Cash in sim */}
                {(() => {
                  const perThousand = formData.commissionRules?.withdrawFeePerThousand ?? 10;
                  const minFee = formData.commissionRules?.minWithdrawFee ?? 5;
                  const fee = simAmount > 0 ? Math.max(minFee, Math.ceil((simAmount / 1000) * perThousand)) : 0;
                  const pct = simAmount > 0 ? ((fee / simAmount) * 100).toFixed(1) : '0';
                  return (
                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
                      <strong className="text-emerald-900 block mb-1">سحب كاش من العميل</strong>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">عمولة المحل:</span>
                        <strong className="text-emerald-700">{fee} ج ({pct}%)</strong>
                      </div>
                      <div className="flex justify-between font-mono mt-1 text-[11px]">
                        <span className="text-slate-500">المحل يسلم كاش:</span>
                        <span className="font-bold text-slate-800">{simAmount - fee} ج</span>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Instapay sim */}
                {(() => {
                  const perThousand = formData.commissionRules?.instapayFeePerThousand ?? 5;
                  const minFee = formData.commissionRules?.minInstapayFee ?? 5;
                  const fee = simAmount > 0 ? Math.max(minFee, Math.ceil((simAmount / 1000) * perThousand)) : 0;
                  const pct = simAmount > 0 ? ((fee / simAmount) * 100).toFixed(1) : '0';
                  return (
                    <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/80">
                      <strong className="text-purple-900 block mb-1">تحويل إنستاباي</strong>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">عمولة المحل:</span>
                        <strong className="text-purple-700">{fee} ج ({pct}%)</strong>
                      </div>
                      <div className="flex justify-between font-mono mt-1 text-[11px]">
                        <span className="text-slate-500">المحل يستلم:</span>
                        <span className="font-bold text-slate-800">{simAmount + fee} ج</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Bottom Save Action Button */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500 font-medium">
                يتم تطبيق هذه القواعد تلقائياً في شاشات فودافون كاش ومحافظ المحل وتُزامن سحابياً.
              </span>
              <button
                type="submit"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-6 py-3 font-bold text-xs shadow-md transition cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>حفظ وتطبيق قواعد العمولات الآن</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: BACKUP & RESTORE & DATABASE MANAGEMENT */}
        {activeTab === 'backup' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Storage Info Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-l from-slate-900 to-slate-800 p-5 text-white shadow-md">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">مسار قاعدة البيانات والنسخ الاحتياطية</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    البيانات مستقرة في مسار دائم: <code className="bg-slate-950 px-2 py-0.5 rounded text-emerald-300 font-mono">~/.elghandour-pos-data/</code> لا تتأثر بتحديث التطبيق.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualBackupNow}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs px-4 py-2.5 shadow transition cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>أخذ نسخة بيكاب الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => backupService.openBackupsFolder()}
                  title="فتح مجلد النسخ الاحتياطية (~/elghandour-pos-backups/)"
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs px-3 py-2.5 transition cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>مجلد النسخ</span>
                </button>
              </div>
            </div>

            {/* Grid of Backup Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Weekly Auto-Backup Status */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                      تلقائي كل أسبوع
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1">النسخ الاحتياطي الدوري التلقائي</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    يقوم النظام تلقائياً كل أسبوع بإنشاء نسخة احتياطية كاملة وتخزينها في مجلد مخصص بتاريخ الأسبوع داخل مجلد النسخ.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 font-semibold">
                  آخر نسخة دورية: {formData.lastWeeklyBackupDate ? new Date(formData.lastWeeklyBackupDate).toLocaleDateString('ar-EG') : 'جاري الفحص التلقائي'}
                </div>
              </div>

              {/* 2. Firebase Cloud 2-Way Restore */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                      <Cloud className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                      سحابة Firebase
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1">استعادة كاملة من السحابة</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    مزامنة وتنزيل كافة بيانات المحل (الأجهزة، الإكسسوارات، فودافون كاش، الصيانة، الفواتير) من السحابة إلى هذا الجهاز مباشرة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreFromCloud}
                  disabled={restoringCloud}
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs py-2.5 shadow transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${restoringCloud ? 'animate-spin' : ''}`} />
                  <span>{restoringCloud ? 'جاري الاسترجاع...' : 'استعادة ومزامنة من السحابة'}</span>
                </button>
              </div>

              {/* 3. Custom File Import/Restore */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <RotateCcw className="h-5 w-5" />
                    </div>
                    <span className="text-xs text-slate-400 font-bold">ملف محلي (JSON)</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1">استيراد ملف نسخة احتياطية</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    حدد ملف نسخة احتياطية محفوظ على جهازك لاسترجاعه يدوياً بالكامل.
                  </p>
                </div>
                <label className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs py-2.5 shadow transition cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  <span>تحديد ملف النسخة للاستعادة</span>
                  <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                </label>
              </div>
            </div>

            {/* DANGER ZONE: CLEAN FULL RESET */}
            <div className="rounded-2xl border border-red-200 bg-red-50/40 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-red-700 font-black text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>منطقة الخطر: تصفير وتنظيف قاعدة البيانات بالكامل (Clean Full Reset)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                    يقوم هذا الإجراء بمسح كافة المعاملات والمخزون والفواتير والورديات وإعادة النظام نظيفاً.
                    <span className="font-bold text-red-700 mr-1">
                      حفاظاً على بياناتك، يقوم النظام تلقائياً وقبل المسح بإنشاء نسخة احتياطية كاملة وتخزينها في مجلد النسخ الاحتياطية.
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleFullDbReset}
                  disabled={resettingDb}
                  className="flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs px-5 py-3 shadow-md shadow-red-600/20 transition cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{resettingDb ? 'جاري النسخ والتصفير...' : 'تصفير وتنظيف قاعدة البيانات'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: System Logs & Audit Files */}
        {activeTab === 'logs' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header & Open Folder Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-l from-slate-900 to-slate-800 p-6 text-white shadow-md">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/30 text-blue-400 border border-blue-500/30 shrink-0">
                  <Terminal className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">سجلات تشغيل النظام والطباعة والأخطاء</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    يتم تخزين السجلات محلياً ومباشرة داخل مجلد <code className="bg-slate-950 px-2 py-0.5 rounded text-blue-300 font-mono">~/elghandour-pos-logs/</code>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => systemLogger.openLogsFolder()}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm px-6 py-3 shadow-lg shadow-blue-600/30 transition cursor-pointer shrink-0"
              >
                <FolderOpen className="h-5 w-5" />
                <span>فتح مجلد السجلات في جهازك</span>
              </button>
            </div>

            {/* 4 Dedicated Log Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Init and DB Log */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 hover:border-blue-300 transition flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="rounded-lg bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-1">
                      init-and-db.log
                    </span>
                    <span className="text-xs text-slate-400 font-medium">سجل التهيأة والقاعدة</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1.5">تهيئة النظام وقاعدة البيانات المحلية</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    يسجل عمليات بدء تشغيل التطبيق، فتح جداول IndexedDB / Dexie، تهيئة الوردية الافتتاحية، وأي تعارضات أو أخطاء تطرأ أثناء التهيأة.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-400">
                  <span>المسار: <code className="font-mono text-slate-600">elghandour-pos-logs/init-and-db.log</code></span>
                </div>
              </div>

              {/* 2. Printer Log */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 hover:border-blue-300 transition flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1">
                      printer.log
                    </span>
                    <span className="text-xs text-slate-400 font-medium">سجل الطباعة الحرارية</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1.5">محاولات وعمليات الطباعة</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    يسجل كافة أوامر الطباعة المباشرة والصامتة (ESC/POS)، واكتشاف الطابعات، وحالة نجاح أو فشل كل عملية طباعة.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-400">
                  <span>المسار: <code className="font-mono text-slate-600">elghandour-pos-logs/printer.log</code></span>
                </div>
              </div>

              {/* 3. Invoice Previews Directory */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 hover:border-blue-300 transition flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="rounded-lg bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-1">
                      invoice-previews/
                    </span>
                    <span className="text-xs text-slate-400 font-medium">مجلد لقطات الفواتير</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1.5">لقطات شاشة الفواتير المطبوعة (Screenshots)</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    مجلد مخصص يتم فيه حفظ صورة شاشة عالية الدقة (.png) وملف HTML مستقل لكل فاتورة أو إيصال أو تقرير وردية يتم طباعته في المحل تلقائياً للرجوع إليه.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-400">
                  <span>المسار: <code className="font-mono text-slate-600">elghandour-pos-logs/invoice-previews/</code></span>
                </div>
              </div>

              {/* 4. System Errors Log */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 hover:border-blue-300 transition flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="rounded-lg bg-rose-100 text-rose-800 text-xs font-black px-2.5 py-1">
                      system-errors.log
                    </span>
                    <span className="text-xs text-slate-400 font-medium">سجل أخطاء وتوقفات النظام</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1.5">تتبع الأعطال والاستثناءات (Crashes)</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    يسجل فوراً أي خطأ برمجي غير متوقع في الواجهة أو في عمليات المعالجة أو في Electron مع بيانات الـ Stack كاملة لحل المشكلة فورياً.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-400">
                  <span>المسار: <code className="font-mono text-slate-600">elghandour-pos-logs/system-errors.log</code></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: USERS & PERMISSIONS */}
        {activeTab === 'users' && (
          <div className="pt-2">
            <UsersView />
          </div>
        )}
      </div>
    </div>
  );
};
