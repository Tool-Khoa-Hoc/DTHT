import React from 'react';
import ArenaButton from './ArenaButton';

/**
 * SessionBar — thanh phiên học Arena Bento, đặt dính ngay phía trên khu vực học
 * khi đang xem 1 giáo viên (design-system/MASTER.md mục 5).
 *
 * Props (tất cả đều defensive — thiếu handler thì ẩn nút tương ứng):
 * - status: 'idle' | 'active' | 'needs-confirm' | 'ending'
 *           (trang có thể truyền qua study.sessionStatus ?? study.status)
 * - fallback: true khi tracker đang ở chế độ dự phòng (legacy-v2, chưa có
 *             bảng study_sessions) — vẫn tích EXP nhưng nhãn hiện rõ.
 * - sessionSeconds: số giây của phiên hiện tại — đồng hồ dùng class .tabular.
 * - teacherTitle / subjectLabel: ngữ cảnh đang học.
 * - onEndSession / onConfirmContinue: handler (tuỳ chọn).
 *
 * Trạng thái luôn hiện bằng CHỮ + icon SVG (không bằng màu đơn độc),
 * vùng trạng thái là aria-live="polite" để screen reader nghe được.
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Đồng hồ phiên: MM:SS, hoặc HH:MM:SS khi từ 1 giờ. */
function formatSessionClock(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`;
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M13 2.5 4.9 13.4h5.6L9.4 21.5l8.2-10.9h-5.8L13 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <rect x="6.2" y="5" width="4.1" height="14" rx="1.3" fill="currentColor" />
      <rect x="13.7" y="5" width="4.1" height="14" rx="1.3" fill="currentColor" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l9.7-6.8c.6-.4.6-1.3 0-1.7L9.6 4.3c-.7-.5-1.6 0-1.6.9Z" fill="currentColor" />
    </svg>
  );
}

const STATUS_META = {
  active: {
    label: 'Đang tích EXP',
    chipClass: 'border-jade-400/40 bg-jade-400/12 text-jade-200',
    Icon: BoltIcon,
    pulse: true,
  },
  'needs-confirm': {
    label: 'Tạm dừng — cần xác nhận',
    chipClass: 'border-gold-400/45 bg-gold-400/12 text-gold-300',
    Icon: PauseIcon,
    pulse: false,
  },
  ending: {
    label: 'Đang kết thúc phiên…',
    chipClass: 'border-white/12 bg-white/5 text-slate-300',
    Icon: ClockIcon,
    pulse: false,
  },
  idle: {
    label: 'Chưa bắt đầu phiên',
    chipClass: 'border-white/12 bg-white/5 text-slate-400',
    Icon: ClockIcon,
    pulse: false,
  },
};

export default function SessionBar({
  status = 'idle',
  fallback = false,
  sessionSeconds = 0,
  teacherTitle,
  subjectLabel,
  onEndSession,
  onConfirmContinue,
  className = '',
}) {
  const needsConfirm = status === 'needs-confirm';
  const meta = needsConfirm
    ? STATUS_META['needs-confirm']
    : fallback && status === 'active'
      ? {
          label: 'Chế độ dự phòng — vẫn đang tích EXP',
          chipClass: 'border-ember-400/40 bg-ember-400/10 text-ember-300',
          Icon: BoltIcon,
          pulse: true,
        }
      : (STATUS_META[status] ?? STATUS_META.idle);
  const { Icon } = meta;
  const showEnd = typeof onEndSession === 'function' && status !== 'idle' && status !== 'ending';
  const showConfirm = needsConfirm && typeof onConfirmContinue === 'function';

  return (
    <div
      className={`arena-card flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 ${className}`}
      role="status"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-black uppercase tracking-wide ${meta.chipClass}`}
          aria-live="polite"
        >
          <span className={meta.pulse ? 'animate-pulse' : undefined}>
            <Icon />
          </span>
          {meta.label}
        </span>
        {(teacherTitle || subjectLabel) && (
          <span className="min-w-0 truncate text-sm font-semibold text-slate-300">
            {subjectLabel && <span className="text-slate-500">{subjectLabel} · </span>}
            {teacherTitle}
          </span>
        )}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        <span className="flex items-center gap-1.5 text-slate-400" title="Thời gian phiên học hiện tại">
          <ClockIcon />
          <span className="tabular font-arena-display text-lg font-bold leading-none text-white">
            {formatSessionClock(sessionSeconds)}
          </span>
        </span>

        {showConfirm && (
          <ArenaButton variant="gold" size="sm" onClick={onConfirmContinue}>
            <PlayIcon />
            Tiếp tục học
          </ArenaButton>
        )}
        {showEnd && (
          <ArenaButton variant="ghost" size="sm" onClick={onEndSession}>
            <StopIcon />
            Kết thúc phiên
          </ArenaButton>
        )}
      </div>
    </div>
  );
}
