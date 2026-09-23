import React from 'react';
import {
  Activity,
  Vault,
  Wallet,
  Package,
  ReceiptText,
} from 'lucide-react';

export type MobileTabType = 'pulse' | 'shift' | 'wallets' | 'inventory' | 'invoices' | 'debts' | 'analytics';

interface MobileBottomNavProps {
  activeTab: MobileTabType;
  onChangeTab: (tab: MobileTabType) => void;
  openShiftActive: boolean;
  lowStockCount: number;
}

export function MobileBottomNav({
  activeTab,
  onChangeTab,
  openShiftActive,
  lowStockCount,
}: MobileBottomNavProps) {
  const tabs = [
    {
      id: 'pulse' as MobileTabType,
      label: 'الرئيسية',
      icon: Activity,
    },
    {
      id: 'shift' as MobileTabType,
      label: 'الدرج',
      icon: Vault,
      badge: openShiftActive ? 'مفتوح' : null,
      badgeColor: 'bg-emerald-500',
    },
    {
      id: 'wallets' as MobileTabType,
      label: 'المحافظ',
      icon: Wallet,
    },
    {
      id: 'inventory' as MobileTabType,
      label: 'المخزن',
      icon: Package,
      badge: lowStockCount > 0 ? `${lowStockCount}` : null,
      badgeColor: 'bg-rose-500',
    },
    {
      id: 'invoices' as MobileTabType,
      label: 'الفواتير',
      icon: ReceiptText,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/90 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 px-2 shadow-2xl">
      <div className="grid grid-cols-5 gap-1 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all active:scale-95 ${
                isActive
                  ? 'text-blue-400 font-black'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              {/* Active glow pill */}
              {isActive && (
                <span className="absolute -top-1 w-8 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-sm shadow-blue-500/50"></span>
              )}

              <div className="relative mb-1">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : ''}`} />

                {tab.badge && (
                  <span
                    className={`absolute -top-1.5 -right-2 text-[9px] font-black text-white px-1 py-0.2 rounded-full ${tab.badgeColor} shadow-xs ring-1 ring-slate-900`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className={`text-[10px] tracking-tight leading-none ${isActive ? 'text-blue-400 font-black' : 'text-slate-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
