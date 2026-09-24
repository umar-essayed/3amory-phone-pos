import Dexie, { type Table } from 'dexie';
import { SAMPLE_PHONES, SAMPLE_ACCESSORIES, SAMPLE_WALLETS } from './sampleData';
import { systemLogger } from '../services/logger';
import type {
  StoreSettings,
  User,
  Phone,
  Accessory,
  StoreWallet,
  WalletTransaction,
  SaleInvoice,
  RepairTicket,
  Shift,
  Expense,
  Customer,
  Supplier,
  SyncQueueItem,
  DebtTransaction,
} from '../types';

export class MobilePosDatabase extends Dexie {
  settings!: Table<StoreSettings, number>;
  users!: Table<User, string>;
  phones!: Table<Phone, string>;
  accessories!: Table<Accessory, string>;
  wallets!: Table<StoreWallet, string>;
  walletTransactions!: Table<WalletTransaction, string>;
  invoices!: Table<SaleInvoice, string>;
  repairs!: Table<RepairTicket, string>;
  shifts!: Table<Shift, string>;
  expenses!: Table<Expense, string>;
  customers!: Table<Customer, string>;
  suppliers!: Table<Supplier, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  debtTransactions!: Table<DebtTransaction, string>;

  constructor() {
    super('MobilePosDatabase');

    this.version(1).stores({
      settings: '++id',
      users: 'id, username, pin, role, isActive',
      phones: 'id, name, brand, condition, imei1, imei2, status, createdAt',
      accessories: 'id, name, category, barcode, stockQuantity, createdAt',
      wallets: 'id, name, type, phoneNumberOrAccount, isActive',
      walletTransactions: 'id, walletId, type, shiftId, customerPhone, createdAt',
      invoices: 'id, invoiceNumber, shiftId, paymentMethod, status, createdAt',
      repairs: 'id, ticketNumber, customerPhone, imeiOrSerial, status, receivedAt',
      shifts: 'id, shiftNumber, cashierId, status, startTime',
      expenses: 'id, shiftId, category, createdAt',
      customers: 'id, name, phone',
      suppliers: 'id, name, phone',
      syncQueue: 'id, collection, synced, timestamp',
    });

    this.version(2).stores({
      debtTransactions: 'id, partyType, partyId, shiftId, type, createdAt',
    });

    // Multi-tab concurrency & version change handler
    this.on('versionchange', () => {
      this.close();
      return false;
    });
  }
}

export const db = new MobilePosDatabase();

// Default initial settings - 100% customizable by the user
export const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  storeName: 'الغندور فون',
  storeNameEn: 'El Ghandour Phone',
  phone1: '',
  phone2: '',
  whatsapp: '',
  address: '',
  taxNumber: '',
  commercialReg: '',
  logoUrl: '/logo-removebg-preview.png',
  receiptHeader: 'الغندور فون - أهلاً بكم - خدمة متميزة وضمان حقيقي',
  receiptFooter: 'شكراً لتعاملكم مع الغندور فون ونتشرف بزيارتكم دائماً',
  receiptNotes: 'البضاعة المباعة ترد وتستبدل خلال 14 يوماً بالفاتورة وحالتها الأصلية.',
  usedPhoneLegalDisclaimer: 'يقر البائع بكامل أهليته المعتبرة قانوناً بأن الهاتف المذكور ملكه الخالص وليس متحصل من جريمة أو مشبوه، ويتحمل كامل المسؤولية القانونية.',
  maintenanceTerms: 'المحل غير مسؤول عن الأجهزة التي يمر على إصلاحها أكثر من 30 يوماً دون استلام.',
  currency: 'ج.م',
  paperSize: '80mm',
  autoPrintReceipt: false,
  showImeiOnReceipt: true,
  selectedPrinter: '',
  silentPrintEnabled: false,
  barcodePrinter: '',
  barcodeLabelSize: '50x25',
  firebaseConfig: {
    apiKey: '',
    authDomain: '',
    projectId: 'mobile-pos-2947e',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  enableCloudSync: true,
  lastSyncTime: null,
  commissionRules: {
    transferFeePerThousand: 10,
    minTransferFee: 5,
    withdrawFeePerThousand: 10,
    minWithdrawFee: 5,
    instapayFeePerThousand: 5,
    minInstapayFee: 5,
  },
};

let initPromise: Promise<void> | null = null;

// Seed database with clean production data safely (idempotent with bulkPut)
export function initializeDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = doInitializeDatabase();
  }
  return initPromise;
}

async function doInitializeDatabase() {
  try {
    await systemLogger.logInit('بدء فحص وتهيئة جداول قاعدة البيانات المحلية (Dexie IndexedDB)...');
    const existingSettings = await db.settings.get(1);
    if (!existingSettings) {
      await db.settings.put({ ...DEFAULT_SETTINGS, id: 1 });
    } else {
      const updates: Partial<StoreSettings> = {};
      if (existingSettings.logoUrl === '/logo.jpeg' || !existingSettings.logoUrl) {
        updates.logoUrl = '/logo-removebg-preview.png';
      }
      if (
        !existingSettings.storeName ||
        existingSettings.storeName === '3amory phone' ||
        existingSettings.storeName.includes('عموري') ||
        existingSettings.storeName === 'محل الهواتف الذكية' ||
        existingSettings.storeName.includes('البرنس')
      ) {
        updates.storeName = 'الغندور فون';
        updates.storeNameEn = 'El Ghandour Phone';
      }
      if (existingSettings.receiptHeader?.includes('3amory phone') || existingSettings.receiptHeader?.includes('عموري')) {
        updates.receiptHeader = 'الغندور فون - أهلاً بكم - خدمة متميزة وضمان حقيقي';
      }
      if (existingSettings.receiptFooter?.includes('3amory phone') || existingSettings.receiptFooter?.includes('عموري')) {
        updates.receiptFooter = 'شكراً لتعاملكم مع الغندور فون ونتشرف بزيارتكم دائماً';
      }
      if (!existingSettings.commissionRules) {
        updates.commissionRules = DEFAULT_SETTINGS.commissionRules;
      }
      if (existingSettings.autoPrintReceipt) {
        updates.autoPrintReceipt = false;
      }
      if (Object.keys(updates).length > 0) {
        await db.settings.update(1, updates);
      }
    }

    // Clean up any previously seeded mock items
    const mockPhones = await db.phones.where('id').anyOf(['ph_1', 'ph_2', 'ph_3']).toArray();
    if (mockPhones.length > 0) {
      await db.phones.bulkDelete(mockPhones.map((p) => p.id));
    }

    const mockAccs = await db.accessories.where('id').anyOf(['acc_1', 'acc_2', 'acc_3', 'acc_4']).toArray();
    if (mockAccs.length > 0) {
      await db.accessories.bulkDelete(mockAccs.map((a) => a.id));
    }

    const mockWallets = await db.wallets.where('id').anyOf(['wlt_vodafone_1', 'wlt_vodafone_2', 'wlt_instapay', 'wlt_orange', 'wlt_etisalat']).toArray();
    if (mockWallets.length > 0) {
      await db.wallets.bulkDelete(mockWallets.map((w) => w.id));
    }

    // Ensure 100% clean production database (Zero mock/sample data on fresh launch)
    const existingDemoPhones = await db.phones.where('id').startsWith('demo_').toArray();
    if (existingDemoPhones.length > 0) {
      await db.phones.bulkDelete(existingDemoPhones.map((p) => p.id));
    }
    const existingDemoAccs = await db.accessories.where('id').startsWith('demo_').toArray();
    if (existingDemoAccs.length > 0) {
      await db.accessories.bulkDelete(existingDemoAccs.map((a) => a.id));
    }
    const existingDemoWallets = await db.wallets.where('id').startsWith('demo_').toArray();
    if (existingDemoWallets.length > 0) {
      await db.wallets.bulkDelete(existingDemoWallets.map((w) => w.id));
    }

    // Seed clean initial users (Admin & Cashier) if empty
    const usersCount = await db.users.count();
    if (usersCount === 0) {
      await db.users.bulkPut([
        {
          id: 'usr_admin',
          name: 'المدير العام (المالك)',
          displayName: 'المدير العام (المالك)',
          username: 'admin',
          pin: '1234',
          role: 'owner',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'usr_cashier',
          name: 'كاشير المحل',
          displayName: 'كاشير المحل',
          username: 'cashier',
          pin: '0000',
          role: 'cashier',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    // Shifts are strictly opened manually by the user or cashier. No automatic shift is created.

    // Auto-heal accessories: ensure wholesale price and cost price are unified
    const allAccs = await db.accessories.toArray();
    for (const acc of allAccs) {
      const effectiveWholesale = acc.costPrice > 0 ? acc.costPrice : (acc.sellPriceWholesale || 0);
      if (acc.costPrice !== effectiveWholesale || acc.sellPriceWholesale !== effectiveWholesale) {
        await db.accessories.update(acc.id, {
          costPrice: effectiveWholesale,
          sellPriceWholesale: effectiveWholesale,
        });
      }
    }

    // Auto-heal invoices: ensure totalProfit reflects selling price minus wholesale cost
    const allInvoices = await db.invoices.toArray();
    for (const inv of allInvoices) {
      if (inv.items && inv.items.length > 0) {
        const calculatedItemsProfit = inv.items.reduce((sum, item) => {
          const buyPrice = item.costPrice > 0 ? item.costPrice : ((item as any).wholesalePrice || 0);
          const returnedQty = item.returnedQuantity || 0;
          const soldQty = Math.max(0, item.quantity - returnedQty);
          return sum + (item.unitPrice - buyPrice) * soldQty;
        }, 0);
        const accurateProfit = Math.max(0, calculatedItemsProfit - (inv.discount || 0));
        if (inv.totalProfit !== accurateProfit && accurateProfit > 0) {
          await db.invoices.update(inv.id, { totalProfit: accurateProfit });
        }
      }
    }

    // Auto-heal any shifts that might have negative closingCashSystem
    await repairNegativeShifts();

    await systemLogger.logInit('اكتملت تهيئة قاعدة البيانات المحلية بنجاح وجاهزة للاستخدام.');
  } catch (error: any) {
    console.warn('Database initialization note:', error);
    await systemLogger.logInit(`فشل في تهيئة قاعدة البيانات المحلية: ${error?.message || error}`, true, error);
    await systemLogger.logError(`Dexie DB Initialization Error: ${error?.message || error}`, error, 'DatabaseInit');
  }
}

export async function repairNegativeShifts(): Promise<void> {
  try {
    const shifts = await db.shifts.toArray();
    for (const shift of shifts) {
      if (shift.closingCashSystem < 0) {
        const cashInvoices = await db.invoices.where('shiftId').equals(shift.id).toArray();
        const cashSales = cashInvoices
          .filter((inv) => inv.paymentMethod === 'cash')
          .reduce((sum, inv) => sum + inv.total, 0);
        const cashReturns = cashInvoices
          .filter((inv) => inv.paymentMethod === 'cash')
          .reduce((sum, inv) => sum + (inv.returnedAmount || 0), 0);

        const walletTxs = await db.walletTransactions.where('shiftId').equals(shift.id).toArray();
        const commissions = walletTxs.reduce((sum, tx) => sum + (tx.netProfit ?? tx.commission ?? 0), 0);

        const shiftExpenses = await db.expenses.where('shiftId').equals(shift.id).toArray();
        const expensesTotal = shiftExpenses.reduce((sum, exp) => sum + exp.amount, 0);

        const trueSystemCash = Math.max(
          0,
          (shift.openingCash || 0) + cashSales + commissions - expensesTotal - cashReturns
        );

        await db.shifts.update(shift.id, {
          closingCashSystem: trueSystemCash,
          totalSalesCash: cashSales,
          totalCommissions: commissions,
          totalExpenses: expensesTotal,
          totalReturnsCash: cashReturns,
        });
      }
    }
  } catch (err) {
    console.warn('Shift balance repair note:', err);
  }
}

/**
 * Seeds or re-seeds sample phones, accessories with variants, and store wallets
 */
export async function seedSampleData(force = false): Promise<{ addedPhones: number; addedAccs: number; addedWallets: number }> {
  let addedPhones = 0;
  let addedAccs = 0;
  let addedWallets = 0;

  const currentPhones = await db.phones.count();
  if (force || currentPhones === 0) {
    await db.phones.bulkPut(SAMPLE_PHONES);
    addedPhones = SAMPLE_PHONES.length;
  }

  const currentAccs = await db.accessories.count();
  if (force || currentAccs === 0) {
    await db.accessories.bulkPut(SAMPLE_ACCESSORIES);
    addedAccs = SAMPLE_ACCESSORIES.length;
  }

  const currentWallets = await db.wallets.count();
  if (force || currentWallets === 0) {
    await db.wallets.bulkPut(SAMPLE_WALLETS);
    addedWallets = SAMPLE_WALLETS.length;
  }

  return { addedPhones, addedAccs, addedWallets };
}

/**
 * Clears all demo phones, accessories, and wallets from the database
 */
export async function clearDemoData(): Promise<void> {
  if (typeof window !== 'undefined') {
    window.localStorage?.setItem('demo_data_cleared', 'true');
  }
  const allPhones = await db.phones.toArray();
  const demoPhones = allPhones.filter((p) => p.id.startsWith('demo_'));
  if (demoPhones.length > 0) {
    await db.phones.bulkDelete(demoPhones.map((p) => p.id));
  }

  const allAccs = await db.accessories.toArray();
  const demoAccs = allAccs.filter((a) => a.id.startsWith('demo_'));
  if (demoAccs.length > 0) {
    await db.accessories.bulkDelete(demoAccs.map((a) => a.id));
  }

  const allWallets = await db.wallets.toArray();
  const demoWallets = allWallets.filter((w) => w.id.startsWith('demo_'));
  if (demoWallets.length > 0) {
    await db.wallets.bulkDelete(demoWallets.map((w) => w.id));
  }
}

// Attach helpers to window for easy developer control in browser console
if (typeof window !== 'undefined') {
  (window as any).seedDemoData = () => {
    window.localStorage?.removeItem('demo_data_cleared');
    return seedSampleData(true);
  };
  (window as any).clearDemoData = clearDemoData;
}


