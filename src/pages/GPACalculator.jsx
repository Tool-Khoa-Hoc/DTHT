import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { gpaSemester, gpaCumulative, getGpaScale, GPA_SCALES } from '../lib/admission/gpa';

// Trang GPA ĐẠI HỌC — sau tái cấu trúc score-v3, trang này CHỈ còn tính GPA
// đại học (UniCalc trước đây). Toàn bộ máy tính điểm xét tuyển THPT / học bạ /
// BKHCM / ĐGNL từng trùng lặp ở đây (kèm 2 công thức sai: quy đổi HSA tuyến
// tính và BKHCM sai mẫu số) đã bị XOÁ — tính điểm xét tuyển dùng một nơi duy
// nhất: trang Nhập điểm (/tim-truong/diem, AdmissionCalculator) với thư viện
// src/lib/admission/ (formulas.js, conversions.js).
// GPA tính bằng lib/admission/gpa.js; môn chưa nhập điểm (grade rỗng) bị loại
// khỏi kỳ tính, môn 0 điểm thật vẫn được tính.

const fmt = (n, digits = 2) =>
  n == null || !Number.isFinite(Number(n))
    ? '—'
    : Number(n).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function GPACalculator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([{ id: 1, name: '', credits: 2, grade: '' }]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [semesters, setSemesters] = useState([]);
  const [selectedSem, setSelSem] = useState('');
  const [newSemName, setNewSem] = useState('');
  const [isCreating, setCreating] = useState(false);
  const [isRenaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [allSubjects, setAllSubjects] = useState([]);
  const scaleId = 'vn-common';

  const loadSems = useCallback(async () => {
    const { data } = await supabase
      .from('semesters')
      .select('id, name, created_at, gpa')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setSemesters(data || []);
    if (data?.length > 0) setSelSem((prev) => prev || data[0].id);
    const { data: subs } = await supabase
      .from('subjects')
      .select('id, name, credits, grade_number, semester_id')
      .eq('user_id', user.id);
    setAllSubjects(subs || []);
  }, [user]);

  const loadSubs = useCallback(async (id) => {
    const { data } = await supabase
      .from('subjects')
      .select('id, name, credits, grade_number, semester_id, created_at')
      .eq('semester_id', id)
      .order('created_at');
    if (data?.length > 0) {
      setSubjects(data.map((s) => ({ id: s.id, name: s.name, credits: s.credits, grade: String(s.grade_number ?? '') })));
    } else {
      setSubjects([{ id: Date.now(), name: '', credits: 2, grade: '' }]);
    }
  }, []);

  useEffect(() => { if (user) loadSems(); }, [user, loadSems]);
  useEffect(() => {
    if (selectedSem) loadSubs(selectedSem);
    else setSubjects([{ id: Date.now(), name: '', credits: 2, grade: '' }]);
  }, [selectedSem, loadSubs]);

  const createSem = async () => {
    if (!newSemName.trim()) return;
    setCreating(true);
    const { data } = await supabase
      .from('semesters')
      .insert([{ user_id: user.id, name: newSemName.trim(), status: 'in_progress', gpa: 0 }])
      .select('id')
      .single();
    setNewSem('');
    await loadSems();
    if (data?.id) setSelSem(data.id);
    setCreating(false);
  };

  const renameSem = async () => {
    if (!renameVal.trim()) return;
    await supabase.from('semesters').update({ name: renameVal.trim() }).eq('id', selectedSem).eq('user_id', user.id);
    setRenaming(false);
    await loadSems();
  };

  const update = (id, f, v) => setSubjects((s) => s.map((x) => (x.id === id ? { ...x, [f]: v } : x)));
  const add = () => setSubjects((s) => [...s, { id: Date.now(), name: '', credits: 2, grade: '' }]);
  const remove = (id) => { if (subjects.length > 1) setSubjects((s) => s.filter((x) => x.id !== id)); };

  const semResult = useMemo(
    () =>
      gpaSemester(
        subjects.map((s) => ({
          credits: parseFloat(s.credits) || 0,
          grade: s.grade === '' || s.grade == null ? null : parseFloat(s.grade),
        })),
        scaleId,
      ),
    [subjects],
  );
  const gpa = semResult.gpa4 != null ? fmt(semResult.gpa4) : '—';

  const cumulative = useMemo(() => {
    const bySem = {};
    for (const s of allSubjects) {
      (bySem[s.semester_id] ||= []).push({ credits: s.credits, grade: s.grade_number });
    }
    return gpaCumulative(Object.values(bySem).map((list) => ({ subjects: list })), scaleId);
  }, [allSubjects]);

  const handleSave = async () => {
    if (!user) { setMessage({ type: 'error', text: 'Vui lòng đăng nhập để lưu GPA.' }); return; }
    if (!selectedSem) { setMessage({ type: 'error', text: 'Hãy chọn hoặc tạo học kỳ trước!' }); return; }
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const gpaValue = semResult.gpa4 ?? 0;
      await supabase.from('semesters').update({ gpa: gpaValue }).eq('id', selectedSem);
      const payload = subjects
        .filter((s) => s.name.trim() || s.grade !== '')
        .map((s, i) => ({
          user_id: user.id,
          semester_id: selectedSem,
          name: s.name || `Môn học ${i + 1}`,
          credits: parseFloat(s.credits) || 0,
          grade_number: s.grade === '' ? 0 : parseFloat(s.grade) || 0,
          status: 'completed',
        }));
      if (payload.length > 0) {
        await supabase.from('subjects').delete().eq('semester_id', selectedSem);
        const { error } = await supabase.from('subjects').insert(payload);
        if (error) throw error;
      }
      await supabase.from('profiles').update({ current_gpa: gpaValue }).eq('id', user.id);
      await loadSems();
      setMessage({ type: 'success', text: 'Đã lưu GPA học kỳ thành công!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-dvh font-arena text-slate-100 relative" style={{ background: 'var(--arena-ink)' }}>
      <header
        className="sticky top-0 z-20 backdrop-blur-md border-b border-white/10"
        style={{ background: 'rgba(25,14,18,0.85)' }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Quay lại"
            className="w-11 h-11 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back_ios_new</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-arena-display font-bold text-xl leading-tight">Tính GPA đại học</h1>
            <p className="text-xs text-slate-400">Quy đổi điểm hệ 10 sang hệ 4 theo tín chỉ, lưu theo học kỳ</p>
          </div>
          <button onClick={() => navigate('/tim-truong/diem')} className="btn-arena btn-arena-sm btn-arena-jade cursor-pointer shrink-0">
            <span className="material-symbols-outlined text-base" aria-hidden="true">calculate</span>
            Tính điểm xét tuyển
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="arena-card p-4 flex gap-3">
          <span className="material-symbols-outlined shrink-0" style={{ color: 'var(--arena-gold)' }} aria-hidden="true">info</span>
          <p className="text-xs leading-relaxed text-slate-300">
            Trang này chỉ tính <b>GPA đại học</b>. Điểm xét tuyển THPT, học bạ, HSA, V-ACT, TSA, BCA,
            V-SAT và điểm tổng hợp BKHCM được nhập &amp; tính ở trang{' '}
            <button onClick={() => navigate('/tim-truong/diem')} className="underline cursor-pointer">Nhập điểm xét tuyển</button>{' '}
            — một hồ sơ điểm duy nhất cho mọi kỳ thi.
          </p>
        </div>

        <section className="arena-card p-5 text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-slate-400">GPA học kỳ (hệ 4)</p>
          <p className="font-arena-display font-bold text-5xl tabular" style={{ color: 'var(--arena-jade)' }}>{gpa}</p>
          <p className="text-xs text-slate-400">
            {semResult.credits > 0
              ? `${semResult.credits} tín chỉ đã nhập điểm · Trung bình hệ 10 có trọng số: ${fmt(semResult.gpa10)}`
              : 'Nhập điểm các môn bên dưới để xem GPA'}
          </p>
          {cumulative.credits > 0 && (
            <p className="text-xs text-slate-300 pt-1">
              GPA tích luỹ toàn khoá (các kỳ đã lưu):{' '}
              <span className="tabular font-bold">{fmt(cumulative.gpa4)}</span> trên {cumulative.credits} tín chỉ
              <span className="text-slate-500"> — khác với GPA của riêng kỳ đang chọn ở trên.</span>
            </p>
          )}
          <p className="text-[11px] text-slate-500 leading-relaxed pt-2">{getGpaScale(scaleId).sourceNote}</p>
        </section>

        {!user ? (
          <div className="arena-card p-4">
            <p className="text-sm text-slate-300">Đăng nhập để lưu học kỳ và môn học vào hồ sơ của bạn.</p>
          </div>
        ) : (
          <section className="arena-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="sem-select" className="text-sm font-semibold text-slate-300">Chọn học kỳ</label>
              {selectedSem && !isRenaming && (
                <button
                  onClick={() => { const s = semesters.find((x) => String(x.id) === String(selectedSem)); setRenameVal(s?.name || ''); setRenaming(true); }}
                  className="text-xs flex items-center gap-1 cursor-pointer"
                  style={{ color: 'var(--arena-ember)' }}
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">edit</span> Đổi tên
                </button>
              )}
            </div>
            {isRenaming && (
              <div className="flex gap-2">
                <input
                  autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') renameSem(); if (e.key === 'Escape') setRenaming(false); }}
                  className="flex-1 min-h-[44px] bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 outline-none"
                />
                <button onClick={renameSem} className="btn-arena btn-arena-sm btn-arena-jade cursor-pointer">Lưu</button>
                <button onClick={() => setRenaming(false)} className="btn-arena btn-arena-sm btn-arena-ghost cursor-pointer">Huỷ</button>
              </div>
            )}
            <select
              id="sem-select" value={selectedSem} onChange={(e) => setSelSem(e.target.value)}
              className="w-full min-h-[44px] bg-white/5 border border-white/10 rounded-xl px-3 text-sm outline-none cursor-pointer"
              style={{ backgroundColor: 'var(--arena-surface)' }}
            >
              <option value="">— Chọn học kỳ —</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.name} (GPA: {s.gpa})</option>
              ))}
            </select>
            <div className="flex gap-2 pt-2 border-t border-white/5">
              <input
                value={newSemName} onChange={(e) => setNewSem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createSem(); }}
                placeholder="Thêm học kỳ mới (ví dụ: HK241)"
                className="flex-1 min-h-[44px] bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 outline-none placeholder:text-slate-500"
              />
              <button onClick={createSem} disabled={isCreating || !newSemName.trim()} className="btn-arena btn-arena-sm btn-arena-jade cursor-pointer disabled:opacity-50">Thêm</button>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Môn học</h2>
            <span className="text-xs text-slate-500">{subjects.length} môn</span>
          </div>
          {subjects.map((s, i) => (
            <div key={s.id} className="arena-card p-3 grid grid-cols-[1fr_76px_92px_40px] gap-2 items-end">
              <div>
                <label className="block text-[11px] font-semibold mb-1 text-slate-400">Tên môn</label>
                <input
                  value={s.name} onChange={(e) => update(s.id, 'name', e.target.value)}
                  placeholder={`Môn học ${i + 1}`} list="uni-subjects"
                  className="w-full min-h-[44px] bg-white/5 border border-white/10 rounded-lg text-sm px-3 outline-none placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1 text-slate-400">Tín chỉ</label>
                <input
                  type="number" min="0" max="30" value={s.credits}
                  onChange={(e) => update(s.id, 'credits', e.target.value)}
                  className="w-full min-h-[44px] bg-white/5 border border-white/10 rounded-lg text-sm px-3 outline-none tabular"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1 text-slate-400">Điểm hệ 10</label>
                <input
                  type="number" min="0" max="10" step="0.1" value={s.grade}
                  onChange={(e) => update(s.id, 'grade', e.target.value)}
                  placeholder="Chưa nhập"
                  className="w-full min-h-[44px] bg-white/5 border border-white/10 rounded-lg text-sm px-3 outline-none tabular placeholder:text-slate-600"
                />
              </div>
              <button
                onClick={() => remove(s.id)} aria-label="Xoá môn"
                className="w-10 h-11 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
              </button>
            </div>
          ))}
          <button
            onClick={add}
            className="w-full min-h-[48px] border-2 border-dashed border-white/15 rounded-xl text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined" aria-hidden="true">add_circle</span>
            <span className="font-semibold text-sm">Thêm môn học mới</span>
          </button>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Môn để trống ô điểm sẽ không bị tính là 0 — chỉ môn đã nhập điểm (kể cả 0 điểm thật) mới vào mẫu số GPA.
            Bộ thang quy đổi đang dùng: {GPA_SCALES[scaleId].label}.
          </p>
        </section>

        {message.text && (
          <p
            className={`text-center text-sm font-medium ${message.type === 'error' ? 'text-red-400' : ''}`}
            style={message.type === 'success' ? { color: 'var(--arena-jade)' } : undefined}
            role="status"
          >
            {message.text}
          </p>
        )}
        {user && (
          <button onClick={handleSave} disabled={isSaving} className="btn-arena btn-arena-primary w-full cursor-pointer">
            <span className="material-symbols-outlined text-base" aria-hidden="true">{isSaving ? 'sync' : 'save'}</span>
            {isSaving ? 'Đang lưu...' : 'Lưu vào hệ thống'}
          </button>
        )}

        <button
          onClick={() => navigate('/tim-truong')}
          className="w-full py-4 rounded-2xl border border-white/10 hover:border-white/20 transition-all flex items-center justify-between px-5 cursor-pointer"
        >
          <span className="text-left">
            <span className="font-bold text-white text-sm block">Tìm trường phù hợp với điểm của bạn</span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">So sánh điểm chuẩn mới nhất · Hơn 1.200 ngành và phương thức · Ước tính theo xác suất</span>
          </span>
          <span className="material-symbols-outlined text-slate-400" aria-hidden="true">arrow_forward</span>
        </button>
      </main>

      <datalist id="uni-subjects">
        <option value="Triết học Mác – Lênin" />
        <option value="Kinh tế chính trị Mác – Lênin" />
        <option value="Chủ nghĩa xã hội khoa học" />
        <option value="Tư tưởng Hồ Chí Minh" />
        <option value="Lịch sử Đảng Cộng sản Việt Nam" />
        <option value="Toán cao cấp" />
        <option value="Đại số tuyến tính" />
        <option value="Giải tích" />
        <option value="Xác suất thống kê" />
        <option value="Vật lí đại cương" />
        <option value="Pháp luật đại cương" />
        <option value="Tiếng Anh chuyên ngành" />
        <option value="Tin học đại cương" />
        <option value="Giáo dục thể chất" />
        <option value="Giáo dục Quốc phòng – An ninh" />
      </datalist>
    </div>
  );
}
