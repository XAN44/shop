/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initDatabaseDefaults } from './db';
import type { ActiveTab, Product, Category, StoreSettings } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { CashierView } from './components/CashierView';
import { HomeView } from './components/HomeView';
import { StockInModal } from './components/StockInModal';
import { StockCountModal } from './components/StockCountModal';
import { StockCountView } from './components/StockCountView';
import { ProductDetailModal } from './components/ProductDetailModal';
import { ReportView } from './components/ReportView';
import { SettingsView } from './components/SettingsView';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { WifiOff, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const isOnline = useOnlineStatus();

  // Modal states
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [stockInProductId, setStockInProductId] = useState<string | undefined>(undefined);

  const [isStockCountOpen, setIsStockCountOpen] = useState(false);
  const [stockCountProductId, setStockCountProductId] = useState<string | undefined>(undefined);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Initialize DB defaults on mount
  useEffect(() => {
    initDatabaseDefaults().catch(console.error);
  }, []);

  // Live queries from Dexie IndexedDB
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const settings =
    useLiveQuery(() => db.storeSettings.get('singleton'), []) || {
      id: 'singleton',
      storeName: 'ร้านขายของชำ',
      defaultMarginPct: 20,
    };

  // Low stock counter for bottom nav badge
  const lowStockCount = products.filter(
    (p) => p.isActive && p.reorderPoint !== null && p.qtyOnHand <= p.reorderPoint
  ).length;

  // Handlers
  const handleOpenStockIn = (productId?: string) => {
    setStockInProductId(productId);
    setIsStockInOpen(true);
  };

  const handleOpenStockCount = (productId?: string) => {
    setStockCountProductId(productId);
    setActiveTab('stock-count');
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between selection:bg-teal-100 selection:text-teal-900">
      {/* Mobile container wrapper (constrained to mobile width on desktop, full width on mobile) */}
      <div className="w-full max-w-md mx-auto min-h-screen bg-slate-100 flex flex-col relative shadow-xl border-x border-slate-200/50">
        {/* Header */}
        <Header
          storeName={settings.storeName}
          onOpenSettings={() => setActiveTab('settings')}
        />

        {/* Offline notice bar (if offline) */}
        {!isOnline && (
          <div className="bg-amber-600 text-white text-xs px-4 py-1.5 flex items-center justify-center gap-1.5 font-bold shadow-xs">
            <WifiOff className="w-3.5 h-3.5" />
            <span>กำลังใช้งานแบบออฟไลน์ — ข้อมูลจะบันทึกลงในเครื่องตามปกติ</span>
          </div>
        )}

        {/* Toast notification */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-slate-700 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1">{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Main Content Router */}
        <main className="flex-1">
          {activeTab === 'pos' && (
            <CashierView
              products={products}
              storeName={settings.storeName}
              onStockUpdated={() => {}}
              onOpenProductDetail={handleSelectProduct}
            />
          )}

          {activeTab === 'home' && (
            <HomeView
              products={products}
              categories={categories}
              onOpenStockIn={handleOpenStockIn}
              onOpenStockCount={handleOpenStockCount}
              onSelectProduct={handleSelectProduct}
              onAddNewProduct={() => handleOpenStockIn()}
            />
          )}

          {activeTab === 'stock-in' && (
            <div className="p-4 pt-6 space-y-4 text-center">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
                  <span className="text-3xl font-black">📥</span>
                </div>
                <div>
                  <h2 className="font-heading font-black text-xl text-slate-900">
                    บันทึกรับของเข้าร้าน
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    เมื่อมีของมาส่ง หรือไปซื้อของมาจากแม็คโคร/ตลาดสด คำนวณต้นทุนเฉลี่ยให้อัตโนมัติ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStockInOpen(true)}
                  className="w-full h-14 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-heading font-extrabold text-base rounded-2xl shadow-md active:scale-[0.98] transition"
                >
                  เปิดหน้ารับของเข้า
                </button>
              </div>
            </div>
          )}

          {activeTab === 'stock-count' && (
            <StockCountView
              products={products}
              categories={categories}
              focusProductId={stockCountProductId}
              onStockUpdated={() => {}}
            />
          )}

          {activeTab === 'report' && <ReportView products={products} />}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              categories={categories}
              products={products}
              onSettingsUpdated={() => {}}
            />
          )}
        </main>

        {/* Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          onChangeTab={(tab) => {
            if (tab === 'stock-in') {
              handleOpenStockIn();
            } else if (tab === 'stock-count') {
              handleOpenStockCount();
            } else {
              setActiveTab(tab);
            }
          }}
          lowStockCount={lowStockCount}
        />

        {/* Modal: Stock In */}
        <StockInModal
          isOpen={isStockInOpen}
          onClose={() => {
            setIsStockInOpen(false);
            setStockInProductId(undefined);
          }}
          products={products}
          categories={categories}
          storeSettings={settings}
          preselectedProductId={stockInProductId}
          onSuccess={(productName) => {
            showToast(`บันทึกรับของ "${productName}" เข้าร้านเรียบร้อยแล้ว`);
          }}
        />

        {/* Modal: Stock Count */}
        <StockCountModal
          isOpen={isStockCountOpen}
          onClose={() => {
            setIsStockCountOpen(false);
            setStockCountProductId(undefined);
          }}
          products={products}
          preselectedProductId={stockCountProductId}
          onSuccess={(productName, diff) => {
            if (diff < 0) {
              showToast(
                `อัปเดตสต็อก "${productName}" แล้ว (สินค้าลดลง ${Math.abs(diff)} ชิ้น)`
              );
            } else if (diff > 0) {
              showToast(`อัปเดตสต็อก "${productName}" แล้ว (สินค้าเพิ่มขึ้น ${diff} ชิ้น)`);
            } else {
              showToast(`ยืนยันสต็อก "${productName}" ตรงตามจำนวนเดิม`);
            }
          }}
        />

        {/* Modal: Product Detail */}
        <ProductDetailModal
          product={selectedProduct}
          categories={categories}
          storeSettings={settings}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedProduct(null);
          }}
          onOpenStockIn={(pId) => handleOpenStockIn(pId)}
          onOpenStockCount={(pId) => handleOpenStockCount(pId)}
          onProductUpdated={async () => {
            if (selectedProduct) {
              const updated = await db.products.get(selectedProduct.id);
              if (updated) setSelectedProduct(updated);
            }
            showToast('บันทึกข้อมูลสินค้าเรียบร้อย');
          }}
          onProductDeleted={(deletedName) => {
            setIsDetailOpen(false);
            setSelectedProduct(null);
            showToast(`พักการขาย "${deletedName}" เรียบร้อยแล้ว (ประวัติการขายในรายงานยังคงอยู่ครบถ้วน)`);
          }}
        />
      </div>
    </div>
  );
}
