import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { EXAMS, REGION_PRIORITY, CATEGORY_PRIORITY } from '../lib/admission/exams';
import { migrateLegacyScores, validateScoreInput } from '../lib/admission/scores';
import { priorityApplied } from '../lib/admission/predict';

// Trang nhập điểm hợp nhất — thay bản cũ từng đảo nhãn HSA/V-ACT và dùng sai
// thang 1200 cho cả hai. Mọi nhãn/thang lấy từ registry src/lib/admission/exams.js:
//   HSA = ĐHQG Hà Nội, thang 150 · V-ACT = ĐHQG TP.HCM, thang 1200
//   TSA = thang 100 · BCA = thang 100
// Điểm lưu vào profiles.admission_scores dạng v2 (scores.js), merge sâu giữ
// nguyên các key khác; pattern ref chống ghi đè stale như GPACalculator.

const DRAFT_KEY = 'admission_scores_v2';
const ENTRY_EXAMS = ['thpt', 'hocba', 'hsa', 'vact', 'tsa', 'spt', 'hsca', 'bca', 'vsat'];
const PART_EXAMS = ['hsa', 'vact', 'tsa', 'bca'];
const TRIO_EXAMS = ['spt', 'hsca']; // điểm từng môn thang 10, tổng tổ hợp thang 30

const SUBJECTS = [
  { key: 'toan', label: 'Toán' },
  { key: 'van', label: 'Ngữ văn' },
  { key: 'ly', label: 'Vật lí' },
  { key: 'hoa', label: 'Hoá học' },
  { key: 'sinh', label: 'Sinh học' },
  { key: 'su', label: 'Lịch sử' },
  { key: 'dia', label: 'Địa lí' },
  { key: 'anh', label: 'Tiếng Anh' },
  { key: 'gdkp', label: 'GDKT & Pháp luật' },
];

// Map tên môn v1 (GPACalculator lưu tên tiếng Việt) -> key chuẩn
const SUBJECT_ALIASES = {
  toan: 'toan', 'ngu van': 'van', van: 'van', 'vat li': 'ly', 'vat ly': 'ly', ly: 'ly',
  'hoa hoc': 'hoa', hoa: 'hoa', 'sinh hoc': 'sinh', sinh: 'sinh', 'lich su': 'su', su: 'su',
  'dia li': 'dia', 'dia ly': 'dia', dia: 'dia', 'tieng anh': 'anh', anh: 'anh',
  'giao duc kinh te va phap luat': 'gdkp', gdkp: 'gdkp', gdcd: 'gdkp',
};

const COMBOS = {
  A00: ['toan', 'ly', 'hoa'],
  A01: ['toan', 'ly', 'anh'],
  A02: ['toan', 'ly', 'sinh'],
  B00: ['toan', 'hoa', 'sinh'],
  C00: ['van', 'su', 'dia'],
  D01: ['toan', 'van', 'anh'],
  D07: ['toan', 'hoa', 'anh'],
  K01: ['toan', 'van', 'ly'],
};

const PART_LABELS = {
  hsa: { dinh_luong: 'Định lượng', dinh_tinh: 'Định tính', khoa_hoc: 'Khoa học' },
  vact: { ngon_ngu: 'Sử dụng ngôn ngữ', toan: 'Toán học', tu_duy_kh: 'Tư duy khoa học' },
  tsa: { toan: 'Tư duy Toán học', doc_hieu: 'Tư duy Đọc hiểu', khoa_hoc: 'Tư duy Khoa học & GQVĐ' },
  bca: {
    tu_luan: 'Nghị luận xã hội (tự luận)', toan: 'Toán trắc nghiệm', lich_su: 'Lịch sử',
    ngoai_ngu: 'Ngoại ngữ', tu_chon: 'Môn tự chọn (Lý / Hoá / Sinh / Địa)',
  },
};

const STATUS_OPTIONS = [
  { value: 'actual', label: 'Điểm thật' },
  { value: 'mock', label: 'Điểm thi thử' },
  { value: 'target', label: 'Điểm mục tiêu (what-if)' },
];
const STATUS_LABEL = { actual: 'Điểm thật', mock: 'Thi thử', target: 'Mục tiêu', none: '—' };

function normalizeText(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function canonicalSubjects(subjects) {
  const out = {};
  for (const [k, v] of Object.entries(subjects || {})) {
    const key = SUBJECT_ALIASES[normalizeText(k)] || k;
    const n = parseFloat(v);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

const fmt = (n, digits = 2) =>
  n == null || !Number.isFinite(Number(n))
    ? '—'
    : Number(n).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function readLocalKeys() {
  try {
    return {
      my_tsa: localStorage.getItem('my_tsa'),
      my_hsa: localStorage.getItem('my_hsa'),
      my_vact: localStorage.getItem('my_vact'),
    };
  } catch {
    return {};
  }
}

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.version === 2 ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------

export default function AdmissionCalculator() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const admissionScoresRef = useRef(null); // object admission_scores thô (chống stale khi merge)
  const v2Ref = useRef(null); // hồ sơ v2 đã migrate
  const hydratedForRef = useRef(null);

  const [savedV2, setSavedV2] = useState(null);
  const [selectedExam, setSelectedExam] = useState('thpt');
  const [region, setRegion] = useState('KV3');
  const [category, setCategory] = useState('NONE');
  const [subjectsThpt, setSubjectsThpt] = useState({});
  const [subjectsHb, setSubjectsHb] = useState({});
  const [parts, setParts] = useState({}); // `${code}.${part}` -> string
  const [totals, setTotals] = useState({}); // code -> string (tổng nhập trực tiếp / vsat)
  const [trios, setTrios] = useState({}); // `${code}.${idx}` -> string (spt/hsca)
  const [statuses, setStatuses] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // --- Hydrate từ profile (Supabase) hoặc draft (khách) ---
  useEffect(() => {
    const hydKey = user?.id || 'guest';
    if (hydratedForRef.current === hydKey) return;
    if (user && !profile) return; // chờ profile tải xong

    const raw = profile?.admission_scores || null;
    admissionScoresRef.current = raw || {};
    const v2 = migrateLegacyScores(raw || readDraft() || {}, readLocalKeys());
    v2Ref.current = v2;
    setSavedV2(v2);
    hydratedForRef.current = hydKey;

    setRegion(v2.candidate?.region || 'KV3');
    setCategory(v2.candidate?.category || 'NONE');

    const hydrateSubjects = (entry, setter) => {
      if (!entry) return;
      const subs = canonicalSubjects(entry.subjects);
      setter(Object.fromEntries(Object.entries(subs).map(([k, v]) => [k, String(v)])));
    };
    hydrateSubjects(v2.scores.thpt, setSubjectsThpt);
    hydrateSubjects(v2.scores.hocba, setSubjectsHb);

    const nextParts = {};
    const nextTotals = {};
    const nextTrios = {};
    const nextStatuses = {};
    for (const code of ENTRY_EXAMS) {
      const entry = v2.scores[code];
      if (!entry) continue;
      nextStatuses[code] = entry.status || 'actual';
      if (PART_EXAMS.includes(code)) {
        for (const [pk, pv] of Object.entries(entry.parts || {})) {
          if (pv != null) nextParts[`${code}.${pk}`] = String(pv);
        }
        if (entry.total != null) nextTotals[code] = String(entry.total);
      } else if (TRIO_EXAMS.includes(code)) {
        const trioParts = entry.parts || {};
        ['mon_1', 'mon_2', 'mon_3'].forEach((pk, i) => {
          if (trioParts[pk] != null) nextTrios[`${code}.${i}`] = String(trioParts[pk]);
        });
        if (entry.total != null) nextTotals[code] = String(entry.total);
      } else if (code === 'vsat' && entry.total != null) {
        nextTotals[code] = String(entry.total);
      }
    }
    setParts(nextParts);
    setTotals(nextTotals);
    setTrios(nextTrios);
    setStatuses((prev) => ({ ...prev, ...nextStatuses }));
  }, [user, profile]);

  const statusOf = (code) => statuses[code] || 'actual';
  const setStatus = (code, v) => setStatuses((p) => ({ ...p, [code]: v }));

  // --- Lưu ---
  const persistV2 = async (nextV2) => {
    v2Ref.current = nextV2;
    const merged = { ...(admissionScoresRef.current || {}), ...nextV2 };
    admissionScoresRef.current = merged;
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ admission_scores: merged })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile?.();
    } else {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(nextV2));
      } catch { /* bỏ qua nếu localStorage bị chặn */ }
    }
    setSavedV2(nextV2);
  };

  const saveEntry = async (code, entry) => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const base = v2Ref.current || migrateLegacyScores({}, {});
      const nextV2 = {
        ...base,
        version: 2,
        candidate: { region, category },
        scores: { ...(base.scores || {}), [code]: entry },
      };
      await persistV2(nextV2);
      setMessage({ type: 'success', text: `Đã lưu điểm ${EXAMS[code].label}${user ? ' vào hồ sơ' : ' (nháp trên thiết bị này)'}!` });
      setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi khi lưu: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const saveCandidate = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const base = v2Ref.current || migrateLegacyScores({}, {});
      await persistV2({ ...base, version: 2, candidate: { region, category } });
      setMessage({ type: 'success', text: 'Đã lưu thông tin ưu tiên!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi khi lưu: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Builders (validate -> entry v2) ---
  const buildSubjectsEntry = (subjectsState) => {
    const subjects = {};
    for (const [k, v] of Object.entries(subjectsState)) {
      if (v === '' || v == null) continue;
      const n = parseFloat(v);
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        return { error: `Điểm môn ${SUBJECTS.find((s) => s.key === k)?.label || k} phải trong khoảng 0–10` };
      }
      subjects[k] = n;
    }
    if (Object.keys(subjects).length === 0) return { error: 'Hãy nhập điểm ít nhất một môn.' };
    const byGroup = {};
    for (const [combo, keys] of Object.entries(COMBOS)) {
      if (keys.every((k) => subjects[k] != null)) {
        byGroup[combo] = Math.round(keys.reduce((s, k) => s + subjects[k], 0) * 100) / 100;
      }
    }
    const total = Object.keys(byGroup).length ? Math.max(...Object.values(byGroup)) : null;
    return {
      entry: {
        status: statusOf(selectedExam),
        subjects,
        byGroup,
        total,
        updatedAt: new Date().toISOString(),
      },
    };
  };

  const buildPartsEntry = (code) => {
    const def = EXAMS[code].parts || {};
    const partValues = {};
    let filled = 0;
    for (const [pk, max] of Object.entries(def)) {
      const raw = parts[`${code}.${pk}`];
      if (raw === '' || raw == null) continue;
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n < 0 || n > max) {
        return { error: `Điểm phần ${PART_LABELS[code]?.[pk] || pk} phải trong khoảng 0–${max}` };
      }
      partValues[pk] = n;
      filled += 1;
    }
    let total;
    if (filled === Object.keys(def).length && filled > 0) {
      total = Math.round(Object.values(partValues).reduce((s, v) => s + v, 0) * 100) / 100;
    } else if (totals[code] !== '' && totals[code] != null) {
      const check = validateScoreInput(code, totals[code]);
      if (!check.ok) return { error: check.error };
      total = check.value;
    } else {
      return { error: 'Hãy nhập đủ điểm từng phần, hoặc nhập thẳng tổng điểm.' };
    }
    return {
      entry: {
        status: statusOf(code),
        total,
        scale: EXAMS[code].scale,
        ...(filled > 0 ? { parts: partValues } : {}),
        updatedAt: new Date().toISOString(),
      },
    };
  };

  const buildTrioEntry = (code) => {
    const values = [0, 1, 2].map((i) => trios[`${code}.${i}`]);
    if (values.some((v) => v === '' || v == null)) {
      return { error: 'Hãy nhập điểm cả 3 môn thi chuyên biệt (mỗi môn thang 10).' };
    }
    const nums = [];
    for (const v of values) {
      const check = validateScoreInput(code, v); // registry spt/hsca: thang 10/môn
      if (!check.ok) return { error: 'Mỗi môn phải trong khoảng 0–10' };
      nums.push(check.value);
    }
    return {
      entry: {
        status: statusOf(code),
        total: Math.round(nums.reduce((s, v) => s + v, 0) * 100) / 100,
        scale: 30, // tổng tổ hợp thang 30 — khớp thang điểm chuẩn quy tổ hợp của trường
        parts: { mon_1: nums[0], mon_2: nums[1], mon_3: nums[2] },
        scoreMode: 'combo30',
        updatedAt: new Date().toISOString(),
      },
    };
  };

  const handleSaveSelected = () => {
    let built;
    if (selectedExam === 'thpt') built = buildSubjectsEntry(subjectsThpt);
    else if (selectedExam === 'hocba') built = buildSubjectsEntry(subjectsHb);
    else if (PART_EXAMS.includes(selectedExam)) built = buildPartsEntry(selectedExam);
    else if (TRIO_EXAMS.includes(selectedExam)) built = buildTrioEntry(selectedExam);
    else {
      const check = validateScoreInput(selectedExam, totals[selectedExam]);
      built = check.ok
        ? {
            entry: {
              status: statusOf(selectedExam),
              total: check.value,
              scale: EXAMS[selectedExam].scale,
              updatedAt: new Date().toISOString(),
            },
          }
        : { error: check.error };
    }
    if (built.error) {
      setMessage({ type: 'error', text: built.error });
      return;
    }
    saveEntry(selectedExam, built.entry);
  };

  // --- Tính hiển thị ---
  const thptPreview = useMemo(() => {
    const built = buildSubjectsEntryQuiet(subjectsThpt);
    return built;
    function buildSubjectsEntryQuiet(state) {
      const subjects = {};
      for (const [k, v] of Object.entries(state)) {
        const n = parseFloat(v);
        if (Number.isFinite(n)) subjects[k] = n;
      }
      const byGroup = {};
      for (const [combo, keys] of Object.entries(COMBOS)) {
        if (keys.every((k) => subjects[k] != null)) {
          byGroup[combo] = keys.reduce((s, k) => s + subjects[k], 0);
        }
      }
      return byGroup;
    }
  }, [subjectsThpt]);

  const bestThptRaw = useMemo(() => {
    const vals = Object.values(thptPreview);
    return vals.length ? Math.max(...vals) : null;
  }, [thptPreview]);

  const priorityPreview = bestThptRaw != null ? priorityApplied(bestThptRaw, region, category) : null;

  const legacyKeys = Object.keys(savedV2?.legacy_unverified || {});
  const savedEntries = useMemo(
    () =>
      Object.entries(savedV2?.scores || {}).filter(
        ([, v]) => v && v.status !== 'none' && (v.total != null || v.subjects),
      ),
    [savedV2],
  );

  const exam = EXAMS[selectedExam];

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
            <h1 className="font-arena-display font-bold text-xl leading-tight">Nhập điểm xét tuyển</h1>
            <p className="text-xs text-slate-400">Một hồ sơ điểm duy nhất cho mọi kỳ thi — dùng ở trang Tìm trường</p>
          </div>
          <button onClick={() => navigate('/tim-truong')} className="btn-arena btn-arena-sm btn-arena-jade cursor-pointer shrink-0">
            <span className="material-symbols-outlined text-base" aria-hidden="true">school</span>
            Tìm trường
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {!user && (
          <div className="arena-card p-4 flex gap-3">
            <span className="material-symbols-outlined shrink-0" style={{ color: 'var(--arena-gold)' }} aria-hidden="true">info</span>
            <p className="text-xs leading-relaxed text-slate-300">
              Bạn chưa đăng nhập — điểm sẽ lưu nháp trên thiết bị này. Đăng nhập để điểm đồng bộ vào hồ sơ
              và dùng được trên mọi thiết bị.
            </p>
          </div>
        )}

        {legacyKeys.length > 0 && (
          <div className="arena-card p-4 flex gap-3" style={{ borderColor: 'rgba(242,193,89,0.5)' }}>
            <span className="material-symbols-outlined shrink-0" style={{ color: 'var(--arena-gold)' }} aria-hidden="true">warning</span>
            <p className="text-xs leading-relaxed text-slate-300">
              Điểm HSA / V-ACT bạn lưu ở bản cũ đang bị cách ly vì bản cũ ghi sai thang điểm hai kỳ thi này
              (HSA đúng là thang 150 của ĐHQG Hà Nội, V-ACT đúng là thang 1200 của ĐHQG TP.HCM).
              Hãy nhập lại điểm ở hai mục HSA và V-ACT bên dưới — điểm cũ không được tự gán lại để tránh sai lệch.
            </p>
          </div>
        )}

        {/* Điểm đã lưu */}
        {savedEntries.length > 0 && (
          <section className="arena-card p-4">
            <h2 className="font-arena-display font-bold">Điểm đã lưu trong hồ sơ</h2>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {savedEntries.map(([code, v]) => (
                <span key={code} className="arena-chip">
                  {EXAMS[code]?.label || code.toUpperCase()}:
                  <span className="tabular">
                    {v.total != null ? `${fmt(parseFloat(v.total), code === 'vact' || code === 'vsat' ? 0 : 2)} / ${v.scale ?? EXAMS[code]?.scale ?? ''}` : 'theo tổ hợp'}
                  </span>
                  <span>({STATUS_LABEL[v.status] || 'Điểm thật'})</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Ưu tiên khu vực / đối tượng */}
        <section className="arena-card p-4 space-y-3">
          <h2 className="font-arena-display font-bold">Khu vực & đối tượng ưu tiên</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="region-select" className="block text-xs font-semibold mb-1.5 text-slate-300">Khu vực ưu tiên</label>
              <select
                id="region-select"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full min-h-[44px] bg-white/5 border border-white/10 rounded-xl px-3 text-sm outline-none cursor-pointer"
                style={{ backgroundColor: 'var(--arena-surface)' }}
              >
                {Object.entries(REGION_PRIORITY).map(([k, v]) => (
                  <option key={k} value={k}>{k} (+{fmt(v)} điểm danh nghĩa)</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="category-select" className="block text-xs font-semibold mb-1.5 text-slate-300">Nhóm đối tượng ưu tiên</label>
              <select
                id="category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] bg-white/5 border border-white/10 rounded-xl px-3 text-sm outline-none cursor-pointer"
                style={{ backgroundColor: 'var(--arena-surface)' }}
              >
                <option value="NONE">Không thuộc nhóm ưu tiên (+0)</option>
                <option value="UT1">Nhóm UT1 (+2,0 điểm danh nghĩa)</option>
                <option value="UT2">Nhóm UT2 (+1,0 điểm danh nghĩa)</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Theo quy chế của Bộ GD&ĐT, từ mốc tổng điểm 22,5 trở lên điểm ưu tiên thực tế giảm dần:
            ưu tiên thực = (30 − tổng điểm) / 7,5 × ưu tiên danh nghĩa.
            {priorityPreview != null && bestThptRaw != null && (
              <>
                {' '}Với tổ hợp THPT cao nhất hiện tại (<span className="tabular">{fmt(bestThptRaw)}</span>),
                ưu tiên thực của bạn là <span className="tabular font-bold text-slate-200">+{fmt(priorityPreview)}</span> — không phải cộng thẳng điểm danh nghĩa.
              </>
            )}
          </p>
          <button onClick={saveCandidate} disabled={isSaving} className="btn-arena btn-arena-sm btn-arena-ghost cursor-pointer">
            <span className="material-symbols-outlined text-base" aria-hidden="true">save</span>
            {isSaving ? 'Đang lưu...' : 'Lưu thông tin ưu tiên'}
          </button>
        </section>

        {/* Chọn kỳ thi */}
        <section aria-label="Chọn kỳ thi">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {ENTRY_EXAMS.map((code) => {
              const e = EXAMS[code];
              const active = selectedExam === code;
              const has = !!savedV2?.scores?.[code];
              return (
                <button
                  key={code}
                  onClick={() => { setSelectedExam(code); setMessage({ type: '', text: '' }); }}
                  aria-pressed={active}
                  className="arena-card arena-card-interactive p-3 text-left cursor-pointer"
                  style={active ? { borderColor: 'var(--arena-ember)', background: 'rgba(227,100,136,0.10)' } : undefined}
                >
                  <span className="font-arena-display font-bold block" style={active ? { color: 'var(--arena-ember)' } : undefined}>
                    {e.label}
                  </span>
                  <span className="text-[11px] text-slate-400 block leading-snug mt-0.5">{e.org}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Thang {code === 'spt' || code === 'hsca' ? '10/môn' : e.scale}
                    {has ? ' · Đã lưu' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Form nhập điểm của kỳ thi đang chọn */}
        <section className="arena-card p-4 sm:p-5 space-y-5">
          <div>
            <h2 className="font-arena-display font-bold text-lg">{exam.full}</h2>
            <p className="text-xs text-slate-400 mt-1">
              Đơn vị tổ chức: {exam.org} · Thang điểm:{' '}
              {selectedExam === 'spt' || selectedExam === 'hsca'
                ? '10 điểm/môn — tổng tổ hợp 30 để so với điểm chuẩn của trường'
                : `${exam.scale} (${exam.unit})`}
            </p>
          </div>

          <div>
            <label htmlFor="status-select" className="block text-xs font-semibold mb-1.5 text-slate-300">Loại điểm</label>
            <select
              id="status-select"
              value={statusOf(selectedExam)}
              onChange={(e) => setStatus(selectedExam, e.target.value)}
              className="w-full sm:w-64 min-h-[44px] bg-white/5 border border-white/10 rounded-xl px-3 text-sm outline-none cursor-pointer"
              style={{ backgroundColor: 'var(--arena-surface)' }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {statusOf(selectedExam) !== 'actual' && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                Đang ở chế độ điểm {statusOf(selectedExam) === 'mock' ? 'thi thử' : 'mục tiêu'} — ước tính ở trang Tìm trường là kịch bản giả định, không phải điểm thật.
              </p>
            )}
          </div>

          {(selectedExam === 'thpt' || selectedExam === 'hocba') && (
            <SubjectForm
              subjectsState={selectedExam === 'thpt' ? subjectsThpt : subjectsHb}
              onChange={selectedExam === 'thpt' ? setSubjectsThpt : setSubjectsHb}
              transcript={selectedExam === 'hocba'}
            />
          )}

          {PART_EXAMS.includes(selectedExam) && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(EXAMS[selectedExam].parts).map(([pk, max]) => (
                  <NumberField
                    key={pk}
                    label={`${PART_LABELS[selectedExam]?.[pk] || pk} (0–${max})`}
                    value={parts[`${selectedExam}.${pk}`] ?? ''}
                    onChange={(v) => setParts((p) => ({ ...p, [`${selectedExam}.${pk}`]: v }))}
                    max={max}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="flex-1 border-t border-white/10" />
                hoặc nhập thẳng tổng điểm nếu bạn chỉ nhớ tổng
                <span className="flex-1 border-t border-white/10" />
              </div>
              <NumberField
                label={`Tổng điểm ${exam.label} (0–${exam.scale})`}
                value={totals[selectedExam] ?? ''}
                onChange={(v) => setTotals((p) => ({ ...p, [selectedExam]: v }))}
                max={exam.scale}
              />
              {selectedExam === 'bca' && (
                <p className="text-xs text-slate-400 leading-relaxed">
                  Lưu ý: điểm xét tuyển khối Công an (phương thức 3) = điểm tổ hợp THPT × 2/5 + điểm bài thi
                  BCA × 3/5 + điểm cộng. Hãy nhập thêm điểm THPT ở mục THPT để trang Tìm trường ước tính đúng.
                </p>
              )}
              <TotalPreview
                label={`Tổng điểm ${exam.label}`}
                value={previewPartsTotal(selectedExam, parts, totals)}
                scale={exam.scale}
              />
            </div>
          )}

          {TRIO_EXAMS.includes(selectedExam) && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Nhập điểm 3 môn bạn đã thi trong kỳ thi chuyên biệt (mỗi môn thang 10). Hệ thống cộng thành
                tổng tổ hợp thang 30 — đúng thang các trường dùng khi công bố điểm chuẩn quy tổ hợp.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <NumberField
                    key={i}
                    label={`Môn thi ${i + 1} (0–10)`}
                    value={trios[`${selectedExam}.${i}`] ?? ''}
                    onChange={(v) => setTrios((p) => ({ ...p, [`${selectedExam}.${i}`]: v }))}
                    max={10}
                  />
                ))}
              </div>
              <TotalPreview
                label="Tổng tổ hợp (thang 30)"
                value={previewTrioTotal(selectedExam, trios)}
                scale={30}
              />
            </div>
          )}

          {selectedExam === 'vsat' && (
            <div className="space-y-4">
              <NumberField
                label="Tổng điểm tổ hợp V-SAT (0–450, 3 môn × 150)"
                value={totals.vsat ?? ''}
                onChange={(v) => setTotals((p) => ({ ...p, vsat: v }))}
                max={450}
              />
              <TotalPreview label="Tổng điểm V-SAT" value={parseFloat(totals.vsat) || null} scale={450} digits={0} />
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={handleSaveSelected}
              disabled={isSaving}
              className={`btn-arena w-full cursor-pointer ${message.type === 'success' ? 'btn-arena-jade' : 'btn-arena-primary'}`}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                {isSaving ? 'sync' : message.type === 'success' ? 'check_circle' : 'save'}
              </span>
              {isSaving ? 'Đang lưu...' : message.type === 'success' ? 'Đã lưu điểm!' : `Lưu điểm ${exam.label}`}
            </button>
            {message.text && (
              <p className={`text-center text-xs font-medium ${message.type === 'error' ? 'text-red-400' : ''}`} style={message.type === 'success' ? { color: 'var(--arena-jade)' } : undefined} role="status">
                {message.text}
              </p>
            )}
          </div>
        </section>

        <p className="text-[11px] text-slate-500 text-center leading-relaxed pb-4">
          Điểm bạn nhập được dùng để ước tính khả năng ở trang Tìm trường. Ước tính dựa trên điểm chuẩn
          các năm trước — không phải cam kết trúng tuyển. Điểm 0 là giá trị hợp lệ và được lưu như các điểm khác.
        </p>
      </main>
    </div>
  );
}

function previewPartsTotal(code, parts, totals) {
  const def = EXAMS[code].parts || {};
  const keys = Object.keys(def);
  const filled = keys.filter((pk) => parts[`${code}.${pk}`] !== '' && parts[`${code}.${pk}`] != null);
  if (filled.length === keys.length && keys.length > 0) {
    return keys.reduce((s, pk) => s + (parseFloat(parts[`${code}.${pk}`]) || 0), 0);
  }
  const t = parseFloat(totals[code]);
  return Number.isFinite(t) ? t : null;
}

function previewTrioTotal(code, trios) {
  const vals = [0, 1, 2].map((i) => parseFloat(trios[`${code}.${i}`]));
  if (vals.some((v) => !Number.isFinite(v))) return null;
  return vals.reduce((s, v) => s + v, 0);
}

function SubjectForm({ subjectsState, onChange, transcript }) {
  const byGroup = useMemo(() => {
    const out = {};
    for (const [combo, keys] of Object.entries(COMBOS)) {
      if (keys.every((k) => subjectsState[k] !== '' && subjectsState[k] != null && Number.isFinite(parseFloat(subjectsState[k])))) {
        out[combo] = keys.reduce((s, k) => s + parseFloat(subjectsState[k]), 0);
      }
    }
    return out;
  }, [subjectsState]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 leading-relaxed">
        {transcript
          ? 'Nhập điểm trung bình môn dùng cho xét học bạ (theo cách tính của bạn / của trường). Tổng tổ hợp được tính tự động cho các tổ hợp đủ 3 môn.'
          : 'Nhập điểm từng môn thi tốt nghiệp THPT. Tổng các tổ hợp đủ 3 môn được tính tự động — trang Tìm trường sẽ dùng tổ hợp khớp với từng ngành.'}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SUBJECTS.map((s) => (
          <NumberField
            key={s.key}
            label={`${s.label} (0–10)`}
            value={subjectsState[s.key] ?? ''}
            onChange={(v) => onChange((p) => ({ ...p, [s.key]: v }))}
            max={10}
            step="0.05"
          />
        ))}
      </div>
      {Object.keys(byGroup).length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="text-xs text-slate-400 mb-1.5">Tổng theo tổ hợp (chưa gồm điểm ưu tiên):</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(byGroup).map(([combo, sum]) => (
              <span key={combo} className="arena-chip">
                {combo}: <span className="tabular">{fmt(sum)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange, max, step = '0.1' }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 text-slate-300">{label}</label>
      <input
        type="number"
        min="0"
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full min-h-[44px] bg-white/5 border border-white/10 rounded-xl px-3 text-sm tabular outline-none focus:ring-2"
        style={{ '--tw-ring-color': 'var(--arena-ember)' }}
      />
    </div>
  );
}

function TotalPreview({ label, value, scale, digits = 2 }) {
  const pct = value != null && scale ? Math.min((value / scale) * 100, 100) : 0;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="font-arena-display font-bold text-2xl leading-tight">
          <span className="tabular">{value != null ? fmt(value, digits) : '—'}</span>
          <span className="text-sm text-slate-500 font-medium"> / {scale}</span>
        </p>
      </div>
      <div
        className="w-24 h-2.5 rounded-full bg-white/10 overflow-hidden shrink-0"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--arena-jade), var(--arena-jade-strong))' }}
        />
      </div>
    </div>
  );
}
