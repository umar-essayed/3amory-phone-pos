export type Role = 'owner' | 'manager' | 'cashier' | 'technician';

export interface StoreSettings {
  id: number;
  storeName: string;
  storeNameEn: string;
  phone1: string;
  phone2: string;
  whatsapp: string;
  address: string;
  taxNumber: string;
  commercialReg: string;
  logoUrl: string;
  receiptHeader: string;
  receiptFooter: string;
  receiptNotes: string;
  usedPhoneLegalDisclaimer: string;
  maintenanceTerms: string;
  currency: string;
  paperSize: '80mm' | '58mm';
  autoPrintReceipt: boolean;
  showImeiOnReceipt: boolean;
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  enableCloudSync: boolean;
  lastSyncTime: string | null;
  lastWeeklyBackupDate?: string;
  commissionRules?: {
    transferFeePerThousand: number; // عمولة تحويل كاش لكل 1000 جنيه
    minTransferFee: number;         // الحد الأدنى لعمولة التحويل
    withdrawFeePerThousand: number; // عمولة سحب كاش لكل 1000 جنيه
    minWithdrawFee: number;         // الحد الأدنى لعمولة السحب
    instapayFeePerThousand: number; // عمولة إنستاباي لكل 1000 جنيه
    minInstapayFee: number;         // الحد الأدنى لعمولة إنستاباي
  };
  selectedPrinter?: string;       // اسم طابعة الفواتير المحددة
  silentPrintEnabled?: boolean;   // تفعيل الطباعة الصامتة المباشرة
  barcodePrinter?: string;        // اسم طابعة ملصقات الباركود
  barcodeLabelSize?: '38x25' | '50x25' | '50x30' | '40x30' | 'custom';
  qzTrayConfig?: {
    enabled?: boolean;
    host?: string;
    port?: number;
    printerName?: string;
    autoPrint?: boolean;
  };
}

export interface User {
  id: string;
  name?: string;
  displayName?: string;
  username: string;
  pin: string;
  role: Role;
  isActive: boolean;
  allowedPages?: string[];
  createdAt: string;
}

export interface Phone {
  id: string;
  name: string;
  brand: string;
  model: string;
  condition: 'new' | 'used';
  imei1: string;
  imei2?: string;
  storage: string;
  color: string;
  batteryHealth?: number;
  physicalCondition?: string;
  hasBox: boolean;
  hasOriginalAccessories: boolean;
  costPrice: number;
  minSellPrice: number;
  sellPrice: number;
  status: 'available' | 'sold' | 'returned';
  sellerInfo?: {
    name: string;
    nationalId: string;
    phone: string;
    nationalIdPhoto?: string;
    notes?: string;
  };
  soldAt?: string;
  soldInvoiceId?: string;
  notes?: string;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  name: string; // e.g. "أسود", "أزرق", "Type-C", "128GB"
  skuOrBarcode?: string;
  stockQuantity: number;
  additionalPrice?: number;
}

export interface Accessory {
  id: string;
  name: string;
  category: string;
  barcode: string;
  costPrice: number;
  sellPriceRetail: number;
  sellPriceWholesale: number;
  stockQuantity: number;
  minStockAlert: number;
  location?: string;
  variants?: ProductVariant[];
  hasVariants?: boolean;
  createdAt: string;
}

export interface StoreWallet {
  id: string;
  name: string;
  type: 'vodafone' | 'instapay' | 'orange' | 'etisalat' | 'we' | 'bank' | 'other';
  phoneNumberOrAccount: string;
  balance: number;
  color: string;
  isActive: boolean;
  dailyLimit?: number;
  monthlyLimit?: number;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  walletName: string;
  type:
    | 'cash_out_to_customer' // إيداع للعميل: العميل يدفع كاش للمحل والمحل يحول لمحفظته
    | 'cash_in_from_customer' // سحب من العميل: العميل يحول لمحفظة المحل والمحل يسلمه كاش
    | 'instapay_transfer'     // تحويل إنستاباي للعميل (إرسال)
    | 'instapay_receive'      // استلام إنستاباي من العميل (استقبال)
    | 'internal_transfer'     // تحويل بين خطوط ومحافظ المحل
    | 'balance_adjustment';   // تعديل رصيد
  amount: number;
  commission: number;
  networkFee: number;
  netProfit: number;
  customerPhone?: string;
  customerName?: string;
  shiftId: string;
  cashierName: string;
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  itemId: string;
  type: 'phone' | 'accessory' | 'repair' | 'service';
  name: string;
  imei?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  costPrice: number;
  returnedQuantity?: number;
  variantId?: string;
  variantName?: string;
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  shiftId: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: 'cash' | 'wallet' | 'instapay' | 'debt' | 'mixed';
  walletId?: string;
  totalProfit: number;
  status: 'completed' | 'returned' | 'partially_returned' | 'canceled';
  returnedAmount?: number;
  returnReason?: string;
  returnedAt?: string;
  createdAt: string;
}

export type RepairStatus =
  | 'received'          // تم الاستلام
  | 'inspecting'        // قيد الفحص
  | 'waiting_approval'  // انتظار موافقة العميل
  | 'in_progress'       // جاري الإصلاح
  | 'repaired'          // تم الإصلاح
  | 'delivered'         // تم التسليم للعميل
  | 'rejected';         // تعذر الإصلاح / مرتجع

export interface RepairTicket {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  imeiOrSerial?: string;
  color?: string;
  passcodeOrPattern: string;
  accessoriesIncluded: string;
  problemDescription: string;
  initialInspection: string;
  technicianName: string;
  technicianCommission: number;
  estimatedCost: number;
  finalCost: number;
  sparePartsCost: number;
  sparePartsUsed: string;
  status: RepairStatus;
  warrantyDays: number;
  receivedAt: string;
  deliveredAt?: string;
  notes?: string;
}

export interface Shift {
  id: string;
  shiftNumber: number;
  cashierId: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  status: 'open' | 'closed';
  openingCash: number;
  openingWallets: Record<string, number>;
  closingCashSystem: number;
  closingCashActual: number;
  cashDifference: number; // actual - system
  totalSalesCash: number;
  totalSalesWallet?: number;
  totalSalesDebt?: number;
  totalSalesCount?: number;
  totalWalletIn: number;
  totalWalletOut: number;
  totalCommissions: number;
  totalExpenses: number;
  totalReturnsCash?: number;
  fawrySalesTotal?: number;
  fawryNetProfit?: number;
  totalNetProfit?: number;
  shortageAction?: 'net_profit' | 'drawer';
  closingWallets?: Record<string, number>;
  closedAt?: string;
  notes?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  shiftId: string;
  recordedBy: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalDebt: number;
  totalPaid: number;
  isVipCash?: boolean; // عميل كاش مميز
  defaultWalletId?: string; // المحفظة المربوطة
  vipBalance?: number; // رصيد حسابه الجاري (موجب = عليه، سالب = له)
  vipTotalSent?: number; // إجمالي التحويلات
  vipTotalReceived?: number; // إجمالي الاستلامات
  vipTotalProfit?: number; // أرباح وعمولات المحل منه
  vipUnsettledProfit?: number; // الأرباح غير المسواة في الوردية بعد
  notes?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  companyName?: string;
  phone: string;
  totalOwed: number;
  totalBalanceDue?: number;
  totalPaid: number;
  notes?: string;
  createdAt: string;
}

export interface SyncQueueItem {
  id: string;
  collection: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: string;
  synced: boolean;
}

export interface DebtTransaction {
  id: string;
  partyType: 'customer' | 'supplier';
  partyId: string;
  partyName: string;
  shiftId?: string;
  type: 'debt_increase' | 'payment' | 'vip_cash_transfer' | 'vip_cash_receive' | 'vip_cash_settlement';
  amount: number;
  commission?: number;
  walletId?: string;
  walletName?: string;
  balanceBefore: number;
  balanceAfter: number;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface SystemPageDef {
  id: string;
  label: string;
}

export const ALL_SYSTEM_PAGES: SystemPageDef[] = [
  { id: 'pos', label: 'نقطة البيع (الكاشير)' },
  { id: 'wallets', label: 'المحافظ والتحويلات' },
  { id: 'phones', label: 'الهواتف الذكية' },
  { id: 'accessories', label: 'الإكسسوارات والقطع' },
  { id: 'barcode', label: 'طباعة الباركود' },
  { id: 'maintenance', label: 'قسم الصيانة' },
  { id: 'shifts', label: 'إدارة الورديات' },
  { id: 'analytics', label: 'التقارير والأرباح' },
  { id: 'accounts', label: 'العملاء والموردين (الآجل)' },
  { id: 'users', label: 'المستخدمين والصلاحيات' },
  { id: 'settings', label: 'إعدادات النظام' },
];

export const DEFAULT_CASHIER_PAGES = ['pos', 'wallets', 'accessories', 'barcode', 'maintenance', 'shifts'];

