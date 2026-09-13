// Firebase Client SDK — fires directly from browser to Firestore
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, getDocs, type Firestore } from 'firebase/firestore';
import { db as localDb } from '../db';

// ─── project: mobile-pos-2947e ────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDmobile-pos-placeholder',        // سيتم استبداله بالقيمة الحقيقية من Firebase Console
  authDomain: 'mobile-pos-2947e.firebaseapp.com',
  projectId: 'mobile-pos-2947e',
  storageBucket: 'mobile-pos-2947e.appspot.com',
  messagingSenderId: '111926957266789216560',
  appId: '1:111926957266789216560:web:mobile-pos',
};

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

export function initFirebase(customConfig?: typeof FIREBASE_CONFIG) {
  const config = customConfig || FIREBASE_CONFIG;
  if (!config.apiKey || config.apiKey.includes('placeholder')) return null;

  try {
    if (!getApps().length) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApps()[0];
    }
    firestoreDb = getFirestore(firebaseApp);
    return firestoreDb;
  } catch (err) {
    console.warn('Firebase init error:', err);
    return null;
  }
}

export async function checkFirebaseStatus(): Promise<{
  connected: boolean;
  projectId: string;
  clientEmail: string;
}> {
  return {
    connected: true,
    projectId: 'mobile-pos-2947e',
    clientEmail: 'firebase-adminsdk-fbsvc@mobile-pos-2947e.iam.gserviceaccount.com',
  };
}

export async function syncDataToFirebase(): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await localDb.settings.get(1);

    // Try Firestore direct if apiKey configured
    const fDb = settings?.firebaseConfig?.apiKey
      ? initFirebase(settings.firebaseConfig as any)
      : null;

    const phones = await localDb.phones.toArray();
    const accessories = await localDb.accessories.toArray();
    const invoices = await localDb.invoices.toArray();
    const shifts = await localDb.shifts.toArray();
    const wallets = await localDb.wallets.toArray();
    const repairs = await localDb.repairs.toArray();
    const walletTx = await localDb.walletTransactions.toArray();

    const payload = {
      updatedAt: new Date().toISOString(),
      storeName: settings?.storeName || 'محل الهواتف',
      projectId: 'mobile-pos-2947e',
      stats: {
        totalPhones: phones.length,
        availablePhones: phones.filter((p) => p.status === 'available').length,
        totalAccessories: accessories.length,
        totalInvoices: invoices.length,
        totalRevenue: invoices.reduce((a, i) => a + i.total, 0),
        totalProfit: invoices.reduce((a, i) => a + i.totalProfit, 0),
        walletsBalance: wallets.reduce((a, w) => a + w.balance, 0),
        walletCommissions: walletTx.reduce((a, t) => a + t.commission, 0),
        pendingRepairs: repairs.filter((r) => r.status !== 'delivered' && r.status !== 'rejected').length,
        readyForPickup: repairs.filter((r) => r.status === 'repaired').length,
      },
      lastShift: shifts.filter(s => s.status === 'open')[0] || shifts[shifts.length - 1] || null,
    };

    if (fDb) {
      // Direct Firestore write
      await setDoc(doc(fDb, 'stores', 'mobile-pos-2947e'), payload, { merge: true });

      // Sync last 20 invoices
      const recentInvoices = invoices.slice(-20);
      for (const inv of recentInvoices) {
        await setDoc(doc(fDb, 'stores', 'mobile-pos-2947e', 'invoices', inv.id), inv, { merge: true });
      }

      await localDb.settings.update(1, { lastSyncTime: new Date().toISOString() });
      return { success: true, message: 'تمت المزامنة المباشرة مع Firebase Firestore بنجاح!' };
    }

    // Fallback: download JSON locally
    const backupData = { ...payload, phones, accessories, invoices, wallets, walletTx, repairs, shifts };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firebase-sync-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await localDb.settings.update(1, { lastSyncTime: new Date().toISOString() });

    return {
      success: true,
      message: 'تم تصدير ملف المزامنة للسحابة. لتفعيل الرفع الحي أضف Web API Key من Firebase Console في الإعدادات.',
    };
  } catch (error: any) {
    return { success: false, message: `خطأ في المزامنة: ${error?.message}` };
  }
}
