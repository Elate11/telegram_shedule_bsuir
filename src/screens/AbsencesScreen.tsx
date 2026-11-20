import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Info,
  Loader2,
  Lock,
  PenTool,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  AppleButtonPrimary,
  AppleButtonSecondaryPill,
  AppleCard,
  AppleOptionChip,
  IosDatePickerModal,
  colorWithAlpha,
} from '../components/ui';
import { useAppData } from '../context/AppDataContext';
import { computeRelativeLuminance, useTheme } from '../context/ThemeContext';
import { fetchPermanentAddress } from '../services/apiClient';
import { triggerHaptic } from '../services/telegram';
import {
  computeExcusedHours,
  formatDDMMYYYYToIso,
  formatDateDDMMYYYY,
} from '../utils/formatters';

export interface OrviApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

interface StrokePoint {
  x: number;
  y: number;
}

function addDaysLocal(base: Date, days: number): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + days,
    12,
    0,
    0,
    0,
  );
}

function startOfDayMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function exportSignaturePng(
  strokes: StrokePoint[][],
  sourceWidth: number,
  sourceHeight: number,
): string {
  const size = 400;
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const sx = sourceWidth > 0 ? size / sourceWidth : 1;
  const sy = sourceHeight > 0 ? size / sourceHeight : 1;

  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x * sx, stroke[0].y * sy);
    for (let i = 1; i < stroke.length; i += 1) {
      ctx.lineTo(stroke[i].x * sx, stroke[i].y * sy);
    }
    if (stroke.length === 1) {
      ctx.lineTo(stroke[0].x * sx + 0.5, stroke[0].y * sy + 0.5);
    }
    ctx.stroke();
  }

  return offscreen.toDataURL('image/png');
}

export const OrviApplicationModal: React.FC<OrviApplicationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { submitOrviOmission } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  const [todayAnchor] = useState(() => addDaysLocal(new Date(), 0));
  const [startDate, setStartDate] = useState<Date>(() => addDaysLocal(new Date(), 0));
  const [endDate, setEndDate] = useState<Date>(() => addDaysLocal(new Date(), 4));
  const [placeOfStay, setPlaceOfStay] = useState('');
  const [pickingTarget, setPickingTarget] = useState<'start' | 'end' | null>(null);

  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [savedStrokes, setSavedStrokes] = useState<StrokePoint[][]>([]);
  const [hasDraftStrokes, setHasDraftStrokes] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draftStrokesRef = useRef<StrokePoint[][]>([]);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const base = addDaysLocal(new Date(), 0);
    setStartDate(base);
    setEndDate(addDaysLocal(base, 4));
    setSignatureDataUrl(null);
    setSavedStrokes([]);
    draftStrokesRef.current = [];
    setHasDraftStrokes(false);
    setErrorText(null);

    if (!placeOfStay.trim()) {
      void fetchPermanentAddress().then((res) => {
        if (res.data && res.data.trim()) {
          setPlaceOfStay((prev) => (prev.trim() ? prev : res.data.trim()));
        }
      });
    }
  }, [isOpen]);

  const redrawSignatureCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = isDarkTheme ? '#FFFFFF' : '#000000';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of draftStrokesRef.current) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i += 1) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      if (stroke.length === 1) {
        ctx.lineTo(stroke[0].x + 0.5, stroke[0].y + 0.5);
      }
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (!signatureModalOpen) return;
    draftStrokesRef.current = savedStrokes.map((s) => [...s]);
    setHasDraftStrokes(savedStrokes.length > 0);
    window.requestAnimationFrame(() => redrawSignatureCanvas());
  }, [signatureModalOpen]);

  if (!isOpen) return null;

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasPointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    isDrawingRef.current = true;
    const pt = getCanvasPoint(e);
    draftStrokesRef.current = [...draftStrokesRef.current, [pt]];
    setHasDraftStrokes(true);
    redrawSignatureCanvas();
  };

  const handleCanvasPointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!isDrawingRef.current) return;
    const pt = getCanvasPoint(e);
    const all = draftStrokesRef.current;
    if (all.length === 0) return;
    all[all.length - 1].push(pt);
    redrawSignatureCanvas();
  };

  const handleCanvasPointerUp: React.PointerEventHandler<HTMLCanvasElement> = () => {
    isDrawingRef.current = false;
  };

  const handleClearSignature = () => {
    triggerHaptic('selection');
    draftStrokesRef.current = [];
    setHasDraftStrokes(false);
    redrawSignatureCanvas();
  };

  const handleSaveSignature = () => {
    const strokes = draftStrokesRef.current;
    if (strokes.length === 0) return;
    const canvas = canvasRef.current;
    const w = canvas?.width || 320;
    const h = canvas?.height || 320;
    const dataUrl = exportSignaturePng(strokes, w, h);
    setSavedStrokes(strokes.map((s) => [...s]));
    setSignatureDataUrl(dataUrl);
    setSignatureModalOpen(false);
    triggerHaptic('notification', 'success');
  };

  const startDateStr = formatDateDDMMYYYY(startDate);
  const endDateStr = formatDateDDMMYYYY(endDate);
  const canSubmit = Boolean(placeOfStay.trim() && signatureDataUrl && !isSubmitting);

  const handleSubmit = async () => {
    if (!canSubmit || !signatureDataUrl) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const res = await submitOrviOmission({
        file: null,
        startDate: formatDDMMYYYYToIso(startDateStr),
        endDate: formatDDMMYYYYToIso(endDateStr),
        placeOfStay: placeOfStay.trim(),
        signature: signatureDataUrl,
      });
      if (!res.ok) {
        triggerHaptic('notification', 'error');
        setErrorText(
          res.conflictLimitExceeded
            ? 'Вы превысили лимит дней на заявление студента в текущем месяце'
            : res.message || 'Не удалось отправить заявление',
        );
        return;
      }
      triggerHaptic('notification', 'success');
      onSuccess?.(res.message || 'Заявка успешно отправлена');
      onClose();
    } catch {
      triggerHaptic('notification', 'error');
      setErrorText('Ошибка при отправке заявления');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Оформление заявления по ОРВИ"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-[22px] border p-5 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: tokens.card, borderColor: tokens.border }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              className="text-s-18 font-bold"
              style={{ color: tokens.text }}
            >
              Оформление заявления по ОРВИ
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              style={{ color: tokens.textSecondary }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setPickingTarget('start')}
              className="p-3 rounded-[14px] border text-left flex items-center justify-between gap-2 cursor-pointer"
              style={{
                borderColor: tokens.border,
                backgroundColor: tokens.cardLesson,
              }}
            >
              <div>
                <div
                  className="text-s-11"
                  style={{ color: tokens.textSecondary }}
                >
                  Дата начала
                </div>
                <div
                  className="text-s-14 font-semibold mt-0.5"
                  style={{ color: tokens.text }}
                >
                  {startDateStr}
                </div>
              </div>
              <Calendar size={16} style={{ color: tokens.accent }} />
            </button>

            <button
              type="button"
              onClick={() => setPickingTarget('end')}
              className="p-3 rounded-[14px] border text-left flex items-center justify-between gap-2 cursor-pointer"
              style={{
                borderColor: tokens.border,
                backgroundColor: tokens.cardLesson,
              }}
            >
              <div>
                <div
                  className="text-s-11"
                  style={{ color: tokens.textSecondary }}
                >
                  Дата окончания
                </div>
                <div
                  className="text-s-14 font-semibold mt-0.5"
                  style={{ color: tokens.text }}
                >
                  {endDateStr}
                </div>
              </div>
              <Calendar size={16} style={{ color: tokens.accent }} />
            </button>
          </div>

          {/* Place of stay */}
          <label className="flex flex-col gap-1.5">
            <span
              className="text-s-13 font-medium"
              style={{ color: tokens.textSecondary }}
            >
              Место пребывания
            </span>
            <input
              type="text"
              value={placeOfStay}
              onChange={(e) => setPlaceOfStay(e.target.value)}
              placeholder="Республика Беларусь, г. Минск..."
              className="w-full rounded-[12px] border px-3.5 py-2.5 text-s-14 outline-none"
              style={{
                backgroundColor: tokens.cardLesson,
                borderColor: tokens.border,
                color: tokens.text,
              }}
            />
          </label>

          {/* Signature Box */}
          <div className="flex flex-col gap-1.5">
            <span
              className="text-s-13 font-medium"
              style={{ color: tokens.textSecondary }}
            >
              Подпись заявления:
            </span>
            <button
              type="button"
              onClick={() => setSignatureModalOpen(true)}
              className="w-full h-[130px] rounded-[14px] border border-dashed flex flex-col items-center justify-center gap-2 p-3 cursor-pointer"
              style={{
                borderColor: signatureDataUrl ? tokens.accent : tokens.border,
                backgroundColor: tokens.cardLesson,
              }}
            >
              {signatureDataUrl ? (
                <>
                  <img
                    src={signatureDataUrl}
                    alt="Подпись заявления"
                    className="max-h-[78px] object-contain"
                    style={{
                      filter: isDarkTheme ? 'invert(1)' : undefined,
                    }}
                  />
                  <span
                    className="text-s-12 font-medium"
                    style={{ color: tokens.accent }}
                  >
                    Нажмите для изменения
                  </span>
                </>
              ) : (
                <>
                  <PenTool size={22} style={{ color: tokens.accent }} />
                  <span
                    className="text-s-13 font-medium text-center"
                    style={{ color: tokens.textSecondary }}
                  >
                    Нажмите, чтобы расписаться на весь экран
                  </span>
                </>
              )}
            </button>
          </div>

          {errorText && (
            <div
              role="alert"
              className="rounded-[12px] px-3 py-2.5 text-s-13 font-medium"
              style={{
                backgroundColor: colorWithAlpha('#FF3B30', 0.14),
                color: isDarkTheme ? '#FF6961' : '#DC2626',
              }}
            >
              {errorText}
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <AppleButtonPrimary
              isDarkTheme={isDarkTheme}
              accentColor={tokens.accent}
              disabled={!canSubmit}
              onClick={() => {
                void handleSubmit();
              }}
              className="w-full"
            >
              {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
            </AppleButtonPrimary>
          </div>
        </div>
      </div>

      {/* Fullscreen Signature Modal */}
      {signatureModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ваша подпись"
          className="fixed inset-0 z-[60] flex flex-col p-4"
          style={{ backgroundColor: tokens.actualBg, color: tokens.text }}
        >
          <div className="flex items-center justify-between gap-2 pb-3">
            <div>
              <h3 className="text-s-18 font-bold">Ваша подпись</h3>
              <p
                className="text-s-13"
                style={{ color: tokens.textSecondary }}
              >
                Распишитесь пальцем на экране ниже
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSignatureModalOpen(false)}
              aria-label="Закрыть окно подписи"
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
              style={{ color: tokens.textSecondary }}
            >
              <X size={22} />
            </button>
          </div>

          <div
            className="flex-1 min-h-[240px] rounded-[18px] border relative overflow-hidden"
            style={{
              backgroundColor: tokens.card,
              borderColor: tokens.border,
            }}
          >
            {!hasDraftStrokes && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none px-6 text-center text-s-14"
                style={{ color: tokens.textSecondary }}
              >
                Поле для подписи (проведите пальцем)
              </div>
            )}
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              data-testid="signature-canvas"
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
              className="w-full h-full block"
              style={{ touchAction: 'none' }}
            />
          </div>

          <div className="pt-4 flex items-center gap-3">
            <AppleButtonSecondaryPill
              isDarkTheme={isDarkTheme}
              accentColor={
                !isDarkTheme && computeRelativeLuminance(tokens.accent) > 0.5
                  ? '#1D1D1F'
                  : tokens.accent
              }
              onClick={handleClearSignature}
              className="flex-1"
            >
              Очистить
            </AppleButtonSecondaryPill>
            <AppleButtonPrimary
              isDarkTheme={isDarkTheme}
              accentColor={tokens.accent}
              disabled={!hasDraftStrokes}
              onClick={handleSaveSignature}
              className="flex-1"
            >
              Сохранить подпись
            </AppleButtonPrimary>
          </div>
        </div>
      )}

      {/* Date Picker */}
      <IosDatePickerModal
        isOpen={pickingTarget !== null}
        initialDay={(pickingTarget === 'end' ? endDate : startDate).getDate()}
        initialMonth={(pickingTarget === 'end' ? endDate : startDate).getMonth() + 1}
        initialYear={(pickingTarget === 'end' ? endDate : startDate).getFullYear()}
        minDate={pickingTarget === 'end' ? startDate : todayAnchor}
        maxDate={
          pickingTarget === 'end'
            ? addDaysLocal(startDate, 4)
            : addDaysLocal(todayAnchor, 1)
        }
        onDismiss={() => setPickingTarget(null)}
        onDateSelected={(day, month, year) => {
          const chosen = new Date(year, month - 1, day, 12, 0, 0, 0);
          if (pickingTarget === 'start') {
            setStartDate(chosen);
            const maxEnd = addDaysLocal(chosen, 4);
            if (
              startOfDayMs(endDate) < startOfDayMs(chosen) ||
              startOfDayMs(endDate) > startOfDayMs(maxEnd)
            ) {
              setEndDate(maxEnd);
            }
          } else {
            setEndDate(chosen);
          }
          setPickingTarget(null);
        }}
      />
    </>
  );
};

export interface AbsencesScreenProps {
  onBack: () => void;
}

const ACADEMIC_MONTHS = [
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
] as const;

export const AbsencesScreen: React.FC<AbsencesScreenProps> = ({ onBack }) => {
  const { omissions, loadOmissions, isAuthenticated, lessons } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [orviOpen, setOrviOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    void loadOmissions();
  }, [loadOmissions]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const data = omissions.data;
  const totalHours = data?.totalHours ?? 0;
  const unexcusedHours = data?.unexcusedHours ?? 0;
  const excusedHours = computeExcusedHours(totalHours, unexcusedHours);

  const greenColor = isDarkTheme ? '#4CC38A' : '#16A34A';
  const redColor = '#FF3B30';

  const chartBars = useMemo(() => {
    const monthlyTotal = data?.monthlyHours ?? data?.monthlyData ?? {};
    const monthlyUnexcused =
      data?.monthlyUnexcusedHours ?? data?.monthlyUnexcusedData ?? {};
    const items = ACADEMIC_MONTHS.map((m) => {
      const total = monthlyTotal[m] ?? 0;
      const unexcused = Math.min(total, monthlyUnexcused[m] ?? 0);
      const excused = Math.max(0, total - unexcused);
      return { month: m, total, excused, unexcused };
    });
    const maxHours = Math.max(
      1,
      ...items.map((item) => item.total),
    );
    return { items, maxHours };
  }, [data]);

  const filteredLessons = useMemo(() => {
    const list = data?.lessons ?? [];
    if (!selectedMonth) return list;
    return list.filter((l) => l.monthName === selectedMonth);
  }, [data?.lessons, selectedMonth]);

  const showAuthGuard =
    !isAuthenticated && !data && !omissions.loading && lessons.length === 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 px-4 pt-3 pb-2.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            onBack();
          }}
          aria-label="Назад"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
          style={{ color: tokens.text }}
        >
          <ChevronLeft size={24} />
        </button>

        <h1
          className="flex-1 min-w-0 font-semibold leading-tight truncate"
          style={{
            fontSize: 'calc(26px * var(--text-scale, 1))',
            color: tokens.text,
          }}
        >
          Пропуски и справки
        </h1>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('impact', 'light');
            void loadOmissions(true);
          }}
          aria-label="Обновить"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
          style={{ color: tokens.accent }}
        >
          <RefreshCw
            size={20}
            className={omissions.loading ? 'animate-spin' : ''}
          />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8 flex flex-col gap-4">
        {toastMsg && (
          <div
            role="status"
            className="rounded-[14px] px-4 py-2.5 text-s-13 font-semibold"
            style={{
              backgroundColor: colorWithAlpha(greenColor, 0.16),
              color: greenColor,
            }}
          >
            {toastMsg}
          </div>
        )}

        {omissions.loading && !data ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: tokens.accent }}
            />
          </div>
        ) : showAuthGuard ? (
          <AppleCard
            isDarkTheme={isDarkTheme}
            cardBg={tokens.card}
            cardBorder={tokens.border}
            className="flex flex-col items-center text-center gap-2.5 py-8"
          >
            <Lock size={42} style={{ color: tokens.accent }} />
            <div
              className="text-s-16 font-semibold"
              style={{ color: tokens.text }}
            >
              Авторизация в ИИС БГУИР
            </div>
            <p
              className="text-s-13 max-w-xs"
              style={{ color: tokens.textSecondary }}
            >
              Войдите в аккаунт ИИС БГУИР в профиле, чтобы загрузить ваши
              реальные пропуски и справки.
            </p>
          </AppleCard>
        ) : (
          <>
            {/* 3 KPI Stats */}
            <AppleCard
              isDarkTheme={isDarkTheme}
              cardBg={tokens.card}
              cardBorder={tokens.border}
            >
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div
                    className="font-semibold tabular-nums"
                    style={{
                      fontSize: 'calc(24px * var(--text-scale, 1))',
                      color: tokens.accent,
                    }}
                  >
                    {unexcusedHours} ч
                  </div>
                  <div
                    className="text-s-11 font-medium mt-0.5"
                    style={{ color: tokens.textSecondary }}
                  >
                    За этот месяц
                  </div>
                </div>
                <div>
                  <div
                    className="font-semibold tabular-nums"
                    style={{
                      fontSize: 'calc(24px * var(--text-scale, 1))',
                      color: tokens.accent,
                    }}
                  >
                    {excusedHours} ч
                  </div>
                  <div
                    className="text-s-11 font-medium mt-0.5"
                    style={{ color: tokens.textSecondary }}
                  >
                    По справкам
                  </div>
                </div>
                <div>
                  <div
                    className="font-semibold tabular-nums"
                    style={{
                      fontSize: 'calc(24px * var(--text-scale, 1))',
                      color: tokens.accent,
                    }}
                  >
                    {totalHours} ч
                  </div>
                  <div
                    className="text-s-11 font-medium mt-0.5"
                    style={{ color: tokens.textSecondary }}
                  >
                    Всего за семестр
                  </div>
                </div>
              </div>
            </AppleCard>

            {/* Monthly Bar Chart */}
            <AppleCard
              isDarkTheme={isDarkTheme}
              cardBg={tokens.card}
              cardBorder={tokens.border}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-s-15 font-bold"
                  style={{ color: tokens.text }}
                >
                  График по месяцам
                </span>
                {selectedMonth && (
                  <button
                    type="button"
                    onClick={() => setSelectedMonth(null)}
                    className="text-s-12 font-semibold cursor-pointer"
                    style={{ color: tokens.accent }}
                  >
                    Сбросить ({selectedMonth})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-10 gap-1.5 items-end pt-2">
                {chartBars.items.map((item) => {
                  const isSelected = selectedMonth === item.month;
                  const maxHeightPx = 72;
                  const excusedPx =
                    item.excused > 0
                      ? Math.max(8, Math.round((item.excused / chartBars.maxHours) * maxHeightPx))
                      : 0;
                  const unexcusedPx =
                    item.unexcused > 0
                      ? Math.max(8, Math.round((item.unexcused / chartBars.maxHours) * maxHeightPx))
                      : 0;

                  return (
                    <button
                      key={item.month}
                      type="button"
                      aria-label={`Месяц ${item.month}`}
                      aria-pressed={isSelected}
                      onClick={() => {
                        triggerHaptic('selection');
                        setSelectedMonth((prev) =>
                          prev === item.month ? null : item.month,
                        );
                      }}
                      className="flex flex-col items-center gap-1.5 cursor-pointer py-1 rounded-[10px] transition-colors"
                      style={{
                        backgroundColor: isSelected
                          ? colorWithAlpha(tokens.accent, 0.14)
                          : 'transparent',
                      }}
                    >
                      <span
                        className="text-s-9_5 tabular-nums min-h-[13px]"
                        style={{ color: tokens.textSecondary }}
                      >
                        {item.total > 0 ? item.total : ''}
                      </span>

                      <div className="h-[76px] flex flex-col justify-end items-center gap-0.5 w-full px-1">
                        {item.total === 0 ? (
                          <div
                            className="w-2.5 h-1.5 rounded-full opacity-35"
                            style={{ backgroundColor: tokens.textSecondary }}
                          />
                        ) : (
                          <>
                            {unexcusedPx > 0 && (
                              <div
                                className="w-2.5 rounded-full"
                                style={{
                                  height: `${unexcusedPx}px`,
                                  backgroundColor: redColor,
                                }}
                              />
                            )}
                            {excusedPx > 0 && (
                              <div
                                className="w-2.5 rounded-full"
                                style={{
                                  height: `${excusedPx}px`,
                                  backgroundColor: greenColor,
                                }}
                              />
                            )}
                          </>
                        )}
                      </div>

                      <span
                        className="text-s-10_5 font-medium"
                        style={{
                          color: isSelected ? tokens.accent : tokens.textSecondary,
                        }}
                      >
                        {item.month}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-4 pt-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: greenColor }}
                  />
                  <span
                    className="text-s-11"
                    style={{ color: tokens.textSecondary }}
                  >
                    Уважительные (справки)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: redColor }}
                  />
                  <span
                    className="text-s-11"
                    style={{ color: tokens.textSecondary }}
                  >
                    Без ув. причины
                  </span>
                </div>
              </div>
            </AppleCard>

            {/* Excuse Documents + ORVI Trigger */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2
                  className="font-bold"
                  style={{
                    fontSize: 'calc(19px * var(--text-scale, 1))',
                    color: tokens.text,
                  }}
                >
                  Оправдательные документы
                </h2>
                <button
                  type="button"
                  onClick={() => setMemoOpen(true)}
                  className="inline-flex items-center gap-1 text-s-13 font-medium cursor-pointer"
                  style={{ color: tokens.accent }}
                >
                  <Info size={14} />
                  <span>Памятка</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('impact', 'light');
                  setOrviOpen(true);
                }}
                className="w-full h-[44px] rounded-[12px] flex items-center justify-center gap-2 text-s-15 font-semibold cursor-pointer active:opacity-85"
                style={{
                  backgroundColor: tokens.accent,
                  color: tokens.accentFg,
                }}
              >
                <Plus size={18} />
                <span>Подать заявку на ОРВИ</span>
              </button>

              {(data?.excuseDocuments ?? []).length === 0 ? (
                <AppleCard
                  isDarkTheme={isDarkTheme}
                  cardBg={tokens.card}
                  cardBorder={tokens.border}
                >
                  <p
                    className="text-s-13 leading-[1.45]"
                    style={{
                      color: totalHours === 0 ? greenColor : tokens.textSecondary,
                    }}
                  >
                    {totalHours === 0
                      ? 'Отлично! У вас 0 пропусков за этот месяц.'
                      : 'Все пропуски на текущий момент без уважительной причины. Сдайте справку в деканат для списания часов.'}
                  </p>
                </AppleCard>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {data?.excuseDocuments.map((doc, idx) => (
                    <AppleCard
                      key={`${doc.title}-${idx}`}
                      isDarkTheme={isDarkTheme}
                      cardBg={tokens.card}
                      cardBorder={tokens.border}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle2
                        size={22}
                        style={{ color: greenColor }}
                        className="shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className="text-s-15 font-semibold"
                            style={{ color: tokens.text }}
                          >
                            {doc.title}
                          </span>
                          {doc.hoursClosed > 0 && (
                            <span
                              className="px-2 py-0.5 rounded-full text-s-11 font-semibold shrink-0"
                              style={{
                                backgroundColor: colorWithAlpha(greenColor, 0.16),
                                color: greenColor,
                              }}
                            >
                              {doc.hoursClosed} ч списано
                            </span>
                          )}
                        </div>
                        {doc.note && (
                          <div
                            className="text-s-12"
                            style={{ color: tokens.textSecondary }}
                          >
                            {doc.note}
                          </div>
                        )}
                        {doc.subjects.length > 0 && (
                          <div
                            className="text-s-11"
                            style={{ color: tokens.textSecondary }}
                          >
                            Предметы: {doc.subjects.join(', ')}
                          </div>
                        )}
                      </div>
                    </AppleCard>
                  ))}
                </div>
              )}
            </div>

            {/* Missed Lessons Detail */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2
                  className="font-bold"
                  style={{
                    fontSize: 'calc(18px * var(--text-scale, 1))',
                    color: tokens.text,
                  }}
                >
                  {selectedMonth
                    ? `Пропуски за ${selectedMonth}`
                    : 'Детализация пропущенных занятий'}
                </h2>
                {selectedMonth && (
                  <AppleOptionChip
                    label="Все месяцы"
                    isSelected={false}
                    isDarkTheme={isDarkTheme}
                    accentColor={tokens.accent}
                    borderColorOverride={tokens.border}
                    onClick={() => setSelectedMonth(null)}
                    className="py-1 px-3 text-s-12"
                  />
                )}
              </div>

              {filteredLessons.length === 0 ? (
                <AppleCard
                  isDarkTheme={isDarkTheme}
                  cardBg={tokens.card}
                  cardBorder={tokens.border}
                >
                  <p
                    className="text-s-13 text-center py-2"
                    style={{ color: tokens.textSecondary }}
                  >
                    Пропусков за выбранный период нет
                  </p>
                </AppleCard>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {filteredLessons.map((lesson, idx) => (
                    <AppleCard
                      key={`${lesson.dateString}-${lesson.subject}-${idx}`}
                      isDarkTheme={isDarkTheme}
                      cardBg={tokens.card}
                      cardBorder={tokens.border}
                      className="flex flex-col gap-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {lesson.lessonType && (
                            <span
                              className="text-s-12 mr-1.5"
                              style={{ color: tokens.textSecondary }}
                            >
                              {lesson.lessonType}
                            </span>
                          )}
                          <span
                            className="text-s-14 font-semibold"
                            style={{ color: tokens.text }}
                          >
                            {lesson.subject}
                          </span>
                        </div>
                        <span
                          className="text-s-14 font-semibold shrink-0 tabular-nums"
                          style={{ color: tokens.text }}
                        >
                          {lesson.hours} ч
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className="text-s-12"
                          style={{ color: tokens.textSecondary }}
                        >
                          {[lesson.dateString, lesson.teacher]
                            .filter(Boolean)
                            .join(' • ')}
                        </span>
                        <span
                          className="text-s-12 font-semibold"
                          style={{
                            color: lesson.isRespectful ? greenColor : tokens.accent,
                          }}
                        >
                          {lesson.isRespectful
                            ? 'Уважительная'
                            : 'Без уважительной'}
                        </span>
                      </div>

                      {lesson.note && (
                        <div
                          className="text-s-12"
                          style={{ color: tokens.textSecondary }}
                        >
                          Основание: {lesson.note}
                        </div>
                      )}
                    </AppleCard>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Memo Dialog */}
      {memoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Памятка по пропускам и ОРВИ"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setMemoOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[20px] border p-5 flex flex-col gap-3"
            style={{ backgroundColor: tokens.card, borderColor: tokens.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-s-16 font-bold" style={{ color: tokens.text }}>
                Памятка по заявлению ОРВИ
              </h3>
              <button
                type="button"
                onClick={() => setMemoOpen(false)}
                aria-label="Закрыть памятку"
                style={{ color: tokens.textSecondary }}
                className="cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p
              className="text-s-13 leading-[1.45]"
              style={{ color: tokens.textSecondary }}
            >
              Студент может оформить электронное заявление по самочувствию
              (ОРВИ) без посещения поликлиники суммарно до 5 дней в текущем
              календарном месяце. При превышении месячного лимита ИИС вернёт
              уведомление об ограничении.
            </p>
            <AppleButtonPrimary
              isDarkTheme={isDarkTheme}
              accentColor={tokens.accent}
              onClick={() => setMemoOpen(false)}
            >
              Понятно
            </AppleButtonPrimary>
          </div>
        </div>
      )}

      {/* ORVI Application Modal */}
      <OrviApplicationModal
        isOpen={orviOpen}
        onClose={() => setOrviOpen(false)}
        onSuccess={(msg) => setToastMsg(msg)}
      />
    </div>
  );
};
