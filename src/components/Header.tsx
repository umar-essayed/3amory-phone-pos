import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Store,
  User,
  Clock,
  Cloud,
  CloudOff,
  RefreshCw,
  Wallet,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { db } from '../db';
import { syncDataToFirebase } from '../services/firebase';
import type { StoreSettings } from '../types';

interface HeaderProps {
  currentRole: string;
  setCurrentRole: (role: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  setCurrentRole,
  activeTab,
  setActiveTab,
}) => {
  const settings = useLiveQuery(() => db.settings.get(1));
  const openShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());
  const [syncing, setSyncing] = React.useState(false);

  const handleCloudSync = async () => {
    setSyncing(true);
    const res = await syncDataToFirebase();
    setSyncing(false);
    alert(res.message);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 shadow-xs no-print">
      <div className="flex items-center justify-between gap-4">
        {/* Store Logo & Name */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('pos')}>
          {settings?.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.storeName}
              className="h-10 w-10 object-contain rounded-xl border border-slate-200 shadow-xs"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
              <Store className="h-5 w-5" />
            </div>
          )}

          <div>
            <h1 className="text-base font-black text-slate-900 leading-tight">
              {settings?.storeName || 'محل الهواتف الذكية'}
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold truncate max-w-[200px]">
              {settings?.phone1 ? `خدمة العملاء: ${settings.phone1}` : 'نظام Mobile POS Pro'}
            </p>
          </div>
        </div>

        {/* Center: Live Shift Drawer Balance */}
        <div className="hidden md:flex items-center gap-4 bg-slate-50 border border-slate-200/80 px-4 py-1.5 rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${openShift ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${openShift ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-xs font-bold text-slate-600">
              {openShift ? `وردية مفتوحة #${openShift.shiftNumber}` : 'لا توجد وردية'}
            </span>
          </div>

          {openShift && (
            <div className="border-r border-slate-200 pr-3 flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-semibold">كاش الدرج الحالي:</span>
              <span className="text-sm font-black font-mono text-emerald-700">
                {openShift.closingCashSystem.toLocaleString()} {settings?.currency || 'ج'}
              </span>
            </div>
          )}
        </div>

        {/* Left Side: Cloud Sync & User Profile */}
        <div className="flex items-center gap-2">
          {/* Cloud Sync Button */}
          <button
            onClick={handleCloudSync}
            disabled={syncing}
            title={settings?.enableCloudSync ? 'مزامنة مع سحابة Firebase' : 'المزامنة السحابية غير مفعلة (أوفلاين)'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              settings?.enableCloudSync
                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            {settings?.enableCloudSync ? (
              <Cloud className={`h-3.5 w-3.5 ${syncing ? 'animate-bounce' : ''}`} />
            ) : (
              <CloudOff className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {settings?.enableCloudSync ? (syncing ? 'مزامنة...' : 'سحابي') : 'أوفلاين محلي'}
            </span>
          </button>

          {/* Quick Settings Icon */}
          <button
            onClick={() => setActiveTab('settings')}
            title="تخصيص المحل والإعدادات"
            className={`p-2 rounded-xl border transition cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Cashier / Role Switcher */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 border border-slate-200">
            <User className="h-3.5 w-3.5 text-slate-500 mr-1" />
            <select
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="المدير العام (المالك)">المدير (المالك)</option>
              <option value="كاشير المحل">كاشير المبيعات</option>
              <option value="فني الصيانة">فني الصيانة</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
