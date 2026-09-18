import React, { useState, useMemo, useEffect } from 'react';
import {
  Store,
  Search,
  Plus,
  Minus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  ArrowLeft,
  CheckCircle2,
  Banknote,
  Coins,
  Receipt,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Tag,
  Percent,
} from 'lucide-react';
import type { Product, CartItem, StockMovement } from '../types';
import { db } from '../db';
import {
  formatThaiCurrency,
  formatThaiNumber,
  formatThaiFullDate,
  calculateChangeBreakdown,
  formatChangeBreakdownThai,
  matchesSearch,
  generateId,
} from '../lib/utils';

interface CashierViewProps {
  products: Product[];
  storeName: string;
  onStockUpdated: () => void;
  onOpenProductDetail: (product: Product) => void;
}

export const CashierView: React.FC<CashierViewProps> = ({
  products,
  storeName,
  onStockUpdated,
  onOpenProductDetail,
}) => {
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isQuickExpanded, setIsQuickExpanded] = useState<boolean>(true);

  // Modals & Overlays
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState<boolean>(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [completedBill, setCompletedBill] = useState<{
    billId: string;
    items: CartItem[];
    total: number;
    received: number;
    change: number;
    changeBreakdown: ReturnType<typeof calculateChangeBreakdown>;
    createdAt: string;
  } | null>(null);

  // Search Overlay State
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Settlement State
  const [receivedAmountStr, setReceivedAmountStr] = useState<string>('');
  const [banknoteCounts, setBanknoteCounts] = useState<{ [denom: number]: number }>({
    20: 0,
    50: 0,
    100: 0,
    500: 0,
    1000: 0,
  });
  const [isSubmittingSale, setIsSubmittingSale] = useState<boolean>(false);
  const [saleError, setSaleError] = useState<string>('');

  // Filter active products
  const activeProducts = useMemo(() => {
    return products.filter((p) => p.isActive);
  }, [products]);

  // Quick sale items (items flagged with quickSale or top 6-12 products)
  const quickItems = useMemo(() => {
    const flagged = activeProducts.filter((p) => p.quickSale);
    if (flagged.length >= 6) return flagged;
    // Fallback: Pick common grocery items or first 8 active products
    const combined = [...flagged];
    for (const p of activeProducts) {
      if (!combined.some((item) => item.id === p.id)) {
        combined.push(p);
      }
      if (combined.length >= 8) break;
    }
    return combined;
  }, [activeProducts]);

  // Cart Calculations
  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  const grandTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.sellPrice * item.qty, 0);
  }, [cart]);

  // Cash received calculation
  const receivedNum = parseFloat(receivedAmountStr) || 0;
  const changeAmount = Math.max(0, Math.round((receivedNum - grandTotal) * 100) / 100);
  const isExactOrOver = receivedNum >= grandTotal && grandTotal > 0;
  const shortfallAmount = Math.max(0, Math.round((grandTotal - receivedNum) * 100) / 100);

  // Change Breakdown recommendation
  const changeBreakdown = useMemo(() => {
    if (!isExactOrOver || changeAmount <= 0) return [];
    return calculateChangeBreakdown(changeAmount);
  }, [isExactOrOver, changeAmount]);

  // Add product to cart
  const handleAddToCart = (product: Product, quantity: number = 1) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const item = updated[existingIndex];
        const newQty = item.qty + quantity;
        updated[existingIndex] = {
          ...item,
          qty: newQty,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unitName: product.unitName,
            barcode: product.barcode,
            qty: quantity,
            originalPrice: product.sellPrice,
            sellPrice: product.sellPrice,
            qtyOnHand: product.qtyOnHand,
            avgCostPerUnit: product.avgCostPerUnit,
          },
        ];
      }
    });
  };

  // Adjust cart item quantity
  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  // Remove single item from cart
  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Clear entire cart
  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
  };

  // Open Settlement Bottom Sheet
  const handleOpenSettlement = () => {
    if (cart.length === 0) return;
    setSaleError('');
    setReceivedAmountStr('');
    setBanknoteCounts({ 20: 0, 50: 0, 100: 0, 500: 0, 1000: 0 });
    setIsSettlementOpen(true);
  };

  // Tap banknote button (accumulate)
  const handleAddBanknote = (denom: number) => {
    setBanknoteCounts((prev) => {
      const newCounts = { ...prev, [denom]: (prev[denom] || 0) + 1 };
      // Calculate total from all banknotes
      let sum = 0;
      Object.entries(newCounts).forEach(([d, count]) => {
        sum += parseInt(d, 10) * count;
      });
      setReceivedAmountStr(sum.toString());
      return newCounts;
    });
  };

  // Exact amount button
  const handleSetExactAmount = () => {
    setReceivedAmountStr(grandTotal.toString());
    setBanknoteCounts({ 20: 0, 50: 0, 100: 0, 500: 0, 1000: 0 });
  };

  // Reset received amount
  const handleResetReceived = () => {
    setReceivedAmountStr('');
    setBanknoteCounts({ 20: 0, 50: 0, 100: 0, 500: 0, 1000: 0 });
  };

  // Preset test scenarios from screenshot
  const handleApplyPreset = (type: 1 | 2 | 3 | 4 | 5) => {
    if (type === 1) {
      // 1. รับ ฿100 (ทอน 21 หรือตามจริง)
      setReceivedAmountStr('100');
      setBanknoteCounts({ 20: 0, 50: 0, 100: 1, 500: 0, 1000: 0 });
    } else if (type === 2) {
      // 2. จ่ายพอดี
      handleSetExactAmount();
    } else if (type === 3) {
      // 3. รับ ฿500
      setReceivedAmountStr('500');
      setBanknoteCounts({ 20: 0, 50: 0, 100: 0, 500: 1, 1000: 0 });
    } else if (type === 4) {
      // 4. รับ ฿50 (ทดสอบเงินไม่พอ)
      setReceivedAmountStr('50');
      setBanknoteCounts({ 20: 0, 50: 1, 100: 0, 500: 0, 1000: 0 });
    } else if (type === 5) {
      // 5. ทดสอบบิลเสร็จทันที
      const testTotal = grandTotal > 0 ? grandTotal : 79;
      const testReceived = 100;
      const testChange = testReceived - testTotal;
      setCompletedBill({
        billId: generateId().slice(0, 8).toUpperCase(),
        items: cart.length > 0 ? cart : [
          {
            productId: 'test_1',
            name: 'มาม่าต้มยำกุ้ง',
            unitName: 'ซอง',
            qty: 2,
            originalPrice: 7,
            sellPrice: 7,
            qtyOnHand: 10,
            avgCostPerUnit: 5.5,
          },
          {
            productId: 'test_2',
            name: 'ไข่ไก่เบอร์ 2',
            unitName: 'ฟอง',
            qty: 10,
            originalPrice: 4.5,
            sellPrice: 4.5,
            qtyOnHand: 48,
            avgCostPerUnit: 3.5,
          },
          {
            productId: 'test_3',
            name: 'น้ำดื่มตราสิงห์ 600 มล.',
            unitName: 'ขวด',
            qty: 2,
            originalPrice: 10,
            sellPrice: 10,
            qtyOnHand: 15,
            avgCostPerUnit: 7.5,
          },
        ],
        total: testTotal,
        received: testReceived,
        change: testChange,
        changeBreakdown: calculateChangeBreakdown(testChange),
        createdAt: new Date().toISOString(),
      });
      setIsSettlementOpen(false);
    }
  };

  // Confirm Sale & Write to Database
  const handleCompleteSale = async () => {
    if (!isExactOrOver || cart.length === 0) return;

    try {
      setIsSubmittingSale(true);
      setSaleError('');
      const now = new Date().toISOString();
      const billId = generateId().slice(0, 8).toUpperCase();

      // Transaction: Deduct stock and record StockMovement of type 'SALE'
      await db.transaction('rw', [db.products, db.stockMovements], async () => {
        for (const item of cart) {
          const product = await db.products.get(item.productId);
          if (product) {
            const qtyBefore = product.qtyOnHand;
            const qtyAfter = qtyBefore - item.qty;

            // Update product stock
            await db.products.update(product.id, {
              qtyOnHand: qtyAfter,
              lastActivityAt: now,
              updatedAt: now,
            });

            // Create movement record with type 'SALE'
            const movement: StockMovement = {
              id: generateId(),
              productId: product.id,
              type: 'SALE',
              qtyBefore: qtyBefore,
              qtyAfter: qtyAfter,
              diff: -item.qty,
              reason: 'SOLD',
              sellPriceSnapshot: item.sellPrice,
              costSnapshot: product.avgCostPerUnit,
              productNameSnapshot: product.name,
              note: `ขายหน้าร้าน (บิล #${billId})`,
              createdAt: now,
            };

            await db.stockMovements.add(movement);
          }
        }
      });

      // Prepare completion state
      setCompletedBill({
        billId,
        items: [...cart],
        total: grandTotal,
        received: receivedNum,
        change: changeAmount,
        changeBreakdown: changeBreakdown,
        createdAt: now,
      });

      // Reset cart and close settlement sheet
      setCart([]);
      setIsSettlementOpen(false);
      onStockUpdated();
    } catch (err: unknown) {
      console.error('Sale transaction error:', err);
      setSaleError('เกิดข้อผิดพลาดในการบันทึกการขาย กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Keyboard shortcut (F12 to checkout)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0 && !isSettlementOpen) {
          handleOpenSettlement();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isSettlementOpen]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] pb-24">
      {/* 1. Header Bar for Cashier */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-14 z-20 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Store className="w-4 h-4" />
          </div>
          <h1 className="font-heading font-black text-lg text-slate-900 leading-tight">ขาย</h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-full text-xs font-semibold shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            เจ้าของร้าน
          </span>
        </div>
      </div>

      {/* 2. Search Trigger Input */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200/70">
        <button
          type="button"
          onClick={() => setIsSearchOverlayOpen(true)}
          className="w-full flex items-center justify-between bg-white border border-slate-300 rounded-2xl px-4 py-3 shadow-2xs text-left active:scale-[0.99] transition hover:border-emerald-500"
        >
          <div className="flex items-center gap-2.5 text-slate-400 text-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <span>ค้นหาชื่อสินค้าเพื่อคิดเงิน...</span>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl">
            ค้นหา
          </span>
        </button>
      </div>

      {/* 3. Quick Sale Section (ขายด่วน แตะเพิ่มทันที) */}
      <div className="p-3.5 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <span>ขายด่วน (แตะเพิ่มทันที)</span>
          </div>
          <button
            type="button"
            onClick={() => setIsQuickExpanded(!isQuickExpanded)}
            className="flex items-center gap-1 text-xs text-emerald-700 font-bold hover:text-emerald-800 active:scale-95 transition"
          >
            <span>{isQuickExpanded ? 'ย่อลง' : 'ดูเพิ่ม'}</span>
            {isQuickExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isQuickExpanded && (
          <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-150">
            {quickItems.map((item) => {
              const isLow = item.reorderPoint !== null && item.qtyOnHand <= item.reorderPoint;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAddToCart(item, 1)}
                  className="p-2.5 bg-amber-50/70 hover:bg-amber-100/80 active:bg-amber-200/80 border border-amber-200/90 rounded-2xl flex flex-col justify-between text-left transition active:scale-95 shadow-2xs relative overflow-hidden group min-h-[72px]"
                >
                  <div className="font-bold text-xs text-slate-900 line-clamp-2 leading-tight">
                    {item.name}
                  </div>
                  <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-amber-200/50">
                    <span className="text-xs font-black text-amber-950">
                      {formatThaiCurrency(item.sellPrice)}
                    </span>
                    <span className={`text-[10px] font-semibold ${isLow ? 'text-rose-600' : 'text-slate-500'}`}>
                      เหลือ {formatThaiNumber(item.qtyOnHand)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Cart List Section (รายการสินค้าในตะกร้า) */}
      <div className="flex-1 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">รายการสินค้าในตะกร้า</span>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 text-[11px] font-bold rounded-full">
              {cart.length}
            </span>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={handleClearCart}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold active:scale-95 transition"
            >
              ล้างตะกร้า
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-2 mt-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
              <Store className="w-6 h-6" />
            </div>
            <div className="font-bold text-sm text-slate-800">ยังไม่มีสินค้าในตะกร้า</div>
            <p className="text-xs text-slate-500 max-w-[240px] mx-auto leading-relaxed">
              แตะเลือกสินค้าจากกล่องขายด่วนด้านบน หรือค้นหาสินค้าเพื่อเริ่มคิดเงิน
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item) => {
              const itemTotal = item.sellPrice * item.qty;
              const hasDiscount = item.sellPrice < item.originalPrice;

              return (
                <div
                  key={item.productId}
                  className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition"
                >
                  {/* Left: Item Info (Tappable to Edit) */}
                  <div
                    onClick={() => setEditingItem({ ...item })}
                    className="flex-1 min-w-0 cursor-pointer active:opacity-75 transition"
                  >
                    <div className="font-bold text-sm text-slate-900 truncate leading-tight">
                      {item.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded-md font-semibold text-[11px]">
                        {item.unitName} · เหลือ {formatThaiNumber(item.qtyOnHand)}
                      </span>
                      {hasDiscount && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md font-bold">
                          ลดพิเศษ
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-sm font-black text-emerald-700">
                        {formatThaiCurrency(itemTotal)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        (@{formatThaiCurrency(item.sellPrice)})
                      </span>
                    </div>
                  </div>

                  {/* Right: Quantity Stepper & Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 p-0.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.productId, -1)}
                        className="w-7 h-7 rounded-lg bg-white shadow-2xs text-slate-700 flex items-center justify-center hover:bg-slate-50 active:scale-90 transition font-bold"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-black text-slate-900">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.productId, 1)}
                        className="w-7 h-7 rounded-lg bg-white shadow-2xs text-slate-700 flex items-center justify-center hover:bg-slate-50 active:scale-90 transition font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(item.productId)}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 flex items-center justify-center active:scale-90 transition"
                      title="ลบรายการ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Sticky Bottom Summary & Pay Button */}
      <div className="fixed bottom-16 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl">
        <div className="max-w-md mx-auto p-3.5 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">
              ยอดรวม ({formatThaiNumber(totalItemsCount)} ชิ้น)
            </div>
            <div className="text-xl font-black text-slate-900 tracking-tight leading-none">
              {formatThaiCurrency(grandTotal)}
            </div>
          </div>

          <button
            type="button"
            disabled={cart.length === 0}
            onClick={handleOpenSettlement}
            className="flex-1 max-w-[200px] py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold text-sm rounded-2xl shadow-sm active:scale-95 transition flex items-center justify-center gap-1.5"
          >
            <Banknote className="w-4 h-4" />
            <span>รับเงิน (F12)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCREEN 2: Overlay ค้นหาสินค้า & สแกนบาร์โค้ด */}
      {/* ========================================================================= */}
      {isSearchOverlayOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-150">
          {/* Header */}
          <div className="p-3 border-b border-slate-200 flex items-center gap-2 bg-white">
            <button
              type="button"
              onClick={() => {
                setIsSearchOverlayOpen(false);
                setIsCameraActive(false);
                setSearchQuery('');
              }}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                autoFocus
                placeholder="ค้นหาชื่อสินค้า..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
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
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeProducts
              .filter((p) => matchesSearch(p.name, searchQuery))
              .map((p) => {
                const isOutOfStock = p.qtyOnHand <= 0;
                const isLow = p.reorderPoint !== null && p.qtyOnHand <= p.reorderPoint;

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      handleAddToCart(p, 1);
                      setIsSearchOverlayOpen(false);
                    }}
                    className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 hover:border-emerald-400 active:bg-emerald-50/50 cursor-pointer transition shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isOutOfStock
                            ? 'bg-rose-500'
                            : isLow
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 truncate">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>
                            คงเหลือ {formatThaiNumber(p.qtyOnHand)} {p.unitName}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black text-sm text-slate-900">
                        {formatThaiCurrency(p.sellPrice)}
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                        + แตะใส่ตะกร้า
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: Bottom Sheet "รับเงิน" (Cash Settlement) */}
      {/* ========================================================================= */}
      {isSettlementOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Quick Test Scenario Pills (As in Mockup Image) */}
            <div className="bg-slate-900 p-2 overflow-x-auto flex gap-1.5 shrink-0 scrollbar-none">
              <button
                type="button"
                onClick={() => handleApplyPreset(1)}
                className="whitespace-nowrap px-2 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] rounded-lg font-bold transition"
              >
                1. รับ ฿100
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(2)}
                className="whitespace-nowrap px-2 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] rounded-lg font-bold transition"
              >
                2. จ่ายพอดี
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(3)}
                className="whitespace-nowrap px-2 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] rounded-lg font-bold transition"
              >
                3. รับ ฿500
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(4)}
                className="whitespace-nowrap px-2 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 text-[10px] rounded-lg font-bold transition"
              >
                4. ขาด (รับ ฿50)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(5)}
                className="whitespace-nowrap px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] rounded-lg font-bold transition"
              >
                5. ทดสอบบิลเสร็จ
              </button>
            </div>

            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-700" />
                <span className="font-bold text-base text-slate-900">รับเงินสด</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">ต้องชำระ</span>
                <span className="font-black text-lg text-slate-900">
                  {formatThaiCurrency(grandTotal)}
                </span>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Change Calculation Box */}
              <div
                className={`p-4 rounded-3xl border transition-all ${
                  isExactOrOver
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-600">เงินทอน</span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>คำนวณอัตโนมัติ (รับมา {formatThaiCurrency(receivedNum)})</span>
                  </div>
                </div>

                <div className="text-center py-2">
                  <div
                    className={`text-4xl font-black tracking-tight leading-none ${
                      isExactOrOver ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {isExactOrOver ? formatThaiCurrency(changeAmount) : '฿0'}
                  </div>
                  {!isExactOrOver && receivedNum > 0 && (
                    <div className="text-xs font-bold text-rose-600 mt-1">
                      ยังขาดอีก {formatThaiCurrency(shortfallAmount)}
                    </div>
                  )}
                </div>

                {/* Change Breakdown Recommendation */}
                {isExactOrOver && changeAmount > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-200/80">
                    <div className="text-[11px] font-bold text-emerald-950 flex items-center justify-center gap-1 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>แนะนำเงินทอน:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {changeBreakdown.map((item, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-900 text-xs font-bold rounded-xl shadow-2xs"
                        >
                          {item.label} × {item.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Cash Banknote Buttons (Accumulative) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    แตะเลือกหรือสะสมจำนวนเงินที่รับมา
                  </span>
                  {receivedNum > 0 && (
                    <button
                      type="button"
                      onClick={handleResetReceived}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold"
                    >
                      ล้างยอด
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[20, 50, 100, 500, 1000].map((denom) => {
                    const count = banknoteCounts[denom] || 0;
                    return (
                      <button
                        key={denom}
                        type="button"
                        onClick={() => handleAddBanknote(denom)}
                        className={`p-2.5 rounded-2xl border text-center active:scale-95 transition relative ${
                          count > 0
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-black shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-black text-sm">฿{denom}</div>
                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          {count > 0 ? `${count} ใบ (฿${denom * count})` : 'กดเพิ่ม'}
                        </div>
                      </button>
                    );
                  })}

                  {/* Exact Amount Button */}
                  <button
                    type="button"
                    onClick={handleSetExactAmount}
                    className="p-2.5 rounded-2xl border border-amber-300 bg-amber-50/80 hover:bg-amber-100 text-amber-950 text-center active:scale-95 transition font-bold"
                  >
                    <div className="font-black text-sm">พอดี</div>
                    <div className="text-[10px] text-amber-800 mt-0.5">
                      {formatThaiCurrency(grandTotal)}
                    </div>
                  </button>
                </div>
              </div>

              {/* Manual Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  หรือระบุจำนวนเงินที่รับมา
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={receivedAmountStr}
                    onChange={(e) => setReceivedAmountStr(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                  <span className="absolute left-3.5 top-3.5 font-bold text-slate-400">฿</span>
                </div>
              </div>

              {saleError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saleError}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSettlementOpen(false)}
                className="py-3 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl active:scale-95 transition"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                disabled={!isExactOrOver || isSubmittingSale}
                onClick={handleCompleteSale}
                className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 text-white disabled:text-slate-500 font-bold text-sm rounded-2xl shadow-sm active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {!isExactOrOver
                    ? `รับเงินยังไม่ครบ (ขาด ${formatThaiCurrency(shortfallAmount)})`
                    : `ปิดการขาย (รับ ${formatThaiCurrency(receivedNum)} · ทอน ${formatThaiCurrency(
                        changeAmount
                      )})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 4: Bottom Sheet แก้ไขรายการในตะกร้า (Edit Cart Item) */}
      {/* ========================================================================= */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-start justify-between bg-white">
              <div>
                <h3 className="font-black text-base text-slate-900 leading-tight">
                  {editingItem.name}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  ราคาปกติ: {formatThaiCurrency(editingItem.originalPrice)} / {editingItem.unitName} ·
                  สต็อกคงเหลือ: {formatThaiNumber(editingItem.qtyOnHand)} {editingItem.unitName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-xl active:scale-90 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              {/* Quantity adjustment */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">จำนวนที่ซื้อ</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, qty: Math.max(1, prev.qty - 1) } : null
                      )
                    }
                    className="w-8 h-8 rounded-xl bg-white border border-slate-300 text-slate-800 flex items-center justify-center active:scale-90 transition font-bold"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-black text-base text-slate-900 w-8 text-center">
                    {editingItem.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingItem((prev) => (prev ? { ...prev, qty: prev.qty + 1 } : null))
                    }
                    className="w-8 h-8 rounded-xl bg-white border border-slate-300 text-slate-800 flex items-center justify-center active:scale-90 transition font-bold"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Price adjustment (ลดราคาพิเศษ) */}
              <div className="space-y-2">
                <div>
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ราคาขายเฉพาะครั้งนี้ (ลดราคาพิเศษ)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    สำหรับลูกค้าประจำ / ลดพิเศษเฉพาะบิลนี้ ไม่กระทบราคาตั้งต้น
                  </p>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={editingItem.sellPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditingItem((prev) => (prev ? { ...prev, sellPrice: val } : null));
                    }}
                    className="w-full pl-9 pr-14 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute left-3 top-3 font-bold text-slate-400">฿</span>
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-semibold">
                    / {editingItem.unitName}
                  </span>
                </div>

                {/* Preset discount buttons */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingItem((prev) =>
                        prev
                          ? { ...prev, sellPrice: Math.max(0, prev.originalPrice - 0.5) }
                          : null
                      )
                    }
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl active:scale-95 transition"
                  >
                    -฿0.50
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, sellPrice: Math.max(0, prev.originalPrice - 1) } : null
                      )
                    }
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl active:scale-95 transition"
                  >
                    -฿1.00
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingItem((prev) =>
                        prev
                          ? {
                              ...prev,
                              sellPrice: Math.round(prev.originalPrice * 0.9 * 100) / 100,
                            }
                          : null
                      )
                    }
                    className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl active:scale-95 transition"
                  >
                    ลด 10%
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, sellPrice: prev.originalPrice } : null
                      )
                    }
                    className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl active:scale-95 transition border border-emerald-200"
                  >
                    ราคาปกติ
                  </button>
                </div>
              </div>

              {/* Row Subtotal */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <span className="text-xs text-slate-600 font-semibold">
                  ยอดรวมแถวนี้ ({editingItem.qty} {editingItem.unitName} ×{' '}
                  {formatThaiCurrency(editingItem.sellPrice)})
                </span>
                <span className="font-black text-base text-emerald-800">
                  {formatThaiCurrency(editingItem.sellPrice * editingItem.qty)}
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setCart((prev) =>
                    prev.map((it) => (it.productId === editingItem.productId ? editingItem : it))
                  );
                  setEditingItem(null);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-2xl shadow-xs active:scale-95 transition"
              >
                ✓ บันทึกการแก้ไข
              </button>

              <button
                type="button"
                onClick={() => {
                  handleRemoveFromCart(editingItem.productId);
                  setEditingItem(null);
                }}
                className="w-full py-2 text-xs text-rose-600 hover:text-rose-800 font-bold active:scale-95 transition flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>นำออกจากตะกร้า</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECEIPT / BILL COMPLETED MODAL (ทดสอบบิลเสร็จ) */}
      {/* ========================================================================= */}
      {completedBill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 border border-slate-200 space-y-4 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                บิล #{completedBill.billId}
              </div>
              <h2 className="font-heading font-black text-xl text-slate-900">
                บันทึกการขายสำเร็จ!
              </h2>
              <div className="text-xs text-slate-500 mt-0.5">
                {formatThaiFullDate(completedBill.createdAt)}
              </div>
            </div>

            {/* Change Highlight Box */}
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-3xl space-y-2">
              <span className="text-xs font-bold text-emerald-800 block">
                {completedBill.change > 0 ? 'อย่าลืมทอนเงิน' : 'รับเงินพอดี (ไม่ต้องทอน)'}
              </span>
              <div className="text-4xl font-black text-emerald-700">
                {formatThaiCurrency(completedBill.change)}
              </div>
              {completedBill.change > 0 && completedBill.changeBreakdown.length > 0 && (
                <div className="pt-2 border-t border-emerald-200/80">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {completedBill.changeBreakdown.map((b, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-white text-emerald-900 border border-emerald-300 text-[11px] font-bold rounded-lg shadow-2xs"
                      >
                        {b.label} × {b.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Summary details */}
            <div className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1 text-slate-600 text-left border border-slate-200">
              <div className="flex justify-between font-semibold">
                <span>ยอดสินค้า ({completedBill.items.length} รายการ)</span>
                <span>{formatThaiCurrency(completedBill.total)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>รับเงินสดมา</span>
                <span>{formatThaiCurrency(completedBill.received)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>เงินทอน</span>
                <span className="text-emerald-700 font-black">
                  {formatThaiCurrency(completedBill.change)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCompletedBill(null)}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-2xl shadow-sm active:scale-95 transition"
            >
              เริ่มการขายบิลใหม่
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
