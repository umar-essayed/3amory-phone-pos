import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Store,
  Cloud,
  CloudOff,
  Settings,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { db } from '../db';
import { syncDataToFirebase } from '../services/firebase';

interface HeaderProps {
  currentRole: string;
  setCurrentRole: (role: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'مالك',
  manager: 'مدير',
  cashier: 'كاشير',
  technician: 'تقني',
};

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  setCurrentRole,
  activeTab,
  setActiveTab,
}) => {
  const settings = useLiveQuery(() => db.settings.get(1));
  const openShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());
  const users = useLiveQuery(() => db.users.where('isActive').equals(1).toArray()) || [];
  const [syncing, setSyncing] = React.useState(false);

  const handleCloudSync = async () => {
    setSyncing(true);
    const res = await syncDataToFirebase();
    setSyncing(false);
    alert(res.message);
  };

  const drawerBalance = openShift?.closingCashSystem || 0;
  const cur = settings?.currency || 'ج.م';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 shadow-xs no-print">
      <div className="flex items-center justify-between gap-4">
        {/* Logo & Store Name */}
        <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => setActiveTab('pos')}>
          {settings?.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.storeName}
              className="h-10 w-10 object-contain rounded-xl border border-slate-200 shadow-xs bg-white"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center">
              <Store className="h-5 w-5" />
            </div>
          )}

          <div>
            <h1 className="font-display text-base font-black text-slate-900 leading-tight">
              {settings?.storeName || 'محل الهواتف الذكية'}
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold hidden sm:block">
              {settings?.phone1 ? settings.phone1 : 'Mobile POS Pro'}
            </p>
          </div>
        </div>

        {/* Center: Active Shift Status */}
        <div className="hidden md:flex items-center gap-3 bg-slate-50 border border-slate-200/80 px-4 py-1.5 rounded-2xl">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${openShift ? 'bg-emerald-400' : 'bg-slate-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${openShift ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </span>
            <span className="text-xs font-bold text-slate-600">
              {openShift ? `وردية #${openShift.shiftNumber}` : 'لا توجد وردية'}
            </span>
          </div>

          {openShift && (
            <>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-semibold">رصيد الدرج:</span>
                <span className="text-sm font-black font-mono text-emerald-700">
                  {drawerBalance.toLocaleString()} {cur}
                </span>
              </div>
            </>
          )}

          {settings?.lastSyncTime && (
            <>
              <div className="h-4 w-px bg-slate-200" />
              <span className="text-[10px] text-slate-400">
                آخر مزامنة: {new Date(settings.lastSyncTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Firebase Sync Button */}
          <button
            onClick={handleCloudSync}
            disabled={syncing}
            title="مزامنة مع Firebase"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              settings?.enableCloudSync
                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
            }`}
          >
            {syncing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : settings?.enableCloudSync ? (
              <Cloud className="h-3.5 w-3.5" />
            ) : (
              <CloudOff className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{syncing ? '...' : settings?.enableCloudSync ? 'سحابة' : 'أوفلاين'}</span>
          </button>

          {/* Settings Quick Access */}
          <button
            onClick={() => setActiveTab('settings')}
            title="إعدادات المحل"
            className={`p-2 rounded-xl border transition cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Cashier Selector — live from DB users */}
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200">
            <div className="h-6 w-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
              {currentRole.charAt(0)}
            </div>
            <select
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[100px] truncate"
            >
              {/* Static roles */}
              <option value="المدير العام (المالك)">مالك</option>
              {/* Dynamic users from DB */}
              {users.map((u) => (
                <option key={u.id} value={u.displayName || u.username}>
                  {u.displayName || u.username} ({ROLE_LABELS[u.role] || u.role})
                </option>
              ))}
            </select>
            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
          </div>
        </div>
      </div>
    </header>
  );
};
