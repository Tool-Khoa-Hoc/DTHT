import React from 'react';
import Button from './Button';

function parseTeacherTitle(raw = '', subjectLabel = '') {
  const parts = String(raw)
    .split(/\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const head = parts[0] || raw || 'Giáo viên';
  const course = parts.slice(1).join(' · ') || `Khoá luyện thi ${subjectLabel}`;
  return { head, course };
}

export default function TeacherCard({
  teacher,
  index = 0,
  subject,
  active = false,
  onSelect,
}) {
  const { head, course } = parseTeacherTitle(teacher?.title, subject?.shortLabel || subject?.label);
  const badgeNum = String(index + 1).padStart(2, '0');
  const subjectCode = subject?.id || 'DEFAULT';

  return (
    <article
      className={`paper-card paper-card-interactive flex flex-col justify-between gap-4 p-4 sm:p-5 ${
        active
          ? 'ring-2 ring-primary border-primary/50 bg-primary-soft/35'
          : 'hover:border-border-strong'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div
          aria-hidden="true"
          className={`font-display tabular flex h-12 w-12 no-shrink items-center justify-center rounded-xl text-base font-extrabold border shadow-xs subject-solid-${subjectCode}`}
        >
          {badgeNum}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {subject?.shortLabel && (
              <span className={`paper-chip border subject-badge-${subjectCode}`}>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  {subject.icon || 'school'}
                </span>
                {subject.shortLabel}
              </span>
            )}
            <span className="paper-chip">
              <span className="material-symbols-outlined text-sm text-jade" aria-hidden="true">
                verified
              </span>
              Sheet riêng
            </span>
            {active && (
              <span className="paper-chip bg-jade-soft text-jade border-jade-border">
                <span className="h-1.5 w-1.5 rounded-full bg-jade animate-pulse" aria-hidden="true" />
                Đang mở
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

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
        <span className="tabular text-xs font-medium text-muted-foreground">Mã #{badgeNum}</span>
        <Button
          variant={active ? 'jade' : 'primary'}
          size="sm"
          icon={active ? 'visibility' : 'play_circle'}
          onClick={onSelect}
          aria-pressed={active}
        >
          {active ? 'Đang xem — tiếp tục học' : 'Vào học'}
        </Button>
      </div>
    </article>
  );
}
