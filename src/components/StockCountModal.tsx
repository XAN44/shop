import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ClipboardCheck,
  Search,
  Check,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Minus,
  Plus,
  ArrowRight,
  Info,
  ShoppingBag,
  Trash2,
  Gift,
  HelpCircle,
} from 'lucide-react';
import type { Product, StockMovement, RecountReason } from '../types';
import { db } from '../db';
import {
  formatThaiNumber,
  formatThaiRelativeTime,
  generateId,
  matchesSearch,
} from '../lib/utils';
import { NumberKeypad } from './NumberKeypad';

interface StockCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  preselectedProductId?: string;
  onSuccess: (productName: string, diff: number) => void;
}

export const StockCountModal: React.FC<StockCountModalProps> = ({
  isOpen,
  onClose,
  products,
  preselectedProductId,
  onSuccess,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState('');
  const [countedQtyInput, setCountedQtyInput] = useState<string>('0');
  const [recountReason, setRecountReason] = useState<RecountReason>('SOLD');
  const [noteInput, setNoteInput] = useState<string>('');

  const [showConfirmPreview, setShowConfirmPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected product
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setShowConfirmPreview(false);
      setIsSubmitting(false);
      setNoteInput('');
      setProductSearch('');
      setRecountReason('SOLD');

      if (preselectedProductId) {
        setSelectedProductId(preselectedProductId);
        const p = products.find((prod) => prod.id === preselectedProductId);
        if (p) {
          setCountedQtyInput(p.qtyOnHand.toString());
        }
      } else {
        setSelectedProductId('');
        setCountedQtyInput('0');
      }
    }
  }, [isOpen, preselectedProductId, products]);

  const handleSelectProduct = (prod: Product) => {
    setSelectedProductId(prod.id);
    setCountedQtyInput(prod.qtyOnHand.toString());
    setRecountReason('SOLD');
  };

  const countedQty = parseFloat(countedQtyInput);
  const currentQty = selectedProduct ? selectedProduct.qtyOnHand : 0;
  const diff = isNaN(countedQty) ? 0 : countedQty - currentQty;

  // Filtered products list for search
  const filteredProductOptions = useMemo(() => {
    if (!productSearch.trim()) return products.filter((p) => p.isActive).slice(0, 10);
    return products
      .filter((p) => p.isActive && matchesSearch(p.name, productSearch))
      .slice(0, 15);
  }, [products, productSearch]);

  if (!isOpen) return null;

  const handleValidateAndPreview = () => {
    setErrorMsg('');
    if (!selectedProduct) {
      setErrorMsg('กรุณาเลือกสินค้าที่ต้องการนับสต็อก');
      return;
    }
    if (isNaN(countedQty) || countedQty < 0) {
      setErrorMsg('กรุณากรอกจำนวนที่นับได้ (ตั้งแต่ 0 ขึ้นไป)');
      return;
    }
    setShowConfirmPreview(true);
  };

  const handleConfirmRecount = async () => {
    if (!selectedProduct) return;
    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();

      // 1. Update product qtyOnHand, qtyLastCountedAt, lastActivityAt
      // Crucial: avgCostPerUnit is NOT touched!
      const updatedProduct: Product = {
        ...selectedProduct,
        qtyOnHand: countedQty,
        qtyLastCountedAt: now,
        lastActivityAt: now,
        updatedAt: now,
      };
      await db.products.put(updatedProduct);

      // 2. Record stockMovements
      // Crucial: if diff < 0 and reason === 'SOLD', snapshot sellPrice and avgCost for estimated sales/profit
      const movement: StockMovement = {
        id: generateId(),
        productId: selectedProduct.id,
        type: 'RECOUNT',
        qtyBefore: currentQty,
        qtyAfter: countedQty,
        diff: diff,
        reason: diff < 0 ? recountReason : undefined,
        sellPriceSnapshot: diff < 0 && recountReason === 'SOLD' ? selectedProduct.sellPrice : null,
        costSnapshot: diff < 0 ? selectedProduct.avgCostPerUnit : null,
        note:
          noteInput.trim() ||
          (diff < 0
            ? recountReason === 'SOLD'
              ? 'ขายสินค้า'
              : recountReason === 'WASTE'
              ? 'ของเสีย / แตกหัก / หมดอายุ'
              : recountReason === 'GIVEN'
              ? 'กินเอง / แจก'
              : 'นับสต็อก (ของหาย / ไม่แน่ใจ)'
            : 'นับสต็อก'),
        createdAt: now,
      };
      await db.stockMovements.put(movement);

      onSuccess(selectedProduct.name, diff);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 bg-blue-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-800 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base leading-tight">
                {showConfirmPreview ? 'ยืนยันผลการนับสต็อก' : 'นับสต็อกจริง (RECOUNT)'}
              </h2>
              <p className="text-[11px] text-blue-200">
                {showConfirmPreview ? 'ตรวจสอบส่วนต่างก่อนบันทึก' : 'กรอกแค่จำนวนที่นับได้ตัวเดียว'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-blue-100 hover:text-white rounded-lg active:scale-95 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!showConfirmPreview ? (
            <>
              {/* Product Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1.5">
                  1. เลือกสินค้าที่เดินไปนับ
                </label>

                {selectedProduct ? (
                  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="font-heading font-bold text-sm text-slate-900">
                        {selectedProduct.name}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        ในระบบเดิม: <span className="font-bold text-slate-900">{formatThaiNumber(selectedProduct.qtyOnHand)} {selectedProduct.unitName}</span>
                        {' · '}นับล่าสุด {formatThaiRelativeTime(selectedProduct.qtyLastCountedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProductId('')}
                      className="px-2.5 py-1 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg active:scale-95"
                    >
                      เปลี่ยน
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="ค้นหาชื่อสินค้าที่ต้องการนับ..."
                        className="w-full h-11 pl-9 pr-3 bg-slate-50 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-1 bg-white">
                      {filteredProductOptions.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleSelectProduct(prod)}
                          className="w-full p-2.5 rounded-lg text-left hover:bg-blue-50 flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {prod.name}
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              เดิมมี {formatThaiNumber(prod.qtyOnHand)} {prod.unitName}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {formatThaiRelativeTime(prod.qtyLastCountedAt)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Number Counted Input & Big Keypad */}
              {selectedProduct && (
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                    2. ตอนนี้นับจริงได้กี่ชิ้น?
                  </label>

                  {/* Big Number Display */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-500 font-medium block">
                        จำนวนที่นับได้ตอนนี้
                      </span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <input
                          type="number"
                          step="1"
                          inputMode="numeric"
                          value={countedQtyInput}
                          onChange={(e) => setCountedQtyInput(e.target.value)}
                          placeholder="0"
                          className="w-24 h-10 px-2 bg-white rounded-xl border border-blue-300 font-heading font-black text-2xl text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-base font-normal text-slate-600">
                          {selectedProduct.unitName}
                        </span>
                      </div>
                    </div>

                    {/* Real-time Diff Badge */}
                    <div className="text-right">
                      <span className="text-xs text-slate-500 font-medium block">ส่วนต่าง</span>
                      {diff < 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-100 text-rose-700 text-sm font-black mt-0.5">
                          <TrendingDown className="w-4 h-4" />
                          ลดลง {Math.abs(diff)}
                        </span>
                      ) : diff > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-sm font-black mt-0.5">
                          <TrendingUp className="w-4 h-4" />
                          เพิ่มขึ้น {diff}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-200 text-slate-700 text-sm font-bold mt-0.5">
                          เท่าเดิม (0)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Keypad */}
                  <NumberKeypad
                    value={countedQtyInput}
                    onChange={setCountedQtyInput}
                    allowDecimal={false}
                    showQuickAdjust={true}
                  />

                  {/* Recount Reason Selector (if diff < 0) */}
                  {diff < 0 && (
                    <div className="pt-2 space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                        3. สินค้าลดลง {Math.abs(diff)} {selectedProduct.unitName} เพราะสาเหตุใด?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRecountReason('SOLD')}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                            recountReason === 'SOLD'
                              ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              recountReason === 'SOLD' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <ShoppingBag className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs block font-bold">ขายไปแล้ว</span>
                            <span className="text-[10px] text-slate-500">คิดเป็นยอดขาย</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRecountReason('WASTE')}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                            recountReason === 'WASTE'
                              ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              recountReason === 'WASTE' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs block font-bold">ของเสีย/หมดอายุ</span>
                            <span className="text-[10px] text-slate-500">ต้นทุนสูญเปล่า</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRecountReason('GIVEN')}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                            recountReason === 'GIVEN'
                              ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              recountReason === 'GIVEN' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Gift className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs block font-bold">กินเอง/ใช้ในบ้าน</span>
                            <span className="text-[10px] text-slate-500">ของใช้ส่วนตัว</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRecountReason('UNSURE')}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                            recountReason === 'UNSURE'
                              ? 'bg-purple-50 border-purple-500 text-purple-900 ring-1 ring-purple-500 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              recountReason === 'UNSURE' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <HelpCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs block font-bold">ไม่แน่ใจ/ของหาย</span>
                            <span className="text-[10px] text-slate-500">ตรวจสอบภายหลัง</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Optional Note */}
                  <div className="pt-1">
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="หมายเหตุเพิ่มเติม (ถ้ามี เช่น ขวดแตก 1 ชิ้น)..."
                      className="w-full h-10 px-3 bg-white rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* PREVIEW CONFIRMATION SCREEN */
            <div className="space-y-4 py-2">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-3">
                <div className="text-center pb-2 border-b border-blue-200">
                  <span className="text-xs text-blue-600 font-bold uppercase">สินค้านี้</span>
                  <h3 className="font-heading font-black text-xl text-blue-900 mt-0.5">
                    {selectedProduct?.name}
                  </h3>
                </div>

                <div className="space-y-2.5 text-sm text-slate-800">
                  <div className="flex justify-between items-center py-1 border-b border-blue-100">
                    <span>สต็อกเดิมในระบบ:</span>
                    <span className="font-bold text-slate-600">
                      {formatThaiNumber(currentQty)} {selectedProduct?.unitName}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-blue-100">
                    <span>จำนวนที่นับได้ใหม่:</span>
                    <span className="font-black text-blue-700 text-base">
                      {formatThaiNumber(countedQty)} {selectedProduct?.unitName}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="font-bold">ส่วนต่าง (Diff):</span>
                    {diff < 0 ? (
                      <span className="font-black text-rose-600 text-base">
                        ลดลง {Math.abs(diff)} {selectedProduct?.unitName}
                      </span>
                    ) : diff > 0 ? (
                      <span className="font-black text-emerald-700 text-base">
                        เพิ่มขึ้น {diff} {selectedProduct?.unitName}
                      </span>
                    ) : (
                      <span className="font-bold text-slate-600">
                        ตรงกับระบบพอดี (0 {selectedProduct?.unitName})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {diff < 0 && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">สาเหตุที่สินค้าลดลง:</span>
                    <span className="font-bold px-2.5 py-1 rounded-lg text-xs bg-white border border-slate-300">
                      {recountReason === 'SOLD' && '💰 ขายไปแล้ว'}
                      {recountReason === 'WASTE' && '🗑️ ของเสีย / หมดอายุ'}
                      {recountReason === 'GIVEN' && '🎁 กินเอง / แจก / ในบ้าน'}
                      {recountReason === 'UNSURE' && '❓ ไม่แน่ใจ / หาย'}
                    </span>
                  </div>

                  {recountReason === 'SOLD' && (
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      ระบบจะบันทึกเป็น <strong className="text-slate-900">ยอดขาย {Math.abs(diff)} {selectedProduct?.unitName}</strong> โดยคิดราคาขาย {selectedProduct?.sellPrice} บาท และต้นทุน {selectedProduct?.avgCostPerUnit.toFixed(1)} บาท เพื่อคำนวณกำไรในรายงาน
                    </p>
                  )}

                  {recountReason === 'WASTE' && (
                    <p className="text-rose-700 text-[11px] leading-relaxed">
                      บันทึกเป็น <strong className="text-rose-900">ของเสีย/หมดอายุ</strong> ต้นทุนสูญเปล่าประมาณ {((selectedProduct?.avgCostPerUnit || 0) * Math.abs(diff)).toFixed(0)} บาท โดยไม่คิดเป็นยอดขาย
                    </p>
                  )}

                  {recountReason === 'GIVEN' && (
                    <p className="text-amber-700 text-[11px] leading-relaxed">
                      บันทึกเป็น <strong className="text-amber-900">ของใช้ส่วนตัว/แจก</strong> ต้นทุนประมาณ {((selectedProduct?.avgCostPerUnit || 0) * Math.abs(diff)).toFixed(0)} บาท โดยไม่คิดเป็นยอดขาย
                    </p>
                  )}

                  {recountReason === 'UNSURE' && (
                    <p className="text-purple-700 text-[11px] leading-relaxed">
                      บันทึกเป็น <strong className="text-purple-900">ยอดไม่แน่ใจ</strong> เพื่อให้คุณตรวจสอบสต็อกภายหลัง
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 shrink-0">
          {!showConfirmPreview ? (
            <button
              type="button"
              disabled={!selectedProduct}
              onClick={handleValidateAndPreview}
              className="w-full h-13 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 text-white font-heading font-extrabold text-base rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <span>ถัดไป: ตรวจสอบส่วนต่างก่อนยืนยัน</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmPreview(false)}
                disabled={isSubmitting}
                className="w-1/3 h-13 bg-white border border-slate-300 text-slate-700 font-bold text-sm rounded-2xl active:bg-slate-100"
              >
                แก้ไข
              </button>
              <button
                type="button"
                onClick={handleConfirmRecount}
                disabled={isSubmitting}
                className="flex-1 h-13 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-heading font-black text-base rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันผลการนับ'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
