import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getSubjectDisplayLabel } from '../../config/onlineLearning';
import Button from './Button';

function parseTeacherTitle(raw = '', defaultTeacher = 'Giáo viên', defaultCourse = '') {
  const parts = String(raw)
    .split(/\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const head = parts[0] || raw || defaultTeacher;
  const course = parts.slice(1).join(' · ') || defaultCourse;
  return { head, course };
}

export default function TeacherCard({
  teacher,
  index = 0,
  subject,
  active = false,
  onSelect,
}) {
  const { lang, t } = useLanguage();
  const subjectLabel = getSubjectDisplayLabel(subject, lang, true);
  const { head, course } = parseTeacherTitle(
    teacher?.title,
    t('cards.defaultTeacher'),
    t('cards.defaultCoursePrefix', { subject: subjectLabel }),
  );
  const badgeNum = String(index + 1).padStart(2, '0');
  const subjectCode = subject?.id || 'DEFAULT';

  return (
    <article
      className={`paper-card paper-card-interactive flex flex-col justify-between gap-4 p-4 sm:p-5 border ${
        active
          ? 'border-primary bg-primary-soft/35 shadow-sm'
          : 'border-border hover:border-border-strong'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div
          aria-hidden="true"
          className={`font-display tabular flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-extrabold border shadow-xs subject-solid-${subjectCode}`}
        >
          {badgeNum}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {subjectLabel && (
              <span className={`paper-chip border subject-badge-${subjectCode}`}>
                <span className="material-symbols-outlined text-sm shrink-0" aria-hidden="true">
                  {subject?.icon || 'school'}
                </span>
                <span className="truncate">{subjectLabel}</span>
              </span>
            )}
            <span className="paper-chip">
              <span className="material-symbols-outlined text-sm text-jade shrink-0" aria-hidden="true">
                verified
              </span>
              <span>{t('cards.dedicatedSheet')}</span>
            </span>
            {active && (
              <span className="paper-chip bg-jade-soft text-jade border-jade-border">
                <span className="h-1.5 w-1.5 rounded-full bg-jade animate-pulse shrink-0" aria-hidden="true" />
                <span>{t('cards.currentlyOpen')}</span>
              </span>
            )}
          </div>

          <h3 className="font-display text-base sm:text-lg font-bold leading-snug text-foreground line-clamp-2">
            {head}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-secondary-text line-clamp-2 leading-relaxed">
            {course}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border">
        <span className="tabular text-xs font-medium text-muted-foreground shrink-0">
          {t('cards.codePrefix', { num: badgeNum })}
        </span>
        <Button
          variant={active ? 'jade' : 'primary'}
          size="sm"
          icon={active ? 'visibility' : 'play_circle'}
          onClick={onSelect}
          aria-pressed={active}
        >
          {active ? t('cards.watchingContinue') : t('cards.enterClass')}
        </Button>
      </div>
    </article>
  );
}
