const RUSSIAN_MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

const RUSSIAN_WEEKDAYS_FULL = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateDDMMYYYY(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function formatDateShortDDMM(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
}

export function formatIsoToDDMMYYYY(iso?: string | null): string {
  const raw = (iso ?? '').trim();
  if (!raw) return '';

  const ddmmyyyy = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ddmmyyyy) return raw;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateDDMMYYYY(parsed);
  }
  return raw;
}

export function formatDDMMYYYYToIso(dateStr: string): string {
  const raw = dateStr.trim();
  if (!raw) return '';

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    const dt = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      Number.isNaN(dt.getTime()) ||
      dt.getFullYear() !== year ||
      dt.getMonth() !== month - 1 ||
      dt.getDate() !== day
    ) {
      return '';
    }
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return '';

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const dt = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return '';
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function formatExamDateHeader(dateStr: string): string {
  const raw = dateStr.trim();
  if (!raw || raw === 'Без даты') return 'Без даты';

  let day: number;
  let month: number;
  let year: number;

  const dmy = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dmy) {
    day = Number.parseInt(dmy[1], 10);
    month = Number.parseInt(dmy[2], 10);
    year = Number.parseInt(dmy[3], 10);
  } else if (ymd) {
    year = Number.parseInt(ymd[1], 10);
    month = Number.parseInt(ymd[2], 10);
    day = Number.parseInt(ymd[3], 10);
  } else {
    return raw;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return raw;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return raw;
  }

  const monthName = RUSSIAN_MONTHS_GENITIVE[month - 1];
  const weekdayName = RUSSIAN_WEEKDAYS_FULL[date.getDay()];
  return `${day} ${monthName}, ${weekdayName}`;
}

export function formatPhoneBelarus(phone?: string | null): string {
  const raw = (phone ?? '').trim();
  if (!raw) return '';
  const compact = raw.replace(/[\s()-]/g, '');
  if (compact.length === 13 && compact.startsWith('+375') && /^\+375\d{9}$/.test(compact)) {
    return `+375 (${compact.slice(4, 6)}) ${compact.slice(6, 9)}-${compact.slice(9, 11)}-${compact.slice(11, 13)}`;
  }
  return raw;
}

export function formatGpa(value?: number | null, decimals: 1 | 2 = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return '—';
  }
  return value.toFixed(decimals);
}

export function calculateMarkSheetCost(hours: number, isGoodReason: boolean): number {
  if (isGoodReason) return 0;
  const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  return Number((safeHours * 5.75).toFixed(2));
}

export function formatMarkSheetCost(price: number): string {
  const safePrice = Number.isFinite(price) ? Math.max(0, price) : 0;
  return `${safePrice.toFixed(2)} BYN`;
}

export function formatHours(hours: number): string {
  const safe = Number.isFinite(hours) ? hours : 0;
  return `${safe} ч`;
}

export function computeExcusedHours(totalHours: number, unexcusedHours: number): number {
  const safeTotal = Number.isFinite(totalHours) ? totalHours : 0;
  const safeUnexcused = Number.isFinite(unexcusedHours) ? unexcusedHours : 0;
  return Math.max(0, safeTotal - safeUnexcused);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  }
  return `${(bytes / 1024).toFixed(0)} КБ`;
}

export function cleanAuditory(
  auditory?: string | null,
  title?: string,
  lessonType?: string,
): string {
  const cleaned = (auditory ?? '')
    .trim()
    .replace(/^(ауд\.?\s*|aud\.?\s*)/i, '')
    .trim();
  if (cleaned) return cleaned;

  const combined = `${title ?? ''} ${lessonType ?? ''}`.toLowerCase();
  if (combined.includes('физ')) {
    return 'спортзал';
  }
  return '—';
}
