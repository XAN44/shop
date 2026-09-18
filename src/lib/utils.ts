export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

export function formatThaiCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '฿0';
  const hasDecimals = amount % 1 !== 0;
  return '฿' + amount.toLocaleString('th-TH', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function formatThaiNumber(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return '0';
  const hasDecimals = num % 1 !== 0;
  return num.toLocaleString('th-TH', {
    minimumFractionDigits: hasDecimals ? 1 : 0,
    maximumFractionDigits: 2,
  });
}

export function formatThaiRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'ยังไม่เคยบันทึก';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'ไม่ระบุวัน';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'เมื่อสักครู่';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  
  // Check if same calendar day
  const isToday = now.toDateString() === date.toDateString();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  if (isToday) {
    return `วันนี้ ${hours}:${minutes} น.`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) {
    return `เมื่อวาน ${hours}:${minutes} น.`;
  }

  if (diffDays < 7) {
    return `${diffDays} วันก่อน`;
  }

  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const thaiYear = (date.getFullYear() + 543) % 100;
  return `${day} ${month} ${thaiYear}`;
}

export function formatThaiFullDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543} เวลา ${hours}:${minutes} น.`;
}

/**
 * คำนวณราคาขายแนะนำจากต้นทุนเฉลี่ยและ margin %
 * พร้อมปัดเศษให้เหมาะกับการตั้งราคาจริงของร้านของชำ
 */
export function calculateSuggestedPrice(avgCost: number, marginPct: number): number {
  if (!avgCost || avgCost <= 0) return 0;
  const targetMargin = Math.max(0, marginPct);
  const rawPrice = avgCost * (1 + targetMargin / 100);

  // ปัดราคาให้เป็นเลขที่จำง่ายและทอนเหรียญสะดวก (จำนวนเต็ม หรือ .50)
  if (rawPrice <= 10) {
    // ปัดเป็น 0.50 หรือจำนวนเต็ม
    const roundedToHalf = Math.ceil(rawPrice * 2) / 2;
    return roundedToHalf;
  }
  // สินค้า 10 บาทขึ้นไป ปัดขึ้นเป็นจำนวนเต็มบาท
  return Math.ceil(rawPrice);
}

/**
 * Fuzzy / flexible Thai string match
 */
export function matchesSearch(text: string, query: string): boolean {
  if (!query) return true;
  const cleanQuery = query.trim().toLowerCase();
  const cleanText = text.toLowerCase();
  return cleanText.includes(cleanQuery);
}

export interface ChangeBreakdownItem {
  label: string;
  count: number;
  value: number;
}

/**
 * คำนวณแจกแจงเงินทอน (ธนบัตรและเหรียญไทย) อย่างแม่นยำ 100%
 * คำนวณในระดับสตางค์ (integer) เพื่อป้องกัน Floating-point error
 */
export function calculateChangeBreakdown(changeAmount: number): ChangeBreakdownItem[] {
  let remainingSatang = Math.round(changeAmount * 100);
  if (remainingSatang <= 0) return [];

  const denominations: { label: string; satang: number; value: number }[] = [
    { label: 'แบงก์ 1,000', satang: 100000, value: 1000 },
    { label: 'แบงก์ 500', satang: 50000, value: 500 },
    { label: 'แบงก์ 100', satang: 10000, value: 100 },
    { label: 'แบงก์ 50', satang: 5000, value: 50 },
    { label: 'แบงก์ 20', satang: 2000, value: 20 },
    { label: 'เหรียญ 10', satang: 1000, value: 10 },
    { label: 'เหรียญ 5', satang: 500, value: 5 },
    { label: 'เหรียญ 2', satang: 200, value: 2 },
    { label: 'เหรียญ 1', satang: 100, value: 1 },
    { label: 'เหรียญ 50 สต.', satang: 50, value: 0.5 },
  ];

  const breakdown: ChangeBreakdownItem[] = [];

  for (const denom of denominations) {
    if (remainingSatang >= denom.satang) {
      const count = Math.floor(remainingSatang / denom.satang);
      breakdown.push({
        label: denom.label,
        count,
        value: denom.value,
      });
      remainingSatang %= denom.satang;
    }
  }

  return breakdown;
}

export function formatChangeBreakdownThai(items: ChangeBreakdownItem[]): string {
  if (!items || items.length === 0) return 'ไม่ต้องทอนเงิน';
  return items.map((i) => `${i.label} × ${i.count}`).join('  ·  ');
}
