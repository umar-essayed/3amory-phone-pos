import React, { useState } from 'react';
import { Lock, Delete, ShieldCheck, AlertCircle } from 'lucide-react';
import { db } from '../../db';

interface MobileLockScreenProps {
  onUnlock: () => void;
}

export function MobileLockScreen({ onUnlock }: MobileLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);
      if (nextPin.length >= 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const verifyPin = async (candidate: string) => {
    setLoading(true);
    try {
      // 1. Check default master PIN
      if (candidate === '2010') {
        localStorage.setItem('elghandour_mobile_auth', 'owner_master');
        onUnlock();
        return;
      }

      // 2. Check local DB users
      const users = await db.users.where('isActive').equals(1).toArray();
      const matched = users.find((u) => u.pin === candidate);

      if (matched) {
        localStorage.setItem('elghandour_mobile_auth', matched.id);
        onUnlock();
        return;
      }

      if (candidate.length >= 4) {
        setError('رمز المرور غير صحيح');
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }
      }
    } catch (err) {
      if (candidate === '2010') {
        localStorage.setItem('elghandour_mobile_auth', 'owner_master');
        onUnlock();
      } else {
        setError('تعذر التحقق من الرمز');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950/95 backdrop-blur-xl p-6 text-white select-none overflow-y-auto"
      dir="rtl"
    >
      {/* Top Branding */}
      <div className="flex flex-col items-center mt-6">
        <div className="relative mb-3 flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-blue-500/30">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-black text-white tracking-tight">الغندور فون</h2>
        <p className="text-xs text-slate-400 mt-1">لوحة متابعة المالك والإدارة الحية</p>
      </div>

      {/* PIN Dots Display */}
      <div className="flex flex-col items-center my-4 w-full">
        <span className="text-xs font-semibold text-slate-300 mb-3">أدخل رمز الدخول (PIN)</span>

        <div className="flex items-center gap-3 mb-3">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`h-4 w-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-blue-500 scale-125 shadow-md shadow-blue-500/50'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 animate-shake">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Keypad */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-3 mb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(num.toString())}
            className="h-16 rounded-2xl bg-slate-900/80 hover:bg-slate-800 active:bg-blue-600/30 active:scale-95 border border-slate-800 text-2xl font-bold text-white transition-all shadow-sm flex items-center justify-center font-mono"
          >
            {num}
          </button>
        ))}

        <button
          type="button"
          onClick={handleClear}
          className="h-16 rounded-2xl bg-slate-900/40 hover:bg-slate-800/80 active:scale-95 border border-slate-800/60 text-xs font-bold text-slate-400 transition-all flex items-center justify-center"
        >
          مسح
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-16 rounded-2xl bg-slate-900/80 hover:bg-slate-800 active:bg-blue-600/30 active:scale-95 border border-slate-800 text-2xl font-bold text-white transition-all shadow-sm flex items-center justify-center font-mono"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="h-16 rounded-2xl bg-slate-900/40 hover:bg-slate-800/80 active:scale-95 border border-slate-800/60 text-slate-300 transition-all flex items-center justify-center"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* Footer Info */}
      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium pb-2">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
        <span>رمز المالك الافتراضي: 2010</span>
      </div>
    </div>
  );
}
