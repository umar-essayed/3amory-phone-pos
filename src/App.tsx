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
import type { User } from './types';
import { systemLogger } from './services/logger';

export function App() {
  const [dbReady, setDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [currentCashier, setCurrentCashier] = useState<string>('المدير العام (المالك)');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(true);

  // Active shift from DB
  const activeShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());

  useEffect(() => {
    systemLogger.logInit('React App component mounted. Initializing Dexie DB...');
    initializeDatabase()
      .then(() => {
        systemLogger.logInit('Database ready. Unlocking POS user interface.');
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
            <span className="text-xl font-black text-white font-serif">3P</span>
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white mb-2">3amory phone</h1>
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
  };

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
        />

        {/* Main App Workspace */}
        <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
          {/* Navigation Sidebar */}
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

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
            {activeTab === 'maintenance' && (
              <MaintenanceView activeShiftId={shiftId} cashierName={currentCashier} />
            )}
            {activeTab === 'shifts' && (
              <ShiftsView activeShiftId={shiftId} cashierName={currentCashier} />
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
