import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import confetti from 'canvas-confetti';
import {
  ShoppingCart,
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Smartphone,
  Tag,
  CheckCircle2,
  Printer,
  PauseCircle,
  PlayCircle,
  User,
  Percent,
  Receipt,
  RotateCcw,
  X,
} from 'lucide-react';
import { db } from '../db';
import { triggerPrint } from '../services/printer';
import { useModal } from '../context/ModalContext';
import { ShiftInvoicesModal } from '../components/ShiftInvoicesModal';
import type { InvoiceItem, SaleInvoice, StoreSettings, Phone, Accessory, ProductVariant } from '../types';

export const PosView: React.FC<{ activeShiftId: string; cashierName: string }> = ({
  activeShiftId,
  cashierName,
}) => {
  const { showAlert, showToast } = useModal();
  const phones = useLiveQuery(() => db.phones.where('status').equals('available').toArray()) || [];
  const accessories = useLiveQuery(() => db.accessories.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));
  const wallets = useLiveQuery(() => db.wallets.filter((w) => w.isActive).toArray()) || [];

  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<SaleInvoice['paymentMethod']>('cash');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [heldOrders, setHeldOrders] = useState<{ id: string; name: string; items: InvoiceItem[] }[]>([]);
  const [showShiftInvoicesModal, setShowShiftInvoicesModal] = useState(false);
  const [variantPickerAcc, setVariantPickerAcc] = useState<Accessory | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Set default wallet
  useEffect(() => {
    if (wallets.length > 0 && !selectedWalletId) {
      setSelectedWalletId(wallets[0].id);
    }
  }, [wallets, selectedWalletId]);

  // Fast Barcode Scanner or IMEI auto-matcher
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // Check by IMEI first
    const matchedPhone = phones.find((p) => p.imei1 === q || p.imei2 === q);
    if (matchedPhone) {
      addPhoneToCart(matchedPhone);
      setSearchQuery('');
      return;
    }

    // Check by Accessory Barcode
    const matchedAcc = accessories.find((a) => a.barcode === q);
    if (matchedAcc) {
      addAccessoryToCart(matchedAcc);
      setSearchQuery('');
      return;
    }
  };

  const addPhoneToCart = (phone: Phone) => {
    // Phones can only be added once because each has unique IMEI
    const alreadyInCart = cartItems.find((item) => item.itemId === phone.id);
    if (alreadyInCart) {
      showAlert('هذا الهاتف مضاف بالفعل في سلة المبيعات الحالية!', 'تنبيه', 'warning');
      return;
    }

    const newItem: InvoiceItem = {
      itemId: phone.id,
      type: 'phone',
      name: `${phone.name} (${phone.condition === 'new' ? 'جديد' : 'مستعمل'})`,
      imei: phone.imei1,
      quantity: 1,
      unitPrice: phone.sellPrice,
      totalPrice: phone.sellPrice,
      costPrice: phone.costPrice,
    };

    setCartItems([...cartItems, newItem]);
  };

  const handleAccessoryClick = (acc: Accessory) => {
    if (acc.hasVariants && acc.variants && acc.variants.length > 0) {
      setVariantPickerAcc(acc);
    } else {
      addAccessoryToCart(acc);
    }
  };

  const addAccessoryToCart = (acc: Accessory) => {
    const existingIndex = cartItems.findIndex((i) => i.itemId === acc.id && !i.variantId);
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].totalPrice = updated[existingIndex].quantity * updated[existingIndex].unitPrice;
      setCartItems(updated);
    } else {
      const newItem: InvoiceItem = {
        itemId: acc.id,
        type: 'accessory',
        name: acc.name,
        quantity: 1,
        unitPrice: acc.sellPriceRetail,
        totalPrice: acc.sellPriceRetail,
        costPrice: acc.costPrice,
      };
      setCartItems([...cartItems, newItem]);
    }
  };

  const addVariantToCart = (acc: Accessory, variant: ProductVariant) => {
    const unitPrice = acc.sellPriceRetail + (variant.additionalPrice || 0);
    const existingIndex = cartItems.findIndex(
      (i) => i.itemId === acc.id && i.variantId === variant.id
    );

    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].totalPrice = updated[existingIndex].quantity * updated[existingIndex].unitPrice;
      setCartItems(updated);
    } else {
      const newItem: InvoiceItem = {
        itemId: acc.id,
        type: 'accessory',
        name: `${acc.name} (${variant.name})`,
        quantity: 1,
        unitPrice,
        totalPrice: unitPrice,
        costPrice: acc.costPrice,
        variantId: variant.id,
        variantName: variant.name,
      };
      setCartItems([...cartItems, newItem]);
    }
    setVariantPickerAcc(null);
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cartItems];
    const item = updated[index];
    if (item.type === 'phone') {
      // Phones cannot have quantity other than 1
      return;
    }
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      removeItem(index);
    } else {
      item.quantity = newQty;
      item.totalPrice = item.quantity * item.unitPrice;
      setCartItems(updated);
    }
  };

  const removeItem = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = cartItems.reduce((acc, i) => acc + i.totalPrice, 0);
  const discountVal = parseFloat(discount) || 0;
  const grandTotal = Math.max(0, subtotal - discountVal);
  const totalCost = cartItems.reduce((acc, i) => acc + i.costPrice * i.quantity, 0);
  const totalProfit = Math.max(0, grandTotal - totalCost);

  const handleCompleteSale = async () => {
    if (cartItems.length === 0) {
      showAlert('سلة المبيعات فارغة! يرجى إضافة هواتف أو إكسسوارات للبيع.', 'تنبيه', 'warning');
      return;
    }

    const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
    const invoiceId = `inv_${Date.now()}`;

    const newInvoice: SaleInvoice = {
      id: invoiceId,
      invoiceNumber: invoiceNum,
      shiftId: activeShiftId,
      cashierName,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      items: cartItems,
      subtotal,
      discount: discountVal,
      tax: 0,
      total: grandTotal,
      paidAmount: grandTotal,
      remainingAmount: 0,
      paymentMethod,
      walletId: paymentMethod === 'wallet' || paymentMethod === 'instapay' ? selectedWalletId : undefined,
      totalProfit,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    // Execute atomic DB transaction
    await db.transaction('rw', [db.invoices, db.phones, db.accessories, db.shifts, db.wallets], async () => {
      // 1. Add Invoice
      await db.invoices.add(newInvoice);

      // 2. Mark sold phones as sold
      for (const item of cartItems) {
        if (item.type === 'phone') {
          await db.phones.update(item.itemId, {
            status: 'sold',
            soldAt: new Date().toISOString(),
            soldInvoiceId: invoiceId,
          });
        } else if (item.type === 'accessory') {
          const acc = await db.accessories.get(item.itemId);
          if (acc) {
            let updatedVariants = acc.variants;
            if (item.variantId && updatedVariants) {
              updatedVariants = updatedVariants.map((v) =>
                v.id === item.variantId
                  ? { ...v, stockQuantity: Math.max(0, v.stockQuantity - item.quantity) }
                  : v
              );
            }
            await db.accessories.update(item.itemId, {
              stockQuantity: Math.max(0, acc.stockQuantity - item.quantity),
              variants: updatedVariants,
            });
          }
        }
      }

      // 3. Update Shift drawer or wallet
      const shift = await db.shifts.get(activeShiftId);
      if (shift) {
        if (paymentMethod === 'cash') {
          await db.shifts.update(activeShiftId, {
            closingCashSystem: shift.closingCashSystem + grandTotal,
            totalSalesCash: shift.totalSalesCash + grandTotal,
          });
        }
      }

      if ((paymentMethod === 'wallet' || paymentMethod === 'instapay') && selectedWalletId) {
        const targetWallet = await db.wallets.get(selectedWalletId);
        if (targetWallet) {
          await db.wallets.update(selectedWalletId, {
            balance: targetWallet.balance + grandTotal,
          });
        }
      }
    });

    // Confetti effect
    try {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
    } catch {}

    // Trigger Print
    if (settings && settings.autoPrintReceipt) {
      triggerPrint({
        type: 'sale_receipt',
        invoice: newInvoice,
        settings,
      });
    }

    // Reset
    showToast('تم إتمام عملية البيع وتأكيد الفاتورة بنجاح!');
    setCartItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscount('0');
    setPaymentMethod('cash');
  };

  // Hold Order
  const handleHoldOrder = () => {
    if (cartItems.length === 0) return;
    const name = customerName || `طلب معلق #${heldOrders.length + 1}`;
    setHeldOrders([...heldOrders, { id: `held_${Date.now()}`, name, items: cartItems }]);
    setCartItems([]);
    setCustomerName('');
    setCustomerPhone('');
  };

  const handleResumeOrder = (held: { id: string; name: string; items: InvoiceItem[] }) => {
    setCartItems(held.items);
    setHeldOrders(heldOrders.filter((h) => h.id !== held.id));
  };

  // Filter available items for quick click
  const filteredPhones = phones.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.imei1.includes(searchQuery)
  );

  const filteredAccessories = accessories.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.barcode.includes(searchQuery)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
      {/* LEFT / CENTER: Products Catalog & Quick Pick (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Search Bar with Barcode Scanner support */}
        <form
          onSubmit={handleSearchSubmit}
          className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 flex items-center gap-3"
        >
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="امسح بالباركود سكانر أو ابحث باسم الجهاز، الـ IMEI، أو الإكسسوار..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-10 pl-4 text-xs font-semibold focus:border-blue-600 focus:bg-white focus:outline-none"
            />
            <Search className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
          </div>

          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 text-white px-4 py-3 text-xs font-bold hover:bg-slate-800 transition shrink-0 cursor-pointer"
          >
            <Barcode className="h-4 w-4 text-blue-400" />
            <span>إضافة فلاش</span>
          </button>
        </form>

        {/* Catalog Items Container */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-5">
          {/* Phones Section */}
          {filteredPhones.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                  <span>الهواتف المتاحة في المخزن ({filteredPhones.length})</span>
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                {filteredPhones.map((phone) => (
                  <div
                    key={phone.id}
                    onClick={() => addPhoneToCart(phone)}
                    className="p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700">
                        {phone.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {phone.storage} | IMEI: {phone.imei1.slice(-6)}...
                      </div>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold ${
                          phone.condition === 'new'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {phone.condition === 'new' ? 'جديد' : 'مستعمل'}
                      </span>
                    </div>
                    <div className="text-left font-mono font-black text-blue-700 text-sm">
                      {phone.sellPrice.toLocaleString()} {settings?.currency || 'ج'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accessories Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-indigo-600" />
                <span>الإكسسوارات والشواحن والسكرينات ({filteredAccessories.length})</span>
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
              {filteredAccessories.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => handleAccessoryClick(acc)}
                  className="p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-semibold text-slate-400 block truncate">
                        {acc.category}
                      </span>
                      {acc.hasVariants && acc.variants && acc.variants.length > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold shrink-0">
                          {acc.variants.length} خيارات
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 line-clamp-2 mt-0.5">
                      {acc.name}
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">متبقي: {acc.stockQuantity}</span>
                    <span className="font-mono font-black text-xs text-indigo-700">
                      {acc.sellPriceRetail.toLocaleString()} {settings?.currency || 'ج'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Held Orders Bar */}
        {heldOrders.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <PauseCircle className="h-5 w-5 text-amber-600" />
              <span>فواتير معلقة بانتظار استئناف البيع ({heldOrders.length})</span>
            </div>
            <div className="flex gap-2">
              {heldOrders.map((h) => (
                <button
                  key={h.id}
                  onClick={() => handleResumeOrder(h)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-800 hover:bg-amber-100 shadow-xs cursor-pointer"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  <span>{h.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Cart / Checkout Terminal (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between min-h-[600px]">
        <div>
          {/* Cart Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">فاتورة بيع حالية</h3>
                <span className="text-[10px] text-slate-400">الكاشير: {cashierName}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowShiftInvoicesModal(true)}
                className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition cursor-pointer"
                title="استعراض فواتير الوردية وعمل المرتجعات"
              >
                <Receipt className="h-3.5 w-3.5 text-blue-600" />
                <span>فواتير الوردية / المرتجع</span>
              </button>

              {cartItems.length > 0 && (
                <button
                  onClick={handleHoldOrder}
                  className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl hover:bg-amber-100 transition cursor-pointer"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  <span>تعليق الفاتورة</span>
                </button>
              )}
            </div>
          </div>

          {/* Customer Quick Details */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="اسم العميل (اختياري)"
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs focus:border-blue-600 focus:bg-white focus:outline-none"
            />
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="رقم الهاتف"
              className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-mono focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Cart Items List */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {cartItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                السلة فارغة. اضغط على أي هاتف أو إكسسوار لإضافته للفاتورة.
              </div>
            ) : (
              cartItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs"
                >
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="font-bold text-slate-800 truncate">{item.name}</div>
                    {item.imei && (
                      <div className="text-[10px] font-mono text-slate-400">IMEI: {item.imei}</div>
                    )}
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.unitPrice.toLocaleString()} {settings?.currency || 'ج'}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5 mx-2">
                    {item.type !== 'phone' && (
                      <button
                        onClick={() => updateQuantity(idx, -1)}
                        className="h-6 w-6 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-100"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                    )}
                    <span className="font-mono font-bold text-xs px-1">{item.quantity}</span>
                    {item.type !== 'phone' && (
                      <button
                        onClick={() => updateQuantity(idx, 1)}
                        className="h-6 w-6 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-100"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <div className="text-left font-mono font-black text-slate-900 text-xs min-w-[60px]">
                    {item.totalPrice.toLocaleString()} ج
                  </div>

                  <button
                    onClick={() => removeItem(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 mr-1 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cart Totals & Payment Method */}
        <div className="border-t border-slate-100 pt-4 space-y-3 mt-4">
          {/* Subtotal & Discount */}
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>المجموع الفرعي:</span>
              <span className="font-mono font-bold">{subtotal.toLocaleString()} {settings?.currency || 'ج.م'}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Percent className="h-3 w-3 text-red-500" />
                <span>خصم خاص:</span>
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  className="w-20 rounded-lg border border-slate-200 p-1 text-right text-xs font-mono focus:border-blue-600 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400">{settings?.currency || 'ج'}</span>
              </div>
            </div>

            <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
              <span>المبلغ الإجمالي النهائي:</span>
              <span className="text-blue-700 font-mono text-xl">
                {grandTotal.toLocaleString()} {settings?.currency || 'ج.م'}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">طريقة الدفع والتحصيل:</label>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentMethod === 'cash'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Banknote className="h-4 w-4" />
                <span>كاش</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('wallet')}
                className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentMethod === 'wallet'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Smartphone className="h-4 w-4" />
                <span>فودافون</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('instapay')}
                className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentMethod === 'instapay'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <span>إنستاباي</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('debt')}
                className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentMethod === 'debt'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <User className="h-4 w-4" />
                <span>آجل / شكك</span>
              </button>
            </div>
          </div>

          {/* Wallet selector if wallet or instapay */}
          {(paymentMethod === 'wallet' || paymentMethod === 'instapay') && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">
                إيداع المبلغ في محفظة المحل:
              </label>
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold bg-white focus:outline-none"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.balance.toLocaleString()} ج)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Checkout Button */}
          <button
            type="button"
            onClick={handleCompleteSale}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-base py-4 shadow-lg transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-5 w-5" />
            <span>إتمام البيع وطباعة الفاتورة الحرارية</span>
          </button>
        </div>
      </div>

      {/* Modal: Variant Picker for POS */}
      {variantPickerAcc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-4 text-white">
              <div>
                <h3 className="font-bold text-sm">اختر المتغير (اللون / الموديل)</h3>
                <p className="text-xs text-white/80 line-clamp-1">{variantPickerAcc.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setVariantPickerAcc(null)}
                className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-2 max-h-80 overflow-y-auto">
              {variantPickerAcc.variants && variantPickerAcc.variants.length > 0 ? (
                variantPickerAcc.variants.map((v) => {
                  const isAvailable = v.stockQuantity > 0;
                  const finalPrice = variantPickerAcc.sellPriceRetail + (v.additionalPrice || 0);

                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => addVariantToCart(variantPickerAcc, v)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition text-xs font-bold cursor-pointer ${
                        isAvailable
                          ? 'border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 text-slate-800'
                          : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <div className="text-right">
                        <span className="text-sm font-black block">{v.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {isAvailable ? `متبقي بالمخزن: ${v.stockQuantity} قطعة` : 'غير متوفر (نفد)'}
                        </span>
                      </div>

                      <div className="text-left font-mono font-black text-sm text-purple-700">
                        {finalPrice.toLocaleString()} {settings?.currency || 'ج'}
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">لا توجد متغيرات محددة لهذا الصنف</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shift Invoices & Returns Inspector Modal */}
      {showShiftInvoicesModal && (
        <ShiftInvoicesModal
          shiftId={activeShiftId}
          activeShiftId={activeShiftId}
          currentCashierName={cashierName}
          onClose={() => setShowShiftInvoicesModal(false)}
        />
      )}
    </div>
  );
};
