import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  AlertTriangle,
  ArrowDownToLine,
  ClipboardCheck,
  Package,
  Plus,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingDown,
} from 'lucide-react';
import type { Product, Category } from '../types';
import {
  formatThaiCurrency,
  formatThaiNumber,
  formatThaiRelativeTime,
  matchesSearch,
} from '../lib/utils';

interface HomeViewProps {
  products: Product[];
  categories: Category[];
  onOpenStockIn: (productId?: string) => void;
  onOpenStockCount: (productId?: string) => void;
  onSelectProduct: (product: Product) => void;
  onAddNewProduct: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  categories,
  onOpenStockIn,
  onOpenStockCount,
  onSelectProduct,
  onAddNewProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'ALL'>('ALL');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Category map for quick lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Low stock products count
  const lowStockProducts = useMemo(() => {
    return products.filter(
      (p) => p.isActive && p.reorderPoint !== null && p.qtyOnHand <= p.reorderPoint
    );
  }, [products]);

  // Filtered & sorted products (sorted by lastActivityAt DESC)
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (!p.isActive) return false;
        if (filterLowStockOnly) {
          if (p.reorderPoint === null || p.qtyOnHand > p.reorderPoint) return false;
        }
        if (selectedCategoryId !== 'ALL' && p.categoryId !== selectedCategoryId) {
          return false;
        }
        if (searchQuery.trim()) {
          const categoryName = p.categoryId ? categoryMap.get(p.categoryId) || '' : '';
          return (
            matchesSearch(p.name, searchQuery) ||
            matchesSearch(categoryName, searchQuery) ||
            matchesSearch(p.unitName, searchQuery)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.lastActivityAt || a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.lastActivityAt || b.updatedAt || b.createdAt).getTime();
        return timeB - timeA; // Most recently used on top
      });
  }, [products, searchQuery, selectedCategoryId, filterLowStockOnly, categoryMap]);

  return (
    <div className="pb-28">
      {/* 1. Quick Search Box (Always at top, clear button, partial Thai search) */}
      <div className="sticky top-14 z-20 bg-slate-100/95 backdrop-blur-xs px-4 pt-3 pb-2 border-b border-slate-200/60">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <input
            id="home-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อสินค้า หมวดหมู่ หรือหน่วย..."
            className="w-full h-12 pl-11 pr-10 bg-white rounded-2xl border border-slate-300 text-slate-900 placeholder:text-slate-400 text-base font-medium shadow-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 active:scale-95"
              aria-label="ล้างคำค้นหา"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Category Horizontal Filter Chips */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 pb-1">
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryId('ALL');
                setFilterLowStockOnly(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                selectedCategoryId === 'ALL' && !filterLowStockOnly
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              ทั้งหมด ({products.filter((p) => p.isActive).length})
            </button>
            {categories.map((cat) => {
              const count = products.filter((p) => p.isActive && p.categoryId === cat.id).length;
              const isSelected = selectedCategoryId === cat.id && !filterLowStockOnly;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setFilterLowStockOnly(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                    isSelected
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 pt-3 space-y-3.5">
        {/* 2. Low Stock Alert Banner (If any) */}
        {lowStockProducts.length > 0 && (
          <div
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            role="button"
            tabIndex={0}
            className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between shadow-xs ${
              filterLowStockOnly
                ? 'bg-rose-600 text-white border-rose-700'
                : 'bg-rose-50 border-rose-200 text-rose-900 active:bg-rose-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  filterLowStockOnly ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="font-heading font-bold text-sm leading-tight flex items-center gap-1.5">
                  <span>เตือนของใกล้หมด</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-black ${
                      filterLowStockOnly ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {lowStockProducts.length} รายการ
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${filterLowStockOnly ? 'text-rose-100' : 'text-rose-700'}`}>
                  {filterLowStockOnly ? 'กำลังแสดงเฉพาะของที่ต้องสั่งเพิ่ม (แตะเพื่อดูทั้งหมด)' : 'แตะเพื่อกรองดูเฉพาะสินค้าที่ต้องสั่งเพิ่ม'}
                </p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 shrink-0 ${filterLowStockOnly ? 'text-white' : 'text-rose-400'}`} />
          </div>
        )}

        {/* 3. Two Big Main Buttons: "รับของเข้า" (Stock In) + "นับสต็อก" (Recount) */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            id="home-btn-stock-in"
            onClick={() => onOpenStockIn()}
            className="flex flex-col items-start justify-between p-3.5 bg-gradient-to-br from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white rounded-2xl shadow-md active:scale-[0.98] transition min-h-[96px]"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <ArrowDownToLine className="w-5 h-5 text-white" />
            </div>
            <div className="text-left mt-2">
              <span className="font-heading font-extrabold text-base leading-tight block">
                รับของเข้า
              </span>
              <span className="text-[11px] text-teal-100 leading-tight">
                ของใหม่มาส่ง / คำนวณทุน
              </span>
            </div>
          </button>

          <button
            type="button"
            id="home-btn-stock-count"
            onClick={() => onOpenStockCount()}
            className="flex flex-col items-start justify-between p-3.5 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-2xl shadow-md active:scale-[0.98] transition min-h-[96px]"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div className="text-left mt-2">
              <span className="font-heading font-extrabold text-base leading-tight block">
                นับสต็อกจริง
              </span>
              <span className="text-[11px] text-blue-100 leading-tight">
                เดินนับด้วยตา / อัปเดตยอด
              </span>
            </div>
          </button>
        </div>

        {/* 4. Product List Section Header */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>เรียงตามใช้บ่อยล่าสุด ({filteredProducts.length} ชิ้น)</span>
          </div>

          <button
            type="button"
            onClick={onAddNewProduct}
            className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-xl border border-teal-200 active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มสินค้าใหม่</span>
          </button>
        </div>

        {/* 5. Product Cards List */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-base text-slate-800">
              {searchQuery ? 'ไม่พบสินค้าที่ตรงกับการค้นหา' : 'ยังไม่มีรายการสินค้าในระบบ'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {searchQuery
                ? 'ลองพิมพ์ด้วยคำอื่น หรือกดปุ่มด้านล่างเพื่อเพิ่มสินค้านี้เข้าร้านได้ทันที'
                : 'เริ่มต้นด้วยการกดปุ่ม "เพิ่มสินค้าใหม่" หรือ "รับของเข้า"'}
            </p>
            <button
              type="button"
              onClick={onAddNewProduct}
              className="mt-4 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-xs inline-flex items-center gap-2 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{searchQuery ? `เพิ่ม "${searchQuery}" เป็นสินค้าใหม่` : 'เพิ่มสินค้าแรกของคุณ'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredProducts.map((product) => {
              const isLow =
                product.reorderPoint !== null && product.qtyOnHand <= product.reorderPoint;
              const categoryName = product.categoryId
                ? categoryMap.get(product.categoryId)
                : null;

              return (
                <div
                  key={product.id}
                  id={`product-card-${product.id}`}
                  onClick={() => onSelectProduct(product)}
                  className={`bg-white rounded-2xl p-3.5 border transition active:bg-slate-50 cursor-pointer shadow-xs ${
                    isLow ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Product Name & Category & Status */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {categoryName && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                            {categoryName}
                          </span>
                        )}
                        {isLow && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-black flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />
                            ใกล้หมด (เตือนที่ ≤ {product.reorderPoint} {product.unitName})
                          </span>
                        )}
                      </div>

                      <h4 className="font-heading font-bold text-base text-slate-900 mt-1 leading-snug break-words">
                        {product.name}
                      </h4>

                      {/* Stock info with mandatory "last counted when" */}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
                        <span
                          className={`font-extrabold ${
                            isLow ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          เหลือ {formatThaiNumber(product.qtyOnHand)} {product.unitName}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 text-[11px]">
                          นับล่าสุด {formatThaiRelativeTime(product.qtyLastCountedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Right: Big Real Selling Price */}
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">ราคาขายจริง</div>
                      <div className="font-heading font-black text-xl text-teal-700 leading-none mt-0.5">
                        {formatThaiCurrency(product.sellPrice)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        ทุนเฉลี่ย {formatThaiCurrency(product.avgCostPerUnit)}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Footer on Card */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      แตะเพื่อดูประวัติ / แก้ไข
                    </span>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onOpenStockCount(product.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold active:scale-95 transition flex items-center gap-1"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>นับสต็อก</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenStockIn(product.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold active:scale-95 transition flex items-center gap-1"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        <span>รับของ</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
