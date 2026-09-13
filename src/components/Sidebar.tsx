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

  const navItems = [
    {
      id: 'pos',
      label: 'نقطة البيع السريع (POS)',
      icon: ShoppingCart,
      color: 'text-blue-600',
    },
    {
      id: 'wallets',
      label: 'فودافون كاش وإنستاباي',
      badge: '⚡ سريع',
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
      badge: lowStock > 0 ? `${lowStock} نواقص` : undefined,
      badgeColor: 'bg-red-500 text-white',
      icon: Tag,
      color: 'text-emerald-600',
    },
    {
      id: 'maintenance',
      label: 'ورشة الصيانة والإيصالات',
      badge: pendingRepairs > 0 ? `${pendingRepairs} جاهز` : undefined,
      badgeColor: 'bg-emerald-600 text-white',
      icon: Wrench,
      color: 'text-amber-600',
    },
    {
      id: 'shifts',
      label: 'الورديات وجرد الدرج',
      icon: Clock,
      color: 'text-purple-600',
    },
    {
      id: 'analytics',
      label: 'التقارير والأرباح الصافية',
      icon: TrendingUp,
      color: 'text-teal-600',
    },
    {
      id: 'accounts',
      label: 'العملاء والديون والموردين',
      icon: Users,
      color: 'text-slate-600',
    },
    {
      id: 'settings',
      label: 'تخصيص وهوية المحل',
      icon: Settings,
      color: 'text-blue-500',
    },
  ];

  return (
    <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-l border-slate-200 p-3 lg:p-4 flex flex-col justify-between shrink-0 no-print">
      <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : item.color}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : item.badgeColor || 'bg-red-100 text-red-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="hidden lg:block pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400 font-semibold">
        Mobile POS Pro v2.0 | يعمل أوفلاين 100%
      </div>
    </aside>
  );
};
