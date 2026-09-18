export type PricingMode = 'SUGGEST_EDITABLE' | 'MANUAL_ONLY';

export type RecountReason = 'SOLD' | 'WASTE' | 'GIVEN' | 'UNSURE';

export interface Category {
  id: string;
  name: string;
  marginPct: number | null;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string | null;
  unitName: string;
  barcode?: string | null;
  quickSale?: boolean;
  targetMarginPct: number | null;
  avgCostPerUnit: number;
  sellPrice: number;
  reorderPoint: number | null;
  qtyOnHand: number;
  qtyLastCountedAt: string;
  lastActivityAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockLot {
  id: string;
  productId: string;
  costPerUnit: number;
  qtyReceived: number;
  supplierName: string | null;
  receivedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'IN' | 'RECOUNT' | 'SALE';
  qtyBefore: number;
  qtyAfter: number;
  diff: number; // positive = increased, negative = decreased
  reason?: RecountReason;
  sellPriceSnapshot: number | null;
  costSnapshot: number | null;
  productNameSnapshot?: string;
  note: string | null;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  name: string;
  unitName: string;
  barcode?: string | null;
  qty: number;
  originalPrice: number;
  sellPrice: number; // current selling price (can be adjusted/discounted for this bill)
  discountReason?: string;
  qtyOnHand: number;
  avgCostPerUnit: number;
}

export interface ChangeBreakdownItem {
  label: string;
  count: number;
  value: number;
}

export interface StoreSettings {
  id: string; // 'singleton'
  storeName: string;
  defaultMarginPct: number;
  pricingMode?: PricingMode;
  onboardingCompleted?: boolean;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  stockLots: StockLot[];
  stockMovements: StockMovement[];
}

export type ActiveTab = 'pos' | 'home' | 'stock-in' | 'stock-count' | 'report' | 'settings';
