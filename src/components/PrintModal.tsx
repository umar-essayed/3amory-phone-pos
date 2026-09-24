import React, { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, Download, ShieldCheck, Camera, FolderOpen, CheckCircle } from 'lucide-react';
import type { PrintData } from '../services/printer';
import { systemLogger } from '../services/logger';
import { getStoreLogo, DEFAULT_LOGO } from '../constants/logo';
import { DEFAULT_SETTINGS } from '../db';

const safeFormatDate = (d?: string) => {
  if (!d) return '-';
  try {
    const date = new Date(d);
    return isNaN(date.getTime()) ? '-' : date.toLocaleString('ar-EG');
  } catch {
    return '-';
  }
};

export const PrintModal: React.FC = () => {
  const [activePrint, setActivePrint] = useState<PrintData | null>(null);
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const handlePrintEvent = (e: CustomEvent<PrintData>) => {
      setActivePrint(e.detail);
    };

    window.addEventListener('mobile-pos-print' as any, handlePrintEvent);
    return () => {
      window.removeEventListener('mobile-pos-print' as any, handlePrintEvent);
    };
  }, []);

  const [viewMode, setViewMode] = useState<'expanded' | 'roll'>('expanded');

  if (!activePrint) return null;

  const { type, invoice, walletTx, repair, phone, shift, accessory } = activePrint;
  const settings = { ...DEFAULT_SETTINGS, ...(activePrint.settings || {}) };
  const rollWidth = (settings.paperSize || '80mm') === '58mm' ? 'max-w-[58mm]' : 'max-w-[80mm]';
  const previewWidth =
    type === 'used_phone_contract'
      ? 'max-w-2xl'
      : viewMode === 'roll'
      ? rollWidth
      : 'max-w-md sm:max-w-lg';

  const [isCapturing, setIsCapturing] = useState(false);
  const [snapshotSaved, setSnapshotSaved] = useState(false);

  const captureAndSaveSnapshot = async () => {
    const printAreaEl = document.querySelector('.print-area') as HTMLElement;
    if (!printAreaEl) return;
    setIsCapturing(true);
    try {
      const invNumber = invoice?.invoiceNumber || walletTx?.id || repair?.ticketNumber || `DOC_${Date.now()}`;
      await systemLogger.saveInvoiceSnapshot({
        invoiceNumber: invNumber,
        element: printAreaEl,
        metadata: {
          type,
          timestamp: new Date().toISOString(),
          cashier: invoice?.cashierName || shift?.cashierName,
        },
      });
      setSnapshotSaved(true);
      setTimeout(() => setSnapshotSaved(false), 3000);
    } catch (err) {
      console.warn('Snapshot capture note:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleExecutePrint = () => {
    systemLogger.logPrinter({
      message: 'تنفيذ أمر الطباعة',
      docType: type,
      printerName: settings.paperSize,
    });
    // Fire-and-forget non-blocking snapshot capture
    setTimeout(() => {
      captureAndSaveSnapshot().catch(() => {});
    }, 200);
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs no-print">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3.5 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">معاينة المستند والطباعة</h3>
              <p className="text-xs text-slate-500 font-semibold">
                طابعة: {settings.paperSize} | المحل: {settings.storeName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {type !== 'used_phone_contract' && (
              <div className="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode('expanded')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    viewMode === 'expanded' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  عرض متسع
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('roll')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    viewMode === 'roll' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  حجم الرول ({settings.paperSize})
                </button>
              </div>
            )}

            {/* Manual Screenshot button */}
            <button
              type="button"
              onClick={captureAndSaveSnapshot}
              disabled={isCapturing}
              title="حفظ لقطة شاشة للفاتورة في مجلد السجلات (invoice-previews/)"
              className="flex items-center gap-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-300/80 px-3 py-2 text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              {snapshotSaved ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <Camera className="h-4 w-4 text-slate-600" />}
              <span className="hidden sm:inline">{snapshotSaved ? 'تم حفظ اللقطة!' : 'حفظ لقطة'}</span>
            </button>

            {/* Open logs folder button */}
            <button
              type="button"
              onClick={() => systemLogger.openLogsFolder()}
              title="فتح مجلد سجلات ولقطات الفواتير (~/elghandour-pos-logs)"
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer"
            >
              <FolderOpen className="h-4 w-4" />
            </button>

            <button
              onClick={handleExecutePrint}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-blue-700 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة فورية</span>
            </button>
            <button
              onClick={() => setActivePrint(null)}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Preview Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 flex justify-center">
          <div
            className={`print-area w-full ${previewWidth} rounded-2xl bg-white p-5 sm:p-6 shadow-xl border border-slate-200 text-slate-900 text-sm transition-all duration-200 overflow-hidden box-border`}
            style={{ paddingRight: '6mm', direction: 'rtl' }}
          >
            
            {/* === RECEIPT HEADER (STORE BRANDING) === */}
            <div className="text-center pb-4 border-b border-dashed border-slate-300">
              <div className="flex justify-center mb-2">
                <img
                  src={getStoreLogo(settings.logoUrl)}
                  alt={settings.storeName}
                  className="h-16 w-auto max-w-[140px] object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_LOGO;
                  }}
                />
              </div>
              <h2 className="text-xl font-black text-slate-900">{settings.storeName}</h2>
              {settings.storeNameEn && (
                <p className="text-xs font-semibold text-slate-500">{settings.storeNameEn}</p>
              )}
              <div className="mt-2 text-xs space-y-0.5 text-slate-600">
                <p>{settings.address}</p>
                <p>هاتف: {settings.phone1} {settings.phone2 && `| ${settings.phone2}`}</p>
                {settings.whatsapp && <p>واتساب: {settings.whatsapp}</p>}
                {settings.taxNumber && <p>س.ت: {settings.commercialReg} | ب.ض: {settings.taxNumber}</p>}
              </div>
              {settings.receiptHeader && (
                <p className="mt-2 text-[11px] font-medium text-slate-700 italic bg-slate-50 p-1.5 rounded">
                  {settings.receiptHeader}
                </p>
              )}
            </div>

            {/* === TYPE: SALE RECEIPT === */}
            {type === 'sale_receipt' && invoice && (
              <div className="pt-3 space-y-3">
                <div className="flex justify-between text-xs border-b pb-2 text-slate-600">
                  <span>رقم الفاتورة: <strong className="text-slate-900 font-mono">{invoice.invoiceNumber}</strong></span>
                  <span>{new Date(invoice.createdAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {invoice.customerName && (
                  <div className="text-xs">
                    <span className="text-slate-500">العميل:</span> <strong>{invoice.customerName}</strong> {invoice.customerPhone && `(${invoice.customerPhone})`}
                  </div>
                )}
                <div className="text-xs text-slate-500">الكاشير: {invoice.cashierName}</div>

                {/* Items Table */}
                <table className="w-full text-xs text-right border-collapse mt-2">
                  <thead>
                    <tr className="border-b border-slate-300 font-bold text-slate-700">
                      <th className="py-1.5 pr-1 text-right">الصنف</th>
                      <th className="py-1.5 px-2 text-center w-14">الكمية</th>
                      <th className="py-1.5 pl-1 text-left w-24">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-1">
                          <div className="font-semibold text-slate-900 break-words">{item.name}</div>
                          {settings.showImeiOnReceipt && item.imei && (
                            <div className="text-[10px] font-mono text-slate-500 break-all">IMEI: {item.imei}</div>
                          )}
                          <div className="text-[10px] text-slate-400">{item.unitPrice.toLocaleString()} {settings.currency}</div>
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold text-slate-800">{item.quantity}</td>
                        <td className="py-2 pl-1 text-left font-bold font-mono text-slate-900 whitespace-nowrap">
                          {item.totalPrice.toLocaleString()} {settings.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>المجموع الفرعي:</span>
                    <span>{invoice.subtotal.toLocaleString()} {settings.currency}</span>
                  </div>
                  {invoice.discount > 0 && (
                    <div className="flex justify-between text-red-600 font-semibold">
                      <span>الخصم:</span>
                      <span>-{invoice.discount.toLocaleString()} {settings.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black border-t border-slate-800 pt-1">
                    <span>الصافي المطلوب:</span>
                    <span>{invoice.total.toLocaleString()} {settings.currency}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>طريقة الدفع:</span>
                    <span className="font-semibold">
                      {invoice.paymentMethod === 'cash' && 'كاش نقدياً'}
                      {invoice.paymentMethod === 'wallet' && 'محفظة إلكترونية'}
                      {invoice.paymentMethod === 'instapay' && 'إنستاباي'}
                      {invoice.paymentMethod === 'debt' && 'آجل / شكك'}
                    </span>
                  </div>
                </div>

                {/* QR Code Verification */}
                <div className="flex flex-col items-center justify-center pt-3 border-t border-dashed border-slate-300">
                  <QRCodeSVG
                    value={`INV:${invoice.invoiceNumber}|TOTAL:${invoice.total}|STORE:${settings.storeName}|DATE:${invoice.createdAt}`}
                    size={80}
                  />
                  <p className="mt-1 text-[9px] text-slate-400 font-mono">مسح الباركود للتحقق من الفاتورة</p>
                </div>
              </div>
            )}

            {/* === TYPE: WALLET RECEIPT (VODAFONE CASH / INSTAPAY) === */}
            {type === 'wallet_receipt' && walletTx && (
              <div className="pt-3 space-y-3">
                <div className="bg-slate-100 p-2 rounded-lg text-center font-bold text-xs text-slate-800">
                  إيصال خدمة تحويل أموال إلكترونية
                </div>
                <div className="flex justify-between text-xs">
                  <span>المحفظة:</span>
                  <strong>{walletTx.walletName}</strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span>نوع العملية:</span>
                  <span className="font-bold text-blue-700">
                    {walletTx.type === 'cash_out_to_customer' && 'إيداع / تحويل كاش للعميل'}
                    {walletTx.type === 'cash_in_from_customer' && 'سحب كاش من العميل'}
                    {walletTx.type === 'instapay_transfer' && 'تحويل إنستاباي للعميل (إرسال)'}
                    {walletTx.type === 'instapay_receive' && 'استلام إنستاباي من العميل (استقبال)'}
                    {walletTx.type === 'internal_transfer' && 'تحويل بين محافظ المحل'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>رقم هاتف / حساب العميل:</span>
                  <strong className="font-mono text-sm">{walletTx.customerPhone || '-'}</strong>
                </div>
                {walletTx.customerName && (
                  <div className="flex justify-between text-xs">
                    <span>اسم العميل:</span>
                    <span>{walletTx.customerName}</span>
                  </div>
                )}
                <div className="border-t border-b border-dashed py-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>مبلغ العملية:</span>
                    <strong className="font-mono">{(walletTx.amount || 0).toLocaleString()} {settings.currency}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>رسوم / عمولة الخدمة:</span>
                    <strong className="font-mono">{(walletTx.commission || 0).toLocaleString()} {settings.currency}</strong>
                  </div>
                  <div className="flex justify-between text-sm font-black pt-1 border-t">
                    <span>الإجمالي المدفوع / المستلم:</span>
                    <span>
                      {((walletTx.type === 'cash_out_to_customer' || walletTx.type === 'instapay_transfer')
                        ? (walletTx.amount || 0) + (walletTx.commission || 0)
                        : (walletTx.amount || 0) - (walletTx.commission || 0)
                      ).toLocaleString()} {settings.currency}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 text-center">
                  الكاشير: {walletTx.cashierName} | التاريخ: {new Date(walletTx.createdAt).toLocaleString('ar-EG')}
                </div>
              </div>
            )}

            {/* === TYPE: REPAIR TICKET === */}
            {type === 'repair_ticket' && repair && (
              <div className="pt-3 space-y-3">
                <div className="bg-amber-100 text-amber-900 p-2 rounded-lg text-center font-bold text-xs">
                  إيصال استلام صيانة (أصل العميل)
                </div>
                <div className="flex justify-between text-xs">
                  <span>رقم إيصال الصيانة:</span>
                  <strong className="font-mono text-base text-blue-700">{repair.ticketNumber}</strong>
                </div>
                <div className="text-xs space-y-1 border-b pb-2">
                  <div>العميل: <strong>{repair.customerName}</strong> ({repair.customerPhone})</div>
                  <div>الجهاز: <strong>{repair.deviceModel}</strong> {repair.color && `(${repair.color})`}</div>
                  {repair.imeiOrSerial && <div>السيريال / IMEI: <span className="font-mono">{repair.imeiOrSerial}</span></div>}
                  {repair.passcodeOrPattern && <div>رمز القفل / النمط: <span className="font-mono">{repair.passcodeOrPattern}</span></div>}
                  {repair.accessoriesIncluded && <div>المتعلقات: {repair.accessoriesIncluded}</div>}
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-700">وصف العطل المطلوب إصلاحه:</span>
                  <p className="mt-1 bg-slate-50 p-2 rounded border border-slate-200 text-slate-800">{repair.problemDescription}</p>
                </div>
                <div className="flex justify-between text-xs font-bold pt-1">
                  <span>التكلفة التقديرية:</span>
                  <span>{repair.estimatedCost > 0 ? `${repair.estimatedCost} ${settings.currency}` : 'تحدد بعد الفحص'}</span>
                </div>
                <div className="text-[10px] text-slate-500 border-t pt-2 space-y-1">
                  <p className="font-bold text-slate-700">شروط الصيانة والضمان:</p>
                  <p>{settings.maintenanceTerms}</p>
                </div>
                <div className="flex justify-center pt-2">
                  <QRCodeSVG value={`REPAIR:${repair.ticketNumber}|PHONE:${repair.customerPhone}`} size={70} />
                </div>
              </div>
            )}

            {/* === TYPE: LEGAL USED PHONE PURCHASE AGREEMENT === */}
            {type === 'used_phone_contract' && phone && (
              <div className="pt-3 space-y-4 text-xs leading-relaxed">
                <div className="bg-slate-900 text-white p-2 text-center font-bold rounded-lg flex items-center justify-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>عقد بيع وتنازل نهائي وإقرار ملكية هاتف محمول مستعمل</span>
                </div>
                <p>
                  إنه في يوم <strong>{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>، أقر أنا الموقع أدناه بكامل أهليتي المعتبرة شرعاً وقانوناً:
                </p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <div><strong>اسم البائع (المتنازل):</strong> {phone.sellerInfo?.name || '...................................................'}</div>
                  <div><strong>الرقم القومي:</strong> <span className="font-mono">{phone.sellerInfo?.nationalId || '...........................................'}</span></div>
                  <div><strong>رقم الهاتف:</strong> <span className="font-mono">{phone.sellerInfo?.phone || '...........................................'}</span></div>
                </div>
                <p>
                  بأنني قد بعت وأسقطت وتنازلت بكافة الضمانات الفعلية والقانونية إلى محل: <strong>{settings.storeName}</strong> عن الجهاز الآتي بياناته:
                </p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 font-mono">
                  <div>نوع وموديل الجهاز: <strong>{phone.name} ({phone.brand} - {phone.model})</strong></div>
                  <div>رقم السيريال / IMEI 1: <strong>{phone.imei1}</strong></div>
                  {phone.imei2 && <div>رقم IMEI 2: <strong>{phone.imei2}</strong></div>}
                  <div>اللون والسعة: {phone.color} - {phone.storage}</div>
                  <div>نسبة البطارية: {phone.batteryHealth ? `${phone.batteryHealth}%` : 'غير محدد'}</div>
                  <div>المبلغ المدفوع للبائع: <strong>{phone.costPrice.toLocaleString()} {settings.currency}</strong> نقدياً وكاملاً</div>
                </div>
                <div className="p-2 border border-red-200 bg-red-50/70 text-red-950 rounded text-[11px]">
                  <strong>إقرار وإخلاء مسؤولية:</strong> {settings.usedPhoneLegalDisclaimer}
                </div>
                <div className="pt-4 grid grid-cols-2 gap-8 text-center font-bold">
                  <div>
                    <p className="border-b pb-8">توقيع وبصمة البائع (المتنازل)</p>
                    <p className="text-[10px] text-slate-500 mt-1">الاسم: {phone.sellerInfo?.name}</p>
                  </div>
                  <div>
                    <p className="border-b pb-8">توقيع المستلم وختم المحل</p>
                    <p className="text-[10px] text-slate-500 mt-1">{settings.storeName}</p>
                  </div>
                </div>
              </div>
            )}

            {/* === TYPE: SHIFT REPORT === */}
            {type === 'shift_report' && shift && (
              <div className="pt-3 space-y-2 text-xs">
                <div className="bg-slate-900 text-white p-2 text-center font-bold rounded">
                  تقرير تقفيل وردية (Z-Report #{shift.shiftNumber})
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>الكاشير المسؤول:</span>
                  <strong>{shift.cashierName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>وقت البداية:</span>
                  <span>{safeFormatDate(shift.startTime)}</span>
                </div>
                {shift.endTime && (
                  <div className="flex justify-between border-b pb-1">
                    <span>وقت الإغلاق:</span>
                    <span>{safeFormatDate(shift.endTime)}</span>
                  </div>
                )}
                <div className="bg-slate-50 p-2 rounded space-y-1 border">
                  <div className="flex justify-between">
                    <span>رصيد الكاش الافتتاحي:</span>
                    <span>{(shift.openingCash || 0).toLocaleString()} {settings.currency || 'ج.م'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>مبيعات الكاش في الوردية:</span>
                    <span>{(shift.totalSalesCash || 0).toLocaleString()} {settings.currency || 'ج.م'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>كاش داخل من تحويلات المحافظ:</span>
                    <span>{(shift.totalWalletIn || 0).toLocaleString()} {settings.currency || 'ج.م'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>كاش خارج لسحوبات العملاء:</span>
                    <span>-{(shift.totalWalletOut || 0).toLocaleString()} {settings.currency || 'ج.م'}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>المصروفات النثرية:</span>
                    <span>-{(shift.totalExpenses || 0).toLocaleString()} {settings.currency || 'ج.م'}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>الكاش المفترض بالدرج (السيستم):</span>
                    <span>{(shift.closingCashSystem || 0).toLocaleString()} {settings.currency || 'ج.م'}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>الكاش الفعلي المعدود بالدرج:</span>
                    <span>{(shift.closingCashActual || 0).toLocaleString()} {settings.currency || 'ج.م'}</span>
                  </div>
                  <div className={`flex justify-between font-black text-sm p-1 rounded ${
                    (shift.cashDifference || 0) === 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : (shift.cashDifference || 0) > 0
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <span>الفارق (العجز / الزيادة):</span>
                    <span>
                      {(shift.cashDifference || 0) === 0 && 'مطابق تماماً (0)'}
                      {(shift.cashDifference || 0) > 0 && `زيادة +${shift.cashDifference} ${settings.currency || 'ج.م'}`}
                      {(shift.cashDifference || 0) < 0 && `عجز ${shift.cashDifference} ${settings.currency || 'ج.م'}`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* === TYPE: RETURN RECEIPT (مرتجع مبيعات واسترداد) === */}
            {type === 'return_receipt' && invoice && (
              <div className="pt-3 space-y-3">
                <div className="bg-amber-600 text-white p-2.5 text-center font-black rounded-xl text-xs flex flex-col items-center justify-center">
                  <span>إشعار مرتجع مبيعات واسترداد نقدية</span>
                  <span className="text-[10px] font-normal opacity-90">RETURN VOUCHER</span>
                </div>

                <div className="flex justify-between text-xs border-b pb-2 text-slate-600">
                  <span>رقم الفاتورة الأصلية: <strong className="text-slate-900 font-mono">#{invoice.invoiceNumber}</strong></span>
                  <span>{new Date().toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', dateStyle: 'short' })}</span>
                </div>

                {invoice.customerName && (
                  <div className="text-xs">
                    <span className="text-slate-500">العميل المسترد:</span> <strong>{invoice.customerName}</strong> {invoice.customerPhone && `(${invoice.customerPhone})`}
                  </div>
                )}
                <div className="text-xs text-slate-500">الكاشير: {invoice.cashierName}</div>

                {/* Returned Items Table */}
                <table className="w-full text-xs text-right border-collapse mt-2">
                  <thead>
                    <tr className="border-b border-slate-300 font-bold text-slate-700">
                      <th className="py-1">الصنف المسترجع</th>
                      <th className="py-1 text-center">الكمية</th>
                      <th className="py-1 text-left">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item, idx) => (
                      <tr key={idx} className="py-1.5">
                        <td className="py-1">
                          <div className="font-semibold">{item.name}</div>
                          {item.imei && (
                            <div className="text-[10px] font-mono text-slate-500">IMEI: {item.imei}</div>
                          )}
                          <div className="text-[10px] text-slate-400">{item.unitPrice.toLocaleString()} {settings.currency}</div>
                        </td>
                        <td className="py-1 text-center font-mono font-bold text-amber-700">{item.quantity}</td>
                        <td className="py-1 text-left font-bold font-mono">
                          {item.totalPrice.toLocaleString()} {settings.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Refund Totals & Reason */}
                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-base font-black text-amber-900 border-t-2 border-amber-600 pt-1.5">
                    <span>إجمالي المبلغ المسترد للعميل:</span>
                    <span className="font-mono font-black">
                      {(invoice.returnedAmount || invoice.total).toLocaleString()} {settings.currency}
                    </span>
                  </div>

                  {invoice.returnReason && (
                    <div className="text-[11px] text-slate-600 pt-1">
                      <span>سبب المرتجع: </span>
                      <strong className="text-slate-800">{invoice.returnReason}</strong>
                    </div>
                  )}
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-4 text-center text-[10px] pt-4 border-t border-dashed border-slate-300">
                  <div>
                    <p className="border-b pb-6">توقيع العميل المستلم</p>
                  </div>
                  <div>
                    <p className="border-b pb-6">ختم وتوقيع الكاشير</p>
                  </div>
                </div>
              </div>
            )}

            {/* === RECEIPT FOOTER === */}
            {type !== 'used_phone_contract' && (
              <div className="mt-4 pt-3 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-500 space-y-1">
                {settings.receiptNotes && <p>{settings.receiptNotes}</p>}
                {settings.receiptFooter && <p className="font-semibold text-slate-700">{settings.receiptFooter}</p>}
                <p className="text-[9px] text-slate-400">نظام الغندور فون - El Ghandour Phone POS</p>
              </div>
            )}

            {/* Physical Cutter Feed Clearance (Ensures auto-cutter never cuts last line) */}
            <div style={{ height: '25mm', minHeight: '90px', clear: 'both', display: 'block' }}></div>

          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
          <span className="text-xs text-slate-500">
            يمكنك تخصيص الشعار واسم المحل والنصوص من شاشة <strong>الإعدادات</strong> في أي وقت.
          </span>
          <button
            onClick={() => setActivePrint(null)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            إغلاق المعاينة
          </button>
        </div>
      </div>
    </div>
  );
};
