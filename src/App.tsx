import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabase } from './db';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PrintModal } from './components/PrintModal';
import { LockScreen } from './components/LockScreen';
import { ModalProvider } from './context/ModalContext';

// Views
import { PosView } from './views/PosView';
import { WalletsView } from './views/WalletsView';
import { PhonesView } from './views/PhonesView';
import { AccessoriesView } from './views/AccessoriesView';
import { MaintenanceView } from './views/MaintenanceView';
import { ShiftsView } from './views/ShiftsView';
import { AnalyticsView } from './views/AnalyticsView';
import { AccountsView } from './views/AccountsView';
import { SettingsView } from './views/SettingsView';
import { UsersView } from './views/UsersView';
import { BarcodeView } from './views/BarcodeView';
import type { User } from './types';
import { DEFAULT_CASHIER_PAGES } from './types';
import { systemLogger } from './services/logger';
import { syncService, attachDexieSyncHooks } from './services/syncService';
import { backupService } from './services/backupService';
import { MobileApp } from './mobile/MobileApp';

export function App() {
  const [dbReady, setDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [currentCashier, setCurrentCashier] = useState<string>('المدير العام (المالك)');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(true);

  // Mobile mode detection
  const [isMobileMode, setIsMobileMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mobile') === 'true' || window.location.hash.includes('mobile') || window.location.pathname.startsWith('/mobile')) {
      return true;
    }
    const stored = localStorage.getItem('elghandour_view_mode');
    if (stored === 'desktop') return false;
    if (stored === 'mobile') return true;
    return window.innerWidth < 768;
  });

  // Active shift from DB
  const activeShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());

  useEffect(() => {
    systemLogger.logInit('React App component mounted. Initializing Dexie DB & Sync Services...');
    
    // 1. Initialize local DB tables
    initializeDatabase()
      .then(async () => {
        // 2. Perform intelligent startup bootstrap (Local -> Mirror -> Cloud)
        await syncService.initialStartupBootstrap();

        // 2b. Attach reactive sync hooks to automatically capture all operational writes
        attachDexieSyncHooks(db);

        // 3. Check and run weekly backup if due
        await backupService.checkAndRunWeeklyBackup();

        // 4. Start background queue processor worker
        syncService.startSyncWorker();

        systemLogger.logInit('Database and background sync services ready.');
      })
      .catch((err) => {
        console.warn('Init DB note:', err);
        systemLogger.logInit(`Init DB warning: ${err}`, true, err);
      })
      .finally(() => {
        setDbReady(true);
      });
  }, []);

  if (!dbReady) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-900 text-white font-sans select-none" dir="rtl">
        <div className="relative flex items-center justify-center mb-6">
          <div className="h-20 w-20 rounded-full border-4 border-blue-500/20 border-t-blue-500 border-r-blue-400 animate-spin"></div>
          <div className="absolute h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-500/40">
            <span className="text-xl font-black text-white font-serif">GP</span>
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white mb-2">الغندور فون</h1>
        <div className="flex items-center gap-2 mb-6">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs text-slate-400 font-bold">جاري تشغيل البيئة وقاعدة البيانات المحلية للمحل...</span>
        </div>
        <div className="h-1.5 w-60 rounded-full bg-slate-800 overflow-hidden relative">
          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full animate-pulse w-full"></div>
        </div>
      </div>
    );
  }

  const shiftId = activeShift?.id || 'shift_default';

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setCurrentCashier(user.displayName || user.name || user.username);
    setIsLocked(false);

    if (user.role === 'cashier') {
      const allowed = user.allowedPages || DEFAULT_CASHIER_PAGES;
      if (!allowed.includes(activeTab)) {
        setActiveTab(allowed[0] || 'pos');
      }
    } else if (user.role === 'technician') {
      if (!['maintenance', 'phones', 'accessories'].includes(activeTab)) {
        setActiveTab('maintenance');
      }
    }
  };

  if (isMobileMode) {
    return (
      <ModalProvider>
        <MobileApp
          onSwitchToDesktop={() => {
            localStorage.setItem('elghandour_view_mode', 'desktop');
            setIsMobileMode(false);
          }}
        />
      </ModalProvider>
    );
  }

  return (
    <ModalProvider>
      {/* Lock / Login Screen Overlay */}
      {isLocked && (
        <LockScreen onLogin={handleLoginSuccess} />
      )}

      <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 font-sans antialiased text-slate-900">
        {/* Top Header Bar */}
        <Header
          currentRole={currentCashier}
          setCurrentRole={setCurrentCashier}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLockScreen={() => setIsLocked(true)}
          onSwitchToMobile={() => {
            localStorage.setItem('elghandour_view_mode', 'mobile');
            setIsMobileMode(true);
          }}
        />

        {/* Main App Workspace */}
        <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
          {/* Navigation Sidebar */}
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} />

          {/* Dynamic Content View Container */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {activeTab === 'pos' && (
              <PosView activeShiftId={shiftId} cashierName={currentCashier} />
            )}
            {activeTab === 'wallets' && (
              <WalletsView activeShiftId={shiftId} cashierName={currentCashier} />
            )}
            {activeTab === 'phones' && <PhonesView />}
            {activeTab === 'accessories' && <AccessoriesView />}
            {activeTab === 'barcode' && <BarcodeView />}
            {activeTab === 'maintenance' && (
              <MaintenanceView activeShiftId={shiftId} cashierName={currentCashier} />
            )}
            {activeTab === 'shifts' && (
              <ShiftsView activeShiftId={shiftId} cashierName={currentCashier} currentUser={currentUser} />
            )}
            {activeTab === 'analytics' && <AnalyticsView />}
            {activeTab === 'accounts' && <AccountsView />}
            {activeTab === 'users' && <UsersView />}
            {activeTab === 'settings' && <SettingsView />}
          </main>
        </div>

        {/* Thermal and Document Print Modal */}
        <PrintModal />
      </div>
    </ModalProvider>
  );
}

export default App;
