import React from 'react';

/**
 * SubjectCard — ô bento chọn môn học (design system "Arena Bento").
 * Icon là SVG inline tự vẽ theo tên icon của dữ liệu môn (Material Symbols name
 * trong src/config/onlineLearning.js) — không dùng emoji, không phụ thuộc font icon.
 * Trạng thái active: tô màu môn + chữ trắng + aria-pressed; cả thẻ là 1 nút bấm ≥44px.
 */

/** Map tên icon dữ liệu → nét SVG (viewBox 24, stroke currentColor). */
const ICON_PATHS = {
  calculate: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8.5 7.5h7" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01" />
    </>
  ),
  science: (
    <>
      <path d="M10 3h4" />
      <path d="M11 3v5.2L6.6 16a2.4 2.4 0 0 0 2.1 3.5h6.6a2.4 2.4 0 0 0 2.1-3.5L13 8.2V3" />
      <path d="M8.2 14.5h7.6" />
    </>
  ),
  translate: (
    <>
      <path d="M4 5.5h9" />
      <path d="M8.5 3.5v2c0 3.8-2.3 6.9-4.8 8.7" />
      <path d="M5.8 8.6c1.1 2.9 3.4 5.3 6.2 6.8" />
      <path d="M12.8 20.5 17.3 10l4.5 10.5" />
      <path d="M14.6 16.8h5.4" />
    </>
  ),
  biotech: (
    <>
      <path d="M5.5 19.5C5.5 11 11.5 4.8 20 4.5c-.3 8.5-6 14.5-14.5 15Z" />
      <path d="M5.5 19.5c2.8-5.8 6.8-9.8 11-12" />
    </>
  ),
  auto_stories: (
    <>
      <path d="M12 6.2C10 4.7 7.4 4.2 4 4.5v13.6c3.4-.3 6 .2 8 1.7 2-1.5 4.6-2 8-1.7V4.5c-3.4-.3-6 .2-8 1.7Z" />
      <path d="M12 6.2v13.6" />
    </>
  ),
  history_edu: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </>
  ),
  psychology: (
    <>
      <path d="M9.5 20.5v-2.8A5.6 5.6 0 0 1 6 12.4C6 8.6 8.7 5.4 12 5.4s6 3.2 6 7a5.6 5.6 0 0 1-3.5 5.3v2.8" />
      <path d="M9.5 20.5h5" />
      <path d="M12 5.4v15.1" />
    </>
  ),
  track_changes: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
};

const FALLBACK_ICON = (
  <>
    <path d="M12 4 2.5 8.5 12 13l9.5-4.5Z" />
    <path d="M6 10.8V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.2" />
    <path d="M21.5 8.5V14" />
  </>
);

function SubjectIcon({ name, className = 'h-[26px] w-[26px]' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name] ?? FALLBACK_ICON}
    </svg>
  );
}

export default function SubjectCard({ subject, active = false, onSelect, compact = false }) {
  const teacherCount = subject.teachers?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={[
        'arena-card arena-card-interactive flex w-full items-center gap-3.5 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
        compact ? 'min-h-[76px] p-3' : 'min-h-[104px] p-4 sm:p-5',
        active ? 'text-white' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        active
          ? {
              backgroundColor: subject.color,
              backgroundImage: 'none',
              borderColor: subject.color,
              boxShadow: `0 18px 40px ${subject.color}40`,
            }
          : undefined
      }
    >
      <span
        className={[
          'grid shrink-0 place-items-center rounded-2xl',
          compact ? 'h-11 w-11' : 'h-12 w-12',
        ].join(' ')}
        style={
          active
            ? { backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff' }
            : {
                color: subject.color,
                backgroundColor: `${subject.color}1A`,
                border: `1px solid ${subject.color}33`,
              }
        }
      >
        <SubjectIcon name={subject.icon} className={compact ? 'h-6 w-6' : 'h-[26px] w-[26px]'} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={[
            'font-arena-display block font-bold leading-tight',
            compact ? 'text-[17px]' : 'text-xl',
          ].join(' ')}
        >
          {subject.label}
        </span>
        <span
          className={[
            'mt-1 block text-xs font-bold',
            active ? 'text-white/85' : 'text-slate-400',
          ].join(' ')}
        >
          <span className="tabular">{teacherCount}</span> sheet giáo viên
        </span>
      </span>

      {!compact && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-5 w-5 shrink-0 ${active ? 'text-white/80' : 'text-slate-500'}`}
          aria-hidden="true"
        >
          <path d="m9 5 7 7-7 7" />
        </svg>
      )}
    </button>
  );
}
