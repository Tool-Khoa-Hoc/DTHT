import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { getExamMeta } from '../lib/admission/exams';
import {
  estimateChannel,
  forecastCutoff,
  priorityApplied,
  portfolioHealth,
  getBandLabel,
  getDisclaimer,
} from '../lib/admission/predict';
import { convertScore, anchorStatus } from '../lib/admission/conversions';
import { COMBOS, parseComboField } from '../lib/admission/combos';
import { canonicalSubjects, normalizeText } from '../lib/admission/subjects';
import { regionOfSchool, getRegionLabel } from '../lib/admission/schools';
import { bcaCombinedScore, integrated100Score } from '../lib/admission/formulas';
import { migrateLegacyScores, getScore } from '../lib/admission/scores';
import { loadCutoffs, clearCutoffCache, groupHistories } from '../lib/admission/cutoffs';
import { fmt } from '../lib/admission/format';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function comboRaw(entry, comboStr) {
  if (!entry) return null;
  const subjects = canonicalSubjects(entry.subjects);
  const byGroup = entry.byGroup || {};
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
  if (
    entry.total != null &&
    Object.keys(subjects).length === 0 &&
    Object.keys(byGroup).length === 0
  ) {
    return parseFloat(entry.total);
  }
  return null;
}

const regionOf = regionOfSchool;

const BAND_STYLE = {
  safe: { textClass: 'text-completed', boxClass: 'border-completed/35 bg-completed/8' },
  likely: { textClass: 'text-jade', boxClass: 'border-jade-border bg-jade-soft/70' },
  borderline: { textClass: 'text-accent', boxClass: 'border-accent/35 bg-gold-soft/45' },
  reach: { textClass: 'text-primary', boxClass: 'border-primary/35 bg-primary-soft/60' },
  far: { textClass: 'text-danger', boxClass: 'border-danger/35 bg-danger/8' },
};

const BAND_ORDER = ['safe', 'likely', 'borderline', 'reach', 'far'];

// ---------------------------------------------------------------------------
// Ước tính cho 1 nhóm (ngành x tổ hợp x phương thức)
// ---------------------------------------------------------------------------

function buildEstimate(group, profileV2, spectrumMethods, baseYear, lang = 'vi') {
  const isEn = lang === 'en';
  const region = profileV2?.candidate?.region || 'KV3';
  const category = profileV2?.candidate?.category || 'NONE';
  const latestYear = group.history[0]?.year;
  const ctxBase = {
    reliability: group.reliability || null,
    hasSpectrum: spectrumMethods.has(group.method) ? 'official' : 'none',
    quotaYears: group.history.filter((h) => h.quota != null).length,
    latestYearIsCurrentSeason: baseYear != null && latestYear >= baseYear,
    lang,
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
        needsScoreInput: false,
      };
    }
    if (group.method === 'hocba') {
      return {
        estimate: null,
        needsScoreInput: true,
        reason: entry
          ? isEn
            ? 'Could not compute a Transcript combo score for this major — add per-subject grades in Admission Scores.'
            : 'Chưa tính được điểm tổ hợp học bạ cho ngành này — bổ sung điểm từng môn ở trang Nhập điểm.'
          : isEn
            ? 'No High School Transcript scores entered yet. Transcript admission does not cross-convert from other exams.'
            : 'Bạn chưa nhập điểm học bạ. Phương thức học bạ không quy đổi từ kỳ thi khác.',
      };
    }
    let noAnchorReason = null;
    for (const other of ['hsa', 'vact', 'tsa']) {
      const otherEntry = getScore(profileV2, other);
      if (otherEntry?.total != null) {
        const candidateCombos =
          group.combos && group.combos.length > 0 ? group.combos : ['A00'];
        let bestConv = null;
        for (const c of candidateCombos) {
          const conv = convertScore(parseFloat(otherEntry.total), {
            fromExam: other,
            combo: c,
            year: 2025,
          });
          if (conv.value != null && (!bestConv || conv.value > bestConv.value)) {
            bestConv = conv;
          }
        }
        if (bestConv && bestConv.value != null) {
          const candidate = bestConv.value + priorityApplied(bestConv.value, region, category);
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
            needsScoreInput: false,
          };
        }
        if (!noAnchorReason && anchorStatus(other, 2025).status === 'chua-co-neo-chinh-thuc') {
          const otherLabel = getExamMeta(other, lang).displayLabel;
          noAnchorReason = isEn
            ? `No official equivalence table published for ${otherLabel} yet — direct estimates are available on majors with dedicated ${otherLabel} cutoffs.`
            : `Chưa có bảng quy đổi chính thức cho kỳ thi ${otherLabel} — chỉ ước tính được ở ngành có điểm chuẩn ${otherLabel} riêng.`;
        }
      }
    }
    if (noAnchorReason) {
      return { estimate: null, reason: noAnchorReason, needsScoreInput: false };
    }
    const hasAnyScore = Object.keys(profileV2?.scores || {}).length > 0;
    return {
      estimate: null,
      needsScoreInput: !hasAnyScore,
      reason: hasAnyScore
        ? isEn
          ? 'Could not convert your saved scores to the National Exam scale for this major (no equivalence table available).'
          : 'Chưa quy đổi được điểm hiện có sang thang THPT cho ngành này (chưa có bảng quy đổi tương đương).'
        : isEn
          ? 'No scores entered yet — add your exam scores to unlock admission probability estimates.'
          : 'Bạn chưa nhập điểm — nhập điểm để xem ước tính cho ngành này.',
    };
  }

  // --- BCA: điểm chuẩn thang 30 KẾT HỢP ---
  if (group.method === 'bca' && group.scale === 30) {
    const bcaEntry = getScore(profileV2, 'bca');
    const thptEntry = getScore(profileV2, 'thpt');
    const thptRaw = comboRaw(thptEntry, group.combo);
    if (bcaEntry?.total == null || thptRaw == null) {
      return {
        estimate: null,
        needsScoreInput: true,
        reason: isEn
          ? 'Public Security Method 3 requires both your BCA exam score and National Exam combo score — enter both in Admission Scores.'
          : 'Phương thức Bộ Công An cần cả điểm bài thi BCA và điểm tổ hợp THPT — nhập đủ hai loại điểm ở trang Nhập điểm để tính điểm kết hợp thang 30.',
      };
    }
    const combined = bcaCombinedScore({
      thptComboScore: thptRaw,
      bcaExamScore: parseFloat(bcaEntry.total),
      region,
      category,
      lang,
    });
    const estimate = estimateChannel(combined.value, group.history, 'thpt', {
      ...ctxBase,
      channel: 'direct',
    });
    return {
      estimate,
      viaMethod: 'bca',
      channel: 'direct',
      marginNative: estimate ? estimate.margin : combined.value - forecastCutoff(group.history),
      forecastNative: estimate ? estimate.cutoffForecast : forecastCutoff(group.history),
      reason: null,
      needsScoreInput: false,
    };
  }

  // --- Tổng hợp thang 100 theo trường (HCMUT, UEH...) ---
  if (group.method === 'combined') {
    const saved = profileV2?.scores?.combined?.[group.schoolCode];
    if (saved?.total == null) {
      const reg = integrated100Score(group.schoolCode, {}, lang);
      const unverified = reg?.reason === 'formula-unverified';
      return {
        estimate: null,
        needsScoreInput: !unverified,
        reason: unverified
          ? reg?.explain?.[0] ||
            (isEn
              ? 'This university uses a 100-pt composite cutoff whose official annual formula is not yet verified.'
              : 'Trường này xét tuyển tổng hợp thang 100 nhưng chưa có văn bản công thức chính thức.')
          : isEn
            ? 'University-specific composite admission — compute & save your composite score in Admission Scores first.'
            : 'Phương thức xét tuyển tổng hợp theo công thức riêng của trường — hãy tính điểm tổng hợp ở trang Nhập điểm trước.',
      };
    }
    const scale = group.scale || saved.scale || 100;
    const factor = 30 / scale;
    const history30 = group.history.map((h) => ({ year: h.year, cutoff: h.cutoff * factor }));
    const estimate = estimateChannel(parseFloat(saved.total) * factor, history30, 'combined', {
      ...ctxBase,
      channel: 'direct',
    });
    return {
      estimate,
      viaMethod: 'combined',
      channel: 'direct',
      marginNative: parseFloat(saved.total) - forecastCutoff(group.history),
      forecastNative: forecastCutoff(group.history),
      reason: null,
      needsScoreInput: false,
    };
  }

  // --- Phương thức có thang riêng (HSA/V-ACT/TSA/V-SAT/SPT/H-SCA...) ---
  const methodLabel = getExamMeta(group.method, lang).displayLabel;
  const entry = getScore(profileV2, group.method);
  if (!entry || (entry.total == null && !entry.combos && !entry.byGroup && !entry.subjects)) {
    return {
      estimate: null,
      needsScoreInput: true,
      reason: isEn
        ? `No ${methodLabel} score entered yet — add your ${methodLabel} score to see estimates for this method.`
        : `Bạn chưa nhập điểm ${methodLabel} — nhập điểm để xem ước tính theo phương thức này.`,
    };
  }
  const scale = group.scale;
  if (!scale) {
    return {
      estimate: null,
      needsScoreInput: false,
      reason: isEn
        ? 'Cutoff record does not specify a score scale — unable to compute estimate.'
        : 'Dữ liệu điểm chuẩn chưa ghi rõ thang điểm — chưa ước tính được.',
    };
  }
  const entryScale =
    entry.scale != null ? parseFloat(entry.scale) : getExamMeta(group.method, lang).scale;
  if (entryScale !== scale) {
    return {
      estimate: null,
      needsScoreInput: true,
      reason: isEn
        ? `Saved ${methodLabel} score uses scale ${entryScale}, whereas this major’s cutoff uses scale ${scale} — please update your score in Admission Scores.`
        : `Điểm ${methodLabel} đã lưu ở thang ${entryScale}, điểm chuẩn ngành này ở thang ${scale} — hãy nhập lại điểm đúng thang ở trang Nhập điểm.`,
    };
  }
  let candidateTotal = entry.total;
  if ((group.method === 'spt' || group.method === 'hsca') && candidateTotal == null) {
    const combosSaved = entry.combos || entry.byGroup || {};
    const wanted = group.combos && group.combos.length ? group.combos : Object.keys(combosSaved);
    for (const c of wanted) {
      if (combosSaved[c] != null) {
        candidateTotal = combosSaved[c];
        break;
      }
    }
    if (candidateTotal == null && entry.subjects) {
      candidateTotal = comboRaw({ subjects: entry.subjects, byGroup: {} }, group.combo);
    }
    if (candidateTotal == null) {
      return {
        estimate: null,
        needsScoreInput: true,
        reason: isEn
          ? `No matching ${methodLabel} combination score found for this major — enter per-subject scores in Admission Scores.`
          : `Bạn chưa có điểm tổ hợp ${methodLabel} cho ngành này — nhập điểm từng môn ở trang Nhập điểm.`,
      };
    }
  }
  if (group.method === 'vsat') {
    const byCombo = comboRaw(entry, group.combo);
    if (byCombo != null) {
      candidateTotal = byCombo;
    } else if (candidateTotal == null && entry.subjects) {
      const vals = Object.values(entry.subjects)
        .filter((v) => v != null)
        .map(Number);
      if (vals.length === 3) candidateTotal = vals.reduce((a, b) => a + b, 0);
    }
  }
  if (candidateTotal == null) {
    return {
      estimate: null,
      needsScoreInput: true,
      reason: isEn
        ? `No ${methodLabel} score entered yet — add your score to view estimates.`
        : `Bạn chưa nhập điểm ${methodLabel} — nhập điểm để xem ước tính theo phương thức này.`,
    };
  }
  const candidateNative = parseFloat(candidateTotal);
  const forecastNative = forecastCutoff(group.history);
  const factor = 30 / scale;
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
    needsScoreInput: false,
  };
}

// ---------------------------------------------------------------------------
// Sparkline điểm chuẩn theo năm
// ---------------------------------------------------------------------------

function Sparkline({ history }) {
  const { locale, pick } = useLanguage();

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
      <span className="text-xs text-secondary-text">
        {pick('Chỉ có dữ liệu 1 năm', '1-year cutoff only')} ({points.single.year}:{' '}
        <span className="tabular font-semibold">{fmt(points.single.cutoff, 2, locale)}</span>)
      </span>
    );
  }
  return (
    <svg
      width="96"
      height="30"
      viewBox="0 0 96 30"
      role="img"
      aria-label={pick('Xu hướng điểm chuẩn qua các năm', 'Historical cutoff trend across years')}
      className="shrink-0"
    >
      <polyline
        points={points.line}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
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
  const { lang, locale, pick } = useLanguage();
  const exam = getExamMeta(group.method, lang);
  const latest = group.history[0];
  const latestSource = group.sources.find((s) => s.year === latest?.year) || group.sources[0];
  const { estimate } = built;
  const bandStyle = estimate ? BAND_STYLE[estimate.band] || BAND_STYLE.borderline : null;
  const digits = group.scale === 1200 || group.scale === 450 ? 0 : 2;

  return (
    <article className="paper-card border border-border p-4 space-y-3 content-auto">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-bold text-base leading-snug text-foreground break-words">
            {group.majorName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {group.schoolCode && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-display font-extrabold bg-surface-alt border border-border-strong text-primary shrink-0">
                {group.schoolCode}
              </span>
            )}
            <p className="text-sm text-secondary-text break-words">
              {group.schoolName || group.schoolCode}
            </p>
          </div>
        </div>
        <span className="material-symbols-outlined text-muted-foreground shrink-0" aria-hidden="true">
          apartment
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="arena-chip">
          {exam.displayLabel} · {pick('thang', 'scale')} {group.scale ?? exam.scale ?? '—'}
        </span>
        {group.combo && (
          <span className="arena-chip">
            {pick('Tổ hợp', 'Combo')} {group.combo}
          </span>
        )}
        <span className="arena-chip">{getRegionLabel(regionOf(group.schoolCode), lang)}</span>
        {group.majorCode && (
          <span className="arena-chip">
            {pick('Mã', 'Code')} {group.majorCode}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Sparkline history={group.history} />
        <p className="text-xs text-secondary-text">
          {[...group.history]
            .sort((a, b) => a.year - b.year)
            .map((h) => `${h.year}: ${fmt(h.cutoff, digits, locale)}`)
            .join(' · ')}
        </p>
      </div>

      <p className="text-sm text-foreground">
        <span className="text-secondary-text">
          {pick(`Điểm chuẩn ${latest.year}: `, `${latest.year} Cutoff: `)}
        </span>
        <span className="tabular font-bold">{fmt(latest.cutoff, digits, locale)}</span>
        <span className="text-secondary-text"> / {group.scale}</span>
        {built.forecastNative != null && (
          <>
            <span className="text-secondary-text">
              {pick(' · Dự báo năm tới ≈ ', ' · Next forecast ≈ ')}
            </span>
            <span className="tabular font-bold">{fmt(built.forecastNative, digits, locale)}</span>
            {estimate && (
              <span className="text-secondary-text">
                {' '}
                ± {fmt(estimate.sigma * ((group.scale || 30) / 30), 2, locale)}
              </span>
            )}
          </>
        )}
      </p>

      {estimate ? (
        <div className={`rounded-xl px-3.5 py-2.5 border space-y-1 ${bandStyle.boxClass}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-display font-bold text-base ${bandStyle.textClass}`}>
              {estimate.bandLabel}
            </span>
            {estimate.showPercent ? (
              <span className="tabular text-sm font-bold text-foreground">
                {pick(
                  `${estimate.probabilityRounded}% khả năng`,
                  `${estimate.probabilityRounded}% chance`,
                )}
                <span className="text-secondary-text font-medium">
                  {' '}
                  {pick(
                    `(khoảng ${Math.round(estimate.pLow * 100)}–${Math.round(estimate.pHigh * 100)}%)`,
                    `(range ${Math.round(estimate.pLow * 100)}–${Math.round(estimate.pHigh * 100)}%)`,
                  )}
                </span>
              </span>
            ) : (
              <span className="text-xs text-secondary-text">
                {pick(
                  'Độ tin cậy thấp — chỉ hiện mức đánh giá, chưa hiện %',
                  'Low data confidence — showing band rating only',
                )}
              </span>
            )}
          </div>
          <p className="text-xs text-secondary-text">
            {pick('Điểm của bạn ', 'Your score ')}
            {built.viaMethod !== group.method
              ? pick(
                  `(quy đổi từ ${getExamMeta(built.viaMethod, lang).displayLabel}) `,
                  `(converted from ${getExamMeta(built.viaMethod, lang).displayLabel}) `,
                )
              : ''}
            {built.marginNative >= 0
              ? pick('cao hơn dự báo ', 'is above forecast by ')
              : pick('thấp hơn dự báo ', 'is below forecast by ')}
            <span className="tabular font-bold text-foreground">
              {fmt(Math.abs(built.marginNative), 2, locale)} {pick('điểm', 'pts')}
            </span>{' '}
            · {pick('Độ tin cậy:', 'Confidence:')} {estimate.confidenceLabel}
          </p>
          {estimate.reliabilityWarning && (
            <p className="text-[11px] text-accent">{estimate.reliabilityWarning}</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl px-3.5 py-2.5 border border-border bg-surface-alt">
          <p className="text-xs text-secondary-text flex items-start gap-2">
            <span
              className="material-symbols-outlined text-base text-accent shrink-0"
              aria-hidden="true"
            >
              info
            </span>
            <span>
              {built.reason ||
                pick(
                  'Chưa đủ dữ liệu để ước tính cho ngành này.',
                  'Insufficient data to estimate admission odds for this major.',
                )}
            </span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
        <p className="text-[11px] text-muted-foreground">
          {pick('Căn cứ: điểm chuẩn ', 'Basis: cutoffs ')}
          {group.history.map((h) => h.year).join(', ')}
          {latestSource?.url && (
            <>
              {' '}
              · {pick('Nguồn:', 'Source:')}{' '}
              <a
                href={latestSource.url}
                target="_blank"
                rel="noreferrer"
                className="underline text-secondary-text hover:text-primary"
              >
                {(() => {
                  try {
                    return new URL(latestSource.url).hostname;
                  } catch {
                    return pick('nguồn dữ liệu', 'source link');
                  }
                })()}
              </a>
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {!estimate && built.needsScoreInput && (
            <button
              type="button"
              onClick={onGoScores}
              className="btn-arena btn-arena-sm btn-arena-ghost cursor-pointer"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                edit_note
              </span>
              <span>{pick('Nhập điểm', 'Enter Scores')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleWish}
            aria-pressed={inWishlist}
            className={`btn-arena btn-arena-sm cursor-pointer ${
              inWishlist ? 'btn-arena-jade' : 'btn-arena-ghost'
            }`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {inWishlist ? 'bookmark_added' : 'bookmark_add'}
            </span>
            <span>
              {inWishlist
                ? pick('Đã lưu NV', 'Saved Choice')
                : pick('Lưu nguyện vọng', 'Save Choice')}
            </span>
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
  const { lang, locale, pick, t } = useLanguage();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  const [query, setQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [comboFilter, setComboFilter] = useState('all');
  const [bandFilter, setBandFilter] = useState('all');
  const [sortBy, setSortBy] = useState('probability');
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
        if (!cancelled) {
          setLoadError(err.message || '');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  const handleRetry = useCallback(() => {
    clearCutoffCache();
    setData(null);
    setRetryTick((tick) => tick + 1);
  }, []);

  // --- Hồ sơ điểm v3 ---
  const profileV2 = useMemo(() => {
    const local = {
      my_tsa: (() => {
        try {
          return localStorage.getItem('my_tsa');
        } catch {
          return null;
        }
      })(),
      my_hsa: (() => {
        try {
          return localStorage.getItem('my_hsa');
        } catch {
          return null;
        }
      })(),
      my_vact: (() => {
        try {
          return localStorage.getItem('my_vact');
        } catch {
          return null;
        }
      })(),
    };
    if (profile?.admission_scores) return migrateLegacyScores(profile.admission_scores, local);
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.version === 2 || parsed?.version === 3) {
          return migrateLegacyScores(parsed, local);
        }
      }
    } catch {
      /* ignore corrupted draft */
    }
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
  const combosPresent = useMemo(() => {
    const set = new Set();
    for (const g of groups) {
      for (const c of g.combos || []) {
        if (c) set.add(c);
      }
    }
    const popular = ['A00', 'A01', 'D01', 'D07', 'B00', 'C00', 'C01', 'A02', 'D90'];
    return [...set].sort((a, b) => {
      const ia = popular.indexOf(a);
      const ib = popular.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [groups]);

  // --- Gắn ước tính vào từng nhóm ---
  const rows = useMemo(
    () =>
      groups.map((group) => ({
        group,
        built: buildEstimate(group, profileV2, spectrumMethods, data?.meta?.base_year, lang),
      })),
    [groups, profileV2, spectrumMethods, data, lang],
  );

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
    if (methodFilter !== 'all') {
      result = result.filter(({ group }) => group.method === methodFilter);
    }
    if (regionFilter !== 'all') {
      result = result.filter(({ group }) => regionOf(group.schoolCode) === regionFilter);
    }
    if (comboFilter !== 'all') {
      result = result.filter(({ group }) => (group.combos || []).includes(comboFilter));
    }
    if (bandFilter !== 'all') {
      result = result.filter(({ built }) => {
        if (bandFilter === 'none') return !built.estimate;
        return built.estimate?.band === bandFilter;
      });
    }

    const sorted = [...result];
    sorted.sort((a, b) => {
      if (sortBy === 'cutoff_desc' || sortBy === 'cutoff_asc') {
        const ca = (a.group.history[0]?.cutoff || 0) / (a.group.scale || 30);
        const cb = (b.group.history[0]?.cutoff || 0) / (b.group.scale || 30);
        return sortBy === 'cutoff_desc' ? cb - ca : ca - cb;
      }
      if (sortBy === 'school') {
        const sa = a.group.schoolCode || '';
        const sb = b.group.schoolCode || '';
        if (sa !== sb) return sa.localeCompare(sb);
        return (a.group.majorName || '').localeCompare(b.group.majorName || '');
      }
      const pa = a.built.estimate?.probability;
      const pb = b.built.estimate?.probability;
      if (pa != null && pb != null) return pb - pa;
      if (pa != null) return -1;
      if (pb != null) return 1;
      const ca = (a.group.history[0]?.cutoff || 0) / (a.group.scale || 30);
      const cb = (b.group.history[0]?.cutoff || 0) / (b.group.scale || 30);
      return cb - ca;
    });
    return sorted;
  }, [rows, query, methodFilter, regionFilter, comboFilter, bandFilter, sortBy]);

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
    } catch {
      /* ignore blocked storage */
    }
  }, []);

  const removeWishItem = useCallback(
    (item) => {
      persistWishlist(wishlist.filter((w) => w.key !== item.key));
      if (user) {
        supabase
          .from('admission_wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('school_code', item.schoolCode)
          .eq('major_name', item.majorName)
          .eq('method', item.method)
          .then(() => {}, () => {});
      }
    },
    [persistWishlist, user, wishlist],
  );

  const toggleWish = useCallback(
    (group, built) => {
      const key = wishKeyOf(group);
      const existing = wishlist.find((w) => w.key === key);
      if (existing) {
        removeWishItem(existing);
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
    [wishlist, persistWishlist, removeWishItem, user],
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
      withP.map((w) => ({
        probability: w.estimateSnapshot.probability,
        schoolCode: w.schoolCode,
      })),
      lang,
    );
  }, [wishlist, lang]);

  const myScoreEntries = useMemo(
    () =>
      Object.entries(profileV2?.scores || {}).filter(
        ([k, v]) =>
          k !== 'combined' && v && v.status !== 'none' && (v.total != null || v.byGroup || v.subjects),
      ),
    [profileV2],
  );
  const mySavedHcmut = profileV2?.scores?.combined?.HCMUT;
  const hasAnyScore = myScoreEntries.length > 0 || mySavedHcmut?.total != null;
  const disclaimerText = getDisclaimer(lang);

  return (
    <div className="min-h-dvh font-sans text-foreground bg-background relative pb-24">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display font-extrabold text-lg tracking-tight text-foreground truncate">
                  {pick('Tìm trường phù hợp', 'University & Major Finder')}
                </h1>
                {data && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-jade-border bg-jade-soft text-jade">
                    <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                      verified
                    </span>
                    {data.source === 'supabase'
                      ? pick('CSDL trực tuyến', 'Live DB')
                      : pick('Kho điểm chuẩn', 'Benchmark Archive')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-secondary-text truncate">
                {data?.meta?.base_year
                  ? pick(
                      `Ước tính xác suất theo điểm chuẩn ${data.meta.base_year} và lịch sử các năm trước`,
                      `Statistical odds calibrated against ${data.meta.base_year} & multi-year cutoffs`,
                    )
                  : pick(
                      'Ước tính khả năng đỗ theo điểm chuẩn các năm gần nhất',
                      'Statistical admission estimates based on recent official cutoffs',
                    )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowWishlist((s) => !s)}
            aria-expanded={showWishlist}
            className={`btn-arena btn-arena-sm cursor-pointer shrink-0 ${
              showWishlist ? 'btn-arena-primary' : 'btn-arena-ghost'
            }`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              bookmark
            </span>
            <span>
              {pick(`Nguyện vọng (${wishlist.length})`, `Wishlist (${wishlist.length})`)}
            </span>
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
              onClick={() => navigate('/admission')}
              className="pb-3 border-b-2 border-transparent text-secondary-text hover:text-foreground font-display font-semibold text-sm whitespace-nowrap flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                calculate
              </span>
              {t('academics.nav.admission')}
            </button>
            <button
              type="button"
              aria-current="page"
              className="pb-3 border-b-2 border-primary text-primary font-display font-bold text-sm whitespace-nowrap flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                account_balance
              </span>
              {t('academics.nav.schools')}
            </button>
          </div>
        </nav>

        <main className="px-4 py-5 space-y-4 relative z-10">
          {/* Disclaimer bắt buộc */}
          <div className="paper-card border border-gold/60 bg-gold-soft/40 p-4 flex gap-3 items-start">
            <span className="material-symbols-outlined shrink-0 text-accent" aria-hidden="true">
              info
            </span>
            <p className="text-xs leading-relaxed text-secondary-text">{disclaimerText}</p>
          </div>

          {/* Điểm HSA/V-ACT cũ không tin cậy */}
          {legacyKeys.length > 0 && (
            <div className="paper-card border border-accent/45 bg-gold-soft/40 p-4 flex gap-3 items-start">
              <span className="material-symbols-outlined shrink-0 text-accent" aria-hidden="true">
                warning
              </span>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  {pick(
                    'Điểm HSA / V-ACT đã lưu trước đây cần nhập lại',
                    'Previously saved HSA / V-ACT scores need re-entry',
                  )}
                </p>
                <p className="text-xs text-secondary-text leading-relaxed">
                  {pick(
                    'Bản cũ từng ghi sai thang điểm hai kỳ thi này, nên điểm cũ đang được cách ly và không dùng để ước tính. Hãy nhập lại điểm đúng kỳ thi để kết quả đáng tin.',
                    'An earlier version swapped their score scales, so legacy HSA / V-ACT values are quarantined and excluded from estimates. Please re-enter them in Admission Scores.',
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/tim-truong/diem')}
                  className="btn-arena btn-arena-sm btn-arena-gold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    edit_note
                  </span>
                  <span>{pick('Nhập lại điểm', 'Re-enter Scores')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Hồ sơ điểm của tôi */}
          {hasAnyScore ? (
            <div className="paper-card border border-border p-4 flex gap-3 items-start">
              <span className="material-symbols-outlined shrink-0 text-jade" aria-hidden="true">
                verified
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {pick(
                    'Điểm của bạn đang dùng để ước tính',
                    'Active Score Profile Used for Estimates',
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {myScoreEntries.map(([code, v]) => {
                    const exam = getExamMeta(code, lang);
                    const shown =
                      v.total != null
                        ? `${fmt(parseFloat(v.total), code === 'vact' || code === 'vsat' ? 0 : 2, locale)}${exam.scale ? ` / ${exam.scale}` : ''}`
                        : pick('theo tổ hợp', 'by combo');
                    const statusSuffix =
                      v.status === 'mock'
                        ? ` (${t('academics.status.mockShort')})`
                        : v.status === 'target'
                          ? ` (${t('academics.status.targetShort')})`
                          : '';
                    return (
                      <span key={code} className="arena-chip">
                        {exam.displayLabel}:{' '}
                        <span className="tabular font-bold text-primary">{shown}</span>
                        {statusSuffix}
                      </span>
                    );
                  })}
                  {mySavedHcmut?.total != null && (
                    <span className="arena-chip">
                      HCMUT:{' '}
                      <span className="tabular font-bold text-primary">
                        {fmt(parseFloat(mySavedHcmut.total), 2, locale)} / 100
                      </span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/tim-truong/diem')}
                  className="btn-arena btn-arena-sm btn-arena-ghost cursor-pointer mt-3"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    edit_note
                  </span>
                  <span>{pick('Cập nhật điểm', 'Update Scores')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="paper-card border border-border p-4 flex gap-3 items-start">
              <span className="material-symbols-outlined shrink-0 text-accent" aria-hidden="true">
                info
              </span>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  {pick('Bạn chưa nhập điểm', 'No Exam Scores Entered Yet')}
                </p>
                <p className="text-xs text-secondary-text leading-relaxed">
                  {pick(
                    'Nhập điểm THPT, Học bạ, HSA, V-ACT, TSA... để xem ước tính khả năng đỗ cho từng ngành dưới đây. Khi chưa có điểm, trang hiển thị điểm chuẩn các năm để tham khảo.',
                    'Enter your National Exam, Transcript, HSA, V-ACT, or TSA scores to unlock per-major admission probability estimates. Without scores, historical cutoffs are shown for reference.',
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/tim-truong/diem')}
                  className="btn-arena btn-arena-sm btn-arena-primary cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    edit_note
                  </span>
                  <span>{pick('Nhập điểm ngay', 'Enter Scores Now')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Panel nguyện vọng */}
          {showWishlist && (
            <section
              className="paper-card border border-border-strong p-4 space-y-3"
              aria-label={pick('Danh sách nguyện vọng đã lưu', 'Saved admission wishlist')}
            >
              <h2 className="font-display font-bold text-lg text-foreground">
                {pick(`Nguyện vọng của tôi (${wishlist.length})`, `My Choices (${wishlist.length})`)}
              </h2>
              {wishHealth && wishHealth.warnings.length > 0 && (
                <div className="space-y-2">
                  {wishHealth.warnings.map((w) => (
                    <p
                      key={w.code}
                      className={`text-xs leading-relaxed rounded-xl px-3 py-2 border flex gap-2 ${
                        w.level === 'red'
                          ? 'border-danger/35 bg-danger/8 text-danger'
                          : 'border-accent/35 bg-gold-soft/45 text-foreground'
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-base shrink-0"
                        aria-hidden="true"
                      >
                        {w.level === 'red' ? 'error' : 'warning'}
                      </span>
                      <span>{w.text}</span>
                    </p>
                  ))}
                </div>
              )}
              {wishHealth && (
                <p className="text-xs text-secondary-text">
                  {pick('Điểm sức khoẻ danh sách: ', 'Portfolio Health Score: ')}
                  <span className="tabular font-bold text-foreground">{wishHealth.score}/100</span>
                  {pick(
                    ' — phân bổ hợp lý giữa thử thách / cân nhắc / an toàn và có nguyện vọng sàn an toàn sẽ cho điểm cao.',
                    ' — a balanced mix of reach, target, and safe choices with a strong final safety floor yields a higher score.',
                  )}
                </p>
              )}
              {wishlist.length === 0 ? (
                <p className="text-sm text-secondary-text">
                  {pick(
                    'Chưa có nguyện vọng nào. Bấm “Lưu nguyện vọng” ở thẻ ngành bên dưới để thêm vào danh sách này.',
                    'Your wishlist is empty. Click “Save Choice” on any major card below to start building your ranked list.',
                  )}
                </p>
              ) : (
                <ol className="space-y-2">
                  {wishlist.map((w, idx) => {
                    const savedBandLabel = w.estimateSnapshot?.band
                      ? getBandLabel(w.estimateSnapshot.band, lang)
                      : w.estimateSnapshot?.bandLabel;
                    return (
                      <li
                        key={w.key}
                        className="flex items-center gap-2 rounded-xl border border-border bg-surface-alt px-3 py-2"
                      >
                        <span className="font-display font-bold text-sm text-accent shrink-0">
                          NV{idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-snug text-foreground break-words">
                            {w.majorName}
                          </p>
                          <p className="text-[11px] text-secondary-text break-words">
                            {w.schoolCode ? `[${w.schoolCode}] ` : ''}
                            {w.schoolName} · {getExamMeta(w.method, lang).displayLabel}
                            {w.estimateSnapshot
                              ? pick(
                                  ` · Lúc lưu: ${savedBandLabel}${w.estimateSnapshot.probability != null ? ` (${Math.round(w.estimateSnapshot.probability * 20) * 5}%)` : ''}`,
                                  ` · Saved at: ${savedBandLabel}${w.estimateSnapshot.probability != null ? ` (${Math.round(w.estimateSnapshot.probability * 20) * 5}%)` : ''}`,
                                )
                              : pick(' · Chưa có ước tính lúc lưu', ' · Unestimated when saved')}
                          </p>
                        </div>
                        <div className="flex shrink-0">
                          <button
                            type="button"
                            onClick={() => moveWish(idx, -1)}
                            disabled={idx === 0}
                            aria-label={pick(
                              `Đưa nguyện vọng ${idx + 1} lên trên`,
                              `Move choice #${idx + 1} up`,
                            )}
                            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface text-secondary-text hover:text-foreground disabled:opacity-30 cursor-pointer"
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              arrow_upward
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveWish(idx, 1)}
                            disabled={idx === wishlist.length - 1}
                            aria-label={pick(
                              `Đưa nguyện vọng ${idx + 1} xuống dưới`,
                              `Move choice #${idx + 1} down`,
                            )}
                            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface text-secondary-text hover:text-foreground disabled:opacity-30 cursor-pointer"
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              arrow_downward
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeWishItem(w)}
                            aria-label={pick(
                              `Xoá nguyện vọng ${idx + 1}`,
                              `Remove choice #${idx + 1}`,
                            )}
                            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-danger/10 text-secondary-text hover:text-danger cursor-pointer"
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              delete
                            </span>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="text-[11px] text-muted-foreground">
                {pick(
                  'Danh sách này để chuẩn bị và cân đối nguyện vọng — không thay thế đăng ký nguyện vọng chính thức trên cổng của Bộ GD&ĐT.',
                  'This planner helps balance your admission portfolio — it does not replace official registration on the MOET national portal.',
                )}
              </p>
            </section>
          )}

          {/* Bộ lọc */}
          <section
            className="paper-card border border-border p-4 space-y-3"
            aria-label={pick('Bộ lọc tìm trường', 'University search filters')}
          >
            <div className="relative">
              <span
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base"
                aria-hidden="true"
              >
                search
              </span>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setDisplayLimit(20);
                }}
                placeholder={pick(
                  'Nhập tên trường, ngành học, mã trường (VD: HUST, HCMUT, NEU)...',
                  'Search university, major, or school code (e.g. HUST, HCMUT, NEU)...',
                )}
                aria-label={pick('Tìm kiếm trường hoặc ngành', 'Search universities or majors')}
                className="w-full pl-10 pr-4 min-h-[44px] bg-surface border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary placeholder:text-muted-foreground"
              />
            </div>

            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={pick('Lọc theo phương thức', 'Filter by admission method')}
            >
              <FilterChip
                active={methodFilter === 'all'}
                onClick={() => {
                  setMethodFilter('all');
                  setDisplayLimit(20);
                }}
              >
                {pick('Tất cả phương thức', 'All Methods')}
              </FilterChip>
              {methodsPresent.map((m) => (
                <FilterChip
                  key={m}
                  active={methodFilter === m}
                  onClick={() => {
                    setMethodFilter(m);
                    setDisplayLimit(20);
                  }}
                >
                  {getExamMeta(m, lang).displayLabel}
                </FilterChip>
              ))}
            </div>

            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={pick('Lọc theo khu vực', 'Filter by region')}
            >
              <FilterChip
                active={regionFilter === 'all'}
                onClick={() => {
                  setRegionFilter('all');
                  setDisplayLimit(20);
                }}
              >
                {pick('Mọi khu vực', 'All Regions')}
              </FilterChip>
              {regionsPresent.map((r) => (
                <FilterChip
                  key={r}
                  active={regionFilter === r}
                  onClick={() => {
                    setRegionFilter(r);
                    setDisplayLimit(20);
                  }}
                >
                  {getRegionLabel(r, lang)}
                </FilterChip>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
              <select
                value={comboFilter}
                onChange={(e) => {
                  setComboFilter(e.target.value);
                  setDisplayLimit(20);
                }}
                aria-label={pick('Lọc theo tổ hợp xét tuyển', 'Filter by subject combination')}
                className="min-h-[44px] text-sm bg-surface border border-border text-foreground rounded-xl px-3 outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary cursor-pointer"
              >
                <option value="all">{pick('Mọi tổ hợp môn', 'All Subject Combos')}</option>
                {combosPresent.map((c) => (
                  <option key={c} value={c}>
                    {pick(`Tổ hợp ${c}`, `Combo ${c}`)}
                  </option>
                ))}
              </select>

              <select
                value={bandFilter}
                onChange={(e) => {
                  setBandFilter(e.target.value);
                  setDisplayLimit(20);
                }}
                aria-label={pick('Lọc theo mức khả năng đỗ', 'Filter by probability band')}
                className="min-h-[44px] text-sm bg-surface border border-border text-foreground rounded-xl px-3 outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary cursor-pointer"
              >
                <option value="all">{pick('Mọi mức đánh giá', 'All Chance Bands')}</option>
                {BAND_ORDER.map((b) => (
                  <option key={b} value={b}>
                    {getBandLabel(b, lang)}
                  </option>
                ))}
                <option value="none">{pick('Chưa ước tính được', 'Not Yet Estimated')}</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setDisplayLimit(20);
                }}
                aria-label={pick('Sắp xếp kết quả', 'Sort results')}
                className="min-h-[44px] text-sm bg-surface border border-border text-foreground rounded-xl px-3 outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary cursor-pointer"
              >
                <option value="probability">
                  {pick('Sắp xếp: Khả năng cao nhất', 'Sort: Highest Admission Odds')}
                </option>
                <option value="cutoff_desc">
                  {pick('Sắp xếp: Điểm chuẩn cao → thấp', 'Sort: Cutoff High → Low')}
                </option>
                <option value="cutoff_asc">
                  {pick('Sắp xếp: Điểm chuẩn thấp → cao', 'Sort: Cutoff Low → High')}
                </option>
                <option value="school">
                  {pick('Sắp xếp: Mã trường A → Z', 'Sort: University Code A → Z')}
                </option>
              </select>
            </div>
          </section>

          {/* Trạng thái tải / lỗi / kết quả */}
          {loadError ? (
            <div className="paper-card border border-border p-6 text-center space-y-3">
              <span className="material-symbols-outlined text-4xl text-danger" aria-hidden="true">
                cloud_off
              </span>
              <p className="font-semibold text-foreground">
                {pick('Không tải được dữ liệu điểm chuẩn', 'Could not load cutoff dataset')}
              </p>
              <p className="text-sm text-secondary-text">
                {loadError ||
                  pick(
                    'Vui lòng kiểm tra kết nối mạng và thử lại.',
                    'Please check your connection and try again.',
                  )}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                className="btn-arena btn-arena-primary cursor-pointer"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  refresh
                </span>
                <span>{pick('Thử lại', 'Retry')}</span>
              </button>
            </div>
          ) : !data ? (
            <div
              className="flex justify-center items-center py-12"
              role="status"
              aria-label={pick('Đang tải dữ liệu', 'Loading cutoff data')}
            >
              <span
                className="material-symbols-outlined text-4xl animate-spin text-primary"
                aria-hidden="true"
              >
                sync
              </span>
            </div>
          ) : (
            <>
              <p className="text-xs text-secondary-text px-1">
                <span className="tabular font-bold text-foreground">
                  {fmt(filtered.length, 0, locale)}
                </span>{' '}
                {pick('ngành có dữ liệu điểm chuẩn', 'programs with historical cutoffs')}
                {hasAnyScore &&
                  sortBy === 'probability' &&
                  pick(
                    ' · ngành có khả năng cao hơn được xếp trước',
                    ' · sorted by highest admission probability first',
                  )}
              </p>
              {filtered.length === 0 ? (
                <div className="paper-card border border-border p-8 text-center space-y-2">
                  <span
                    className="material-symbols-outlined text-4xl text-muted-foreground"
                    aria-hidden="true"
                  >
                    search_off
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {pick(
                      'Không tìm thấy ngành phù hợp với bộ lọc',
                      'No matching programs found',
                    )}
                  </p>
                  <p className="text-xs text-secondary-text">
                    {pick(
                      'Thử đổi từ khoá hoặc bỏ bớt điều kiện lọc.',
                      'Try broadening your search keywords or resetting active filters.',
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {displayed.map(({ group, built }) => (
                    <ProgramCard
                      key={`${group.schoolCode}|${group.majorCode || ''}|${group.majorName}|${group.method}|${group.combo || ''}|${group.segment || ''}`}
                      group={group}
                      built={built}
                      inWishlist={wishKeys.has(wishKeyOf(group))}
                      onToggleWish={() => toggleWish(group, built)}
                      onGoScores={() => navigate('/tim-truong/diem')}
                    />
                  ))}
                  {displayLimit < filtered.length && (
                    <p className="text-center py-3">
                      <span
                        className="material-symbols-outlined text-muted-foreground animate-bounce"
                        aria-hidden="true"
                      >
                        expand_more
                      </span>
                    </p>
                  )}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground text-center pb-6">
                {disclaimerText}
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`arena-chip cursor-pointer min-h-[40px] px-3.5 transition-all active:scale-[0.98] ${
        active
          ? 'bg-primary text-on-primary border border-primary-hover shadow-xs font-semibold'
          : 'border border-border hover:bg-surface-alt hover:border-border-strong'
      }`}
    >
      {children}
    </button>
  );
}
