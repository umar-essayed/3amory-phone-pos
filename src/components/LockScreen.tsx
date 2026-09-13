import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Lock,
  UserCheck,
  Crown,
  ShieldCheck,
  BadgeCheck,
  Wrench,
  Delete,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { db } from '../db';
import type { User } from '../types';

interface LockScreenProps {
  onLogin: (user: User) => void;
  logoUrl?: string;
  storeName?: string;
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  owner: { label: 'مالك المحل', icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  manager: { label: 'مدير', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  cashier: { label: 'كاشير مبيعات', icon: BadgeCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  technician: { label: 'فني صيانة', icon: Wrench, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
};

export const LockScreen: React.FC<LockScreenProps> = ({ onLogin, logoUrl, storeName }) => {
  const users = useLiveQuery(() => db.users.filter((u) => u.isActive).toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get(1));

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);

  // Auto-select first user if only one exists or default
  useEffect(() => {
    if (users.length === 1 && !selectedUser) {
      setSelectedUser(users[0]);
    }
  }, [users, selectedUser]);

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setErrorMsg('');
      setPin((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setErrorMsg('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg('');
    setPin('');
  };

  const handleVerify = (enteredPin = pin) => {
    if (!selectedUser) return;
    if (enteredPin === selectedUser.pin) {
      onLogin(selectedUser);
    } else {
      setErrorMsg('كلمة المرور (PIN) غير صحيحة!');
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPin('');
      }, 500);
    }
  };

  // Check PIN as user types (auto-submit when reaching PIN length)
  useEffect(() => {
    if (selectedUser && pin.length > 0 && pin.length === selectedUser.pin.length) {
      handleVerify(pin);
    }
  }, [pin, selectedUser]);

  // Support physical keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedUser) return;
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        handleVerify();
      } else if (e.key === 'Escape') {
        setSelectedUser(null);
        setPin('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUser, pin]);

  const resolvedLogo = logoUrl || settings?.logoUrl || '/logo-removebg-preview.png';
  const resolvedStoreName = storeName || settings?.storeName || '3amory phone';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4 select-none font-sans">
      <div className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 flex flex-col items-center">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-20 w-20 rounded-2xl bg-slate-900/5 p-2 flex items-center justify-center shadow-inner mb-3">
            <img
              src={resolvedLogo}
              alt="Logo"
              className="max-h-full max-w-full object-contain filter drop-shadow"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo-removebg-preview.png';
              }}
            />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900">
            {resolvedStoreName}
          </h1>
          <p className="text-xs text-slate-500 font-bold mt-1">
            نظام إدارة المبيعات ونقاط البيع الكاشير (Mobile POS Pro)
          </p>
        </div>

        {!selectedUser ? (
          /* Step 1: Select User Screen */
          <div className="w-full">
            <div className="flex items-center justify-center gap-2 mb-4 text-slate-700">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <h2 className="font-display text-base font-bold">اختر حساب المستخدم لتسجيل الدخول:</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto p-1">
              {users.map((u) => {
                const roleConfig = ROLE_CONFIG[u.role] || ROLE_CONFIG.cashier;
                const RoleIcon = roleConfig.icon;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u);
                      setPin('');
                      setErrorMsg('');
                    }}
                    className="flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-blue-500 hover:shadow-lg transition-all duration-200 active:scale-95 text-right group cursor-pointer"
                  >
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-black text-lg ${roleConfig.bg} ${roleConfig.color} shadow-sm group-hover:scale-105 transition`}>
                      {(u.displayName || u.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 text-sm truncate group-hover:text-blue-600 transition">
                        {u.displayName || u.username}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <RoleIcon className={`h-3.5 w-3.5 ${roleConfig.color}`} />
                        <span className="text-[11px] font-bold text-slate-500">{roleConfig.label}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Step 2: PIN Entry Screen */
          <div className={`w-full max-w-sm flex flex-col items-center ${shake ? 'animate-bounce' : ''}`}>
            {/* Selected User Badge */}
            <div className="flex items-center justify-between w-full bg-slate-100/80 rounded-2xl p-3 mb-5 border border-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                  {(selectedUser.displayName || selectedUser.username).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-slate-900 text-sm">
                    {selectedUser.displayName || selectedUser.username}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500">
                    {ROLE_CONFIG[selectedUser.role]?.label || selectedUser.role}
                  </p>
                </div>
              </div>

              {users.length > 1 && (
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setPin('');
                    setErrorMsg('');
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs active:scale-95 transition cursor-pointer"
                >
                  <span>تبديل</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* PIN Display Indicators */}
            <div className="flex items-center justify-center gap-3 mb-2">
              {Array.from({ length: Math.max(4, selectedUser.pin.length) }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${
                    idx < pin.length
                      ? 'bg-blue-600 border-blue-600 scale-110 shadow-sm'
                      : 'border-slate-300 bg-white'
                  }`}
                />
              ))}
            </div>

            {/* Error Message */}
            {errorMsg ? (
              <p className="text-xs font-bold text-red-600 mt-1 mb-3 animate-pulse">{errorMsg}</p>
            ) : (
              <p className="text-[11px] font-semibold text-slate-400 mt-1 mb-3">أدخل رمز PIN المكون من 4 أرقام</p>
            )}

            {/* Numpad Keypad */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  className="h-14 rounded-2xl bg-white border border-slate-200 text-slate-800 font-mono text-xl font-bold shadow-xs hover:bg-slate-50 active:scale-90 active:bg-blue-50 transition cursor-pointer"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                className="h-14 rounded-2xl bg-slate-100 text-slate-500 font-bold text-xs hover:bg-slate-200 active:scale-90 transition cursor-pointer"
              >
                مسح
              </button>

              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="h-14 rounded-2xl bg-white border border-slate-200 text-slate-800 font-mono text-xl font-bold shadow-xs hover:bg-slate-50 active:scale-90 active:bg-blue-50 transition cursor-pointer"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                className="h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition cursor-pointer"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-slate-100 w-full text-center text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span>Mobile POS Pro · نظام مشفر ومحمي برقم PIN لكافة الورديات</span>
        </div>
      </div>
    </div>
  );
};
