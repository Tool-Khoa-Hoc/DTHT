import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../lib/useSeo';
import { CONTACT_EMAIL } from '../components/PublicFooter';

const TOPICS = [
  { icon: 'support_agent', title: 'Hỗ trợ tài khoản', desc: 'Không đăng nhập được, quên mật khẩu, muốn xóa tài khoản hoặc đổi email đăng ký.' },
  { icon: 'report', title: 'Báo lỗi', desc: 'Trang lỗi, đáp án sai, công cụ tính điểm cho kết quả bất thường, sheet học online không mở được.' },
  { icon: 'menu_book', title: 'Góp ý nội dung', desc: 'Đề thi sai đáp án, chuyên đề thiếu dạng bài, muốn đề xuất thêm môn hoặc chủ đề ôn tập.' },
  { icon: 'groups', title: 'Hợp tác giảng dạy', desc: 'Giáo viên muốn đưa sheet bài giảng lên nền tảng, hoặc đơn vị muốn hợp tác nội dung.' },
];

export default function ContactPage() {
  useSeo({
    title: 'Liên hệ - Đấu Trường Học Tập',
    description:
      'Liên hệ Đấu Trường Học Tập qua email lienhe@dautruonghoctap.dev: hỗ trợ tài khoản, báo lỗi nội dung và công cụ, góp ý học liệu, hợp tác giảng dạy. Phản hồi trong 2 ngày làm việc.',
    path: '/lien-he',
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Liên hệ</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
        Liên hệ với Đấu Trường Học Tập
      </h1>
      <p className="mt-4 text-base leading-relaxed text-secondary-text">
        Cần hỗ trợ tài khoản, báo lỗi nội dung hay đề xuất hợp tác? Gửi email cho chúng tôi
        theo hướng dẫn dưới đây — đội ngũ sẽ trả lời trong 2 ngày làm việc.
      </p>

      <div className="mt-8 rounded-3xl border border-gold bg-primary-soft p-6 shadow-paper sm:p-8">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-accent">
          <span className="material-symbols-outlined text-xl" aria-hidden="true">mail</span>
          Email liên hệ
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-2 block break-all font-display text-2xl font-extrabold text-primary hover:underline sm:text-3xl"
        >
          {CONTACT_EMAIL}
        </a>
        <p className="mt-3 text-sm leading-relaxed text-secondary-text">
          Nhấn vào địa chỉ email để mở ứng dụng mail của bạn. Trong email, vui lòng ghi rõ:
          (1) email đã đăng ký tài khoản Đấu Trường Học Tập của bạn (nếu có), (2) vấn đề gặp
          phải và (3) ảnh chụp màn hình nếu là lỗi hiển thị — càng cụ thể, chúng tôi hỗ trợ
          càng nhanh.
        </p>
        <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[Đấu Trường Học Tập] Cần hỗ trợ')}`} className="btn-arena btn-arena-primary mt-5">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">send</span>
          Soạn email ngay
        </a>
      </div>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">
        Bạn cần hỗ trợ về việc gì?
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TOPICS.map((t) => (
          <div key={t.title} className="rounded-2xl border border-border bg-surface p-5 shadow-paper">
            <span className="material-symbols-outlined text-2xl text-primary" aria-hidden="true">{t.icon}</span>
            <h3 className="mt-2 font-display text-lg font-bold text-foreground">{t.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-secondary-text">{t.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-paper p-6 shadow-paper">
        <h2 className="font-display text-xl font-extrabold text-foreground">Trước khi gửi email</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-secondary-text">
          <li>
            Lỗi đăng nhập: thử đăng nhập lại bằng tài khoản Google, hoặc dùng chức năng quên
            mật khẩu ở trang <Link className="font-semibold text-primary hover:underline" to="/auth">Đăng nhập</Link>.
          </li>
          <li>
            Thắc mắc về cách học, tính điểm hay đấu trường: xem mục Câu hỏi thường gặp ở{' '}
            <Link className="font-semibold text-primary hover:underline" to="/">trang chủ</Link> và{' '}
            <Link className="font-semibold text-primary hover:underline" to="/gioi-thieu">trang Giới thiệu</Link>.
          </li>
          <li>
            Yêu cầu xem hoặc xóa dữ liệu cá nhân: xem{' '}
            <Link className="font-semibold text-primary hover:underline" to="/chinh-sach-bao-mat">Chính sách bảo mật</Link>, mục 6.
          </li>
        </ul>
      </div>
    </div>
  );
}
