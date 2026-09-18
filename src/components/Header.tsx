import React from 'react';
import { Store, WifiOff, Settings } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../hooks/usePWAInstall';

interface HeaderProps {
  storeName: string;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ storeName, onOpenSettings }) => {
  const isOnline = useOnlineStatus();

  return (
    <header className="sticky top-0 z-30 bg-emerald-800 text-white shadow-md border-b border-emerald-900">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-900/80 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-xs">
            <Store className="w-5 h-5 text-emerald-200" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-base text-white truncate leading-tight">
              {storeName && storeName !== 'ร้านของชำเจ๊พร' ? storeName : 'ร้านขายของชำ'}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-200/90 leading-none mt-0.5">
              {!isOnline ? (
                <span className="flex items-center gap-1 text-amber-300 font-semibold">
                  <WifiOff className="w-3 h-3" />
                  ออฟไลน์ (ใช้งานได้ปกติ)
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  บันทึกในเครื่องทันที
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton compact={true} />
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 text-emerald-200 hover:text-white border border-emerald-700/50 active:scale-95 transition"
              title="ตั้งค่าร้านค้า"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
