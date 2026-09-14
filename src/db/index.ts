import Dexie, { type Table } from 'dexie';
import { SAMPLE_PHONES, SAMPLE_ACCESSORIES, SAMPLE_WALLETS } from './sampleData';
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
  }
}

export const db = new MobilePosDatabase();

// Default initial settings - 100% customizable by the user
export const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  storeName: '3amory phone',
  storeNameEn: '3amory phone',
  phone1: '',
  phone2: '',
  whatsapp: '',
  address: '',
  taxNumber: '',
  commercialReg: '',
  logoUrl: '/logo-removebg-preview.png',
  receiptHeader: '3amory phone - أهلاً بكم - خدمة متميزة وضمان حقيقي',
  receiptFooter: 'شكراً لتعاملكم مع 3amory phone ونتشرف بزيارتكم دائماً',
  receiptNotes: 'البضاعة المباعة ترد وتستبدل خلال 14 يوماً بالفاتورة وحالتها الأصلية.',
  usedPhoneLegalDisclaimer: 'يقر البائع بكامل أهليته المعتبرة قانوناً بأن الهاتف المذكور ملكه الخالص وليس متحصل من جريمة أو مشبوه، ويتحمل كامل المسؤولية القانونية.',
  maintenanceTerms: 'المحل غير مسؤول عن الأجهزة التي يمر على إصلاحها أكثر من 30 يوماً دون استلام.',
  currency: 'ج.م',
  paperSize: '80mm',
  autoPrintReceipt: true,
  showImeiOnReceipt: true,
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
  qzTrayConfig: {
    enabled: false,
    host: 'localhost',
    port: 8182,
    printerName: '',
    autoPrint: false,
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
    const existingSettings = await db.settings.get(1);
    if (!existingSettings) {
      await db.settings.put({ ...DEFAULT_SETTINGS, id: 1 });
    } else {
      const updates: Partial<StoreSettings> = {};
      if (existingSettings.logoUrl === '/logo.jpeg' || !existingSettings.logoUrl) {
        updates.logoUrl = '/logo-removebg-preview.png';
      }
      if (!existingSettings.storeName || existingSettings.storeName === 'محل الهواتف الذكية' || existingSettings.storeName.includes('البرنس')) {
        updates.storeName = '3amory phone';
        updates.storeNameEn = '3amory phone';
      }
      if (!existingSettings.commissionRules) {
        updates.commissionRules = DEFAULT_SETTINGS.commissionRules;
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

    // Seed realistic sample phones & accessories for testing if empty
    const currentPhonesCount = await db.phones.count();
    const currentAccsCount = await db.accessories.count();
    if (currentPhonesCount === 0 && currentAccsCount === 0) {
      await seedSampleData(false);
    }

    // Seed initial store wallets if none exist
    const currentWalletsCount = await db.wallets.count();
    if (currentWalletsCount === 0) {
      await db.wallets.bulkPut(SAMPLE_WALLETS);
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

    // Clean initial open shift if no open shift exists
    const openShift = await db.shifts.where('status').equals('open').first();
    if (!openShift) {
      const allShifts = await db.shifts.count();
      if (allShifts === 0) {
        await db.shifts.put({
          id: `shift_${Date.now()}`,
          shiftNumber: 1,
          cashierId: 'usr_admin',
          cashierName: 'المدير العام (المالك)',
          startTime: new Date().toISOString(),
          status: 'open',
          openingCash: 0,
          openingWallets: {},
          closingCashSystem: 0,
          closingCashActual: 0,
          cashDifference: 0,
          totalSalesCash: 0,
          totalWalletIn: 0,
          totalWalletOut: 0,
          totalCommissions: 0,
          totalExpenses: 0,
          notes: 'بداية الوردية الافتتاحية للمحل',
        });
      }
    }

    // Auto-heal any shifts that might have negative closingCashSystem
    await repairNegativeShifts();
  } catch (error) {
    console.warn('Database initialization note:', error);
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

