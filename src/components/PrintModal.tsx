import React, { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, Download, ShieldCheck } from 'lucide-react';
import type { PrintData } from '../services/printer';

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

  if (!activePrint) return null;

  const { type, invoice, walletTx, repair, phone, shift, accessory, settings } = activePrint;
  const paperWidth = settings.paperSize === '58mm' ? 'max-w-[58mm]' : 'max-w-[80mm]';

  const handleExecutePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs no-print">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">معاينة المستند والطباعة</h3>
              <p className="text-xs text-slate-500">
                حجم الورق المعتمد: {settings.paperSize} | المحل: {settings.storeName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExecutePrint}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة فورية</span>
            </button>
            <button
              onClick={() => setActivePrint(null)}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Preview Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-slate-200/60 p-6 flex justify-center">
          <div className={`print-area w-full ${type === 'used_phone_contract' ? 'max-w-xl' : paperWidth} rounded-xl bg-white p-5 shadow-lg border border-slate-200 text-slate-900 text-sm`}>
            
            {/* === RECEIPT HEADER (STORE BRANDING) === */}
            <div className="text-center pb-4 border-b border-dashed border-slate-300">
              {settings.logoUrl && (
                <div className="flex justify-center mb-2">
                  <img
                    src={settings.logoUrl}
                    alt={settings.storeName}
                    className="h-16 w-16 object-contain rounded-full border border-slate-200"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
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
                      <th className="py-1">الصنف</th>
                      <th className="py-1 text-center">الكمية</th>
                      <th className="py-1 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item, idx) => (
                      <tr key={idx} className="py-1.5">
                        <td className="py-1">
                          <div className="font-semibold">{item.name}</div>
                          {settings.showImeiOnReceipt && item.imei && (
                            <div className="text-[10px] font-mono text-slate-500">IMEI: {item.imei}</div>
                          )}
                          <div className="text-[10px] text-slate-400">{item.unitPrice.toLocaleString()} {settings.currency}</div>
                        </td>
                        <td className="py-1 text-center font-mono">{item.quantity}</td>
                        <td className="py-1 text-left font-bold font-mono">
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
                    {walletTx.type === 'instapay_transfer' && 'تحويل إنستاباي بنكي'}
                    {walletTx.type === 'internal_transfer' && 'تحويل بين محافظ المحل'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>رقم هاتف / حساب العميل:</span>
                  <strong className="font-mono text-sm">{walletTx.customerPhone}</strong>
                </div>
                {walletTx.customerName && (
                  <div className="flex justify-between text-xs">
                    <span>اسم العميل:</span>
                    <span>{walletTx.customerName}</span>
                  </div>
                )}
                <div className="border-t border-b border-dashed py-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>مبلغ التحويل:</span>
                    <strong className="font-mono">{walletTx.amount.toLocaleString()} {settings.currency}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>رسوم / عمولة الخدمة:</span>
                    <strong className="font-mono">{walletTx.commission.toLocaleString()} {settings.currency}</strong>
                  </div>
                  <div className="flex justify-between text-sm font-black pt-1 border-t">
                    <span>الإجمالي المدفوع / المستلم:</span>
                    <span>
                      {(walletTx.type === 'cash_out_to_customer'
                        ? walletTx.amount + walletTx.commission
                        : walletTx.amount - walletTx.commission
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
                  <span>{new Date(shift.startTime).toLocaleString('ar-EG')}</span>
                </div>
                {shift.endTime && (
                  <div className="flex justify-between border-b pb-1">
                    <span>وقت الإغلاق:</span>
                    <span>{new Date(shift.endTime).toLocaleString('ar-EG')}</span>
                  </div>
                )}
                <div className="bg-slate-50 p-2 rounded space-y-1 border">
                  <div className="flex justify-between">
                    <span>رصيد الكاش الافتتاحي:</span>
                    <span>{shift.openingCash.toLocaleString()} {settings.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>مبيعات الكاش في الوردية:</span>
                    <span>{shift.totalSalesCash.toLocaleString()} {settings.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>كاش داخل من تحويلات المحافظ:</span>
                    <span>{shift.totalWalletIn.toLocaleString()} {settings.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>كاش خارج لسحوبات العملاء:</span>
                    <span>-{shift.totalWalletOut.toLocaleString()} {settings.currency}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>المصروفات النثرية:</span>
                    <span>-{shift.totalExpenses.toLocaleString()} {settings.currency}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>الكاش المفترض بالدرج (السيستم):</span>
                    <span>{shift.closingCashSystem.toLocaleString()} {settings.currency}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>الكاش الفعلي المعدود بالدرج:</span>
                    <span>{shift.closingCashActual.toLocaleString()} {settings.currency}</span>
                  </div>
                  <div className={`flex justify-between font-black text-sm p-1 rounded ${
                    shift.cashDifference === 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : shift.cashDifference > 0
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <span>الفارق (العجز / الزيادة):</span>
                    <span>
                      {shift.cashDifference === 0 && 'مطابق تماماً (0)'}
                      {shift.cashDifference > 0 && `زيادة +${shift.cashDifference} ${settings.currency}`}
                      {shift.cashDifference < 0 && `عجز ${shift.cashDifference} ${settings.currency}`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* === RECEIPT FOOTER === */}
            {type !== 'used_phone_contract' && (
              <div className="mt-4 pt-3 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-500 space-y-1">
                {settings.receiptNotes && <p>{settings.receiptNotes}</p>}
                {settings.receiptFooter && <p className="font-semibold text-slate-700">{settings.receiptFooter}</p>}
                <p className="text-[9px] text-slate-400">نظام Mobile POS Pro لإدارة محلات الهواتف</p>
              </div>
            )}

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
