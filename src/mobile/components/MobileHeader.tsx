import React from 'react';
import { Smartphone, RefreshCw, Lock, Monitor, MoreVertical } from 'lucide-react';
import { LivePulseBadge } from './LivePulseBadge';

interface MobileHeaderProps {
  isCloudConnected: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  onLock: () => void;
  onSwitchToDesktop: () => void;
  onOpenMoreMenu: () => void;
}

export function MobileHeader({
  isCloudConnected,
  lastUpdated,
  onRefresh,
  onLock,
  onSwitchToDesktop,
  onOpenMoreMenu,
}: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 text-white shadow-md">
      <div className="flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md shadow-blue-500/20 text-white font-serif font-black">
            <span className="text-base font-black">GP</span>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-slate-900"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black text-white tracking-tight">الغندور فون</h1>
              <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-500/30">
                موبايل
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">مراقبة حية للمحل والدرج</p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-1.5">
          <LivePulseBadge
            isCloudConnected={isCloudConnected}
            lastUpdated={lastUpdated}
            onRefresh={onRefresh}
          />

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
            title="تحديث البيانات لحظياً"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onSwitchToDesktop}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
            title="التبديل إلى شاشة الكاشير الكاملة"
          >
            <Monitor className="w-4 h-4 text-blue-400" />
          </button>

          <button
            onClick={onLock}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
            title="قفل الشاشة"
          >
            <Lock className="w-4 h-4 text-amber-400" />
          </button>

          <button
            onClick={onOpenMoreMenu}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
            title="المزيد من الخيارات"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
