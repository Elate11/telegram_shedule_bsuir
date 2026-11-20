import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  AppleButtonPrimary,
  AppleCard,
  colorWithAlpha,
} from '../components/ui';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { getIcalScheduleUrl } from '../services/apiClient';
import { getTelegramWebApp, triggerHaptic } from '../services/telegram';
import { cleanAuditory, formatDateShortDDMM } from '../utils/formatters';
import {
  filterLessons,
  getBsuirWeekInfo,
  getCalendarDayDate,
} from '../utils/scheduleMath';

export interface IisResumeScreenProps {
  onBack: () => void;
}

const FULL_DAY_NAMES: Record<number, string> = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье',
};

const SHORT_DAY_NAMES: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс',
};

export const IisResumeScreen: React.FC<IisResumeScreenProps> = ({ onBack }) => {
  const {
    personalCv,
    loadPersonalCv,
    updatePersonalCvSection,
    updatePersonalCvSkills,
    updatePersonalCvReferences,
    selectedGroup,
    effectiveTarget,
    subgroup,
    lessons,
  } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  const [previewDayOffset, setPreviewDayOffset] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals
  const [bioModalOpen, setBioModalOpen] = useState(false);
  const [draftBio, setDraftBio] = useState('');

  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');

  const [refModalOpen, setRefModalOpen] = useState(false);
  const [newRefName, setNewRefName] = useState('');
  const [newRefUrl, setNewRefUrl] = useState('');

  useEffect(() => {
    void loadPersonalCv();
  }, [loadPersonalCv]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const previewInfo = useMemo(() => {
    const today = new Date();
    const targetIdx = 7 + previewDayOffset;
    const date = getCalendarDayDate(today, targetIdx);
    const { dayOfWeek, weekNumber } = getBsuirWeekInfo(date);
    const fullDay = FULL_DAY_NAMES[dayOfWeek] ?? 'День';
    const shortDay = SHORT_DAY_NAMES[dayOfWeek] ?? 'Дн';

    let subtitle: string;
    if (previewDayOffset === 0) {
      subtitle = `${weekNumber} учебная неделя • Сегодня, ${fullDay}`;
    } else if (previewDayOffset === 1) {
      subtitle = `${weekNumber} учебная неделя • Завтра, ${fullDay}`;
    } else if (previewDayOffset === -1) {
      subtitle = `${weekNumber} учебная неделя • Вчера, ${fullDay}`;
    } else {
      subtitle = `${weekNumber} нед. • ${shortDay}, ${formatDateShortDDMM(date)}`;
    }

    const dayLessons = filterLessons(
      lessons,
      dayOfWeek,
      weekNumber,
      subgroup,
    ).slice(0, 4);

    return { subtitle, dayLessons };
  }, [lessons, previewDayOffset, subgroup]);

  const greenColor = isDarkTheme ? '#4CC38A' : '#16A34A';
  const blueColor = isDarkTheme ? '#52A9FF' : '#2563EB';
  const redColor = isDarkTheme ? '#E5484D' : '#DC2626';

  const cv = personalCv.data;
  const icalUrl = getIcalScheduleUrl();

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // fallback silently in restricted environments
    }
    triggerHaptic('selection');
    setToastMsg(label);
  };

  const openIcalLink = () => {
    const tg = getTelegramWebApp() as
      | (ReturnType<typeof getTelegramWebApp> & { openLink?: (u: string) => void })
      | null;
    if (tg?.openLink) {
      tg.openLink(icalUrl);
    } else {
      window.open(icalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSaveBio = async () => {
    await updatePersonalCvSection('summary', { summary: draftBio.trim() });
    setBioModalOpen(false);
    triggerHaptic('notification', 'success');
    setToastMsg('Раздел «О себе» обновлён');
  };

  const handleAddSkill = async () => {
    const clean = newSkillName.trim();
    if (!clean || !cv) return;
    const nextSkills = [...cv.skills, { name: clean }];
    await updatePersonalCvSkills(nextSkills);
    setNewSkillName('');
    setSkillModalOpen(false);
    triggerHaptic('notification', 'success');
  };

  const handleDeleteSkill = async (idxToRemove: number) => {
    if (!cv) return;
    const nextSkills = cv.skills.filter((_, idx) => idx !== idxToRemove);
    await updatePersonalCvSkills(nextSkills);
    triggerHaptic('selection');
  };

  const handleAddRef = async () => {
    const name = newRefName.trim();
    const reference = newRefUrl.trim();
    if (!name || !reference || !cv) return;
    const nextRefs = [...cv.references, { name, reference }];
    await updatePersonalCvReferences(nextRefs);
    setNewRefName('');
    setNewRefUrl('');
    setRefModalOpen(false);
    triggerHaptic('notification', 'success');
  };

  const handleDeleteRef = async (idxToRemove: number) => {
    if (!cv) return;
    const nextRefs = cv.references.filter((_, idx) => idx !== idxToRemove);
    await updatePersonalCvReferences(nextRefs);
    triggerHaptic('selection');
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
            Резюме и сервисы ИИС
          </h1>
          <p
            className="text-s-13 truncate"
            style={{ color: tokens.textSecondary }}
          >
            Управление анкетой, навыками и виджетом
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('impact', 'light');
            void loadPersonalCv(true);
          }}
          aria-label="Обновить"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
          style={{ color: tokens.accent }}
        >
          <RefreshCw
            size={20}
            className={personalCv.loading ? 'animate-spin' : ''}
          />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8 flex flex-col gap-3.5">
        {toastMsg && (
          <div
            role="status"
            className="rounded-[14px] px-4 py-2.5 text-s-13 font-semibold"
            style={{
              backgroundColor: colorWithAlpha(tokens.accent, 0.16),
              color: tokens.accent,
            }}
          >
            {toastMsg}
          </div>
        )}

        {/* Section 1: Interactive Widget Preview */}
        <AppleCard
          isDarkTheme={isDarkTheme}
          cardBg={tokens.card}
          cardBorder={tokens.border}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-s-16 font-semibold"
              style={{ color: tokens.text }}
            >
              Виджет расписания
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Предыдущий день виджета"
              disabled={previewDayOffset <= -7}
              onClick={() =>
                setPreviewDayOffset((prev) => Math.max(-7, prev - 1))
              }
              className="w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer disabled:opacity-40"
              style={{
                borderColor: tokens.border,
                color: tokens.text,
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={() => setPreviewDayOffset(0)}
              className="flex-1 text-center text-s-13 font-medium cursor-pointer truncate"
              style={{ color: tokens.accent }}
            >
              {previewInfo.subtitle}
            </button>

            <button
              type="button"
              aria-label="Следующий день виджета"
              disabled={previewDayOffset >= 30}
              onClick={() =>
                setPreviewDayOffset((prev) => Math.min(30, prev + 1))
              }
              className="w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer disabled:opacity-40"
              style={{
                borderColor: tokens.border,
                color: tokens.text,
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span
              className="font-semibold leading-none"
              style={{
                fontSize: 'calc(32px * var(--text-scale, 1))',
                color: tokens.text,
              }}
            >
              {effectiveTarget || selectedGroup || '310101'}
            </span>
            <span
              className="text-s-15 font-medium"
              style={{ color: tokens.textSecondary }}
            >
              {subgroup === 0 ? 'Все подгр.' : `${subgroup} подгр.`}
            </span>
          </div>

          <div
            className="h-[0.5px]"
            style={{ backgroundColor: tokens.divider }}
          />

          {previewInfo.dayLessons.length === 0 ? (
            <div className="py-4 text-center">
              <div
                className="font-semibold"
                style={{
                  fontSize: 'calc(20px * var(--text-scale, 1))',
                  color: tokens.text,
                }}
              >
                Отличный день
              </div>
              <div
                className="text-s-15 mt-0.5"
                style={{ color: tokens.textSecondary }}
              >
                Пар не найдено
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {previewInfo.dayLessons.map((l, idx) => {
                const ltUpper = l.lessonType.toUpperCase();
                const typeColor =
                  ltUpper.includes('ЛК')
                    ? greenColor
                    : ltUpper.includes('ПЗ')
                      ? blueColor
                      : ltUpper.includes('ЛР')
                        ? redColor
                        : tokens.accent;

                return (
                  <div
                    key={`${l.startTime}-${l.title}-${idx}`}
                    className="flex items-center gap-3"
                  >
                    <div className="w-[56px] shrink-0 leading-tight">
                      <div
                        className="text-s-16 font-semibold tabular-nums"
                        style={{ color: tokens.text }}
                      >
                        {l.startTime}
                      </div>
                      <div
                        className="text-s-12 tabular-nums"
                        style={{ color: tokens.textSecondary }}
                      >
                        {l.endTime}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {l.lessonType && (
                          <span
                            className="text-s-12 font-bold shrink-0"
                            style={{ color: typeColor }}
                          >
                            {l.lessonType}
                          </span>
                        )}
                        <span
                          className="text-s-14 font-semibold truncate"
                          style={{ color: tokens.text }}
                        >
                          {l.title}
                          {l.subgroup > 0 ? ` (${l.subgroup} п.)` : ''}
                        </span>
                      </div>
                      {l.teacherName && (
                        <div
                          className="text-s-12 truncate"
                          style={{ color: tokens.textSecondary }}
                        >
                          {l.teacherName}
                        </div>
                      )}
                    </div>

                    <span
                      className="text-s-12 font-medium shrink-0"
                      style={{ color: tokens.textSecondary }}
                    >
                      {cleanAuditory(l.auditory, l.title, l.lessonType)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </AppleCard>

        {/* Section 2: Quick Actions */}
        <AppleCard
          isDarkTheme={isDarkTheme}
          cardBg={tokens.card}
          cardBorder={tokens.border}
          className="p-0 overflow-hidden"
        >
          <button
            type="button"
            onClick={() =>
              setToastMsg(
                'В Telegram Mini App закрепите чат или используйте экспорт iCal (.ics)',
              )
            }
            className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 cursor-pointer active:opacity-75"
          >
            <div className="min-w-0">
              <div
                className="text-s-15 font-medium"
                style={{ color: tokens.text }}
              >
                Добавить виджет на главный экран
              </div>
              <div
                className="text-s-12 mt-0.5"
                style={{ color: tokens.accent }}
              >
                Автоматически наследует тему и цвета приложения
              </div>
            </div>
            <Calendar size={18} style={{ color: tokens.accent }} className="shrink-0" />
          </button>

          <div
            className="mx-4 h-[0.5px]"
            style={{ backgroundColor: tokens.divider }}
          />

          <div className="px-4 py-3.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={openIcalLink}
              className="flex-1 min-w-0 text-left cursor-pointer active:opacity-75"
            >
              <div
                className="text-s-15 font-medium"
                style={{ color: tokens.text }}
              >
                Экспорт расписания iCal (.ics)
              </div>
              <div
                className="text-s-12 mt-0.5 truncate"
                style={{ color: tokens.textSecondary }}
              >
                Для системного календаря Android / Apple / Outlook
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                aria-label="Скопировать ссылку iCal"
                onClick={() => {
                  void copyText(icalUrl, 'Ссылка iCal скопирована');
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                style={{ color: tokens.accent }}
              >
                <Copy size={16} />
              </button>
              <button
                type="button"
                aria-label="Открыть ссылку iCal"
                onClick={openIcalLink}
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                style={{ color: tokens.accent }}
              >
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        </AppleCard>

        {personalCv.loading && !cv ? (
          <div className="h-32 flex items-center justify-center">
            <Loader2
              size={26}
              className="animate-spin"
              style={{ color: tokens.accent }}
            />
          </div>
        ) : (
          cv && (
            <>
              {/* Section 3: Privacy & Status */}
              <AppleCard
                isDarkTheme={isDarkTheme}
                cardBg={tokens.card}
                cardBorder={tokens.border}
                className="flex flex-col gap-3"
              >
                <div
                  className="text-s-15 font-semibold"
                  style={{ color: tokens.text }}
                >
                  Приватность и статус резюме
                </div>

                {[
                  {
                    label: 'Профиль опубликован',
                    checked: cv.published,
                    onChange: (val: boolean) =>
                      updatePersonalCvSection('personal-cv-published', {
                        published: val,
                      }),
                  },
                  {
                    label: 'Отображать в рейтинге',
                    checked: cv.showRating,
                    onChange: (val: boolean) =>
                      updatePersonalCvSection('personal-cv-rating', {
                        showRating: val,
                      }),
                  },
                  {
                    label: 'Активно ищу работу / стажировку',
                    checked: cv.searchJob,
                    onChange: (val: boolean) =>
                      updatePersonalCvSection('personal-cv-searching-job', {
                        searchJob: val,
                      }),
                  },
                ].map((sw) => (
                  <label
                    key={sw.label}
                    className="flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <span
                      className="text-s-14"
                      style={{ color: tokens.text }}
                    >
                      {sw.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={sw.checked}
                      aria-label={sw.label}
                      onChange={(e) => {
                        triggerHaptic('selection');
                        void sw.onChange(e.target.checked);
                      }}
                      className="w-5 h-5 accent-[var(--accent)] cursor-pointer"
                    />
                  </label>
                ))}
              </AppleCard>

              {/* Section 4: Bio */}
              <AppleCard
                isDarkTheme={isDarkTheme}
                cardBg={tokens.card}
                cardBorder={tokens.border}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-s-15 font-semibold"
                    style={{ color: tokens.text }}
                  >
                    О себе
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftBio(cv.summary ?? '');
                      setBioModalOpen(true);
                    }}
                    className="text-s-13 font-semibold cursor-pointer"
                    style={{ color: tokens.accent }}
                  >
                    Изменить
                  </button>
                </div>
                <p
                  className="text-s-14 leading-[1.45]"
                  style={{
                    color: cv.summary?.trim()
                      ? tokens.text
                      : tokens.textSecondary,
                  }}
                >
                  {cv.summary?.trim() ||
                    'Расскажите о своих проектах, стеке технологий и интересах'}
                </p>
              </AppleCard>

              {/* Section 5: Skills */}
              <AppleCard
                isDarkTheme={isDarkTheme}
                cardBg={tokens.card}
                cardBorder={tokens.border}
                className="flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-s-15 font-semibold"
                    style={{ color: tokens.text }}
                  >
                    Навыки ({cv.skills.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewSkillName('');
                      setSkillModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-s-13 font-semibold cursor-pointer"
                    style={{ color: tokens.accent }}
                  >
                    <Plus size={14} />
                    <span>Добавить</span>
                  </button>
                </div>

                {cv.skills.length === 0 ? (
                  <p
                    className="text-s-13"
                    style={{ color: tokens.textSecondary }}
                  >
                    Навыки ещё не указаны
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cv.skills.map((skill, idx) => (
                      <div
                        key={`${skill.id}-${skill.name}-${idx}`}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border text-s-13 font-medium"
                        style={{
                          backgroundColor: tokens.cardLesson,
                          borderColor: tokens.border,
                          color: tokens.text,
                        }}
                      >
                        <span>{skill.name}</span>
                        <button
                          type="button"
                          aria-label={`Удалить навык ${skill.name}`}
                          onClick={() => {
                            void handleDeleteSkill(idx);
                          }}
                          className="opacity-70 hover:opacity-100 cursor-pointer"
                          style={{ color: tokens.textSecondary }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </AppleCard>

              {/* Section 6: Links */}
              <AppleCard
                isDarkTheme={isDarkTheme}
                cardBg={tokens.card}
                cardBorder={tokens.border}
                className="flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-s-15 font-semibold"
                    style={{ color: tokens.text }}
                  >
                    Ссылки и контакты
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewRefName('');
                      setNewRefUrl('');
                      setRefModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-s-13 font-semibold cursor-pointer"
                    style={{ color: tokens.accent }}
                  >
                    <Plus size={14} />
                    <span>Добавить</span>
                  </button>
                </div>

                {cv.references.length === 0 ? (
                  <p
                    className="text-s-13"
                    style={{ color: tokens.textSecondary }}
                  >
                    Добавьте GitHub, Telegram или LinkedIn
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {cv.references.map((refItem, idx) => (
                      <div
                        key={`${refItem.id}-${refItem.name}-${idx}`}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-[12px] border"
                        style={{
                          backgroundColor: tokens.cardLesson,
                          borderColor: tokens.divider,
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div
                            className="text-s-14 font-semibold"
                            style={{ color: tokens.text }}
                          >
                            {refItem.name}
                          </div>
                          <div
                            className="text-s-12 truncate"
                            style={{ color: tokens.accent }}
                          >
                            {refItem.reference}
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={`Удалить ссылку ${refItem.name}`}
                          onClick={() => {
                            void handleDeleteRef(idx);
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0"
                          style={{ color: redColor }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </AppleCard>

              {/* Section 7: Corporate Account */}
              {(cv.officeEmail || cv.officePassword) && (
                <AppleCard
                  isDarkTheme={isDarkTheme}
                  cardBg={tokens.card}
                  cardBorder={tokens.border}
                  className="flex flex-col gap-2"
                >
                  <div
                    className="text-s-15 font-semibold"
                    style={{ color: tokens.text }}
                  >
                    Корпоративный аккаунт БГУИР (Outlook)
                  </div>

                  {cv.officeEmail && (
                    <button
                      type="button"
                      onClick={() => {
                        void copyText(cv.officeEmail!, 'Логин скопирован');
                      }}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-[12px] border text-left cursor-pointer active:opacity-75"
                      style={{
                        backgroundColor: tokens.cardLesson,
                        borderColor: tokens.divider,
                      }}
                    >
                      <span
                        className="text-s-13 truncate"
                        style={{ color: tokens.text }}
                      >
                        Логин: {cv.officeEmail}
                      </span>
                      <Copy
                        size={15}
                        style={{ color: tokens.accent }}
                        className="shrink-0"
                      />
                    </button>
                  )}

                  {cv.officePassword && (
                    <button
                      type="button"
                      onClick={() => {
                        void copyText(cv.officePassword!, 'Пароль скопирован');
                      }}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-[12px] border text-left cursor-pointer active:opacity-75"
                      style={{
                        backgroundColor: tokens.cardLesson,
                        borderColor: tokens.divider,
                      }}
                    >
                      <span
                        className="text-s-13 truncate"
                        style={{ color: tokens.text }}
                      >
                        Пароль: {cv.officePassword}
                      </span>
                      <Copy
                        size={15}
                        style={{ color: tokens.accent }}
                        className="shrink-0"
                      />
                    </button>
                  )}
                </AppleCard>
              )}
            </>
          )
        )}
      </div>

      {/* Bio Edit Modal */}
      {bioModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Редактировать О себе"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setBioModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[22px] border p-5 flex flex-col gap-3.5"
            style={{ backgroundColor: tokens.card, borderColor: tokens.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-s-18 font-bold" style={{ color: tokens.text }}>
              О себе
            </h2>
            <textarea
              value={draftBio}
              onChange={(e) => setDraftBio(e.target.value)}
              rows={4}
              className="w-full min-h-[100px] rounded-[12px] border p-3 text-s-14 outline-none resize-none"
              style={{
                backgroundColor: tokens.cardLesson,
                borderColor: tokens.border,
                color: tokens.text,
              }}
            />
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setBioModalOpen(false)}
                className="flex-1 h-[44px] rounded-full border text-s-15 font-semibold cursor-pointer"
                style={{ borderColor: tokens.border, color: tokens.text }}
              >
                Отмена
              </button>
              <AppleButtonPrimary
                isDarkTheme={isDarkTheme}
                accentColor={tokens.accent}
                onClick={() => {
                  void handleSaveBio();
                }}
                className="flex-1"
              >
                Сохранить
              </AppleButtonPrimary>
            </div>
          </div>
        </div>
      )}

      {/* Add Skill Modal */}
      {skillModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Новый навык"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSkillModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[22px] border p-5 flex flex-col gap-3.5"
            style={{ backgroundColor: tokens.card, borderColor: tokens.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-s-18 font-bold" style={{ color: tokens.text }}>
              Новый навык
            </h2>
            <input
              type="text"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              placeholder="Например: Kotlin, Python, Docker"
              className="w-full rounded-[12px] border px-3.5 py-2.5 text-s-14 outline-none"
              style={{
                backgroundColor: tokens.cardLesson,
                borderColor: tokens.border,
                color: tokens.text,
              }}
            />
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSkillModalOpen(false)}
                className="flex-1 h-[44px] rounded-full border text-s-15 font-semibold cursor-pointer"
                style={{ borderColor: tokens.border, color: tokens.text }}
              >
                Отмена
              </button>
              <AppleButtonPrimary
                isDarkTheme={isDarkTheme}
                accentColor={tokens.accent}
                disabled={!newSkillName.trim()}
                onClick={() => {
                  void handleAddSkill();
                }}
                className="flex-1"
              >
                Добавить
              </AppleButtonPrimary>
            </div>
          </div>
        </div>
      )}

      {/* Add Link Modal */}
      {refModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Новая ссылка"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setRefModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[22px] border p-5 flex flex-col gap-3.5"
            style={{ backgroundColor: tokens.card, borderColor: tokens.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-s-18 font-bold" style={{ color: tokens.text }}>
              Новая ссылка
            </h2>
            <input
              type="text"
              value={newRefName}
              onChange={(e) => setNewRefName(e.target.value)}
              placeholder="Название (GitHub, Telegram...)"
              className="w-full rounded-[12px] border px-3.5 py-2.5 text-s-14 outline-none"
              style={{
                backgroundColor: tokens.cardLesson,
                borderColor: tokens.border,
                color: tokens.text,
              }}
            />
            <input
              type="text"
              value={newRefUrl}
              onChange={(e) => setNewRefUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-[12px] border px-3.5 py-2.5 text-s-14 outline-none"
              style={{
                backgroundColor: tokens.cardLesson,
                borderColor: tokens.border,
                color: tokens.text,
              }}
            />
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setRefModalOpen(false)}
                className="flex-1 h-[44px] rounded-full border text-s-15 font-semibold cursor-pointer"
                style={{ borderColor: tokens.border, color: tokens.text }}
              >
                Отмена
              </button>
              <AppleButtonPrimary
                isDarkTheme={isDarkTheme}
                accentColor={tokens.accent}
                disabled={!newRefName.trim() || !newRefUrl.trim()}
                onClick={() => {
                  void handleAddRef();
                }}
                className="flex-1"
              >
                Добавить
              </AppleButtonPrimary>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
