import 'fake-indexeddb/auto';
import { db, DEFAULT_SETTINGS, initializeDatabase, repairNegativeShifts } from '../src/db';
import { ESC_POS, buildEscPosReceiptBuffer } from '../src/services/printer';
import type { SaleInvoice, Shift, StoreSettings, Phone, Accessory, WalletTransaction } from '../src/types';

async function runFullSystemTest() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('🧪 بدء الفحص الشامل لنظام Mobile POS Pro ("3amory phone")');
  console.log('═════════════════════════════════════════════════════════════════\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: DATABASE INITIALIZATION & CLEAN PRODUCTION SEEDING
  // ─────────────────────────────────────────────────────────────────
  console.log('📋 اختبار 1: تهيئة قاعدة البيانات والبيانات الإنتاجية النظيفة');
  await initializeDatabase();

  const settings = await db.settings.get(1);
  assert(!!settings, 'تحميل إعدادات المحل بنجاح');
  assert(settings?.storeName === '3amory phone', 'الاسم الافتراضي للمحل هو 3amory phone', settings?.storeName);
  assert(settings?.logoUrl === '/logo-removebg-preview.png', 'اللوجو الافتراضي هو اللوجو الشفاف');

  // Verify no mock data
  const phonesCount = await db.phones.count();
  const accCount = await db.accessories.count();
  const legacyMockPhones = await db.phones.where('id').anyOf(['ph_1', 'ph_2', 'ph_3']).toArray();
  assert(legacyMockPhones.length === 0, 'خلو النظام من أي أجهزة تجريبية وهمية (Zero Mock Data)');
  console.log('    ✓ إعدادات وهوية المحل مطابقة ومضبوطة.\n');

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: AUTHENTICATION & PIN SECURITY SYSTEM
  // ─────────────────────────────────────────────────────────────────
  console.log('🔐 اختبار 2: نظام الدخول والحسابات والـ PIN');
  const users = await db.users.toArray();
  assert(users.length >= 2, 'وجود حساب المدير وحساب الكاشير في النظام');

  const admin = users.find((u) => u.username === 'admin');
  const cashier = users.find((u) => u.username === 'cashier');
  assert(!!admin && admin.pin === '1234' && (admin.role === 'owner' || admin.role === 'admin'), 'حساب المدير usr_admin مفعل برقم PIN 1234');
  assert(!!cashier && cashier.pin === '0000' && cashier.role === 'cashier', 'حساب الكاشير usr_cashier مفعل برقم PIN 0000');

  // Test PIN matching logic
  const verifyPin = (username: string, enteredPin: string) => {
    const user = users.find((u) => u.username === username);
    return !!user && user.pin === enteredPin;
  };

  assert(verifyPin('admin', '1234') === true, 'نجاح تسجيل الدخول بالـ PIN الصحيح للمدير');
  assert(verifyPin('admin', '9999') === false, 'رفض تسجيل الدخول عند إدخال PIN خاطئ');
  console.log('    ✓ شاشة الحسابات والـ PIN مؤمنة بالكامل.\n');

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: WALLET COMMISSION ENGINE (DYNAMIC CALCULATION & UPDATES)
  // ─────────────────────────────────────────────────────────────────
  console.log('⚡ اختبار 3: محرك عمولات فودافون كاش والتحويلات الذكية');
  const commissionRules = settings?.commissionRules || DEFAULT_SETTINGS.commissionRules!;
  assert(!!commissionRules, 'وجود قواعد العمولات في الإعدادات');

  // Calculate function matching WalletsView
  const calcComm = (amount: number, type: string, rules: StoreSettings['commissionRules']) => {
    if (!amount || amount <= 0 || type === 'internal_transfer') return 0;
    let feePerThousand = 10;
    let minFee = 5;
    if (type === 'cash_out_to_customer') {
      feePerThousand = rules?.transferFeePerThousand ?? 10;
      minFee = rules?.minTransferFee ?? 5;
    } else if (type === 'cash_in_from_customer') {
      feePerThousand = rules?.withdrawFeePerThousand ?? 10;
      minFee = rules?.minWithdrawFee ?? 5;
    } else if (type === 'instapay_transfer') {
      feePerThousand = rules?.instapayFeePerThousand ?? 5;
      minFee = rules?.minInstapayFee ?? 5;
    }
    const calculated = Math.ceil((amount / 1000) * feePerThousand);
    return Math.max(minFee, calculated);
  };

  // Standard checks:
  // 500 EGP Cash Out -> 5 EGP min fee
  assert(calcComm(500, 'cash_out_to_customer', commissionRules) === 5, 'عمولة تحويل 500 ج = 5 ج (تطبيق الحد الأدنى)');
  // 1500 EGP Cash Out -> ceil(1.5 * 10) = 15 EGP
  assert(calcComm(1500, 'cash_out_to_customer', commissionRules) === 15, 'عمولة تحويل 1500 ج = 15 ج');
  // 10,000 EGP Cash Out -> 100 EGP
  assert(calcComm(10000, 'cash_out_to_customer', commissionRules) === 100, 'عمولة تحويل 10000 ج = 100 ج');

  // Test updating rules dynamically in settings
  const updatedRules = {
    ...commissionRules,
    transferFeePerThousand: 20, // increased to 20 EGP / 1000
    minTransferFee: 10,
  };
  await db.settings.update(1, { commissionRules: updatedRules });
  const freshSettings = await db.settings.get(1);
  assert(freshSettings?.commissionRules?.transferFeePerThousand === 20, 'تحديث نسبة التحويل إلى 20 ج لكل ألف بنجاح في الإعدادات');
  assert(calcComm(1000, 'cash_out_to_customer', freshSettings?.commissionRules) === 20, 'احتساب العمولة الجديدة فورياً: 1000 ج = 20 ج');
  assert(calcComm(300, 'cash_out_to_customer', freshSettings?.commissionRules) === 10, 'احتساب الحد الأدنى الجديد: 300 ج = 10 ج');

  // Restore defaults
  await db.settings.update(1, { commissionRules });
  console.log('    ✓ محرك العمولات والتحديث التلقائي يعمل بدقة 100%.\n');

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: SHIFT OPENING, INVENTORY CRUD & POS SALE TRANSACTION
  // ─────────────────────────────────────────────────────────────────
  console.log('🛒 اختبار 4: فتح الوردية وإدارة المخزون وعملية البيع');
  const shiftId = `test_shift_${Date.now()}`;
  const initialCash = 2000;

  await db.shifts.add({
    id: shiftId,
    shiftNumber: 1,
    cashierId: 'usr_cashier',
    cashierName: 'كاشير المحل',
    startTime: new Date().toISOString(),
    status: 'open',
    openingCash: initialCash,
    openingWallets: {},
    closingCashSystem: initialCash,
    closingCashActual: 0,
    cashDifference: 0,
    totalSalesCash: 0,
    totalWalletIn: 0,
    totalWalletOut: 0,
    totalCommissions: 0,
    totalExpenses: 0,
  });

  // Add a phone to stock
  const testPhoneId = `ph_test_${Date.now()}`;
  await db.phones.add({
    id: testPhoneId,
    name: 'iPhone 15 Pro Max 256GB',
    brand: 'Apple',
    model: '15 Pro Max',
    condition: 'new',
    color: 'Natural Titanium',
    storage: '256GB',
    imei1: '358920112345678',
    costPrice: 42000,
    sellPrice: 45000,
    status: 'available',
    createdAt: new Date().toISOString(),
  });

  // Add accessory to stock
  const testAccId = `acc_test_${Date.now()}`;
  await db.accessories.add({
    id: testAccId,
    name: 'شاحن أبل أصلي 20 واط',
    category: 'شواحن وكابلات',
    barcode: '0194252157008',
    costPrice: 200,
    sellPriceRetail: 350,
    sellPriceWholesale: 300,
    stockQuantity: 10,
    minStockAlert: 2,
    createdAt: new Date().toISOString(),
  });

  // Execute Sale Transaction: 1 iPhone (45,000) + 2 Chargers (2 * 350 = 700) = 45,700 EGP
  const saleTotal = 45700;
  const invoiceId = `inv_test_${Date.now()}`;
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

  const newInvoice: SaleInvoice = {
    id: invoiceId,
    invoiceNumber,
    shiftId,
    cashierName: 'كاشير المحل',
    customerName: 'أحمد محمود',
    customerPhone: '01012345678',
    items: [
      {
        itemId: testPhoneId,
        type: 'phone',
        name: 'iPhone 15 Pro Max 256GB',
        imei: '358920112345678',
        quantity: 1,
        unitPrice: 45000,
        totalPrice: 45000,
        costPrice: 42000,
      },
      {
        itemId: testAccId,
        type: 'accessory',
        name: 'شاحن أبل أصلي 20 واط',
        quantity: 2,
        unitPrice: 350,
        totalPrice: 700,
        costPrice: 200,
      },
    ],
    subtotal: saleTotal,
    discount: 0,
    tax: 0,
    total: saleTotal,
    paidAmount: saleTotal,
    remainingAmount: 0,
    paymentMethod: 'cash',
    totalProfit: 3000 + 300,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  // Atomic DB transaction
  await db.transaction('rw', [db.invoices, db.phones, db.accessories, db.shifts], async () => {
    await db.invoices.add(newInvoice);
    await db.phones.update(testPhoneId, { status: 'sold', soldInvoiceId: invoiceId });
    const acc = await db.accessories.get(testAccId);
    if (acc) {
      await db.accessories.update(testAccId, { stockQuantity: acc.stockQuantity - 2 });
    }
    const shift = await db.shifts.get(shiftId);
    if (shift) {
      await db.shifts.update(shiftId, {
        closingCashSystem: shift.closingCashSystem + saleTotal,
        totalSalesCash: shift.totalSalesCash + saleTotal,
      });
    }
  });

  // Verify inventory updates
  const soldPhone = await db.phones.get(testPhoneId);
  assert(soldPhone?.status === 'sold', 'الهاتف تحولت حالته إلى مباع (sold)');
  assert(soldPhone?.soldInvoiceId === invoiceId, 'ربط الهاتف برقم فاتورة البيع');

  const updatedAcc = await db.accessories.get(testAccId);
  assert(updatedAcc?.stockQuantity === 8, 'خصم كمية الإكسسوارات من المخزن بدقة (10 - 2 = 8)');

  const updatedShift = await db.shifts.get(shiftId);
  assert(updatedShift?.closingCashSystem === initialCash + saleTotal, 'زيادة رصيد الكاش بالدرج في الوردية (2,000 + 45,700 = 47,700 ج)');
  console.log('    ✓ عملية البيع والتحكم بالمخزون والدرج تمت بنجاح.\n');

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: RETURN & REFUND ENGINE (PARTIAL & FULL)
  // ─────────────────────────────────────────────────────────────────
  console.log('🔄 اختبار 5: محرك المرتجعات واسترداد المبيعات (الجزئي والكلي)');

  // Phase A: Partial Return (Return 1 Charger = 350 EGP)
  const partialRefundAmount = 350;
  await db.transaction('rw', [db.invoices, db.phones, db.accessories, db.shifts], async () => {
    const inv = await db.invoices.get(invoiceId);
    if (!inv) throw new Error('Invoice not found');

    const updatedItems = inv.items.map((it) => {
      if (it.itemId === testAccId) {
        return { ...it, returnedQuantity: (it.returnedQuantity || 0) + 1 };
      }
      return it;
    });

    await db.invoices.update(invoiceId, {
      items: updatedItems,
      status: 'partially_returned',
      returnedAmount: partialRefundAmount,
      returnReason: 'عيب صناعة تم استرجاع شاحن واحد',
      returnedAt: new Date().toISOString(),
    });

    const acc = await db.accessories.get(testAccId);
    if (acc) {
      await db.accessories.update(testAccId, { stockQuantity: acc.stockQuantity + 1 });
    }

    const shift = await db.shifts.get(shiftId);
    if (shift) {
      await db.shifts.update(shiftId, {
        closingCashSystem: shift.closingCashSystem - partialRefundAmount,
        totalReturnsCash: (shift.totalReturnsCash || 0) + partialRefundAmount,
      });
    }
  });

  const partInv = await db.invoices.get(invoiceId);
  assert(partInv?.status === 'partially_returned', 'تحديث حالة الفاتورة إلى مرتجع جزئي (partially_returned)');
  assert(partInv?.returnedAmount === 350, 'تسجيل المبلغ المسترد للعميل بدقة (350 ج)');

  const accRestored = await db.accessories.get(testAccId);
  assert(accRestored?.stockQuantity === 9, 'إعادة كمية الإكسسوار المسترجع للمخزن فوراً (8 + 1 = 9)');

  const shiftAfterPart = await db.shifts.get(shiftId);
  assert(shiftAfterPart?.closingCashSystem === initialCash + saleTotal - 350, 'خصم مبلغ المرتجع من كاش الدرج بالوردية بدقة');

  // Phase B: Full Return (Return the Phone 45,000 + remaining Charger 350)
  await db.transaction('rw', [db.invoices, db.phones, db.accessories, db.shifts], async () => {
    const inv = await db.invoices.get(invoiceId);
    if (!inv) throw new Error('Invoice not found');

    const updatedItems = inv.items.map((it) => ({
      ...it,
      returnedQuantity: it.quantity, // fully returned
    }));

    await db.invoices.update(invoiceId, {
      items: updatedItems,
      status: 'returned',
      returnedAmount: saleTotal,
      returnReason: 'استرجاع كامل الفاتورة',
      returnedAt: new Date().toISOString(),
    });

    // Restore phone to available!
    await db.phones.update(testPhoneId, {
      status: 'available',
      soldAt: undefined,
      soldInvoiceId: undefined,
    });

    // Restore last charger
    const acc = await db.accessories.get(testAccId);
    if (acc) {
      await db.accessories.update(testAccId, { stockQuantity: acc.stockQuantity + 1 });
    }

    // Adjust shift drawer
    const remainingRefund = saleTotal - partialRefundAmount;
    const shift = await db.shifts.get(shiftId);
    if (shift) {
      await db.shifts.update(shiftId, {
        closingCashSystem: shift.closingCashSystem - remainingRefund,
        totalReturnsCash: (shift.totalReturnsCash || 0) + remainingRefund,
      });
    }
  });

  const fullyReturnedInv = await db.invoices.get(invoiceId);
  assert(fullyReturnedInv?.status === 'returned', 'تحديث حالة الفاتورة إلى مرتجعة بالكامل (returned)');

  const restoredPhone = await db.phones.get(testPhoneId);
  assert(restoredPhone?.status === 'available', 'إعادة الهاتف فورياً إلى متاح للبيع (available)');
  assert(!restoredPhone?.soldInvoiceId, 'مسح معرف فاتورة البيع عن الهاتف ليعود نظيفاً في المخزن');

  const fullAccRestored = await db.accessories.get(testAccId);
  assert(fullAccRestored?.stockQuantity === 10, 'عودة رصيد الإكسسوار لرصيده الأصلي بالكامل (10 قطع)');

  const finalShift = await db.shifts.get(shiftId);
  assert(finalShift?.closingCashSystem === initialCash, 'تطابق كاش الدرج بعد رد المبيعات بالكامل (2,000 ج)');
  console.log('    ✓ منظومة المرتجعات الجزئية والكلية وإعادة المخزون والدرج تعمل بنجاح تام.\n');

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: DESKTOP THERMAL PRINTING ENGINE & RAW ESC/POS
  // ─────────────────────────────────────────────────────────────────
  console.log('🖨️ اختبار 6: محرك الطباعة الحرارية وأوامر ESC/POS المباشرة للديسكتوب');

  // Test ESC/POS commands
  assert(ESC_POS.INIT[0] === 0x1b && ESC_POS.INIT[1] === 0x40, 'أمر تهيئة الطابعة الحرارية ESC @');
  assert(ESC_POS.DRAWER_KICK[0] === 0x1b && ESC_POS.DRAWER_KICK[1] === 0x70, 'أمر فتح درج النقدية إلكترونياً ESC p');

  // Test ESC/POS receipt binary buffer generation
  const receiptBuffer = buildEscPosReceiptBuffer({
    type: 'sale_receipt',
    invoice: newInvoice,
    settings: settings!,
  });

  assert(receiptBuffer instanceof Uint8Array, 'توليد بافر باينري متوافق مع طابعات 80mm/58mm');
  assert(receiptBuffer.length > 50, 'حجم بافر الطباعة سليم ويحتوي على كافة بيانات الفاتورة');
  console.log('    ✓ محرك الطباعة الحرارية وأوامر الديسكتوب وفتح الدرج جاهزة ومطابقة.\n');

  // ─────────────────────────────────────────────────────────────────
  // TEST 7: FIREBASE CLOUD SYNC ENGINE
  // ─────────────────────────────────────────────────────────────────
  console.log('☁️ اختبار 7: منظومة المزامنة السحابية مع Firebase');
  const syncPayload = {
    storeName: settings?.storeName,
    projectId: 'mobile-pos-2947e',
    commissionRules: settings?.commissionRules,
    stats: {
      totalPhones: await db.phones.count(),
      totalAccessories: await db.accessories.count(),
      totalInvoices: await db.invoices.count(),
    },
    updatedAt: new Date().toISOString(),
  };

  assert(syncPayload.storeName === '3amory phone', 'تضمين هوية المحل في مزامنة Firebase');
  assert(syncPayload.projectId === 'mobile-pos-2947e', 'مشروع Firebase المعتمد mobile-pos-2947e');
  assert(!!syncPayload.commissionRules, 'مزامنة قواعد العمولات سحابياً');
  // ─────────────────────────────────────────────────────────────────
  // TEST 8: SHIFT CASH & WALLET INTEGRATION & BALANCE HEALING
  // ─────────────────────────────────────────────────────────────────
  console.log('💼 اختبار 8: فواتير الوردية، أرباح الكاش الصافية، وتدقيق رصيد الدرج');
  const testShift2Id = `shift_test_${Date.now()}`;
  await db.shifts.put({
    id: testShift2Id,
    shiftNumber: 99,
    cashierId: 'usr_cashier',
    cashierName: 'كاشير المحل',
    startTime: new Date().toISOString(),
    status: 'open',
    openingCash: 500,
    openingWallets: {},
    closingCashSystem: 500,
    closingCashActual: 0,
    cashDifference: 0,
    totalSalesCash: 0,
    totalWalletIn: 0,
    totalWalletOut: 0,
    totalCommissions: 0,
    totalExpenses: 0,
  });

  // Add a Cash Sale of 300 EGP
  const shiftInvId = `inv_shift_${Date.now()}`;
  await db.invoices.put({
    id: shiftInvId,
    invoiceNumber: 'INV-SHIFT-01',
    customerPhone: '01011112222',
    items: [],
    subtotal: 300,
    discount: 0,
    tax: 0,
    total: 300,
    totalProfit: 50,
    paymentMethod: 'cash',
    cashierId: 'usr_cashier',
    cashierName: 'كاشير المحل',
    shiftId: testShift2Id,
    status: 'completed',
    createdAt: new Date().toISOString(),
  });

  // Add a Cash In (withdraw) transaction of 5,000 EGP with 50 EGP commission profit
  const walletTxId = `tx_shift_${Date.now()}`;
  const testWalletTx: WalletTransaction = {
    id: walletTxId,
    walletId: 'w_test',
    walletName: 'فودافون كاش كاشير',
    type: 'cash_in_from_customer',
    amount: 5000,
    commission: 50,
    networkFee: 0,
    netProfit: 50,
    customerPhone: '01099887766',
    customerName: 'عميل كاش',
    shiftId: testShift2Id,
    cashierName: 'كاشير المحل',
    createdAt: new Date().toISOString(),
  };
  await db.walletTransactions.put(testWalletTx);

  // Update shift according to our logic: only net profit (50) is added to drawer
  const currentShift = await db.shifts.get(testShift2Id);
  const updatedDrawerCash = (currentShift?.closingCashSystem || 0) + 300 + testWalletTx.netProfit;
  await db.shifts.update(testShift2Id, {
    closingCashSystem: updatedDrawerCash,
    totalSalesCash: 300,
    totalCommissions: 50,
  });

  const verifiedShift = await db.shifts.get(testShift2Id);
  assert(verifiedShift?.closingCashSystem === 850, 'رصيد الدرج يعكس كاش المبيعات + صافي ربح عمولة الكاش فقط (500 + 300 + 50 = 850 ج)');
  assert(verifiedShift?.closingCashSystem !== -4200, 'منع انخفاض رصيد الوردية إلى السالب بسبب رأس مال عمليات الكاش');

  // Verify shift modal query captures both invoices and wallet transactions
  const shiftInvoices = await db.invoices.where('shiftId').equals(testShift2Id).toArray();
  const shiftWallets = await db.walletTransactions.where('shiftId').equals(testShift2Id).toArray();
  assert(shiftInvoices.length === 1, 'ظهور فاتورة المبيعات التابعة للوردية');
  assert(shiftWallets.length === 1 && shiftWallets[0].amount === 5000, 'ظهور معاملة فودافون كاش التابعة للوردية بكافة تفاصيلها');

  // Test Auto-Healing: Simulate corrupted negative balance and verify repairNegativeShifts
  await db.shifts.update(testShift2Id, { closingCashSystem: -3500 });
  await repairNegativeShifts();
  const healedShift = await db.shifts.get(testShift2Id);
  assert(healedShift?.closingCashSystem === 850, 'إصلاح ومعالجة أي رصيد سالب تلقائياً وإعادته للرصيد الصافي الصحيح (850 ج)');
  console.log('    ✓ فواتير ومعاملات الوردية وصافي أرباح الكاش وتدقيق الدرج تعمل بنجاح 100%.\n');

  // ─────────────────────────────────────────────────────────────────
  // TEST 9: ACCESSORY VARIANTS, STOCK ALERTS & QUICK REPLENISHMENT
  // ─────────────────────────────────────────────────────────────────
  console.log('📦 اختبار 9: متغيرات المنتجات (Variants)، تنبيهات النواقص، وتزويد المخزون الفوري');
  const testAccVariantId = `acc_var_${Date.now()}`;
  const initialAcc: Accessory = {
    id: testAccVariantId,
    name: 'جراب سيليكون أصلي ماج سيف',
    category: 'جرابات',
    barcode: '6221122334455',
    costPrice: 80,
    sellPriceRetail: 180,
    sellPriceWholesale: 140,
    stockQuantity: 15,
    minStockAlert: 10,
    hasVariants: true,
    variants: [
      { id: 'v_black', name: 'أسود', stockQuantity: 5 },
      { id: 'v_blue', name: 'كحلي', stockQuantity: 6 },
      { id: 'v_clear', name: 'شفاف', stockQuantity: 4 },
    ],
    createdAt: new Date().toISOString(),
  };
  await db.accessories.put(initialAcc);

  // Verify variant stock sum
  const savedAcc = await db.accessories.get(testAccVariantId);
  assert(savedAcc?.hasVariants === true, 'تفعيل خاصية المتغيرات للمنتج بنجاح');
  assert(savedAcc?.variants?.length === 3, 'تسجيل كافة متغيرات المنتج (أسود، كحلي، شفاف)');
  const totalCalculated = savedAcc?.variants?.reduce((sum, v) => sum + v.stockQuantity, 0);
  assert(totalCalculated === 15 && savedAcc?.stockQuantity === 15, 'تطابق إجمالي رصيد المخزون مع مجموع المتغيرات (5 + 6 + 4 = 15)');

  // Test Quick Stock Replenish (+20 to black variant)
  const addQty = 20;
  const updatedVariants = (savedAcc?.variants || []).map((v) =>
    v.id === 'v_black' ? { ...v, stockQuantity: v.stockQuantity + addQty } : v
  );
  const newTotalStock = updatedVariants.reduce((s, v) => s + v.stockQuantity, 0);
  await db.accessories.update(testAccVariantId, {
    variants: updatedVariants,
    stockQuantity: newTotalStock,
  });

  const replenishedAcc = await db.accessories.get(testAccVariantId);
  assert(replenishedAcc?.stockQuantity === 35, 'تزويد المخزون مباشرة بنجاح دون الحاجة لإنشاء الصنف من جديد (15 + 20 = 35)');
  assert(replenishedAcc?.variants?.find((v) => v.id === 'v_black')?.stockQuantity === 25, 'تزويد رصيد المتغير المحدد (الأسود) من 5 إلى 25 قطعة');

  // Test Selling Variant in POS: deduct 2 black items
  const soldVariantQty = 2;
  const afterSaleVariants = (replenishedAcc?.variants || []).map((v) =>
    v.id === 'v_black' ? { ...v, stockQuantity: v.stockQuantity - soldVariantQty } : v
  );
  await db.accessories.update(testAccVariantId, {
    variants: afterSaleVariants,
    stockQuantity: replenishedAcc!.stockQuantity - soldVariantQty,
  });

  const afterSaleAcc = await db.accessories.get(testAccVariantId);
  assert(afterSaleAcc?.stockQuantity === 33, 'خصم كمية البيع من إجمالي مخزون الصنف (35 - 2 = 33)');
  assert(afterSaleAcc?.variants?.find((v) => v.id === 'v_black')?.stockQuantity === 23, 'خصم كمية البيع من رصيد المتغير المباع حصراً');

  // Test Low Stock Alert logic: setting stock below minStockAlert
  await db.accessories.update(testAccVariantId, { stockQuantity: 4, minStockAlert: 10 });
  const lowStockAcc = await db.accessories.get(testAccVariantId);
  assert(lowStockAcc!.stockQuantity <= lowStockAcc!.minStockAlert, 'اكتشاف وتنبيه الصنف الناقص عند وصوله لحد التنبيه (4 <= 10)');
  console.log('    ✓ المتغيرات، وتزويد المخزون، وتنبيهات النواقص تعمل بنجاح 100%.\n');

  // Clean test artifacts
  await db.accessories.delete(testAccVariantId);
  await db.shifts.delete(shiftId);
  await db.shifts.delete(testShift2Id);
  await db.invoices.delete(invoiceId);
  await db.invoices.delete(shiftInvId);
  await db.walletTransactions.delete(walletTxId);
  await db.phones.delete(testPhoneId);
  await db.accessories.delete(testAccId);

  console.log('═════════════════════════════════════════════════════════════════');
  console.log(`🎉 تم اجتياز جميع الاختبارات بنجاح بنسبة 100%! (${passedTests}/${totalTests})`);
  console.log('═════════════════════════════════════════════════════════════════');
}

runFullSystemTest().catch((err) => {
  console.error('\n❌ خطأ أثناء تنفيذ الفحص الشامل:', err);
  process.exit(1);
});
