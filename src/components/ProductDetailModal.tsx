import React, { useState, useEffect } from 'react';
import {
  X,
  Edit2,
  Check,
  AlertTriangle,
  ArrowDownToLine,
  ClipboardCheck,
  History,
  TrendingDown,
  TrendingUp,
  Building2,
  Trash2,
  Save,
  Package,
} from 'lucide-react';
import type { Product, Category, StockLot, StockMovement, StoreSettings } from '../types';
import { db } from '../db';
import {
  formatThaiCurrency,
  formatThaiNumber,
  formatThaiRelativeTime,
  formatThaiFullDate,
  calculateSuggestedPrice,
} from '../lib/utils';

interface ProductDetailModalProps {
  product: Product | null;
  categories: Category[];
  storeSettings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
  onOpenStockIn: (productId: string) => void;
  onOpenStockCount: (productId: string) => void;
  onProductUpdated: () => void;
  onProductDeleted?: (productName: string) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  categories,
  storeSettings,
  isOpen,
  onClose,
  onOpenStockIn,
  onOpenStockCount,
  onProductUpdated,
  onProductDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'lots' | 'movements'>('info');

  // Editable fields
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [sellPrice, setSellPrice] = useState<string>('');
  const [reorderPoint, setReorderPoint] = useState<string>('');
  const [targetMarginPct, setTargetMarginPct] = useState<string>('');

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // History data
  const [lots, setLots] = useState<StockLot[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Initialize
  useEffect(() => {
    if (product) {
      setName(product.name);
      setUnitName(product.unitName);
      setCategoryId(product.categoryId || '');
      setSellPrice(product.sellPrice.toString());
      setReorderPoint(product.reorderPoint !== null ? product.reorderPoint.toString() : '');
      setTargetMarginPct(
        product.targetMarginPct !== null && product.targetMarginPct !== undefined
          ? product.targetMarginPct.toString()
          : ''
      );
      setIsEditing(false);
      setShowDeleteConfirm(false);
      loadHistory(product.id);
    } else {
      setShowDeleteConfirm(false);
    }
  }, [product, isOpen]);

  const loadHistory = async (productId: string) => {
    setIsLoadingHistory(true);
    try {
      const [lotsData, movementsData] = await Promise.all([
        db.stockLots.where('productId').equals(productId).reverse().sortBy('receivedAt'),
        db.stockMovements.where('productId').equals(productId).reverse().sortBy('createdAt'),
      ]);
      setLots(lotsData);
      setMovements(movementsData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOpen || !product) return null;

  const categoryName = categories.find((c) => c.id === product.categoryId)?.name;
  const isLowStock = product.reorderPoint !== null && product.qtyOnHand <= product.reorderPoint;

  // Margin resolution
  const resolvedMargin =
    targetMarginPct !== ''
      ? parseFloat(targetMarginPct)
      : categories.find((c) => c.id === categoryId)?.marginPct ??
        storeSettings.defaultMarginPct ??
        20;
  const suggestedPrice = calculateSuggestedPrice(product.avgCostPerUnit, resolvedMargin);

  const handleSaveProduct = async () => {
    if (!name.trim()) return;
    const parsedSellPrice = parseFloat(sellPrice);
    const parsedReorder = reorderPoint.trim() ? parseFloat(reorderPoint) : null;
    const parsedMargin = targetMarginPct.trim() ? parseFloat(targetMarginPct) : null;

    const updated: Product = {
      ...product,
      name: name.trim(),
      unitName: unitName.trim() || 'ชิ้น',
      categoryId: categoryId || null,
      sellPrice: isNaN(parsedSellPrice) ? product.sellPrice : parsedSellPrice,
      reorderPoint: isNaN(Number(parsedReorder)) ? null : parsedReorder,
      targetMarginPct: isNaN(Number(parsedMargin)) ? null : parsedMargin,
      updatedAt: new Date().toISOString(),
    };

    await db.products.put(updated);
    setIsEditing(false);
    onProductUpdated();
  };

  const handleConfirmDeleteProduct = async () => {
    if (!product) return;
    try {
      setIsDeleting(true);
      // Soft Delete: ซ่อนสินค้าจากหน้าร้านและหน้าขาย แต่เก็บประวัติการขาย (StockMovements) และ Lots ไว้ 100%
      await db.products.update(product.id, {
        isActive: false,
        updatedAt: new Date().toISOString(),
      });
      setShowDeleteConfirm(false);
      if (onProductDeleted) {
        onProductDeleted(product.name);
      } else {
        onProductUpdated();
        onClose();
      }
    } catch (err) {
      console.error('Error deactivating product:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-2">
            <span className="text-[11px] text-teal-300 font-semibold block uppercase">
              {categoryName || 'รายละเอียดสินค้า'}
            </span>
            <h2 className="font-heading font-bold text-base leading-tight truncate">
              {product.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg active:scale-95 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tab Navigation */}
        <div className="grid grid-cols-3 bg-slate-100 p-1 border-b border-slate-200 text-xs font-bold text-slate-600 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`py-2 rounded-xl transition ${
              activeTab === 'info' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            ข้อมูลสินค้า
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lots')}
            className={`py-2 rounded-xl transition ${
              activeTab === 'lots' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            ประวัติต้นทุน ({lots.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            className={`py-2 rounded-xl transition ${
              activeTab === 'movements' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            ประวัติการเคลื่อนไหว ({movements.length})
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Current Stock Snapshot Card */}
              <div
                className={`p-4 rounded-2xl border ${
                  isLowStock ? 'bg-rose-50 border-rose-200' : 'bg-teal-50/70 border-teal-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-600 block">
                      คงเหลือประมาณการ
                    </span>
                    <div className="font-heading font-black text-3xl text-slate-900 mt-0.5">
                      {formatThaiNumber(product.qtyOnHand)}{' '}
                      <span className="text-base font-normal text-slate-600">
                        {product.unitName}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-500 block">ราคาขายจริง</span>
                    <div className="font-heading font-black text-2xl text-teal-700">
                      {formatThaiCurrency(product.sellPrice)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    นับล่าสุด: <span className="font-medium text-slate-800">{formatThaiRelativeTime(product.qtyLastCountedAt)}</span>
                  </span>
                  {isLowStock && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 font-bold text-[10px]">
                      ต่ำกว่าจุดเตือน ({product.reorderPoint} {product.unitName})
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenStockIn(product.id);
                  }}
                  className="h-12 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-heading font-bold text-sm shadow-xs active:scale-95 transition"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>รับของสินค้านี้</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenStockCount(product.id);
                  }}
                  className="h-12 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-heading font-bold text-sm shadow-xs active:scale-95 transition"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>นับสต็อกสินค้านี้</span>
                </button>
              </div>

              {/* Editable Fields Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-heading font-bold text-sm text-slate-800">
                    ข้อมูลและการตั้งราคา
                  </span>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>แก้ไข</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveProduct}
                      className="px-3 py-1 bg-teal-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>บันทึก</span>
                    </button>
                  )}
                </div>

                {isEditing ? (
                  /* Edit Mode */
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">ชื่อสินค้า</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-10 px-3 bg-white rounded-xl border border-slate-300 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">หน่วยนับ</label>
                        <input
                          type="text"
                          value={unitName}
                          onChange={(e) => setUnitName(e.target.value)}
                          className="w-full h-10 px-3 bg-white rounded-xl border border-slate-300 font-medium"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">หมวดหมู่</label>
                        <select
                          value={categoryId}
                          onChange={(e) => setCategoryId(e.target.value)}
                          className="w-full h-10 px-2.5 bg-white rounded-xl border border-slate-300 font-medium"
                        >
                          <option value="">(ไม่ระบุหมวด)</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-800">
                            ★ ราคาขายจริง (บาท)
                          </label>
                          {storeSettings.pricingMode !== 'MANUAL_ONLY' && (
                            <button
                              type="button"
                              onClick={() => setSellPrice(suggestedPrice.toString())}
                              className="text-[10px] text-teal-700 hover:underline font-bold"
                            >
                              ใช้ราคาแนะนำ
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          value={sellPrice}
                          onChange={(e) => setSellPrice(e.target.value)}
                          className="w-full h-10 px-3 bg-white rounded-xl border border-teal-400 font-bold text-teal-800"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          เตือนเมื่อเหลือน้อยกว่า
                        </label>
                        <input
                          type="number"
                          value={reorderPoint}
                          onChange={(e) => setReorderPoint(e.target.value)}
                          placeholder="เว้นว่างได้"
                          className="w-full h-10 px-3 bg-white rounded-xl border border-slate-300 font-medium"
                        />
                      </div>
                    </div>

                    {storeSettings.pricingMode !== 'MANUAL_ONLY' && (
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          เป้าหมายกำไรเฉพาะสินค้านี้ (% Margin)
                        </label>
                        <input
                          type="number"
                          value={targetMarginPct}
                          onChange={(e) => setTargetMarginPct(e.target.value)}
                          placeholder={`ใช้ค่าเริ่มต้นร้าน (${storeSettings.defaultMarginPct}%)`}
                          className="w-full h-10 px-3 bg-white rounded-xl border border-slate-300 font-medium"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Read-Only Info Mode */
                  <div className="space-y-2 text-xs text-slate-700">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">ต้นทุนเฉลี่ยถ่วงน้ำหนักปัจจุบัน:</span>
                      <span className="font-bold text-slate-900">
                        {formatThaiCurrency(product.avgCostPerUnit)} / {product.unitName}
                      </span>
                    </div>

                    {storeSettings.pricingMode !== 'MANUAL_ONLY' && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">ราคาขายแนะนำตามสูตร:</span>
                        <span className="font-bold text-teal-700">
                          {formatThaiCurrency(suggestedPrice)} (กำไร ~{resolvedMargin}%)
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">จุดสั่งซื้อขั้นต่ำ (เตือนของหมด):</span>
                      <span className="font-bold text-slate-900">
                        {product.reorderPoint !== null
                          ? `${product.reorderPoint} ${product.unitName}`
                          : 'ไม่ตั้งเตือน'}
                      </span>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">สร้างเมื่อ:</span>
                      <span>{formatThaiFullDate(product.createdAt)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Danger Zone: Soft Delete / Hide Product */}
              <div className="pt-2 text-center">
                {showDeleteConfirm ? (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2.5 text-center animate-in fade-in">
                    <div className="flex items-center justify-center gap-1.5 text-rose-800 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>ต้องการลบ/พักการขาย "{product.name}" หรือไม่?</span>
                    </div>
                    <p className="text-[11px] text-rose-600 leading-tight">
                      ระบบจะซ่อนสินค้านี้ออกจากหน้าร้านและหน้าคิดเงิน แต่ยังคงเก็บประวัติการขายและตัวเลขในรายงานย้อนหลังไว้ครบถ้วน
                    </p>
                    <div className="flex gap-2 justify-center pt-1">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 active:scale-95 transition"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={handleConfirmDeleteProduct}
                        className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isDeleting ? 'กำลังพักขาย...' : 'ยืนยันพักการขาย'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs text-rose-600 hover:text-rose-800 flex items-center justify-center gap-1.5 mx-auto py-2 px-3 rounded-xl hover:bg-rose-50 active:scale-95 transition font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบ / พักการขายสินค้านี้</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sub-tab: Lots History */}
          {activeTab === 'lots' && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 font-semibold mb-2">
                ประวัติราคาที่เคยซื้อเข้ามาแต่ละครั้ง
              </div>

              {lots.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                  ยังไม่มีประวัติการรับของสำหรับสินค้านี้
                </div>
              ) : (
                lots.map((lot) => (
                  <div
                    key={lot.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1 shadow-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-teal-700">
                        รับ {formatThaiNumber(lot.qtyReceived)} {product.unitName}
                      </span>
                      <span className="text-slate-900 text-sm">
                        ต้นทุน {formatThaiCurrency(lot.costPerUnit)}/หน่วย
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>{formatThaiFullDate(lot.receivedAt)}</span>
                      {lot.supplierName && (
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                          <Building2 className="w-3 h-3" />
                          {lot.supplierName}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub-tab: Movement History */}
          {activeTab === 'movements' && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 font-semibold mb-2">
                บันทึกการเปลี่ยนแปลงสต็อก (รับของเข้า / นับสต็อกจริง)
              </div>

              {movements.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                  ยังไม่มีประวัติการเคลื่อนไหวสต็อก
                </div>
              ) : (
                movements.map((mov) => {
                  const isIN = mov.type === 'IN';
                  return (
                    <div
                      key={mov.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              isIN ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isIN ? 'รับของเข้า' : 'นับสต็อกจริง'}
                          </span>
                          {mov.reason && (
                            <span className="px-1.5 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                              {mov.reason === 'SOLD' && '💰 ขาย'}
                              {mov.reason === 'WASTE' && '🗑️ เสีย/หมดอายุ'}
                              {mov.reason === 'GIVEN' && '🎁 กินเอง/แจก'}
                              {mov.reason === 'UNSURE' && '❓ หาย/ไม่แน่ใจ'}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 text-[11px]">
                          {formatThaiRelativeTime(mov.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">
                          {formatThaiNumber(mov.qtyBefore)} → {formatThaiNumber(mov.qtyAfter)}{' '}
                          {product.unitName}
                        </span>
                        <span
                          className={`font-black ${
                            mov.diff > 0
                              ? 'text-teal-700'
                              : mov.diff < 0
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {mov.diff > 0 ? `+${mov.diff}` : mov.diff} {product.unitName}
                        </span>
                      </div>

                      {mov.note && (
                        <div className="text-[11px] text-slate-500 italic bg-slate-50 px-2 py-0.5 rounded">
                          {mov.note}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
