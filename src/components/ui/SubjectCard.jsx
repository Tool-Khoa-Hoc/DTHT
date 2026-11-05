import React from 'react';

export default function SubjectCard({ subject, count, active = false, onSelect }) {
  const subjectCode = subject.id || 'DEFAULT';
  const badgeClass = active
    ? 'bg-white/20 text-white border border-white/30'
    : `border subject-badge-${subjectCode}`;
  const cardTone = active
    ? `subject-solid-${subjectCode} shadow-md`
    : 'bg-surface hover:bg-surface-alt text-foreground border-border hover:border-border-strong';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`paper-card paper-card-interactive group relative flex w-full items-center gap-3.5 p-3.5 text-left cursor-pointer border ${cardTone}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 no-shrink items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${badgeClass}`}
      >
        <span className="material-symbols-outlined text-2xl">{subject.icon || 'menu_book'}</span>
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`font-display block text-base font-bold leading-snug truncate ${
            active ? 'text-white' : 'text-foreground'
          }`}
        >
          {subject.shortLabel || subject.label}
        </span>
        <span
          className={`tabular mt-0.5 block text-xs font-medium ${
            active ? 'text-white/90' : 'text-secondary-text'
          }`}
        >
          {count ?? subject.teachers?.length ?? 0} giáo viên · sheet
        </span>
      </span>

      {active && (
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-lg text-white no-shrink"
        >
          check_circle
        </span>
      )}
    </button>
  );
}
