import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { EXAMS, REGION_PRIORITY, CATEGORY_PRIORITY } from '../lib/admission/exams';
import { migrateLegacyScores, validateScoreInput, saveScoreEntry, SCORES_VERSION } from '../lib/admission/scores';
import { priorityApplied } from '../lib/admission/predict';
import { SUBJECTS, canonicalSubjects } from '../lib/admission/subjects';
import { COMBOS as COMBO_DEFS, comboRawScore } from '../lib/admission/combos';
import { bcaCombinedScore, integrated100Score, hcmutCombinedScore } from '../lib/admission/formulas';

// Tổ hợp dùng chung từ lib/admission/combos.js (đầy đủ — không còn bản 8 tổ
// hợp tự khai trong trang). Dạng rút gọn { mã: [môn...] } cho các vòng lặp cũ.
const COMBOS = Object.fromEntries(
  Object.entries(COMBO_DEFS).map(([code, def]) => [code, def.subjects]),
);

// Trang nhập điểm hợp nhất — thay bản cũ từng đảo nhãn HSA/V-ACT và dùng sai
// thang 1200 cho cả hai. Mọi nhãn/thang lấy từ registry src/lib/admission/exams.js:
//   HSA = ĐHQG Hà Nội, thang 150 · V-ACT = ĐHQG TP.HCM, thang 1200
//   TSA = thang 100 · BCA = thang 100
// Điểm lưu vào profiles.admission_scores dạng v2 (scores.js), merge sâu giữ
// nguyên các key khác; pattern ref chống ghi đè stale như GPACalculator.

const DRAFT_KEY = 'admission_scores_v2'; // giữ nguyên khoá lưu nháp để không mất dữ liệu v2 của người dùng; nội dung đã là schema v3
const ENTRY_EXAMS = ['thpt', 'hocba', 'hsa', 'vact', 'tsa', 'spt', 'hsca', 'bca', 'vsat'];
const PART_EXAMS = ['hsa', 'vact', 'tsa', 'bca'];
const TRIO_EXAMS = ['spt', 'hsca']; // điểm từng môn thang 10, tổng tổ hợp thang 30

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
    return parsed?.version === 2 || parsed?.version === 3 ? parsed : null;
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
  const [vsatSubjects, setVsatSubjects] = useState({}); // môn -> điểm V-SAT thang 150
  const [bonus100, setBonus100] = useState(''); // điểm cộng thang 100 (BKHCM)
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
      } else if (code === 'vsat') {
        if (entry.total != null) nextTotals[code] = String(entry.total);
        if (entry.subjects) {
          setVsatSubjects(Object.fromEntries(Object.entries(entry.subjects).map(([k, v]) => [k, String(v)])));
        }
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
      const withCandidate = { ...base, candidate: { region, category } };
      const nextV2 = saveScoreEntry(withCandidate, code, entry);
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
      await persistV2({ ...base, version: SCORES_VERSION, candidate: { region, category } });
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
      const n = parseFloat(v); // từng môn SPT/H-SCA thang 10 (registry: subjectScale)
      if (!Number.isFinite(n) || n < 0 || n > 10) return { error: 'Mỗi môn phải trong khoảng 0–10' };
      nums.push(n);
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

  const buildVsatEntry = () => {
    const subjects = {};
    for (const [k, v] of Object.entries(vsatSubjects)) {
      if (v === '' || v == null) continue;
      const n = parseFloat(v);
      if (!Number.isFinite(n) || n < 0 || n > 150) {
        return { error: `Điểm V-SAT môn ${SUBJECTS.find((x) => x.key === k)?.label || k} phải trong khoảng 0–150` };
      }
      subjects[k] = n;
    }
    if (Object.keys(subjects).length > 0) {
      if (Object.keys(subjects).length < 3) return { error: 'Hãy nhập điểm V-SAT ít nhất 3 môn để tính tổ hợp.' };
      const byGroup = {};
      for (const code of Object.keys(COMBOS)) {
        const sc = comboRawScore(subjects, code);
        if (sc != null) byGroup[code] = sc;
      }
      const total = Object.keys(subjects).length === 3 ? Object.values(subjects).reduce((a, b) => a + b, 0) : null;
      return { entry: { status: statusOf('vsat'), subjects, byGroup, total, scale: 450, scoreMode: 'per-subject-150', updatedAt: new Date().toISOString() } };
    }
    const check = validateScoreInput('vsat', totals.vsat);
    if (!check.ok) return { error: 'Hãy nhập điểm V-SAT theo từng môn, hoặc nhập thẳng tổng điểm tổ hợp (0–450).' };
    return { entry: { status: statusOf('vsat'), total: check.value, scale: 450, updatedAt: new Date().toISOString() } };
  };

  const handleSaveSelected = () => {
    let built;
    if (selectedExam === 'vsat') built = buildVsatEntry();
    else if (selectedExam === 'thpt') built = buildSubjectsEntry(subjectsThpt);
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

  // Máy tính kết hợp — đầu vào lấy từ chính các ô nhập của trang này, công
  // thức ở lib/admission/formulas.js (không tính trong trang).
  const thptNums = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(subjectsThpt)) {
      const n = parseFloat(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  }, [subjectsThpt]);
  const hbNums = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(subjectsHb)) {
      const n = parseFloat(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  }, [subjectsHb]);
  const bcaPreview = useMemo(() => {
    const bcaTotal = parseFloat(totals.bca);
    if (!Number.isFinite(bcaTotal) || bestThptRaw == null) return null;
    return bcaCombinedScore({ thptComboScore: bestThptRaw, bcaExamScore: bcaTotal, region, category });
  }, [totals.bca, bestThptRaw, region, category]);
  const hcmutPreview = useMemo(() => {
    const comboCodes = Object.keys(thptPreview);
    if (!comboCodes.length) return null;
    const bestCombo = comboCodes.reduce((a, b) => (thptPreview[a] >= thptPreview[b] ? a : b));
    const keys = COMBOS[bestCombo] || [];
    const thptScores = keys.map((k) => thptNums[k]);
    const hocbaScores = keys.map((k) => hbNums[k]);
    if (thptScores.some((v) => v == null) || hocbaScores.some((v) => v == null)) return null;
    const vactTotal = parseFloat(totals.vact);
    const vactToanPart = parseFloat(parts['vact.toan']);
    return hcmutCombinedScore({
      vactTotal: Number.isFinite(vactTotal) ? vactTotal : null,
      vactToan: Number.isFinite(vactToanPart) ? vactToanPart : null,
      doubleMath: keys.includes('toan'),
      thptScores, thptMathScore: thptNums.toan,
      hocbaScores, hocbaMathScore: hbNums.toan,
      bonus: parseFloat(bonus100) || 0, region, category,
    });
  }, [thptPreview, thptNums, hbNums, totals.vact, parts, bonus100, region, category]);
  const uehCheck = useMemo(() => integrated100Score('UEH', {}), []);
  const handleSaveHcmut = async () => {
    if (!hcmutPreview) return;
    setIsSaving(true);
    try {
      const base = v2Ref.current || migrateLegacyScores({}, {});
      const next = {
        ...base, version: SCORES_VERSION, candidate: { region, category },
        scores: {
          ...(base.scores || {}),
          combined: {
            ...((base.scores || {}).combined || {}),
            HCMUT: {
              status: 'actual', total: hcmutPreview.value, scale: 100,
              formulaVersion: hcmutPreview.formulaVersion, breakdown: hcmutPreview.breakdown,
              updatedAt: new Date().toISOString(),
            },
          },
        },
      };
      await persistV2(next);
      setMessage({ type: 'success', text: `Đã lưu điểm tổng hợp BKHCM: ${fmt(hcmutPreview.value)} / 100 vào hồ sơ!` });
      setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi khi lưu: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

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
              <p className="text-xs text-slate-400 leading-relaxed">
                Nhập điểm V-SAT theo từng môn (mỗi môn thang 150) — hệ thống tự tính tổng cho từng tổ hợp
                khi trường chọn tổ hợp khác nhau. Nhập đúng 3 môn thì tổng tổ hợp được lưu kèm.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SUBJECTS.slice(0, 9).map((sj) => (
                  <NumberField
                    key={sj.key}
                    label={`${sj.label} (0–150)`}
                    value={vsatSubjects[sj.key] ?? ''}
                    onChange={(v) => setVsatSubjects((p) => ({ ...p, [sj.key]: v }))}
                    max={150}
                    step="1"
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="flex-1 border-t border-white/10" />
                hoặc nhập thẳng tổng điểm tổ hợp nếu bạn chỉ nhớ tổng
                <span className="flex-1 border-t border-white/10" />
              </div>
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

        {/* Máy tính kết hợp: BCA + tổng hợp thang 100 (formulas.js) */}
        <section className="arena-card p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-arena-display font-bold text-lg">Máy tính điểm kết hợp & tổng hợp</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Dùng ngay điểm bạn đã nhập ở trên — không phải nhập lại. Công thức nằm ở thư viện dùng chung,
              kết quả được lưu vào hồ sơ để trang Tìm trường ước tính đúng thang điểm.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 p-3 space-y-2">
            <h3 className="font-arena-display font-bold text-sm">Khối Công an (BCA) — phương thức 3</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Điểm xét tuyển thang 30 = điểm tổ hợp THPT × 2/5 + (điểm bài thi BCA quy thang 30) × 3/5 + điểm cộng/ưu tiên.
            </p>
            {bcaPreview ? (
              <p className="text-sm">
                Điểm kết hợp của bạn: <span className="tabular font-bold" style={{ color: 'var(--arena-jade)' }}>{fmt(bcaPreview.value)} / 30</span>
                <span className="block text-xs text-slate-400 mt-1">
                  THPT đóng góp {fmt(bcaPreview.breakdown.thptPhan)} · BCA đóng góp {fmt(bcaPreview.breakdown.bcaPhan)} · Ưu tiên +{fmt(bcaPreview.breakdown.uuTien)}
                </span>
              </p>
            ) : (
              <p className="text-xs text-slate-500">Nhập điểm tổ hợp THPT (mục THPT) và tổng điểm bài thi BCA (mục BCA) để xem điểm kết hợp.</p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 p-3 space-y-2">
            <h3 className="font-arena-display font-bold text-sm">ĐH Bách khoa TP.HCM (HCMUT) — tổng hợp thang 100</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Điểm học lực = Điểm năng lực × 70% + TNTHPT quy đổi × 20% + Học bạ quy đổi × 10%.
              Khi tổ hợp không nhân đôi Toán, điểm năng lực chia cho 12 (không phải 15) — lỗi mẫu số ở bản cũ đã được sửa.
            </p>
            <NumberField label="Điểm cộng (chứng chỉ / giải thưởng, 0–10)" value={bonus100} onChange={setBonus100} max={10} />
            {hcmutPreview ? (
              <div className="text-sm space-y-1">
                <p>
                  Điểm tổng hợp của bạn: <span className="tabular font-bold" style={{ color: 'var(--arena-jade)' }}>{fmt(hcmutPreview.value)} / 100</span>
                  <span className="text-xs text-slate-400"> ({hcmutPreview.breakdown.doiTuong})</span>
                </p>
                <p className="text-xs text-slate-400">
                  Điểm năng lực {fmt(hcmutPreview.breakdown.diemNL)} · TNTHPT quy đổi {fmt(hcmutPreview.breakdown.tnthptQD)} ·
                  Học bạ quy đổi {fmt(hcmutPreview.breakdown.hbQD)} · Ưu tiên +{fmt(hcmutPreview.breakdown.uuTien)}
                </p>
                <button onClick={handleSaveHcmut} disabled={isSaving} className="btn-arena btn-arena-sm btn-arena-jade cursor-pointer">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">save</span>
                  Lưu điểm tổng hợp HCMUT vào hồ sơ
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Nhập đủ điểm THPT từng môn (mục THPT) và điểm học bạ từng môn (mục Học bạ) để tính điểm tổng hợp. Có điểm V-ACT thì nhập thêm ở mục V-ACT (đối tượng ĐT 2.1).</p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 p-3 space-y-1">
            <h3 className="font-arena-display font-bold text-sm">Đại học Kinh tế TP.HCM (UEH) — tổng hợp thang 100</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {uehCheck.explain[0]} Bạn vẫn tra được điểm chuẩn tích hợp của UEH ở trang Tìm trường.
            </p>
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
