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
    super('MobilePosDB');
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
  storeName: 'البرنس لمهمات وهواتف المحمول',
  storeNameEn: 'El-Prince Mobile Store',
  phone1: '01012345678',
  phone2: '01298765432',
  whatsapp: '01012345678',
  address: 'مصر - القاهرة - شارع التحرير الرئيسي أمام محطة المترو',
  taxNumber: '123-456-789',
  commercialReg: '987654',
  logoUrl: '/logo.jpeg',
  receiptHeader: 'أهلاً بكم في محلكم المفضل لخدمات ومبيعات الهواتف الذكية',
  receiptFooter: 'شكراً لتعاملكم معنا ونتشرف بزيارتكم دائماً',
  receiptNotes: 'البضاعة المباعة ترد خلال 14 يوماً بحالتها الأصلية بالفاتورة. الأجهزة المستعملة مشمولة بضمان تجربة 3 أيام.',
  usedPhoneLegalDisclaimer: 'يقر البائع بكامل أهليته المعتبرة قانوناً بأن الهاتف المذكور ملكه الخالص وليس متحصل من جريمة أو مشبوه، ويتحمل كامل المسؤولية الجنائية والمدنية.',
  maintenanceTerms: 'المحل غير مسؤول عن الأجهزة التي يمر على إصلاحها أكثر من 30 يوماً دون استلام. يُرجى الاحتفاظ بهذا الإيصال للاستلام.',
  currency: 'ج.م',
  paperSize: '80mm',
  autoPrintReceipt: true,
  showImeiOnReceipt: true,
  firebaseConfig: {
    apiKey: '',
    authDomain: 'mobile-pos-2947e.firebaseapp.com',
    projectId: 'mobile-pos-2947e',
    storageBucket: 'mobile-pos-2947e.appspot.com',
    messagingSenderId: '',
    appId: '',
  },
  enableCloudSync: true,
  lastSyncTime: null,
};

let initPromise: Promise<void> | null = null;

// Seed database with initial data safely (idempotent with bulkPut)
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
    }

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
        {
          id: 'usr_tech',
          name: 'فني الصيانة',
          displayName: 'فني الصيانة',
          username: 'tech',
          pin: '1111',
          role: 'technician',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    const walletsCount = await db.wallets.count();
    if (walletsCount === 0) {
      await db.wallets.bulkPut([
      {
        id: 'wlt_vodafone_1',
        name: 'فودافون كاش - خط المحل 1',
        type: 'vodafone',
        phoneNumberOrAccount: '01099887766',
        balance: 5000,
        color: '#e60000',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'wlt_vodafone_2',
        name: 'فودافون كاش - خط المحل 2',
        type: 'vodafone',
        phoneNumberOrAccount: '01011223344',
        balance: 3200,
        color: '#e60000',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'wlt_instapay',
        name: 'إنستاباي - حساب بنك مصر',
        type: 'instapay',
        phoneNumberOrAccount: 'prince.store@instapay',
        balance: 12500,
        color: '#800080',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'wlt_orange',
        name: 'أورنج كاش',
        type: 'orange',
        phoneNumberOrAccount: '01200112233',
        balance: 2000,
        color: '#ff6600',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'wlt_etisalat',
        name: 'اتصالات كاش',
        type: 'etisalat',
        phoneNumberOrAccount: '01122334455',
        balance: 2500,
        color: '#719e19',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  const phonesCount = await db.phones.count();
  if (phonesCount === 0) {
    await db.phones.bulkPut([
      {
        id: 'ph_1',
        name: 'iPhone 15 Pro Max',
        brand: 'Apple',
        model: 'A2849',
        condition: 'new',
        imei1: '354892019283741',
        imei2: '354892019283742',
        storage: '256GB',
        color: 'تيتانيوم طبيعي (Natural)',
        hasBox: true,
        hasOriginalAccessories: true,
        costPrice: 58000,
        minSellPrice: 61500,
        sellPrice: 62900,
        status: 'available',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ph_2',
        name: 'Samsung Galaxy S24 Ultra',
        brand: 'Samsung',
        model: 'SM-S928B',
        condition: 'new',
        imei1: '356782910394851',
        storage: '512GB',
        color: 'رمادي تيتانيوم',
        hasBox: true,
        hasOriginalAccessories: true,
        costPrice: 51000,
        minSellPrice: 53500,
        sellPrice: 54500,
        status: 'available',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ph_3',
        name: 'iPhone 13',
        brand: 'Apple',
        model: 'A2633',
        condition: 'used',
        imei1: '359012489201923',
        storage: '128GB',
        color: 'أزرق (Midnight Blue)',
        batteryHealth: 87,
        physicalCondition: 'كسر زيرو - بدون أي خدوش',
        hasBox: true,
        hasOriginalAccessories: false,
        costPrice: 20500,
        minSellPrice: 22000,
        sellPrice: 22900,
        status: 'available',
        sellerInfo: {
          name: 'محمد إبراهيم السيد',
          nationalId: '29508140102938',
          phone: '01065432109',
          notes: 'تم فحص الشاشة والبطارية والوجه Face ID وكلهم أصليين',
        },
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  const accCount = await db.accessories.count();
  if (accCount === 0) {
    await db.accessories.bulkPut([
      {
        id: 'acc_1',
        name: 'شاحن أصلي Apple 20W USB-C',
        category: 'شواحن',
        barcode: '194252157007',
        costPrice: 420,
        sellPriceRetail: 650,
        sellPriceWholesale: 500,
        stockQuantity: 24,
        minStockAlert: 5,
        location: 'درج الشواحن A1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'acc_2',
        name: 'سكرينة حماية زجاجية 11D لجميع هواتف آيفون',
        category: 'سكرينات',
        barcode: '692138472910',
        costPrice: 15,
        sellPriceRetail: 50,
        sellPriceWholesale: 25,
        stockQuantity: 150,
        minStockAlert: 20,
        location: 'استاند السكرينات',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'acc_3',
        name: 'جراب سيليكون MagSafe فخم لآيفون',
        category: 'جرابات',
        barcode: '694820192834',
        costPrice: 60,
        sellPriceRetail: 150,
        sellPriceWholesale: 90,
        stockQuantity: 40,
        minStockAlert: 10,
        location: 'استاند الجرابات B2',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'acc_4',
        name: 'سماعة Joyroom Pro اللاسلكية ANC',
        category: 'سماعات',
        barcode: '697420192019',
        costPrice: 650,
        sellPriceRetail: 950,
        sellPriceWholesale: 780,
        stockQuantity: 12,
        minStockAlert: 3,
        location: 'فاترينة السماعات',
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  // Check active shift or create initial shift
  const openShift = await db.shifts.where('status').equals('open').first();
  if (!openShift) {
    const shift1 = await db.shifts.get('shift_1');
    if (!shift1) {
      await db.shifts.put({
        id: 'shift_1',
        shiftNumber: 1,
        cashierId: 'usr_admin',
        cashierName: 'المدير العام (المالك)',
        startTime: new Date().toISOString(),
        status: 'open',
        openingCash: 2500,
        openingWallets: {
          wlt_vodafone_1: 5000,
          wlt_vodafone_2: 3200,
          wlt_instapay: 12500,
          wlt_orange: 2000,
          wlt_etisalat: 2500,
        },
        closingCashSystem: 2500,
        closingCashActual: 0,
        cashDifference: 0,
        totalSalesCash: 0,
        totalWalletIn: 0,
        totalWalletOut: 0,
        totalCommissions: 0,
        totalExpenses: 0,
        notes: 'وردية افتتاح النظام',
      });
    }
  }
  } catch (error) {
    console.warn('Database initialization note:', error);
  }
}
