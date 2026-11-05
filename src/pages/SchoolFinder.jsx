import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { EXAMS, getExam } from '../lib/admission/exams';
import {
  estimateChannel,
  forecastCutoff,
  priorityApplied,
  portfolioHealth,
  DISCLAIMER,
} from '../lib/admission/predict';
import { convertScore, anchorStatus } from '../lib/admission/conversions';
import { COMBOS, parseComboField } from '../lib/admission/combos';
import { canonicalSubjects, normalizeText } from '../lib/admission/subjects';
import { regionOfSchool, REGION_LABELS } from '../lib/admission/schools';
import { bcaCombinedScore, integrated100Score } from '../lib/admission/formulas';
import { migrateLegacyScores, getScore } from '../lib/admission/scores';
import { loadCutoffs, clearCutoffCache, groupHistories } from '../lib/admission/cutoffs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n, digits = 2) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// Điểm thô (chưa ưu tiên) của thí sinh cho 1 tổ hợp — từ byGroup đã lưu,
// hoặc tính từ điểm từng môn, hoặc total đã migrate từ v1.
function comboRaw(entry, comboStr) {
  if (!entry) return null;
  const subjects = canonicalSubjects(entry.subjects);
  const byGroup = entry.byGroup || {};
  // comboStr chấp nhận chuỗi "A00/A01", mảng ['A00','A01'] (cột text[] của
  // Supabase) hoặc null — parseComboField là nơi duy nhất hiểu định dạng này.
  // Bản cũ gọi comboStr.split() thẳng nên sập "s.split is not a function"
  // mỗi khi dữ liệu đến từ Supabase và thí sinh đã có điểm THPT/học bạ.
  const parsed = parseComboField(comboStr);
  const combos = parsed.length ? parsed : Object.keys(byGroup);
  let best = null;
  for (const c of combos) {
    if (byGroup[c] != null && Number.isFinite(parseFloat(byGroup[c]))) {
      best = Math.max(best ?? -Infinity, parseFloat(byGroup[c]));
    }
    const def = COMBOS[c]?.subjects;
    if (def && def.every((k) => subjects[k] != null)) {
      const sum = def.reduce((s, k) => s + subjects[k], 0);
      best = Math.max(best ?? -Infinity, sum);
    }
  }
  if (best != null && Number.isFinite(best)) return best;
  // Hồ sơ migrate từ v1: chỉ có total, không có môn/tổ hợp — dùng total cho mọi tổ hợp
  if (
    entry.total != null &&
    Object.keys(subjects).length === 0 &&
    Object.keys(byGroup).length === 0
  ) {
    return parseFloat(entry.total);
  }
  return null;
}

// Khu vực trường: dữ liệu tĩnh ở lib/admission/schools.js (đích lâu dài là
// bảng admission_schools trên Supabase) — không hardcode trong trang nữa.
const regionOf = regionOfSchool;

const BAND_STYLE = {
  safe: { textClass: 'text-completed', boxClass: 'border-completed/35 bg-completed/8' },
  likely: { textClass: 'text-secondary', boxClass: 'border-secondary/35 bg-secondary/8' },
  borderline: { textClass: 'text-accent', boxClass: 'border-accent/35 bg-accent/8' },
  reach: { textClass: 'text-primary', boxClass: 'border-primary/35 bg-primary/8' },
  far: { textClass: 'text-danger', boxClass: 'border-danger/35 bg-danger/8' },
};

// ---------------------------------------------------------------------------
// Ước tính cho 1 nhóm (ngành x tổ hợp x phương thức)
// Trả { estimate, viaMethod, channel, marginNative, forecastNative, reason }
// ---------------------------------------------------------------------------

function buildEstimate(group, profileV2, spectrumMethods, baseYear) {
  const region = profileV2?.candidate?.region || 'KV3';
  const category = profileV2?.candidate?.category || 'NONE';
  const latestYear = group.history[0]?.year;
  const ctxBase = {
    reliability: group.reliability || null,
    hasSpectrum: spectrumMethods.has(group.method) ? 'official' : 'none',
    quotaYears: 0,
    latestYearIsCurrentSeason: baseYear != null && latestYear >= baseYear,
  };

  // --- THPT / Học bạ: thang 30 ---
  if (group.method === 'thpt' || group.method === 'hocba') {
    const entry = getScore(profileV2, group.method);
    const raw = comboRaw(entry, group.combo);
    if (raw != null) {
      const candidate = raw + priorityApplied(raw, region, category);
      const estimate = estimateChannel(candidate, group.history, group.method, {
        ...ctxBase,
        channel: 'direct',
      });
      return {
        estimate,
        viaMethod: group.method,
        channel: 'direct',
        marginNative: estimate ? estimate.margin : candidate - forecastCutoff(group.history),
        forecastNative: estimate ? estimate.cutoffForecast : forecastCutoff(group.history),
        reason: null,
      };
    }
    if (group.method === 'hocba') {
      // Học bạ cấm quy đổi chéo (registry noCrossConvert) — không có điểm học bạ là dừng.
      return {
        estimate: null,
        reason: entry
          ? 'Chưa tính được điểm tổ hợp học bạ cho ngành này — bổ sung điểm từng môn ở trang Nhập điểm.'
          : 'Bạn chưa nhập điểm học bạ. Phương thức học bạ không quy đổi từ kỳ thi khác.',
      };
    }
    // THPT: thử quy đổi bách phân vị (equipercentile) từ kỳ thi khác qua
    // conversions.js — neo là dữ liệu có cấu trúc, KHÔNG trích từ note bằng
    // regex như bản cũ. Chưa có neo chính thức -> trạng thái minh bạch.
    for (const other of ['hsa', 'vact', 'tsa']) {
      const otherEntry = getScore(profileV2, other);
      if (otherEntry?.total != null) {
        const firstCombo = (group.combos && group.combos[0]) || 'A00';
        const conv = convertScore(parseFloat(otherEntry.total), {
          fromExam: other, combo: firstCombo, year: 2025,
        });
        if (conv.value != null) {
          const candidate = conv.value + priorityApplied(conv.value, region, category);
          const estimate = estimateChannel(candidate, group.history, 'thpt', {
            ...ctxBase,
            channel: 'equi-official',
          });
          return {
            estimate,
            viaMethod: other,
            channel: 'equi-official',
            marginNative: estimate ? estimate.margin : candidate - forecastCutoff(group.history),
            forecastNative: estimate ? estimate.cutoffForecast : forecastCutoff(group.history),
            reason: null,
          };
        }
        if (anchorStatus(other, 2025).status === 'chua-co-neo-chinh-thuc') {
          return {
            estimate: null,
            reason: `Chưa có bảng quy đổi chính thức cho kỳ thi ${getExam(other).label} — chỉ ước tính được ở ngành có điểm chuẩn ${getExam(other).label} riêng.`,
          };
        }
      }
    }
    const hasAnyScore = Object.keys(profileV2?.scores || {}).length > 0;
    return {
      estimate: null,
      reason: hasAnyScore
        ? 'Chưa quy đổi được điểm hiện có sang thang THPT cho ngành này (chưa có bảng quy đổi tương đương).'
        : 'Bạn chưa nhập điểm — nhập điểm để xem ước tính cho ngành này.',
    };
  }

  // --- BCA: điểm chuẩn là thang 30 KẾT HỢP (THPT ×2/5 + BCA quy 30 ×3/5),
  // không so điểm bài thi thang 100 với điểm chuẩn thang 30 như bản cũ. ---
  if (group.method === 'bca' && group.scale === 30) {
    const bcaEntry = getScore(profileV2, 'bca');
    const thptEntry = getScore(profileV2, 'thpt');
    const thptRaw = comboRaw(thptEntry, group.combo);
    if (bcaEntry?.total == null || thptRaw == null) {
      return {
        estimate: null,
        reason: 'Phương thức Bộ Công An cần cả điểm bài thi BCA và điểm tổ hợp THPT — nhập đủ hai loại điểm ở trang Nhập điểm để tính điểm kết hợp thang 30.',
      };
    }
    const combined = bcaCombinedScore({
      thptComboScore: thptRaw, bcaExamScore: parseFloat(bcaEntry.total), region, category,
    });
    const estimate = estimateChannel(combined.value, group.history, 'thpt', {
      ...ctxBase, channel: 'direct',
    });
    return {
      estimate, viaMethod: 'bca', channel: 'direct',
      marginNative: estimate ? estimate.margin : combined.value - forecastCutoff(group.history),
      forecastNative: estimate ? estimate.cutoffForecast : forecastCutoff(group.history),
      reason: null,
    };
  }

  // --- Tổng hợp thang 100 theo trường (HCMUT...): lấy điểm tổng hợp đã lưu
  // trong hồ sơ (tính bằng formulas.js ở trang Nhập điểm). ---
  if (group.method === 'combined') {
    const saved = profileV2?.scores?.combined?.[group.schoolCode];
    if (saved?.total == null) {
      const reg = integrated100Score(group.schoolCode, {});
      return {
        estimate: null,
        reason:
          reg?.reason === 'formula-unverified'
            ? `Trường này xét tuyển tổng hợp thang 100 nhưng ${reg?.explain?.[0] || 'chưa có văn bản công thức chính thức.'}`
            : 'Phương thức xét tuyển tổng hợp theo công thức riêng của trường — hãy tính điểm tổng hợp ở trang Nhập điểm trước.',
      };
    }
    const scale = group.scale || saved.scale || 100;
    const factor = 30 / scale;
    const history30 = group.history.map((h) => ({ year: h.year, cutoff: h.cutoff * factor }));
    const estimate = estimateChannel(parseFloat(saved.total) * factor, history30, 'combined', {
      ...ctxBase, channel: 'direct',
    });
    return {
      estimate, viaMethod: 'combined', channel: 'direct',
      marginNative: parseFloat(saved.total) - forecastCutoff(group.history),
      forecastNative: forecastCutoff(group.history),
      reason: null,
    };
  }

  // --- Phương thức có thang riêng (HSA/V-ACT/TSA/V-SAT/SPT...) ---
  const entry = getScore(profileV2, group.method);
  if (!entry || (entry.total == null && !entry.combos && !entry.byGroup && !entry.subjects)) {
    return {
      estimate: null,
      reason: `Bạn chưa nhập điểm ${getExam(group.method).label} — nhập điểm để xem ước tính theo phương thức này.`,
    };
  }
  const scale = group.scale;
  if (!scale) {
    return { estimate: null, reason: 'Dữ liệu điểm chuẩn chưa ghi rõ thang điểm — chưa ước tính được.' };
  }
  const entryScale = entry.scale != null ? parseFloat(entry.scale) : getExam(group.method).scale;
  if (entryScale !== scale) {
    return {
      estimate: null,
      reason: `Điểm ${getExam(group.method).label} đã lưu ở thang ${entryScale}, điểm chuẩn ngành này ở thang ${scale} — hãy nhập lại điểm đúng thang ở trang Nhập điểm.`,
    };
  }
  // SPT/H-SCA: hồ sơ lưu theo tổ hợp (combos) hoặc từng môn — lấy điểm tổ hợp
  // khớp với tổ hợp của ngành, thang 30.
  let candidateTotal = entry.total;
  if ((group.method === 'spt' || group.method === 'hsca') && candidateTotal == null) {
    const combosSaved = entry.combos || entry.byGroup || {};
    const wanted = group.combos && group.combos.length ? group.combos : Object.keys(combosSaved);
    for (const c of wanted) {
      if (combosSaved[c] != null) { candidateTotal = combosSaved[c]; break; }
    }
    if (candidateTotal == null && entry.subjects) {
      candidateTotal = comboRaw({ subjects: entry.subjects, byGroup: {} }, group.combo);
    }
    if (candidateTotal == null) {
      return { estimate: null, reason: `Bạn chưa có điểm tổ hợp ${getExam(group.method).label} cho ngành này — nhập điểm từng môn ở trang Nhập điểm.` };
    }
  }
  // V-SAT: hồ sơ lưu từng môn x150 — tính tổng tổ hợp khi chưa có total.
  if (group.method === 'vsat' && candidateTotal == null && entry.subjects) {
    const vals = Object.values(entry.subjects).filter((v) => v != null).map(Number);
    if (vals.length === 3) candidateTotal = vals.reduce((a, b) => a + b, 0);
  }
  if (candidateTotal == null) {
    return { estimate: null, reason: `Bạn chưa nhập điểm ${getExam(group.method).label} — nhập điểm để xem ước tính theo phương thức này.` };
  }
  const candidateNative = parseFloat(candidateTotal);
  const forecastNative = forecastCutoff(group.history);
  const factor = 30 / scale; // chuẩn hoá cùng thang 30 để σ sàn của predict.js có nghĩa
  const history30 = group.history.map((h) => ({ year: h.year, cutoff: h.cutoff * factor }));
  const estimate = estimateChannel(candidateNative * factor, history30, group.method, {
    ...ctxBase,
    channel: 'direct',
  });
  return {
    estimate,
    viaMethod: group.method,
    channel: 'direct',
    marginNative: candidateNative - forecastNative,
    forecastNative,
    reason: null,
  };
}

// ---------------------------------------------------------------------------
// Sparkline điểm chuẩn theo năm
// ---------------------------------------------------------------------------

function Sparkline({ history }) {
  const points = useMemo(() => {
    const asc = [...history].sort((a, b) => a.year - b.year);
    if (asc.length === 0) return null;
    if (asc.length === 1) return { single: asc[0] };
    const min = Math.min(...asc.map((h) => h.cutoff));
    const max = Math.max(...asc.map((h) => h.cutoff));
    const span = max - min || 1;
    const W = 96;
    const H = 30;
    const coords = asc.map((h, i) => {
      const x = 4 + (i / (asc.length - 1)) * (W - 8);
      const y = 4 + (1 - (h.cutoff - min) / span) * (H - 8);
      return { x, y, ...h };
    });
    return { coords, line: coords.map((c) => `${c.x},${c.y}`).join(' ') };
  }, [history]);

  if (!points) return null;
  if (points.single) {
    return (
      <span className="text-xs text-text-secondary">
        Chỉ có dữ liệu 1 năm ({points.single.year}: <span className="tabular font-semibold">{fmt(points.single.cutoff)}</span>)
      </span>
    );
  }
  return (
    <svg width="96" height="30" viewBox="0 0 96 30" role="img" aria-label="Xu hướng điểm chuẩn qua các năm" className="no-shrink">
      <polyline points={points.line} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.coords.map((c) => (
        <circle key={c.year} cx={c.x} cy={c.y} r="2.5" fill="var(--color-accent)" />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Thẻ ngành
// ---------------------------------------------------------------------------

function ProgramCard({ group, built, inWishlist, onToggleWish, onGoScores }) {
  const exam = getExam(group.method);
  const latest = group.history[0];
  const latestSource = group.sources.find((s) => s.year === latest?.year) || group.sources[0];
  const { estimate } = built;
  const bandStyle = estimate ? (BAND_STYLE[estimate.band] || BAND_STYLE.borderline) : null;

  return (
    <article className="arena-card p-4 space-y-3 content-auto">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-bold text-base leading-snug text-foreground">{group.majorName}</p>
          <p className="text-sm text-text-secondary mt-0.5">{group.schoolName}</p>
        </div>
        <span className="material-symbols-outlined text-muted no-shrink" aria-hidden="true">apartment</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="arena-chip">{exam.label} · thang {group.scale ?? exam.scale ?? '—'}</span>
        {group.combo && <span className="arena-chip">Tổ hợp {group.combo}</span>}
        <span className="arena-chip">{REGION_LABELS[regionOf(group.schoolCode)]}</span>
        {group.majorCode && <span className="arena-chip">Mã {group.majorCode}</span>}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Sparkline history={group.history} />
        <p className="text-xs text-text-secondary">
          {[...group.history]
            .sort((a, b) => a.year - b.year)
            .map((h) => `${h.year}: ${fmt(h.cutoff)}`)
            .join(' · ')}
        </p>
      </div>

      <p className="text-sm text-foreground">
        <span className="text-text-secondary">Điểm chuẩn {latest.year}: </span>
        <span className="tabular font-bold">{fmt(latest.cutoff)}</span>
        <span className="text-text-secondary"> / {group.scale}</span>
        {built.forecastNative != null && (
          <>
            <span className="text-text-secondary"> · Dự báo năm tới ≈ </span>
            <span className="tabular font-bold">{fmt(built.forecastNative)}</span>
            {estimate && <span className="text-text-secondary"> ± {fmt(estimate.sigma * ((group.scale || 30) / 30))}</span>}
          </>
        )}
      </p>

      {estimate ? (
        <div className={`rounded-xl px-3 py-2.5 border space-y-1 ${bandStyle.boxClass}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-display font-bold text-base ${bandStyle.textClass}`}>
              {estimate.bandLabel}
            </span>
            {estimate.showPercent ? (
              <span className="tabular text-sm font-bold text-foreground">
                {estimate.probabilityRounded}% khả năng
                <span className="text-text-secondary font-medium">
                  {' '}(khoảng {Math.round(estimate.pLow * 100)}–{Math.round(estimate.pHigh * 100)}%)
                </span>
              </span>
            ) : (
              <span className="text-xs text-text-secondary">Độ tin cậy thấp — chỉ hiện mức đánh giá, chưa hiện %</span>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            Điểm của bạn {built.viaMethod !== group.method ? `(quy đổi từ ${getExam(built.viaMethod).label}) ` : ''}
            {built.marginNative >= 0 ? 'cao hơn' : 'thấp hơn'} dự báo{' '}
            <span className="tabular font-bold text-foreground">{fmt(Math.abs(built.marginNative))} điểm</span>
            {' '}· Độ tin cậy ước tính: {estimate.confidenceLabel.toLowerCase()}
          </p>
        </div>
      ) : (
        <div className="rounded-xl px-3 py-2.5 border border-border bg-surface-alt">
          <p className="text-xs text-text-secondary flex items-start gap-2">
            <span className="material-symbols-outlined text-base text-accent no-shrink" aria-hidden="true">info</span>
            <span>{built.reason || 'Chưa đủ dữ liệu để ước tính cho ngành này.'}</span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] text-muted">
          Căn cứ: điểm chuẩn {group.history.map((h) => h.year).join(', ')}
          {latestSource?.url && (
            <>
              {' '}· Nguồn:{' '}
              <a href={latestSource.url} target="_blank" rel="noreferrer" className="underline text-text-secondary hover:text-primary">
                {(() => { try { return new URL(latestSource.url).hostname; } catch { return 'nguồn dữ liệu'; } })()}
              </a>
            </>
          )}
        </p>
        <div className="flex gap-2">
          {!estimate && built.reason && built.reason.startsWith('Bạn chưa nhập') && (
            <button onClick={onGoScores} className="btn-arena btn-arena-sm btn-arena-ghost cursor-pointer">
              <span className="material-symbols-outlined text-base" aria-hidden="true">edit_note</span>
              Nhập điểm
            </button>
          )}
          <button
            onClick={onToggleWish}
            aria-pressed={inWishlist}
            className={`btn-arena btn-arena-sm cursor-pointer ${inWishlist ? 'btn-arena-jade' : 'btn-arena-ghost'}`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {inWishlist ? 'bookmark_added' : 'bookmark_add'}
            </span>
            {inWishlist ? 'Đã lưu NV' : 'Lưu nguyện vọng'}
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Trang chính
// ---------------------------------------------------------------------------

const WISHLIST_KEY = 'admission_wishlist';
const DRAFT_KEY = 'admission_scores_v2';

function loadWishlist() {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function SchoolFinder() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  const [query, setQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [bandFilter, setBandFilter] = useState('all');
  const [displayLimit, setDisplayLimit] = useState(20);
  const [showWishlist, setShowWishlist] = useState(false);
  const [wishlist, setWishlist] = useState(loadWishlist);

  // --- Tải dữ liệu điểm chuẩn ---
  useEffect(() => {
    let cancelled = false;
    loadCutoffs(fetch, supabase)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Không tải được dữ liệu điểm chuẩn');
      });
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  const handleRetry = useCallback(() => {
    clearCutoffCache();
    setData(null);
    setRetryTick((t) => t + 1);
  }, []);

  // --- Hồ sơ điểm v2 ---
  const profileV2 = useMemo(() => {
    const local = {
      my_tsa: (() => { try { return localStorage.getItem('my_tsa'); } catch { return null; } })(),
      my_hsa: (() => { try { return localStorage.getItem('my_hsa'); } catch { return null; } })(),
      my_vact: (() => { try { return localStorage.getItem('my_vact'); } catch { return null; } })(),
    };
    if (profile?.admission_scores) return migrateLegacyScores(profile.admission_scores, local);
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.version === 2 || parsed?.version === 3) return migrateLegacyScores(parsed, local);
      }
    } catch { /* bỏ qua draft lỗi */ }
    return migrateLegacyScores({}, local);
  }, [profile]);

  const legacyKeys = useMemo(
    () => Object.keys(profileV2?.legacy_unverified || {}),
    [profileV2],
  );

  const spectrumMethods = useMemo(() => {
    const s = new Set();
    for (const d of data?.score_distributions || []) {
      const code = String(d.exam || '').toUpperCase();
      s.add(code === 'THPT_QG' ? 'thpt' : code.toLowerCase());
    }
    return s;
  }, [data]);

  const groups = useMemo(() => (data ? groupHistories(data.records) : []), [data]);
  const methodsPresent = useMemo(
    () => [...new Set(groups.map((g) => g.method))],
    [groups],
  );
  const regionsPresent = useMemo(
    () => [...new Set(groups.map((g) => regionOf(g.schoolCode)))],
    [groups],
  );

  // --- Gắn ước tính vào từng nhóm ---
  const rows = useMemo(() => {
    const built = groups.map((group) => ({
      group,
      built: buildEstimate(group, profileV2, spectrumMethods, data?.meta?.base_year),
    }));
    built.sort((a, b) => {
      const pa = a.built.estimate?.probability;
      const pb = b.built.estimate?.probability;
      if (pa != null && pb != null) return pb - pa;
      if (pa != null) return -1;
      if (pb != null) return 1;
      const ca = (a.group.history[0]?.cutoff || 0) / (a.group.scale || 30);
      const cb = (b.group.history[0]?.cutoff || 0) / (b.group.scale || 30);
      return cb - ca;
    });
    return built;
  }, [groups, profileV2, spectrumMethods, data]);

  const filtered = useMemo(() => {
    let result = rows;
    if (query.trim()) {
      const q = normalizeText(query);
      result = result.filter(
        ({ group }) =>
          normalizeText(group.schoolName).includes(q) ||
          normalizeText(group.majorName).includes(q) ||
          normalizeText(group.schoolCode).includes(q) ||
          normalizeText(group.majorCode || '').includes(q),
      );
    }
    if (methodFilter !== 'all') result = result.filter(({ group }) => group.method === methodFilter);
    if (regionFilter !== 'all') result = result.filter(({ group }) => regionOf(group.schoolCode) === regionFilter);
    if (bandFilter !== 'all') {
      result = result.filter(({ built }) => {
        if (bandFilter === 'none') return !built.estimate;
        if (bandFilter === 'good') return built.estimate && built.estimate.probability >= 0.7;
        if (bandFilter === 'mid') return built.estimate && built.estimate.probability >= 0.4 && built.estimate.probability < 0.7;
        if (bandFilter === 'low') return built.estimate && built.estimate.probability < 0.4;
        return true;
      });
    }
    return result;
  }, [rows, query, methodFilter, regionFilter, bandFilter]);

  const displayed = filtered.slice(0, displayLimit);

  useEffect(() => {
    const onScroll = () => {
      const bottom =
        document.documentElement.scrollHeight - document.documentElement.scrollTop <=
        document.documentElement.clientHeight + 120;
      if (bottom) setDisplayLimit((prev) => (prev < filtered.length ? prev + 20 : prev));
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [filtered.length]);

  // --- Nguyện vọng ---
  const wishKeyOf = (g) => [g.schoolCode, g.majorName, g.method, g.combo || ''].join('|');
  const wishKeys = useMemo(() => new Set(wishlist.map((w) => w.key)), [wishlist]);

  const persistWishlist = useCallback((next) => {
    setWishlist(next);
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
    } catch { /* localStorage đầy/chặn — giữ state trong phiên */ }
  }, []);

  const toggleWish = useCallback(
    (group, built) => {
      const key = wishKeyOf(group);
      const exists = wishlist.some((w) => w.key === key);
      if (exists) {
        persistWishlist(wishlist.filter((w) => w.key !== key));
        if (user) {
          supabase
            .from('admission_wishlists')
            .delete()
            .eq('user_id', user.id)
            .eq('school_code', group.schoolCode)
            .eq('major_name', group.majorName)
            .eq('method', group.method)
            .then(() => {}, () => {});
        }
        return;
      }
      const item = {
        key,
        schoolCode: group.schoolCode,
        schoolName: group.schoolName,
        majorName: group.majorName,
        majorCode: group.majorCode,
        combo: group.combo,
        method: group.method,
        estimateSnapshot: built.estimate
          ? {
              probability: built.estimate.probability,
              band: built.estimate.band,
              bandLabel: built.estimate.bandLabel,
              marginNative: built.marginNative,
              forecastNative: built.forecastNative,
              viaMethod: built.viaMethod,
              savedAt: new Date().toISOString(),
            }
          : null,
      };
      const next = [...wishlist, item];
      persistWishlist(next);
      if (user) {
        // Bảng admission_wishlists do migration 20261022100000 tạo — nếu chưa áp
        // migration thì ghi đồng bộ thất bại lặng lẽ, localStorage vẫn là nguồn chính.
        supabase
          .from('admission_wishlists')
          .upsert(
            {
              user_id: user.id,
              school_code: group.schoolCode,
              major_name: group.majorName,
              method: group.method,
              rank: next.length,
              estimate_snapshot: item.estimateSnapshot,
            },
            { onConflict: 'user_id,school_code,major_name,method' },
          )
          .then(() => {}, () => {});
      }
    },
    [wishlist, persistWishlist, user],
  );

  const moveWish = useCallback(
    (idx, dir) => {
      const next = [...wishlist];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return;
      [next[idx], next[target]] = [next[target], next[idx]];
      persistWishlist(next);
    },
    [wishlist, persistWishlist],
  );

  const wishHealth = useMemo(() => {
    const withP = wishlist.filter((w) => w.estimateSnapshot?.probability != null);
    if (withP.length === 0) return null;
    return portfolioHealth(
      withP.map((w) => ({ probability: w.estimateSnapshot.probability, schoolCode: w.schoolCode })),
    );
  }, [wishlist]);

  const myScoreEntries = useMemo(
    () =>
      Object.entries(profileV2?.scores || {}).filter(
        ([, v]) => v && v.status !== 'none' && (v.total != null || v.byGroup || v.subjects),
      ),
    [profileV2],
  );
  const hasAnyScore = myScoreEntries.length > 0;

  return (
    <div className="min-h-dvh font-sans text-foreground bg-background relative">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-surface/95 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Quay lại"
            className="w-11 h-11 no-shrink rounded-full bg-surface-alt border border-border flex items-center justify-center hover:bg-surface-hover text-foreground transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back_ios_new</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-xl leading-tight text-foreground">Tìm trường phù hợp</h1>
            <p className="text-xs text-text-secondary">
              Ước tính khả năng theo điểm chuẩn {data?.meta?.base_year || 'các năm gần nhất'} và các năm trước
            </p>
          </div>
          <button
            onClick={() => setShowWishlist((s) => !s)}
            aria-expanded={showWishlist}
            className="btn-arena btn-arena-sm btn-arena-ghost cursor-pointer no-shrink"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">bookmark</span>
            Nguyện vọng ({wishlist.length})
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4 relative z-10">
        {/* Disclaimer bắt buộc (ALGORITHM §5.3) */}
        <div className="arena-card p-4 flex gap-3 border-accent/35 bg-accent/5">
          <span className="material-symbols-outlined no-shrink text-accent" aria-hidden="true">info</span>
          <p className="text-xs leading-relaxed text-text-secondary">{DISCLAIMER}</p>
        </div>

        {/* Điểm HSA/V-ACT cũ không tin cậy */}
        {legacyKeys.length > 0 && (
          <div className="arena-card p-4 flex gap-3 border-accent/45 bg-accent/5">
            <span className="material-symbols-outlined no-shrink text-accent" aria-hidden="true">warning</span>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-foreground">Điểm HSA / V-ACT đã lưu trước đây cần nhập lại</p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Bản cũ của trang Tính điểm từng ghi sai thang điểm hai kỳ thi này, nên điểm cũ đang được
                cách ly và <b>không</b> dùng để ước tính. Hãy nhập lại điểm đúng kỳ thi để kết quả đáng tin.
              </p>
              <button onClick={() => navigate('/tim-truong/diem')} className="btn-arena btn-arena-sm btn-arena-gold cursor-pointer">
                <span className="material-symbols-outlined text-base" aria-hidden="true">edit_note</span>
                Nhập lại điểm
              </button>
            </div>
          </div>
        )}

        {/* Hồ sơ điểm của tôi */}
        {hasAnyScore ? (
          <div className="arena-card p-4 flex gap-3">
            <span className="material-symbols-outlined no-shrink text-secondary" aria-hidden="true">verified</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Điểm của bạn đang dùng để ước tính</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {myScoreEntries.map(([code, v]) => {
                  const exam = EXAMS[code];
                  const label = exam?.label || code.toUpperCase();
                  const shown =
                    v.total != null
                      ? `${fmt(parseFloat(v.total), code === 'vact' || code === 'vsat' ? 0 : 2)}${exam?.scale ? ` / ${exam.scale}` : ''}`
                      : 'theo tổ hợp';
                  return (
                    <span key={code} className="arena-chip">
                      {label}: <span className="tabular font-bold text-primary">{shown}</span>
                      {v.status === 'mock' ? ' (thi thử)' : v.status === 'target' ? ' (mục tiêu)' : ''}
                    </span>
                  );
                })}
              </div>
              <button onClick={() => navigate('/tim-truong/diem')} className="btn-arena btn-arena-sm btn-arena-ghost cursor-pointer mt-3">
                <span className="material-symbols-outlined text-base" aria-hidden="true">edit_note</span>
                Cập nhật điểm
              </button>
            </div>
          </div>
        ) : (
          <div className="arena-card p-4 flex gap-3">
            <span className="material-symbols-outlined no-shrink text-accent" aria-hidden="true">info</span>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-foreground">Bạn chưa nhập điểm</p>
              <p className="text-xs text-text-secondary">
                Nhập điểm THPT, HSA, V-ACT, TSA... để xem ước tính khả năng cho từng ngành dưới đây.
                Chưa nhập điểm, trang chỉ hiện điểm chuẩn các năm để tham khảo.
              </p>
              <button onClick={() => navigate('/tim-truong/diem')} className="btn-arena btn-arena-sm btn-arena-primary cursor-pointer">
                <span className="material-symbols-outlined text-base" aria-hidden="true">edit_note</span>
                Nhập điểm ngay
              </button>
            </div>
          </div>
        )}

        {/* Panel nguyện vọng */}
        {showWishlist && (
          <section className="arena-card p-4 space-y-3" aria-label="Danh sách nguyện vọng đã lưu">
            <h2 className="font-display font-bold text-lg text-foreground">Nguyện vọng của tôi ({wishlist.length})</h2>
            {wishHealth && wishHealth.warnings.length > 0 && (
              <div className="space-y-2">
                {wishHealth.warnings.map((w) => (
                  <p
                    key={w.code}
                    className={`text-xs leading-relaxed rounded-xl px-3 py-2 border flex gap-2 ${
                      w.level === 'red'
                        ? 'border-danger/35 bg-danger/8 text-danger'
                        : 'border-accent/35 bg-accent/8 text-foreground'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base no-shrink" aria-hidden="true">
                      {w.level === 'red' ? 'error' : 'warning'}
                    </span>
                    <span>{w.text}</span>
                  </p>
                ))}
              </div>
            )}
            {wishHealth && (
              <p className="text-xs text-text-secondary">
                Điểm sức khoẻ danh sách: <span className="tabular font-bold text-foreground">{wishHealth.score}/100</span>
                {' '}— phân bổ an toàn / cân nhắc / mạo hiểm hợp lý và có nguyện vọng sàn an toàn sẽ cho điểm cao.
              </p>
            )}
            {wishlist.length === 0 ? (
              <p className="text-sm text-text-secondary">
                Chưa có nguyện vọng nào. Bấm “Lưu nguyện vọng” ở thẻ ngành bên dưới để thêm vào danh sách này.
              </p>
            ) : (
              <ol className="space-y-2">
                {wishlist.map((w, idx) => (
                  <li key={w.key} className="flex items-center gap-2 rounded-xl border border-border bg-surface-alt px-3 py-2">
                    <span className="font-display font-bold text-sm text-accent no-shrink">
                      NV{idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-snug text-foreground">{w.majorName}</p>
                      <p className="text-[11px] text-text-secondary">
                        {w.schoolName} · {getExam(w.method).label}
                        {w.estimateSnapshot
                          ? ` · Lúc lưu: ${w.estimateSnapshot.bandLabel}${w.estimateSnapshot.probability != null ? ` (${Math.round(w.estimateSnapshot.probability * 20) * 5}%)` : ''}`
                          : ' · Chưa có ước tính lúc lưu'}
                      </p>
                    </div>
                    <div className="flex no-shrink">
                      <button
                        onClick={() => moveWish(idx, -1)}
                        disabled={idx === 0}
                        aria-label="Đưa nguyện vọng lên trên"
                        className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-secondary hover:text-foreground disabled:opacity-30 cursor-pointer"
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">arrow_upward</span>
                      </button>
                      <button
                        onClick={() => moveWish(idx, 1)}
                        disabled={idx === wishlist.length - 1}
                        aria-label="Đưa nguyện vọng xuống dưới"
                        className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-secondary hover:text-foreground disabled:opacity-30 cursor-pointer"
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">arrow_downward</span>
                      </button>
                      <button
                        onClick={() => persistWishlist(wishlist.filter((x) => x.key !== w.key))}
                        aria-label="Xoá nguyện vọng"
                        className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger cursor-pointer"
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-[11px] text-muted">
              Danh sách này để chuẩn bị và cân đối nguyện vọng — không thay thế đăng ký nguyện vọng chính thức trên cổng của Bộ GD&ĐT.
            </p>
          </section>
        )}

        {/* Bộ lọc */}
        <section className="arena-card p-4 space-y-3" aria-label="Bộ lọc tìm trường">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted text-base" aria-hidden="true">search</span>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setDisplayLimit(20); }}
              placeholder="Nhập tên trường, ngành học, mã ngành..."
              aria-label="Tìm kiếm trường hoặc ngành"
              className="w-full pl-10 pr-4 min-h-[44px] bg-surface-alt border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary placeholder:text-muted"
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo phương thức">
            <FilterChip active={methodFilter === 'all'} onClick={() => { setMethodFilter('all'); setDisplayLimit(20); }}>
              Tất cả phương thức
            </FilterChip>
            {methodsPresent.map((m) => (
              <FilterChip key={m} active={methodFilter === m} onClick={() => { setMethodFilter(m); setDisplayLimit(20); }}>
                {getExam(m).label}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center" role="group" aria-label="Lọc theo khu vực và mức đánh giá">
            <FilterChip active={regionFilter === 'all'} onClick={() => { setRegionFilter('all'); setDisplayLimit(20); }}>
              Mọi khu vực
            </FilterChip>
            {regionsPresent.map((r) => (
              <FilterChip key={r} active={regionFilter === r} onClick={() => { setRegionFilter(r); setDisplayLimit(20); }}>
                {REGION_LABELS[r]}
              </FilterChip>
            ))}
            <select
              value={bandFilter}
              onChange={(e) => { setBandFilter(e.target.value); setDisplayLimit(20); }}
              aria-label="Lọc theo mức đánh giá"
              className="min-h-[44px] text-sm bg-surface-alt border border-border text-foreground rounded-xl px-3 outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">Mọi mức đánh giá</option>
              <option value="good">Khả quan (từ 70%)</option>
              <option value="mid">Cân nhắc (40–70%)</option>
              <option value="low">Thấp (dưới 40%)</option>
              <option value="none">Chưa ước tính được</option>
            </select>
          </div>
        </section>

        {/* Trạng thái tải / lỗi / kết quả */}
        {loadError ? (
          <div className="arena-card p-6 text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-danger" aria-hidden="true">cloud_off</span>
            <p className="font-semibold text-foreground">Không tải được dữ liệu điểm chuẩn</p>
            <p className="text-sm text-text-secondary">{loadError}</p>
            <button onClick={handleRetry} className="btn-arena btn-arena-primary cursor-pointer">
              <span className="material-symbols-outlined text-base" aria-hidden="true">refresh</span>
              Thử lại
            </button>
          </div>
        ) : !data ? (
          <div className="flex justify-center items-center py-12" role="status" aria-label="Đang tải dữ liệu">
            <span className="material-symbols-outlined text-4xl animate-spin text-primary" aria-hidden="true">sync</span>
          </div>
        ) : (
          <>
            <p className="text-xs text-text-secondary px-1">
              <span className="tabular font-bold text-foreground">{filtered.length}</span> ngành có dữ liệu điểm chuẩn
              {hasAnyScore && ' · ngành có khả năng cao hơn được xếp trước'}
            </p>
            {filtered.length === 0 ? (
              <div className="arena-card p-8 text-center space-y-2">
                <span className="material-symbols-outlined text-4xl text-muted" aria-hidden="true">search_off</span>
                <p className="text-sm font-semibold text-foreground">Không tìm thấy ngành phù hợp với bộ lọc</p>
                <p className="text-xs text-text-secondary">Thử đổi từ khoá hoặc bỏ bớt điều kiện lọc.</p>
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {displayed.map(({ group, built }) => (
                  <ProgramCard
                    key={`${group.schoolCode}|${group.majorName}|${group.method}|${group.combo || ''}`}
                    group={group}
                    built={built}
                    inWishlist={wishKeys.has(wishKeyOf(group))}
                    onToggleWish={() => toggleWish(group, built)}
                    onGoScores={() => navigate('/tim-truong/diem')}
                  />
                ))}
                {displayLimit < filtered.length && (
                  <p className="text-center py-3">
                    <span className="material-symbols-outlined text-muted animate-bounce" aria-hidden="true">expand_more</span>
                  </p>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted text-center pb-6">{DISCLAIMER}</p>
          </>
        )}
      </main>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`arena-chip cursor-pointer min-h-[44px] px-4 transition-all active:scale-[0.98] ${
        active
          ? 'bg-primary text-white border-primary font-semibold'
          : 'hover:bg-surface-hover'
      }`}
    >
      {children}
    </button>
  );
}
