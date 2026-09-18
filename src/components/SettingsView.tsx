import React, { useState, useRef } from 'react';
import {
  Settings,
  Store,
  Percent,
  FolderPlus,
  Download,
  Upload,
  Sparkles,
  Trash2,
  Check,
  AlertCircle,
  Folder,
  Plus,
  Save,
  HelpCircle,
  Smartphone,
  HardDrive,
} from 'lucide-react';
import type { StoreSettings, Category, Product } from '../types';
import {
  db,
  exportDatabaseBackup,
  importDatabaseBackup,
  seedSampleData,
  resetDatabase,
} from '../db';
import { generateId } from '../lib/utils';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsViewProps {
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  onSettingsUpdated: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  categories,
  products,
  onSettingsUpdated,
}) => {
  const [storeName, setStoreName] = useState(settings.storeName || '');
  const [defaultMarginPct, setDefaultMarginPct] = useState(
    settings.defaultMarginPct?.toString() || '20'
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Category management
  const [newCatName, setNewCatName] = useState('');
  const [newCatMargin, setNewCatMargin] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const margin = parseFloat(defaultMarginPct);
      await db.storeSettings.put({
        id: 'singleton',
        storeName: storeName.trim() || 'ร้านของชำ',
        defaultMarginPct: isNaN(margin) ? 20 : margin,
      });
      setSaveSuccessMsg('บันทึกข้อมูลร้านเรียบร้อยแล้ว');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
      onSettingsUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const margin = newCatMargin.trim() ? parseFloat(newCatMargin) : null;
    const newCat: Category = {
      id: generateId(),
      name: newCatName.trim(),
      marginPct: isNaN(Number(margin)) ? null : margin,
      createdAt: new Date().toISOString(),
    };
    await db.categories.put(newCat);
    setNewCatName('');
    setNewCatMargin('');
    setIsAddingCat(false);
    onSettingsUpdated();
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    const productsInCat = products.filter((p) => p.categoryId === catId).length;
    if (productsInCat > 0) {
      if (
        !window.confirm(
          `หมวดหมู่ "${catName}" มีสินค้าอยู่ ${productsInCat} รายการ หากลบ สินค้าจะกลายเป็นหมวดไม่ระบุ ต้องการลบหรือไม่?`
        )
      ) {
        return;
      }
    } else {
      if (!window.confirm(`ต้องการลบหมวดหมู่ "${catName}" หรือไม่?`)) return;
    }

    await db.categories.delete(catId);
    // Unassign products
    await db.products
      .where('categoryId')
      .equals(catId)
      .modify({ categoryId: null });
    onSettingsUpdated();
  };

  // Export JSON backup
  const handleExportJSON = async () => {
    try {
      const jsonStr = await exportDatabaseBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `สำรองข้อมูลสต็อก_${settings.storeName || 'ร้านของชำ'}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg({
        type: 'success',
        text: 'ดาวน์โหลดไฟล์สำรองข้อมูล JSON สำเร็จ! เก็บไฟล์นี้ไว้ในโทรศัพท์เพื่อความปลอดภัย',
      });
    } catch (e: unknown) {
      console.error(e);
      setStatusMsg({ type: 'error', text: 'เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์สำรอง' });
    }
  };

  // Import JSON backup
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !window.confirm(
        'การนำเข้าข้อมูลจะเขียนทับข้อมูลสต็อกปัจจุบันในเครื่องนี้ ต้องการดำเนินการต่อหรือไม่?'
      )
    ) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          await importDatabaseBackup(content);
          setStatusMsg({
            type: 'success',
            text: 'นำเข้าข้อมูลจากไฟล์ JSON สำเร็จเรียบร้อย!',
          });
          onSettingsUpdated();
        } catch (innerErr: unknown) {
          console.error(innerErr);
          setStatusMsg({
            type: 'error',
            text: innerErr instanceof Error ? innerErr.message : 'รูปแบบไฟล์ไม่ถูกต้อง',
          });
        }
      };
      reader.readAsText(file);
    } catch (e) {
      console.error(e);
      setStatusMsg({ type: 'error', text: 'ไม่สามารถอ่านไฟล์ได้' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLoadSample = async () => {
    if (
      window.confirm(
        'ต้องการเพิ่มข้อมูลตัวอย่างร้านของชำ (น้ำดื่ม, โค้ก, มาม่า, เลย์, ผงซักฟอก) หรือไม่?'
      )
    ) {
      await seedSampleData();
      setStatusMsg({
        type: 'success',
        text: 'เพิ่มสินค้าตัวอย่างและประวัติต้นทุนสำเร็จแล้ว! ลองกลับไปดูหน้าแรกได้เลย',
      });
      onSettingsUpdated();
    }
  };

  const handleResetData = async () => {
    if (
      window.prompt(
        'คำเตือน: ข้อมูลทั้งหมดจะถูกลบถาวร พิมพ์คำว่า "ลบทั้งหมด" เพื่อยืนยัน'
      ) === 'ลบทั้งหมด'
    ) {
      await resetDatabase();
      setStatusMsg({ type: 'success', text: 'ล้างข้อมูลทั้งหมดในเครื่องแล้ว' });
      onSettingsUpdated();
    }
  };

  return (
    <div className="pb-28 px-4 pt-3 space-y-4">
      {statusMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 1. Store Basic Settings Form */}
      <form onSubmit={handleSaveStoreSettings} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Store className="w-5 h-5 text-teal-600" />
          <h3 className="font-heading font-bold text-sm text-slate-900">
            ตั้งค่าข้อมูลร้านและกำไรเริ่มต้น
          </h3>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            ชื่อร้านค้าของคุณ
          </label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="เช่น ร้านขายของชำ"
            className="w-full h-11 px-3 bg-slate-50 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            เป้าหมายกำไรเริ่มต้นทั้งร้าน (% Default Margin)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="any"
              value={defaultMarginPct}
              onChange={(e) => setDefaultMarginPct(e.target.value)}
              className="w-28 h-11 px-3 bg-slate-50 rounded-xl border border-slate-300 text-sm font-bold text-teal-800"
            />
            <span className="text-sm font-bold text-slate-600">%</span>
            <span className="text-[11px] text-slate-400">
              (ใช้เป็นค่าเริ่มต้นคำนวณราคาขายแนะนำของสินค้าใหม่)
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSavingSettings}
          className="w-full h-11 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition"
        >
          <Save className="w-4 h-4" />
          <span>{isSavingSettings ? 'กำลังบันทึก...' : 'บันทึกข้อมูลร้าน'}</span>
        </button>

        {saveSuccessMsg && (
          <p className="text-xs text-emerald-600 font-bold text-center">{saveSuccessMsg}</p>
        )}
      </form>

      {/* 2. Category Management */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-teal-600" />
            <h3 className="font-heading font-bold text-sm text-slate-900">
              จัดการหมวดหมู่สินค้า ({categories.length})
            </h3>
          </div>
          {!isAddingCat && (
            <button
              type="button"
              onClick={() => setIsAddingCat(true)}
              className="text-xs font-bold text-teal-700 flex items-center gap-1 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มหมวดหมู่</span>
            </button>
          )}
        </div>

        {isAddingCat && (
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="ชื่อหมวดหมู่ เช่น อาหารแห้ง, เครื่องปรุง"
              className="w-full h-10 px-3 bg-white rounded-lg border border-slate-300 text-xs font-medium"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={newCatMargin}
                onChange={(e) => setNewCatMargin(e.target.value)}
                placeholder={`กำไรหมวดนี้ % (เว้นว่าง = ใช้ ${defaultMarginPct}%)`}
                className="flex-1 h-10 px-3 bg-white rounded-lg border border-slate-300 text-xs"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-3 h-10 bg-teal-600 text-white rounded-lg text-xs font-bold shrink-0"
              >
                บันทึก
              </button>
              <button
                type="button"
                onClick={() => setIsAddingCat(false)}
                className="px-3 h-10 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold shrink-0"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <div key={cat.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">{cat.name}</span>
                  <span className="text-[11px] text-slate-500">
                    {count} สินค้า · กำไรแนะนำ {cat.marginPct !== null ? `${cat.marginPct}%` : `ตามร้าน (${defaultMarginPct}%)`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                  aria-label="ลบหมวดหมู่"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Export / Import Backup Section (CRUCIAL: All data is in device IndexedDB!) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <HardDrive className="w-5 h-5 text-teal-600" />
          <div>
            <h3 className="font-heading font-bold text-sm text-slate-900 leading-tight">
              สำรองและกู้คืนข้อมูล (สำคัญมาก)
            </h3>
            <p className="text-[11px] text-slate-500">
              ข้อมูลทั้งหมดอยู่ในเครื่องนี้ แนะนำให้กดดาวน์โหลดสำรองไว้เสมอ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Export JSON Button */}
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex flex-col items-center justify-center p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-2xl active:scale-95 transition text-center"
          >
            <Download className="w-6 h-6 text-teal-700 mb-1" />
            <span className="font-heading font-bold text-xs text-slate-900">
              ดาวน์โหลดสำรอง (Export)
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              ไฟล์ JSON เก็บในมือถือ
            </span>
          </button>

          {/* Import JSON Button */}
          <label className="flex flex-col items-center justify-center p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-2xl active:scale-95 transition cursor-pointer text-center">
            <Upload className="w-6 h-6 text-blue-700 mb-1" />
            <span className="font-heading font-bold text-xs text-slate-900">
              กู้คืนข้อมูล (Import)
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              เลือกไฟล์ JSON ที่สำรองไว้
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFileChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 4. PWA Installation helper */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2 pb-1">
          <Smartphone className="w-5 h-5 text-teal-600" />
          <h3 className="font-heading font-bold text-sm text-slate-900">
            การติดตั้งแอปบนหน้าจอมือถือ (PWA)
          </h3>
        </div>
        <p className="text-xs text-slate-600">
          เมื่อติดตั้งลงหน้าจอโฮม จะเปิดใช้งานได้เร็วและเต็มหน้าจอเหมือนแอปจริง และใช้งานออฟไลน์ได้ 100% แม้ไม่มีเน็ต
        </p>
        <PWAInstallButton />
      </div>

      {/* 5. Sample Data & Reset */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5 text-center">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
          ตัวช่วยทดลองใช้งาน
        </span>

        <button
          type="button"
          onClick={handleLoadSample}
          className="w-full py-2.5 bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-xl hover:bg-slate-100 flex items-center justify-center gap-1.5 shadow-xs"
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>ใส่ข้อมูลตัวอย่างสินค้าเพื่อทดลองระบบ</span>
        </button>

        <button
          type="button"
          onClick={handleResetData}
          className="w-full py-2 text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center justify-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>ล้างข้อมูลทั้งหมดในเครื่อง</span>
        </button>
      </div>

      <div className="text-center text-[11px] text-slate-400 py-2">
        สมุดรับของ + ตั้งราคา + เตือนของหมด (v0) · ข้อมูลเก็บใน IndexedDB เครื่องคุณ 100%
      </div>
    </div>
  );
};
