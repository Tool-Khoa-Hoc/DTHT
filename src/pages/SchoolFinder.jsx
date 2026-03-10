import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────
// Static university dataset (2024-2025 benchmark)
// ─────────────────────────────────────────
const SCHOOLS = [
  // ── Hà Nội ──
  { id: 1,  region: 'hanoi',  name: 'ĐH Bách Khoa Hà Nội',           code: 'BKA',  type: 'public',  fee: 25,  methods: ['tsa','thpt','hb'], tsa: 72, thpt: 26.5, hb: 8.2,  majors: ['Kỹ thuật','Công nghệ thông tin','Kỹ thuật điện'] },
  { id: 2,  region: 'hanoi',  name: 'ĐH Quốc gia Hà Nội (ĐHQGHN)',   code: 'VNU',  type: 'public',  fee: 18,  methods: ['hsa','thpt','hb'], hsa: 100, thpt: 27.5, hb: 8.5, majors: ['Khoa học tự nhiên','Luật','Kinh tế','Ngoại ngữ'] },
  { id: 3,  region: 'hanoi',  name: 'ĐH Kinh tế Quốc dân',           code: 'NEU',  type: 'public',  fee: 22,  methods: ['thpt','hb'],       thpt: 27.0, hb: 8.4,  majors: ['Kinh tế','Kế toán','Tài chính','Quản trị kinh doanh'] },
  { id: 4,  region: 'hanoi',  name: 'ĐH Ngoại thương',                code: 'FTU',  type: 'public',  fee: 22,  methods: ['thpt','hb'],       thpt: 28.0, hb: 8.6,  majors: ['Kinh tế đối ngoại','Quản trị kinh doanh','Tiếng Anh'] },
  { id: 5,  region: 'hanoi',  name: 'Học viện Ngoại giao',            code: 'DAV',  type: 'public',  fee: 18,  methods: ['thpt','hb'],       thpt: 27.5, hb: 8.5,  majors: ['Quan hệ quốc tế','Luật quốc tế','Ngoại giao'] },
  { id: 6,  region: 'hanoi',  name: 'ĐH Y Hà Nội',                   code: 'HMU',  type: 'public',  fee: 15,  methods: ['thpt'],             thpt: 29.0, majors: ['Y đa khoa','Dược','Điều dưỡng'] },
  { id: 7,  region: 'hanoi',  name: 'ĐH Xây dựng HN',                code: 'HUCE', type: 'public',  fee: 18,  methods: ['thpt','hb'],       thpt: 25.0, hb: 8.0,  majors: ['Xây dựng','Kiến trúc','Quy hoạch đô thị'] },
  { id: 8,  region: 'hanoi',  name: 'ĐH Thương mại',                 code: 'VCU',  type: 'public',  fee: 20,  methods: ['thpt','hb'],       thpt: 26.5, hb: 8.2,  majors: ['Quản trị kinh doanh','Marketing','Kế toán'] },
  { id: 9,  region: 'hanoi',  name: 'Học viện Công nghệ Bưu chính Viễn thông', code:'PTIT', type:'public', fee:20, methods:['thpt','hb'],   thpt: 24.5, hb: 7.8,  majors: ['CNTT','Điện tử','Viễn thông'] },
  { id: 10, region: 'hanoi',  name: 'ĐH Giao thông Vận tải',         code: 'UTC',  type: 'public',  fee: 18,  methods: ['thpt','hb'],       thpt: 23.5, hb: 7.5,  majors: ['Giao thông vận tải','Kỹ thuật','Logistics'] },

  // ── TP.HCM ──
  { id: 11, region: 'hcm',    name: 'ĐH Bách Khoa TP.HCM',            code: 'HCMUT',type:'public', fee:25,  methods: ['vact','thpt','hb'], vact: 900, thpt: 26.0, hb: 8.0, majors: ['Kỹ thuật','CNTT','Cơ điện tử','Kỹ thuật hóa học'] },
  { id: 12, region: 'hcm',    name: 'ĐH Khoa học Tự nhiên TP.HCM',   code: 'HCMUS', type:'public', fee:18,  methods: ['vact','thpt','hb'], vact: 820, thpt: 25.5, hb: 7.8, majors: ['Khoa học máy tính','Toán','Vật lý','Hóa học'] },
  { id: 13, region: 'hcm',    name: 'ĐH Kinh tế TP.HCM (UEH)',       code: 'UEH',   type:'public', fee:22,  methods: ['vact','thpt','hb'], vact: 860, thpt: 26.5, hb: 8.2, majors: ['Kinh tế','Kế toán','Tài chính','Marketing'] },
  { id: 14, region: 'hcm',    name: 'ĐH Luật TP.HCM',                code: 'HCMUL', type:'public', fee:15,  methods: ['thpt','hb'],        thpt: 26.0, hb: 8.2,  majors: ['Luật','Luật kinh doanh','Luật quốc tế'] },
  { id: 15, region: 'hcm',    name: 'ĐH Y Dược TP.HCM',              code: 'UMP',   type:'public', fee:15,  methods: ['thpt'],              thpt: 28.0, majors: ['Y đa khoa','Dược','Răng hàm mặt'] },
  { id: 16, region: 'hcm',    name: 'ĐH Ngoại thương CS2',           code: 'FTU2',  type:'public', fee:22,  methods: ['thpt','hb'],        thpt: 27.0, hb: 8.4,  majors: ['Kinh tế đối ngoại','QTKD','Tiếng Anh'] },
  { id: 17, region: 'hcm',    name: 'ĐH Sư phạm Kỹ thuật TP.HCM',   code: 'HCMUTE',type:'public', fee:18,  methods: ['vact','thpt','hb'], vact: 780, thpt: 23.5, hb: 7.5, majors: ['Kỹ thuật cơ khí','Điện','CNTT','Sư phạm'] },
  { id: 18, region: 'hcm',    name: 'ĐH Mở TP.HCM',                  code: 'OU',    type:'public', fee:15,  methods: ['thpt','hb'],        thpt: 23.0, hb: 7.5,  majors: ['Kinh tế','CNTT','Xây dựng','Công nghệ sinh học'] },
  { id: 19, region: 'hcm',    name: 'ĐH Tôn Đức Thắng',              code: 'TDTU',  type:'public', fee:22,  methods: ['thpt','hb'],        thpt: 24.5, hb: 7.8,  majors: ['Kỹ thuật','CNTT','Kinh doanh','Luật'] },
  { id: 20, region: 'hcm',    name: 'ĐH Hutech',                      code: 'HUTECH',type:'private',fee:28,  methods: ['thpt','hb'],        thpt: 18.0, hb: 6.5,  majors: ['CNTT','Thiết kế','Marketing','Xây dựng'] },

  // ── Đà Nẵng ──
  { id: 21, region: 'danang', name: 'ĐH Đà Nẵng – ĐH Bách Khoa',    code: 'DUT',   type:'public', fee:18,  methods: ['thpt','hb'],        thpt: 24.0, hb: 7.8,  majors: ['Kỹ thuật','CNTT','Xây dựng','Điện'] },
  { id: 22, region: 'danang', name: 'ĐH Đà Nẵng – ĐH Kinh tế',      code: 'DUE',   type:'public', fee:18,  methods: ['thpt','hb'],        thpt: 24.5, hb: 7.8,  majors: ['Kinh tế','Kế toán','QTKD','Tài chính'] },
  { id: 23, region: 'danang', name: 'ĐH Đà Nẵng – ĐH Ngoại ngữ',    code: 'ULIS2', type:'public', fee:16,  methods: ['thpt','hb'],        thpt: 24.0, hb: 7.8,  majors: ['Ngoại ngữ','Tiếng Anh','Tiếng Trung','Tiếng Nhật'] },
  { id: 24, region: 'danang', name: 'ĐH Duy Tân',                    code: 'DTU',   type:'private',fee:25,  methods: ['thpt','hb'],        thpt: 18.5, hb: 6.5,  majors: ['Y khoa','CNTT','Kỹ thuật','Kinh doanh'] },

  // ── Cần Thơ ──
  { id: 25, region: 'cantho', name: 'ĐH Cần Thơ',                    code: 'CTU',   type:'public', fee:15,  methods: ['thpt','hb'],        thpt: 22.5, hb: 7.2,  majors: ['Nông nghiệp','Kỹ thuật','Kinh tế','CNTT'] },
  { id: 26, region: 'cantho', name: 'ĐH Y Dược Cần Thơ',            code: 'CTU-Y', type:'public', fee:12,  methods: ['thpt'],              thpt: 25.0, majors: ['Y đa khoa','Dược','Điều dưỡng'] },

  // ── Khác ──
  { id: 27, region: 'other',  name: 'ĐH Vinh',                       code: 'VU',    type:'public', fee:14,  methods: ['thpt','hb'],        thpt: 22.0, hb: 7.0,  majors: ['Sư phạm','Kinh tế','Kỹ thuật'] },
  { id: 28, region: 'other',  name: 'ĐH Huế',                        code: 'HUE',   type:'public', fee:14,  methods: ['thpt','hb'],        thpt: 22.0, hb: 7.0,  majors: ['Y khoa','Luật','Kinh tế','Sư phạm'] },
  { id: 29, region: 'other',  name: 'ĐH Quy Nhơn',                   code: 'QNU',   type:'public', fee:13,  methods: ['thpt','hb'],        thpt: 21.0, hb: 6.8,  majors: ['Sư phạm','Kinh tế','Kỹ thuật'] },
  { id: 30, region: 'other',  name: 'ĐH VinUni',                     code: 'VV',    type:'private',fee:120, methods: ['sat','thpt'],        thpt: 26.0, majors: ['Kỹ thuật','Y học','Kinh doanh','Công nghệ'] },
  { id: 31, region: 'other',  name: 'ĐH RMIT Việt Nam',              code: 'RMIT',  type: 'private', fee: 250, methods: ['thpt'],              thpt: 20.0, majors: ['Công nghệ thông tin', 'Kinh doanh', 'Thiết kế', 'Truyền thông'] },
  { id: 32, region: 'hcm',    name: 'ĐH FPT TP.HCM',                code: 'FPTU',  type: 'private', fee: 35,  methods: ['thpt', 'hb'],        thpt: 21.0, hb: 7.0,  majors: ['CNTT', 'AI', 'Kinh doanh', 'Thiết kế đồ họạ'] },
  { id: 33, region: 'hanoi',  name: 'ĐH FPT Hà Nội',                code: 'FPTH',  type: 'private', fee: 35,  methods: ['thpt', 'hb'],        thpt: 21.0, hb: 7.0,  majors: ['CNTT', 'AI', 'Kinh doanh', 'Thiết kế đồ họạ'] },

  // ── Cao đẳng ──
  { id: 34, region: 'hanoi',  name: 'CĐ FPT Polytechnic Hà Nội',      code: 'FPT-P-HN', type:'college', fee:20, methods:['thpt','hb'], thpt:15.0, hb:5.0, majors:['CNTT','Thiết kế đồ họạ','Hoạt động du lịch'] },
  { id: 35, region: 'hcm',    name: 'CĐ FPT Polytechnic TP.HCM',     code: 'FPT-P-HCM',type:'college',fee:20, methods:['thpt','hb'], thpt:15.0, hb:5.0, majors:['CNTT','Lập trình','Thiết kế'] },
  { id: 36, region: 'danang', name: 'CĐ FPT Polytechnic Đà Nẵng',     code: 'FPT-P-DN', type:'college', fee:18, methods:['thpt','hb'], thpt:14.0, hb:5.0, majors:['CNTT','Lập trình','Thiết kế'] },
  { id: 37, region: 'hanoi',  name: 'CĐ Kinh tế Kỹ thuật Thương mại',  code: 'KTKTM', type:'college', fee:10, methods:['thpt','hb'], thpt:17.0, hb:6.0, majors:['Kế toán','QTKD','Tài chính','CNTT'] },
  { id: 38, region: 'hanoi',  name: 'CĐ Nghề Công nghệ và Dịch vụ HN',  code: 'HNCTS', type:'college', fee: 9, methods:['thpt','hb'], thpt:14.0, hb:5.0, majors:['Cơ khí', 'Điện tử', 'CNTT', 'Du lịch'] },
  { id: 39, region: 'hcm',    name: 'CĐ Công nghệ Thứ Đức',         code: 'TDC',   type:'college', fee:12, methods:['thpt','hb'], thpt:15.0, hb:5.5, majors:['Kế toán', 'CNTT', 'Cơ khí', 'May mặc'] },
  { id: 40, region: 'hcm',    name: 'CĐ Kinh tế TP.HCM',             code: 'HCE',   type:'college', fee:10, methods:['thpt','hb'], thpt:16.0, hb:5.5, majors:['Kế toán', 'Tài chính', 'QTKD', 'Marketing'] },
  { id: 41, region: 'hcm',    name: 'CĐ Cộng Đồng TP.HCM',           code: 'HCCC',  type:'college', fee: 8, methods:['thpt','hb'], thpt:14.0, hb:5.0, majors:['Ngoại ngữ', 'Giáo dục mầm non', 'CNTT'] },
  { id: 42, region: 'danang', name: 'CĐ Công nghệ Đà Nẵng',           code: 'DCT',   type:'college', fee:10, methods:['thpt','hb'], thpt:14.5, hb:5.0, majors:['Điện', 'Cơ khí', 'CNTT', 'Môi trường'] },
  { id: 43, region: 'danang', name: 'CĐ Kinh tế Kế hoạch Đà Nẵng',    code: 'DKPE',  type:'college', fee: 9, methods:['thpt','hb'], thpt:15.0, hb:5.5, majors:['Kế toán', 'Thống kê', 'QTKD'] },
  { id: 44, region: 'cantho', name: 'CĐ Kinh tế Kỹ thuật Cần Thơ',   code: 'CTEC',  type:'college', fee: 8, methods:['thpt','hb'], thpt:14.0, hb:5.0, majors:['Cơ khí', 'Điện', 'CNTT', 'Kế toán'] },
  { id: 45, region: 'other',  name: 'CĐ Du lịch Hà Nội',              code: 'HTC',   type:'college', fee:10, methods:['thpt','hb'], thpt:15.0, hb:5.5, majors:['Quản trị khách sạn', 'Hướng dẫn du lịch', 'Ẩm thực'] },
  { id: 46, region: 'hanoi',  name: 'CĐ Nghề Việt Xô (VSIC)',         code: 'VISCO', type:'college', fee:11, methods:['thpt','hb'], thpt:14.5, hb:5.0, majors:['Cơ khí chính xác', 'Điện tử công nghiệp', 'Hàn'] },
  { id: 47, region: 'hcm',    name: 'CĐ Nghề TP.HCM',                  code: 'HCMVC', type:'college', fee: 9, methods:['thpt','hb'], thpt:14.0, hb:5.0, majors:['Cơ khí', 'Điện công nghiệp', 'Hàn', 'Kế toán'] },
];

const METHOD_LABELS = { thpt: 'THPT', tsa: 'TSA', vact: 'VACT', hsa: 'HSA', hb: 'Học bạ', sat: 'SAT' };
const METHOD_COLORS = { thpt: '#306ee8', tsa: '#8b5cf6', vact: '#e36488', hsa: '#10b981', hb: '#f59e0b', sat: '#6366f1' };
const SCHOOL_TYPE_LABELS = { public: 'Công lập', private: 'Ngoài CL', college: 'Cao đẳng' };
const REGIONS = [
  { id: 'all',    label: 'Tất cả' },
  { id: 'hanoi',  label: 'Hà Nội' },
  { id: 'hcm',    label: 'TP HCM' },
  { id: 'danang', label: 'Đà Nẵng' },
  { id: 'cantho', label: 'Cần Thơ' },
  { id: 'other',  label: 'Tỉnh thành khác' },
];

// ─────────────────────────────────────────
// Score Badge
// ─────────────────────────────────────────
function MethodBadge({ m }) {
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
      style={{ background: METHOD_COLORS[m] + '22', color: METHOD_COLORS[m], border: `1px solid ${METHOD_COLORS[m]}44` }}>
      {METHOD_LABELS[m]}
    </span>
  );
}

// ─────────────────────────────────────────
// School Card
// ─────────────────────────────────────────
function SchoolCard({ school, myScores }) {
  const [open, setOpen] = useState(false);
  const typeLabel = SCHOOL_TYPE_LABELS[school.type] || school.type;
  const typeColor = school.type === 'college' ? '#f59e0b' : school.type === 'private' ? '#a78bfa' : '#64748b';

  // Check which methods the user "qualifies" for (has score ≥ benchmark)
  const qualify = [];
  if (school.thpt && myScores.thpt >= school.thpt) qualify.push('thpt');
  if (school.tsa  && myScores.tsa  >= school.tsa)  qualify.push('tsa');
  if (school.vact && myScores.vact >= school.vact) qualify.push('vact');
  if (school.hsa  && myScores.hsa  >= school.hsa)  qualify.push('hsa');
  const hasScore = qualify.length > 0;
  const anyMyScore = myScores.thpt > 0 || myScores.tsa > 0 || myScores.vact > 0 || myScores.hsa > 0;

  return (
    <div className={`bg-[#0f172a]/60 border rounded-2xl overflow-hidden transition-all ${hasScore ? 'border-green-500/30' : 'border-white/10'}`}>
      <div className="p-4 cursor-pointer flex items-start gap-3" onClick={() => setOpen(o => !o)}>
        {/* Qualify indicator */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${hasScore ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-500'}`}>
          {hasScore ? <span className="material-symbols-outlined text-base">check_circle</span>
            : <span className="material-symbols-outlined text-base">apartment</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-sm text-white leading-tight">{school.name}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {school.code} · <span style={{ color: typeColor }} className="font-semibold">{typeLabel}</span> · {school.fee}tr/năm
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-500 text-base shrink-0 mt-0.5">{open ? 'expand_less' : 'expand_more'}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {school.methods.map(m => <MethodBadge key={m} m={m} />)}
          </div>
        </div>
      </div>

      {/* Expandable details */}
      {open && (
        <div className="border-t border-white/8 px-4 py-3 space-y-3">
          {/* Benchmark vs My Score */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Điểm chuẩn 2024 → Điểm của bạn</p>
            <div className="space-y-2">
              {school.thpt && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background:'#306ee8'}}></span>THPT: <b className="text-white">{school.thpt}</b></span>
                  {myScores.thpt > 0 && <span className={`font-bold ${myScores.thpt >= school.thpt ? 'text-green-400' : 'text-rose-400'}`}>Của bạn: {myScores.thpt.toFixed(2)} {myScores.thpt >= school.thpt ? '✔' : '✘'}</span>}
                </div>
              )}
              {school.tsa && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background:'#8b5cf6'}}></span>TSA: <b className="text-white">{school.tsa}</b></span>
                  {myScores.tsa > 0 && <span className={`font-bold ${myScores.tsa >= school.tsa ? 'text-green-400' : 'text-rose-400'}`}>Của bạn: {myScores.tsa.toFixed(1)} {myScores.tsa >= school.tsa ? '✔' : '✘'}</span>}
                </div>
              )}
              {school.vact && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background:'#e36488'}}></span>VACT: <b className="text-white">{school.vact}</b></span>
                  {myScores.vact > 0 && <span className={`font-bold ${myScores.vact >= school.vact ? 'text-green-400' : 'text-rose-400'}`}>Của bạn: {myScores.vact} {myScores.vact >= school.vact ? '✔' : '✘'}</span>}
                </div>
              )}
              {school.hsa && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background:'#10b981'}}></span>HSA: <b className="text-white">{school.hsa}</b></span>
                  {myScores.hsa > 0 && <span className={`font-bold ${myScores.hsa >= school.hsa ? 'text-green-400' : 'text-rose-400'}`}>Của bạn: {myScores.hsa.toFixed(1)} {myScores.hsa >= school.hsa ? '✔' : '✘'}</span>}
                </div>
              )}
            </div>
          </div>
          {/* Majors */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1.5">Ngành tiêu biểu</p>
            <div className="flex flex-wrap gap-1.5">
              {school.majors.map(m => (
                <span key={m} className="text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-slate-300">{m}</span>
              ))}
            </div>
          </div>
          {!anyMyScore && (
            <p className="text-[10px] text-slate-500 italic">💡 Nhập điểm trong tab Tính điểm để xem so sánh tự động</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────
export default function SchoolFinder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingScores, setLoadingScores] = useState(true);

  // ── Load my scores from Database (profiles.admission_scores) ──
  const [dbScores, setDbScores] = useState(null);

  useEffect(() => {
    const fetchScores = async () => {
      if (!user) {
        setLoadingScores(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('admission_scores')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        setDbScores(data?.admission_scores || {});
      } catch (err) {
        console.error("Error fetching admission scores:", err);
      } finally {
        setLoadingScores(false);
      }
    };
    fetchScores();
  }, [user]);

  const myScores = useMemo(() => {
    if (!dbScores) return { thpt: 0, vact: 0, tsa: 0, hsa: 0, hb: 0 };
    
    // Parse THPT & Transcript from DB
    const thpt = parseFloat(dbScores.thpt_exam_total) || 0;
    const hb = parseFloat(dbScores.thpt_transcript_total) || 0;
    
    // Fallback to localStorage for others temporarily
    const tsa  = parseFloat(localStorage.getItem('my_tsa') || '0') || 0;
    const hsa  = parseFloat(localStorage.getItem('my_hsa') || '0') || 0;
    const vact = parseFloat(localStorage.getItem('my_vact') || '0') || 0;

    return { thpt, vact, tsa, hsa, hb };
  }, [dbScores]);

  const [tab,      setTab]      = useState('school');   // school | major | score | fee
  const [region,   setRegion]   = useState('all');
  const [query,    setQuery]    = useState('');
  const [type,     setType]     = useState('all');      // all | public | private
  const [maxFee,   setMaxFee]   = useState(300);
  const [method,   setMethod]   = useState('all');      // all | thpt | tsa | vact | hsa | hb
  const [minScore, setMinScore] = useState('');

  // ── Derived list ──
  const filtered = useMemo(() => {
    return SCHOOLS.filter(s => {
      if (region !== 'all' && s.region !== region) return false;
      if (type !== 'all' && s.type !== type) return false;
      if (query && !s.name.toLowerCase().includes(query.toLowerCase()) && !s.code.toLowerCase().includes(query.toLowerCase())) return false;
      if (method !== 'all' && !s.methods.includes(method)) return false;
      if (tab === 'fee' && s.fee > maxFee) return false;
      if (tab === 'score' && minScore) {
        const ms = parseFloat(minScore);
        if (method === 'thpt' && s.thpt && s.thpt > ms) return false;
        if (method === 'tsa'  && s.tsa  && s.tsa  > ms) return false;
        if (method === 'vact' && s.vact && s.vact > ms) return false;
        if (method === 'hsa'  && s.hsa  && s.hsa  > ms) return false;
      }
      return true;
    });
  }, [region, query, type, method, tab, maxFee, minScore]);

  // Sort: qualified first
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const qa = (a.thpt && myScores.thpt >= a.thpt) || (a.tsa && myScores.tsa >= a.tsa) || (a.vact && myScores.vact >= a.vact) || (a.hsa && myScores.hsa >= a.hsa) || (a.hb && myScores.hb >= a.hb);
      const qb = (b.thpt && myScores.thpt >= b.thpt) || (b.tsa && myScores.tsa >= b.tsa) || (b.vact && myScores.vact >= b.vact) || (b.hsa && myScores.hsa >= b.hsa) || (b.hb && myScores.hb >= b.hb);
      if (qa && !qb) return -1;
      if (!qa && qb) return 1;
      return 0;
    });
  }, [filtered, myScores]);

  const hasAnyScore = myScores.thpt > 0 || myScores.tsa > 0 || myScores.vact > 0 || myScores.hsa > 0 || myScores.hb > 0;

  return (
    <div className="bg-[#0b0f1a] text-white min-h-screen pb-24 font-display">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(at_30%_0%,rgba(48,110,232,0.10)_0,transparent_60%)]" />

      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-4 flex items-center justify-between bg-[#0f172a]/80 backdrop-blur-md border-b border-white/10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center hover:bg-slate-700 transition-colors">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight">Tìm trường phù hợp</h1>
        <div className="w-10" />
      </header>

      <main className="w-full max-w-2xl mx-auto px-4 pt-5 pb-12 space-y-4 relative z-10">

        {/* My Score Banner */}
        {hasAnyScore ? (
          <div className="bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-green-400 text-lg">verified</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-green-300">Điểm của bạn đã tải từ trang Tính điểm</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {myScores.thpt > 0 && <span className="text-[10px] text-slate-300 bg-[#306ee8]/15 border border-[#306ee8]/25 rounded px-1.5 py-0.5">THPT {myScores.thpt.toFixed(2)}</span>}
                {myScores.hb > 0 && <span className="text-[10px] text-slate-300 bg-[#f59e0b]/15 border border-[#f59e0b]/25 rounded px-1.5 py-0.5">Học bạ {myScores.hb.toFixed(2)}</span>}
                {myScores.vact > 0 && <span className="text-[10px] text-slate-300 bg-[#e36488]/15 border border-[#e36488]/25 rounded px-1.5 py-0.5">VACT {myScores.vact}</span>}
                {myScores.tsa  > 0 && <span className="text-[10px] text-slate-300 bg-[#8b5cf6]/15 border border-[#8b5cf6]/25 rounded px-1.5 py-0.5">TSA {myScores.tsa.toFixed(1)}</span>}
                {myScores.hsa  > 0 && <span className="text-[10px] text-slate-300 bg-[#10b981]/15 border border-[#10b981]/25 rounded px-1.5 py-0.5">HSA {myScores.hsa.toFixed(1)}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-400 text-lg">info</span>
            <div>
              <p className="text-xs text-amber-300 font-semibold">Chưa có điểm</p>
              <p className="text-[10px] text-slate-400">Vào <button onClick={() => navigate('/gpa')} className="underline text-amber-400">Tính điểm</button> để nhập điểm và tự động so sánh với điểm chuẩn</p>
            </div>
          </div>
        )}

        {/* ── Tab row ── */}
        <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-[#0f172a]/60 border border-white/10 rounded-2xl">
          {[
            { id: 'school', icon: 'apartment',    label: 'Tìm trường' },
            { id: 'major',  icon: 'school',       label: 'Tìm ngành'  },
            { id: 'score',  icon: 'grade',        label: 'Theo điểm'  },
            { id: 'fee',    icon: 'payments',     label: 'Học phí'    },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`py-2.5 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1 transition-all ${tab === t.id ? 'bg-[#306ee8] text-white shadow-lg shadow-[#306ee8]/30' : 'text-slate-500 hover:text-white'}`}>
              <span className="material-symbols-outlined text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Search box ── */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-base">search</span>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Nhập tên trường hoặc mã trường..."
            className="w-full pl-10 pr-4 py-3 bg-[#0f172a]/80 border border-white/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-[#306ee8]/40 placeholder:text-slate-500 transition-all" />
        </div>

        {/* ── Filter row: region ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {REGIONS.map(r => (
            <button key={r.id} onClick={() => setRegion(r.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${region === r.id ? 'bg-[#306ee8] text-white border-[#306ee8]' : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'}`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* ── Extra filters depending on tab ── */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Type */}
          <select value={type} onChange={e => setType(e.target.value)}
            className="text-xs bg-white/5 border border-white/10 text-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#306ee8]">
            <option value="all" className="bg-[#0b0f1a]">Loại trường</option>
            <option value="public" className="bg-[#0b0f1a]">Công lập</option>
            <option value="private" className="bg-[#0b0f1a]">Ngoài CL</option>
            <option value="college" className="bg-[#0b0f1a]">Cao đẳng</option>
          </select>

          {/* Method */}
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="text-xs bg-white/5 border border-white/10 text-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#306ee8]">
            <option value="all"  className="bg-[#0b0f1a]">Tất cả phương thức</option>
            <option value="thpt" className="bg-[#0b0f1a]">THPT Quốc gia</option>
            <option value="tsa"  className="bg-[#0b0f1a]">TSA (Bách Khoa HN)</option>
            <option value="vact" className="bg-[#0b0f1a]">VACT (ĐHQG HCM)</option>
            <option value="hsa"  className="bg-[#0b0f1a]">HSA (ĐHQG HN)</option>
            <option value="hb"   className="bg-[#0b0f1a]">Học bạ</option>
          </select>

          {/* Score filter (tab=score) */}
          {tab === 'score' && (
            <input type="number" value={minScore} onChange={e => setMinScore(e.target.value)} placeholder="Điểm của bạn"
              className="text-xs bg-white/5 border border-white/10 text-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#306ee8] w-32" />
          )}

          {/* Fee filter (tab=fee) */}
          {tab === 'fee' && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Học phí ≤</span>
              <input type="number" value={maxFee} onChange={e => setMaxFee(Number(e.target.value))}
                className="w-20 bg-white/5 border border-white/10 text-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#306ee8]" />
              <span>tr/năm</span>
            </div>
          )}
        </div>

        {/* ── Result count ── */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-400">
            <span className="font-bold text-white">{sorted.length}</span> trường phù hợp
            {hasAnyScore && <span className="text-green-400 ml-2">· <span className="font-bold">{sorted.filter(s => (s.thpt && myScores.thpt >= s.thpt) || (s.tsa && myScores.tsa >= s.tsa) || (s.vact && myScores.vact >= s.vact) || (s.hsa && myScores.hsa >= s.hsa)).length}</span> bạn đủ điều kiện</span>}
          </p>
          {hasAnyScore && <span className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Đủ điều kiện lên trước</span>}
        </div>

        {/* ── School list ── */}
        <div className="space-y-3">
          {sorted.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <span className="material-symbols-outlined text-5xl block mb-3">search_off</span>
              <p className="text-sm">Không tìm thấy trường phù hợp</p>
              <p className="text-xs mt-1">Thử bỏ bớt bộ lọc</p>
            </div>
          ) : (
            sorted.map(s => <SchoolCard key={s.id} school={s} myScores={myScores} />)
          )}
        </div>

      </main>
    </div>
  );
}
