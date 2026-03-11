import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// =====================================================
// HELPERS
// =====================================================
function convertTo4(grade) {
  const g = parseFloat(grade) || 0;
  if (g >= 8.5) return 4.0; if (g >= 8.0) return 3.5;
  if (g >= 7.0) return 3.0; if (g >= 6.5) return 2.5;
  if (g >= 5.5) return 2.0; if (g >= 5.0) return 1.5;
  if (g >= 4.0) return 1.0; return 0.0;
}

function InputField({ label, hint, value, onChange, max, step = '0.1', placeholder = '0' }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 text-slate-400">{label}</label>
      {hint && <p className="text-[10px] text-slate-500 mb-1">{hint}</p>}
      <input type="number" min="0" max={max} step={step}
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/20 transition-all"
      />
    </div>
  );
}

function SubjectRow({ sub, index, label, onUpdate, onRemove }) {
  return (
    <div className="bg-[#0f172a]/60 backdrop-blur-md border border-white/10 rounded-xl p-4 flex items-center gap-3">
      <div className="flex-1 space-y-2">
        <input list="uni-subjects" className="w-full bg-transparent border-none p-0 text-white placeholder:text-slate-600 focus:ring-0 font-medium outline-none"
          placeholder={`Tên môn học ${index + 1}`} value={sub.name}
          onChange={e => onUpdate(sub.id, 'name', e.target.value)} />
        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Tín chỉ / Hệ số</p>
            <input type="number" min="0" step="0.5" value={sub.credits}
              onChange={e => onUpdate(sub.id, 'credits', e.target.value)}
              className="w-full bg-slate-800/50 border border-white/5 rounded-lg text-sm text-white py-1.5 px-3 outline-none focus:ring-1 focus:ring-white/20" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">{label}</p>
            <input type="number" min="0" max="10" step="0.1" value={sub.grade}
              onChange={e => onUpdate(sub.id, 'grade', e.target.value)}
              className="w-full bg-slate-800/50 border border-white/5 rounded-lg text-sm text-white py-1.5 px-3 outline-none focus:ring-1 focus:ring-white/20" />
          </div>
        </div>
      </div>
      <button onClick={() => onRemove(sub.id)} className="text-slate-500 hover:text-red-400 transition-colors p-2">
        <span className="material-symbols-outlined">delete</span>
      </button>
    </div>
  );
}

function RingResult({ score, max, color, label }) {
  const pct = Math.min((parseFloat(score) / max) * 100, 100);
  return (
    <div className="rounded-xl border border-white/10 p-5 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${color}18, transparent)` }}>
      <div>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
        <p className="text-4xl font-extrabold text-white mt-1">
          {typeof score === 'number' ? score.toLocaleString('vi-VN') : score}
          <span className="text-lg text-slate-500 font-medium"> / {max.toLocaleString('vi-VN')}</span>
        </p>
      </div>
      <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle cx="40" cy="40" r="34" fill="none" stroke={color}
            strokeWidth="6" strokeDasharray="213.6" strokeDashoffset={213.6 - (213.6 * pct) / 100}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
        </svg>
        <span className="absolute text-sm font-bold text-white">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

// =====================================================
// THPT & Học bạ Calculators
// =====================================================
function THPTCalc() {
  const [mode, setMode] = useState('exam');

  return (
    <div className="space-y-4">
      <div className="flex bg-[#0f172a]/60 backdrop-blur-md border border-white/10 rounded-xl p-1 gap-1">
        <button onClick={() => setMode('exam')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'exam' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30' : 'text-slate-400 hover:text-white'}`}>
          Điểm thi theo tổ hợp
        </button>
        <button onClick={() => setMode('transcript')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'transcript' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : 'text-slate-400 hover:text-white'}`}>
          Điểm học bạ
        </button>
      </div>

      {mode === 'exam' ? <THPTExamCalc /> : <THPTTranscriptCalc />}
    </div>
  );
}

function THPTExamCalc() {
  const { user, profile } = useAuth();
  const admissionScoresRef = React.useRef(null);
  const [subjects, setSubjects] = useState([
    { id: 1, name: 'Toán', grade: 0 },
    { id: 2, name: 'Ngữ văn', grade: 0 },
    { id: 3, name: 'Tiếng Anh', grade: 0 }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (profile?.admission_scores?.thpt_exam) {
      setSubjects(profile.admission_scores.thpt_exam);
    }
    // Cache the full admission_scores object for merge during save
    admissionScoresRef.current = profile?.admission_scores || {};
  }, [profile]);

  const update = (id, f, v) => setSubjects(s => s.map(x => x.id === id ? { ...x, [f]: v } : x));
  const add = () => setSubjects(s => [...s, { id: Date.now(), name: '', grade: 0 }]);
  const remove = (id) => { if (subjects.length > 1) setSubjects(s => s.filter(x => x.id !== id)); };

  const total = subjects.reduce((a, s) => a + (parseFloat(s.grade) || 0), 0);
  const maxScore = subjects.length * 10;

  const handleSave = async () => {
    if (!user) { setMessage('Đăng nhập để lưu.'); return; }
    setIsSaving(true);
    setMessage('');
    try {
      const currentScores = admissionScoresRef.current || {};

      const { error } = await supabase.from('profiles').update({
        admission_scores: {
          ...currentScores,
          thpt_exam: subjects,
          thpt_exam_total: total.toFixed(2)
        }
      }).eq('id', user.id);

      if (error) throw error;
      // Update local cache after successful save
      admissionScoresRef.current = { ...currentScores, thpt_exam: subjects, thpt_exam_total: total.toFixed(2) };
      setMessage('Đã lưu điểm thành công!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Lỗi khi lưu điểm.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <RingResult score={total.toFixed(2)} max={maxScore} color="#f43f5e" label="Tổng điểm xét tuyển" />
      <div className="space-y-3">
        {subjects.map((sub, i) => (
          <div key={sub.id} className="bg-[#0f172a]/60 backdrop-blur-md border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3">
            <input list="thpt-subjects" className="w-1/2 bg-transparent border-none p-0 text-white placeholder:text-slate-600 focus:ring-0 font-bold text-sm outline-none"
              placeholder={`Tên môn thi ${i + 1}`} value={sub.name}
              onChange={e => update(sub.id, 'name', e.target.value)} />
            <div className="flex items-center gap-3">
              <div className="w-24">
                <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Điểm thi</p>
                <input type="number" min="0" max="10" step="0.1" value={sub.grade}
                  onChange={e => update(sub.id, 'grade', e.target.value)}
                  className="w-full bg-slate-800/50 border border-white/5 rounded-lg text-sm text-white py-1.5 px-3 outline-none focus:ring-1 focus:ring-rose-500" />
              </div>
              <button onClick={() => remove(sub.id)} className="text-slate-500 hover:text-red-400 transition-colors mt-4">
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
        ))}
        <button onClick={add} className="w-full py-3.5 border-2 border-dashed border-slate-700/50 rounded-xl text-slate-400 hover:text-white hover:border-rose-400/40 transition-all flex items-center justify-center gap-2 group">
          <span className="material-symbols-outlined text-rose-400 group-hover:scale-110 transition-transform">add_circle</span>
          <span className="font-semibold text-sm">Thêm môn thi</span>
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setSubjects([{ id: 1, name: 'Toán', grade: 0 }, { id: 2, name: 'Ngữ văn', grade: 0 }, { id: 3, name: 'Tiếng Anh', grade: 0 }])}
          className="w-1/3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-base">restart_alt</span> Đặt lại
        </button>
        <button onClick={handleSave} disabled={isSaving}
          className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-bold shadow-lg shadow-rose-500/30 hover:bg-rose-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
          <span className="material-symbols-outlined text-base">{isSaving ? 'sync' : 'save'}</span>
          {isSaving ? 'Đang lưu...' : 'Lưu điểm thi'}
        </button>
      </div>
      {message && <p className="text-center text-xs font-medium text-green-400">{message}</p>}
    </div>
  );
}

function THPTTranscriptCalc() {
  const { user, profile } = useAuth();
  const admissionScoresRef = React.useRef(null);
  const [subjects, setSubjects] = useState([
    { id: 1, name: 'Toán', grade10: 0, grade11: 0, grade12: 0 },
    { id: 2, name: 'Ngữ văn', grade10: 0, grade11: 0, grade12: 0 },
    { id: 3, name: 'Tiếng Anh', grade10: 0, grade11: 0, grade12: 0 }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (profile?.admission_scores?.thpt_transcript) {
      setSubjects(profile.admission_scores.thpt_transcript);
    }
    admissionScoresRef.current = profile?.admission_scores || {};
  }, [profile]);

  const update = (id, f, v) => setSubjects(s => s.map(x => x.id === id ? { ...x, [f]: v } : x));
  const add = () => setSubjects(s => [...s, { id: Date.now(), name: '', grade10: 0, grade11: 0, grade12: 0 }]);
  const remove = (id) => { if (subjects.length > 1) setSubjects(s => s.filter(x => x.id !== id)); };

  const p = (v) => parseFloat(v) || 0;

  // Total Combination Score = Subject 1 Avg + Subject 2 Avg + Subject 3 Avg
  const sumAvg = subjects.reduce((acc, s) => acc + ((p(s.grade10) + p(s.grade11) + p(s.grade12)) / 3), 0);

  const maxCombinationScore = subjects.length * 10;

  const handleSave = async () => {
    if (!user) { setMessage('Đăng nhập để lưu.'); return; }
    setIsSaving(true);
    setMessage('');
    try {
      const currentScores = admissionScoresRef.current || {};

      const { error } = await supabase.from('profiles').update({
        admission_scores: {
          ...currentScores,
          thpt_transcript: subjects,
          thpt_transcript_total: sumAvg.toFixed(2)
        }
      }).eq('id', user.id);

      if (error) throw error;
      admissionScoresRef.current = { ...currentScores, thpt_transcript: subjects, thpt_transcript_total: sumAvg.toFixed(2) };
      setMessage('Đã lưu điểm thành công!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Lỗi khi lưu điểm.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <RingResult score={sumAvg.toFixed(2)} max={maxCombinationScore} color="#f59e0b" label="Tổng điểm xét học bạ" />
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
        <span className="material-symbols-outlined text-amber-500 text-base shrink-0">info</span>
        <p className="text-amber-200/90 text-xs mt-0.5">Nhập điểm Trung bình cả năm lớp 10, 11 và 12 của từng môn trong tổ hợp xét tuyển. Điểm tổng là tổng trung bình 3 năm của các môn.</p>
      </div>

      <div className="space-y-3">
        {subjects.map((sub, i) => {
          const sAvg = ((p(sub.grade10) + p(sub.grade11) + p(sub.grade12)) / 3).toFixed(2);
          return (
            <div key={sub.id} className="bg-[#0f172a]/60 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <input list="thpt-subjects" className="w-2/3 bg-transparent border-none p-0 text-white placeholder:text-slate-600 focus:ring-0 font-bold text-sm outline-none"
                  placeholder={`Tên môn xét tuyển ${i + 1}`} value={sub.name}
                  onChange={e => update(sub.id, 'name', e.target.value)} />
                <button onClick={() => remove(sub.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Lớp 10</label>
                  <input type="number" min="0" max="10" step="0.1" value={sub.grade10} onChange={e => update(sub.id, 'grade10', e.target.value)}
                    className="w-full mt-1 bg-slate-800/50 border border-white/5 rounded-lg text-sm text-white py-1.5 px-2 outline-none focus:ring-1 focus:ring-amber-500 text-center" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Lớp 11</label>
                  <input type="number" min="0" max="10" step="0.1" value={sub.grade11} onChange={e => update(sub.id, 'grade11', e.target.value)}
                    className="w-full mt-1 bg-slate-800/50 border border-white/5 rounded-lg text-sm text-white py-1.5 px-2 outline-none focus:ring-1 focus:ring-amber-500 text-center" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Lớp 12</label>
                  <input type="number" min="0" max="10" step="0.1" value={sub.grade12} onChange={e => update(sub.id, 'grade12', e.target.value)}
                    className="w-full mt-1 bg-slate-800/50 border border-white/5 rounded-lg text-sm text-white py-1.5 px-2 outline-none focus:ring-1 focus:ring-amber-500 text-center" />
                </div>
              </div>
              <div className="text-right text-xs mt-1 border-t border-white/5 pt-2">
                <span className="text-slate-400">TBM: </span><span className="font-bold text-amber-400 text-sm">{sAvg}</span>
              </div>
            </div>
          );
        })}

        <button onClick={add} className="w-full py-3.5 border-2 border-dashed border-slate-700/50 rounded-xl text-slate-400 hover:text-white hover:border-amber-500/40 transition-all flex items-center justify-center gap-2 group">
          <span className="material-symbols-outlined text-amber-500 group-hover:scale-110 transition-transform">add_circle</span>
          <span className="font-semibold text-sm">Thêm môn xét tuyển</span>
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setSubjects([{ id: 1, name: 'Toán', grade10: 0, grade11: 0, grade12: 0 }, { id: 2, name: 'Ngữ văn', grade10: 0, grade11: 0, grade12: 0 }, { id: 3, name: 'Tiếng Anh', grade10: 0, grade11: 0, grade12: 0 }])}
          className="w-1/3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-base">restart_alt</span> Đặt lại
        </button>
        <button onClick={handleSave} disabled={isSaving}
          className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-500/30 hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
          <span className="material-symbols-outlined text-base">{isSaving ? 'sync' : 'save'}</span>
          {isSaving ? 'Đang lưu...' : 'Lưu điểm xét học bạ'}
        </button>
      </div>
      {message && <p className="text-center text-xs font-medium text-amber-400">{message}</p>}
    </div>
  );
}

// =====================================================
// ĐGNL Section
// =====================================================

// Shared input for BKHCMCalc (defined OUTSIDE to prevent remount on every render)
const NInput = React.memo(function NInput({ value, onChange, max = 10 }) {
  return (
    <input type="number" min="0" max={max} step="0.1" value={value}
      onChange={e => onChange(e.target.value)} placeholder="0"
      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white outline-none focus:ring-1 focus:ring-[#e36488]/50 transition-all" />
  );
});

function BLabel({ label, hint }) {
  return (
    <div className="mb-1">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}

// ── BK HCM Admission Score (Phương thức Xét tuyển Tổng hợp) ──
// Công thức (ảnh):
//  Điểm XeT = Điểm học lực + Điểm cộng + Điểm ưu tiên
//  Điểm học lực = Điểm năng lực×70% + TNTHPT_quy đổi×20% + HọcTHPT_quy đổi×10%
// ĐT 2.1 (CÓ ĐGNL): Điểm năng lực = [ĐGNL, Toán×2] / 15
// ĐT 2.2 (KHÔNG):   Điểm năng lực = TNTHPT_quy đổi × 0.75
// TNTHPT_quy đổi = (m1 [×2 if Toán] + m2 + m3) / 4 × 10
// HọcTHPT_quy đổi = (tb1 [×2 if Toán] + tb2 + tb3) / 4 × 10
function BKHCMCalc() {
  const SAVE_KEY = 'bkhcm_admission';

  const [hasDGNL, setHasDGNL] = useState(true);   // ĐT 2.1 vs 2.2
  const [toanX2, setToanX2] = useState(true);    // Toán × 2 trong tổ hợp
  const [saved, setSaved] = useState(false);

  // ĐGNL score parts (only used when hasDGNL)
  const [dgnlTV, setDgnlTV] = useState('');
  const [dgnlAnh, setDgnlAnh] = useState('');
  const [dgnlToan, setDgnlToan] = useState('');
  const [dgnlKH, setDgnlKH] = useState('');

  // THPT exam scores (3 môn, môn 1 = Toán nếu toanX2)
  const [thpt1, setThpt1] = useState('');
  const [thpt2, setThpt2] = useState('');
  const [thpt3, setThpt3] = useState('');

  // Học bạ TB (lớp 10, 11, 12)
  const [hb1, setHb1] = useState('');
  const [hb2, setHb2] = useState('');
  const [hb3, setHb3] = useState('');

  // Extra
  const [diemCong, setDiemCong] = useState('');
  const [uuTien, setUuTien] = useState('');

  // Load saved on mount
  useEffect(() => {
    const s = localStorage.getItem(SAVE_KEY);
    if (s) {
      try {
        const d = JSON.parse(s);
        if (d.hasDGNL !== undefined) setHasDGNL(d.hasDGNL);
        if (d.toanX2 !== undefined) setToanX2(d.toanX2);
        if (d.dgnlTV) setDgnlTV(d.dgnlTV);
        if (d.dgnlAnh) setDgnlAnh(d.dgnlAnh);
        if (d.dgnlToan) setDgnlToan(d.dgnlToan);
        if (d.dgnlKH) setDgnlKH(d.dgnlKH);
        if (d.thpt1) setThpt1(d.thpt1);
        if (d.thpt2) setThpt2(d.thpt2);
        if (d.thpt3) setThpt3(d.thpt3);
        if (d.hb1) setHb1(d.hb1);
        if (d.hb2) setHb2(d.hb2);
        if (d.hb3) setHb3(d.hb3);
        if (d.diemCong) setDiemCong(d.diemCong);
        if (d.uuTien) setUuTien(d.uuTien);
      } catch { }
    }
  }, []);

  // ─── Calculations (memoised so they only re-run when relevant deps change) ───
  const p = useCallback((v) => parseFloat(v) || 0, []);

  const { dgnlAdj, maxDGNL, divTHPT, tnthptQD, hbQD, diemNL, diemHL, diemXT } = useMemo(() => {
    const pf = (v) => parseFloat(v) || 0;
    const dgnlBase = pf(dgnlTV) + pf(dgnlAnh) + pf(dgnlToan) + pf(dgnlKH);
    const dgnlAdj = toanX2 ? dgnlBase + pf(dgnlToan) : dgnlBase;
    const maxDGNL = toanX2 ? 1500 : 1200;
    const divTHPT = toanX2 ? 4 : 3;
    const sumTHPT = toanX2 ? pf(thpt1) * 2 + pf(thpt2) + pf(thpt3) : pf(thpt1) + pf(thpt2) + pf(thpt3);
    const tnthptQD = (sumTHPT / divTHPT) * 10;
    const sumHB = toanX2 ? pf(hb1) * 2 + pf(hb2) + pf(hb3) : pf(hb1) + pf(hb2) + pf(hb3);
    const hbQD = (sumHB / divTHPT) * 10;
    const diemNL = hasDGNL ? Math.min(dgnlAdj / 15, 100) : tnthptQD * 0.75;
    const diemHL = diemNL * 0.7 + tnthptQD * 0.2 + hbQD * 0.1;
    const diemXT = diemHL + pf(diemCong) + pf(uuTien);
    return { dgnlAdj, maxDGNL, divTHPT, tnthptQD, hbQD, diemNL, diemHL, diemXT };
  }, [hasDGNL, toanX2, dgnlTV, dgnlAnh, dgnlToan, dgnlKH, thpt1, thpt2, thpt3, hb1, hb2, hb3, diemCong, uuTien]);

  const handleSave = useCallback(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      hasDGNL, toanX2, dgnlTV, dgnlAnh, dgnlToan, dgnlKH,
      thpt1, thpt2, thpt3, hb1, hb2, hb3, diemCong, uuTien,
      savedScore: diemXT.toFixed(2), savedAt: new Date().toISOString()
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [hasDGNL, toanX2, dgnlTV, dgnlAnh, dgnlToan, dgnlKH, thpt1, thpt2, thpt3, hb1, hb2, hb3, diemCong, uuTien, diemXT]);

  return (
    <div className="bg-[#0f172a]/60 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#e36488]/10 border-b border-[#e36488]/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-[#e36488] text-lg">apartment</span>
          <p className="font-bold text-sm text-white">ĐH Bách Khoa HCM – Điểm Xét tuyển Tổng hợp</p>
        </div>
        <p className="text-[10px] text-slate-400 pl-7">ĐXT = Học lực + Điểm cộng + Ưu tiên &nbsp;|&nbsp; Học lực = NL×70% + THPT×20% + HB×10%</p>
      </div>

      <div className="p-4 space-y-5">

        {/* Toggle ĐT 2.1 / 2.2 */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Đối tượng thí sinh</p>
          <div className="flex gap-2">
            <button onClick={() => setHasDGNL(true)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${hasDGNL ? 'bg-[#e36488]/20 border-[#e36488]/50 text-[#e36488]' : 'bg-white/3 border-white/10 text-slate-500 hover:text-white'}`}>
              ĐT 2.1 — CÓ ĐGNL ĐHQG-HCM
            </button>
            <button onClick={() => setHasDGNL(false)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${!hasDGNL ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-white/3 border-white/10 text-slate-500 hover:text-white'}`}>
              ĐT 2.2 — KHÔNG CÓ ĐGNL
            </button>
          </div>
        </div>

        {/* Toán × 2 toggle */}
        <div onClick={() => setToanX2(!toanX2)}
          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${toanX2 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/3 border-white/10 hover:border-white/20'}`}>
          <div>
            <p className={`text-sm font-semibold ${toanX2 ? 'text-blue-300' : 'text-slate-400'}`}>Toán trong tổ hợp (×2)</p>
            <p className="text-[10px] text-slate-500">Bật nếu tổ hợp của bạn có Toán (A00, A01, B00...)</p>
          </div>
          <div className={`w-10 h-5 rounded-full relative transition-all ${toanX2 ? 'bg-blue-500' : 'bg-slate-600'}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${toanX2 ? 'left-5' : 'left-0.5'}`} />
          </div>
        </div>

        {/* ĐGNL section (only ĐT 2.1) */}
        {hasDGNL && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">① Điểm ĐGNL ĐHQG-HCM (VACT)</p>
            <p className="text-[10px] text-slate-500 -mt-1">Nhập điểm từng phần bài thi (thang 300/phần)</p>
            <div className="grid grid-cols-2 gap-2">
              <div><BLabel label="Tiếng Việt (0–300)" /><NInput value={dgnlTV} onChange={setDgnlTV} max={300} /></div>
              <div><BLabel label="Tiếng Anh (0–300)" /><NInput value={dgnlAnh} onChange={setDgnlAnh} max={300} /></div>
              <div><BLabel label={toanX2 ? 'Toán × 2 (0–300)' : 'Toán (0–300)'} hint={toanX2 ? 'Nhân đôi tự động' : ''} />
                <NInput value={dgnlToan} onChange={setDgnlToan} max={300} /></div>
              <div><BLabel label="Tư duy KH (0–300)" /><NInput value={dgnlKH} onChange={setDgnlKH} max={300} /></div>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">ĐGNL {toanX2 ? '(Toán×2)' : ''} = {dgnlAdj} / {maxDGNL}</span>
              <span className="font-bold text-[#e36488]">Điểm NL = {Math.min(dgnlAdj / 15, 100).toFixed(2)} / 100</span>
            </div>
          </div>
        )}
        {!hasDGNL && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-xs text-amber-300">
            ĐT 2.2: Điểm năng lực = Điểm TNTHPT<sub>quy đổi</sub> × 0.75 (tính tự động bên dưới)
          </div>
        )}

        {/* THPT exam scores */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">② Điểm thi TNTHPT (3 môn trong tổ hợp)</p>
          <div className="grid grid-cols-3 gap-2">
            <div><BLabel label={toanX2 ? 'Toán ×2' : 'Môn 1'} hint="0–10" /><NInput value={thpt1} onChange={setThpt1} /></div>
            <div><BLabel label="Môn 2" hint="0–10" /><NInput value={thpt2} onChange={setThpt2} /></div>
            <div><BLabel label="Môn 3" hint="0–10" /><NInput value={thpt3} onChange={setThpt3} /></div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-xs flex items-center justify-between">
            <span className="text-slate-400">TNTHPT<sub>qđ</sub> = ({toanX2 ? 'Toán×2 + M2 + M3' : 'M1+M2+M3'}) / {divTHPT} × 10</span>
            <span className="font-bold text-white">{tnthptQD.toFixed(2)} / 100</span>
          </div>
        </div>

        {/* Học bạ TB lớp 10-12 */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">③ TB Học bạ lớp 10–12 (3 môn tổ hợp)</p>
          <p className="text-[10px] text-slate-500 -mt-1">Điểm trung bình cộng cả năm lớp 10, 11, 12</p>
          <div className="grid grid-cols-3 gap-2">
            <div><BLabel label={toanX2 ? 'TB Toán ×2' : 'TB Môn 1'} hint="0–10" /><NInput value={hb1} onChange={setHb1} /></div>
            <div><BLabel label="TB Môn 2" hint="0–10" /><NInput value={hb2} onChange={setHb2} /></div>
            <div><BLabel label="TB Môn 3" hint="0–10" /><NInput value={hb3} onChange={setHb3} /></div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-xs flex items-center justify-between">
            <span className="text-slate-400">HọcTHPT<sub>qđ</sub> = ({toanX2 ? 'TB Toán×2 + TB2 + TB3' : 'TB1+TB2+TB3'}) / {divTHPT} × 10</span>
            <span className="font-bold text-white">{hbQD.toFixed(2)} / 100</span>
          </div>
        </div>

        {/* Điểm cộng + Ưu tiên */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">Điểm cộng <span className="text-slate-500">(nếu có)</span></p>
            <NInput value={diemCong} onChange={setDiemCong} max={10} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">Điểm ưu tiên <span className="text-slate-500">(khu vực...)</span></p>
            <NInput value={uuTien} onChange={setUuTien} max={3.5} />
          </div>
        </div>

        {/* ── Result ── */}
        <div className="bg-gradient-to-br from-[#e36488]/20 to-transparent border border-[#e36488]/30 rounded-2xl p-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Kết quả</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/5 rounded-xl py-2 px-1">
              <p className="text-[9px] text-slate-500 uppercase">Điểm NL</p>
              <p className="text-lg font-extrabold text-white">{diemNL.toFixed(2)}</p>
              <p className="text-[8px] text-slate-500">/ 100</p>
            </div>
            <div className="bg-white/5 rounded-xl py-2 px-1">
              <p className="text-[9px] text-slate-500 uppercase">Học lực</p>
              <p className="text-lg font-extrabold text-white">{diemHL.toFixed(2)}</p>
              <p className="text-[8px] text-slate-500">/ 100</p>
            </div>
            <div className="bg-[#e36488]/20 rounded-xl py-2 px-1 border border-[#e36488]/30">
              <p className="text-[9px] text-[#e36488] uppercase font-bold">ĐXT</p>
              <p className="text-xl font-extrabold text-[#e36488]">{diemXT.toFixed(2)}</p>
              <p className="text-[8px] text-slate-500">điểm xét</p>
            </div>
          </div>

          <button onClick={handleSave}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${saved ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[#e36488]/20 hover:bg-[#e36488]/40 text-white border border-[#e36488]/30'}`}>
            <span className="material-symbols-outlined text-base">{saved ? 'check_circle' : 'save'}</span>
            {saved ? 'Đã lưu điểm!' : 'Lưu điểm xét tuyển'}
          </button>
        </div>

      </div>
    </div>
  );
}

function DGNLSection() {
  // ── TSA: direct score input (0-100, Bách Khoa HN) ──
  const [tsaScore, setTsaScore] = useState(() => localStorage.getItem('my_tsa') || '');
  const tsaPct = Math.min((parseFloat(tsaScore) || 0), 100);
  const handleTsa = v => { setTsaScore(v); localStorage.setItem('my_tsa', v); };

  // ── HSA: direct score input (0-150, ĐHQG HN) ──
  const [hsaScore, setHsaScore] = useState(() => localStorage.getItem('my_hsa') || '');
  const hsaQuy30 = (((parseFloat(hsaScore) || 0) / 150) * 30).toFixed(2);
  const handleHsa = v => { setHsaScore(v); localStorage.setItem('my_hsa', v); };

  return (
    <div className="space-y-6">

      {/* ──────── BK HCM Formula ──────── */}
      <BKHCMCalc />

      {/* ──────── TSA ──────── */}
      <div className="bg-[#0f172a]/60 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-[#306ee8]/10 border-b border-[#306ee8]/20 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#306ee8] text-lg">engineering</span>
          <div>
            <p className="font-bold text-sm text-white">TSA – Bách Khoa Hà Nội</p>
            <p className="text-[10px] text-slate-400">Tư duy Toán 40 + Đọc hiểu 20 + KH/GQVĐ 40 · Thang: <b className="text-[#306ee8]">100 điểm</b></p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <InputField label="Điểm TSA của bạn (0–100)" value={tsaScore} onChange={handleTsa} max={100} step="0.1" placeholder="Nhập điểm TSA..." />
          {tsaScore !== '' && (
            <div className="flex items-center justify-between bg-[#306ee8]/10 border border-[#306ee8]/20 rounded-xl px-4 py-3">
              <div>
                <p className="text-slate-300 text-sm font-semibold">Điểm TSA</p>
                <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden" style={{ width: '140px' }}>
                  <div className="h-full rounded-full bg-[#306ee8] transition-all" style={{ width: `${tsaPct}%` }} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-[#306ee8]">
                {parseFloat(tsaScore).toFixed(1)}<span className="text-slate-500 text-base font-medium"> / 100</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ──────── HSA ──────── */}
      <div className="bg-[#0f172a]/60 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-[#10b981]/10 border-b border-[#10b981]/20 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#10b981] text-lg">verified</span>
          <div>
            <p className="font-bold text-sm text-white">HSA – ĐHQG Hà Nội</p>
            <p className="text-[10px] text-slate-400">120 câu · 150 phút · Thang: <b className="text-[#10b981]">150 điểm</b></p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <InputField label="Điểm HSA của bạn (0–150)" value={hsaScore} onChange={handleHsa} max={150} step="0.1" placeholder="Nhập điểm HSA..." />
          {hsaScore !== '' && (
            <div className="flex items-center justify-between bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl px-4 py-3">
              <div>
                <p className="text-slate-300 text-sm font-semibold">Quy đổi hệ 30</p>
                <p className="text-[10px] text-slate-500">= HSA × 30 / 150</p>
              </div>
              <p className="text-3xl font-extrabold text-[#10b981]">
                {hsaQuy30}<span className="text-slate-500 text-base font-medium"> / 30</span>
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}



// =====================================================
// TAB A – THPT & ĐGNL (two sub-modes)
// =====================================================
function THPTSection() {
  const [mode, setMode] = useState('thpt');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { id: 'thpt', icon: 'menu_book', label: 'Điểm THPT' },
          { id: 'dgnl', icon: 'psychology', label: 'Đánh giá Năng lực' },
        ].map(opt => (
          <button key={opt.id} onClick={() => setMode(opt.id)}
            className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${mode === opt.id
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                : 'bg-white/3 border-white/10 text-slate-500 hover:text-white hover:border-white/20'
              }`}
          >
            <span className="material-symbols-outlined text-sm">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>

      {mode === 'thpt' && <THPTCalc />}
      {mode === 'dgnl' && <DGNLSection />}
    </div>
  );
}

// =====================================================
// TAB B – GPA Đại học (semester + Supabase)
// =====================================================
function UniCalc() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([{ id: 1, name: '', credits: 2, grade: 0 }]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [semesters, setSemesters] = useState([]);
  const [selectedSem, setSelSem] = useState('');
  const [newSemName, setNewSem] = useState('');
  const [isCreating, setCreating] = useState(false);
  const [isRenaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');

  useEffect(() => { if (user) loadSems(); }, [user]);
  useEffect(() => {
    if (selectedSem) loadSubs(selectedSem);
    else setSubjects([{ id: Date.now(), name: '', credits: 2, grade: 0 }]);
  }, [selectedSem]);

  const loadSems = async () => {
    const { data } = await supabase.from('semesters').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setSemesters(data || []);
    if (data?.length > 0 && !selectedSem) setSelSem(data[0].id);
  };
  const loadSubs = async (id) => {
    const { data } = await supabase.from('subjects').select('*').eq('semester_id', id).order('created_at');
    if (data?.length > 0) setSubjects(data.map(s => ({ id: s.id, name: s.name, credits: s.credits, grade: s.grade_number })));
    else setSubjects([{ id: Date.now(), name: '', credits: 2, grade: 0 }]);
  };
  const createSem = async () => {
    if (!newSemName.trim()) return;
    setCreating(true);
    const { data } = await supabase.from('semesters').insert([{ user_id: user.id, name: newSemName.trim(), status: 'in_progress', gpa: 0 }]).select('id').single();
    setNewSem(''); await loadSems(); if (data?.id) setSelSem(data.id);
    setCreating(false);
  };
  const renameSem = async () => {
    if (!renameVal.trim()) return;
    await supabase.from('semesters').update({ name: renameVal.trim() }).eq('id', selectedSem).eq('user_id', user.id);
    setRenaming(false); await loadSems();
  };

  const update = (id, f, v) => setSubjects(s => s.map(x => x.id === id ? { ...x, [f]: v } : x));
  const add = () => setSubjects(s => [...s, { id: Date.now(), name: '', credits: 2, grade: 0 }]);
  const remove = (id) => { if (subjects.length > 1) setSubjects(s => s.filter(x => x.id !== id)); };

  const calcGPA = () => {
    let tc = 0, ts = 0;
    subjects.forEach(s => { const cr = parseFloat(s.credits) || 0; tc += cr; ts += cr * convertTo4(s.grade); });
    return tc > 0 ? (ts / tc).toFixed(2) : '0.00';
  };
  const gpa = calcGPA();

  const handleSave = async () => {
    if (!user) { setMessage({ type: 'error', text: 'Vui lòng đăng nhập.' }); return; }
    if (!selectedSem) { setMessage({ type: 'error', text: 'Hãy chọn hoặc tạo Học kỳ trước!' }); return; }
    setIsSaving(true); setMessage({ type: '', text: '' });
    try {
      await supabase.from('semesters').update({ gpa: parseFloat(gpa) }).eq('id', selectedSem);
      const payload = subjects.filter(s => s.name.trim() || s.grade > 0).map((s, i) => ({
        user_id: user.id, semester_id: selectedSem,
        name: s.name || `Môn học ${i + 1}`,
        credits: parseFloat(s.credits) || 0, grade_number: parseFloat(s.grade) || 0, status: 'completed'
      }));
      if (payload.length > 0) {
        await supabase.from('subjects').delete().eq('semester_id', selectedSem);
        const { error } = await supabase.from('subjects').insert(payload);
        if (error) throw error;
      }
      await supabase.from('profiles').update({ current_gpa: parseFloat(gpa) }).eq('id', user.id);
      setMessage({ type: 'success', text: 'Đã lưu thành công!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (err) { setMessage({ type: 'error', text: 'Lỗi: ' + err.message }); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-5">
      <RingResult score={gpa} max={4.0} color="#306ee8" label="GPA Học kỳ" />

      <div className="bg-[#0f172a]/60 backdrop-blur-md border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-300">Chọn Học kỳ</label>
          {selectedSem && !isRenaming && (
            <button onClick={() => { const s = semesters.find(x => String(x.id) === String(selectedSem)); setRenameVal(s?.name || ''); setRenaming(true); }}
              className="text-xs text-[#306ee8] hover:text-blue-300 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">edit</span> Đổi tên
            </button>
          )}
        </div>
        {isRenaming && (
          <div className="flex gap-2 p-3 rounded-xl bg-[#306ee8]/10 border border-[#306ee8]/20">
            <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') renameSem(); if (e.key === 'Escape') setRenaming(false); }}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2 outline-none focus:ring-1 focus:ring-[#306ee8]" />
            <button onClick={renameSem} className="bg-[#306ee8]/30 hover:bg-[#306ee8]/60 text-white font-bold px-3 rounded-lg text-sm">Lưu</button>
            <button onClick={() => setRenaming(false)} className="bg-slate-700 text-white font-bold px-3 rounded-lg text-sm">Hủy</button>
          </div>
        )}
        <select value={selectedSem} onChange={e => setSelSem(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#306ee8]">
          <option value="" className="bg-[#0b0f1a]">-- Chọn Học kỳ --</option>
          {semesters.map(s => <option key={s.id} value={s.id} className="bg-[#0b0f1a]">{s.name} (GPA: {s.gpa})</option>)}
        </select>
        <div className="flex gap-2 pt-2 border-t border-white/5">
          <input value={newSemName} onChange={e => setNewSem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createSem(); }}
            placeholder="Thêm Học kỳ mới (VD: HK241)"
            className="flex-1 bg-slate-800/50 border border-white/5 rounded-lg text-sm text-white px-3 py-2 outline-none focus:ring-1 focus:ring-green-500 placeholder:text-slate-500" />
          <button onClick={createSem} disabled={isCreating || !newSemName.trim()}
            className="bg-green-500/20 hover:bg-green-500/40 text-green-400 font-bold px-4 rounded-lg text-sm disabled:opacity-50">Thêm</button>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Môn học</h2>
        <span className="text-xs text-slate-500">{subjects.length} môn</span>
      </div>
      <div className="space-y-3">
        {subjects.map((s, i) => (
          <SubjectRow key={s.id} sub={s} index={i} label="Điểm tổng kết (Hệ 10)" onUpdate={update} onRemove={remove} />
        ))}
        <button onClick={add} className="w-full py-3.5 border-2 border-dashed border-slate-700/50 rounded-xl text-slate-400 hover:text-white hover:border-[#306ee8]/50 transition-all flex items-center justify-center gap-2 group">
          <span className="material-symbols-outlined text-[#306ee8] group-hover:scale-110 transition-transform">add_circle</span>
          <span className="font-semibold text-sm">Thêm môn học mới</span>
        </button>
      </div>

      {message.text && (
        <div className={`p-3 text-sm font-medium rounded-lg text-center ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          {message.text}
        </div>
      )}
      <button onClick={handleSave} disabled={isSaving}
        className="w-full py-4 bg-[#306ee8] text-white rounded-xl font-bold text-lg shadow-xl shadow-[#306ee8]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2">
        {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
        {isSaving ? 'Đang lưu...' : 'Lưu vào hệ thống'}
      </button>
    </div>
  );
}

// =====================================================
// MAIN PAGE
// =====================================================
export default function GPACalculator() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('thpt');

  return (
    <div className="bg-[#0b0f1a] font-display text-white min-h-screen pb-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(48,110,232,0.12)_0,transparent_50%),radial-gradient(at_100%_0%,rgba(244,63,94,0.12)_0,transparent_50%)] pointer-events-none" />

      <datalist id="thpt-subjects">
        <option value="Toán" />
        <option value="Ngữ văn" />
        <option value="Tiếng Anh" />
        <option value="Vật lý" />
        <option value="Hóa học" />
        <option value="Sinh học" />
        <option value="Lịch sử" />
        <option value="Địa lý" />
        <option value="GDCD" />
        <option value="Tin học" />
        <option value="Công nghệ" />
      </datalist>

      <datalist id="uni-subjects">
        <option value="Triết học Mác - Lênin" />
        <option value="Kinh tế chính trị Mác - Lênin" />
        <option value="Chủ nghĩa xã hội khoa học" />
        <option value="Tư tưởng Hồ Chí Minh" />
        <option value="Lịch sử Đảng Cộng sản Việt Nam" />
        <option value="Toán cao cấp" />
        <option value="Đại số tuyến tính" />
        <option value="Giải tích" />
        <option value="Xác suất thống kê" />
        <option value="Vật lý đại cương" />
        <option value="Pháp luật đại cương" />
        <option value="Tiếng Anh chuyên ngành" />
        <option value="Ngoại ngữ không chuyên" />
        <option value="Tin học đại cương" />
        <option value="Kỹ năng mềm" />
        <option value="Giáo dục thể chất" />
        <option value="Giáo dục Quốc phòng - An ninh" />
      </datalist>

      <header className="sticky top-[57px] md:top-0 z-50 px-4 py-4 flex items-center justify-between bg-[#0f172a]/80 backdrop-blur-md border-b border-white/10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center hover:bg-slate-700 transition-colors">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight">Máy tính GPA</h1>
        <div className="w-10" />
      </header>

      <main className="w-full max-w-2xl mx-auto px-4 pt-6 pb-12 relative z-10 space-y-5">
        {/* Main Tab Toggle */}
        <div className="flex p-1.5 bg-[#0f172a]/60 backdrop-blur-lg border border-white/10 rounded-2xl gap-1">
          <button onClick={() => setTab('thpt')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${tab === 'thpt' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'text-slate-400 hover:text-white'}`}>
            <span className="material-symbols-outlined text-sm">calculate</span> THPT & ĐGNL
          </button>
          <button onClick={() => setTab('uni')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${tab === 'uni' ? 'bg-[#306ee8] text-white shadow-lg shadow-[#306ee8]/30' : 'text-slate-400 hover:text-white'}`}>
            <span className="material-symbols-outlined text-sm">school</span> GPA Đại học
          </button>
        </div>

        {tab === 'uni' && (
          <div className="bg-[#306ee8]/10 border border-[#306ee8]/20 rounded-xl px-4 py-3 text-sm text-slate-300 flex items-start gap-2">
            <span className="material-symbols-outlined text-[#306ee8] shrink-0">info</span>
            <p>Nhập điểm <b>hệ 10</b>, GPA tự quy đổi sang <b>hệ 4.0</b> theo thang VN chuẩn và lưu theo Học kỳ.</p>
          </div>
        )}

        {tab === 'thpt' && <THPTSection />}
        {tab === 'uni' && <UniCalc />}

        {/* ── Find matching schools shortcut ── */}
        <button onClick={() => navigate('/schools')}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#306ee8]/20 to-[#e36488]/20 border border-white/10 hover:border-white/20 transition-all flex items-center justify-between px-5 group">
          <div className="text-left">
            <p className="font-bold text-white text-sm">Tìm trường phù hợp với điểm của bạn</p>
            <p className="text-[10px] text-slate-400 mt-0.5">So sánh điểm chuẩn 2024 · 33+ trường · Lọc theo vùng &amp; ngành</p>
          </div>
          <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-1 transition-transform">arrow_forward</span>
        </button>
      </main>
    </div>
  );
}
