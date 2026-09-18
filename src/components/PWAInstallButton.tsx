import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    if (compact) {
      return (
        <button
          type="button"
          onClick={install}
          title="ติดตั้งสติกเกอร์แอปลงมือถือ"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>ติดตั้งแอป</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={install}
        className="w-full flex items-center justify-center gap-2 p-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm text-sm active:scale-98 transition"
      >
        <Download className="w-5 h-5" />
        <span>ติดตั้งแอปลงหน้าจอมือถือ (ใช้งานออฟไลน์ได้ 100%)</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        {compact ? (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ติดตั้งบน iPhone</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="w-full flex items-center justify-center gap-2 p-3 bg-slate-800 text-white font-bold rounded-xl shadow-sm text-sm active:scale-98 transition"
          >
            <Download className="w-5 h-5 text-amber-400" />
            <span>วิธีติดตั้งบน iPhone / iPad</span>
          </button>
        )}

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-slate-900 border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-heading font-bold text-base text-slate-900 flex items-center gap-2">
                  <Download className="w-5 h-5 text-teal-600" />
                  ติดตั้งลงหน้าจอโฮม iPhone
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                    1
                  </span>
                  <div>
                    กดปุ่ม <span className="font-bold text-slate-900">แชร์</span> <Share2 className="w-4 h-4 inline text-blue-600 mx-0.5" /> ที่แถบด้านล่าง Safari
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                    2
                  </span>
                  <div>
                    เลื่อนลงแล้วเลือก <span className="font-bold text-slate-900">"เพิ่มไปยังหน้าจอโฮม"</span> <PlusSquare className="w-4 h-4 inline text-teal-600 mx-0.5" />
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                    3
                  </span>
                  <div>
                    กด <span className="font-bold text-slate-900">"เพิ่ม"</span> ที่มุมบนขวา เพื่อเข้าใช้แบบเต็มจอเหมือนแอปจริง
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 bg-teal-600 text-white font-bold rounded-xl active:bg-teal-700 text-sm shadow-xs transition"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
