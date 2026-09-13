import Dexie, { type Table } from 'dexie';
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
  storeName: 'محل الهواتف الذكية',
  storeNameEn: 'Smart Mobile Store',
  phone1: '',
  phone2: '',
  whatsapp: '',
  address: '',
  taxNumber: '',
  commercialReg: '',
  logoUrl: '/logo-removebg-preview.png',
  receiptHeader: 'أهلاً بكم - خدمة متميزة وضمان حقيقي',
  receiptFooter: 'شكراً لتعاملكم معنا ونتشرف بزيارتكم دائماً',
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
    } else if (existingSettings.logoUrl === '/logo.jpeg' || !existingSettings.logoUrl) {
      // Auto-update to clean transparent default logo
      await db.settings.update(1, { logoUrl: '/logo-removebg-preview.png' });
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
  } catch (error) {
    console.warn('Database initialization note:', error);
  }
}
