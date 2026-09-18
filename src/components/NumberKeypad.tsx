import React from 'react';
import { Delete, Plus, Minus } from 'lucide-react';

interface NumberKeypadProps {
  value: string;
  onChange: (val: string) => void;
  allowDecimal?: boolean;
  onConfirm?: () => void;
  confirmLabel?: string;
  showQuickAdjust?: boolean;
}

export const NumberKeypad: React.FC<NumberKeypadProps> = ({
  value,
  onChange,
  allowDecimal = true,
  onConfirm,
  confirmLabel,
  showQuickAdjust = true,
}) => {
  const handleDigit = (digit: string) => {
    if (value === '0' && digit !== '.') {
      onChange(digit);
      return;
    }
    if (digit === '.' && value.includes('.')) {
      return;
    }
    // Limit to reasonable length
    if (value.length >= 7) return;
    onChange(value + digit);
  };

  const handleBackspace = () => {
    if (value.length <= 1) {
      onChange('0');
    } else {
      onChange(value.slice(0, -1));
    }
  };

  const handleClear = () => {
    onChange('0');
  };

  const handleQuickAdd = (amount: number) => {
    const current = parseFloat(value) || 0;
    const next = Math.max(0, current + amount);
    onChange(Number.isInteger(next) ? next.toString() : next.toFixed(2));
  };

  return (
    <div className="w-full bg-slate-50 p-2 rounded-2xl border border-slate-200 select-none">
      {/* Quick Adjust Buttons */}
      {showQuickAdjust && (
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          <button
            type="button"
            onClick={() => handleQuickAdd(1)}
            className="h-11 flex items-center justify-center gap-0.5 bg-white text-slate-800 font-bold rounded-xl border border-slate-200 active:bg-slate-200 text-sm shadow-xs active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5 text-teal-600" />1
          </button>
          <button
            type="button"
            onClick={() => handleQuickAdd(5)}
            className="h-11 flex items-center justify-center gap-0.5 bg-white text-slate-800 font-bold rounded-xl border border-slate-200 active:bg-slate-200 text-sm shadow-xs active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5 text-teal-600" />5
          </button>
          <button
            type="button"
            onClick={() => handleQuickAdd(10)}
            className="h-11 flex items-center justify-center gap-0.5 bg-white text-slate-800 font-bold rounded-xl border border-slate-200 active:bg-slate-200 text-sm shadow-xs active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5 text-teal-600" />10
          </button>
          <button
            type="button"
            onClick={() => handleQuickAdd(-1)}
            className="h-11 flex items-center justify-center gap-0.5 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 active:bg-slate-200 text-sm shadow-xs active:scale-95 transition"
          >
            <Minus className="w-3.5 h-3.5 text-rose-500" />1
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleDigit(d)}
            className="h-14 bg-white text-slate-900 text-2xl font-bold rounded-xl border border-slate-200 active:bg-teal-50 active:border-teal-400 active:text-teal-700 shadow-xs flex items-center justify-center active:scale-95 transition"
          >
            {d}
          </button>
        ))}

        {allowDecimal ? (
          <button
            type="button"
            onClick={() => handleDigit('.')}
            className="h-14 bg-white text-slate-800 text-2xl font-black rounded-xl border border-slate-200 active:bg-slate-200 shadow-xs flex items-center justify-center active:scale-95 transition"
          >
            .
          </button>
        ) : (
          <button
            type="button"
            onClick={handleClear}
            className="h-14 bg-rose-50 text-rose-600 text-lg font-bold rounded-xl border border-rose-200 active:bg-rose-100 shadow-xs flex items-center justify-center active:scale-95 transition"
          >
            ล้าง
          </button>
        )}

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-14 bg-white text-slate-900 text-2xl font-bold rounded-xl border border-slate-200 active:bg-teal-50 active:border-teal-400 active:text-teal-700 shadow-xs flex items-center justify-center active:scale-95 transition"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          className="h-14 bg-slate-100 text-slate-700 text-xl font-bold rounded-xl border border-slate-200 active:bg-slate-300 shadow-xs flex items-center justify-center active:scale-95 transition"
          aria-label="ลบตัวเลข"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {onConfirm && confirmLabel && (
        <button
          type="button"
          onClick={onConfirm}
          className="mt-2 w-full h-14 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-lg rounded-xl shadow-md flex items-center justify-center active:scale-[0.98] transition"
        >
          {confirmLabel}
        </button>
      )}
    </div>
  );
};
