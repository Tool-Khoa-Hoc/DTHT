import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../lib/useSeo';

export default function PrivacyPage() {
  useSeo({
    title: 'Chính sách bảo mật - Đấu Trường Học Tập',
    description:
      'Chính sách bảo mật của Đấu Trường Học Tập: dữ liệu nào được thu thập khi đăng nhập bằng Google hoặc email, dữ liệu được dùng để làm gì, cookie và quảng cáo Google AdSense, và quyền của người dùng.',
    path: '/chinh-sach-bao-mat',
  });

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Chính sách bảo mật</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
        Chính sách bảo mật
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Cập nhật lần cuối: 22/11/2026 · Áp dụng cho website dautruonghoctap.dev
      </p>
      <p className="mt-4 text-base leading-relaxed text-secondary-text">
        Đấu Trường Học Tập tôn trọng quyền riêng tư của người dùng. Chính sách này giải thích
        chúng tôi thu thập dữ liệu nào, dùng để làm gì, chia sẻ với ai và bạn có những quyền gì
        đối với dữ liệu của mình. Khi tạo tài khoản và sử dụng website, bạn đồng ý với các
        điều khoản dưới đây.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">1. Dữ liệu chúng tôi thu thập</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-secondary-text">
        <li>
          <strong className="text-foreground">Thông tin tài khoản:</strong> địa chỉ email, tên
          hiển thị và ảnh đại diện — do bạn cung cấp khi đăng ký bằng email, hoặc do Google
          cung cấp khi bạn đăng nhập bằng tài khoản Google (Google OAuth).
        </li>
        <li>
          <strong className="text-foreground">Dữ liệu học tập:</strong> tiến độ học, thời gian
          học, điểm kinh nghiệm (EXP), cấp độ, quân hàm, ghi chú và các nội dung bạn tạo hoặc
          lưu trong quá trình sử dụng (ví dụ: ghi chú học tập, đề đã làm).
        </li>
        <li>
          <strong className="text-foreground">Dữ liệu kỹ thuật:</strong> địa chỉ IP, loại trình
          duyệt và thiết bị, trang đã truy cập và thời gian truy cập — dùng để vận hành, bảo
          mật và cải thiện website.
        </li>
        <li>
          <strong className="text-foreground">Cookie:</strong> cookie đăng nhập để giữ phiên làm
          việc, cookie ghi nhớ giao diện (chế độ sáng/tối, ngôn ngữ) và cookie của bên thứ ba
          phục vụ quảng cáo (xem mục 4).
        </li>
      </ul>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Chúng tôi không thu thập mật khẩu tài khoản Google của bạn — việc đăng nhập bằng Google
        do Google xử lý trực tiếp. Chúng tôi cũng không yêu cầu số điện thoại, địa chỉ nhà hay
        thông tin thanh toán.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">2. Mục đích sử dụng dữ liệu</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-secondary-text">
        <li>Tạo và quản lý tài khoản, xác thực đăng nhập.</li>
        <li>Lưu tiến độ học, tính EXP, cấp độ và xếp hạng trên Bảng Vàng.</li>
        <li>Hiển thị nội dung học tập phù hợp với môn thi và tổ hợp xét tuyển của bạn.</li>
        <li>Hỗ trợ kỹ thuật khi bạn liên hệ, và gửi thông báo cần thiết về tài khoản hoặc dịch vụ.</li>
        <li>Phân tích tổng hợp (không định danh cá nhân) để cải thiện nội dung và tính năng.</li>
      </ul>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">3. Bên thứ ba xử lý dữ liệu</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Dữ liệu tài khoản và học tập được lưu trữ trên Supabase — nền tảng cơ sở dữ liệu và
        xác thực mà website sử dụng. Supabase chỉ xử lý dữ liệu theo chỉ dẫn của chúng tôi và
        không được dùng dữ liệu đó cho mục đích riêng. Việc đăng nhập bằng Google tuân theo
        chính sách bảo mật của Google.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">4. Quảng cáo và cookie của Google AdSense</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Website sử dụng Google AdSense để hiển thị quảng cáo. Google và các đối tác quảng cáo
        có thể dùng cookie để hiển thị quảng cáo phù hợp với nội dung bạn xem hoặc quảng cáo
        bạn từng quan tâm, theo chính sách của Google. Bạn có thể tắt cá nhân hóa quảng cáo
        tại trang Cài đặt quảng cáo của Google (adssettings.google.com) hoặc từ chối cookie
        quảng cáo của bên thứ ba tại aboutads.info/choices. Việc tắt cá nhân hóa không làm
        mất quảng cáo, chỉ khiến quảng cáo ít liên quan hơn.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">5. Lưu trữ và bảo mật</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Dữ liệu được lưu trữ trên hạ tầng của Supabase với kết nối mã hóa (HTTPS). Chúng tôi
        áp dụng các biện pháp bảo mật hợp lý — phân quyền truy cập, xác thực phiên đăng nhập —
        để ngăn truy cập trái phép. Không có hệ thống nào an toàn tuyệt đối; nếu phát hiện
        sự cố ảnh hưởng đến dữ liệu của bạn, chúng tôi sẽ thông báo qua email đã đăng ký.
        Dữ liệu học tập được giữ lại trong thời gian tài khoản còn hoạt động.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">6. Quyền của bạn</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-secondary-text">
        <li>Xem và chỉnh sửa thông tin tài khoản, tên hiển thị và ảnh đại diện trong trang hồ sơ.</li>
        <li>Yêu cầu xuất hoặc xóa dữ liệu tài khoản của mình.</li>
        <li>Yêu cầu xóa tài khoản — toàn bộ dữ liệu học tập gắn với tài khoản sẽ bị xóa.</li>
        <li>Rút lại sự đồng ý với cookie quảng cáo theo hướng dẫn ở mục 4.</li>
      </ul>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Để thực hiện các quyền trên, gửi email tới{' '}
        <a className="font-semibold text-primary hover:underline" href="mailto:lienhe@dautruonghoctap.dev">lienhe@dautruonghoctap.dev</a>{' '}
        từ chính email đã đăng ký tài khoản, ghi rõ yêu cầu của bạn. Chúng tôi xử lý trong
        7 ngày làm việc.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">7. Người dùng dưới 18 tuổi</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Phần lớn người dùng của Đấu Trường Học Tập là học sinh THPT dưới 18 tuổi. Nếu bạn
        chưa đủ 18 tuổi, hãy hỏi ý kiến phụ huynh hoặc người giám hộ trước khi tạo tài khoản
        và cung cấp thông tin cá nhân. Phụ huynh có thể liên hệ với chúng tôi qua email ở
        mục 8 để yêu cầu xem hoặc xóa dữ liệu của con em mình.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">8. Thay đổi chính sách và liên hệ</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Chính sách này có thể được cập nhật khi dịch vụ thay đổi; ngày cập nhật ở đầu trang
        sẽ được đổi tương ứng và thay đổi quan trọng sẽ được thông báo trên website. Mọi thắc
        mắc về bảo mật, gửi về{' '}
        <a className="font-semibold text-primary hover:underline" href="mailto:lienhe@dautruonghoctap.dev">lienhe@dautruonghoctap.dev</a>.
        Xem thêm <Link className="font-semibold text-primary hover:underline" to="/dieu-khoan">Điều khoản sử dụng</Link> và{' '}
        <Link className="font-semibold text-primary hover:underline" to="/lien-he">trang Liên hệ</Link>.
      </p>
    </article>
  );
}
