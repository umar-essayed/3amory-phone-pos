import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDatabase } from './db';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PrintModal } from './components/PrintModal';

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

export function App() {
  const [dbReady, setDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [currentCashier, setCurrentCashier] = useState<string>('المدير العام (المالك)');

  // Active shift from DB
  const activeShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());

  useEffect(() => {
    initializeDatabase().then(() => {
      setDbReady(true);
    });
  }, []);

  if (!dbReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-sm font-bold tracking-wide">جاري تهيئة وتشغيل قاعدة البيانات المحلية للمحل...</p>
        </div>
      </div>
    );
  }

  const shiftId = activeShift?.id || 'shift_default';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 font-sans antialiased text-slate-900">
      {/* Top Header Bar */}
      <Header
        currentRole={currentCashier}
        setCurrentRole={setCurrentCashier}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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
  );
}

export default App;
