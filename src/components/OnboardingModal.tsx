import React, { useState } from 'react';
import {
  Store,
  Sparkles,
  Check,
  ArrowRight,
  Calculator,
  Edit3,
  Percent,
  Package,
  Layers,
  ChevronRight,
} from 'lucide-react';
import type { PricingMode, StoreSettings } from '../types';
import { db, seedSampleData } from '../db';

interface OnboardingModalProps {
  isOpen: boolean;
  initialSettings?: StoreSettings;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  initialSettings,
  onComplete,
}) => {
  const [step, setStep] = useState<number>(1);
  const [storeName, setStoreName] = useState(
    initialSettings?.storeName && initialSettings.storeName !== 'ร้านของชำเจ๊พร'
      ? initialSettings.storeName
      : 'ร้านขายของชำ'
  );
  const [pricingMode, setPricingMode] = useState<PricingMode>(
    initialSettings?.pricingMode || 'SUGGEST_EDITABLE'
  );
  const [defaultMarginPct, setDefaultMarginPct] = useState<string>(
    initialSettings?.defaultMarginPct?.toString() || '20'
  );
  const [loadSampleData, setLoadSampleData] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleFinish = async () => {
    try {
      setIsSubmitting(true);
      const margin = parseFloat(defaultMarginPct);

      const finalSettings: StoreSettings = {
        id: 'singleton',
        storeName: storeName.trim() || 'ร้านของชำ',
        defaultMarginPct: isNaN(margin) ? 20 : margin,
        pricingMode: pricingMode,
        onboardingCompleted: true,
      };

      await db.storeSettings.put(finalSettings);

      if (loadSampleData) {
        const prodCount = await db.products.count();
        if (prodCount === 0) {
          await seedSampleData();
        }
      }

      onComplete();
    } catch (err) {
      console.error('Error completing onboarding:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Progress Bar & Header */}
        <div className="bg-teal-700 text-white p-5 pb-6 shrink-0 relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-wider uppercase text-teal-200 bg-teal-800/80 px-2.5 py-1 rounded-full">
              เริ่มต้นใช้งาน · ขั้นตอนที่ {step} จาก 3
            </span>
            <span className="text-xs text-teal-200 font-medium">สมุดรับของ + คิดราคา</span>
          </div>

          <h2 className="font-heading font-black text-xl text-white">
            {step === 1 && 'ตั้งชื่อร้านค้าของคุณ'}
            {step === 2 && 'เลือกรูปแบบการตั้งราคาขาย'}
            {step === 3 && 'กำไรเป้าหมาย & สินค้าเริ่มต้น'}
          </h2>
          <p className="text-xs text-teal-100 mt-1">
            {step === 1 && 'ออกแบบมาสำหรับเจ้าของร้านของชำขนาดเล็ก บันทึกง่ายบนมือถือ'}
            {step === 2 && 'คุณสามารถสลับรูปแบบนี้ได้ตลอดเวลาในหน้าตั้งค่า'}
            {step === 3 && 'พร้อมให้คุณเริ่มบันทึกรับของและนับสต็อกได้ทันที'}
          </p>

          {/* Dots Indicator */}
          <div className="flex gap-1.5 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? 'w-8 bg-white' : s < step ? 'w-4 bg-teal-300' : 'w-4 bg-teal-900/60'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* STEP 1: Store Name */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 mx-auto mt-2">
                <Store className="w-8 h-8" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  ชื่อร้านค้าของคุณ
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="เช่น ร้านของชำป้าพร, มินิมาร์ทลุงสมหมาย"
                  className="w-full h-13 px-4 bg-slate-50 border border-slate-300 rounded-2xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  จะแสดงที่แถบด้านบนของแอป และใช้เป็นชื่อไฟล์เมื่อดาวน์โหลดข้อมูลสำรอง
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>จุดเด่นของแอปนี้:</span>
                </div>
                <ul className="space-y-1.5 list-disc list-inside text-slate-600 pl-1">
                  <li>ไม่มีระบบ POS ซับซ้อน — คิดเงินด้วยเครื่องคิดเลขตามปกติ</li>
                  <li>คำนวณต้นทุนเฉลี่ยให้อัตโนมัติเมื่อรับของเข้าหลายรอบ</li>
                  <li>เดินนับของจริง กรอกแค่ตัวเลขเดียว ระบบคำนวณส่วนต่างให้</li>
                  <li>ใช้งานออฟไลน์ได้ 100% ข้อมูลปลอดภัยอยู่ในโทรศัพท์เครื่องนี้</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: Pricing Mode */}
          {step === 2 && (
            <div className="space-y-3.5 animate-in fade-in">
              <label className="text-xs font-bold text-slate-700 block">
                คุณต้องการให้ระบบช่วยตั้งราคาขายอย่างไร?
              </label>

              {/* Mode 1: SUGGEST_EDITABLE */}
              <button
                type="button"
                onClick={() => setPricingMode('SUGGEST_EDITABLE')}
                className={`w-full p-4 rounded-2xl border text-left transition relative flex flex-col gap-2 ${
                  pricingMode === 'SUGGEST_EDITABLE'
                    ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        pricingMode === 'SUGGEST_EDITABLE'
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-heading font-black text-sm text-slate-900">
                        แนะนำราคาขายอัตโนมัติ (แก้ไขได้ตลอด)
                      </h4>
                      <span className="text-[11px] text-teal-700 font-bold">
                        ★ แนะนำสำหรับร้านของชำ
                      </span>
                    </div>
                  </div>
                  {pricingMode === 'SUGGEST_EDITABLE' && (
                    <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-600 pl-11">
                  เมื่อกรอกต้นทุนรับของ ระบบจะคำนวณราคาขายแนะนำจากกำไรเป้าหมายให้ทันที
                  และปัดเศษเหรียญให้ทอนง่าย แต่คุณสามารถพิมพ์ราคาที่ต้องการขายจริงทับได้อิสระเสมอ
                </p>
              </button>

              {/* Mode 2: MANUAL_ONLY */}
              <button
                type="button"
                onClick={() => setPricingMode('MANUAL_ONLY')}
                className={`w-full p-4 rounded-2xl border text-left transition relative flex flex-col gap-2 ${
                  pricingMode === 'MANUAL_ONLY'
                    ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        pricingMode === 'MANUAL_ONLY'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-heading font-black text-sm text-slate-900">
                        กำหนดราคาขายเองทั้งหมด (Manual)
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        เหมาะสำหรับคนที่มีราคาในใจอยู่แล้ว
                      </span>
                    </div>
                  </div>
                  {pricingMode === 'MANUAL_ONLY' && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-600 pl-11">
                  ไม่แสดงสูตรแนะนำราคาและไม่คำนวณราคาเสนอแนะ หน้าจอสะอาด
                  คุณเป็นผู้กรอกราคาขายเองทุกชิ้นตามที่ต้องการขายจริง
                </p>
              </button>
            </div>
          )}

          {/* STEP 3: Margins & Sample Data */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              {/* Margin setting if SUGGEST_EDITABLE */}
              {pricingMode === 'SUGGEST_EDITABLE' ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-teal-600" />
                      <span>กำไรเป้าหมายเริ่มต้น (%)</span>
                    </label>
                    <span className="font-heading font-black text-teal-700 text-lg">
                      {defaultMarginPct}%
                    </span>
                  </div>

                  {/* Preset Chips */}
                  <div className="grid grid-cols-4 gap-2">
                    {['15', '20', '25', '30'].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDefaultMarginPct(pct)}
                        className={`h-10 rounded-xl font-bold text-xs border transition ${
                          defaultMarginPct === pct
                            ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    เช่น ทุน 10 บาท กำไร +20% ระบบจะแนะนำราคา 12 บาท (ปรับรายหมวดได้ภายหลัง)
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>คุณเลือกโหมดตั้งราคาเองทั้งหมด — ไม่ต้องกังวลเรื่องการตั้ง % กำไร</span>
                </div>
              )}

              {/* Sample Products Selection */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-700 block">
                  ต้องการใส่สินค้าตัวอย่างหรือไม่?
                </label>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setLoadSampleData(true)}
                    className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition ${
                      loadSampleData
                        ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500 text-teal-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs block">
                          ใส่สินค้าตัวอย่าง 6 รายการ (แนะนำ)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          มีน้ำดื่ม, โค้ก, มาม่า, เลย์ ฯลฯ ให้ลองกดเล่นได้ทันที
                        </span>
                      </div>
                    </div>
                    {loadSampleData && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLoadSampleData(false)}
                    className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition ${
                      !loadSampleData
                        ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500 text-teal-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs block">เริ่มจากร้านเปล่า</span>
                        <span className="text-[11px] text-slate-500">
                          คลังว่างเปล่า เพื่อให้คุณบันทึกสินค้าจริงของร้านเอง
                        </span>
                      </div>
                    </div>
                    {!loadSampleData && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="h-12 px-4 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl active:bg-slate-100 transition"
            >
              ย้อนกลับ
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="h-12 px-6 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-heading font-extrabold text-sm rounded-xl shadow-md flex items-center gap-2 active:scale-95 transition ml-auto"
            >
              <span>ถัดไป</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={isSubmitting}
              className="flex-1 h-12 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 text-white font-heading font-black text-sm rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'เริ่มใช้งานร้านค้า'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
