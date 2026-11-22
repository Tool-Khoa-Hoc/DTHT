import React from 'react';
import { Link } from 'react-router-dom';

// Footer dùng chung cho trang public và trang /home.
// Email liên hệ là địa chỉ placeholder lienhe@dautruonghoctap.dev —
// cần chủ site xác nhận / thay bằng email công khai thật trước khi công bố rộng.
export const CONTACT_EMAIL = 'lienhe@dautruonghoctap.dev';

export default function PublicFooter() {
  return (
    <footer className="border-t border-border bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/logo.webp"
                alt="Đấu Trường Học Tập"
                width={40}
                height={40}
                loading="lazy"
                decoding="async"
                className="h-10 w-10 rounded-xl border border-gold object-cover"
              />
              <div>
                <p className="font-display text-base font-extrabold leading-tight text-foreground">
                  Đấu Trường Học Tập
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                  Ôn thi THPTQG · 2027
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-secondary-text">
              Nền tảng ôn thi THPT Quốc gia, tính điểm xét tuyển đại học và luyện thi
              trắc nghiệm dành cho học sinh Việt Nam — kho đề chọn lọc, sheet học online
              theo giáo viên và lộ trình ôn tập từng tuần.
            </p>
          </div>

          <nav aria-label="Liên kết Đấu Trường">
            <p className="text-sm font-bold uppercase tracking-wide text-foreground">
              Đấu Trường
            </p>
            <ul className="mt-3 space-y-2 text-sm text-secondary-text">
              <li>
                <Link className="hover:text-primary" to="/">Trang chủ</Link>
              </li>
              <li>
                <Link className="hover:text-primary" to="/gioi-thieu">Giới thiệu</Link>
              </li>
              <li>
                <Link className="hover:text-primary" to="/home">Kho học liệu</Link>
              </li>
              <li>
                <Link className="hover:text-primary" to="/auth">Đăng nhập / Đăng ký</Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Thông tin pháp lý">
            <p className="text-sm font-bold uppercase tracking-wide text-foreground">
              Thông tin
            </p>
            <ul className="mt-3 space-y-2 text-sm text-secondary-text">
              <li>
                <Link className="hover:text-primary" to="/gioi-thieu">Về chúng tôi</Link>
              </li>
              <li>
                <Link className="hover:text-primary" to="/chinh-sach-bao-mat">
                  Chính sách bảo mật
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary" to="/dieu-khoan">
                  Điều khoản sử dụng
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary" to="/lien-he">Liên hệ</Link>
              </li>
            </ul>
            <p className="mt-4 text-sm text-secondary-text">
              Email liên hệ:{' '}
              <a className="font-semibold text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </p>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Đấu Trường Học Tập — dautruonghoctap.dev</p>
          <p>Ôn thi THPTQG · Tính điểm xét tuyển · Luyện thi trắc nghiệm</p>
        </div>
      </div>
    </footer>
  );
}
