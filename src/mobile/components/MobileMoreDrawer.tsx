import React from 'react';
import {
  X,
  Users,
  PieChart,
  Monitor,
  Lock,
  RefreshCw,
  ShieldAlert,
  ChevronLeft,
  Crown,
} from 'lucide-react';
import type { MobileTabType } from './MobileBottomNav';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: MobileTabType) => void;
  onSwitchToDesktop: () => void;
  onLock: () => void;
  onRefresh: () => void;
}

export function MobileMoreDrawer({
  isOpen,
  onClose,
  onNavigateTab,
  onSwitchToDesktop,
  onLock,
  onRefresh,
}: MobileMoreDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs select-none" dir="rtl">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-lg bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 shadow-2xl z-10 space-y-4 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
              GP
            </div>
            <div>
              <h3 className="text-sm font-black text-white">الغندور فون</h3>
              <span className="text-[11px] text-slate-400">القائمة الإضافية والإعدادات</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {/* Debts & VIP */}
          <button
            onClick={() => {
              onNavigateTab('debts');
              onClose();
            }}
            className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 flex items-center justify-between text-right active:scale-98 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Crown className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  الديون والآجل وعملاء VIP
                </span>
                <span className="text-[10px] text-slate-400 block">
                  حسابات العملاء، الموردين، وأجندة كاش المميزين
                </span>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>

          {/* Analytics */}
          <button
            onClick={() => {
              onNavigateTab('analytics');
              onClose();
            }}
            className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 flex items-center justify-between text-right active:scale-98 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  التقارير وتحليلات الأرباح
                </span>
                <span className="text-[10px] text-slate-400 block">
                  تفصيل أرباح الهواتف والإكسسوار والعمولات
                </span>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>

          {/* Switch to Desktop POS */}
          <button
            onClick={() => {
              onSwitchToDesktop();
              onClose();
            }}
            className="w-full p-3 rounded-2xl bg-blue-950/30 hover:bg-blue-900/40 border border-blue-500/30 flex items-center justify-between text-right active:scale-98 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-blue-300 block">
                  التبديل إلى شاشة الكاشير (Desktop POS)
                </span>
                <span className="text-[10px] text-blue-400/80 block">
                  فتح واجهة نقطة البيع الكاملة للكمبيوتر
                </span>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-blue-400" />
          </button>

          {/* Cloud Sync Refresh */}
          <button
            onClick={() => {
              onRefresh();
              onClose();
            }}
            className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 flex items-center justify-between text-right active:scale-98 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  تحديث البيانات سحابياً الآن
                </span>
                <span className="text-[10px] text-slate-400 block">
                  إعادة جلب ومزامنة كافة السجلات
                </span>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>

          {/* Lock Screen */}
          <button
            onClick={() => {
              onLock();
              onClose();
            }}
            className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 flex items-center justify-between text-right active:scale-98 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">قفل لوحة الموبايل</span>
                <span className="text-[10px] text-slate-400 block">
                  طلب رمز PIN للمالك عند إعادة الفتح
                </span>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
