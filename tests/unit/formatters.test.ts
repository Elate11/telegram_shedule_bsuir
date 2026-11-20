import { describe, expect, it } from 'vitest';
import {
  calculateMarkSheetCost,
  cleanAuditory,
  computeExcusedHours,
  formatDDMMYYYYToIso,
  formatDateDDMMYYYY,
  formatDateShortDDMM,
  formatExamDateHeader,
  formatFileSize,
  formatGpa,
  formatHours,
  formatIsoToDDMMYYYY,
  formatMarkSheetCost,
  formatPhoneBelarus,
} from '../../src/utils/formatters';

describe('formatters', () => {
  it('formats dates to DD.MM.YYYY, DD.MM, and converts ISO <-> DD.MM.YYYY', () => {
    const dt = new Date(2026, 8, 1, 12, 0, 0);
    expect(formatDateDDMMYYYY(dt)).toBe('01.09.2026');
    expect(formatDateShortDDMM(dt)).toBe('01.09');
    expect(formatIsoToDDMMYYYY('2026-09-01T10:15:00Z')).toBe('01.09.2026');
    expect(formatIsoToDDMMYYYY('01.09.2026')).toBe('01.09.2026');
    expect(formatIsoToDDMMYYYY(null)).toBe('');
    expect(formatDDMMYYYYToIso('01.09.2026')).toBe('2026-09-01');
    expect(formatDDMMYYYYToIso('29.02.2024')).toBe('2024-02-29');
    expect(formatDDMMYYYYToIso('31.02.2026')).toBe('');
    expect(formatDDMMYYYYToIso('29.02.2026')).toBe('');
    expect(formatDDMMYYYYToIso('invalid')).toBe('');
  });

  it('formats exam date headers deterministically in Russian', () => {
    expect(formatExamDateHeader('')).toBe('Без даты');
    expect(formatExamDateHeader('Без даты')).toBe('Без даты');
    // 15.01.2025 is Wednesday (среда)
    expect(formatExamDateHeader('15.01.2025')).toBe('15 января, среда');
    // 12.01.2026 is Monday (понедельник)
    expect(formatExamDateHeader('12.01.2026')).toBe('12 января, понедельник');
  });

  it('formats Belarus phone numbers and leaves non-matching strings unchanged', () => {
    expect(formatPhoneBelarus('+375291234567')).toBe('+375 (29) 123-45-67');
    expect(formatPhoneBelarus('+375 (29) 123-45-67')).toBe('+375 (29) 123-45-67');
    expect(formatPhoneBelarus('12345')).toBe('12345');
    expect(formatPhoneBelarus(null)).toBe('');
  });

  it('formats GPA, hours, file sizes, and 5.75 BYN/h mark-sheet costs', () => {
    expect(formatGpa(8.456, 2)).toBe('8.46');
    expect(formatGpa(8.44, 1)).toBe('8.4');
    expect(formatGpa(0, 2)).toBe('—');
    expect(formatGpa(null, 2)).toBe('—');

    expect(calculateMarkSheetCost(2, false)).toBe(11.5);
    expect(calculateMarkSheetCost(4, false)).toBe(23);
    expect(calculateMarkSheetCost(2, true)).toBe(0);
    expect(formatMarkSheetCost(11.5)).toBe('11.50 BYN');

    expect(formatHours(12)).toBe('12 ч');
    expect(computeExcusedHours(10, 4)).toBe(6);
    expect(computeExcusedHours(2, 5)).toBe(0);

    expect(formatFileSize(0)).toBe('');
    expect(formatFileSize(240 * 1024)).toBe('240 КБ');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 МБ');
  });

  it('cleans auditory strings and handles physical education fallback', () => {
    expect(cleanAuditory('ауд. 312-4', 'ОАиП', 'ЛР')).toBe('312-4');
    expect(cleanAuditory('aud. 105-4', 'БД', 'ЛК')).toBe('105-4');
    expect(cleanAuditory('', 'ФизК', 'ПЗ')).toBe('спортзал');
    expect(cleanAuditory('', 'Математика', 'ЛК')).toBe('—');
  });
});
