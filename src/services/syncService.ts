// ═══════════════════════════════════════════════════════════════════════════
// 3amory phone - High-Speed Offline-First 2-Way Cloud Sync Engine
// Writes to local IndexedDB in 0ms, queues in background, and auto-syncs with Firebase
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '../db';
import { initFirebase } from './firebase';
import { systemLogger } from './logger';
import { backupService } from './backupService';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = 'mobile-pos-2947e';

class SyncService {
  public isMuted = false;
  private isProcessingQueue = false;
  private syncTimer: any = null;

  constructor() {
    this.setupListeners();
  }

  public muteSync() {
    this.isMuted = true;
  }

  public unmuteSync() {
    this.isMuted = false;
  }

  private setupListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      systemLogger.logInit('الاتصال بالإنترنت عاد للعمل. بدء تصفية طابور المزامنة السحابية تلقائياً.');
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      systemLogger.logInit('انقطع الاتصال بالإنترنت. النظام يعمل بكامل سرعته محلياً (Offline-First).');
    });
  }

  /**
   * Starts background interval that checks sync queue every 30 seconds
   */
  public startSyncWorker() {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.processSyncQueue();
      }
    }, 30000);
  }

  /**
   * Enqueue a local change for asynchronous cloud synchronization
   * Returns immediately so UI / Cashier is never blocked.
   */
  public async enqueueChange(
    collectionName: string,
    docId: string,
    action: 'put' | 'delete' = 'put',
    data?: any
  ): Promise<void> {
    try {
      await db.syncQueue.put({
        id: `${collectionName}_${docId}_${Date.now()}`,
        collection: collectionName,
        docId,
        action,
        data,
        timestamp: Date.now(),
        synced: false,
      } as any);

      // Auto-save persistent local DB mirror
      backupService.saveDatabaseMirror().catch(() => {});

      // If currently online, trigger background flush immediately without waiting for timer
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setTimeout(() => {
          this.processSyncQueue().catch(() => {});
        }, 50);
      }
    } catch (err) {
      console.warn('Enqueue sync item note:', err);
    }
  }

  /**
   * Drains the pending sync queue and sends changes to Firestore
   */
  public async processSyncQueue(): Promise<{ processed: number; remaining: number }> {
    if (this.isProcessingQueue) return { processed: 0, remaining: 0 };
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { processed: 0, remaining: 0 };

    this.isProcessingQueue = true;
    let processedCount = 0;

    try {
      const fDb = initFirebase();
      if (!fDb) {
        this.isProcessingQueue = false;
        return { processed: 0, remaining: 0 };
      }

      const pendingItems = await db.syncQueue.toArray();
      if (pendingItems.length === 0) {
        this.isProcessingQueue = false;
        return { processed: 0, remaining: 0 };
      }

      for (const item of pendingItems) {
        const itemAny = item as any;
        const colName = itemAny.collection;
        const dId = itemAny.docId || item.id;
        const action = itemAny.action || 'put';
        const docRef = doc(fDb, 'stores', PROJECT_ID, colName, dId);

        try {
          if (action === 'delete') {
            await deleteDoc(docRef);
          } else {
            const dataToUpload = itemAny.data || {};
            await setDoc(docRef, dataToUpload, { merge: true });
          }

          // Remove successfully uploaded item from queue
          await db.syncQueue.delete(item.id);
          processedCount++;
        } catch (err: any) {
          // If network error, stop and retry on next run
          console.warn(`Sync item failed for ${colName}/${dId}:`, err?.message);
          break;
        }
      }

      if (processedCount > 0) {
        await db.settings.update(1, { lastSyncTime: new Date().toISOString() });
      }
    } catch (err) {
      console.warn('Process sync queue error:', err);
    } finally {
      this.isProcessingQueue = false;
    }

    const remaining = await db.syncQueue.count();
    return { processed: processedCount, remaining };
  }

  /**
   * Intelligent Startup Bootstrap:
   * 1. Checks local IndexedDB.
   * 2. If empty, checks persistent local mirror (~/.3amory-pos-data/local_pos_database_mirror.json).
   * 3. If still empty, checks Firebase Cloud and pulls entire store data!
   */
  public async initialStartupBootstrap(): Promise<{ source: 'local' | 'mirror' | 'cloud' | 'clean'; restoredCount?: number }> {
    try {
      await systemLogger.logInit('بدء فحص بيئة وقاعدة البيانات الذكية للمحل...');

      // 1. Check local Dexie IndexedDB
      const invoiceCount = await db.invoices.count();
      const phoneCount = await db.phones.count();
      const accessoryCount = await db.accessories.count();
      const walletCount = await db.wallets.count();

      const hasLocalData = invoiceCount > 0 || phoneCount > 0 || accessoryCount > 0 || walletCount > 0;

      if (hasLocalData) {
        await systemLogger.logInit(`تم العثور على قاعدة بيانات محلية صالحة: (${invoiceCount} فاتورة، ${phoneCount} هاتف، ${accessoryCount} إكسسوار).`);
        // Save fresh mirror
        backupService.saveDatabaseMirror().catch(() => {});
        // Process any leftover sync items
        this.processSyncQueue().catch(() => {});
        return { source: 'local' };
      }

      // 2. Check persistent filesystem mirror on Desktop (~/.3amory-pos-data/local_pos_database_mirror.json)
      if (typeof window !== 'undefined' && (window as any).electronAPI?.loadDatabaseMirror) {
        try {
          const mirrorRes = await (window as any).electronAPI.loadDatabaseMirror();
          if (mirrorRes?.exists && mirrorRes?.data) {
            const data = mirrorRes.data;
            await this.importFullSnapshot(data);
            await systemLogger.logInit('تم استرجاع قاعدة البيانات بنجاح من ملف النسخة المتطابقة المحلي (Database Mirror).');
            return { source: 'mirror' };
          }
        } catch (err) {
          console.warn('Mirror load check note:', err);
        }
      }

      // 3. Check Firebase Cloud (Zero-DB on new machine / fresh install)
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await systemLogger.logInit('قاعدة البيانات المحلية فارغة. جاري فحص والاتصال بسحابة Firebase لاسترجاع بيانات المحل...');
        const cloudRestore = await this.restoreEntireDatabaseFromCloud();
        if (cloudRestore.success && (cloudRestore.recordsCount || 0) > 0) {
          await systemLogger.logInit(`تم استرجاع بيانات المحل بالكامل من سحابة Firebase بنجاح! (${cloudRestore.recordsCount} سجل).`);
          return { source: 'cloud', restoredCount: cloudRestore.recordsCount };
        }
      }

      await systemLogger.logInit('لا توجد بيانات سابقة محلياً أو سحابياً. تم بدء المحل ببيانات إنتاجية نظيفة.');
      return { source: 'clean' };
    } catch (err: any) {
      await systemLogger.logError(`خطأ أثناء بدء فحص التهيأة والمزامنة: ${err?.message}`, err, 'StartupBootstrap');
      return { source: 'clean' };
    }
  }

  /**
   * Pulls all collections from Firebase Cloud and populates local Dexie database
   */
  public async restoreEntireDatabaseFromCloud(): Promise<{ success: boolean; message: string; recordsCount?: number }> {
    this.muteSync();
    try {
      const fDb = initFirebase();
      if (!fDb) {
        return { success: false, message: 'تعذر تهيئة اتصال Firebase.' };
      }

      let totalRestored = 0;

      // 1. Settings & Store Summary
      const storeDocRef = doc(fDb, 'stores', PROJECT_ID);
      const storeSnap = await getDoc(storeDocRef);
      if (storeSnap.exists()) {
        const storeData = storeSnap.data();
        if (storeData.settings) {
          await db.settings.put({ ...storeData.settings, id: 1 });
          totalRestored++;
        }
      }

      // 2. Wallets
      const walletsSnap = await getDocs(collection(fDb, 'stores', PROJECT_ID, 'wallets'));
      if (!walletsSnap.empty) {
        const wallets = walletsSnap.docs.map((d) => d.data() as any);
        await db.wallets.bulkPut(wallets);
        totalRestored += wallets.length;
      }

      // 3. Wallet Transactions
      const txSnap = await getDocs(collection(fDb, 'stores', PROJECT_ID, 'walletTransactions'));
      if (!txSnap.empty) {
        const txs = txSnap.docs.map((d) => d.data() as any);
        await db.walletTransactions.bulkPut(txs);
        totalRestored += txs.length;
      }

      // 4. Invoices
      const invSnap = await getDocs(collection(fDb, 'stores', PROJECT_ID, 'invoices'));
      if (!invSnap.empty) {
        const invoices = invSnap.docs.map((d) => d.data() as any);
        await db.invoices.bulkPut(invoices);
        totalRestored += invoices.length;
      }

      // 5. Shifts
      const shiftSnap = await getDocs(collection(fDb, 'stores', PROJECT_ID, 'shifts'));
      if (!shiftSnap.empty) {
        const shifts = shiftSnap.docs.map((d) => d.data() as any);
        await db.shifts.bulkPut(shifts);
        totalRestored += shifts.length;
      }

      // 6. Phones
      const phoneSnap = await getDocs(collection(fDb, 'stores', PROJECT_ID, 'phones'));
      if (!phoneSnap.empty) {
        const phones = phoneSnap.docs.map((d) => d.data() as any);
        await db.phones.bulkPut(phones);
        totalRestored += phones.length;
      }

      // 7. Accessories
      const accSnap = await getDocs(collection(fDb, 'stores', PROJECT_ID, 'accessories'));
      if (!accSnap.empty) {
        const accs = accSnap.docs.map((d) => d.data() as any);
        await db.accessories.bulkPut(accs);
        totalRestored += accs.length;
      }

      // 8. Users
      const userSnap = await getDocs(collection(fDb, 'stores', PROJECT_ID, 'users'));
      if (!userSnap.empty) {
        const users = userSnap.docs.map((d) => d.data() as any);
        await db.users.bulkPut(users);
        totalRestored += users.length;
      }

      // Save persistent mirror
      await backupService.saveDatabaseMirror();

      return {
        success: true,
        message: `تمت استعادة البيانات من السحابة بنجاح! (${totalRestored} عنصر)`,
        recordsCount: totalRestored,
      };
    } catch (err: any) {
      return { success: false, message: `فشل استعادة البيانات من السحابة: ${err?.message || err}` };
    } finally {
      this.unmuteSync();
    }
  }

  /**
   * Helper to batch-import a full JSON snapshot object into Dexie
   */
  public async importFullSnapshot(data: any): Promise<void> {
    this.muteSync();
    try {
      await db.transaction(
        'rw',
        [
          db.settings,
          db.users,
          db.phones,
          db.accessories,
          db.wallets,
          db.walletTransactions,
          db.invoices,
          db.repairs,
          db.shifts,
          db.expenses,
          db.customers,
          db.suppliers,
        ],
        async () => {
          if (data.settings?.length) {
            await db.settings.clear();
            await db.settings.bulkPut(data.settings);
          }
          if (data.users?.length) {
            await db.users.clear();
            await db.users.bulkPut(data.users);
          }
          if (data.phones?.length) {
            await db.phones.clear();
            await db.phones.bulkPut(data.phones);
          }
          if (data.accessories?.length) {
            await db.accessories.clear();
            await db.accessories.bulkPut(data.accessories);
          }
          if (data.wallets?.length) {
            await db.wallets.clear();
            await db.wallets.bulkPut(data.wallets);
          }
          if (data.walletTransactions?.length) {
            await db.walletTransactions.clear();
            await db.walletTransactions.bulkPut(data.walletTransactions);
          }
          if (data.invoices?.length) {
            await db.invoices.clear();
            await db.invoices.bulkPut(data.invoices);
          }
          if (data.repairs?.length) {
            await db.repairs.clear();
            await db.repairs.bulkPut(data.repairs);
          }
          if (data.shifts?.length) {
            await db.shifts.clear();
            await db.shifts.bulkPut(data.shifts);
          }
          if (data.expenses?.length) {
            await db.expenses.clear();
            await db.expenses.bulkPut(data.expenses);
          }
          if (data.customers?.length) {
            await db.customers.clear();
            await db.customers.bulkPut(data.customers);
          }
          if (data.suppliers?.length) {
            await db.suppliers.clear();
            await db.suppliers.bulkPut(data.suppliers);
          }
        }
      );
    } finally {
      this.unmuteSync();
    }
  }
}

export const syncService = new SyncService();

/**
 * Automatically attaches reactive sync hooks to Dexie tables.
 * Any write/update/delete will instantly be captured in syncQueue and local mirror.
 */
export function attachDexieSyncHooks(database: typeof db) {
  const syncableTables = [
    'settings',
    'users',
    'phones',
    'accessories',
    'wallets',
    'walletTransactions',
    'invoices',
    'repairs',
    'shifts',
    'expenses',
    'customers',
    'suppliers',
  ];

  for (const tableName of syncableTables) {
    const table = (database as any)[tableName];
    if (!table || typeof table.hook !== 'function') continue;

    table.hook('creating', function (this: any, primKey: any, obj: any) {
      this.onsuccess = function (actualKey: any) {
        if (!syncService.isMuted) {
          const docId = String(actualKey ?? primKey ?? obj?.id ?? Date.now());
          setTimeout(() => {
            syncService.enqueueChange(tableName, docId, 'put', obj);
          }, 0);
        }
      };
    });

    table.hook('updating', function (this: any, modifications: any, primKey: any, obj: any) {
      this.onsuccess = function () {
        if (!syncService.isMuted) {
          const docId = String(primKey ?? obj?.id ?? Date.now());
          setTimeout(() => {
            database.table(tableName).get(primKey).then((fullDoc) => {
              if (fullDoc) {
                syncService.enqueueChange(tableName, docId, 'put', fullDoc);
              }
            }).catch(() => {});
          }, 0);
        }
      };
    });

    table.hook('deleting', function (this: any, primKey: any) {
      this.onsuccess = function () {
        if (!syncService.isMuted) {
          const docId = String(primKey);
          setTimeout(() => {
            syncService.enqueueChange(tableName, docId, 'delete');
          }, 0);
        }
      };
    });
  }
}
