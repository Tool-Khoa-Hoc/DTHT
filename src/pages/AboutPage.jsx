import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../lib/useSeo';

export default function AboutPage() {
  useSeo({
    title: 'Giới thiệu - Đấu Trường Học Tập',
    description:
      'Đấu Trường Học Tập là gì: nền tảng ôn thi THPT Quốc gia cho học sinh Việt Nam — kho đề thi thử chọn lọc, sheet học online của 47 giáo viên, lộ trình ôn tập và công cụ tính điểm xét tuyển.',
    path: '/gioi-thieu',
  });

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Về chúng tôi</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
        Đấu Trường Học Tập là gì?
      </h1>
      <p className="mt-4 text-base leading-relaxed text-secondary-text">
        Đấu Trường Học Tập (dautruonghoctap.dev) là nền tảng ôn thi THPT Quốc gia dành cho
        học sinh Việt Nam. Chúng tôi gom những thứ sĩ tử thường phải đi tìm ở nhiều nơi —
        đề thi thử, chuyên đề từng môn, bài giảng của giáo viên, lộ trình ôn tập và công cụ
        tính điểm xét tuyển — vào một chỗ duy nhất, sắp xếp theo lộ trình để mỗi ngày học
        đều có mục tiêu rõ ràng.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">Dành cho ai?</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Trước hết là học sinh THPT đang chuẩn bị cho kỳ thi tốt nghiệp THPT Quốc gia, đặc
        biệt là khóa 2K9 hướng tới kỳ thi 2027. Dù bạn học khối tự nhiên hay xã hội, chọn
        tổ hợp nào để xét tuyển đại học, nền tảng đều có nội dung theo từng môn thi và
        từng tổ hợp đó. Học sinh lớp 10, 11 cũng có thể dùng kho chuyên đề để củng cố
        nền tảng từ sớm thay vì đợi đến năm lớp 12 mới bắt đầu.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">Học gì trên Đấu Trường?</h2>
      <ul className="mt-3 space-y-4 text-base leading-relaxed text-secondary-text">
        <li>
          <strong className="text-foreground">Thư viện tài liệu — hơn 10.000 đề và chuyên đề.</strong>{' '}
          Đề thi thử, chuyên đề theo dạng bài và sơ đồ tư duy được chọn lọc từ các trường
          chuyên trên toàn quốc, tổ chức theo từng môn và từng chương để tra cứu nhanh.
        </li>
        <li>
          <strong className="text-foreground">Học online — sheet bài giảng của 47 giáo viên.</strong>{' '}
          Mỗi giáo viên có một lộ trình buổi học riêng dưới dạng sheet: học đến đâu, tiến độ
          ghi đến đó. Bạn mở sheet trên trình duyệt, học tiếp đúng buổi đang dở mà không cần
          tải thêm ứng dụng.
        </li>
        <li>
          <strong className="text-foreground">Lộ trình ôn thi.</strong>{' '}
          Từng chặng từ nền tảng đến tổng ôn, phân bổ mục tiêu theo tuần và theo khối xét
          tuyển — thay vì học lan man không biết mình đang ở đâu trong kế hoạch.
        </li>
        <li>
          <strong className="text-foreground">Đấu trường và Bảng Vàng.</strong>{' '}
          Thời gian học thật được ghi nhận thành điểm kinh nghiệm (EXP). Học đều mỗi ngày
          giúp bạn giữ chuỗi ngày học, lên cấp, nhận quân hàm và có tên trên Bảng Vàng.
        </li>
        <li>
          <strong className="text-foreground">Công cụ tính điểm và tra cứu.</strong>{' '}
          Tính điểm GPA, tìm trường theo điểm số và khối thi, tính điểm xét tuyển đại học
          theo tổ hợp môn — để quyết định chọn trường dựa trên số liệu, không chỉ cảm tính.
        </li>
      </ul>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">
        Nội dung được biên soạn như thế nào?
      </h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Đề thi và chuyên đề trong thư viện được chọn lọc từ các trường chuyên và các nguồn
        luyện thi uy tín, ưu tiên đề bám cấu trúc đề thi tốt nghiệp THPT hiện hành. Sheet
        học online do từng giáo viên biên soạn theo tiến trình buổi học của mình, và được
        cập nhật khi chương trình hoặc cấu trúc đề thi thay đổi. Chúng tôi không đăng tải
        ồ ạt nội dung chưa kiểm chứng: một tài liệu ít nhưng đúng trọng tâm có ích hơn
        một kho tài liệu khổng lồ mà sĩ tử không biết bắt đầu từ đâu.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">Nguyên tắc làm việc</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-secondary-text">
        <li>Học liệu phải gắn với chương trình và cấu trúc đề thi thật, không lan man.</li>
        <li>Tiến độ học của mỗi sĩ tử là dữ liệu riêng tư — xem chi tiết trong <Link className="font-semibold text-primary hover:underline" to="/chinh-sach-bao-mat">Chính sách bảo mật</Link>.</li>
        <li>Nền tảng được duy trì và cập nhật thường xuyên theo từng mùa thi, không phải website làm một lần rồi bỏ đó.</li>
      </ul>

      <div className="mt-10 rounded-2xl border border-border bg-paper p-6 shadow-paper">
        <h2 className="font-display text-xl font-extrabold text-foreground">Liên hệ với chúng tôi</h2>
        <p className="mt-2 text-base leading-relaxed text-secondary-text">
          Góp ý về nội dung, báo lỗi kỹ thuật hay đề xuất hợp tác giảng dạy — xem hướng dẫn
          tại trang <Link className="font-semibold text-primary hover:underline" to="/lien-he">Liên hệ</Link> hoặc
          gửi email tới <a className="font-semibold text-primary hover:underline" href="mailto:lienhe@dautruonghoctap.dev">lienhe@dautruonghoctap.dev</a>.
        </p>
        <Link to="/auth" className="btn-arena btn-arena-primary mt-4">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">login</span>
          Đăng nhập và bắt đầu học
        </Link>
      </div>
    </article>
  );
}
