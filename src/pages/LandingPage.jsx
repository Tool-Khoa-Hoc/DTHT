import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../lib/useSeo';

const SUBJECTS = [
  { icon: 'functions', name: 'Toán', desc: 'Chuyên đề theo từng dạng bài và đề thi thử bám cấu trúc đề thi tốt nghiệp THPT.' },
  { icon: 'menu_book', name: 'Ngữ văn', desc: 'Dàn ý, bài văn mẫu chọn lọc và phương pháp làm bài nghị luận xã hội, nghị luận văn học.' },
  { icon: 'translate', name: 'Tiếng Anh', desc: 'Từ vựng theo chủ điểm, ngữ pháp trọng tâm và đề luyện đọc hiểu, trắc nghiệm.' },
  { icon: 'bolt', name: 'Vật lí', desc: 'Công thức, bài tập phân dạng và đề thi thử theo từng chương của chương trình THPT.' },
  { icon: 'science', name: 'Hóa học', desc: 'Lý thuyết trọng tâm, chuỗi phản ứng và bài tập tính toán theo mức độ từ dễ đến khó.' },
  { icon: 'biotech', name: 'Sinh học', desc: 'Sơ đồ tư duy hệ thống kiến thức, bài tập di truyền và đề luyện theo chuyên đề.' },
  { icon: 'history_edu', name: 'Lịch sử', desc: 'Mốc sự kiện, sơ đồ tư duy và đề trắc nghiệm theo từng giai đoạn lịch sử Việt Nam và thế giới.' },
  { icon: 'public', name: 'Địa lí', desc: 'Atlat, biểu đồ, số liệu và kỹ năng làm bài thi Địa lí theo cấu trúc đề thi mới.' },
];

const TOOLS = [
  { to: '/gpa', icon: 'calculate', name: 'Tính GPA', desc: 'Điểm trung bình học kỳ và mục tiêu điểm học bạ theo từng tổ hợp.' },
  { to: '/schools', icon: 'school', name: 'Tìm trường', desc: 'Gợi ý trường đại học phù hợp với điểm số và khối thi của bạn.' },
  { to: '/admission', icon: 'trending_up', name: 'Điểm xét tuyển', desc: 'Tính điểm xét tuyển đại học theo các phương thức và tổ hợp môn.' },
  { to: '/roadmap', icon: 'route', name: 'Lộ trình ôn thi', desc: 'Từng chặng từ nền tảng đến tổng ôn, phân bổ mục tiêu theo tuần.' },
  { to: '/library', icon: 'folder_open', name: 'Thư viện tài liệu', desc: 'Hơn 10.000 đề thi thử, chuyên đề và sơ đồ tư duy chọn lọc.' },
  { to: '/arena', icon: 'local_fire_department', name: 'Đấu trường', desc: 'Tích EXP từ giờ học thật, leo bậc quân hàm và đua top Bảng Vàng.' },
];

const STEPS = [
  { n: '01', title: 'Đăng ký tài khoản', desc: 'Đăng nhập bằng tài khoản Google hoặc email chỉ trong một phút — tiến độ học được lưu lại để tiếp tục bất cứ lúc nào.' },
  { n: '02', title: 'Chọn môn và khối thi', desc: 'Chọn các môn thi tốt nghiệp và tổ hợp xét tuyển đại học của bạn để hệ thống gợi ý lộ trình phù hợp.' },
  { n: '03', title: 'Học theo sheet và luyện đề', desc: 'Học theo sheet bài giảng của từng giáo viên, làm chuyên đề theo dạng bài rồi luyện đề thi thử có bấm giờ.' },
  { n: '04', title: 'Theo dõi tiến độ, leo hạng', desc: 'Giờ học thật được ghi nhận thành EXP. Duy trì chuỗi ngày học, leo bậc quân hàm và đua top Bảng Vàng cùng bạn bè.' },
];

const FAQS = [
  {
    q: 'Đấu Trường Học Tập là gì?',
    a: 'Đấu Trường Học Tập (dautruonghoctap.dev) là nền tảng ôn thi THPT Quốc gia dành cho học sinh Việt Nam: kho đề thi thử và chuyên đề chọn lọc, sheet học online theo từng giáo viên, lộ trình ôn tập, cùng các công cụ tính điểm GPA, tìm trường và tính điểm xét tuyển đại học.',
  },
  {
    q: 'Học online trên Đấu Trường Học Tập là gì?',
    a: 'Kho sheet bài giảng được tổ chức theo từng môn và từng giáo viên — hiện có 47 giáo viên. Mỗi sheet là một lộ trình buổi học có thứ tự, mở nhanh trên trình duyệt và ghi lại tiến độ từng buổi để bạn học tiếp đúng chỗ đang dở.',
  },
  {
    q: 'Tính điểm xét tuyển dùng như thế nào?',
    a: 'Bạn nhập điểm các môn trong tổ hợp xét tuyển, công cụ sẽ tính điểm xét tuyển theo phương thức bạn chọn và đối chiếu với điểm chuẩn các trường để ước lượng cơ hội trúng tuyển. Kết quả chỉ mang tính tham khảo — điểm chuẩn chính thức do từng trường công bố.',
  },
  {
    q: 'Đấu trường và EXP là gì?',
    a: 'Đấu trường là hệ thống thi đua học tập: thời gian học thật của bạn được ghi nhận thành điểm kinh nghiệm (EXP). Học đều mỗi ngày giúp bạn duy trì chuỗi ngày học, lên cấp, nhận quân hàm cao hơn và có tên trên Bảng Vàng.',
  },
  {
    q: 'Có cần đăng nhập để xem nội dung không?',
    a: 'Trang giới thiệu, chính sách, điều khoản và trang liên hệ xem được mà không cần đăng nhập. Kho học liệu ở trang /home xem được một phần mà không cần tài khoản; để lưu tiến độ, tính điểm và tham gia đấu trường, bạn đăng nhập bằng tài khoản Google hoặc email.',
  },
  {
    q: 'Tôi cần hỗ trợ thì liên hệ ở đâu?',
    a: 'Gửi email tới lienhe@dautruonghoctap.dev và ghi rõ vấn đề bạn gặp phải (tài khoản, nội dung bài học hay công cụ tính điểm) để đội ngũ hỗ trợ trả lời trong 2 ngày làm việc.',
  },
];

export default function LandingPage() {
  useSeo({
    title: 'Đấu Trường Học Tập - Ôn thi THPTQG & Tính điểm xét tuyển',
    description:
      'Đấu Trường Học Tập — nền tảng ôn thi THPT Quốc gia 2027: hơn 10.000 đề thi thử và chuyên đề, sheet học online của 47 giáo viên, lộ trình ôn tập, tính điểm GPA và điểm xét tuyển đại học.',
    path: '/',
  });

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-border bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold bg-gold-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold-dark">
            <span className="material-symbols-outlined text-base" aria-hidden="true">school</span>
            Ôn thi THPT Quốc gia 2027 · Khóa 2K9
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
            Ôn thi THPT Quốc gia, tính điểm xét tuyển — tất cả ở một nơi
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-secondary-text sm:text-lg">
            Đấu Trường Học Tập gom kho đề thi thử, chuyên đề từng môn, sheet học online
            của 47 giáo viên và bộ công cụ tính điểm vào một lộ trình ôn tập rõ ràng —
            để sĩ tử biết mỗi ngày mình cần học gì và đang đứng ở đâu.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/auth" className="btn-arena btn-arena-primary">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">login</span>
              Đăng nhập để bắt đầu học
            </Link>
            <Link to="/home" className="btn-arena btn-arena-secondary">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">explore</span>
              Xem kho học liệu
            </Link>
          </div>

          <dl className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-paper">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Đề thi &amp; chuyên đề</dt>
              <dd className="mt-1 font-display text-2xl font-extrabold text-primary">10.000+</dd>
              <dd className="text-sm text-secondary-text">Đề thi thử, chuyên đề và sơ đồ tư duy chọn lọc từ các trường chuyên toàn quốc.</dd>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-paper">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Giáo viên học online</dt>
              <dd className="mt-1 font-display text-2xl font-extrabold text-primary">47 giáo viên</dd>
              <dd className="text-sm text-secondary-text">Sheet bài giảng theo từng môn và từng giáo viên, học theo buổi có ghi tiến độ.</dd>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-paper">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Công cụ tra cứu</dt>
              <dd className="mt-1 font-display text-2xl font-extrabold text-primary">6 công cụ</dd>
              <dd className="text-sm text-secondary-text">Tính GPA, tìm trường, tính điểm xét tuyển, lộ trình, thư viện đề và đấu trường.</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Subjects */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
          Các môn thi tốt nghiệp THPT
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary-text sm:text-base">
          Nội dung được tổ chức theo từng môn thi của kỳ thi tốt nghiệp THPT —
          mỗi môn có chuyên đề theo dạng bài, bài tập phân mức độ và đề thi thử để luyện.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SUBJECTS.map((s) => (
            <article key={s.name} className="rounded-2xl border border-border bg-surface p-4 shadow-paper">
              <span className="material-symbols-outlined text-2xl text-primary" aria-hidden="true">{s.icon}</span>
              <h3 className="mt-2 font-display text-lg font-bold text-foreground">{s.name}</h3>
              <p className="mt-1 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            Học trên Đấu Trường như thế nào?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary-text sm:text-base">
            Bốn bước từ lúc tạo tài khoản đến lúc bạn có một lộ trình ôn tập đo được bằng tiến độ thật.
          </p>
          <ol className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4 rounded-2xl border border-border bg-surface p-5 shadow-paper">
                <span className="font-display text-2xl font-extrabold text-gold">{s.n}</span>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-secondary-text">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Combo HS12 2K9 */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-gold bg-primary-soft shadow-paper">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Combo trọng điểm · 2K9</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
              Combo HS12 2K9 — Chinh phục Đại học
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary-text sm:text-base">
              Lộ trình tổng hợp dành cho học sinh 2K9 thi tốt nghiệp THPT 2027: gom các môn
              trong tổ hợp xét tuyển thành một kế hoạch học duy nhất, đi từ nền tảng đến
              tổng ôn và luyện đề — thay vì học rời rạc từng môn, từng nguồn.
            </p>
            <Link
              to="/courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc"
              className="btn-arena btn-arena-primary mt-5"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">auto_stories</span>
              Xem combo (cần đăng nhập)
            </Link>
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="border-t border-border bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            Công cụ tính điểm và tra cứu
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary-text sm:text-base">
            Các công cụ này chạy ngay trên trình duyệt sau khi đăng nhập — không cần tải thêm ứng dụng.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="group rounded-2xl border border-border bg-surface p-5 shadow-paper transition-colors hover:border-primary/40"
              >
                <span className="material-symbols-outlined text-2xl text-primary" aria-hidden="true">{t.icon}</span>
                <h3 className="mt-2 font-display text-lg font-bold text-foreground group-hover:text-primary">
                  {t.name}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-secondary-text">{t.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">
                  Mở công cụ
                  <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
          Câu hỏi thường gặp
        </h2>
        <div className="mt-6 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="rounded-2xl border border-border bg-surface p-5 shadow-paper">
              <summary className="cursor-pointer font-display text-base font-bold text-foreground sm:text-lg">
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-secondary-text sm:text-base">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-border bg-primary p-6 text-center shadow-paper sm:p-8">
          <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
            Sẵn sàng cho kỳ thi 2027 chưa?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
            Tạo tài khoản bằng Google hoặc email, chọn khối thi của bạn và bắt đầu
            buổi học đầu tiên ngay hôm nay.
          </p>
          <Link to="/auth" className="btn-arena btn-arena-gold mt-5">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">rocket_launch</span>
            Đăng nhập và bắt đầu học
          </Link>
        </div>
      </section>
    </div>
  );
}
