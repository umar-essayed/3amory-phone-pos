// ═══════════════════════════════════════════════════════════════════════════
// El Ghandour Phone — Real-Time Firestore Mobile Live Service
// Listens via onSnapshot to cloud updates and falls back seamlessly to local Dexie
// ═══════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { initFirebase } from '../../services/firebase';
import { db as localDb } from '../../db';
import type {
  Shift,
  SaleInvoice,
  StoreWallet,
  WalletTransaction,
  Phone,
  Accessory,
  Customer,
  Supplier,
  Expense,
} from '../../types';

const PROJECT_ID = 'mobile-pos-2947e';

export interface MobileLiveState {
  isCloudConnected: boolean;
  lastUpdated: Date | null;
  openShift: Shift | null;
  shifts: Shift[];
  wallets: StoreWallet[];
  walletTransactions: WalletTransaction[];
  invoices: SaleInvoice[];
  phones: Phone[];
  accessories: Accessory[];
  customers: Customer[];
  suppliers: Supplier[];
  expenses: Expense[];
  summaryStats: {
    totalRevenueToday: number;
    totalProfitToday: number;
    totalCommissionsToday: number;
    totalExpensesToday: number;
    totalWalletsBalance: number;
    cashDrawerExpected: number;
    totalPhonesInStock: number;
    lowStockAccessoriesCount: number;
    vipPendingProfits: number;
  };
}

class FirestoreLiveService {
  private activeUnsubscribes: Unsubscribe[] = [];
  private listeners: Array<(state: MobileLiveState) => void> = [];

  private state: MobileLiveState = {
    isCloudConnected: false,
    lastUpdated: null,
    openShift: null,
    shifts: [],
    wallets: [],
    walletTransactions: [],
    invoices: [],
    phones: [],
    accessories: [],
    customers: [],
    suppliers: [],
    expenses: [],
    summaryStats: {
      totalRevenueToday: 0,
      totalProfitToday: 0,
      totalCommissionsToday: 0,
      totalExpensesToday: 0,
      totalWalletsBalance: 0,
      cashDrawerExpected: 0,
      totalPhonesInStock: 0,
      lowStockAccessoriesCount: 0,
      vipPendingProfits: 0,
    },
  };

  /**
   * Register a subscriber callback for state updates
   */
  public subscribe(listener: (state: MobileLiveState) => void): () => void {
    this.listeners.push(listener);
    // Immediately emit current state
    listener(this.state);

    if (this.listeners.length === 1) {
      this.startLiveStreaming();
    }

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
      if (this.listeners.length === 0) {
        this.stopLiveStreaming();
      }
    };
  }

  public getState(): MobileLiveState {
    return this.state;
  }

  private notify() {
    this.recomputeStats();
    for (const listener of this.listeners) {
      try {
        listener({ ...this.state });
      } catch (err) {
        console.warn('Listener error in mobile live service:', err);
      }
    }
  }

  /**
   * Computes today's live business metrics
   */
  private recomputeStats() {
    const todayStr = new Date().toISOString().slice(0, 10);

    // Invoices today
    const invoicesToday = this.state.invoices.filter((inv) =>
      inv.createdAt?.startsWith(todayStr)
    );
    const totalRevenueToday = invoicesToday.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const invoiceProfitsToday = invoicesToday.reduce(
      (sum, inv) => sum + (inv.totalProfit || 0),
      0
    );

    // Wallet transactions today
    const txToday = this.state.walletTransactions.filter((tx) =>
      tx.createdAt?.startsWith(todayStr)
    );
    const totalCommissionsToday = txToday.reduce(
      (sum, tx) => sum + (tx.netProfit !== undefined ? tx.netProfit : tx.commission || 0),
      0
    );

    // Expenses today
    const expensesToday = this.state.expenses.filter((exp) =>
      exp.createdAt?.startsWith(todayStr)
    );
    const totalExpensesToday = expensesToday.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Wallets total balance
    const totalWalletsBalance = this.state.wallets.reduce(
      (sum, w) => sum + (w.isActive !== false ? w.balance || 0 : 0),
      0
    );

    // Phones in stock
    const totalPhonesInStock = this.state.phones.filter(
      (p) => p.status === 'available'
    ).length;

    // Low stock accessories
    const lowStockAccessoriesCount = this.state.accessories.filter((a) => {
      const minAlert = a.minStockAlert || 5;
      return (a.stockQuantity || 0) <= minAlert;
    }).length;

    // VIP Pending profits
    const vipPendingProfits = this.state.customers.reduce(
      (sum, c) => sum + (c.vipUnsettledProfit || 0),
      0
    );

    // Calculate drawer expected cash from openShift if active
    let cashDrawerExpected = 0;
    const openShift = this.state.openShift;
    if (openShift) {
      const opening = openShift.openingCash || 0;
      const salesCash = openShift.totalSalesCash || 0;
      const walletIn = openShift.totalWalletIn || 0; // cash received for deposits
      const walletOut = openShift.totalWalletOut || 0; // cash paid out for withdrawals
      const fawry = openShift.fawrySalesTotal || 0;
      const expenses = openShift.totalExpenses || 0;
      const returns = openShift.totalReturnsCash || 0;

      cashDrawerExpected = opening + salesCash + walletIn + fawry - walletOut - expenses - returns;
    }

    this.state.summaryStats = {
      totalRevenueToday,
      totalProfitToday: invoiceProfitsToday + totalCommissionsToday - totalExpensesToday,
      totalCommissionsToday,
      totalExpensesToday,
      totalWalletsBalance,
      cashDrawerExpected: Math.max(0, cashDrawerExpected),
      totalPhonesInStock,
      lowStockAccessoriesCount,
      vipPendingProfits,
    };
    this.state.lastUpdated = new Date();
  }

  /**
   * Initializes real-time listeners on Firestore collections
   */
  private async startLiveStreaming() {
    this.stopLiveStreaming();

    // 1. Initial rapid load from local Dexie (instant 0ms response)
    await this.loadFromLocalDexie();

    // 2. Connect to Firebase Firestore
    try {
      const fDb = initFirebase();
      if (!fDb) {
        this.state.isCloudConnected = false;
        this.notify();
        return;
      }

      // We have Firestore connection
      this.state.isCloudConnected = true;

      // ── Sub: Shifts ──────────────────────────────────────────────
      const shiftsRef = collection(fDb, 'stores', PROJECT_ID, 'shifts');
      const shiftsQuery = query(shiftsRef, orderBy('shiftNumber', 'desc'), limit(25));
      const unSubShifts = onSnapshot(
        shiftsQuery,
        (snapshot) => {
          const list: Shift[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as Shift);
          });
          this.state.shifts = list;
          this.state.openShift = list.find((s) => s.status === 'open') || null;
          this.notify();
        },
        (err) => console.warn('Live shifts listener error:', err)
      );
      this.activeUnsubscribes.push(unSubShifts);

      // ── Sub: Wallets ─────────────────────────────────────────────
      const walletsRef = collection(fDb, 'stores', PROJECT_ID, 'wallets');
      const unSubWallets = onSnapshot(
        walletsRef,
        (snapshot) => {
          const list: StoreWallet[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as StoreWallet);
          });
          if (list.length > 0) {
            this.state.wallets = list;
            this.notify();
          }
        },
        (err) => console.warn('Live wallets listener error:', err)
      );
      this.activeUnsubscribes.push(unSubWallets);

      // ── Sub: Wallet Transactions ─────────────────────────────────
      const walletTxRef = collection(fDb, 'stores', PROJECT_ID, 'walletTransactions');
      const walletTxQuery = query(walletTxRef, orderBy('createdAt', 'desc'), limit(60));
      const unSubTx = onSnapshot(
        walletTxQuery,
        (snapshot) => {
          const list: WalletTransaction[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as WalletTransaction);
          });
          if (list.length > 0) {
            this.state.walletTransactions = list;
            this.notify();
          }
        },
        (err) => console.warn('Live wallet tx listener error:', err)
      );
      this.activeUnsubscribes.push(unSubTx);

      // ── Sub: Invoices ────────────────────────────────────────────
      const invoicesRef = collection(fDb, 'stores', PROJECT_ID, 'invoices');
      const invoicesQuery = query(invoicesRef, orderBy('createdAt', 'desc'), limit(50));
      const unSubInvoices = onSnapshot(
        invoicesQuery,
        (snapshot) => {
          const list: SaleInvoice[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as SaleInvoice);
          });
          if (list.length > 0) {
            this.state.invoices = list;
            this.notify();
          }
        },
        (err) => console.warn('Live invoices listener error:', err)
      );
      this.activeUnsubscribes.push(unSubInvoices);

      // ── Sub: Phones ──────────────────────────────────────────────
      const phonesRef = collection(fDb, 'stores', PROJECT_ID, 'phones');
      const unSubPhones = onSnapshot(
        phonesRef,
        (snapshot) => {
          const list: Phone[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as Phone);
          });
          if (list.length > 0) {
            this.state.phones = list;
            this.notify();
          }
        },
        (err) => console.warn('Live phones listener error:', err)
      );
      this.activeUnsubscribes.push(unSubPhones);

      // ── Sub: Accessories ─────────────────────────────────────────
      const accessoriesRef = collection(fDb, 'stores', PROJECT_ID, 'accessories');
      const unSubAccessories = onSnapshot(
        accessoriesRef,
        (snapshot) => {
          const list: Accessory[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as Accessory);
          });
          if (list.length > 0) {
            this.state.accessories = list;
            this.notify();
          }
        },
        (err) => console.warn('Live accessories listener error:', err)
      );
      this.activeUnsubscribes.push(unSubAccessories);

      // ── Sub: Expenses ────────────────────────────────────────────
      const expensesRef = collection(fDb, 'stores', PROJECT_ID, 'expenses');
      const expensesQuery = query(expensesRef, orderBy('createdAt', 'desc'), limit(40));
      const unSubExpenses = onSnapshot(
        expensesQuery,
        (snapshot) => {
          const list: Expense[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as Expense);
          });
          if (list.length > 0) {
            this.state.expenses = list;
            this.notify();
          }
        },
        (err) => console.warn('Live expenses listener error:', err)
      );
      this.activeUnsubscribes.push(unSubExpenses);

      // ── Sub: Customers ───────────────────────────────────────────
      const customersRef = collection(fDb, 'stores', PROJECT_ID, 'customers');
      const unSubCustomers = onSnapshot(
        customersRef,
        (snapshot) => {
          const list: Customer[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as Customer);
          });
          if (list.length > 0) {
            this.state.customers = list;
            this.notify();
          }
        },
        (err) => console.warn('Live customers listener error:', err)
      );
      this.activeUnsubscribes.push(unSubCustomers);

      // ── Sub: Suppliers ───────────────────────────────────────────
      const suppliersRef = collection(fDb, 'stores', PROJECT_ID, 'suppliers');
      const unSubSuppliers = onSnapshot(
        suppliersRef,
        (snapshot) => {
          const list: Supplier[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...docSnap.data(), id: docSnap.id } as Supplier);
          });
          if (list.length > 0) {
            this.state.suppliers = list;
            this.notify();
          }
        },
        (err) => console.warn('Live suppliers listener error:', err)
      );
      this.activeUnsubscribes.push(unSubSuppliers);

      // ── Sub: Store Metadata Document ──────────────────────────────
      const storeDocRef = doc(fDb, 'stores', PROJECT_ID);
      const unSubStore = onSnapshot(
        storeDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            this.state.isCloudConnected = true;
            this.notify();
          }
        },
        (err) => console.warn('Live store metadata error:', err)
      );
      this.activeUnsubscribes.push(unSubStore);
    } catch (err) {
      console.warn('Error starting Firestore subscriptions:', err);
      this.state.isCloudConnected = false;
      this.notify();
    }
  }

  /**
   * Fallback loader from local Dexie database
   */
  public async loadFromLocalDexie() {
    try {
      const [
        shifts,
        wallets,
        walletTx,
        invoices,
        phones,
        accessories,
        expenses,
        customers,
        suppliers,
      ] = await Promise.all([
        localDb.shifts.orderBy('shiftNumber').reverse().limit(30).toArray(),
        localDb.wallets.toArray(),
        localDb.walletTransactions.orderBy('createdAt').reverse().limit(60).toArray(),
        localDb.invoices.orderBy('createdAt').reverse().limit(50).toArray(),
        localDb.phones.toArray(),
        localDb.accessories.toArray(),
        localDb.expenses.orderBy('createdAt').reverse().limit(40).toArray(),
        localDb.customers.toArray(),
        localDb.suppliers.toArray(),
      ]);

      this.state.shifts = shifts;
      this.state.openShift = shifts.find((s) => s.status === 'open') || null;
      this.state.wallets = wallets;
      this.state.walletTransactions = walletTx;
      this.state.invoices = invoices;
      this.state.phones = phones;
      this.state.accessories = accessories;
      this.state.expenses = expenses;
      this.state.customers = customers;
      this.state.suppliers = suppliers;

      this.notify();
    } catch (err) {
      console.warn('Load from Dexie note in mobile service:', err);
    }
  }

  /**
   * Unsubscribe from all active listeners
   */
  public stopLiveStreaming() {
    for (const unsub of this.activeUnsubscribes) {
      try {
        unsub();
      } catch (err) {
        console.warn('Unsub error:', err);
      }
    }
    this.activeUnsubscribes = [];
  }
}

export const firestoreLiveService = new FirestoreLiveService();
