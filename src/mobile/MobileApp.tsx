import React, { useState, useEffect } from 'react';
import { useMobileLive } from './hooks/useMobileLive';
import { MobileHeader } from './components/MobileHeader';
import { MobileBottomNav, type MobileTabType } from './components/MobileBottomNav';
import { MobileLockScreen } from './components/MobileLockScreen';
import { MobileMoreDrawer } from './components/MobileMoreDrawer';
import { MobilePulseView } from './views/MobilePulseView';
import { MobileShiftView } from './views/MobileShiftView';
import { MobileWalletsView } from './views/MobileWalletsView';
import { MobileInventoryView } from './views/MobileInventoryView';
import { MobileInvoicesView } from './views/MobileInvoicesView';
import { MobileDebtsView } from './views/MobileDebtsView';
import { MobileAnalyticsView } from './views/MobileAnalyticsView';

interface MobileAppProps {
  onSwitchToDesktop: () => void;
}

export function MobileApp({ onSwitchToDesktop }: MobileAppProps) {
  const liveData = useMobileLive();
  const [activeTab, setActiveTab] = useState<MobileTabType>('pulse');
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return !localStorage.getItem('elghandour_mobile_auth');
  });
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleUnlock = () => {
    setIsLocked(false);
  };

  const handleLock = () => {
    localStorage.removeItem('elghandour_mobile_auth');
    setIsLocked(true);
  };

  const handleRefresh = () => {
    liveData.refresh();
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100 font-sans select-none" dir="rtl">
      {/* ── Lock Screen ────────────────────────────────────────── */}
      {isLocked && <MobileLockScreen onUnlock={handleUnlock} />}

      {/* ── Mobile Top Header ───────────────────────────────────── */}
      <MobileHeader
        isCloudConnected={liveData.isCloudConnected}
        lastUpdated={liveData.lastUpdated}
        onRefresh={handleRefresh}
        onLock={handleLock}
        onSwitchToDesktop={onSwitchToDesktop}
        onOpenMoreMenu={() => setIsMoreOpen(true)}
      />

      {/* ── Dynamic Content Container ──────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 pt-3 pb-28 sm:pb-32 overscroll-y-contain">
        {activeTab === 'pulse' && (
          <MobilePulseView data={liveData} onNavigateTab={setActiveTab} />
        )}
        {activeTab === 'shift' && (
          <MobileShiftView openShift={liveData.openShift} shifts={liveData.shifts} />
        )}
        {activeTab === 'wallets' && (
          <MobileWalletsView
            wallets={liveData.wallets}
            transactions={liveData.walletTransactions}
          />
        )}
        {activeTab === 'inventory' && (
          <MobileInventoryView
            phones={liveData.phones}
            accessories={liveData.accessories}
          />
        )}
        {activeTab === 'invoices' && (
          <MobileInvoicesView invoices={liveData.invoices} />
        )}
        {activeTab === 'debts' && (
          <MobileDebtsView
            customers={liveData.customers}
            suppliers={liveData.suppliers}
          />
        )}
        {activeTab === 'analytics' && (
          <MobileAnalyticsView data={liveData} />
        )}
      </main>

      {/* ── Bottom Navigation Bar ──────────────────────────────── */}
      <MobileBottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        openShiftActive={!!liveData.openShift}
        lowStockCount={liveData.summaryStats.lowStockAccessoriesCount}
      />

      {/* ── More Options Drawer ─────────────────────────────────── */}
      <MobileMoreDrawer
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        onNavigateTab={setActiveTab}
        onSwitchToDesktop={onSwitchToDesktop}
        onLock={handleLock}
        onRefresh={handleRefresh}
      />
    </div>
  );
}

export default MobileApp;
