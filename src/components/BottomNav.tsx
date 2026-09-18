import React from 'react';
import { Store, Package, ArrowDownToLine, ClipboardCheck, BarChart3, Settings } from 'lucide-react';
import type { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  lowStockCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  lowStockCount,
}) => {
  const navItems = [
    {
      id: 'pos' as ActiveTab,
      label: 'ขาย',
      icon: Store,
    },
    {
      id: 'home' as ActiveTab,
      label: 'สินค้า',
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'stock-in' as ActiveTab,
      label: 'รับของ',
      icon: ArrowDownToLine,
    },
    {
      id: 'stock-count' as ActiveTab,
      label: 'นับสต็อก',
      icon: ClipboardCheck,
    },
    {
      id: 'report' as ActiveTab,
      label: 'รายงาน',
      icon: BarChart3,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16 items-center px-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`relative flex flex-col items-center justify-center h-full w-full select-none transition-colors active:scale-95 ${
                isActive ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1 rounded-xl transition-all ${
                    isActive ? 'bg-emerald-50 text-emerald-700' : ''
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                </div>

                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-black rounded-full shadow-xs ring-2 ring-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] leading-tight mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>

              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-emerald-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
