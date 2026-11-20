import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Calendar,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  LayoutList,
  Paperclip,
  Pin,
  Plus,
  SearchX,
  Trash2,
  X,
} from 'lucide-react';
import type { Note, NoteAttachment } from '../types';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { pushBackHandler, triggerHaptic } from '../services/telegram';
import { formatDateDDMMYYYY, formatFileSize } from '../utils/formatters';
import {
  buildCalendarCarousel,
  findNextLessonForSubject,
  inferNoteLessonType,
  parseNoteDateMillis,
} from '../utils/scheduleMath';
import { ApplePullToRefresh } from '../components/ui/ApplePullToRefresh';
import { AppleSearchInput } from '../components/ui/AppleSearchInput';
import { IosDatePickerModal } from '../components/ui/IosDatePickerModal';
import { IosTimePickerModal } from '../components/ui/IosTimePickerModal';
import { colorWithAlpha } from '../components/ui/LiquidGlassSurface';

const SPECIAL_ALL = 'Все';
const SPECIAL_PINNED = 'Закрепленные';
const SPECIAL_EVENTS = 'События';

const TYPE_FILTERS = ['Все', 'ЛР', 'ЛК', 'ПЗ'] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const TYPE_COLORS: Record<string, string> = {
  ЛР: '#34C759',
  ЛК: '#007AFF',
  ПЗ: '#FF9500',
};

function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} ${many}`;
  if (mod10 === 1) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

function parseDDMMYYYYParts(dateStr: string): { day: number; month: number; year: number } {
  const m = dateStr.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const day = Number.parseInt(m[1], 10);
    const month = Number.parseInt(m[2], 10);
    const year = Number.parseInt(m[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, year };
    }
  }
  const now = new Date();
  return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
}

function parseHHMMParts(timeStr?: string | null): { hour: number; minute: number } {
  const m = (timeStr ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    return {
      hour: Math.max(0, Math.min(23, Number.parseInt(m[1], 10))),
      minute: Math.max(0, Math.min(59, Number.parseInt(m[2], 10))),
    };
  }
  return { hour: 9, minute: 0 };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getAttachmentBadge(att: NoteAttachment): { color: string; kind: 'image' | 'pdf' | 'doc' | 'other' } {
  const mime = att.mimeType.toLowerCase();
  const name = att.name.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) {
    return { color: '#30B0C7', kind: 'image' };
  }
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    return { color: '#FF453A', kind: 'pdf' };
  }
  if (/\.(doc|docx|txt|md|rtf)$/.test(name)) {
    return { color: '#007AFF', kind: 'doc' };
  }
  return { color: '#FF9F0A', kind: 'other' };
}

function readFilesAsAttachments(fileList: FileList): Promise<NoteAttachment[]> {
  const files = Array.from(fileList);
  return Promise.all(
    files.map(
      (file, idx) =>
        new Promise<NoteAttachment>((resolve) => {
          const id = `att_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
          if (typeof FileReader !== 'undefined') {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id,
                uri: typeof reader.result === 'string' ? reader.result : '',
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                sizeBytes: file.size,
              });
            };
            reader.onerror = () => {
              resolve({
                id,
                uri: '',
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                sizeBytes: file.size,
              });
            };
            reader.readAsDataURL(file);
          } else {
            resolve({
              id,
              uri: '',
              name: file.name,
              mimeType: file.type || 'application/octet-stream',
              sizeBytes: file.size,
            });
          }
        }),
    ),
  );
}

interface NoteCardItemProps {
  note: Note;
  isGrid: boolean;
  isDarkTheme: boolean;
  tokens: ReturnType<typeof useTheme>['tokens'];
  onOpenEdit: (note: Note) => void;
  onRequestDelete: (note: Note) => void;
}

const NoteCardItem: React.FC<NoteCardItemProps> = ({
  note,
  isGrid,
  isDarkTheme,
  tokens,
  onOpenEdit,
  onRequestDelete,
}) => {
  const longTimerRef = useRef<number | null>(null);
  const latchResetTimerRef = useRef<number | null>(null);
  const longTriggeredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongTimer = () => {
    if (longTimerRef.current !== null) {
      window.clearTimeout(longTimerRef.current);
      longTimerRef.current = null;
    }
    startPosRef.current = null;
  };

  const clearLatchResetTimer = () => {
    if (latchResetTimerRef.current !== null) {
      window.clearTimeout(latchResetTimerRef.current);
      latchResetTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearLongTimer();
      clearLatchResetTimer();
    };
  }, []);

  const lines = note.text.split(/\r?\n/);
  const titleLine = lines[0]?.trim() || 'Без названия';
  const bodyLines = lines.slice(1).join('\n').trim();
  const inferredType = inferNoteLessonType(note);
  const dotColor = note.isEvent
    ? '#FFB800'
    : note.isPinned
      ? '#FF9500'
      : tokens.accent;

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={(e) => {
        longTriggeredRef.current = false;
        clearLongTimer();
        clearLatchResetTimer();
        startPosRef.current = { x: e.clientX, y: e.clientY };
        longTimerRef.current = window.setTimeout(() => {
          longTimerRef.current = null;
          longTriggeredRef.current = true;
          clearLatchResetTimer();
          latchResetTimerRef.current = window.setTimeout(() => {
            longTriggeredRef.current = false;
            latchResetTimerRef.current = null;
          }, 400);
          triggerHaptic('impact', 'medium');
          onRequestDelete(note);
        }, 450);
      }}
      onPointerMove={(e) => {
        if (!startPosRef.current) return;
        const dx = Math.abs(e.clientX - startPosRef.current.x);
        const dy = Math.abs(e.clientY - startPosRef.current.y);
        if (dx > 10 || dy > 10) {
          clearLongTimer();
        }
      }}
      onPointerUp={clearLongTimer}
      onPointerCancel={clearLongTimer}
      onPointerLeave={clearLongTimer}
      onClick={() => {
        if (longTriggeredRef.current) {
          longTriggeredRef.current = false;
          clearLatchResetTimer();
          return;
        }
        triggerHaptic('impact', 'light');
        onOpenEdit(note);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenEdit(note);
        }
      }}
      className={
        isGrid
          ? 'rounded-[18px] p-[14px] border flex flex-col justify-between gap-[8px] cursor-pointer select-none'
          : 'py-[12px] px-[4px] flex flex-col gap-[6px] cursor-pointer select-none'
      }
      style={
        isGrid
          ? { backgroundColor: tokens.card, borderColor: tokens.border }
          : { borderBottom: `1px solid ${tokens.divider}` }
      }
    >
      {/* Meta row */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-[6px] min-w-0 flex-wrap">
          <span
            className="w-[8px] h-[8px] rounded-full shrink-0"
            style={{ backgroundColor: dotColor }}
          />
          <span
            className="text-s-12 font-semibold truncate"
            style={{ color: tokens.textSecondary }}
          >
            {note.subject}
          </span>
          {inferredType && (
            <span
              className="rounded-[5px] px-[6px] py-[2px] text-s-10_5 font-bold leading-none"
              style={{
                backgroundColor: colorWithAlpha(
                  TYPE_COLORS[inferredType] ?? tokens.accent,
                  isDarkTheme ? 0.22 : 0.14,
                ),
                color: TYPE_COLORS[inferredType] ?? tokens.accent,
              }}
            >
              {inferredType}
            </span>
          )}
          <span className="text-s-11 tabular-nums" style={{ color: tokens.textSecondary }}>
            · {note.date}
            {note.time ? ` ${note.time}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {note.isPinned && <Pin size={12} style={{ color: '#FF9500' }} aria-label="Закреплено" />}
          {note.isEvent && <Bell size={12} style={{ color: '#FFB800' }} aria-label="Событие" />}
          {note.attachments.length > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-s-11"
              style={{ color: tokens.textSecondary }}
            >
              <Paperclip size={11} aria-hidden="true" />
              <span>{note.attachments.length}</span>
            </span>
          )}
          <button
            type="button"
            aria-label={`Удалить заметку ${titleLine}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('impact', 'light');
              onRequestDelete(note);
            }}
            className="w-[24px] h-[24px] rounded-full flex items-center justify-center bg-transparent border-0 cursor-pointer opacity-60 hover:opacity-100"
            style={{ color: tokens.textSecondary }}
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Title & Body */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className="font-semibold leading-[1.25] truncate"
          style={{ fontSize: 'calc(17px * var(--text-scale, 1))', color: tokens.text }}
        >
          {titleLine}
        </span>
        {bodyLines && (
          <span
            className="text-s-14 leading-[1.35] line-clamp-2 whitespace-pre-line"
            style={{ color: tokens.textSecondary }}
          >
            {bodyLines}
          </span>
        )}
      </div>
    </div>
  );
};

export function NotesScreen(props: { initialSubject?: string }): React.JSX.Element {
  const { initialSubject } = props;
  const {
    notes,
    availableSubjects,
    lessons,
    subgroup,
    addNote,
    updateNote,
    deleteNote,
  } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  const [isGridView, setIsGridView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>(
    initialSubject?.trim() || SPECIAL_ALL,
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<TypeFilter>('Все');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubject, setCreateSubject] = useState('Общее');
  const [createText, setCreateText] = useState('');
  const [createDate, setCreateDate] = useState(() => formatDateDDMMYYYY(new Date()));
  const [createTime, setCreateTime] = useState<string>('09:00');
  const [createType, setCreateType] = useState<string>('');
  const [createPinned, setCreatePinned] = useState(false);
  const [createIsEvent, setCreateIsEvent] = useState(false);
  const [createAttachments, setCreateAttachments] = useState<NoteAttachment[]>([]);

  // Edit modal state
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editSubject, setEditSubject] = useState('Общее');
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState<string>('09:00');
  const [editType, setEditType] = useState<string>('');
  const [editPinned, setEditPinned] = useState(false);
  const [editIsEvent, setEditIsEvent] = useState(false);
  const [editAttachments, setEditAttachments] = useState<NoteAttachment[]>([]);

  // Delete confirm modal
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);

  // Date & Time pickers
  const [pickerTarget, setPickerTarget] = useState<'create' | 'edit' | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const savingLockRef = useRef(false);

  const createFileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialSubject?.trim()) {
      setSelectedSubjectFilter(initialSubject.trim());
    }
  }, [initialSubject]);

  useEffect(() => {
    if (timePickerOpen) {
      return pushBackHandler(() => setTimePickerOpen(false));
    }
    if (datePickerOpen) {
      return pushBackHandler(() => setDatePickerOpen(false));
    }
    if (deletingNote) {
      return pushBackHandler(() => setDeletingNote(null));
    }
    if (editingNote) {
      return pushBackHandler(() => setEditingNote(null));
    }
    if (createOpen) {
      return pushBackHandler(() => setCreateOpen(false));
    }
    return undefined;
  }, [timePickerOpen, datePickerOpen, deletingNote, editingNote, createOpen]);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>(availableSubjects);
    for (const n of notes) {
      if (n.subject && n.subject.trim()) {
        set.add(n.subject);
      }
    }
    set.add('Общее');
    return Array.from(set);
  }, [availableSubjects, notes]);

  const pinnedCount = useMemo(() => notes.filter((n) => n.isPinned).length, [notes]);
  const eventsCount = useMemo(() => notes.filter((n) => n.isEvent).length, [notes]);

  const subjectMatchedNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes.filter((n) => {
      if (selectedSubjectFilter === SPECIAL_PINNED && !n.isPinned) return false;
      if (selectedSubjectFilter === SPECIAL_EVENTS && !n.isEvent) return false;
      if (
        selectedSubjectFilter !== SPECIAL_ALL &&
        selectedSubjectFilter !== SPECIAL_PINNED &&
        selectedSubjectFilter !== SPECIAL_EVENTS &&
        n.subject !== selectedSubjectFilter
      ) {
        return false;
      }
      if (q) {
        const inferred = inferNoteLessonType(n).toLowerCase();
        const hay = `${n.text} ${n.subject} ${n.date} ${inferred}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notes, selectedSubjectFilter, searchQuery]);

  const typeCounts = useMemo(() => {
    const counts: Record<'ЛР' | 'ЛК' | 'ПЗ', number> = { ЛР: 0, ЛК: 0, ПЗ: 0 };
    for (const n of subjectMatchedNotes) {
      const t = inferNoteLessonType(n);
      if (t === 'ЛР' || t === 'ЛК' || t === 'ПЗ') {
        counts[t] += 1;
      }
    }
    return counts;
  }, [subjectMatchedNotes]);

  const filteredNotes = useMemo(() => {
    const list =
      selectedTypeFilter === 'Все'
        ? subjectMatchedNotes
        : subjectMatchedNotes.filter((n) => inferNoteLessonType(n) === selectedTypeFilter);

    return [...list].sort((a, b) => parseNoteDateMillis(a.date) - parseNoteDateMillis(b.date));
  }, [subjectMatchedNotes, selectedTypeFilter]);

  const pinnedNotes = useMemo(() => filteredNotes.filter((n) => n.isPinned), [filteredNotes]);
  const regularNotes = useMemo(() => filteredNotes.filter((n) => !n.isPinned), [filteredNotes]);

  const highlightedDates = useMemo(() => {
    const activeSubject = pickerTarget === 'edit' ? editSubject : createSubject;
    const targetLower = activeSubject.trim().toLowerCase();
    const set = new Set<string>();
    if (!targetLower || targetLower === 'общее') return set;
    const matching = lessons.filter((l) => l.title.trim().toLowerCase() === targetLower);
    if (matching.length === 0) return set;
    const carousel = buildCalendarCarousel(new Date(), 91, 7);
    for (const day of carousel) {
      const hasClass = matching.some(
        (l) =>
          l.dayOfWeek === day.dayOfWeek &&
          (l.weeks.length === 0 || l.weeks.includes(day.weekNumber)),
      );
      if (hasClass) set.add(day.dateFormatted);
    }
    return set;
  }, [lessons, pickerTarget, createSubject, editSubject]);

  const selectedDropdownLabel = useMemo(() => {
    if (selectedSubjectFilter === SPECIAL_ALL) return `Все предметы (${notes.length})`;
    if (selectedSubjectFilter === SPECIAL_PINNED) return `Закрепленные (${pinnedCount})`;
    if (selectedSubjectFilter === SPECIAL_EVENTS) return `События (${eventsCount})`;
    return selectedSubjectFilter;
  }, [selectedSubjectFilter, notes.length, pinnedCount, eventsCount]);

  const openCreateModal = () => {
    triggerHaptic('impact', 'light');
    const defaultSubj =
      selectedSubjectFilter !== SPECIAL_ALL &&
      selectedSubjectFilter !== SPECIAL_PINNED &&
      selectedSubjectFilter !== SPECIAL_EVENTS
        ? selectedSubjectFilter
        : subjectOptions[0] ?? 'Общее';
    const next = findNextLessonForSubject(lessons, defaultSubj, new Date(), { subgroup });
    setCreateSubject(defaultSubj);
    setCreateText('');
    setCreateDate(next ? next.dateFormatted : formatDateDDMMYYYY(new Date()));
    setCreateTime(next ? next.timeFormatted : '09:00');
    setCreateType(next ? inferNoteLessonType({ lessonType: next.lessonType, text: '' }) : '');
    setCreatePinned(false);
    setCreateIsEvent(false);
    setCreateAttachments([]);
    setCreateOpen(true);
  };

  const openEditModal = (note: Note) => {
    setEditingNote(note);
    setEditSubject(note.subject || 'Общее');
    setEditText(note.text);
    setEditDate(note.date || formatDateDDMMYYYY(new Date()));
    setEditTime(note.time || '09:00');
    setEditType(note.lessonType || '');
    setEditPinned(note.isPinned);
    setEditIsEvent(note.isEvent);
    setEditAttachments(note.attachments ?? []);
  };

  const createNextLesson = useMemo(
    () => findNextLessonForSubject(lessons, createSubject, new Date(), { subgroup }),
    [lessons, createSubject, subgroup],
  );

  const editNextLesson = useMemo(
    () => findNextLessonForSubject(lessons, editSubject, new Date(), { subgroup }),
    [lessons, editSubject, subgroup],
  );

  const handleCreateSave = async () => {
    if ((!createText.trim() && createAttachments.length === 0) || savingLockRef.current) {
      return;
    }
    savingLockRef.current = true;
    setIsSaving(true);
    try {
      await addNote({
        subject: createSubject,
        text: createText.trim(),
        date: createDate,
        time: createTime || null,
        isEvent: createIsEvent,
        isPinned: createPinned,
        lessonType: createType,
        attachments: createAttachments,
      });
      triggerHaptic('notification', 'success');
      setCreateOpen(false);
    } finally {
      savingLockRef.current = false;
      setIsSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (
      !editingNote ||
      (!editText.trim() && editAttachments.length === 0) ||
      savingLockRef.current
    ) {
      return;
    }
    savingLockRef.current = true;
    setIsSaving(true);
    try {
      await updateNote(editingNote.id, {
        subject: editSubject,
        text: editText.trim(),
        date: editDate,
        time: editTime || null,
        lessonType: editType,
        isPinned: editPinned,
        isEvent: editIsEvent,
        attachments: editAttachments,
      });
      triggerHaptic('notification', 'success');
      setEditingNote(null);
    } finally {
      savingLockRef.current = false;
      setIsSaving(false);
    }
  };

  const handleAttachmentPreview = (att: NoteAttachment) => {
    if (!att.uri) return;
    const link = document.createElement('a');
    link.href = att.uri;
    link.download = att.name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const activeDateStr = pickerTarget === 'edit' ? editDate : createDate;
  const activeDateParts = parseDDMMYYYYParts(activeDateStr);
  const activeTimeParts = parseHHMMParts(pickerTarget === 'edit' ? editTime : createTime);

  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    selectedSubjectFilter !== SPECIAL_ALL ||
    selectedTypeFilter !== 'Все';

  const subtitleCount = `${pluralizeRu(notes.length, 'заметка', 'заметки', 'заметок')}${
    eventsCount > 0 ? ` • ${pluralizeRu(eventsCount, 'событие', 'события', 'событий')}` : ''
  }`;

  return (
    <div className="h-full w-full relative overflow-hidden" style={{ color: tokens.text }}>
      <ApplePullToRefresh
        isRefreshing={isRefreshing}
        onRefresh={() => {
          setIsRefreshing(true);
          window.setTimeout(() => setIsRefreshing(false), 350);
        }}
        accentColor={tokens.accent}
        className="h-full overflow-y-auto"
      >
        <div className="px-[20px] pt-[36px] pb-[96px] flex flex-col gap-[16px]">
          {/* Title Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <h1
                className="font-semibold leading-[1.1]"
                style={{ fontSize: 'calc(32px * var(--text-scale, 1))', color: tokens.text }}
              >
                Заметки
              </h1>
              <span
                className="text-s-14 font-semibold mt-1"
                style={{ color: tokens.textSecondary }}
              >
                {subtitleCount}
              </span>
            </div>

            <button
              type="button"
              aria-label="Вид"
              onClick={() => {
                triggerHaptic('selection');
                setIsGridView((prev) => !prev);
              }}
              className="w-[42px] h-[42px] rounded-full border flex items-center justify-center shrink-0 cursor-pointer"
              style={{
                backgroundColor: tokens.card,
                borderColor: tokens.border,
                color: isGridView ? tokens.accent : tokens.text,
              }}
            >
              {isGridView ? (
                <LayoutGrid size={19} aria-hidden="true" />
              ) : (
                <LayoutList size={19} aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Search Bar */}
          <AppleSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Поиск"
            isDarkTheme={isDarkTheme}
            inputBg={tokens.card}
            inputBorder={tokens.border}
            inputTextColor={tokens.text}
            inputIconColor={tokens.textSecondary}
          />

          {/* Subject Dropdown */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={dropdownOpen}
              onClick={() => {
                triggerHaptic('selection');
                setDropdownOpen((prev) => !prev);
              }}
              className="w-full rounded-[14px] px-[16px] py-[13px] border flex items-center justify-between gap-2 cursor-pointer"
              style={{
                backgroundColor: tokens.card,
                borderColor: dropdownOpen ? tokens.accent : tokens.border,
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-s-14 font-medium shrink-0" style={{ color: tokens.textSecondary }}>
                  Предмет:
                </span>
                <span className="text-s-14 font-semibold truncate" style={{ color: tokens.text }}>
                  {selectedDropdownLabel}
                </span>
              </div>
              {dropdownOpen ? (
                <ChevronUp size={18} style={{ color: tokens.textSecondary }} aria-hidden="true" />
              ) : (
                <ChevronDown size={18} style={{ color: tokens.textSecondary }} aria-hidden="true" />
              )}
            </button>

            {dropdownOpen && (
              <div
                role="listbox"
                aria-label="Фильтр по предмету"
                className="mt-2 rounded-[16px] p-1.5 border shadow-xl flex flex-col gap-0.5 max-h-[240px] overflow-y-auto"
                style={{
                  backgroundColor: tokens.card,
                  borderColor: tokens.border,
                }}
              >
                {[
                  { key: SPECIAL_ALL, label: `Все предметы (${notes.length})` },
                  ...(pinnedCount > 0
                    ? [{ key: SPECIAL_PINNED, label: `Закрепленные (${pinnedCount})` }]
                    : []),
                  ...(eventsCount > 0
                    ? [{ key: SPECIAL_EVENTS, label: `События (${eventsCount})` }]
                    : []),
                  ...subjectOptions.map((s) => ({ key: s, label: s })),
                ].map((opt) => {
                  const isActive = selectedSubjectFilter === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        triggerHaptic('selection');
                        setSelectedSubjectFilter(opt.key);
                        setDropdownOpen(false);
                      }}
                      className="w-full rounded-[11px] px-3 py-2.5 flex items-center justify-between gap-2 border-0 cursor-pointer text-left"
                      style={{
                        backgroundColor: isActive ? colorWithAlpha(tokens.accent, 0.14) : 'transparent',
                        color: isActive ? tokens.accent : tokens.text,
                      }}
                    >
                      <span className="text-s-14 font-medium truncate">{opt.label}</span>
                      {isActive && <Check size={16} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lesson Type Filter Row */}
          <div className="grid grid-cols-4 gap-[8px]">
            {TYPE_FILTERS.map((type) => {
              const isSelected = selectedTypeFilter === type;
              const typeColor = type === 'Все' ? tokens.accent : TYPE_COLORS[type];
              const count = type === 'Все' ? 0 : typeCounts[type];
              const label = type !== 'Все' && count > 0 ? `${type} (${count})` : type;

              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    triggerHaptic('selection');
                    setSelectedTypeFilter(type);
                  }}
                  className="h-[38px] rounded-[12px] border text-s-13 font-semibold flex items-center justify-center cursor-pointer transition-colors"
                  style={{
                    backgroundColor: isSelected
                      ? colorWithAlpha(typeColor, isDarkTheme ? 0.22 : 0.16)
                      : tokens.card,
                    borderColor: isSelected ? colorWithAlpha(typeColor, 0.6) : tokens.border,
                    color: isSelected ? typeColor : tokens.text,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Notes List / Grid / Empty */}
          {filteredNotes.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-center gap-2">
              <div
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center mb-1"
                style={{
                  backgroundColor: colorWithAlpha(tokens.accent, 0.12),
                  color: tokens.accent,
                }}
              >
                {hasActiveFilter ? (
                  <SearchX size={30} aria-hidden="true" />
                ) : (
                  <Edit3 size={30} aria-hidden="true" />
                )}
              </div>
              <span className="text-s-18 font-semibold" style={{ color: tokens.text }}>
                {hasActiveFilter ? 'Ничего не найдено' : 'Нет заметок'}
              </span>
              <span className="text-s-14 max-w-[260px]" style={{ color: tokens.textSecondary }}>
                {hasActiveFilter
                  ? 'Попробуйте изменить поисковый запрос'
                  : 'Нажмите «+», чтобы создать первую заметку'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-[16px]">
              {pinnedNotes.length > 0 && (
                <div className="flex flex-col gap-[8px]">
                  {regularNotes.length > 0 && (
                    <h2
                      className="text-s-13 font-bold uppercase tracking-[0.5px] px-1"
                      style={{ color: '#FF9500' }}
                    >
                      Закреплённые
                    </h2>
                  )}
                  <div className={isGridView ? 'grid grid-cols-2 gap-[12px]' : 'flex flex-col'}>
                    {pinnedNotes.map((note) => (
                      <NoteCardItem
                        key={note.id}
                        note={note}
                        isGrid={isGridView}
                        isDarkTheme={isDarkTheme}
                        tokens={tokens}
                        onOpenEdit={openEditModal}
                        onRequestDelete={setDeletingNote}
                      />
                    ))}
                  </div>
                </div>
              )}

              {regularNotes.length > 0 && (
                <div className="flex flex-col gap-[8px]">
                  {pinnedNotes.length > 0 && (
                    <h2
                      className="text-s-13 font-bold uppercase tracking-[0.5px] px-1"
                      style={{ color: tokens.textSecondary }}
                    >
                      Заметки
                    </h2>
                  )}
                  <div className={isGridView ? 'grid grid-cols-2 gap-[12px]' : 'flex flex-col'}>
                    {regularNotes.map((note) => (
                      <NoteCardItem
                        key={note.id}
                        note={note}
                        isGrid={isGridView}
                        isDarkTheme={isDarkTheme}
                        tokens={tokens}
                        onOpenEdit={openEditModal}
                        onRequestDelete={setDeletingNote}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ApplePullToRefresh>

      {/* FAB (+) */}
      <button
        type="button"
        aria-label="Создать заметку"
        onClick={openCreateModal}
        className="absolute bottom-[20px] right-[20px] z-30 w-[56px] h-[56px] rounded-full shadow-lg flex items-center justify-center border-0 cursor-pointer"
        style={{
          backgroundColor: tokens.accent,
          color: tokens.accentFg,
        }}
      >
        <Plus size={26} aria-hidden="true" />
      </button>

      {/* 1. Create Note Bottom Sheet */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Новая заметка"
          onClick={() => setCreateOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[460px] max-h-[88vh] overflow-y-auto rounded-t-[28px] p-5 border-t shadow-2xl flex flex-col gap-3.5"
            style={{
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              color: tokens.text,
            }}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full mx-auto opacity-30 bg-current" />

            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="text-s-15 font-medium bg-transparent border-0 cursor-pointer p-1"
                style={{ color: tokens.textSecondary }}
              >
                Отмена
              </button>
              <span className="text-s-16 font-bold" style={{ color: tokens.text }}>
                Новая заметка
              </span>
              <button
                type="button"
                disabled={isSaving || (!createText.trim() && createAttachments.length === 0)}
                onClick={() => void handleCreateSave()}
                className="text-s-15 font-semibold bg-transparent border-0 cursor-pointer p-1 disabled:opacity-40"
                style={{ color: tokens.accent }}
              >
                Готово
              </button>
            </div>

            {/* Editor */}
            <textarea
              value={createText}
              onChange={(e) => setCreateText(e.target.value)}
              placeholder="Заметка"
              rows={4}
              className="w-full min-h-[100px] bg-transparent outline-none resize-none text-s-18"
              style={{ color: tokens.text }}
            />

            {/* Subject Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {subjectOptions.map((subj) => {
                const active = createSubject === subj;
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setCreateSubject(subj);
                    }}
                    className="rounded-full px-3 py-1.5 text-s-13 font-semibold border whitespace-nowrap cursor-pointer shrink-0"
                    style={{
                      backgroundColor: active ? colorWithAlpha(tokens.accent, 0.16) : 'transparent',
                      borderColor: active ? tokens.accent : tokens.border,
                      color: active ? tokens.accent : tokens.textSecondary,
                    }}
                  >
                    {subj}
                  </button>
                );
              })}
            </div>

            {/* Date / Time / Next Lesson */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPickerTarget('create');
                  setDatePickerOpen(true);
                }}
                className="rounded-full px-3 py-1.5 text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
                style={{ borderColor: tokens.border, color: tokens.text }}
              >
                <Calendar size={14} style={{ color: tokens.accent }} aria-hidden="true" />
                <span>{createDate}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPickerTarget('create');
                  setTimePickerOpen(true);
                }}
                className="rounded-full px-3 py-1.5 text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
                style={{ borderColor: tokens.border, color: tokens.text }}
              >
                <Clock size={14} style={{ color: tokens.accent }} aria-hidden="true" />
                <span>{createTime}</span>
              </button>

              {createNextLesson && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setCreateDate(createNextLesson.dateFormatted);
                    setCreateTime(createNextLesson.timeFormatted);
                    const inferred = inferNoteLessonType({
                      lessonType: createNextLesson.lessonType,
                      text: '',
                    });
                    if (inferred) setCreateType(inferred);
                  }}
                  className="rounded-full px-3 py-1.5 text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
                  style={{
                    backgroundColor: colorWithAlpha(tokens.accent, 0.12),
                    borderColor: tokens.accent,
                    color: tokens.accent,
                  }}
                >
                  <CalendarCheck size={14} aria-hidden="true" />
                  <span>К след. паре ({createNextLesson.dateFormatted.slice(0, 5)})</span>
                </button>
              )}
            </div>

            {/* Type Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-s-13 font-semibold" style={{ color: tokens.textSecondary }}>
                Тип:
              </span>
              {[
                { key: '', label: 'Обычная' },
                { key: 'ЛР', label: 'ЛР' },
                { key: 'ЛК', label: 'ЛК' },
                { key: 'ПЗ', label: 'ПЗ' },
              ].map((t) => {
                const active = createType === t.key;
                const col = t.key ? TYPE_COLORS[t.key] : tokens.accent;
                return (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setCreateType(t.key)}
                    className="rounded-[10px] px-3 py-1 text-s-13 font-semibold border cursor-pointer"
                    style={{
                      backgroundColor: active ? colorWithAlpha(col, 0.18) : 'transparent',
                      borderColor: active ? col : tokens.border,
                      color: active ? col : tokens.textSecondary,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Action Chips: Pin, Event, File */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={createPinned}
                onClick={() => setCreatePinned((p) => !p)}
                className="rounded-full px-3 py-1.5 text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: createPinned ? 'rgba(255,149,0,0.18)' : 'transparent',
                  borderColor: createPinned ? '#FF9500' : tokens.border,
                  color: createPinned ? '#FF9500' : tokens.textSecondary,
                }}
              >
                <Pin size={14} aria-hidden="true" />
                <span>Закрепить</span>
              </button>

              <button
                type="button"
                aria-pressed={createIsEvent}
                onClick={() => setCreateIsEvent((p) => !p)}
                className="rounded-full px-3 py-1.5 text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: createIsEvent ? 'rgba(255,184,0,0.18)' : 'transparent',
                  borderColor: createIsEvent ? '#FFB800' : tokens.border,
                  color: createIsEvent ? '#FFB800' : tokens.textSecondary,
                }}
              >
                <Bell size={14} aria-hidden="true" />
                <span>Напомнить</span>
              </button>

              <button
                type="button"
                onClick={() => createFileInputRef.current?.click()}
                className="rounded-full px-3 py-1.5 text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
                style={{ borderColor: tokens.border, color: tokens.textSecondary }}
              >
                <Paperclip size={14} aria-hidden="true" />
                <span>
                  {createAttachments.length > 0 ? `Файлы (${createAttachments.length})` : 'Файл'}
                </span>
              </button>
              <input
                ref={createFileInputRef}
                type="file"
                multiple
                aria-label="Прикрепить файлы"
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const added = await readFilesAsAttachments(e.target.files);
                    setCreateAttachments((prev) => [...prev, ...added]);
                    e.target.value = '';
                  }
                }}
              />
            </div>

            {/* Attachment Chips */}
            {createAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {createAttachments.map((att) => {
                  const badge = getAttachmentBadge(att);
                  const sizeLabel = formatFileSize(att.sizeBytes);
                  return (
                    <div
                      key={att.id}
                      className="rounded-[12px] pl-2.5 pr-1.5 py-1.5 border inline-flex items-center gap-1.5 max-w-full"
                      style={{ borderColor: tokens.border }}
                    >
                      <button
                        type="button"
                        onClick={() => handleAttachmentPreview(att)}
                        className="inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer min-w-0"
                        style={{ color: tokens.text }}
                      >
                        {badge.kind === 'image' ? (
                          <ImageIcon size={14} style={{ color: badge.color }} aria-hidden="true" />
                        ) : (
                          <FileText size={14} style={{ color: badge.color }} aria-hidden="true" />
                        )}
                        <span className="text-s-12 font-medium truncate max-w-[160px]">
                          {att.name}
                        </span>
                        {sizeLabel && (
                          <span className="text-s-11" style={{ color: tokens.textSecondary }}>
                            {sizeLabel}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Удалить файл ${att.name}`}
                        onClick={() =>
                          setCreateAttachments((prev) => prev.filter((x) => x.id !== att.id))
                        }
                        className="p-0.5 rounded-full bg-transparent border-0 cursor-pointer"
                        style={{ color: tokens.textSecondary }}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Save CTA */}
            <button
              type="button"
              disabled={isSaving || (!createText.trim() && createAttachments.length === 0)}
              onClick={() => void handleCreateSave()}
              className="w-full h-[52px] rounded-[16px] text-s-16 font-bold border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-1"
              style={{ backgroundColor: tokens.accent, color: tokens.accentFg }}
            >
              Сохранить
            </button>
          </div>
        </div>
      )}

      {/* 2. Edit Note Dialog */}
      {editingNote && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Редактировать"
          onClick={() => setEditingNote(null)}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] max-h-[86vh] overflow-y-auto rounded-[24px] p-5 border shadow-2xl flex flex-col gap-3.5"
            style={{
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              color: tokens.text,
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-s-18 font-bold" style={{ color: tokens.text }}>
                Редактировать
              </h2>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setEditingNote(null)}
                className="w-[30px] h-[30px] rounded-full border flex items-center justify-center cursor-pointer"
                style={{ borderColor: tokens.border, color: tokens.textSecondary }}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {subjectOptions.map((subj) => {
                const active = editSubject === subj;
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setEditSubject(subj)}
                    className="rounded-full px-3 py-1 text-s-13 font-semibold border whitespace-nowrap cursor-pointer shrink-0"
                    style={{
                      backgroundColor: active ? colorWithAlpha(tokens.accent, 0.16) : 'transparent',
                      borderColor: active ? tokens.accent : tokens.border,
                      color: active ? tokens.accent : tokens.textSecondary,
                    }}
                  >
                    {subj}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPickerTarget('edit');
                  setDatePickerOpen(true);
                }}
                className="rounded-full px-3 py-1.5 text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
                style={{ borderColor: tokens.border, color: tokens.text }}
              >
                <Calendar size={14} style={{ color: tokens.accent }} aria-hidden="true" />
                <span>{editDate}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPickerTarget('edit');
                  setTimePickerOpen(true);
                }}
                className="rounded-full px-3 py-1.5 text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
                style={{ borderColor: tokens.border, color: tokens.text }}
              >
                <Clock size={14} style={{ color: tokens.accent }} aria-hidden="true" />
                <span>{editTime}</span>
              </button>

              {editNextLesson && (
                <button
                  type="button"
                  onClick={() => {
                    setEditDate(editNextLesson.dateFormatted);
                    setEditTime(editNextLesson.timeFormatted);
                  }}
                  className="rounded-full px-3 py-1.5 text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
                  style={{ borderColor: tokens.accent, color: tokens.accent }}
                >
                  <CalendarCheck size={14} aria-hidden="true" />
                  <span>К след. паре</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-s-13 font-semibold" style={{ color: tokens.textSecondary }}>
                Тип:
              </span>
              {[
                { key: '', label: 'Обычная' },
                { key: 'ЛР', label: 'ЛР' },
                { key: 'ЛК', label: 'ЛК' },
                { key: 'ПЗ', label: 'ПЗ' },
              ].map((t) => {
                const active = editType === t.key;
                const col = t.key ? TYPE_COLORS[t.key] : tokens.accent;
                return (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setEditType(t.key)}
                    className="rounded-[10px] px-3 py-1 text-s-13 font-semibold border cursor-pointer"
                    style={{
                      backgroundColor: active ? colorWithAlpha(col, 0.18) : 'transparent',
                      borderColor: active ? col : tokens.border,
                      color: active ? col : tokens.textSecondary,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Введите заметку..."
              rows={4}
              className="w-full min-h-[100px] rounded-[14px] p-3 border outline-none resize-none text-s-15"
              style={{
                backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderColor: tokens.border,
                color: tokens.text,
              }}
            />

            <div className="flex items-center justify-between">
              <span className="text-s-13 font-semibold" style={{ color: tokens.textSecondary }}>
                Файлы и вложения ({editAttachments.length})
              </span>
              <button
                type="button"
                onClick={() => editFileInputRef.current?.click()}
                className="text-s-13 font-semibold bg-transparent border-0 cursor-pointer"
                style={{ color: tokens.accent }}
              >
                + Прикрепить
              </button>
              <input
                ref={editFileInputRef}
                type="file"
                multiple
                aria-label="Прикрепить файлы"
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const added = await readFilesAsAttachments(e.target.files);
                    setEditAttachments((prev) => [...prev, ...added]);
                    e.target.value = '';
                  }
                }}
              />
            </div>

            {editAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {editAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="rounded-[10px] px-2.5 py-1 border inline-flex items-center gap-1.5"
                    style={{ borderColor: tokens.border }}
                  >
                    <button
                      type="button"
                      onClick={() => handleAttachmentPreview(att)}
                      className="text-s-12 font-medium bg-transparent border-0 p-0 cursor-pointer truncate max-w-[160px]"
                      style={{ color: tokens.text }}
                    >
                      {att.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Удалить файл ${att.name}`}
                      onClick={() =>
                        setEditAttachments((prev) => prev.filter((x) => x.id !== att.id))
                      }
                      className="bg-transparent border-0 p-0 cursor-pointer"
                      style={{ color: tokens.textSecondary }}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={editPinned}
                onClick={() => setEditPinned((p) => !p)}
                className="flex-1 rounded-full py-2 text-s-13 font-semibold border inline-flex items-center justify-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: editPinned ? 'rgba(255,149,0,0.18)' : 'transparent',
                  borderColor: editPinned ? '#FF9500' : tokens.border,
                  color: editPinned ? '#FF9500' : tokens.textSecondary,
                }}
              >
                <Pin size={14} aria-hidden="true" />
                <span>Закрепить</span>
              </button>
              <button
                type="button"
                aria-pressed={editIsEvent}
                onClick={() => setEditIsEvent((p) => !p)}
                className="flex-1 rounded-full py-2 text-s-13 font-semibold border inline-flex items-center justify-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: editIsEvent ? 'rgba(255,184,0,0.18)' : 'transparent',
                  borderColor: editIsEvent ? '#FFB800' : tokens.border,
                  color: editIsEvent ? '#FFB800' : tokens.textSecondary,
                }}
              >
                <Bell size={14} aria-hidden="true" />
                <span>Событие</span>
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const target = editingNote;
                  setEditingNote(null);
                  setDeletingNote(target);
                }}
                className="flex-1 h-[44px] rounded-[14px] text-s-15 font-semibold border cursor-pointer"
                style={{
                  borderColor: 'rgba(255, 59, 48, 0.45)',
                  backgroundColor: 'rgba(255, 59, 48, 0.12)',
                  color: '#FF3B30',
                }}
              >
                Удалить
              </button>
              <button
                type="button"
                aria-label="Сохранить"
                disabled={isSaving || (!editText.trim() && editAttachments.length === 0)}
                onClick={() => void handleEditSave()}
                className="flex-[1.3] h-[44px] rounded-[14px] text-s-15 font-semibold border-0 cursor-pointer disabled:opacity-45"
                style={{ backgroundColor: tokens.accent, color: tokens.accentFg }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Delete Confirm Dialog */}
      {deletingNote && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Удалить заметку?"
          onClick={() => setDeletingNote(null)}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[340px] rounded-[24px] p-5 border shadow-2xl flex flex-col gap-3 text-center"
            style={{
              backgroundColor: tokens.card,
              borderColor: tokens.border,
              color: tokens.text,
            }}
          >
            <h2 className="text-s-18 font-bold" style={{ color: tokens.text }}>
              Удалить заметку?
            </h2>
            <p className="text-s-14 leading-[1.35]" style={{ color: tokens.textSecondary }}>
              Вы уверены, что хотите удалить эту заметку? Это действие также удалит синхронизированное событие из Google Календаря.
            </p>
            <div className="flex gap-2.5 mt-1">
              <button
                type="button"
                onClick={() => setDeletingNote(null)}
                className="flex-1 h-[44px] rounded-[14px] text-s-15 font-semibold border cursor-pointer"
                style={{ borderColor: tokens.border, color: tokens.text }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteNote(deletingNote.id);
                  triggerHaptic('notification', 'warning');
                  setDeletingNote(null);
                }}
                className="flex-1 h-[44px] rounded-[14px] text-s-15 font-semibold border-0 text-white cursor-pointer"
                style={{ backgroundColor: '#FF3B30' }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Picker */}
      <IosDatePickerModal
        isOpen={datePickerOpen}
        initialDay={activeDateParts.day}
        initialMonth={activeDateParts.month}
        initialYear={activeDateParts.year}
        highlightedDates={highlightedDates}
        onDismiss={() => setDatePickerOpen(false)}
        onDateSelected={(day, month, year) => {
          const formatted = `${pad2(day)}.${pad2(month)}.${year}`;
          if (pickerTarget === 'edit') {
            setEditDate(formatted);
          } else {
            setCreateDate(formatted);
          }
          setDatePickerOpen(false);
        }}
      />

      {/* Time Picker */}
      <IosTimePickerModal
        isOpen={timePickerOpen}
        initialHour={activeTimeParts.hour}
        initialMinute={activeTimeParts.minute}
        onDismiss={() => setTimePickerOpen(false)}
        onTimeSelected={(hour, minute) => {
          const formatted = `${pad2(hour)}:${pad2(minute)}`;
          if (pickerTarget === 'edit') {
            setEditTime(formatted);
          } else {
            setCreateTime(formatted);
          }
          setTimePickerOpen(false);
        }}
      />
    </div>
  );
}
