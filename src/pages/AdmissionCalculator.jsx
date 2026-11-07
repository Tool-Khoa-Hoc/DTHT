import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { EXAMS, REGION_PRIORITY, CATEGORY_PRIORITY, getExamMeta } from '../lib/admission/exams';
import {
  migrateLegacyScores,
  validateScoreInput,
  validateEntry,
  saveScoreEntry,
  SCORES_VERSION,
} from '../lib/admission/scores';
import { priorityApplied } from '../lib/admission/predict';
import { SUBJECTS, canonicalSubjects, getSubjectLabel } from '../lib/admission/subjects';
import { COMBOS as COMBO_DEFS, comboRawScore } from '../lib/admission/combos';
import {
  bcaCombinedScore,
  integrated100Score,
  hcmutCombinedScore,
  hscaComboScore,
  vsatComboScore,
} from '../lib/admission/formulas';
import { fmt } from '../lib/admission/format';
import ProgressBar from '../components/ui/ProgressBar';

// Tổ hợp dùng chung từ lib/admission/combos.js.
const COMBOS = Object.fromEntries(
  Object.entries(COMBO_DEFS).map(([code, def]) => [code, def.subjects]),
);

const DRAFT_KEY = 'admission_scores_v2'; // giữ nguyên khoá lưu nháp để không mất dữ liệu của người dùng; nội dung là schema v3
const ENTRY_EXAMS = ['thpt', 'hocba', 'hsa', 'vact', 'tsa', 'spt', 'hsca', 'bca', 'vsat'];
const PART_EXAMS = ['hsa', 'vact', 'tsa', 'bca'];
const TRIO_EXAMS = ['spt', 'hsca'];

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

export default function AdmissionCalculator() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { lang, locale, pick, t } = useLanguage();

  const admissionScoresRef = useRef(null);
  const v2Ref = useRef(null);
  const hydratedForRef = useRef(null);

  const [savedV2, setSavedV2] = useState(null);
  const [selectedExam, setSelectedExam] = useState('thpt');
  const [region, setRegion] = useState('KV3');
  const [category, setCategory] = useState('NONE');
  const [subjectsThpt, setSubjectsThpt] = useState({});
  const [subjectsHb, setSubjectsHb] = useState({});
  const [parts, setParts] = useState({});
  const [totals, setTotals] = useState({});
  const [trios, setTrios] = useState({});
  const [vsatSubjects, setVsatSubjects] = useState({});
  const [bonus100, setBonus100] = useState('');
  const [statuses, setStatuses] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // --- Hydrate từ profile (Supabase) hoặc draft (khách) ---
  useEffect(() => {
    const hydKey = user?.id || 'guest';
    if (hydratedForRef.current === hydKey) return;
    if (user && !profile) return;

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
          setVsatSubjects(
            Object.fromEntries(Object.entries(entry.subjects).map(([k, v]) => [k, String(v)])),
          );
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

  const getPartLabel = (code, pk) => {
    const key = `academics.examParts.${code}.${pk}`;
    const resolved = t(key);
    return resolved !== key ? resolved : pk;
  };

  const getStatusShortLabel = (st) => {
    if (st === 'mock') return t('academics.status.mockShort');
    if (st === 'target') return t('academics.status.targetShort');
    if (st === 'none') return '—';
    return t('academics.status.actual');
  };

  const statusOptions = useMemo(
    () => [
      { value: 'actual', label: t('academics.status.actual') },
      { value: 'mock', label: t('academics.status.mock') },
      { value: 'target', label: t('academics.status.target') },
    ],
    [t],
  );

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
      } catch {
        /* ignore blocked storage */
      }
    }
    setSavedV2(nextV2);
  };

  const saveEntry = async (code, entry) => {
    const validation = validateEntry(code, entry, lang);
    if (!validation.ok) {
      setMessage({ type: 'error', text: validation.error });
      return;
    }
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const base = v2Ref.current || migrateLegacyScores({}, {});
      const withCandidate = { ...base, candidate: { region, category } };
      const nextV2 = saveScoreEntry(withCandidate, code, entry);
      await persistV2(nextV2);
      const examLabel = getExamMeta(code, lang).displayLabel;
      setMessage({
        type: 'success',
        text: pick(
          `Đã lưu điểm ${examLabel}${user ? ' vào hồ sơ' : ' (nháp trên thiết bị này)'}!`,
          `Saved ${examLabel} scores${user ? ' to your profile' : ' (draft on this device)'}!`,
        ),
      });
      setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    } catch (err) {
      setMessage({
        type: 'error',
        text: pick('Lỗi khi lưu: ', 'Save failed: ') + err.message,
      });
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
      setMessage({
        type: 'success',
        text: pick('Đã lưu thông tin ưu tiên!', 'Saved priority profile!'),
      });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: pick('Lỗi khi lưu: ', 'Save failed: ') + err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Đặt lại các ô đang nhập của kỳ thi hiện tại ---
  const handleResetSelected = () => {
    if (selectedExam === 'thpt') {
      setSubjectsThpt({});
    } else if (selectedExam === 'hocba') {
      setSubjectsHb({});
    } else if (PART_EXAMS.includes(selectedExam)) {
      setParts((prev) => {
        const next = { ...prev };
        for (const pk of Object.keys(EXAMS[selectedExam]?.parts || {})) {
          delete next[`${selectedExam}.${pk}`];
        }
        return next;
      });
      setTotals((prev) => ({ ...prev, [selectedExam]: '' }));
    } else if (TRIO_EXAMS.includes(selectedExam)) {
      setTrios((prev) => {
        const next = { ...prev };
        [0, 1, 2].forEach((i) => {
          delete next[`${selectedExam}.${i}`];
        });
        return next;
      });
      setTotals((prev) => ({ ...prev, [selectedExam]: '' }));
    } else if (selectedExam === 'vsat') {
      setVsatSubjects({});
      setTotals((prev) => ({ ...prev, vsat: '' }));
    }
    setMessage({
      type: 'info',
      text: pick(
        `Đã xoá trắng các ô nhập ${getExamMeta(selectedExam, lang).displayLabel} trên màn hình.`,
        `Cleared ${getExamMeta(selectedExam, lang).displayLabel} form fields on screen.`,
      ),
    });
  };

  // --- Builders (validate -> entry v3) ---
  const buildSubjectsEntry = (subjectsState) => {
    const subjects = {};
    for (const [k, v] of Object.entries(subjectsState)) {
      if (v === '' || v == null) continue;
      const n = parseFloat(v);
      const subjLabel = getSubjectLabel(k, lang);
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        return {
          error: pick(
            `Điểm môn ${subjLabel} phải trong khoảng 0–10`,
            `Score for ${subjLabel} must be between 0 and 10`,
          ),
        };
      }
      subjects[k] = n;
    }
    if (Object.keys(subjects).length === 0) {
      return {
        error: pick(
          'Hãy nhập điểm ít nhất một môn.',
          'Please enter a score for at least one subject.',
        ),
      };
    }
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
      const pLabel = getPartLabel(code, pk);
      if (!Number.isFinite(n) || n < 0 || n > max) {
        return {
          error: pick(
            `Điểm phần ${pLabel} phải trong khoảng 0–${max}`,
            `Score for ${pLabel} must be between 0 and ${max}`,
          ),
        };
      }
      partValues[pk] = n;
      filled += 1;
    }
    let total;
    if (filled === Object.keys(def).length && filled > 0) {
      total = Math.round(Object.values(partValues).reduce((s, v) => s + v, 0) * 100) / 100;
    } else if (totals[code] !== '' && totals[code] != null) {
      const check = validateScoreInput(code, totals[code], lang);
      if (!check.ok) return { error: check.error };
      total = check.value;
    } else {
      return {
        error: pick(
          'Hãy nhập đủ điểm từng phần, hoặc nhập thẳng tổng điểm.',
          'Please enter scores for all sections, or enter the total score directly.',
        ),
      };
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
      return {
        error: pick(
          'Hãy nhập điểm cả 3 môn thi chuyên biệt (mỗi môn thang 10).',
          'Please enter scores for all 3 specialized subjects (0–10 each).',
        ),
      };
    }
    const nums = [];
    for (const v of values) {
      const n = parseFloat(v);
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        return {
          error: pick(
            'Mỗi môn phải trong khoảng 0–10',
            'Each subject score must be between 0 and 10',
          ),
        };
      }
      nums.push(n);
    }
    return {
      entry: {
        status: statusOf(code),
        total: Math.round(nums.reduce((s, v) => s + v, 0) * 100) / 100,
        scale: 30,
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
      const subjLabel = getSubjectLabel(k, lang);
      if (!Number.isFinite(n) || n < 0 || n > 150) {
        return {
          error: pick(
            `Điểm V-SAT môn ${subjLabel} phải trong khoảng 0–150`,
            `V-SAT score for ${subjLabel} must be between 0 and 150`,
          ),
        };
      }
      subjects[k] = n;
    }
    if (Object.keys(subjects).length > 0) {
      if (Object.keys(subjects).length < 3) {
        return {
          error: pick(
            'Hãy nhập điểm V-SAT ít nhất 3 môn để tính tổ hợp.',
            'Please enter at least 3 V-SAT subject scores to compute a 3-subject combo.',
          ),
        };
      }
      const byGroup = {};
      for (const code of Object.keys(COMBOS)) {
        const sc = comboRawScore(subjects, code);
        if (sc != null) byGroup[code] = sc;
      }
      const groupScores = Object.values(byGroup);
      const total =
        groupScores.length > 0
          ? Math.round(Math.max(...groupScores) * 100) / 100
          : Object.keys(subjects).length === 3
            ? Math.round(Object.values(subjects).reduce((a, b) => a + b, 0) * 100) / 100
            : null;
      return {
        entry: {
          status: statusOf('vsat'),
          subjects,
          byGroup,
          total,
          scale: 450,
          scoreMode: 'per-subject-150',
          updatedAt: new Date().toISOString(),
        },
      };
    }
    const check = validateScoreInput('vsat', totals.vsat, lang);
    if (!check.ok) {
      return {
        error: pick(
          'Hãy nhập điểm V-SAT theo từng môn, hoặc nhập thẳng tổng điểm tổ hợp (0–450).',
          'Please enter V-SAT subject scores or enter the 3-subject combo total directly (0–450).',
        ),
      };
    }
    return {
      entry: {
        status: statusOf('vsat'),
        total: check.value,
        scale: 450,
        updatedAt: new Date().toISOString(),
      },
    };
  };

  const handleSaveSelected = () => {
    let built;
    if (selectedExam === 'vsat') built = buildVsatEntry();
    else if (selectedExam === 'thpt') built = buildSubjectsEntry(subjectsThpt);
    else if (selectedExam === 'hocba') built = buildSubjectsEntry(subjectsHb);
    else if (PART_EXAMS.includes(selectedExam)) built = buildPartsEntry(selectedExam);
    else if (TRIO_EXAMS.includes(selectedExam)) built = buildTrioEntry(selectedExam);
    else {
      const check = validateScoreInput(selectedExam, totals[selectedExam], lang);
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
    const subjects = {};
    for (const [k, v] of Object.entries(subjectsThpt)) {
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
  }, [subjectsThpt]);

  const bestThptRaw = useMemo(() => {
    const vals = Object.values(thptPreview);
    return vals.length ? Math.max(...vals) : null;
  }, [thptPreview]);

  const priorityPreview =
    bestThptRaw != null ? priorityApplied(bestThptRaw, region, category) : null;

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
    const bcaTotal = previewPartsTotal('bca', parts, totals);
    if (bcaTotal == null || !Number.isFinite(bcaTotal) || bestThptRaw == null) return null;
    return bcaCombinedScore({
      thptComboScore: bestThptRaw,
      bcaExamScore: bcaTotal,
      region,
      category,
      lang,
    });
  }, [parts, totals, bestThptRaw, region, category, lang]);

  const hcmutPreview = useMemo(() => {
    const comboCodes = Object.keys(thptPreview);
    if (!comboCodes.length) return null;
    const bestCombo = comboCodes.reduce((a, b) => (thptPreview[a] >= thptPreview[b] ? a : b));
    const keys = COMBOS[bestCombo] || [];
    const thptScores = keys.map((k) => thptNums[k]);
    const hocbaScores = keys.map((k) => hbNums[k]);
    if (thptScores.some((v) => v == null) || hocbaScores.some((v) => v == null)) return null;
    const vactTotal = previewPartsTotal('vact', parts, totals);
    const vactToanPart = parseFloat(parts['vact.toan']);
    return hcmutCombinedScore({
      vactTotal: vactTotal != null && Number.isFinite(vactTotal) ? vactTotal : null,
      vactToan: Number.isFinite(vactToanPart) ? vactToanPart : null,
      doubleMath: keys.includes('toan'),
      thptScores,
      thptMathScore: thptNums.toan,
      hocbaScores,
      hocbaMathScore: hbNums.toan,
      bonus: parseFloat(bonus100) || 0,
      region,
      category,
      lang,
    });
  }, [thptPreview, thptNums, hbNums, totals, parts, bonus100, region, category, lang]);

  const hscaWeightedPreview = useMemo(() => {
    const main = parseFloat(trios['hsca.0']);
    const hbVals = Object.values(hbNums)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a);
    const sub1 = Number.isFinite(parseFloat(trios['hsca.1']))
      ? parseFloat(trios['hsca.1'])
      : hbVals[0];
    const sub2 = Number.isFinite(parseFloat(trios['hsca.2']))
      ? parseFloat(trios['hsca.2'])
      : hbVals[1];
    if (!Number.isFinite(main) || !Number.isFinite(sub1) || !Number.isFinite(sub2)) return null;
    return hscaComboScore({ monChinh: main, hb1: sub1, hb2: sub2, lang });
  }, [trios, hbNums, lang]);

  const vsatExactThreeExplain = useMemo(() => {
    const clean = {};
    for (const [k, v] of Object.entries(vsatSubjects)) {
      if (v === '' || v == null) continue;
      const n = parseFloat(v);
      if (Number.isFinite(n) && n >= 0 && n <= 150) clean[k] = n;
    }
    if (Object.keys(clean).length !== 3) return null;
    return vsatComboScore(clean, lang);
  }, [vsatSubjects, lang]);

  const uehCheck = useMemo(() => integrated100Score('UEH', {}, lang), [lang]);

  const handleSaveHcmut = async () => {
    if (!hcmutPreview) return;
    setIsSaving(true);
    try {
      const base = v2Ref.current || migrateLegacyScores({}, {});
      const next = {
        ...base,
        version: SCORES_VERSION,
        candidate: { region, category },
        scores: {
          ...(base.scores || {}),
          combined: {
            ...((base.scores || {}).combined || {}),
            HCMUT: {
              status: 'actual',
              total: hcmutPreview.value,
              scale: 100,
              formulaVersion: hcmutPreview.formulaVersion,
              breakdown: hcmutPreview.breakdown,
              updatedAt: new Date().toISOString(),
            },
          },
        },
      };
      await persistV2(next);
      setMessage({
        type: 'success',
        text: pick(
          `Đã lưu điểm tổng hợp BKHCM: ${fmt(hcmutPreview.value, 2, locale)} / 100 vào hồ sơ!`,
          `Saved HCMUT composite score: ${fmt(hcmutPreview.value, 2, locale)} / 100 to profile!`,
        ),
      });
      setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    } catch (err) {
      setMessage({
        type: 'error',
        text: pick('Lỗi khi lưu: ', 'Save failed: ') + err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const legacyKeys = Object.keys(savedV2?.legacy_unverified || {});
  const savedEntries = useMemo(
    () =>
      Object.entries(savedV2?.scores || {}).filter(
        ([k, v]) => k !== 'combined' && v && v.status !== 'none' && (v.total != null || v.subjects),
      ),
    [savedV2],
  );
  const savedHcmut = savedV2?.scores?.combined?.HCMUT;

  const exam = getExamMeta(selectedExam, lang);

  return (
    <div className="min-h-dvh font-sans text-foreground bg-background relative pb-24">
      <div className="max-w-4xl mx-auto w-full">
        {/* Sticky App Bar */}
        <header className="sticky top-0 z-40 backdrop-blur-md bg-paper/95 border-b border-border px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={pick('Quay lại', 'Go back')}
              className="w-10 h-10 shrink-0 rounded-full bg-surface-alt border border-border flex items-center justify-center hover:bg-surface text-foreground transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                arrow_back
              </span>
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-extrabold text-lg tracking-tight text-foreground truncate">
                {pick('Nhập điểm xét tuyển', 'Admission Score Profile')}
              </h1>
              <p className="text-[11px] text-secondary-text truncate">
                {pick(
                  'Một hồ sơ điểm duy nhất cho mọi kỳ thi — đồng bộ sang trang Chọn Trường',
                  'One unified score profile across all entrance exams — synced with School Finder',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/tim-truong')}
            className="btn-arena btn-arena-sm btn-arena-jade cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              school
            </span>
            <span>{pick('Tìm trường', 'Find Schools')}</span>
          </button>
        </header>

        {/* Cross-page Navigation Tabs */}
        <nav
          aria-label={pick('Điều hướng công cụ học thuật', 'Academic tools navigation')}
          className="px-4 pt-4"
        >
          <div className="flex border-b border-border gap-6 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => navigate('/gpa')}
              className="pb-3 border-b-2 border-transparent text-secondary-text hover:text-foreground font-display font-semibold text-sm whitespace-nowrap flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                school
              </span>
              {t('academics.nav.gpa')}
            </button>
            <button
              type="button"
              aria-current="page"
              className="pb-3 border-b-2 border-primary text-primary font-display font-bold text-sm whitespace-nowrap flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                calculate
              </span>
              {t('academics.nav.admission')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/schools')}
              className="pb-3 border-b-2 border-transparent text-secondary-text hover:text-foreground font-display font-semibold text-sm whitespace-nowrap flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                account_balance
              </span>
              {t('academics.nav.schools')}
            </button>
          </div>
        </nav>

        <main className="px-4 py-5 space-y-5">
          {!user && (
            <div className="paper-card border border-gold/60 bg-gold-soft/40 p-4 flex gap-3 items-start">
              <span className="material-symbols-outlined shrink-0 text-accent" aria-hidden="true">
                info
              </span>
              <p className="text-xs leading-relaxed text-secondary-text">
                {pick(
                  'Bạn chưa đăng nhập — điểm sẽ lưu nháp trên thiết bị này. Đăng nhập để điểm đồng bộ vào hồ sơ và dùng được trên mọi thiết bị.',
                  'You are not signed in — scores are saved locally as a draft on this device. Sign in to sync your admission profile across devices.',
                )}
              </p>
            </div>
          )}

          {legacyKeys.length > 0 && (
            <div className="paper-card border border-accent/45 bg-gold-soft/40 p-4 flex gap-3 items-start">
              <span className="material-symbols-outlined shrink-0 text-accent" aria-hidden="true">
                warning
              </span>
              <p className="text-xs leading-relaxed text-secondary-text">
                {pick(
                  'Điểm HSA / V-ACT bạn lưu ở bản cũ đang bị cách ly vì bản cũ ghi sai thang điểm hai kỳ thi này (HSA đúng là thang 150 của ĐHQG Hà Nội, V-ACT đúng là thang 1200 của ĐHQG TP.HCM). Hãy nhập lại điểm ở hai mục HSA và V-ACT bên dưới — điểm cũ không được tự gán lại để tránh sai lệch.',
                  'Your previously saved HSA / V-ACT scores have been quarantined because an earlier version swapped their scales (HSA uses VNU Hanoi’s 150-pt scale; V-ACT uses VNU-HCM’s 1200-pt scale). Please re-enter your HSA and V-ACT scores below for accurate predictions.',
                )}
              </p>
            </div>
          )}

          {/* Điểm đã lưu */}
          {(savedEntries.length > 0 || savedHcmut?.total != null) && (
            <section className="paper-card border border-border p-4">
              <h2 className="font-display font-bold text-sm text-foreground">
                {pick('Điểm đã lưu trong hồ sơ', 'Saved Scores in Profile')}
              </h2>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {savedEntries.map(([code, v]) => {
                  const meta = getExamMeta(code, lang);
                  return (
                    <span key={code} className="arena-chip">
                      {meta.displayLabel}:{' '}
                      <span className="tabular font-bold text-primary">
                        {v.total != null
                          ? `${fmt(parseFloat(v.total), code === 'vact' || code === 'vsat' ? 0 : 2, locale)} / ${v.scale ?? meta.scale ?? ''}`
                          : pick('theo tổ hợp', 'by combo')}
                      </span>
                      <span className="text-secondary-text">
                        ({getStatusShortLabel(v.status)})
                      </span>
                    </span>
                  );
                })}
                {savedHcmut?.total != null && (
                  <span className="arena-chip">
                    HCMUT:{' '}
                    <span className="tabular font-bold text-primary">
                      {fmt(parseFloat(savedHcmut.total), 2, locale)} / 100
                    </span>
                  </span>
                )}
              </div>
            </section>
          )}

          {/* Ưu tiên khu vực / đối tượng */}
          <section className="paper-card border border-border p-4 sm:p-5 space-y-3.5">
            <h2 className="font-display font-bold text-base text-foreground">
              {pick('Khu vực & đối tượng ưu tiên', 'Regional & Policy Priority Profile')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="region-select"
                  className="block text-xs font-semibold mb-1.5 text-secondary-text"
                >
                  {pick('Khu vực ưu tiên', 'Priority Region')}
                </label>
                <select
                  id="region-select"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full min-h-[44px] bg-surface border border-border rounded-xl px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary cursor-pointer"
                >
                  {Object.entries(REGION_PRIORITY).map(([k, v]) => (
                    <option key={k} value={k}>
                      {t(`academics.priority.regions.${k}`)} (+{fmt(v, 2, locale)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="category-select"
                  className="block text-xs font-semibold mb-1.5 text-secondary-text"
                >
                  {pick('Nhóm đối tượng ưu tiên', 'Policy Priority Category')}
                </label>
                <select
                  id="category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-[44px] bg-surface border border-border rounded-xl px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary cursor-pointer"
                >
                  {Object.keys(CATEGORY_PRIORITY).length > 0 && (
                    <>
                      <option value="NONE">{t('academics.priority.categories.NONE')}</option>
                      <option value="UT1">{t('academics.priority.categories.UT1')}</option>
                      <option value="UT2">{t('academics.priority.categories.UT2')}</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            <p className="text-xs text-secondary-text leading-relaxed">
              {pick(
                `Theo quy chế của Bộ GD&ĐT, từ mốc tổng điểm ${fmt(22.5, 1, locale)} trở lên điểm ưu tiên thực tế giảm dần tuyến tính: ưu tiên thực = (30 − tổng điểm) / ${fmt(7.5, 1, locale)} × ưu tiên danh nghĩa.`,
                `Under MOET regulations, once a raw 30-pt score reaches ${fmt(22.5, 1, locale)} or above, bonus points taper linearly: effective bonus = (30 − raw score) / ${fmt(7.5, 1, locale)} × nominal bonus.`,
              )}
              {priorityPreview != null && bestThptRaw != null && (
                <>
                  {' '}
                  {pick(
                    <>
                      Với tổ hợp THPT cao nhất hiện tại (
                      <span className="tabular font-semibold">{fmt(bestThptRaw, 2, locale)}</span>
                      ), ưu tiên thực của bạn là{' '}
                      <span className="tabular font-bold text-jade">
                        +{fmt(priorityPreview, 2, locale)}
                      </span>{' '}
                      — không phải cộng thẳng điểm danh nghĩa.
                    </>,
                    <>
                      With your highest National Exam combo (
                      <span className="tabular font-semibold">{fmt(bestThptRaw, 2, locale)}</span>
                      ), your effective priority bonus is{' '}
                      <span className="tabular font-bold text-jade">
                        +{fmt(priorityPreview, 2, locale)}
                      </span>{' '}
                      rather than the full nominal amount.
                    </>,
                  )}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={saveCandidate}
              disabled={isSaving}
              className="btn-arena btn-arena-sm btn-arena-ghost cursor-pointer"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                save
              </span>
              <span>
                {isSaving
                  ? pick('Đang lưu...', 'Saving...')
                  : pick('Lưu thông tin ưu tiên', 'Save Priority Profile')}
              </span>
            </button>
          </section>

          {/* Chọn kỳ thi */}
          <section aria-label={pick('Chọn kỳ thi', 'Select Entrance Exam')}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {ENTRY_EXAMS.map((code) => {
                const e = getExamMeta(code, lang);
                const active = selectedExam === code;
                const has = !!savedV2?.scores?.[code];
                return (
                  <button
                    type="button"
                    key={code}
                    onClick={() => {
                      setSelectedExam(code);
                      setMessage({ type: '', text: '' });
                    }}
                    aria-pressed={active}
                    className={`paper-card p-3 text-left transition-all cursor-pointer min-w-0 ${
                      active
                        ? 'border-2 border-primary bg-primary-soft/60 shadow-xs'
                        : 'border border-border hover:border-border-strong hover:bg-surface-alt/60'
                    }`}
                  >
                    <span
                      className={`font-display font-bold text-sm block truncate ${
                        active ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {e.displayLabel}
                    </span>
                    <span className="text-[11px] text-secondary-text block leading-snug mt-0.5 truncate">
                      {e.displayOrg}
                    </span>
                    <span className="text-[11px] text-muted-foreground block mt-1 truncate">
                      {code === 'spt' || code === 'hsca'
                        ? pick('Thang 10/môn', 'Scale 10/subj')
                        : pick(`Thang ${e.scale}`, `Scale ${e.scale}`)}
                      {has ? pick(' · Đã lưu', ' · Saved') : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Form nhập điểm của kỳ thi đang chọn */}
          <section className="paper-card border border-border p-4 sm:p-5 space-y-5">
            <div>
              <h2 className="font-display font-bold text-lg text-foreground">{exam.displayFull}</h2>
              <p className="text-xs text-secondary-text mt-1">
                {pick('Đơn vị tổ chức:', 'Organizer:')} {exam.displayOrg} ·{' '}
                {pick('Thang điểm:', 'Scale:')}{' '}
                {selectedExam === 'spt' || selectedExam === 'hsca'
                  ? pick(
                      '10 điểm/môn — tổng tổ hợp 30 để so với điểm chuẩn của trường',
                      '10 pts/subject — 30-pt 3-subject total matched against university cutoffs',
                    )
                  : `${exam.scale} (${exam.displayUnit})`}
              </p>
            </div>

            <div>
              <label
                htmlFor="status-select"
                className="block text-xs font-semibold mb-1.5 text-secondary-text"
              >
                {pick('Loại điểm', 'Score Type')}
              </label>
              <select
                id="status-select"
                value={statusOf(selectedExam)}
                onChange={(e) => setStatus(selectedExam, e.target.value)}
                className="w-full sm:w-72 min-h-[44px] bg-surface border border-border rounded-xl px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary cursor-pointer"
              >
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {statusOf(selectedExam) !== 'actual' && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {statusOf(selectedExam) === 'mock'
                    ? pick(
                        'Đang ở chế độ điểm thi thử — ước tính ở trang Chọn Trường là kịch bản giả định, không phải điểm thật.',
                        'Mock score mode active — School Finder estimates will reflect a practice scenario rather than official results.',
                      )
                    : pick(
                        'Đang ở chế độ điểm mục tiêu (what-if) — dùng để mô phỏng kịch bản điểm mong muốn ở trang Chọn Trường.',
                        'Target (what-if) mode active — School Finder estimates will simulate your target scenario.',
                      )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(EXAMS[selectedExam].parts).map(([pk, max]) => (
                    <NumberField
                      key={pk}
                      label={`${getPartLabel(selectedExam, pk)} (0–${max})`}
                      value={parts[`${selectedExam}.${pk}`] ?? ''}
                      onChange={(v) => setParts((p) => ({ ...p, [`${selectedExam}.${pk}`]: v }))}
                      max={max}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex-1 border-t border-border" />
                  <span>
                    {pick(
                      'hoặc nhập thẳng tổng điểm nếu bạn chỉ nhớ tổng',
                      'or enter the total score directly if you only have the total',
                    )}
                  </span>
                  <span className="flex-1 border-t border-border" />
                </div>
                <NumberField
                  label={pick(
                    `Tổng điểm ${exam.displayLabel} (0–${exam.scale})`,
                    `Total ${exam.displayLabel} Score (0–${exam.scale})`,
                  )}
                  value={totals[selectedExam] ?? ''}
                  onChange={(v) => setTotals((p) => ({ ...p, [selectedExam]: v }))}
                  max={exam.scale}
                />
                {selectedExam === 'bca' && (
                  <p className="text-xs text-secondary-text leading-relaxed">
                    {pick(
                      'Lưu ý: điểm xét tuyển khối Công an (phương thức 3) = điểm tổ hợp THPT × 2/5 + điểm bài thi BCA (quy thang 30) × 3/5 + điểm cộng. Hãy nhập thêm điểm THPT ở mục THPT để trang Chọn Trường ước tính đúng.',
                      'Note: Ministry of Public Security Method 3 score = National Exam combo × 2/5 + BCA exam (on 30-pt scale) × 3/5 + priority bonus. Enter your National Exam scores in the National Exam tab as well.',
                    )}
                  </p>
                )}
                <TotalPreview
                  label={pick(
                    `Tổng điểm ${exam.displayLabel}`,
                    `Total ${exam.displayLabel} Score`,
                  )}
                  value={previewPartsTotal(selectedExam, parts, totals)}
                  scale={exam.scale}
                  digits={selectedExam === 'vact' ? 0 : 2}
                />
              </div>
            )}

            {TRIO_EXAMS.includes(selectedExam) && (
              <div className="space-y-4">
                <p className="text-xs text-secondary-text leading-relaxed">
                  {pick(
                    'Nhập điểm 3 môn bạn đã thi trong kỳ thi chuyên biệt (mỗi môn thang 10). Hệ thống cộng thành tổng tổ hợp thang 30 — đúng thang các trường dùng khi công bố điểm chuẩn quy tổ hợp.',
                    'Enter scores for the 3 specialized exam subjects (0–10 scale each). They sum to a 30-point combination score matching official university cutoff scales.',
                  )}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[0, 1, 2].map((i) => (
                    <NumberField
                      key={i}
                      label={pick(`Môn thi ${i + 1} (0–10)`, `Exam Subject ${i + 1} (0–10)`)}
                      value={trios[`${selectedExam}.${i}`] ?? ''}
                      onChange={(v) => setTrios((p) => ({ ...p, [`${selectedExam}.${i}`]: v }))}
                      max={10}
                    />
                  ))}
                </div>
                <TotalPreview
                  label={pick('Tổng tổ hợp (thang 30)', '3-Subject Total (30-pt scale)')}
                  value={previewTrioTotal(selectedExam, trios)}
                  scale={30}
                />
                {selectedExam === 'hsca' && hscaWeightedPreview && (
                  <p className="text-xs text-secondary-text leading-relaxed">
                    {hscaWeightedPreview.explain[0]}
                  </p>
                )}
              </div>
            )}

            {selectedExam === 'vsat' && (
              <div className="space-y-4">
                <p className="text-xs text-secondary-text leading-relaxed">
                  {pick(
                    'Nhập điểm V-SAT theo từng môn (mỗi môn thang 150) — hệ thống tự tính tổng cho từng tổ hợp khi trường chọn tổ hợp khác nhau. Nhập từ 3 môn trở lên để tự động lưu điểm các tổ hợp.',
                    'Enter per-subject V-SAT scores (0–150 each) — the calculator automatically evaluates every 3-subject combination required by different majors.',
                  )}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SUBJECTS.slice(0, 9).map((sj) => (
                    <NumberField
                      key={sj.key}
                      label={`${getSubjectLabel(sj.key, lang)} (0–150)`}
                      value={vsatSubjects[sj.key] ?? ''}
                      onChange={(v) => setVsatSubjects((p) => ({ ...p, [sj.key]: v }))}
                      max={150}
                      step="1"
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex-1 border-t border-border" />
                  <span>
                    {pick(
                      'hoặc nhập thẳng tổng điểm tổ hợp nếu bạn chỉ nhớ tổng',
                      'or enter your 3-subject combo total directly',
                    )}
                  </span>
                  <span className="flex-1 border-t border-border" />
                </div>
                <NumberField
                  label={pick(
                    'Tổng điểm tổ hợp V-SAT (0–450, 3 môn × 150)',
                    'Total V-SAT Combo Score (0–450, 3 subjects × 150)',
                  )}
                  value={totals.vsat ?? ''}
                  onChange={(v) => setTotals((p) => ({ ...p, vsat: v }))}
                  max={450}
                />
                <TotalPreview
                  label={pick('Tổng điểm V-SAT', 'Total V-SAT Score')}
                  value={previewVsatTotal(vsatSubjects, totals)}
                  scale={450}
                  digits={0}
                />
                {vsatExactThreeExplain && (
                  <p className="text-xs text-secondary-text">{vsatExactThreeExplain.explain[0]}</p>
                )}
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveSelected}
                  disabled={isSaving}
                  className={`btn-arena flex-1 cursor-pointer ${
                    message.type === 'success' ? 'btn-arena-jade' : 'btn-arena-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {isSaving ? 'sync' : message.type === 'success' ? 'check_circle' : 'save'}
                  </span>
                  <span>
                    {isSaving
                      ? pick('Đang lưu...', 'Saving...')
                      : message.type === 'success'
                        ? pick('Đã lưu điểm!', 'Scores Saved!')
                        : pick(`Lưu điểm ${exam.displayLabel}`, `Save ${exam.displayLabel} Scores`)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleResetSelected}
                  disabled={isSaving}
                  className="btn-arena btn-arena-ghost cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    restart_alt
                  </span>
                  <span>{pick('Xoá trắng mục này', 'Clear Fields')}</span>
                </button>
              </div>
              {message.text && (
                <p
                  className={`text-center text-xs font-medium ${
                    message.type === 'error'
                      ? 'text-danger'
                      : message.type === 'info'
                        ? 'text-secondary-text'
                        : 'text-jade'
                  }`}
                  role="status"
                >
                  {message.text}
                </p>
              )}
            </div>
          </section>

          {/* Máy tính kết hợp: BCA + tổng hợp thang 100 (formulas.js) */}
          <section className="paper-card border border-border p-4 sm:p-5 space-y-4">
            <div>
              <h2 className="font-display font-bold text-lg text-foreground">
                {pick(
                  'Máy tính điểm kết hợp & tổng hợp',
                  'Combined & Composite Score Calculators',
                )}
              </h2>
              <p className="text-xs text-secondary-text mt-1 leading-relaxed">
                {pick(
                  'Dùng ngay điểm bạn đã nhập ở trên — không phải nhập lại. Công thức nằm ở thư viện dùng chung, kết quả được lưu vào hồ sơ để trang Chọn Trường ước tính đúng thang điểm.',
                  'Automatically computed from the exam scores entered above — no duplicate input required. Save composite scores to your profile for accurate 100-pt university cutoff comparisons.',
                )}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface-alt/60 p-3.5 space-y-2">
              <h3 className="font-display font-bold text-sm text-foreground">
                {pick(
                  'Khối Công an (BCA) — phương thức 3',
                  'Public Security Academies (BCA) — Method 3',
                )}
              </h3>
              <p className="text-xs text-secondary-text leading-relaxed">
                {pick(
                  'Điểm xét tuyển thang 30 = điểm tổ hợp THPT × 2/5 + (điểm bài thi BCA quy thang 30) × 3/5 + điểm cộng/ưu tiên.',
                  '30-pt Admission Score = National Exam combo × 2/5 + (BCA exam scaled to 30) × 3/5 + priority bonus.',
                )}
              </p>
              {bcaPreview ? (
                <div className="text-sm text-foreground space-y-1">
                  <p>
                    {pick('Điểm kết hợp của bạn:', 'Your combined score:')}{' '}
                    <span className="tabular font-bold text-jade">
                      {fmt(bcaPreview.value, 2, locale)} / 30
                    </span>
                  </p>
                  <p className="text-xs text-secondary-text">
                    {bcaPreview.explain.join(' · ')}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {pick(
                    'Nhập điểm tổ hợp THPT (mục THPT) và tổng điểm bài thi BCA (mục BCA) để xem điểm kết hợp.',
                    'Enter your National Exam subject scores and BCA exam score above to preview your Method 3 combined score.',
                  )}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-alt/60 p-3.5 space-y-2.5">
              <h3 className="font-display font-bold text-sm text-foreground">
                {pick(
                  'ĐH Bách khoa TP.HCM (HCMUT) — tổng hợp thang 100',
                  'HCMUT (Ho Chi Minh City Univ. of Technology) — 100-pt Composite',
                )}
              </h3>
              <p className="text-xs text-secondary-text leading-relaxed">
                {pick(
                  'Điểm học lực = Điểm năng lực × 70% + TNTHPT quy đổi × 20% + Học bạ quy đổi × 10%. Khi tổ hợp không nhân đôi Toán, điểm năng lực chia cho 12 (không phải 15).',
                  'Academic Score = Competency × 70% + Converted National Exam × 20% + Converted Transcript × 10%. Unweighted Math combos divide V-ACT by 12 (weighted Math divides by 15).',
                )}
              </p>
              <NumberField
                label={pick(
                  'Điểm cộng (chứng chỉ / giải thưởng, 0–10)',
                  'Bonus Points (awards / certificates, 0–10)',
                )}
                value={bonus100}
                onChange={setBonus100}
                max={10}
              />
              {hcmutPreview ? (
                <div className="text-sm space-y-1.5 text-foreground">
                  <p>
                    {pick('Điểm tổng hợp của bạn:', 'Your composite score:')}{' '}
                    <span className="tabular font-bold text-jade">
                      {fmt(hcmutPreview.value, 2, locale)} / 100
                    </span>
                    <span className="text-xs text-secondary-text">
                      {' '}
                      ({hcmutPreview.breakdown.doiTuong})
                    </span>
                  </p>
                  <p className="text-xs text-secondary-text">
                    {hcmutPreview.explain.join(' · ')} ·{' '}
                    {pick('Ưu tiên', 'Priority')} +{fmt(hcmutPreview.breakdown.uuTien, 2, locale)}
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveHcmut}
                    disabled={isSaving}
                    className="btn-arena btn-arena-sm btn-arena-jade cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      save
                    </span>
                    <span>
                      {pick(
                        'Lưu điểm tổng hợp HCMUT vào hồ sơ',
                        'Save HCMUT Composite Score to Profile',
                      )}
                    </span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {pick(
                    'Nhập đủ điểm THPT từng môn (mục THPT) và điểm học bạ từng môn (mục Học bạ) để tính điểm tổng hợp. Có điểm V-ACT thì nhập thêm ở mục V-ACT (đối tượng ĐT 2.1).',
                    'Enter at least 3 matching subjects in both National Exam and Transcript tabs to compute the composite score. Add your V-ACT score in the V-ACT tab for Group 2.1.',
                  )}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-alt/60 p-3.5 space-y-1">
              <h3 className="font-display font-bold text-sm text-foreground">
                {pick(
                  'Đại học Kinh tế TP.HCM (UEH) — tổng hợp thang 100',
                  'UEH (Univ. of Economics Ho Chi Minh City) — 100-pt Integrated',
                )}
              </h3>
              <p className="text-xs text-secondary-text leading-relaxed">
                {uehCheck.explain[0]}{' '}
                {pick(
                  'Bạn vẫn tra được điểm chuẩn tích hợp của UEH ở trang Chọn Trường.',
                  'You can still browse UEH’s historical integrated cutoffs in School Finder.',
                )}
              </p>
            </div>
          </section>

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed pb-4">
            {pick(
              'Điểm bạn nhập được dùng để ước tính khả năng ở trang Chọn Trường. Ước tính dựa trên điểm chuẩn các năm trước — không phải cam kết trúng tuyển. Điểm 0 là giá trị hợp lệ và được lưu như các điểm khác.',
              'Entered scores power statistical admission estimates in School Finder based on prior years’ cutoffs — not an official admission guarantee. A score of 0 is treated as a valid numeric entry.',
            )}
          </p>
        </main>
      </div>
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

function previewVsatTotal(vsatSubjects, totals) {
  const subjects = {};
  for (const [k, v] of Object.entries(vsatSubjects || {})) {
    if (v === '' || v == null) continue;
    const n = parseFloat(v);
    if (Number.isFinite(n) && n >= 0 && n <= 150) subjects[k] = n;
  }
  if (Object.keys(subjects).length >= 3) {
    let best = null;
    for (const code of Object.keys(COMBOS)) {
      const sc = comboRawScore(subjects, code);
      if (sc != null && (best == null || sc > best)) best = sc;
    }
    if (best != null) return best;
    if (Object.keys(subjects).length === 3) {
      return Object.values(subjects).reduce((a, b) => a + b, 0);
    }
  }
  if (totals?.vsat !== '' && totals?.vsat != null) {
    const t = parseFloat(totals.vsat);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function SubjectForm({ subjectsState, onChange, transcript }) {
  const { lang, locale, pick } = useLanguage();

  const sortedCombos = useMemo(() => {
    const out = [];
    for (const [combo, keys] of Object.entries(COMBOS)) {
      if (
        keys.every(
          (k) =>
            subjectsState[k] !== '' &&
            subjectsState[k] != null &&
            Number.isFinite(parseFloat(subjectsState[k])),
        )
      ) {
        const sum = keys.reduce((s, k) => s + parseFloat(subjectsState[k]), 0);
        out.push([combo, Math.round(sum * 100) / 100]);
      }
    }
    return out.sort((a, b) => b[1] - a[1]);
  }, [subjectsState]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-secondary-text leading-relaxed">
        {transcript
          ? pick(
              'Nhập điểm trung bình môn dùng cho xét học bạ (theo cách tính của bạn / của trường). Tổng tổ hợp được tính tự động cho các tổ hợp đủ 3 môn.',
              'Enter your per-subject transcript averages (per university guidelines). All eligible 3-subject combinations are calculated automatically.',
            )
          : pick(
              'Nhập điểm từng môn thi tốt nghiệp THPT. Tổng các tổ hợp đủ 3 môn được tính tự động — trang Chọn Trường sẽ dùng tổ hợp khớp với từng ngành.',
              'Enter your National Graduation Exam subject scores. Eligible 3-subject combinations are computed automatically and matched per major in School Finder.',
            )}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SUBJECTS.map((s) => (
          <NumberField
            key={s.key}
            label={`${getSubjectLabel(s.key, lang)} (0–10)`}
            value={subjectsState[s.key] ?? ''}
            onChange={(v) => onChange((p) => ({ ...p, [s.key]: v }))}
            max={10}
            step="0.05"
          />
        ))}
      </div>
      {sortedCombos.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-alt px-3.5 py-3">
          <p className="text-xs text-secondary-text mb-2">
            {pick(
              `Tổng theo tổ hợp 3 môn (chưa gồm điểm ưu tiên · ${sortedCombos.length} tổ hợp):`,
              `3-subject combination totals (before priority bonus · ${sortedCombos.length} combos):`,
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sortedCombos.map(([combo, sum]) => (
              <span key={combo} className="arena-chip">
                {combo}: <span className="tabular font-bold text-primary">{fmt(sum, 2, locale)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange, max, step = '0.1' }) {
  const inputId = useId();
  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-xs font-semibold mb-1.5 text-secondary-text"
      >
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        min="0"
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full min-h-[44px] bg-surface border border-border rounded-xl px-3 text-sm text-foreground tabular outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary placeholder:text-muted-foreground"
      />
    </div>
  );
}

function TotalPreview({ label, value, scale, digits = 2 }) {
  const { locale } = useLanguage();
  const pct = value != null && scale ? Math.min((value / scale) * 100, 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-surface-alt px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-secondary-text">{label}</p>
        <p className="font-display font-bold text-2xl leading-tight text-foreground">
          <span className="tabular">{value != null ? fmt(value, digits, locale) : '—'}</span>
          <span className="text-sm text-muted-foreground font-medium"> / {scale}</span>
        </p>
      </div>
      <div className="w-24 shrink-0">
        <ProgressBar value={pct} max={100} variant="jade" size="md" ariaLabel={label} />
      </div>
    </div>
  );
}
