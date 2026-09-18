import Dexie, { type Table } from 'dexie';
import type { Category, Product, StockLot, StockMovement, StoreSettings, BackupData } from '../types';
import { generateId } from '../lib/utils';

export class GroceryDatabase extends Dexie {
  categories!: Table<Category, string>;
  products!: Table<Product, string>;
  stockLots!: Table<StockLot, string>;
  stockMovements!: Table<StockMovement, string>;
  storeSettings!: Table<StoreSettings, string>;

  constructor() {
    super('GroceryShopStockDB');
    this.version(1).stores({
      categories: 'id, name, createdAt',
      products: 'id, name, categoryId, isActive, lastActivityAt, qtyOnHand, reorderPoint, createdAt',
      stockLots: 'id, productId, receivedAt, supplierName',
      stockMovements: 'id, productId, type, createdAt, diff',
      storeSettings: 'id',
    });
  }
}

export const db = new GroceryDatabase();

export async function initDatabaseDefaults(): Promise<void> {
  // Check store settings
  const existingSettings = await db.storeSettings.get('singleton');
  if (!existingSettings) {
    await db.storeSettings.put({
      id: 'singleton',
      storeName: 'ร้านขายของชำ',
      defaultMarginPct: 20, // 20% margin default
      pricingMode: 'SUGGEST_EDITABLE',
      onboardingCompleted: false,
    });
  } else {
    // Migrate if missing pricingMode, onboardingCompleted, or using legacy name
    let needsUpdate = false;
    const updated = { ...existingSettings };
    if (!updated.pricingMode) {
      updated.pricingMode = 'SUGGEST_EDITABLE';
      needsUpdate = true;
    }
    if (updated.onboardingCompleted === undefined) {
      // If products already exist, assume existing user has onboarded
      const prodCount = await db.products.count();
      updated.onboardingCompleted = prodCount > 0;
      needsUpdate = true;
    }
    if (updated.storeName === 'ร้านของชำเจ๊พร' || !updated.storeName) {
      updated.storeName = 'ร้านขายของชำ';
      needsUpdate = true;
    }
    if (needsUpdate) {
      await db.storeSettings.put(updated);
    }
  }

  // Check categories
  const categoriesCount = await db.categories.count();
  if (categoriesCount === 0) {
    const now = new Date().toISOString();
    const defaultCategories: Category[] = [
      { id: generateId(), name: 'เครื่องดื่ม', marginPct: 20, createdAt: now },
      { id: generateId(), name: 'ขนมขบเคี้ยว', marginPct: 25, createdAt: now },
      { id: generateId(), name: 'บะหมี่ / อาหารแห้ง', marginPct: 18, createdAt: now },
      { id: generateId(), name: 'เครื่องปรุง / เครื่องเทศ', marginPct: 22, createdAt: now },
      { id: generateId(), name: 'ของใช้ในบ้าน / ซักล้าง', marginPct: 20, createdAt: now },
    ];
    await db.categories.bulkPut(defaultCategories);
  }
}

/**
 * Seed sample products for easy testing by the shop owner
 */
export async function seedSampleData(): Promise<void> {
  const now = new Date();
  const cats = await db.categories.toArray();
  const drinksCat = cats.find((c) => c.name === 'เครื่องดื่ม') || cats[0];
  const snacksCat = cats.find((c) => c.name === 'ขนมขบเคี้ยว') || cats[1] || cats[0];
  const dryCat = cats.find((c) => c.name === 'บะหมี่ / อาหารแห้ง') || cats[2] || cats[0];
  const homeCat = cats.find((c) => c.name === 'ของใช้ในบ้าน / ซักล้าง') || cats[3] || cats[0];

  const daysAgo = (days: number, hoursOffset: number = 0) => {
    const d = new Date(now.getTime() - (days * 24 * 60 + hoursOffset * 60) * 60 * 1000);
    return d.toISOString();
  };

  const sampleProducts: Product[] = [
    {
      id: generateId(),
      name: 'น้ำดื่มคริสตัล 600 มล.',
      categoryId: drinksCat?.id ?? null,
      unitName: 'ขวด',
      targetMarginPct: 25,
      avgCostPerUnit: 5.2,
      sellPrice: 7,
      reorderPoint: 12,
      qtyOnHand: 8, // Low stock!
      qtyLastCountedAt: daysAgo(1, 2),
      lastActivityAt: daysAgo(0, 1),
      isActive: true,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(0, 1),
    },
    {
      id: generateId(),
      name: 'โค้ก ออริจินัล 325 มล. (กระป๋อง)',
      categoryId: drinksCat?.id ?? null,
      unitName: 'กระป๋อง',
      targetMarginPct: 20,
      avgCostPerUnit: 12.0,
      sellPrice: 15,
      reorderPoint: 10,
      qtyOnHand: 22,
      qtyLastCountedAt: daysAgo(2),
      lastActivityAt: daysAgo(1),
      isActive: true,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(1),
    },
    {
      id: generateId(),
      name: 'มาม่า ต้มยำกุ้ง 55 กรัม',
      categoryId: dryCat?.id ?? null,
      unitName: 'ซอง',
      targetMarginPct: 15,
      avgCostPerUnit: 5.5,
      sellPrice: 7,
      reorderPoint: 15,
      qtyOnHand: 14, // Low stock!
      qtyLastCountedAt: daysAgo(3),
      lastActivityAt: daysAgo(2),
      isActive: true,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(2),
    },
    {
      id: generateId(),
      name: 'เลย์ รสมันฝรั่งแท้ 42 กรัม',
      categoryId: snacksCat?.id ?? null,
      unitName: 'ซอง',
      targetMarginPct: 25,
      avgCostPerUnit: 16.0,
      sellPrice: 20,
      reorderPoint: 6,
      qtyOnHand: 15,
      qtyLastCountedAt: daysAgo(1),
      lastActivityAt: daysAgo(0, 3),
      isActive: true,
      createdAt: daysAgo(25),
      updatedAt: daysAgo(0, 3),
    },
    {
      id: generateId(),
      name: 'ผงซักฟอก บรีสเอกเซล 500 กรัม',
      categoryId: homeCat?.id ?? null,
      unitName: 'ถุง',
      targetMarginPct: 20,
      avgCostPerUnit: 42.0,
      sellPrice: 52,
      reorderPoint: 4,
      qtyOnHand: 3, // Low stock!
      qtyLastCountedAt: daysAgo(4),
      lastActivityAt: daysAgo(3),
      isActive: true,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(3),
    },
    {
      id: generateId(),
      name: 'ปลากระป๋องสามแม่ครัว 155 กรัม',
      categoryId: dryCat?.id ?? null,
      unitName: 'กระป๋อง',
      targetMarginPct: 20,
      avgCostPerUnit: 15.5,
      sellPrice: 19,
      reorderPoint: 10,
      qtyOnHand: 25,
      qtyLastCountedAt: daysAgo(5),
      lastActivityAt: daysAgo(4),
      isActive: true,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(4),
    },
  ];

  await db.products.bulkPut(sampleProducts);

  // Generate some stock lots and recount movements for sample reporting
  const lots: StockLot[] = [];
  const movements: StockMovement[] = [];

  for (const prod of sampleProducts) {
    // Initial Stock In lot
    lots.push({
      id: generateId(),
      productId: prod.id,
      costPerUnit: prod.avgCostPerUnit,
      qtyReceived: 30,
      supplierName: 'แม็คโคร / ยี่ปั๊วตลาดสด',
      receivedAt: daysAgo(14),
    });

    movements.push({
      id: generateId(),
      productId: prod.id,
      type: 'IN',
      qtyBefore: 0,
      qtyAfter: 30,
      diff: 30,
      sellPriceSnapshot: null,
      costSnapshot: null,
      note: 'รับของเข้าร้าน',
      createdAt: daysAgo(14),
    });

    // Sample recount 5 days ago (sold some)
    const midQty = 25;
    movements.push({
      id: generateId(),
      productId: prod.id,
      type: 'RECOUNT',
      qtyBefore: 30,
      qtyAfter: midQty,
      diff: -5,
      reason: 'SOLD',
      sellPriceSnapshot: prod.sellPrice,
      costSnapshot: prod.avgCostPerUnit,
      note: 'นับสต็อกประจำสัปดาห์',
      createdAt: daysAgo(5),
    });

    // Recent recount (current qty)
    const diffRecent = prod.qtyOnHand - midQty;
    if (diffRecent !== 0) {
      movements.push({
        id: generateId(),
        productId: prod.id,
        type: 'RECOUNT',
        qtyBefore: midQty,
        qtyAfter: prod.qtyOnHand,
        diff: diffRecent,
        reason: diffRecent < 0 ? 'SOLD' : undefined,
        sellPriceSnapshot: diffRecent < 0 ? prod.sellPrice : null,
        costSnapshot: diffRecent < 0 ? prod.avgCostPerUnit : null,
        note: 'เดินนับรอบล่าสุด',
        createdAt: prod.qtyLastCountedAt,
      });
    }
  }

  await db.stockLots.bulkPut(lots);
  await db.stockMovements.bulkPut(movements);
}

/**
 * Export full IndexedDB data as downloadable JSON
 */
export async function exportDatabaseBackup(): Promise<string> {
  const [settings, categories, products, stockLots, stockMovements] = await Promise.all([
    db.storeSettings.get('singleton'),
    db.categories.toArray(),
    db.products.toArray(),
    db.stockLots.toArray(),
    db.stockMovements.toArray(),
  ]);

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settings || { id: 'singleton', storeName: 'ร้านของชำ', defaultMarginPct: 20 },
    categories,
    products,
    stockLots,
    stockMovements,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Import and replace/merge database data
 */
export async function importDatabaseBackup(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString) as BackupData;
  if (!data || !Array.isArray(data.products) || !Array.isArray(data.categories)) {
    throw new Error('รูปแบบไฟล์สำรองข้อมูลไม่ถูกต้อง กรุณาเลือกไฟล์ JSON ที่สำรองจากแอปนี้');
  }

  await db.transaction('rw', [db.categories, db.products, db.stockLots, db.stockMovements, db.storeSettings], async () => {
    await db.categories.clear();
    await db.products.clear();
    await db.stockLots.clear();
    await db.stockMovements.clear();
    await db.storeSettings.clear();

    if (data.settings) await db.storeSettings.put(data.settings);
    if (data.categories.length) await db.categories.bulkPut(data.categories);
    if (data.products.length) await db.products.bulkPut(data.products);
    if (data.stockLots?.length) await db.stockLots.bulkPut(data.stockLots);
    if (data.stockMovements?.length) await db.stockMovements.bulkPut(data.stockMovements);
  });
}

/**
 * Wipe all data and reinitialize defaults
 */
export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', [db.categories, db.products, db.stockLots, db.stockMovements, db.storeSettings], async () => {
    await db.categories.clear();
    await db.products.clear();
    await db.stockLots.clear();
    await db.stockMovements.clear();
    await db.storeSettings.clear();
  });
  await initDatabaseDefaults();
}
