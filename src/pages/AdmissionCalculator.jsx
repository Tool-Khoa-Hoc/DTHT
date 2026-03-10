import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ==================== TABS CONFIG ====================
const TABS = [
  { id: 'hsa',  label: 'HSA',  full: 'ĐGNL ĐHQG HCM', color: '#e36488' },
  { id: 'vact', label: 'VACT', full: 'ĐGNL ĐHQG HN',   color: '#8b5cf6' },
  { id: 'tsa',  label: 'TSA',  full: 'ĐGTD Bách Khoa', color: '#306ee8' },
  { id: 'bca',  label: 'BCA',  full: 'ĐGNL Bộ Công An', color: '#10b981' },
];

// ==================== HSA CALCULATOR ====================
// Đánh giá năng lực ĐHQG HCM (HSA) - Thang 1200 điểm
// Phần 1: Ngôn ngữ (TV 300 + EN 300 = 600), P2: Toán 300, P3: Tư duy KH 300
function HSACalculator() {
  const [tv, setTv] = useState('');
  const [en, setEn] = useState('');
  const [toan, setToan] = useState('');
  const [kh, setKh] = useState('');

  const total = (parseFloat(tv)||0) + (parseFloat(en)||0) + (parseFloat(toan)||0) + (parseFloat(kh)||0);
  const quyDoi30 = ((total / 1200) * 30).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="bg-[#e36488]/10 border border-[#e36488]/20 rounded-xl p-4 text-sm text-slate-300 space-y-1">
        <p className="font-bold text-[#e36488] text-base">Bài thi ĐGNL – ĐHQG TP.HCM (HSA)</p>
        <p>📝 120 câu trắc nghiệm · Làm bài 150 phút</p>
        <p>📊 Thang điểm: <b>1200 điểm</b> · Sử dụng IRT (trọng số theo độ khó)</p>
        <p>💡 Điểm quy đổi hệ 30: <b>Điểm HSA × 30 / 1200</b></p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tiếng Việt (0–300)" value={tv} onChange={setTv} max={300} color="#e36488" />
        <Field label="Tiếng Anh (0–300)" value={en} onChange={setEn} max={300} color="#e36488" />
        <Field label="Toán học (0–300)" value={toan} onChange={setToan} max={300} color="#e36488" />
        <Field label="Tư duy KH (0–300)" value={kh} onChange={setKh} max={300} color="#e36488" />
      </div>

      <ScoreResult total={total} maxTotal={1200} quyDoi={quyDoi30} label="Tổng điểm HSA" color="#e36488" />
    </div>
  );
}

// ==================== VACT CALCULATOR ====================
// Đánh giá năng lực ĐHQG HN (VACT) - Thang 1200 điểm
// TV 300 + EN 300 + Toán 300 + Tư duy KH 300
function VACTCalculator() {
  const [tv, setTv] = useState('');
  const [en, setEn] = useState('');
  const [toan, setToan] = useState('');
  const [kh, setKh] = useState('');

  const total = (parseFloat(tv)||0) + (parseFloat(en)||0) + (parseFloat(toan)||0) + (parseFloat(kh)||0);
  const quyDoi30 = ((total / 1200) * 30).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 rounded-xl p-4 text-sm text-slate-300 space-y-1">
        <p className="font-bold text-[#8b5cf6] text-base">Bài thi ĐGNL – ĐHQG Hà Nội (VACT)</p>
        <p>📝 120 câu trắc nghiệm · Làm bài 150 phút · Thi trên giấy</p>
        <p>📊 Thang điểm: <b>1200 điểm</b> · Sử dụng IRT (trọng số theo độ khó)</p>
        <p>💡 Điểm quy đổi hệ 30: <b>Điểm VACT × 30 / 1200</b></p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tiếng Việt (0–300)" value={tv} onChange={setTv} max={300} color="#8b5cf6" />
        <Field label="Tiếng Anh (0–300)" value={en} onChange={setEn} max={300} color="#8b5cf6" />
        <Field label="Toán học (0–300)" value={toan} onChange={setToan} max={300} color="#8b5cf6" />
        <Field label="Tư duy KH (0–300)" value={kh} onChange={setKh} max={300} color="#8b5cf6" />
      </div>

      <ScoreResult total={total} maxTotal={1200} quyDoi={quyDoi30} label="Tổng điểm VACT" color="#8b5cf6" />
    </div>
  );
}

// ==================== TSA CALCULATOR ====================
// Đánh giá tư duy Bách Khoa HN (TSA) - Thang 100 điểm
// Toán: 40đ, Đọc hiểu: 20đ, KHTN/GQVĐ: 40đ
function TSACalculator() {
  const [toan, setToan] = useState('');
  const [doc, setDoc] = useState('');
  const [kh, setKh] = useState('');
  const [uuTien, setUuTien] = useState('');

  const total = (parseFloat(toan)||0) + (parseFloat(doc)||0) + (parseFloat(kh)||0);
  const totalWithPriority = Math.min(total + (parseFloat(uuTien)||0), 100);

  return (
    <div className="space-y-6">
      <div className="bg-[#306ee8]/10 border border-[#306ee8]/20 rounded-xl p-4 text-sm text-slate-300 space-y-1">
        <p className="font-bold text-[#306ee8] text-base">Bài thi ĐGTD – Bách Khoa Hà Nội (TSA)</p>
        <p>📝 Thi trên máy tính · 150 phút</p>
        <p>📊 Thang điểm: <b>100 điểm</b></p>
        <p>🔢 Toán: 40đ · Đọc hiểu: 20đ · KH/GQVĐ: 40đ</p>
        <p>💡 Kết quả có giá trị sử dụng trong <b>2 năm</b></p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tư duy Toán (0–40)" value={toan} onChange={setToan} max={40} color="#306ee8" />
        <Field label="Tư duy Đọc hiểu (0–20)" value={doc} onChange={setDoc} max={20} color="#306ee8" />
        <Field label="KH / Giải quyết VĐ (0–40)" value={kh} onChange={setKh} max={40} color="#306ee8" />
        <Field label="Điểm ưu tiên (+)" value={uuTien} onChange={setUuTien} max={10} color="#64748b" />
      </div>

      <ScoreResult total={total} maxTotal={100} quyDoi={null} totalWithPriority={totalWithPriority} label="Tổng điểm TSA" color="#306ee8" />
    </div>
  );
}

// ==================== BCA CALCULATOR ====================
// Bài thi Đánh giá năng lực – Bộ Công An (BCA) - Thang 100 điểm
// Tự luận 25 + Toán 35 + Sử 10 + NN 15 + Tự chọn 15 = 100
// Công thức xét tuyển: ĐXT = (M1+M2+M3)*2/5 + BCA*3/5 + ĐC
function BCACalculator() {
  const [tuLuan, setTuLuan] = useState('');
  const [toan, setToan] = useState('');
  const [lich, setLich] = useState('');
  const [nn, setNn] = useState('');
  const [tuChon, setTuChon] = useState('');

  // For admission formula (Method 3)
  const [m1, setM1] = useState('');
  const [m2, setM2] = useState('');
  const [m3, setM3] = useState('');
  const [dc, setDc] = useState('');

  const bcaScore = (parseFloat(tuLuan)||0) + (parseFloat(toan)||0) + (parseFloat(lich)||0) + (parseFloat(nn)||0) + (parseFloat(tuChon)||0);
  
  const sumThpt = (parseFloat(m1)||0) + (parseFloat(m2)||0) + (parseFloat(m3)||0);
  const admissionScore = (sumThpt * (2/5) + bcaScore * (3/5) + (parseFloat(dc)||0)).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl p-4 text-sm text-slate-300 space-y-1">
        <p className="font-bold text-[#10b981] text-base">Bài thi ĐGNL – Bộ Công An (BCA)</p>
        <p>📝 Thi viết · 180 phút · <b>100 điểm</b></p>
        <p>📋 Nghị luận XH: 25đ · Toán TN: 35đ · Lịch Sử: 10đ · NN: 15đ · Tự chọn: 15đ</p>
        <p>🔢 <b>Công thức XT P3: </b>ĐXT = (M1+M2+M3)×2/5 + BCA×3/5 + ĐC</p>
      </div>

      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold px-1">Điểm từng phần bài thi BCA</p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nghị luận XH (0–25)" value={tuLuan} onChange={setTuLuan} max={25} color="#10b981" />
        <Field label="Toán học TN (0–35)" value={toan} onChange={setToan} max={35} color="#10b981" />
        <Field label="Lịch Sử (0–10)" value={lich} onChange={setLich} max={10} color="#10b981" />
        <Field label="Ngoại Ngữ (0–15)" value={nn} onChange={setNn} max={15} color="#10b981" />
        <Field label="Môn tự chọn (0–15)" value={tuChon} onChange={setTuChon} max={15} color="#10b981" hintText="Lý / Hóa / Sinh / Địa" />
      </div>

      <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between">
        <p className="text-slate-300 font-semibold">Tổng điểm BCA</p>
        <span className="text-2xl font-extrabold text-[#10b981]">{bcaScore.toFixed(1)} <span className="text-slate-500 text-base font-medium">/ 100</span></span>
      </div>

      <div className="border-t border-white/10 pt-4 space-y-4">
        <p className="text-xs uppercase tracking-widest text-slate-400 font-bold px-1">Tính điểm xét tuyển (Phương thức 3)</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="M1 - Môn 1 (0–10)" value={m1} onChange={setM1} max={10} color="#64748b" />
          <Field label="M2 - Môn 2 (0–10)" value={m2} onChange={setM2} max={10} color="#64748b" />
          <Field label="M3 - Môn 3 (0–10)" value={m3} onChange={setM3} max={10} color="#64748b" />
          <Field label="Điểm ưu tiên (+ĐC)" value={dc} onChange={setDc} max={3.5} color="#64748b" />
        </div>
        <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs">Điểm xét tuyển cuối cùng</p>
            <p className="text-slate-500 text-[10px] mt-0.5">= (M1+M2+M3)×2/5 + BCA×3/5 + ĐC</p>
          </div>
          <span className="text-3xl font-extrabold text-[#10b981]">{admissionScore}</span>
        </div>
      </div>
    </div>
  );
}

// ==================== SHARED COMPONENTS ====================
function Field({ label, value, onChange, max, color, hintText }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 text-slate-400">{label}</label>
      {hintText && <p className="text-[10px] text-slate-500 mb-1">{hintText}</p>}
      <input
        type="number"
        min="0"
        max={max}
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white outline-none focus:ring-2 transition-all"
        style={{ '--tw-ring-color': color }}
        placeholder="0"
      />
    </div>
  );
}

function ScoreResult({ total, maxTotal, quyDoi, totalWithPriority, label, color }) {
  const pct = Math.min((total / maxTotal) * 100, 100);
  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}15, transparent)` }}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
            <p className="text-4xl font-extrabold text-white mt-1">
              {total.toLocaleString('vi-VN')}
              <span className="text-slate-500 text-lg font-medium"> / {maxTotal.toLocaleString('vi-VN')}</span>
            </p>
          </div>

          {/* Ring */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={color} strokeWidth="6"
                strokeDasharray="213.6"
                strokeDashoffset={213.6 - (213.6 * pct) / 100}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>
            <span className="absolute text-sm font-bold text-white">{Math.round(pct)}%</span>
          </div>
        </div>

        {quyDoi && (
          <div className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-slate-400 text-sm">Quy đổi hệ 30</p>
            <p className="font-extrabold text-white text-xl">{quyDoi} <span className="text-slate-500 text-sm font-medium">/ 30</span></p>
          </div>
        )}

        {totalWithPriority !== undefined && (
          <div className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-slate-400 text-sm">Điểm sau ưu tiên</p>
            <p className="font-extrabold text-white text-xl">{totalWithPriority.toFixed(1)} <span className="text-slate-500 text-sm font-medium">/ 100</span></p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== MAIN PAGE ====================
export default function AdmissionCalculator() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('hsa');

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="bg-[#0b0f1a] font-display text-white min-h-screen pb-24">
      <div className="fixed inset-0 bg-[radial-gradient(at_0%_0%,rgba(227,100,136,0.12)_0,transparent_55%),radial-gradient(at_100%_0%,rgba(48,110,232,0.12)_0,transparent_55%)] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-4 flex items-center justify-between bg-[#0f172a]/80 backdrop-blur-md border-b border-white/10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center hover:bg-slate-700 transition-colors">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <div className="text-center">
          <h1 className="text-base font-bold tracking-tight text-white">Tính Điểm Xét Tuyển</h1>
          <p className="text-[11px] text-slate-400">Phương thức đặc biệt 2026</p>
        </div>
        <div className="w-10" />
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 relative z-10 space-y-6">
        {/* Tab Selector */}
        <div className="grid grid-cols-4 gap-2 bg-[#0f172a]/60 border border-white/10 rounded-2xl p-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center py-3 px-1 rounded-xl text-center transition-all ${
                activeTab === tab.id
                  ? 'text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={activeTab === tab.id ? { background: `${tab.color}22`, outline: `1.5px solid ${tab.color}55` } : {}}
            >
              <span className="text-sm font-extrabold" style={{ color: activeTab === tab.id ? tab.color : undefined }}>{tab.label}</span>
              <span className="text-[9px] font-medium mt-0.5 leading-tight opacity-70">{tab.full}</span>
            </button>
          ))}
        </div>

        {/* Active Tab Content */}
        <div className="bg-[#0f172a]/60 border border-white/10 rounded-2xl p-5">
          {activeTab === 'hsa'  && <HSACalculator  />}
          {activeTab === 'vact' && <VACTCalculator />}
          {activeTab === 'tsa'  && <TSACalculator  />}
          {activeTab === 'bca'  && <BCACalculator  />}
        </div>

        {/* Disclaimer */}
        <p className="text-[11px] text-slate-500 text-center pb-4">
          ⚠️ Điểm tham khảo. Kết quả thực tế tùy theo hệ thống IRT (HSA/VACT) và quy định từng trường.
        </p>
      </main>
    </div>
  );
}
