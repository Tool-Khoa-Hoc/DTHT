import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../lib/useSeo';

export default function TermsPage() {
  useSeo({
    title: 'Điều khoản sử dụng - Đấu Trường Học Tập',
    description:
      'Điều khoản sử dụng Đấu Trường Học Tập: quy định về tài khoản, sử dụng nội dung học tập, quyền sở hữu nội dung, trách nhiệm và cách xử lý vi phạm.',
    path: '/dieu-khoan',
  });

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Điều khoản sử dụng</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
        Điều khoản sử dụng
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Cập nhật lần cuối: 22/11/2026 · Áp dụng cho website dautruonghoctap.dev
      </p>
      <p className="mt-4 text-base leading-relaxed text-secondary-text">
        Khi truy cập và sử dụng Đấu Trường Học Tập, bạn đồng ý tuân thủ các điều khoản dưới
        đây. Nếu không đồng ý, vui lòng không sử dụng website.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">1. Dịch vụ cung cấp</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Đấu Trường Học Tập là nền tảng ôn thi THPT Quốc gia: kho đề thi thử và chuyên đề,
        sheet học online theo giáo viên, lộ trình ôn tập, hệ thống thi đua học tập (EXP,
        quân hàm, Bảng Vàng) và các công cụ tính điểm GPA, tìm trường, tính điểm xét tuyển
        đại học. Nội dung và tính năng có thể được bổ sung, thay đổi hoặc tạm ngưng để bảo
        trì mà không cần báo trước trong từng trường hợp cụ thể.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">2. Tài khoản người dùng</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-secondary-text">
        <li>Bạn đăng ký bằng tài khoản Google hoặc bằng email và mật khẩu do bạn đặt.</li>
        <li>Bạn chịu trách nhiệm bảo mật tài khoản của mình và mọi hoạt động diễn ra dưới tài khoản đó.</li>
        <li>Không chia sẻ mật khẩu cho người khác. Nếu nghi ngờ tài khoản bị truy cập trái phép, hãy đổi mật khẩu và liên hệ với chúng tôi ngay.</li>
        <li>Người dùng dưới 18 tuổi cần có sự đồng ý của phụ huynh hoặc người giám hộ khi tạo tài khoản.</li>
        <li>Bạn có thể yêu cầu xóa tài khoản bất cứ lúc nào qua email liên hệ — dữ liệu học tập gắn với tài khoản sẽ bị xóa theo yêu cầu.</li>
      </ul>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">3. Sử dụng đúng mục đích</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">Khi sử dụng website, bạn cam kết không:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-secondary-text">
        <li>Gian lận trong hệ thống thi đua: khai báo giờ học giả, dùng công cụ tự động để tăng EXP, cấp độ hay thứ hạng.</li>
        <li>Sao chép, phát tán lại toàn bộ hoặc phần lớn nội dung học tập của website cho mục đích thương mại khi chưa được phép bằng văn bản.</li>
        <li>Tấn công, gây quá tải, dò quét hệ thống, hoặc cố truy cập dữ liệu của người dùng khác.</li>
        <li>Đăng tải nội dung vi phạm pháp luật, xúc phạm, quấy rối người khác, hoặc chứa mã độc trong ghi chú và hồ sơ cá nhân.</li>
        <li>Mạo danh giáo viên, quản trị viên hoặc người dùng khác.</li>
      </ul>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">4. Nội dung và quyền sở hữu</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Nội dung học tập trên website — đề thi, chuyên đề, sheet bài giảng, lộ trình — thuộc
        quyền sở hữu của Đấu Trường Học Tập hoặc của giáo viên, đơn vị cung cấp nội dung cho
        website. Bạn được phép sử dụng nội dung cho mục đích học tập cá nhân, phi thương mại.
        Việc trích dẫn ngắn cho mục đích học tập cần ghi rõ nguồn. Nội dung do chính bạn tạo
        (ghi chú, hồ sơ cá nhân) thuộc về bạn; bạn cho phép website lưu trữ và hiển thị nội
        dung đó trong phạm vi tài khoản của bạn.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">5. Tính chính xác của nội dung và công cụ</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Chúng tôi cố gắng đảm bảo đề thi, đáp án và số liệu trong các công cụ tính điểm là
        chính xác, nhưng không cam kết mọi nội dung đều không có sai sót. Kết quả tính điểm
        xét tuyển, gợi ý trường và dự đoán cơ hội trúng tuyển chỉ mang tính tham khảo — điểm
        chuẩn và phương thức tuyển sinh chính thức do từng trường đại học và Bộ Giáo dục và
        Đào tạo công bố mới có giá trị quyết định. Nếu phát hiện sai sót trong nội dung, bạn
        có thể báo cho chúng tôi qua trang Liên hệ để được kiểm tra và sửa.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">6. Quảng cáo</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Website hiển thị quảng cáo qua Google AdSense để duy trì hoạt động. Nội dung quảng cáo
        do Google và nhà quảng cáo cung cấp; chúng tôi không chịu trách nhiệm về sản phẩm hay
        dịch vụ trong quảng cáo đó. Cách Google dùng cookie cho quảng cáo được giải thích trong{' '}
        <Link className="font-semibold text-primary hover:underline" to="/chinh-sach-bao-mat">Chính sách bảo mật</Link>.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">7. Giới hạn trách nhiệm</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Dịch vụ được cung cấp “như hiện có”. Chúng tôi không chịu trách nhiệm đối với kết quả
        thi cử của người dùng, thiệt hại phát sinh từ việc gián đoạn dịch vụ do bảo trì hoặc
        sự cố ngoài tầm kiểm soát, hay thiệt hại phát sinh từ việc người dùng chia sẻ tài
        khoản cho người khác.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">8. Xử lý vi phạm và chấm dứt</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Tài khoản vi phạm các điều khoản này — gian lận EXP, phát tán nội dung trái phép, quấy
        rối người dùng khác — có thể bị cảnh cáo, khóa tính năng thi đua hoặc khóa tài khoản
        tùy mức độ. Chúng tôi có thể chấm dứt hoặc tạm ngưng tài khoản vi phạm nghiêm trọng
        mà không cần báo trước.
      </p>

      <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground">9. Thay đổi điều khoản và liên hệ</h2>
      <p className="mt-3 text-base leading-relaxed text-secondary-text">
        Điều khoản này có thể được cập nhật; ngày cập nhật ở đầu trang sẽ được đổi tương ứng.
        Việc tiếp tục sử dụng website sau khi điều khoản thay đổi đồng nghĩa với việc bạn
        chấp nhận bản cập nhật. Mọi thắc mắc, gửi về{' '}
        <a className="font-semibold text-primary hover:underline" href="mailto:lienhe@dautruonghoctap.dev">lienhe@dautruonghoctap.dev</a>{' '}
        hoặc xem <Link className="font-semibold text-primary hover:underline" to="/lien-he">trang Liên hệ</Link>.
      </p>
    </article>
  );
}
