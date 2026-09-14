import React, { useState } from 'react';
import {
  RotateCcw,
  X,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Smartphone,
  Package,
  Printer,
  FileText,
} from 'lucide-react';
import { db } from '../db';
import { triggerPrint } from '../services/printer';
import { syncDataToFirebase } from '../services/firebase';
import { useModal } from '../context/ModalContext';
import type { SaleInvoice, StoreSettings } from '../types';

interface ReturnInvoiceModalProps {
  invoice: SaleInvoice;
  activeShiftId: string;
  cashierName: string;
  settings?: StoreSettings;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ReturnItemSelection {
  itemId: string;
  type: 'phone' | 'accessory' | 'repair' | 'service';
  name: string;
  imei?: string;
  originalQty: number;
  previouslyReturnedQty: number;
  availableToReturn: number;
  returnQty: number;
  unitPrice: number;
}

export const ReturnInvoiceModal: React.FC<ReturnInvoiceModalProps> = ({
  invoice,
  activeShiftId,
  cashierName,
  settings,
  onClose,
  onSuccess,
}) => {
  const { showAlert, showToast, showConfirm } = useModal();

  // Initialize return selection for each item
  const [itemsSelection, setItemsSelection] = useState<ReturnItemSelection[]>(() =>
    invoice.items.map((item) => {
      const prevReturned = item.returnedQuantity || 0;
      const available = Math.max(0, item.quantity - prevReturned);
      return {
        itemId: item.itemId,
        type: item.type,
        name: item.name,
        imei: item.imei,
        originalQty: item.quantity,
        previouslyReturnedQty: prevReturned,
        availableToReturn: available,
        returnQty: 0, // initially 0 selected
        unitPrice: item.unitPrice,
      };
    })
  );

  const [returnReason, setReturnReason] = useState('رغبة العميل في الاسترجاع');
  const [customReason, setCustomReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'wallet' | 'store_credit'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);

  // Quick select all items for full invoice refund
  const handleSelectAll = (selectAll: boolean) => {
    setItemsSelection((prev) =>
      prev.map((item) => ({
        ...item,
        returnQty: selectAll ? item.availableToReturn : 0,
      }))
    );
  };

  // Update return quantity for a specific item
  const handleQtyChange = (itemId: string, newQty: number) => {
    setItemsSelection((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId) {
          const clamped = Math.max(0, Math.min(item.availableToReturn, newQty));
          return { ...item, returnQty: clamped };
        }
        return item;
      })
    );
  };

  // Calculations
  const selectedItemsToReturn = itemsSelection.filter((i) => i.returnQty > 0);
  const totalItemsCount = selectedItemsToReturn.reduce((sum, i) => sum + i.returnQty, 0);

  // Raw return amount before discount ratio
  const rawRefundSubtotal = selectedItemsToReturn.reduce(
    (sum, i) => sum + i.returnQty * i.unitPrice,
    0
  );

  // Proportional discount handling: if the invoice had a discount, refund proportional net amount
  const discountRatio = invoice.subtotal > 0 ? invoice.discount / invoice.subtotal : 0;
  const calculatedRefundAmount = Math.round(rawRefundSubtotal * (1 - discountRatio));

  const isFullInvoiceReturn =
    itemsSelection.every((item) => item.returnQty === item.availableToReturn) &&
    totalItemsCount > 0;

  // Process Return in Database
  const handleConfirmReturn = async () => {
    if (selectedItemsToReturn.length === 0) {
      showAlert('يرجى تحديد الأصناف والكميات المراد إرجاعها أولاً.', 'تنبيه', 'warning');
      return;
    }

    const finalReason = customReason.trim() ? customReason.trim() : returnReason;

    const confirmed = await showConfirm(
      `هل أنت متأكد من إتمام عملية المرتجع بمبلغ إجمالي (${calculatedRefundAmount.toLocaleString()} ${settings?.currency || 'ج.م'}) وردها للعميل؟`,
      'تأكيد استرجاع الفاتورة'
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await db.transaction(
        'rw',
        [db.invoices, db.phones, db.accessories, db.shifts, db.wallets],
        async () => {
          // 1. Fetch current fresh invoice
          const freshInvoice = await db.invoices.get(invoice.id);
          if (!freshInvoice) throw new Error('Invoice not found');

          // 2. Update Invoice items
          let allFullyReturned = true;
          const updatedItems = freshInvoice.items.map((item) => {
            const match = selectedItemsToReturn.find((s) => s.itemId === item.itemId);
            if (match) {
              const currentReturned = item.returnedQuantity || 0;
              const newTotalReturned = currentReturned + match.returnQty;
              if (newTotalReturned < item.quantity) {
                allFullyReturned = false;
              }
              return {
                ...item,
                returnedQuantity: newTotalReturned,
              };
            }
            if ((item.returnedQuantity || 0) < item.quantity) {
              allFullyReturned = false;
            }
            return item;
          });

          const newTotalRefunded = (freshInvoice.returnedAmount || 0) + calculatedRefundAmount;
          const newStatus = allFullyReturned ? 'returned' : 'partially_returned';

          await db.invoices.update(invoice.id, {
            items: updatedItems,
            status: newStatus,
            returnedAmount: newTotalRefunded,
            returnReason: finalReason,
            returnedAt: new Date().toISOString(),
          });

          // 3. Restore Stock (Phones and Accessories)
          for (const retItem of selectedItemsToReturn) {
            if (retItem.type === 'phone') {
              // Return phone to available status
              await db.phones.update(retItem.itemId, {
                status: 'available',
                soldAt: undefined,
                soldInvoiceId: undefined,
              });
            } else if (retItem.type === 'accessory') {
              // Increase accessory stock
              const acc = await db.accessories.get(retItem.itemId);
              if (acc) {
                await db.accessories.update(retItem.itemId, {
                  stockQuantity: acc.stockQuantity + retItem.returnQty,
                });
              }
            }
          }

          // 4. Adjust Cash Drawer / Shift
          if (refundMethod === 'cash' && activeShiftId) {
            const shift = await db.shifts.get(activeShiftId);
            if (shift) {
              await db.shifts.update(activeShiftId, {
                closingCashSystem: shift.closingCashSystem - calculatedRefundAmount,
                totalReturnsCash: (shift.totalReturnsCash || 0) + calculatedRefundAmount,
              });
            }
          } else if (refundMethod === 'wallet' && invoice.walletId) {
            const wallet = await db.wallets.get(invoice.walletId);
            if (wallet) {
              await db.wallets.update(invoice.walletId, {
                balance: wallet.balance - calculatedRefundAmount,
              });
            }
          }
        }
      );

      // Async sync to Firebase
      syncDataToFirebase().catch(console.warn);

      showToast(`تم إتمام المرتجع واسترداد ${calculatedRefundAmount.toLocaleString()} ج.م بنجاح!`);

      // Ask to print Return Receipt
      if (settings) {
        triggerPrint({
          type: 'return_receipt',
          invoice: {
            ...invoice,
            status: isFullInvoiceReturn ? 'returned' : 'partially_returned',
            returnedAmount: calculatedRefundAmount,
            returnReason: finalReason,
            returnedAt: new Date().toISOString(),
            items: selectedItemsToReturn.map((item) => ({
              itemId: item.itemId,
              type: item.type,
              name: item.name,
              imei: item.imei,
              quantity: item.returnQty,
              unitPrice: item.unitPrice,
              totalPrice: item.returnQty * item.unitPrice,
              costPrice: 0,
            })),
          },
          settings,
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error during return:', err);
      showAlert(`فشل تسجيل المرتجع: ${err?.message || 'خطأ غير معروف'}`, 'خطأ', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const allSelected =
    itemsSelection.length > 0 &&
    itemsSelection.every((i) => i.availableToReturn === 0 || i.returnQty === i.availableToReturn);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 border border-amber-500/20">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  مرتجع فاتورة #{invoice.invoiceNumber}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 font-mono">
                  {new Date(invoice.createdAt).toLocaleDateString('ar-EG')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                الكاشير: <strong>{invoice.cashierName}</strong>
                {invoice.customerName && ` | العميل: ${invoice.customerName}`}
                {invoice.customerPhone && ` (${invoice.customerPhone})`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Top Quick Actions Banner */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-black text-slate-800 block">
                تحديد بنود المرتجع (إرجاع جزئي أو كلي):
              </span>
              <span className="text-[11px] text-slate-500">
                يمكنك إرجاع أصناف وكميات محددة، أو إرجاع الفاتورة كاملة بنقرة واحدة.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleSelectAll(!allSelected)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  allSelected
                    ? 'bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-blue-500'
                }`}
              >
                {allSelected ? 'إلغاء تحديد الكل' : 'تحديد كامل الفاتورة للإرجاع'}
              </button>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-700 block">
              الأصناف المتاحة للإرجاع في هذه الفاتورة:
            </label>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
              {itemsSelection.map((item) => {
                const isSelected = item.returnQty > 0;
                const isAvailable = item.availableToReturn > 0;

                return (
                  <div
                    key={item.itemId}
                    className={`p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      !isAvailable
                        ? 'bg-slate-50 opacity-60'
                        : isSelected
                        ? 'bg-amber-50/60'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {item.type === 'phone' ? (
                        <div className="mt-0.5 h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <Smartphone className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="mt-0.5 h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4" />
                        </div>
                      )}

                      <div>
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                          <span>{item.name}</span>
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-normal">
                            {item.type === 'phone' ? 'هاتف' : 'إكسسوار'}
                          </span>
                        </div>

                        {item.imei && (
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            IMEI: <strong>{item.imei}</strong>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-500 mt-0.5">
                          سعر الوحدة: <span className="font-bold font-mono text-slate-800">{item.unitPrice.toLocaleString()} {settings?.currency || 'ج'}</span>
                          {' | '}
                          الكمية المباعة: <span className="font-mono font-bold">{item.originalQty}</span>
                          {item.previouslyReturnedQty > 0 && (
                            <span className="text-amber-700 mr-1">
                              (تم إرجاع {item.previouslyReturnedQty} سابقاً)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Return Action & Counter */}
                    <div className="flex items-center justify-end gap-3 shrink-0">
                      {!isAvailable ? (
                        <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                          تم استرجاعه بالكامل سابقاً
                        </span>
                      ) : item.type === 'phone' ? (
                        // Phone is 1-unit IMEI toggle
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 hover:border-amber-400">
                          <input
                            type="checkbox"
                            checked={item.returnQty === 1}
                            onChange={(e) => handleQtyChange(item.itemId, e.target.checked ? 1 : 0)}
                            className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-xs font-bold text-slate-700">
                            {item.returnQty === 1 ? 'محدد للإرجاع' : 'إرجاع هذا الجهاز'}
                          </span>
                        </label>
                      ) : (
                        // Accessory quantity stepper
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">الكمية المرتجعة:</span>
                          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <button
                              type="button"
                              onClick={() => handleQtyChange(item.itemId, item.returnQty - 1)}
                              disabled={item.returnQty <= 0}
                              className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={item.availableToReturn}
                              value={item.returnQty}
                              onChange={(e) =>
                                handleQtyChange(item.itemId, parseInt(e.target.value) || 0)
                              }
                              className="w-12 text-center font-mono font-bold text-xs py-1 border-x border-slate-100 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleQtyChange(item.itemId, item.returnQty + 1)}
                              disabled={item.returnQty >= item.availableToReturn}
                              className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400">من {item.availableToReturn}</span>
                        </div>
                      )}

                      {/* Subtotal of this item refund */}
                      {item.returnQty > 0 && (
                        <div className="font-mono font-bold text-xs text-amber-700 min-w-[70px] text-left">
                          {(item.returnQty * item.unitPrice).toLocaleString()} {settings?.currency || 'ج'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Refund Details & Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سبب الإرجاع:
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 focus:border-amber-500 focus:outline-none"
              >
                <option value="رغبة العميل في الاسترجاع">رغبة العميل في الاسترجاع</option>
                <option value="عيب صناعة أو مشكلة فنية">عيب صناعة أو مشكلة فنية</option>
                <option value="استبدال بموديل أو صنف آخر">استبدال بموديل أو صنف آخر</option>
                <option value="عدم التوافق مع الجهاز">عدم التوافق مع الجهاز</option>
                <option value="خطأ في تسجيل الفاتورة">خطأ في تسجيل الفاتورة</option>
                <option value="أخرى">سبب آخر (كتابة يدوية)</option>
              </select>

              {returnReason === 'أخرى' && (
                <input
                  type="text"
                  placeholder="اكتب سبب المرتجع هنا..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium focus:border-amber-500 focus:outline-none"
                />
              )}
            </div>

            {/* Refund Method */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                طريقة رد المبلغ للعميل:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundMethod('cash')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    refundMethod === 'cash'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>نقداً من الدرج</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRefundMethod('wallet')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    refundMethod === 'wallet'
                      ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300'
                  }`}
                >
                  <span>محفظة إلكترونية</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {refundMethod === 'cash'
                  ? 'سيتم خصم المبلغ من رصيد الكاش بالوردية الحالية تلقائياً.'
                  : 'سيتم تسوية المبلغ عبر المحفظة أو الحساب.'}
              </p>
            </div>
          </div>

          {/* Refund Calculation Summary Box */}
          <div className="rounded-2xl bg-amber-50/70 border-2 border-amber-200 p-4 space-y-2">
            <div className="flex justify-between text-xs text-amber-900">
              <span>إجمالي قيمة الأصناف المحددة للمرتجع:</span>
              <span className="font-mono font-bold">
                {rawRefundSubtotal.toLocaleString()} {settings?.currency || 'ج'}
              </span>
            </div>

            {discountRatio > 0 && (
              <div className="flex justify-between text-xs text-red-700">
                <span>خصم نسبة التخفيض الأصلية بالفاتورة ({Math.round(discountRatio * 100)}%):</span>
                <span className="font-mono font-bold">
                  -{(rawRefundSubtotal - calculatedRefundAmount).toLocaleString()} {settings?.currency || 'ج'}
                </span>
              </div>
            )}

            <div className="border-t border-amber-300/80 pt-2 flex items-center justify-between">
              <div>
                <span className="text-sm font-black text-amber-950 block">
                  الصافي المسترد للعميل:
                </span>
                <span className="text-[10px] text-amber-800">
                  {isFullInvoiceReturn
                    ? 'إرجاع الفاتورة بالكامل (استرداد كامل المبلغ)'
                    : `مرتجع جزئي (${totalItemsCount} قطعة)`}
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-amber-800">
                {calculatedRefundAmount.toLocaleString()} {settings?.currency || 'ج.م'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            إلغاء وتراجع
          </button>

          <button
            type="button"
            onClick={handleConfirmReturn}
            disabled={isProcessing || totalItemsCount === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-black shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isProcessing ? (
              <span>جاري تسجيل المرتجع...</span>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  تأكيد واسترداد {calculatedRefundAmount.toLocaleString()} {settings?.currency || 'ج.م'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
