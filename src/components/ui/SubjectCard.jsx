import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getSubjectDisplayLabel } from '../../config/onlineLearning';

export default function SubjectCard({ subject, count, active = false, onSelect }) {
  const { lang, t } = useLanguage();
  const subjectCode = subject.id || 'DEFAULT';
  const badgeClass = active
    ? 'bg-white/20 text-white border border-white/30'
    : `border subject-badge-${subjectCode}`;
  const cardTone = active
    ? `subject-solid-${subjectCode} shadow-md`
    : 'bg-surface hover:bg-surface-alt text-foreground border-border hover:border-border-strong';

  const displayTitle = getSubjectDisplayLabel(subject, lang, true);
  const teacherCount = count ?? subject.teachers?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`paper-card paper-card-interactive group relative flex w-full items-center gap-3.5 p-3.5 text-left cursor-pointer border ${cardTone}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${badgeClass}`}
      >
        <span className="material-symbols-outlined text-2xl" aria-hidden="true">
          {subject.icon || 'menu_book'}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`font-display block text-base font-bold leading-snug truncate ${
            active ? 'text-white' : 'text-foreground'
          }`}
        >
          {displayTitle}
        </span>
        <span
          className={`tabular mt-0.5 block text-xs font-medium truncate ${
            active ? 'text-white/90' : 'text-secondary-text'
          }`}
        >
          {t('cards.teacherCount', { count: teacherCount })}
        </span>
      </span>

      {active && (
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-lg text-white shrink-0"
        >
          check_circle
        </span>
      )}
    </button>
  );
}
