import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Store,
  Cloud,
  CloudOff,
  Settings,
  RefreshCw,
  Lock,
  LogOut,
  UserCheck,
  FolderOpen,
} from 'lucide-react';
import { db } from '../db';
import { syncDataToFirebase } from '../services/firebase';
import { systemLogger } from '../services/logger';
import { useModal } from '../context/ModalContext';
import { getStoreLogo, DEFAULT_LOGO } from '../constants/logo';

interface HeaderProps {
  currentRole: string;
  setCurrentRole: (role: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLockScreen?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  activeTab,
  setActiveTab,
  onLockScreen,
}) => {
  const settings = useLiveQuery(() => db.settings.get(1));
  const openShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());
  const [syncing, setSyncing] = React.useState(false);
  const { showAlert, showToast } = useModal();

  const handleCloudSync = async () => {
    setSyncing(true);
    const res = await syncDataToFirebase();
    setSyncing(false);
    if (res.success) {
      showToast(res.message, 'success');
    } else {
      await showAlert(res.message, 'تنبيه المزامنة', 'error');
    }
  };

  const drawerBalance = Math.max(0, openShift?.closingCashSystem || 0);
  const cur = settings?.currency || 'ج.م';
  const logoSrc = getStoreLogo(settings?.logoUrl);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 shadow-xs no-print">
      <div className="flex items-center justify-between gap-4">
        {/* Logo & Store Name */}
        <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => setActiveTab('pos')}>
          <div className="h-11 w-11 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1 overflow-hidden">
            <img
              src={logoSrc}
              alt="Logo"
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_LOGO;
              }}
            />
          </div>

          <div>
            <h1 className="font-display text-base font-black text-slate-900 leading-tight">
              {settings?.storeName || '3amory phone'}
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold hidden sm:block">
              {settings?.phone1 ? `خدمة العملاء: ${settings.phone1}` : '3amory phone POS'}
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

        {/* Right: Actions & User Lock Button */}
        <div className="flex items-center gap-2">
          {/* Firebase Sync Button */}
          <button
            onClick={handleCloudSync}
            disabled={syncing}
            title="مزامنة مع السحابة"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer"
          >
            {syncing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Cloud className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{syncing ? '...' : 'مزامنة سحابية'}</span>
          </button>

          {/* Open Logs Folder */}
          <button
            type="button"
            onClick={() => systemLogger.openLogsFolder()}
            title="فتح مجلد السجلات واللقطات (Logs & Invoices)"
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition cursor-pointer"
          >
            <FolderOpen className="h-4 w-4" />
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

          {/* Current Active User & Lock/Switch Screen */}
          <button
            onClick={onLockScreen}
            title="قفل الشاشة / تبديل المستخدم بالـ PIN"
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 active:scale-95 transition rounded-xl px-3 py-1.5 border border-slate-200 cursor-pointer group"
          >
            <div className="h-6 w-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-xs">
              {currentRole.charAt(0)}
            </div>
            <span className="text-xs font-bold text-slate-800 max-w-[120px] truncate">
              {currentRole}
            </span>
            <Lock className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 transition shrink-0" />
          </button>
        </div>
      </div>
    </header>
  );
};
