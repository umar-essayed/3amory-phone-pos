import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, type Firestore } from 'firebase/firestore';
import { db } from '../db';
import type { StoreSettings } from '../types';

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

export function initFirebase(config: StoreSettings['firebaseConfig']) {
  if (!config || !config.apiKey || !config.projectId) {
    return null;
  }

  try {
    if (!getApps().length) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApps()[0];
    }
    firestoreDb = getFirestore(firebaseApp);
    return firestoreDb;
  } catch (error) {
    console.warn('Firebase initialization skipped or failed:', error);
    return null;
  }
}

export async function syncDataToFirebase(): Promise<{ success: boolean; message: string }> {
  const settings = await db.settings.get(1);
  if (!settings || !settings.enableCloudSync || !settings.firebaseConfig.apiKey) {
    return {
      success: false,
      message: 'المزامنة السحابية غير مفعلة، يرجى تفعيلها وإدخال مفاتيح Firebase في الإعدادات.',
    };
  }

  const fDb = initFirebase(settings.firebaseConfig);
  if (!fDb) {
    return {
      success: false,
      message: 'تعذر الاتصال بـ Firebase، يرجى التحقق من إعدادات المفاتيح والإنترنت.',
    };
  }

  try {
    const storeId = settings.firebaseConfig.projectId || 'main_store';

    // Sync Store Summary to Cloud
    const phones = await db.phones.toArray();
    const accessories = await db.accessories.toArray();
    const invoices = await db.invoices.toArray();
    const shifts = await db.shifts.toArray();
    const wallets = await db.wallets.toArray();
    const repairs = await db.repairs.toArray();

    const backupPayload = {
      updatedAt: new Date().toISOString(),
      storeName: settings.storeName,
      stats: {
        totalPhones: phones.length,
        totalAccessories: accessories.length,
        totalInvoices: invoices.length,
        activeWalletsBalance: wallets.reduce((acc, w) => acc + w.balance, 0),
        pendingRepairs: repairs.filter((r) => r.status !== 'delivered' && r.status !== 'rejected').length,
      },
      lastShift: shifts[shifts.length - 1] || null,
    };

    await setDoc(doc(fDb, 'stores', storeId), backupPayload, { merge: true });

    // Update last sync time
    await db.settings.update(1, { lastSyncTime: new Date().toISOString() });

    return {
      success: true,
      message: 'تمت المزامنة السحابية بنجاح مع Firebase!',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `خطأ أثناء المزامنة: ${error?.message || error}`,
    };
  }
}
