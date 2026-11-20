import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Stethoscope,
  X,
} from 'lucide-react';
import {
  AppleButtonPrimary,
  AppleCard,
  AppleOptionChip,
  IosDatePickerModal,
  colorWithAlpha,
} from '../components/ui';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../services/telegram';
import type { CertificatePlaceOption, MarkSheetSubjectDto } from '../types';
import {
  calculateMarkSheetCost,
  formatDateDDMMYYYY,
  formatMarkSheetCost,
} from '../utils/formatters';
import { OrviApplicationModal } from './AbsencesScreen';

export interface StudyScreenProps {
  onBack: () => void;
  onOpenOrvi?: () => void;
}

const FALLBACK_PLACES: CertificatePlaceOption[] = [
  { name: 'По месту работы родителей', type: 0 },
  { name: 'В военный комиссариат', type: 1 },
  { name: 'По месту требования', type: 0 },
  { name: 'В ФСЗН', type: 0 },
  { name: 'В управление социальной защиты', type: 0 },
  { name: 'В посольство', type: 0 },
];

const FALLBACK_SUBJECTS: MarkSheetSubjectDto[] = [
  { abbrev: 'ОАиП', term: 1, lessonTypes: [{ abbrev: 'ЛР', thId: 1 }, { abbrev: 'Экзамен', focsId: 1 }] },
  { abbrev: 'АиСД', term: 2, lessonTypes: [{ abbrev: 'ЛР', thId: 2 }, { abbrev: 'Экзамен', focsId: 2 }] },
  { abbrev: 'КСиС', term: 3, lessonTypes: [{ abbrev: 'ЛР', thId: 3 }, { abbrev: 'Зачёт', focsId: 3 }] },
];

function capitalizeFirst(str: string): string {
  const s = str.trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const StudyScreen: React.FC<StudyScreenProps> = ({
  onBack,
  onOpenOrvi,
}) => {
  const {
    study,
    isOfflineMode,
    loadStudyData,
    orderCertificate,
    cancelCertificate,
    createMarkSheet,
    closeMarkSheet,
  } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  const [selectedTab, setSelectedTab] = useState<0 | 1>(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Order Certificate Modal
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState('По месту требования');
  const [customPlace, setCustomPlace] = useState('');
  const [certType, setCertType] = useState<'обычная' | 'гербовая'>('обычная');
  const [certCount, setCertCount] = useState(1);
  const [isOrderingCert, setIsOrderingCert] = useState(false);

  // Order Mark Sheet Modal
  const [msModalOpen, setMsModalOpen] = useState(false);
  const [selectedSubjectIdx, setSelectedSubjectIdx] = useState(0);
  const [selectedLessonTypeIdx, setSelectedLessonTypeIdx] = useState(0);
  const [teacherFio, setTeacherFio] = useState('');
  const [absentDate, setAbsentDate] = useState(() => new Date());
  const [msDatePickerOpen, setMsDatePickerOpen] = useState(false);
  const [hoursCount, setHoursCount] = useState<2 | 4 | 6>(2);
  const [isGoodReason, setIsGoodReason] = useState(true);
  const [isOrderingMs, setIsOrderingMs] = useState(false);

  // Inline ORVI Modal
  const [orviOpen, setOrviOpen] = useState(false);

  useEffect(() => {
    void loadStudyData();
  }, [loadStudyData]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const greenColor = isDarkTheme ? '#4CC38A' : '#16A34A';
  const redColor = isDarkTheme ? '#E5484D' : '#DC2626';
  const amberColor = '#FF9500';

  const allPlaces = useMemo(() => {
    const flattened = study.certPlaces.flatMap((g) => g.places);
    return (flattened.length > 0 ? flattened : FALLBACK_PLACES).slice(0, 8);
  }, [study.certPlaces]);

  const subjects = useMemo(
    () => (study.markSheetSubjects.length > 0 ? study.markSheetSubjects : FALLBACK_SUBJECTS),
    [study.markSheetSubjects],
  );

  const activeSubject = subjects[selectedSubjectIdx] ?? subjects[0];
  const activeLessonType =
    activeSubject?.lessonTypes[selectedLessonTypeIdx] ??
    activeSubject?.lessonTypes[0] ?? { abbrev: 'ЛР', thId: 1 };

  const liveCost = calculateMarkSheetCost(hoursCount, isGoodReason);

  const openCertModal = () => {
    setSelectedPlace(allPlaces[0]?.name ?? 'По месту требования');
    setCertType(allPlaces[0]?.type === 1 ? 'гербовая' : 'обычная');
    setCustomPlace('');
    setCertCount(1);
    setCertModalOpen(true);
  };

  const handleOrderCertificate = async () => {
    const place = customPlace.trim() || selectedPlace;
    if (!place || isOrderingCert) return;
    setIsOrderingCert(true);
    try {
      await orderCertificate({
        certificateCount: certCount,
        certificateRequestDto: {
          certificateType: certType,
          provisionPlace: place,
        },
      });
      triggerHaptic('notification', 'success');
      setCertModalOpen(false);
      setToastMsg(
        isOfflineMode
          ? 'Справка оформлена в оффлайн-режиме'
          : 'Заявка на справку отправлена в ИИС',
      );
    } finally {
      setIsOrderingCert(false);
    }
  };

  const handleCancelCertificate = async (id: number) => {
    triggerHaptic('impact', 'medium');
    await cancelCertificate(id);
    setToastMsg('Заявка отменена');
  };

  const openMarkSheetModal = () => {
    setSelectedSubjectIdx(0);
    setSelectedLessonTypeIdx(0);
    setTeacherFio('');
    setAbsentDate(new Date());
    setHoursCount(2);
    setIsGoodReason(true);
    setMsModalOpen(true);
  };

  const handleCreateMarkSheet = async () => {
    if (isOrderingMs) return;
    setIsOrderingMs(true);
    try {
      await createMarkSheet({
        price: liveCost,
        reason: isGoodReason,
        hours: String(hoursCount),
        absentDate: formatDateDDMMYYYY(absentDate),
        subject: {
          focsId: activeLessonType.focsId ?? null,
          thId: activeLessonType.thId ?? null,
        },
      });
      triggerHaptic('notification', 'success');
      setMsModalOpen(false);
      setToastMsg('Заявка на ведомость отправлена');
    } finally {
      setIsOrderingMs(false);
    }
  };

  const handleCloseMarkSheet = async (id: number) => {
    triggerHaptic('impact', 'medium');
    await closeMarkSheet(id);
    setToastMsg('Ведомость отозвана');
  };

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

        <div className="flex-1 min-w-0">
          <h1
            className="font-semibold leading-tight truncate"
            style={{
              fontSize: 'calc(24px * var(--text-scale, 1))',
              color: tokens.text,
            }}
          >
            Учёба и документы
          </h1>
          <p
            className="text-s-13 truncate"
            style={{ color: tokens.textSecondary }}
          >
            Заказ справок и экзаменационных листов
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('impact', 'light');
            void loadStudyData(true);
          }}
          aria-label="Обновить"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
          style={{ color: tokens.accent }}
        >
          <RefreshCw
            size={20}
            className={study.loading ? 'animate-spin' : ''}
          />
        </button>
      </header>

      {/* Tabs + Actions */}
      <div className="shrink-0 px-4 pb-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <AppleOptionChip
            label={`Справки (${study.certificates.length})`}
            isSelected={selectedTab === 0}
            isDarkTheme={isDarkTheme}
            accentColor={tokens.accent}
            borderColorOverride={tokens.border}
            onClick={() => setSelectedTab(0)}
          />
          <AppleOptionChip
            label={`Ведомости (${study.markSheets.length})`}
            isSelected={selectedTab === 1}
            isDarkTheme={isDarkTheme}
            accentColor={tokens.accent}
            borderColorOverride={tokens.border}
            onClick={() => setSelectedTab(1)}
          />
        </div>

        <button
          type="button"
          onClick={selectedTab === 0 ? openCertModal : openMarkSheetModal}
          className="w-full h-[48px] rounded-[14px] flex items-center justify-center gap-2 text-s-15 font-semibold cursor-pointer active:opacity-85"
          style={{
            backgroundColor: tokens.accent,
            color: tokens.accentFg,
          }}
        >
          <Plus size={18} />
          <span>
            {selectedTab === 0 ? '+ Заказать справку' : '+ Заказать ведомость'}
          </span>
        </button>

        {selectedTab === 0 && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onOpenOrvi?.();
              setOrviOpen(true);
            }}
            className="w-full h-[44px] rounded-[14px] border flex items-center justify-center gap-2 text-s-14 font-semibold cursor-pointer active:opacity-80"
            style={{
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              color: tokens.text,
            }}
          >
            <Stethoscope size={17} style={{ color: tokens.accent }} />
            <span>Подать заявку на ОРВИ</span>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
        {toastMsg && (
          <div
            role="status"
            className="mb-3 rounded-[14px] px-4 py-2.5 text-s-13 font-semibold"
            style={{
              backgroundColor: colorWithAlpha(greenColor, 0.16),
              color: greenColor,
            }}
          >
            {toastMsg}
          </div>
        )}

        {study.loading &&
        study.certificates.length === 0 &&
        study.markSheets.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: tokens.accent }}
            />
          </div>
        ) : selectedTab === 0 ? (
          study.certificates.length === 0 ? (
            <div className="py-14 px-4 flex flex-col items-center justify-center text-center gap-2.5">
              <FileText
                size={36}
                style={{ color: tokens.textSecondary }}
                className="opacity-60"
              />
              <div
                className="text-s-16 font-semibold"
                style={{ color: tokens.text }}
              >
                Заказанных справок пока нет
              </div>
              <p
                className="text-s-13 max-w-xs"
                style={{ color: tokens.textSecondary }}
              >
                Вы можете заказать справку об обучении по месту работы
                родителей, в военкомат или ФСЗН прямо из приложения
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {study.certificates.map((cert) => {
                const statusMeta =
                  cert.status === 1
                    ? { label: 'Напечатана', color: greenColor }
                    : cert.status === 2
                      ? { label: 'В обработке', color: amberColor }
                      : cert.status === 3
                        ? { label: 'Отклонена', color: redColor }
                        : { label: 'Принята', color: tokens.accent };

                return (
                  <AppleCard
                    key={cert.id}
                    isDarkTheme={isDarkTheme}
                    cardBg={tokens.card}
                    cardBorder={tokens.border}
                    className="flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="text-s-16 font-semibold"
                        style={{ color: tokens.text }}
                      >
                        {cert.number > 0
                          ? `Справка №${cert.number}`
                          : 'Заявка на справку'}
                      </span>
                      <span
                        className="text-s-13 font-semibold shrink-0"
                        style={{ color: statusMeta.color }}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <div
                      className="text-s-14"
                      style={{ color: tokens.text }}
                    >
                      Куда: {cert.provisionPlace}
                    </div>
                    <div
                      className="text-s-13"
                      style={{ color: tokens.textSecondary }}
                    >
                      Тип: {cert.certificateType}
                    </div>
                    <div
                      className="text-s-12"
                      style={{ color: tokens.textSecondary }}
                    >
                      Заказ: {cert.dateOrder}
                      {cert.issueDate ? ` • Выдана: ${cert.issueDate}` : ''}
                    </div>

                    {cert.rejectionReason && cert.rejectionReason.trim() && (
                      <div
                        className="text-s-13"
                        style={{ color: redColor }}
                      >
                        Причина: {cert.rejectionReason}
                      </div>
                    )}

                    {cert.status === 2 && cert.id > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          void handleCancelCertificate(cert.id);
                        }}
                        className="mt-1 self-start text-s-13 font-semibold cursor-pointer"
                        style={{ color: redColor }}
                      >
                        Отменить заявку
                      </button>
                    )}
                  </AppleCard>
                );
              })}
            </div>
          )
        ) : study.markSheets.length === 0 ? (
          <div className="py-14 px-4 flex flex-col items-center justify-center text-center gap-2.5">
            <FileText
              size={36}
              style={{ color: tokens.textSecondary }}
              className="opacity-60"
            />
            <div
              className="text-s-16 font-semibold"
              style={{ color: tokens.text }}
            >
              Заказанных ведомостей нет
            </div>
            <p
              className="text-s-13 max-w-xs"
              style={{ color: tokens.textSecondary }}
            >
              Здесь отображаются экзаменационные листовки на отработку
              лабораторных работ и пересдачу зачётов/экзаменов
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {study.markSheets.map((ms) => {
              const lowerStatus = ms.status.toLowerCase();
              const statusColor =
                lowerStatus.includes('напечат') ||
                lowerStatus.includes('одобр') ||
                lowerStatus.includes('готов')
                  ? greenColor
                  : lowerStatus.includes('откл') || lowerStatus.includes('отозв')
                    ? redColor
                    : amberColor;

              return (
                <AppleCard
                  key={ms.id}
                  isDarkTheme={isDarkTheme}
                  cardBg={tokens.card}
                  cardBorder={tokens.border}
                  className="flex flex-col gap-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="text-s-16 font-semibold"
                      style={{ color: tokens.text }}
                    >
                      {ms.subjectName}
                      {ms.subjectType ? ` (${ms.subjectType})` : ''}
                    </span>
                    <span
                      className="text-s-13 font-semibold shrink-0"
                      style={{ color: statusColor }}
                    >
                      {capitalizeFirst(ms.status)}
                    </span>
                  </div>

                  {ms.employeeFio && (
                    <div
                      className="text-s-13"
                      style={{ color: tokens.textSecondary }}
                    >
                      Преподаватель: {ms.employeeFio}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className="text-s-13"
                      style={{ color: tokens.text }}
                    >
                      Пропуск: {ms.absentDate} • {ms.hours} ч (
                      {ms.isGoodReason ? 'ув. причина' : 'без ув.'})
                    </span>
                    {ms.price > 0 && (
                      <span
                        className="text-s-13 font-semibold tabular-nums"
                        style={{ color: tokens.accent }}
                      >
                        {formatMarkSheetCost(ms.price)}
                      </span>
                    )}
                  </div>

                  {(ms.number || ms.expireDate) && (
                    <div
                      className="text-s-12"
                      style={{ color: tokens.textSecondary }}
                    >
                      {ms.number ? `№ ${ms.number}` : ''}
                      {ms.number && ms.expireDate ? ' • ' : ''}
                      {ms.expireDate ? `Действительна до ${ms.expireDate}` : ''}
                    </div>
                  )}

                  {ms.rejectionReason && ms.rejectionReason.trim() && (
                    <div className="text-s-13" style={{ color: redColor }}>
                      Причина: {ms.rejectionReason}
                    </div>
                  )}

                  {lowerStatus.includes('обработ') && ms.id > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleCloseMarkSheet(ms.id);
                      }}
                      className="mt-1 self-start text-s-13 font-semibold cursor-pointer"
                      style={{ color: redColor }}
                    >
                      Отозвать заявку
                    </button>
                  )}
                </AppleCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Certificate Modal */}
      {certModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Заказ справки"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
          onClick={() => setCertModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[22px] border p-5 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: tokens.card, borderColor: tokens.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-s-18 font-bold" style={{ color: tokens.text }}>
                Заказ справки
              </h2>
              <button
                type="button"
                onClick={() => setCertModalOpen(false)}
                aria-label="Закрыть"
                style={{ color: tokens.textSecondary }}
                className="cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <span
                className="text-s-13 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                Место предоставления
              </span>
              <div className="flex flex-wrap gap-1.5">
                {allPlaces.map((p) => (
                  <AppleOptionChip
                    key={p.name}
                    label={p.name}
                    isSelected={selectedPlace === p.name && !customPlace.trim()}
                    isDarkTheme={isDarkTheme}
                    accentColor={tokens.accent}
                    borderColorOverride={tokens.border}
                    onClick={() => {
                      setSelectedPlace(p.name);
                      setCustomPlace('');
                      setCertType(p.type === 1 ? 'гербовая' : 'обычная');
                    }}
                    className="py-1.5 px-3 text-s-12"
                  />
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1">
              <span
                className="text-s-12"
                style={{ color: tokens.textSecondary }}
              >
                Или укажите своё место
              </span>
              <input
                type="text"
                value={customPlace}
                onChange={(e) => setCustomPlace(e.target.value)}
                placeholder="Например: по месту работы матери"
                className="w-full rounded-[12px] border px-3.5 py-2.5 text-s-14 outline-none"
                style={{
                  backgroundColor: tokens.cardLesson,
                  borderColor: tokens.border,
                  color: tokens.text,
                }}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span
                className="text-s-13 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                Тип справки
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(['обычная', 'гербовая'] as const).map((t) => {
                  const active = certType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCertType(t)}
                      className="h-[38px] rounded-[12px] border text-s-14 font-semibold cursor-pointer"
                      style={{
                        backgroundColor: active ? tokens.accent : tokens.cardLesson,
                        color: active ? tokens.accentFg : tokens.text,
                        borderColor: active ? 'transparent' : tokens.border,
                      }}
                    >
                      {capitalizeFirst(t)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span
                className="text-s-13 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                Количество экземпляров
              </span>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((num) => {
                  const active = certCount === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCertCount(num)}
                      className="h-[36px] rounded-[10px] border text-s-14 font-semibold cursor-pointer"
                      style={{
                        backgroundColor: active ? tokens.accent : tokens.cardLesson,
                        color: active ? tokens.accentFg : tokens.text,
                        borderColor: active ? 'transparent' : tokens.border,
                      }}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setCertModalOpen(false)}
                className="flex-1 h-[44px] rounded-full border text-s-15 font-semibold cursor-pointer"
                style={{
                  borderColor: tokens.border,
                  color: tokens.text,
                }}
              >
                Отмена
              </button>
              <AppleButtonPrimary
                isDarkTheme={isDarkTheme}
                accentColor={tokens.accent}
                disabled={isOrderingCert}
                onClick={() => {
                  void handleOrderCertificate();
                }}
                className="flex-1"
              >
                {isOrderingCert ? 'Отправка...' : 'Заказать'}
              </AppleButtonPrimary>
            </div>
          </div>
        </div>
      )}

      {/* Order Mark Sheet Modal */}
      {msModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Заказ ведомости"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
          onClick={() => setMsModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[22px] border p-5 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: tokens.card, borderColor: tokens.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-s-18 font-bold" style={{ color: tokens.text }}>
                Заказ ведомости
              </h2>
              <button
                type="button"
                onClick={() => setMsModalOpen(false)}
                aria-label="Закрыть"
                style={{ color: tokens.textSecondary }}
                className="cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Subject chips */}
            <div className="flex flex-col gap-1.5">
              <span
                className="text-s-13 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                Предмет
              </span>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((subj, idx) => (
                  <AppleOptionChip
                    key={`${subj.abbrev}-${subj.term}`}
                    label={subj.abbrev}
                    isSelected={selectedSubjectIdx === idx}
                    isDarkTheme={isDarkTheme}
                    accentColor={tokens.accent}
                    borderColorOverride={tokens.border}
                    onClick={() => {
                      setSelectedSubjectIdx(idx);
                      setSelectedLessonTypeIdx(0);
                    }}
                    className="py-1.5 px-3 text-s-13"
                  />
                ))}
              </div>
            </div>

            {/* Lesson type chips */}
            <div className="flex flex-col gap-1.5">
              <span
                className="text-s-13 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                Тип занятия
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(activeSubject?.lessonTypes ?? []).map((lt, idx) => (
                  <AppleOptionChip
                    key={`${lt.abbrev}-${idx}`}
                    label={lt.abbrev}
                    isSelected={selectedLessonTypeIdx === idx}
                    isDarkTheme={isDarkTheme}
                    accentColor={tokens.accent}
                    borderColorOverride={tokens.border}
                    onClick={() => setSelectedLessonTypeIdx(idx)}
                    className="py-1.5 px-3 text-s-13"
                  />
                ))}
              </div>
            </div>

            {/* Teacher */}
            <label className="flex flex-col gap-1">
              <span
                className="text-s-13 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                ФИО преподавателя
              </span>
              <input
                type="text"
                value={teacherFio}
                onChange={(e) => setTeacherFio(e.target.value)}
                placeholder="Фамилия И. О."
                className="w-full rounded-[12px] border px-3.5 py-2.5 text-s-14 outline-none"
                style={{
                  backgroundColor: tokens.cardLesson,
                  borderColor: tokens.border,
                  color: tokens.text,
                }}
              />
            </label>

            {/* Absent Date */}
            <div className="flex flex-col gap-1">
              <span
                className="text-s-13 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                Дата пропуска
              </span>
              <button
                type="button"
                onClick={() => setMsDatePickerOpen(true)}
                className="w-full rounded-[12px] border px-3.5 py-2.5 text-left text-s-14 font-medium cursor-pointer"
                style={{
                  backgroundColor: tokens.cardLesson,
                  borderColor: tokens.border,
                  color: tokens.text,
                }}
              >
                {formatDateDDMMYYYY(absentDate)}
              </button>
            </div>

            {/* Hours */}
            <div className="flex flex-col gap-1.5">
              <span
                className="text-s-13 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                Количество часов
              </span>
              <div className="grid grid-cols-3 gap-2">
                {([2, 4, 6] as const).map((h) => {
                  const active = hoursCount === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHoursCount(h)}
                      className="h-[38px] rounded-[12px] border text-s-14 font-semibold cursor-pointer"
                      style={{
                        backgroundColor: active ? tokens.accent : tokens.cardLesson,
                        color: active ? tokens.accentFg : tokens.text,
                        borderColor: active ? 'transparent' : tokens.border,
                      }}
                    >
                      {h} ч
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Good reason switch */}
            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <div>
                <div className="text-s-14 font-semibold" style={{ color: tokens.text }}>
                  Уважительная причина
                </div>
                <div className="text-s-12" style={{ color: tokens.textSecondary }}>
                  Без ув. причины: 5.75 BYN/ч
                </div>
              </div>
              <input
                type="checkbox"
                checked={isGoodReason}
                onChange={(e) => setIsGoodReason(e.target.checked)}
                aria-label="Уважительная причина"
                className="w-5 h-5 accent-[var(--accent)] cursor-pointer"
              />
            </label>

            {/* Live Cost Calculation */}
            <div
              className="rounded-[12px] px-3.5 py-2.5 flex items-center justify-between border"
              style={{
                backgroundColor: tokens.cardLesson,
                borderColor: tokens.divider,
              }}
            >
              <span
                className="text-s-13 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                К оплате:
              </span>
              <span
                className="text-s-15 font-bold tabular-nums"
                style={{ color: isGoodReason ? greenColor : tokens.accent }}
              >
                {isGoodReason
                  ? 'Бесплатно (0.00 BYN)'
                  : formatMarkSheetCost(liveCost)}
              </span>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setMsModalOpen(false)}
                className="flex-1 h-[44px] rounded-full border text-s-15 font-semibold cursor-pointer"
                style={{
                  borderColor: tokens.border,
                  color: tokens.text,
                }}
              >
                Отмена
              </button>
              <AppleButtonPrimary
                isDarkTheme={isDarkTheme}
                accentColor={tokens.accent}
                disabled={isOrderingMs}
                onClick={() => {
                  void handleCreateMarkSheet();
                }}
                className="flex-1"
              >
                {isOrderingMs ? 'Отправка...' : 'Заказать'}
              </AppleButtonPrimary>
            </div>
          </div>
        </div>
      )}

      <IosDatePickerModal
        isOpen={msDatePickerOpen}
        initialDay={absentDate.getDate()}
        initialMonth={absentDate.getMonth() + 1}
        initialYear={absentDate.getFullYear()}
        onDismiss={() => setMsDatePickerOpen(false)}
        onDateSelected={(day, month, year) => {
          setAbsentDate(new Date(year, month - 1, day, 12, 0, 0, 0));
          setMsDatePickerOpen(false);
        }}
      />

      <OrviApplicationModal
        isOpen={orviOpen}
        onClose={() => setOrviOpen(false)}
        onSuccess={(msg) => setToastMsg(msg)}
      />
    </div>
  );
};
