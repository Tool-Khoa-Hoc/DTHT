import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from './ui/Button';

const WELCOME_MODAL_DISMISSED_KEY = 'dtht_hide_welcome_modal';

export default function WelcomeModal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      return window.localStorage.getItem(WELCOME_MODAL_DISMISSED_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        window.localStorage.setItem(WELCOME_MODAL_DISMISSED_KEY, 'true');
      } catch {
        // Ignore storage write failure in private browsing modes.
      }
    }
    setIsOpen(false);
  };

  const handleJoinNow = () => {
    handleClose();
    if (!user) {
      navigate('/auth');
    } else {
      navigate('/library');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/45 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        className="relative w-full max-w-lg imperial-frame overflow-hidden p-6 sm:p-8"
      >
        <span
          aria-hidden="true"
          className="hanzi-watermark absolute top-3 right-5 text-6xl font-bold text-accent/10"
        >
          學堂
        </span>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Đóng cửa sổ chào mừng"
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-surface-alt hover:bg-muted text-secondary-text hover:text-foreground border border-border transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-xl" aria-hidden="true">
            close
          </span>
        </button>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 mb-5 rounded-2xl bg-primary-soft border border-primary/30 flex items-center justify-center shadow-xs">
            <img
              src="/logo.webp"
              alt="Logo Đấu Trường Học Tập"
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
              className="w-11 h-11 object-contain"
            />
          </div>

          <span className="seal-stamp px-3 py-1 text-[11px] uppercase tracking-wider mb-3">
            Thư Viện &amp; Khoa Trường 2027
          </span>

          <h2
            id="welcome-modal-title"
            className="text-2xl sm:text-3xl font-display font-extrabold text-foreground mb-2 tracking-tight"
          >
            Đấu Trường Học Tập
          </h2>

          <p className="text-secondary-text text-sm sm:text-base mb-6 max-w-md leading-relaxed">
            Chào mừng sĩ tử đến với thư phòng ôn luyện! Khám phá kho tài liệu chọn lọc, công cụ tính điểm chuẩn xác và thi đua bảng vàng mỗi ngày.
          </p>

          <div className="w-full space-y-2.5 mb-6 text-left">
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-paper border border-border">
              <div className="p-2 rounded-lg bg-primary-soft text-primary border border-primary/25">
                <span className="material-symbols-outlined text-xl" aria-hidden="true">
                  library_books
                </span>
              </div>
              <div>
                <h3 className="text-foreground font-bold text-sm">Kho Tài Liệu Chọn Lọc</h3>
                <p className="text-secondary-text text-xs">
                  Đề thi thử, chuyên đề và giáo trình từ các trường chuyên toàn quốc
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-paper border border-border">
              <div className="p-2 rounded-lg bg-jade-soft text-jade border border-jade-border">
                <span className="material-symbols-outlined text-xl" aria-hidden="true">
                  calculate
                </span>
              </div>
              <div>
                <h3 className="text-foreground font-bold text-sm">Tính Điểm &amp; Chọn Trường</h3>
                <p className="text-secondary-text text-xs">
                  Phân tích GPA, điểm xét tuyển đại học và danh sách nguyện vọng
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-paper border border-border">
              <div className="p-2 rounded-lg bg-gold-soft text-accent border border-gold">
                <span className="material-symbols-outlined text-xl" aria-hidden="true">
                  local_fire_department
                </span>
              </div>
              <div>
                <h3 className="text-foreground font-bold text-sm">Đấu Trường Bảng Vàng</h3>
                <p className="text-secondary-text text-xs">
                  Tích lũy giờ học, thăng bậc quân hàm từ Tân Binh đến Thống Soái
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            icon="rocket_launch"
            onClick={handleJoinNow}
            className="w-full mb-4"
          >
            {user ? 'Khám Phá Kho Tài Liệu Ngay' : 'Đăng Nhập / Tham Gia Ngay'}
          </Button>

          <div className="w-full flex items-center justify-between pt-4 border-t border-border text-xs text-secondary-text">
            <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-border-strong text-primary focus:ring-primary w-4 h-4 cursor-pointer accent-primary"
              />
              <span>Không hiển thị lại lần sau</span>
            </label>

            <button
              type="button"
              onClick={handleClose}
              className="hover:text-foreground underline decoration-border-strong underline-offset-4 transition-colors cursor-pointer font-semibold"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
