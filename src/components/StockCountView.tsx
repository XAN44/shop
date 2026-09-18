import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  Search,
  Plus,
  Minus,
  Check,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  X,
  Boxes,
  CheckCircle2,
} from 'lucide-react';
import type { Product, Category, StockMovement } from '../types';
import { db } from '../db';
import {
  formatThaiNumber,
  formatThaiCurrency,
  formatThaiRelativeTime,
  generateId,
  matchesSearch,
} from '../lib/utils';

interface StockCountViewProps {
  products: Product[];
  categories: Category[];
  initialSearch?: string;
  focusProductId?: string;
  onStockUpdated?: () => void;
}

export const StockCountView: React.FC<StockCountViewProps> = ({
  products,
  categories,
  initialSearch = '',
  focusProductId,
  onStockUpdated,
}) => {
  // Search and filters
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [filterMode, setFilterMode] = useState<'ALL' | 'LOW' | 'CHANGED'>('ALL');

  // Track counts adjusted in this session: productId -> { initialQty: number; currentQty: number; lastSavedAt: number }
  const [sessionAdjustments, setSessionAdjustments] = useState<{
    [productId: string]: {
      initialQty: number;
      currentQty: number;
      lastSavedAt: number;
    };
  }>({});

  // Inline direct editing of quantity: which productId is currently typing
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus ref for auto-scrolling to requested product
  const focusedRowRef = useRef<HTMLDivElement | null>(null);

  // Active products only
  const activeProducts = useMemo(() => {
    return products.filter((p) => p.isActive !== false);
  }, [products]);

  // Auto scroll to focused product if specified
  useEffect(() => {
    if (focusProductId && focusedRowRef.current) {
      focusedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusProductId]);

  // Handle focus when inline editing opens
  useEffect(() => {
    if (editingProductId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingProductId]);

  // Save stock count adjustment immediately (Auto Save on Click / Change)
  const saveCountChange = async (product: Product, newQty: number) => {
    const safeQty = Math.max(0, Math.round(newQty));
    const oldQty = product.qtyOnHand;

    // Record or update session tracking
    setSessionAdjustments((prev) => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: {
          initialQty: existing ? existing.initialQty : oldQty,
          currentQty: safeQty,
          lastSavedAt: Date.now(),
        },
      };
    });

    const now = new Date().toISOString();

    try {
      // 1. Update product in DB
      await db.products.update(product.id, {
        qtyOnHand: safeQty,
        qtyLastCountedAt: now,
        updatedAt: now,
        lastActivityAt: now,
      });

      // 2. If quantity changed from original, log StockMovement
      const diff = safeQty - oldQty;
      if (diff !== 0) {
        const movement: StockMovement = {
          id: generateId(),
          productId: product.id,
          type: 'RECOUNT',
          qtyBefore: oldQty,
          qtyAfter: safeQty,
          diff,
          reason: 'COUNT' as any,
          sellPriceSnapshot: product.sellPrice,
          costSnapshot: product.avgCostPerUnit,
          productNameSnapshot: product.name,
          note: 'ปรับยอดจากการนับสต็อก',
          createdAt: now,
        };
        await db.stockMovements.add(movement);
      }

      onStockUpdated?.();
    } catch (err) {
      console.error('Failed to auto-save stock count:', err);
    }
  };

  // Adjust by step (+1 or -1)
  const handleStepQty = (product: Product, delta: number) => {
    const currentCount = sessionAdjustments[product.id]?.currentQty ?? product.qtyOnHand;
    const target = Math.max(0, currentCount + delta);
    saveCountChange(product, target);
  };

  // Start inline typing on number box
  const handleStartTyping = (product: Product) => {
    const currentCount = sessionAdjustments[product.id]?.currentQty ?? product.qtyOnHand;
    setEditingProductId(product.id);
    setEditingValue(String(currentCount));
  };

  // Commit typed number
  const handleCommitTyping = (product: Product) => {
    const parsed = parseInt(editingValue, 10);
    if (!isNaN(parsed)) {
      saveCountChange(product, parsed);
    }
    setEditingProductId(null);
  };

  // Mark as counted exactly as currently in system (Timestamp confirmation)
  const handleConfirmExact = async (product: Product) => {
    const now = new Date().toISOString();
    try {
      await db.products.update(product.id, {
        qtyLastCountedAt: now,
        updatedAt: now,
      });

      setSessionAdjustments((prev) => ({
        ...prev,
        [product.id]: {
          initialQty: product.qtyOnHand,
          currentQty: product.qtyOnHand,
          lastSavedAt: Date.now(),
        },
      }));
      onStockUpdated?.();
    } catch (err) {
      console.error('Failed to update count timestamp:', err);
    }
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return activeProducts.filter((p) => {
      // 1. Category Filter
      if (selectedCategoryId !== 'ALL' && p.categoryId !== selectedCategoryId) {
        return false;
      }

      // 2. Search Query (pure product name search)
      if (searchQuery.trim() && !matchesSearch(p.name, searchQuery)) {
        return false;
      }

      // 3. Status filter mode
      if (filterMode === 'LOW') {
        const isLow = p.qtyOnHand <= 0 || (p.reorderPoint !== null && p.qtyOnHand <= p.reorderPoint);
        if (!isLow) return false;
      } else if (filterMode === 'CHANGED') {
        if (!sessionAdjustments[p.id]) return false;
      }

      return true;
    });
  }, [activeProducts, selectedCategoryId, searchQuery, filterMode, sessionAdjustments]);

  // Summary statistics
  const stats = useMemo(() => {
    let outOfStock = 0;
    let lowStock = 0;
    let totalItems = activeProducts.length;

    activeProducts.forEach((p) => {
      if (p.qtyOnHand <= 0) {
        outOfStock++;
      } else if (p.reorderPoint !== null && p.qtyOnHand <= p.reorderPoint) {
        lowStock++;
      }
    });

    const adjustedCount = Object.keys(sessionAdjustments).length;

    return {
      totalItems,
      outOfStock,
      lowStock,
      adjustedCount,
    };
  }, [activeProducts, sessionAdjustments]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] pb-24 bg-slate-100">
      {/* 1. Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-14 z-20 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-heading font-black text-lg text-slate-900 leading-tight">
                นับสต็อกสินค้า
              </h1>
              <p className="text-[11px] text-slate-500">
                แตะปรับยอด [-] [จำนวน] [+] บันทึกอัตโนมัติทันที
              </p>
            </div>
          </div>

          {stats.adjustedCount > 0 && (
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold animate-in fade-in flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              นับแล้ว {stats.adjustedCount}
            </span>
          )}
        </div>

        {/* Quick KPI Pill Bar */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-center">
            <div className="text-[10px] text-slate-500 font-medium">สินค้าทั้งหมด</div>
            <div className="text-sm font-black text-slate-800 mt-0.5">
              {stats.totalItems} รายการ
            </div>
          </div>
          <div
            onClick={() => setFilterMode(filterMode === 'LOW' ? 'ALL' : 'LOW')}
            className={`border rounded-xl p-2 text-center cursor-pointer transition active:scale-95 ${
              filterMode === 'LOW'
                ? 'bg-amber-100 border-amber-400 text-amber-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-800 hover:bg-amber-100/50'
            }`}
          >
            <div className="text-[10px] font-medium">ของใกล้หมด / หมด</div>
            <div className="text-sm font-black mt-0.5">
              {stats.lowStock + stats.outOfStock} รายการ
            </div>
          </div>
          <div
            onClick={() => setFilterMode(filterMode === 'CHANGED' ? 'ALL' : 'CHANGED')}
            className={`border rounded-xl p-2 text-center cursor-pointer transition active:scale-95 ${
              filterMode === 'CHANGED'
                ? 'bg-blue-100 border-blue-400 text-blue-900'
                : 'bg-blue-50/70 border-blue-200 text-blue-800 hover:bg-blue-100/50'
            }`}
          >
            <div className="text-[10px] font-medium">ปรับแล้วรอบนี้</div>
            <div className="text-sm font-black mt-0.5">
              {stats.adjustedCount} รายการ
            </div>
          </div>
        </div>
      </div>

      {/* 2. Search Bar (Product Name Only - No Barcode) */}
      <div className="p-3 bg-white border-b border-slate-200/80 space-y-2.5">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อสินค้าเพื่อปรับยอดสต็อก..."
            className="w-full pl-9 pr-8 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="w-5 h-5 text-slate-400 hover:text-slate-600 absolute right-2.5 top-3 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Horizontal Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
              selectedCategoryId === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({activeProducts.length})
          </button>
          {categories.map((cat) => {
            const count = activeProducts.filter((p) => p.categoryId === cat.id).length;
            if (count === 0) return null;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Product List for Stock Count */}
      <div className="p-3 space-y-2.5">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2 mt-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Boxes className="w-6 h-6" />
            </div>
            <div className="font-heading font-bold text-slate-800 text-sm">
              ไม่พบรายการสินค้าที่ค้นหา
            </div>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่นเพื่อตรวจนับสต็อก
            </p>
            {(searchQuery || selectedCategoryId !== 'ALL' || filterMode !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategoryId('ALL');
                  setFilterMode('ALL');
                }}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        ) : (
          filteredProducts.map((product) => {
            const sessionAdj = sessionAdjustments[product.id];
            const currentQty = sessionAdj ? sessionAdj.currentQty : product.qtyOnHand;
            const initialQty = sessionAdj ? sessionAdj.initialQty : product.qtyOnHand;
            const diff = currentQty - initialQty;
            const hasChangedInSession = sessionAdj !== undefined;
            const isEditingThis = editingProductId === product.id;

            const isOutOfStock = currentQty <= 0;
            const isLowStock =
              product.reorderPoint !== null && currentQty <= product.reorderPoint;
            const catName =
              categories.find((c) => c.id === product.categoryId)?.name || 'ทั่วไป';

            const isFocused = focusProductId === product.id;

            return (
              <div
                key={product.id}
                ref={isFocused ? focusedRowRef : null}
                className={`bg-white rounded-2xl border transition-all p-3.5 shadow-2xs ${
                  isFocused
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
                    : hasChangedInSession
                    ? 'border-emerald-300 bg-emerald-50/15'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Row 1: Product Header Information */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isOutOfStock
                            ? 'bg-rose-500'
                            : isLowStock
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <h2 className="font-heading font-extrabold text-sm text-slate-900 truncate leading-snug">
                        {product.name}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">
                        {catName}
                      </span>
                      <span>·</span>
                      <span>ขาย {formatThaiCurrency(product.sellPrice)}</span>
                      <span>·</span>
                      <span>ทุน {formatThaiCurrency(product.avgCostPerUnit)}</span>
                    </div>
                  </div>

                  {/* Stock Status Badge */}
                  <div className="shrink-0 text-right">
                    {isOutOfStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                        <AlertCircle className="w-3 h-3" />
                        ของหมด
                      </span>
                    ) : isLowStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                        <AlertCircle className="w-3 h-3" />
                        ใกล้หมด
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                        <Check className="w-3 h-3" />
                        ปกติ
                      </span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="my-2.5 border-t border-slate-100" />

                {/* Row 2: The Stepper Control ([-] [ตัวเลข] [+]) with Immediate Auto Save */}
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Previous/Current Info & Diff Tag */}
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span>สต็อกเดิม:</span>
                      <span className="font-bold text-slate-700">
                        {formatThaiNumber(initialQty)} {product.unitName}
                      </span>
                    </div>

                    {/* Diff indicator / Feedback Tag */}
                    <div className="mt-1 flex items-center gap-1">
                      {hasChangedInSession ? (
                        diff !== 0 ? (
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-black ${
                              diff < 0
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {diff < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : (
                              <TrendingUp className="w-3 h-3" />
                            )}
                            {diff < 0
                              ? `ขาด ${Math.abs(diff)}`
                              : `เกิน +${diff}`}{' '}
                            {product.unitName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3" />
                            นับแล้วตรงเดิม
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConfirmExact(product)}
                          className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-2 py-0.5 rounded-md transition active:scale-95 flex items-center gap-1"
                          title="กดเพื่อยืนยันว่านับแล้วสต็อกตรงตามนี้"
                        >
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>นับแล้วตรง</span>
                        </button>
                      )}

                      {/* Saved micro indicator */}
                      {hasChangedInSession && (
                        <span className="text-[10px] text-emerald-600 font-semibold animate-in fade-in">
                          ✓ บันทึกแล้ว
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Stepper Controls ([-] [Number Button / Direct Input] [+]) */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-slate-100/90 p-1 rounded-2xl border border-slate-200">
                    {/* Minus button */}
                    <button
                      type="button"
                      onClick={() => handleStepQty(product, -1)}
                      disabled={currentQty <= 0}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition active:scale-90 font-black ${
                        currentQty <= 0
                          ? 'text-slate-300 bg-slate-200/50 cursor-not-allowed'
                          : 'bg-white text-slate-800 hover:bg-rose-50 hover:text-rose-600 shadow-2xs border border-slate-200'
                      }`}
                      title="ลดลง 1 ชิ้น"
                    >
                      <Minus className="w-5 h-5 stroke-[2.5]" />
                    </button>

                    {/* Middle: Number Display or Direct Typing Input */}
                    {isEditingThis ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleCommitTyping(product);
                        }}
                        className="w-16"
                      >
                        <input
                          ref={inputRef}
                          type="number"
                          min="0"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleCommitTyping(product)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingProductId(null);
                          }}
                          className="w-full h-11 text-center font-heading font-black text-base bg-blue-50 text-blue-900 border-2 border-blue-500 rounded-xl focus:outline-none"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartTyping(product)}
                        className="w-16 h-11 bg-white hover:bg-blue-50 rounded-xl flex flex-col items-center justify-center border border-slate-200 shadow-2xs transition active:scale-95 group"
                        title="แตะเพื่อพิมพ์ตัวเลขโดยตรง"
                      >
                        <span className="font-heading font-black text-base text-slate-900 group-hover:text-blue-600 leading-tight">
                          {formatThaiNumber(currentQty)}
                        </span>
                        <span className="text-[9px] text-slate-400 -mt-0.5 leading-none">
                          {product.unitName}
                        </span>
                      </button>
                    )}

                    {/* Plus button */}
                    <button
                      type="button"
                      onClick={() => handleStepQty(product, 1)}
                      className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex items-center justify-center transition active:scale-90 font-black shadow-2xs"
                      title="เพิ่มขึ้น 1 ชิ้น"
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Last Counted Time subtitle if available */}
                {product.qtyLastCountedAt && (
                  <div className="mt-2 text-[10px] text-slate-400 text-right">
                    นับครั้งล่าสุด {formatThaiRelativeTime(product.qtyLastCountedAt)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
