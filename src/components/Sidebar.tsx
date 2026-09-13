import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ShoppingCart,
  Zap,
  Smartphone,
  Tag,
  Wrench,
  Clock,
  TrendingUp,
  Users,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { db } from '../db';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const pendingRepairs = useLiveQuery(() =>
    db.repairs.where('status').equals('repaired').count()
  ) || 0;

  const lowStock = useLiveQuery(async () => {
    const accs = await db.accessories.toArray();
    return accs.filter((a) => a.stockQuantity <= a.minStockAlert).length;
  }) || 0;

  const openShift = useLiveQuery(() =>
    db.shifts.where('status').equals('open').first()
  );

  interface NavItem {
    id: string;
    label: string;
    icon: React.ElementType;
    color: string;
    badge?: string;
    badgeColor?: string;
  }

  const navItems: NavItem[] = [
    {
      id: 'pos',
      label: 'نقطة البيع (POS)',
      icon: ShoppingCart,
      color: 'text-blue-600',
    },
    {
      id: 'wallets',
      label: 'فودافون كاش وإنستاباي',
      badge: '⚡ سريع',
      badgeColor: 'bg-red-500 text-white',
      icon: Zap,
      color: 'text-red-500',
    },
    {
      id: 'phones',
      label: 'الهواتف (جديد ومستعمل)',
      icon: Smartphone,
      color: 'text-indigo-600',
    },
    {
      id: 'accessories',
      label: 'الإكسسوارات والباركود',
      badge: lowStock > 0 ? `${lowStock} ناقص` : undefined,
      badgeColor: 'bg-red-500 text-white',
      icon: Tag,
      color: 'text-emerald-600',
    },
    {
      id: 'maintenance',
      label: 'ورشة الصيانة',
      badge: pendingRepairs > 0 ? `${pendingRepairs} جاهز` : undefined,
      badgeColor: 'bg-emerald-600 text-white',
      icon: Wrench,
      color: 'text-amber-600',
    },
    {
      id: 'shifts',
      label: 'الورديات والجرد',
      badge: openShift ? '● مفتوح' : undefined,
      badgeColor: 'bg-emerald-500 text-white',
      icon: Clock,
      color: 'text-purple-600',
    },
    {
      id: 'analytics',
      label: 'التقارير والتحليلات',
      icon: TrendingUp,
      color: 'text-teal-600',
    },
    {
      id: 'accounts',
      label: 'العملاء والموردون',
      icon: Users,
      color: 'text-slate-600',
    },
    {
      id: 'users',
      label: 'المستخدمون والصلاحيات',
      icon: ShieldCheck,
      color: 'text-blue-700',
    },
    {
      id: 'settings',
      label: 'إعدادات المحل',
      icon: Settings,
      color: 'text-blue-500',
    },
  ];

  return (
    <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-l border-slate-200 flex flex-col justify-between shrink-0 no-print overflow-hidden">
      {/* Top Nav */}
      <div className="flex lg:flex-col gap-1 lg:gap-0.5 overflow-x-auto lg:overflow-visible p-2 lg:p-3 lg:pt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer w-full text-right shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : item.color}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : item.badgeColor || 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="hidden lg:block p-4 border-t border-slate-100">
        <div className="text-center text-[10px] text-slate-400 font-semibold">
          <p className="font-display text-[11px] text-slate-500 font-bold mb-0.5">Mobile POS Pro v2.0</p>
          <p>يعمل أوفلاين 100% · Firebase جاهز</p>
        </div>
      </div>
    </aside>
  );
};
