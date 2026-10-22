import React from 'react';
import ArenaButton from './ArenaButton';

/**
 * TeacherCard — thẻ giáo viên Arena Bento (design-system/MASTER.md mục 5).
 * - Tên GV wrap tối đa 2 dòng (line-clamp-2), không truncate cụt mất họ tên.
 * - Chip môn (kèm chấm màu môn + nhãn chữ) + chip "Sheet riêng".
 * - Đúng 1 CTA chính: "Vào học" (chọn GV → mở sheet trong trang) /
 *   "Đang xem — tiếp tục học" khi active. Trạng thái chọn rõ bằng viền
 *   (.arena-card-active) + chip nhãn "Đang xem", không chỉ bằng màu.
 * Icon là SVG inline tự vẽ — không dùng emoji.
 */
function splitTeacherTitle(title) {
  const [mainTitle, ...detailParts] = String(title ?? '').split(' - ');
  return {
    mainTitle: mainTitle.trim(),
    detail: detailParts.join(' - ').trim(),
  };
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l9.7-6.8c.6-.4.6-1.3 0-1.7L9.6 4.3c-.7-.5-1.6 0-1.6.9Z" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function TeacherCard({ teacher, subject, index = 0, active = false, onSelect }) {
  const { mainTitle, detail } = splitTeacherTitle(teacher?.title);

  return (
    <article className={`arena-card flex flex-col gap-3 p-4 sm:p-5 ${active ? 'arena-card-active' : ''}`}>
      <div className="flex items-start gap-3">
        <span
          className="font-arena-display grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[15px] font-extrabold text-white"
          style={{ backgroundColor: active ? '#33b488' : subject?.color }}
          aria-hidden="true"
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="arena-chip">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: subject?.color }}
                aria-hidden="true"
              />
              {active ? 'Đang xem' : subject?.shortLabel}
            </span>
            <span className="arena-chip">Sheet riêng</span>
          </div>

          <h3 className="font-arena mt-2 line-clamp-2 text-[16px] font-bold leading-snug text-white sm:text-[17px]">
            {mainTitle}
          </h3>
          {detail && (
            <p className="mt-1 line-clamp-1 text-[13px] font-medium leading-5 text-slate-400">
              {detail}
            </p>
          )}
        </div>
      </div>

      <ArenaButton
        variant={active ? 'jade' : 'primary'}
        size="md"
        className="mt-auto w-full"
        onClick={onSelect}
        aria-pressed={active}
      >
        {active ? <CheckIcon /> : <PlayIcon />}
        {active ? 'Đang xem — tiếp tục học' : 'Vào học'}
      </ArenaButton>
    </article>
  );
}
