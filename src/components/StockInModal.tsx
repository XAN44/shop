import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ArrowDownToLine,
  Search,
  Plus,
  AlertCircle,
  Check,
  Building2,
  Sparkles,
  Calculator,
  ArrowRight,
  TrendingUp,
  Edit3,
  Percent,
} from 'lucide-react';
import type { Product, Category, StoreSettings, StockLot, StockMovement } from '../types';
import { db } from '../db';
import {
  formatThaiCurrency,
  formatThaiNumber,
  calculateSuggestedPrice,
  generateId,
  matchesSearch,
} from '../lib/utils';
import { NumberKeypad } from './NumberKeypad';

interface StockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  storeSettings: StoreSettings;
  preselectedProductId?: string;
  onSuccess: (productName: string) => void;
}

const COMMON_UNITS = ['ขวด', 'ซอง', 'ถุง', 'ชิ้น', 'กระป๋อง', 'กล่อง', 'แพ็ค', 'แก้ว'];

export const StockInModal: React.FC<StockInModalProps> = ({
  isOpen,
  onClose,
  products,
  categories,
  storeSettings,
  preselectedProductId,
  onSuccess,
}) => {
  // Mode: select existing or create new product
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Form fields for Stock In
  const [costInput, setCostInput] = useState<string>('0');
  const [qtyInput, setQtyInput] = useState<string>('1');
  const [supplierInput, setSupplierInput] = useState<string>('');
  const [activeInput, setActiveInput] = useState<'cost' | 'qty'>('qty');

  // Form fields for New Product (if creating new)
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('ขวด');
  const [newCategoryId, setNewCategoryId] = useState<string>('');
  const [newReorderPoint, setNewReorderPoint] = useState<string>('5');
  const [newCustomMargin, setNewCustomMargin] = useState<string>('');

  // Optional new sell price override during stock in
  const [newSellPriceInput, setNewSellPriceInput] = useState<string>('');

  // Confirmation preview pricing mode: 'AUTO' (calculated from margin %) or 'MANUAL' (direct sell price in Baht)
  const [pricingChoice, setPricingChoice] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [expectedMarginInput, setExpectedMarginInput] = useState<string>('20');

  // Confirmation preview step
  const [showConfirmPreview, setShowConfirmPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setShowConfirmPreview(false);
      setIsSubmitting(false);

      const defaultChoice = storeSettings.pricingMode === 'MANUAL_ONLY' ? 'MANUAL' : 'AUTO';
      setPricingChoice(defaultChoice);

      if (preselectedProductId) {
        setSelectedProductId(preselectedProductId);
        setIsCreatingNew(false);
        const p = products.find((prod) => prod.id === preselectedProductId);
        if (p) {
          setCostInput(p.avgCostPerUnit ? p.avgCostPerUnit.toString() : '0');
          setNewSellPriceInput(p.sellPrice ? p.sellPrice.toString() : '');
          setExpectedMarginInput(
            p.targetMarginPct !== null && p.targetMarginPct !== undefined
              ? p.targetMarginPct.toString()
              : (storeSettings.defaultMarginPct || 20).toString()
          );
        }
      } else {
        setSelectedProductId('');
        setIsCreatingNew(false);
        setCostInput('0');
        setQtyInput('1');
        setSupplierInput('');
        setNewSellPriceInput('');
        setExpectedMarginInput((storeSettings.defaultMarginPct || 20).toString());
      }
      setProductSearch('');
    }
  }, [isOpen, preselectedProductId, products, storeSettings]);

  // Selected product object
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // When selected product changes, prefill cost
  const handleSelectProduct = (prod: Product) => {
    setSelectedProductId(prod.id);
    setIsCreatingNew(false);
    setCostInput(prod.avgCostPerUnit ? prod.avgCostPerUnit.toString() : '0');
    setNewSellPriceInput(prod.sellPrice.toString());
    setExpectedMarginInput(
      prod.targetMarginPct !== null && prod.targetMarginPct !== undefined
        ? prod.targetMarginPct.toString()
        : (storeSettings.defaultMarginPct || 20).toString()
    );
    setActiveInput('qty');
  };

  // Recent suppliers from past stockLots for auto-completion
  const [recentSuppliers, setRecentSuppliers] = useState<string[]>([]);
  useEffect(() => {
    if (isOpen) {
      db.stockLots
        .orderBy('receivedAt')
        .reverse()
        .limit(20)
        .toArray()
        .then((lots) => {
          const names = Array.from(
            new Set(lots.map((l) => l.supplierName).filter((name): name is string => Boolean(name)))
          ).slice(0, 5);
          setRecentSuppliers(names);
        });
    }
  }, [isOpen]);

  // Target Margin resolution
  const targetMarginPct = useMemo(() => {
    if (isCreatingNew) {
      if (newCustomMargin && !isNaN(parseFloat(newCustomMargin))) {
        return parseFloat(newCustomMargin);
      }
      const cat = categories.find((c) => c.id === newCategoryId);
      if (cat && cat.marginPct !== null) return cat.marginPct;
      return storeSettings.defaultMarginPct || 20;
    }

    if (selectedProduct) {
      if (selectedProduct.targetMarginPct !== null && selectedProduct.targetMarginPct !== undefined) {
        return selectedProduct.targetMarginPct;
      }
      const cat = categories.find((c) => c.id === selectedProduct.categoryId);
      if (cat && cat.marginPct !== null) return cat.marginPct;
      return storeSettings.defaultMarginPct || 20;
    }

    return storeSettings.defaultMarginPct || 20;
  }, [isCreatingNew, newCustomMargin, newCategoryId, selectedProduct, categories, storeSettings]);

  // Calculations for Stock In Preview
  const cost = parseFloat(costInput) || 0;
  const qty = parseFloat(qtyInput) || 0;

  const currentQty = selectedProduct ? selectedProduct.qtyOnHand : 0;
  const currentAvgCost = selectedProduct ? selectedProduct.avgCostPerUnit : 0;
  const currentSellPrice = selectedProduct ? selectedProduct.sellPrice : 0;

  const newQtyOnHand = currentQty + qty;

  const newAvgCost = useMemo(() => {
    if (qty <= 0) return currentAvgCost;
    if (currentQty <= 0) return cost;
    const totalOldCost = currentAvgCost * currentQty;
    const totalNewCost = cost * qty;
    return (totalOldCost + totalNewCost) / (currentQty + qty);
  }, [currentAvgCost, currentQty, cost, qty]);

  const suggestedPrice = useMemo(() => {
    return calculateSuggestedPrice(newAvgCost, targetMarginPct);
  }, [newAvgCost, targetMarginPct]);

  // Computed values for confirmation preview pricing
  const currentCalculatedMargin = parseFloat(expectedMarginInput) || 0;
  const currentAutoPrice = useMemo(() => {
    return calculateSuggestedPrice(newAvgCost, currentCalculatedMargin);
  }, [newAvgCost, currentCalculatedMargin]);

  const currentManualPriceNum = parseFloat(newSellPriceInput) || 0;
  const manualProfitPerUnit = currentManualPriceNum - newAvgCost;
  const manualProfitPct = currentManualPriceNum > 0 ? (manualProfitPerUnit / currentManualPriceNum) * 100 : 0;

  // Filtered products list for search
  const filteredProductOptions = useMemo(() => {
    if (!productSearch.trim()) return products.filter((p) => p.isActive).slice(0, 10);
    return products
      .filter((p) => p.isActive && matchesSearch(p.name, productSearch))
      .slice(0, 15);
  }, [products, productSearch]);

  if (!isOpen) return null;

  // Handle proceed to preview
  const handleValidateAndPreview = () => {
    setErrorMsg('');
    if (isCreatingNew) {
      if (!newName.trim()) {
        setErrorMsg('กรุณากรอกชื่อสินค้าใหม่');
        return;
      }
    } else if (!selectedProduct) {
      setErrorMsg('กรุณาเลือกสินค้าที่จะรับของเข้า');
      return;
    }

    if (cost <= 0) {
      setErrorMsg('กรุณากรอกต้นทุนต่อหน่วยให้มากกว่า 0');
      return;
    }

    if (qty <= 0) {
      setErrorMsg('กรุณากรอกจำนวนที่รับเข้าให้มากกว่า 0');
      return;
    }

    // Set up initial margin & price for preview screen
    const resolvedMargin =
      expectedMarginInput && !isNaN(parseFloat(expectedMarginInput))
        ? parseFloat(expectedMarginInput)
        : (targetMarginPct || storeSettings.defaultMarginPct || 20);
    setExpectedMarginInput(resolvedMargin.toString());

    const autoPrice = calculateSuggestedPrice(newAvgCost, resolvedMargin);
    if (pricingChoice === 'AUTO') {
      setNewSellPriceInput(autoPrice.toString());
    } else {
      if (!newSellPriceInput || parseFloat(newSellPriceInput) <= 0) {
        setNewSellPriceInput(selectedProduct?.sellPrice ? selectedProduct.sellPrice.toString() : autoPrice.toString());
      }
    }

    setShowConfirmPreview(true);
  };

  // Submit and write to DB
  const handleConfirmStockIn = async () => {
    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      let targetProduct: Product;

      let finalSellPrice: number;
      let finalTargetMargin: number | null = null;

      if (pricingChoice === 'AUTO') {
        const margin = parseFloat(expectedMarginInput) || 0;
        finalSellPrice = calculateSuggestedPrice(newAvgCost, margin);
        finalTargetMargin = margin;
      } else {
        finalSellPrice = parseFloat(newSellPriceInput) || 0;
        finalTargetMargin = selectedProduct?.targetMarginPct ?? (newCustomMargin ? parseFloat(newCustomMargin) : null);
      }

      if (finalSellPrice <= 0) {
        setErrorMsg('ราคาขายต้องมากกว่า 0 บาท กรุณาระบุราคาขายที่ถูกต้อง');
        setIsSubmitting(false);
        return;
      }

      if (isCreatingNew) {
        const reorder = newReorderPoint ? parseFloat(newReorderPoint) : null;

        targetProduct = {
          id: generateId(),
          name: newName.trim(),
          categoryId: newCategoryId || null,
          unitName: newUnit.trim() || 'ชิ้น',
          targetMarginPct: finalTargetMargin,
          avgCostPerUnit: cost,
          sellPrice: finalSellPrice,
          reorderPoint: isNaN(Number(reorder)) ? null : reorder,
          qtyOnHand: qty,
          qtyLastCountedAt: now,
          lastActivityAt: now,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };

        await db.products.put(targetProduct);
      } else {
        if (!selectedProduct) throw new Error('ไม่พบข้อมูลสินค้า');

        targetProduct = {
          ...selectedProduct,
          avgCostPerUnit: newAvgCost,
          qtyOnHand: newQtyOnHand,
          sellPrice: finalSellPrice,
          targetMarginPct: finalTargetMargin,
          qtyLastCountedAt: now,
          lastActivityAt: now,
          updatedAt: now,
        };

        await db.products.put(targetProduct);
      }

      // 1. Record stockLot
      const lot: StockLot = {
        id: generateId(),
        productId: targetProduct.id,
        costPerUnit: cost,
        qtyReceived: qty,
        supplierName: supplierInput.trim() || null,
        receivedAt: now,
      };
      await db.stockLots.put(lot);

      // 2. Record stockMovement
      const movement: StockMovement = {
        id: generateId(),
        productId: targetProduct.id,
        type: 'IN',
        qtyBefore: isCreatingNew ? 0 : currentQty,
        qtyAfter: isCreatingNew ? qty : newQtyOnHand,
        diff: qty,
        sellPriceSnapshot: null,
        costSnapshot: null,
        note: supplierInput.trim() ? `รับจาก: ${supplierInput.trim()}` : 'รับของเข้า',
        createdAt: now,
      };
      await db.stockMovements.put(movement);

      onSuccess(targetProduct.name);
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
        <div className="px-4 py-3.5 bg-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-800 flex items-center justify-center">
              <ArrowDownToLine className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base leading-tight">
                {showConfirmPreview ? 'ตรวจสอบข้อมูลก่อนยืนยัน' : 'รับของเข้าร้าน (IN)'}
              </h2>
              <p className="text-[11px] text-teal-200">
                {showConfirmPreview ? 'สรุปผลสต็อกและต้นทุนใหม่' : 'คำนวณต้นทุนเฉลี่ยอัตโนมัติ'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-teal-100 hover:text-white rounded-lg active:scale-95 transition"
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
              {/* Step 1: Select or Create Product */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    1. สินค้าที่รับเข้า
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(!isCreatingNew);
                      setSelectedProductId('');
                      setErrorMsg('');
                    }}
                    className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 active:scale-95 transition"
                  >
                    {isCreatingNew ? '← เลือกสินค้าที่มีอยู่แล้ว' : '+ เพิ่มเป็นสินค้าใหม่'}
                  </button>
                </div>

                {isCreatingNew ? (
                  /* New Product Fields (Simple, max 3 main fields) */
                  <div className="bg-teal-50/60 p-3.5 rounded-2xl border border-teal-200 space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">
                        ชื่อสินค้าใหม่ *
                      </label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="เช่น โค้ก 325 มล., ไข่ไก่เบอร์ 2"
                        className="w-full h-11 px-3 bg-white rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">
                        หน่วยนับ (เช่น ขวด, ถุง, ชิ้น) *
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {COMMON_UNITS.map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setNewUnit(u)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              newUnit === u
                                ? 'bg-teal-700 text-white shadow-xs'
                                : 'bg-white text-slate-700 border border-slate-200'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)}
                        placeholder="หรือพิมพ์หน่วยนับเอง..."
                        className="w-full h-10 px-3 bg-white rounded-xl border border-slate-300 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-800 block mb-1">
                          หมวดหมู่
                        </label>
                        <select
                          value={newCategoryId}
                          onChange={(e) => setNewCategoryId(e.target.value)}
                          className="w-full h-10 px-2.5 bg-white rounded-xl border border-slate-300 text-xs font-medium"
                        >
                          <option value="">(ไม่ระบุหมวด)</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-800 block mb-1">
                          เตือนเมื่อเหลือน้อยกว่า
                        </label>
                        <input
                          type="number"
                          value={newReorderPoint}
                          onChange={(e) => setNewReorderPoint(e.target.value)}
                          placeholder="เช่น 5"
                          className="w-full h-10 px-3 bg-white rounded-xl border border-slate-300 text-xs font-medium"
                        />
                      </div>
                    </div>

                    {storeSettings.pricingMode === 'MANUAL_ONLY' && (
                      <div>
                        <label className="text-xs font-bold text-slate-800 block mb-1">
                          ราคาขายหน้าร้าน (บาท) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={newSellPriceInput}
                          onChange={(e) => setNewSellPriceInput(e.target.value)}
                          placeholder="เช่น 15"
                          className="w-full h-10 px-3 bg-white rounded-xl border border-slate-300 text-sm font-bold text-teal-700"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Existing Product Selector with Fast Search */
                  <div>
                    {selectedProduct ? (
                      <div className="p-3 bg-teal-50 border border-teal-300 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="font-heading font-bold text-sm text-slate-900">
                            {selectedProduct.name}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            คงเหลือเดิม: <span className="font-bold text-slate-900">{formatThaiNumber(selectedProduct.qtyOnHand)} {selectedProduct.unitName}</span>
                            {' · '}ทุนเดิม: {formatThaiCurrency(selectedProduct.avgCostPerUnit)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedProductId('')}
                          className="px-2.5 py-1 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg active:scale-95"
                        >
                          เปลี่ยนสินค้า
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
                            placeholder="พิมพ์ชื่อสินค้าเพื่อค้นหา..."
                            className="w-full h-11 pl-9 pr-3 bg-slate-50 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-1 bg-white">
                          {filteredProductOptions.map((prod) => (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => handleSelectProduct(prod)}
                              className="w-full p-2.5 rounded-lg text-left hover:bg-teal-50 flex items-center justify-between text-xs transition"
                            >
                              <div>
                                <span className="font-bold text-slate-900 block">
                                  {prod.name}
                                </span>
                                <span className="text-slate-500 text-[11px]">
                                  เหลือ {formatThaiNumber(prod.qtyOnHand)} {prod.unitName}
                                </span>
                              </div>
                              <span className="font-heading font-bold text-teal-700">
                                {formatThaiCurrency(prod.sellPrice)}
                              </span>
                            </button>
                          ))}
                          {filteredProductOptions.length === 0 && (
                            <div className="p-3 text-center text-xs text-slate-400">
                              ไม่พบสินค้าที่ตรงกัน
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Input Cost & Quantity with direct typing support */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    2. กรอกต้นทุนและจำนวนที่รับ
                  </label>
                  <span className="text-[11px] text-teal-700 font-semibold">
                    พิมพ์ตัวเลขได้โดยตรง
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setActiveInput('cost')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      activeInput === 'cost'
                        ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-400/40'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <label className="text-[11px] font-bold text-slate-500 block">
                      ต้นทุนต่อหน่วย (บาท) *
                    </label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-sm font-bold text-slate-400">฿</span>
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={costInput}
                        onFocus={() => setActiveInput('cost')}
                        onChange={(e) => setCostInput(e.target.value)}
                        placeholder="0"
                        className="w-full bg-transparent font-heading font-black text-2xl text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveInput('qty')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      activeInput === 'qty'
                        ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-400/40'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <label className="text-[11px] font-bold text-slate-500 block">
                      จำนวนที่รับเข้า *
                    </label>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <input
                        type="number"
                        step="any"
                        inputMode="numeric"
                        value={qtyInput}
                        onFocus={() => setActiveInput('qty')}
                        onChange={(e) => setQtyInput(e.target.value)}
                        placeholder="0"
                        className="w-full bg-transparent font-heading font-black text-2xl text-teal-700 focus:outline-none"
                      />
                      <span className="text-xs font-normal text-slate-500 shrink-0">
                        {isCreatingNew ? newUnit : selectedProduct?.unitName || 'ชิ้น'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Big keypad directly accessible by thumb or quick adjust */}
                <NumberKeypad
                  value={activeInput === 'cost' ? costInput : qtyInput}
                  onChange={(val) => {
                    if (activeInput === 'cost') setCostInput(val);
                    else setQtyInput(val);
                  }}
                  allowDecimal={activeInput === 'cost'}
                  showQuickAdjust={activeInput === 'qty'}
                />
              </div>

              {/* Step 3: Supplier (Optional) */}
              <div className="pt-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>ร้านที่ซื้อ / ซัพพลายเออร์ (ไม่บังคับ)</span>
                </label>
                <input
                  type="text"
                  value={supplierInput}
                  onChange={(e) => setSupplierInput(e.target.value)}
                  placeholder="เช่น แม็คโคร, ยี่ปั๊วตลาดสด, เซลล์เป๊ปซี่..."
                  className="w-full h-10 px-3 bg-white rounded-xl border border-slate-300 text-xs font-medium"
                />

                {/* Quick suggestions from previous suppliers */}
                {recentSuppliers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {recentSuppliers.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSupplierInput(s)}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium hover:bg-slate-200"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Preview Card */}
              {qty > 0 && cost > 0 && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs text-slate-700">
                  <div className="flex items-center justify-between font-bold text-slate-900 pb-1 border-b border-slate-200/60">
                    <span className="flex items-center gap-1">
                      <Calculator className="w-3.5 h-3.5 text-teal-600" />
                      คำนวณเบื้องต้น
                    </span>
                    <span>รวมเงินจ่ายซื้อ: {formatThaiCurrency(cost * qty)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>สต็อกหลังรับ:</span>
                    <span className="font-bold text-teal-700">
                      {formatThaiNumber(newQtyOnHand)} {isCreatingNew ? newUnit : selectedProduct?.unitName || 'ชิ้น'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>ต้นทุนเฉลี่ยถ่วงน้ำหนักใหม่:</span>
                    <span className="font-bold text-slate-900">{formatThaiCurrency(newAvgCost)}/หน่วย</span>
                  </div>

                  {storeSettings.pricingMode !== 'MANUAL_ONLY' && (
                    <div className="flex justify-between text-teal-800 font-bold bg-teal-100/60 p-1.5 rounded-lg">
                      <span>ราคาขายแนะนำ (กำไร ~{targetMarginPct}%):</span>
                      <span>~{formatThaiCurrency(suggestedPrice)}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* PREVIEW CONFIRMATION SCREEN (Rule: Always preview before confirming to prevent mistakes) */
            <div className="space-y-4 py-2">
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl space-y-3">
                <div className="text-center pb-2 border-b border-teal-200">
                  <span className="text-xs text-teal-600 font-bold uppercase">สินค้าที่จะบันทึก</span>
                  <h3 className="font-heading font-black text-xl text-teal-900 mt-0.5">
                    {isCreatingNew ? newName : selectedProduct?.name}
                  </h3>
                  <span className="text-xs text-teal-700">
                    รับเข้า: {formatThaiNumber(qty)} {isCreatingNew ? newUnit : selectedProduct?.unitName || 'ชิ้น'}
                    {supplierInput ? ` (จาก: ${supplierInput})` : ''}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between items-center py-1 border-b border-teal-100">
                    <span>จำนวนสต็อก:</span>
                    <span className="font-bold text-slate-900">
                      {formatThaiNumber(isCreatingNew ? 0 : currentQty)} →{' '}
                      <span className="text-teal-700 font-black">
                        {formatThaiNumber(newQtyOnHand)} {isCreatingNew ? newUnit : selectedProduct?.unitName || 'ชิ้น'}
                      </span>
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-teal-100">
                    <span>ต้นทุนเฉลี่ยถ่วงน้ำหนัก:</span>
                    <span className="font-bold text-slate-900">
                      {isCreatingNew ? '-' : formatThaiCurrency(currentAvgCost)} →{' '}
                      <span className="text-teal-700 font-black">{formatThaiCurrency(newAvgCost)}</span>
                    </span>
                  </div>

                  {storeSettings.pricingMode !== 'MANUAL_ONLY' && (
                    <div className="flex justify-between items-center py-1">
                      <span>ราคาขายแนะนำจากสูตร:</span>
                      <span className="font-black text-teal-800">
                        {formatThaiCurrency(suggestedPrice)} (กำไร ~{targetMarginPct}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Mode Selection (Auto based on profit margin vs Manual) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide block mb-2">
                    เลือกวิธีการตั้งราคาขายสำหรับล็อตนี้
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setPricingChoice('AUTO');
                        const m = parseFloat(expectedMarginInput) || 20;
                        const p = calculateSuggestedPrice(newAvgCost, m);
                        setNewSellPriceInput(p.toString());
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        pricingChoice === 'AUTO'
                          ? 'bg-white text-teal-800 shadow-sm border border-slate-200/60'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>ตั้งราคาอัตโนมัติ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPricingChoice('MANUAL');
                        if (!newSellPriceInput || parseFloat(newSellPriceInput) <= 0) {
                          const fallback = selectedProduct?.sellPrice || currentAutoPrice;
                          setNewSellPriceInput(fallback.toString());
                        }
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        pricingChoice === 'MANUAL'
                          ? 'bg-white text-teal-800 shadow-sm border border-slate-200/60'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span>ตั้งราคาแบบแมนนวล</span>
                    </button>
                  </div>
                </div>

                {pricingChoice === 'AUTO' ? (
                  /* MODE 1: Automatic pricing based on expected profit margin */
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Percent className="w-3.5 h-3.5 text-teal-600" />
                          <span>กำไรที่คาดหวัง (%)</span>
                        </label>
                        <span className="text-[11px] text-slate-500">
                          พิมพ์ระบุได้เอง
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          value={expectedMarginInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setExpectedMarginInput(val);
                            const m = parseFloat(val) || 0;
                            const p = calculateSuggestedPrice(newAvgCost, m);
                            setNewSellPriceInput(p.toString());
                          }}
                          placeholder="เช่น 20"
                          className="w-full h-12 px-3.5 bg-slate-50 rounded-xl border border-teal-300 font-heading font-black text-2xl text-teal-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-heading font-black text-lg text-teal-600 pointer-events-none">
                          %
                        </span>
                      </div>

                      {/* Quick percentage chips */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[11px] text-slate-400 font-bold mr-0.5">ลัด:</span>
                        {[10, 15, 20, 25, 30, 40].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setExpectedMarginInput(pct.toString());
                              const p = calculateSuggestedPrice(newAvgCost, pct);
                              setNewSellPriceInput(p.toString());
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition active:scale-95 ${
                              parseFloat(expectedMarginInput) === pct
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-800'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Calculated Price Result Card */}
                    <div className="p-3.5 bg-teal-50/70 rounded-xl border border-teal-200 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>ต้นทุนเฉลี่ยใหม่:</span>
                        <span className="font-bold text-slate-800">{formatThaiCurrency(newAvgCost)} / หน่วย</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>กำไรที่คาดหวัง:</span>
                        <span className="font-bold text-teal-700">+{currentCalculatedMargin}%</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-teal-200">
                        <span className="font-bold text-teal-900 text-sm">ราคาขายแนะนำอัตโนมัติ:</span>
                        <span className="font-heading font-black text-2xl text-teal-700">
                          {formatThaiCurrency(currentAutoPrice)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-teal-700 pt-0.5">
                        <span>กำไรสุทธิโดยประมาณ:</span>
                        <span className="font-semibold">
                          +{formatThaiCurrency(Math.max(0, currentAutoPrice - newAvgCost))} ต่อหน่วย
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* MODE 2: Manual pricing - direct entry of sell price in Baht */
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Edit3 className="w-3.5 h-3.5 text-teal-600" />
                          <span>พิมพ์ราคาขายจริงหน้าร้าน (บาท)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setNewSellPriceInput(currentAutoPrice.toString())}
                          className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          ดึงราคาแนะนำ ({formatThaiCurrency(currentAutoPrice)})
                        </button>
                      </div>

                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400 pointer-events-none">
                          ฿
                        </span>
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          value={newSellPriceInput}
                          onChange={(e) => setNewSellPriceInput(e.target.value)}
                          placeholder="เช่น 20"
                          className="w-full h-12 pl-8 pr-3.5 bg-slate-50 rounded-xl border border-slate-300 font-heading font-black text-2xl text-teal-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        * พิมพ์กำหนดราคาขายที่คุณติดป้ายหน้าร้านได้โดยตรง สามารถลบและแก้ไขตัวเลขได้อิสระ
                      </p>
                    </div>

                    {/* Manual Profit Margin Analysis */}
                    {currentManualPriceNum > 0 && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>ต้นทุนเฉลี่ยใหม่:</span>
                          <span className="font-bold text-slate-800">{formatThaiCurrency(newAvgCost)} / หน่วย</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>ราคาขายที่คุณตั้ง:</span>
                          <span className="font-bold text-slate-900">{formatThaiCurrency(currentManualPriceNum)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                          <span className="font-bold text-slate-900 text-sm">กำไรต่อหน่วย:</span>
                          {manualProfitPerUnit >= 0 ? (
                            <span className="font-bold text-emerald-700 text-base">
                              +{formatThaiCurrency(manualProfitPerUnit)}{' '}
                              <span className="text-xs font-semibold text-emerald-600">
                                (~{manualProfitPct.toFixed(1)}%)
                              </span>
                            </span>
                          ) : (
                            <span className="font-bold text-rose-600 text-base">
                              ขาดทุน {formatThaiCurrency(Math.abs(manualProfitPerUnit))}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 shrink-0">
          {!showConfirmPreview ? (
            <button
              type="button"
              onClick={handleValidateAndPreview}
              className="w-full h-13 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-heading font-extrabold text-base rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <span>ถัดไป: ตรวจสอบข้อมูลก่อนยืนยัน</span>
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
                onClick={handleConfirmStockIn}
                disabled={isSubmitting}
                className="flex-1 h-13 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-heading font-black text-base rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันรับของเข้า'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
