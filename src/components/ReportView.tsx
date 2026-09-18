import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Package,
  Sparkles,
  Info,
  DollarSign,
  Boxes,
  ShoppingBag,
  Trash2,
  Gift,
  HelpCircle,
} from 'lucide-react';
import type { StockMovement, Product } from '../types';
import { db } from '../db';
import { formatThaiCurrency, formatThaiNumber, formatThaiFullDate } from '../lib/utils';

interface ReportViewProps {
  products: Product[];
}

type DateRangeType = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'ALL_TIME';

export const ReportView: React.FC<ReportViewProps> = ({ products }) => {
  const [rangeType, setRangeType] = useState<DateRangeType>('THIS_MONTH');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [activeReportTab, setActiveReportTab] = useState<'sales' | 'loss'>('sales');
  const [isLoading, setIsLoading] = useState(true);

  // Load all recount movements
  useEffect(() => {
    setIsLoading(true);
    db.stockMovements
      .where('type')
      .equals('RECOUNT')
      .toArray()
      .then((items) => {
        setMovements(items);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Filter movements by selected date range
  const filteredMovements = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date = now;

    if (rangeType === 'THIS_MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (rangeType === 'LAST_MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (rangeType === 'LAST_7_DAYS') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (rangeType === 'LAST_30_DAYS') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = null; // ALL_TIME
    }

    return movements.filter((m) => {
      // Must be recount with negative diff (decreased stock)
      if (m.diff >= 0) return false;
      const mDate = new Date(m.createdAt);
      if (startDate && mDate < startDate) return false;
      if (endDate && mDate > endDate) return false;
      return true;
    });
  }, [movements, rangeType]);

  // Separate SOLD from Non-Sold (WASTE, GIVEN, UNSURE)
  const salesMovements = useMemo(() => {
    return filteredMovements.filter((m) => m.type === 'SALE' || m.reason === 'SOLD' || !m.reason);
  }, [filteredMovements]);

  const lossMovements = useMemo(() => {
    return filteredMovements.filter((m) => m.type !== 'SALE' && m.reason && m.reason !== 'SOLD');
  }, [filteredMovements]);

  // Aggregate stats for SOLD items
  const productStats = useMemo(() => {
    const productMap = new Map<string, Product>();
    products.forEach((p) => productMap.set(p.id, p));

    const statsMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        unitName: string;
        estimatedQtySold: number;
        estimatedRevenue: number;
        estimatedProfit: number;
      }
    >();

    salesMovements.forEach((m) => {
      const prod = productMap.get(m.productId);
      const name = prod ? prod.name : (m.productNameSnapshot || 'สินค้าที่พักขาย');
      const unit = prod ? prod.unitName : 'ชิ้น';

      const qty = Math.abs(m.diff);
      const sellPrice = m.sellPriceSnapshot ?? (prod ? prod.sellPrice : 0);
      const cost = m.costSnapshot ?? (prod ? prod.avgCostPerUnit : 0);

      const revenue = qty * sellPrice;
      const profit = qty * (sellPrice - cost);

      const existing = statsMap.get(m.productId) || {
        productId: m.productId,
        productName: name,
        unitName: unit,
        estimatedQtySold: 0,
        estimatedRevenue: 0,
        estimatedProfit: 0,
      };

      existing.estimatedQtySold += qty;
      existing.estimatedRevenue += revenue;
      existing.estimatedProfit += profit;

      statsMap.set(m.productId, existing);
    });

    return Array.from(statsMap.values()).sort(
      (a, b) => b.estimatedQtySold - a.estimatedQtySold
    );
  }, [salesMovements, products]);

  // Aggregate stats for Loss / Waste items
  const lossStats = useMemo(() => {
    const productMap = new Map<string, Product>();
    products.forEach((p) => productMap.set(p.id, p));

    let wasteQty = 0;
    let wasteCost = 0;

    let givenQty = 0;
    let givenCost = 0;

    let unsureQty = 0;
    let unsureCost = 0;

    const items: Array<{
      id: string;
      productName: string;
      unitName: string;
      qty: number;
      cost: number;
      reason: 'WASTE' | 'GIVEN' | 'UNSURE';
      date: string;
      note?: string | null;
    }> = [];

    lossMovements.forEach((m) => {
      const prod = productMap.get(m.productId);
      const name = prod ? prod.name : (m.productNameSnapshot || 'สินค้าที่พักขาย');
      const unit = prod ? prod.unitName : 'ชิ้น';

      const qty = Math.abs(m.diff);
      const costPerUnit = m.costSnapshot ?? (prod ? prod.avgCostPerUnit : 0);
      const totalCost = qty * costPerUnit;

      if (m.reason === 'WASTE') {
        wasteQty += qty;
        wasteCost += totalCost;
      } else if (m.reason === 'GIVEN') {
        givenQty += qty;
        givenCost += totalCost;
      } else if (m.reason === 'UNSURE') {
        unsureQty += qty;
        unsureCost += totalCost;
      }

      if (m.reason === 'WASTE' || m.reason === 'GIVEN' || m.reason === 'UNSURE') {
        items.push({
          id: m.id,
          productName: name,
          unitName: unit,
          qty,
          cost: totalCost,
          reason: m.reason,
          date: m.createdAt,
          note: m.note,
        });
      }
    });

    return {
      wasteQty,
      wasteCost,
      givenQty,
      givenCost,
      unsureQty,
      unsureCost,
      totalLossCost: wasteCost + givenCost + unsureCost,
      items: items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    };
  }, [lossMovements, products]);

  // Summary Totals for Sales
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalRevenue = 0;
    let totalProfit = 0;

    productStats.forEach((s) => {
      totalQty += s.estimatedQtySold;
      totalRevenue += s.estimatedRevenue;
      totalProfit += s.estimatedProfit;
    });

    const profitMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      totalQty,
      totalRevenue,
      totalProfit,
      profitMarginPct,
    };
  }, [productStats]);

  const rangeLabels: Record<DateRangeType, string> = {
    THIS_MONTH: 'เดือนนี้',
    LAST_MONTH: 'เดือนที่แล้ว',
    LAST_7_DAYS: '7 วันล่าสุด',
    LAST_30_DAYS: '30 วันล่าสุด',
    ALL_TIME: 'ทั้งหมดตั้งแต่เริ่มใช้',
  };

  return (
    <div className="pb-28 px-4 pt-3 space-y-3.5">
      {/* 1. Mandatory Clear Disclaimer Banner (User Rule 2: Cannot be omitted!) */}
      <div className="p-3.5 rounded-2xl bg-amber-500 text-slate-950 font-medium text-xs shadow-sm flex items-start gap-2.5 border border-amber-600">
        <AlertTriangle className="w-5 h-5 text-slate-950 shrink-0 mt-0.5" />
        <div className="leading-snug">
          <span className="font-heading font-black text-sm block mb-0.5">
            ⚠️ ยอดประมาณการจากการนับสต็อกเท่านั้น ไม่ใช่ยอดขายจริง
          </span>
          <span>
            ตัวเลขนี้คำนวณจากจำนวนสินค้าที่ลดลงเมื่อเดินนับสต็อกจริง โดยแยกยอดขายออกจากของเสียและของใช้ในบ้าน เพื่อความแม่นยำ
          </span>
        </div>
      </div>

      {/* 2. Date Range Filter */}
      <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1.5 pl-2 text-xs font-bold text-slate-700">
          <Calendar className="w-4 h-4 text-teal-600" />
          <span>ช่วงเวลา:</span>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {(['THIS_MONTH', 'LAST_MONTH', 'LAST_7_DAYS', 'LAST_30_DAYS'] as DateRangeType[]).map(
            (r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRangeType(r)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  rangeType === r
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {rangeLabels[r]}
              </button>
            )
          )}
        </div>
      </div>

      {/* 3. Tab Selector between Estimated Sales and Loss/Waste */}
      <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveReportTab('sales')}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
            activeReportTab === 'sales'
              ? 'bg-white text-teal-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>ยอดขาย & กำไร (~{formatThaiCurrency(totals.totalRevenue)})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('loss')}
          className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
            activeReportTab === 'loss'
              ? 'bg-white text-rose-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>
            ของเสีย & ตัดจำหน่าย{' '}
            {lossStats.totalLossCost > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded-full text-[10px]">
                {formatThaiCurrency(lossStats.totalLossCost)}
              </span>
            )}
          </span>
        </button>
      </div>

      {activeReportTab === 'sales' ? (
        <>
          {/* Summary Cards (All explicitly labeled as Estimates) */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Estimated Revenue */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold">ยอดขาย (ประมาณการ)</span>
                <DollarSign className="w-4 h-4 text-teal-600" />
              </div>
              <div className="font-heading font-black text-xl text-slate-900">
                {formatThaiCurrency(totals.totalRevenue)}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                คำนวณจากราคาขาย × ชิ้นที่ขายไป
              </span>
            </div>

            {/* Estimated Profit */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold">กำไร (ประมาณการ)</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="font-heading font-black text-xl text-emerald-700">
                {formatThaiCurrency(totals.totalProfit)}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
                ~{totals.profitMarginPct.toFixed(1)}% ของยอดขาย
              </span>
            </div>

            {/* Estimated Units */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs col-span-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500 block">
                    จำนวนที่ขายได้รวม (ประมาณการ)
                  </span>
                  <div className="font-heading font-black text-lg text-slate-900">
                    {formatThaiNumber(totals.totalQty)} ชิ้น{' '}
                    <span className="text-xs font-normal text-slate-500">
                      (จาก {productStats.length} รายการสินค้า)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Selling Items (Best Sellers - Estimates Only) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>อันดับของขายดี (ประมาณการ)</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">
                เรียงตามจำนวนชิ้นที่ขาย
              </span>
            </div>

            {productStats.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-bold">
                  ยังไม่มีข้อมูลการนับสต็อกที่ระบุว่าขายในช่วง {rangeLabels[rangeType]}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  เมื่อเดินนับสต็อกจริงและจำนวนสินค้าลดลงจากการขาย ระบบจะรวบรวมเป็นรายงานขายดีที่นี่
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
                {productStats.map((item, index) => {
                  const rank = index + 1;

                  return (
                    <div key={item.productId} className="p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-heading font-black text-xs shrink-0 ${
                            rank === 1
                              ? 'bg-amber-400 text-amber-950 shadow-xs'
                              : rank === 2
                              ? 'bg-slate-300 text-slate-800'
                              : rank === 3
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {rank}
                        </span>

                        <div className="min-w-0">
                          <h4 className="font-heading font-bold text-sm text-slate-900 truncate">
                            {item.productName}
                          </h4>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            ขายได้{' '}
                            <span className="font-bold text-slate-800">
                              {formatThaiNumber(item.estimatedQtySold)} {item.unitName}
                            </span>
                            {' · '}กำไร ~{formatThaiCurrency(item.estimatedProfit)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 block font-semibold">ยอดขายประมาณการ</span>
                        <span className="font-heading font-black text-base text-teal-700">
                          {formatThaiCurrency(item.estimatedRevenue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Loss / Waste / Shrinkage Report Tab */
        <div className="space-y-3">
          {/* Summary Breakdown Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center">
              <Trash2 className="w-4 h-4 text-rose-600 mx-auto mb-1" />
              <span className="text-[10px] font-bold text-rose-700 block">ของเสีย/หมดอายุ</span>
              <span className="font-heading font-black text-sm text-rose-900 block mt-0.5">
                {formatThaiCurrency(lossStats.wasteCost)}
              </span>
              <span className="text-[10px] text-rose-600 font-medium">
                {lossStats.wasteQty} ชิ้น
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
              <Gift className="w-4 h-4 text-amber-600 mx-auto mb-1" />
              <span className="text-[10px] font-bold text-amber-700 block">กินเอง/แจก/ในบ้าน</span>
              <span className="font-heading font-black text-sm text-amber-900 block mt-0.5">
                {formatThaiCurrency(lossStats.givenCost)}
              </span>
              <span className="text-[10px] text-amber-600 font-medium">
                {lossStats.givenQty} ชิ้น
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-center">
              <HelpCircle className="w-4 h-4 text-purple-600 mx-auto mb-1" />
              <span className="text-[10px] font-bold text-purple-700 block">ไม่แน่ใจ/ของหาย</span>
              <span className="font-heading font-black text-sm text-purple-900 block mt-0.5">
                {formatThaiCurrency(lossStats.unsureCost)}
              </span>
              <span className="text-[10px] text-purple-600 font-medium">
                {lossStats.unsureQty} ชิ้น
              </span>
            </div>
          </div>

          {/* Loss Items List */}
          <div className="space-y-2">
            <h3 className="font-heading font-bold text-sm text-slate-900">
              รายการตัดจำหน่าย & ของเสีย ({lossStats.items.length})
            </h3>

            {lossStats.items.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-xs text-slate-500">
                ไม่มีรายการของเสียหรือตัดจำหน่ายในช่วง {rangeLabels[rangeType]}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
                {lossStats.items.map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-heading font-bold text-sm text-slate-900">
                          {item.productName}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.reason === 'WASTE'
                              ? 'bg-rose-100 text-rose-800'
                              : item.reason === 'GIVEN'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {item.reason === 'WASTE' && 'ของเสีย'}
                          {item.reason === 'GIVEN' && 'กินเอง/แจก'}
                          {item.reason === 'UNSURE' && 'ไม่แน่ใจ'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        จำนวน: <strong className="text-slate-800">{item.qty} {item.unitName}</strong>
                        {item.note && ` · ${item.note}`}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">ต้นทุนที่ตัดออก</span>
                      <span className="font-heading font-black text-rose-700">
                        {formatThaiCurrency(item.cost)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Additional notice footer */}
      <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-500 text-center leading-relaxed">
        * รายงานนี้สร้างขึ้นจากประวัติการนับสต็อก (RECOUNT) โดยตรง ไม่ได้เกิดจากการสแกนบาร์โค้ดขายหน้าร้าน
      </div>
    </div>
  );
};
