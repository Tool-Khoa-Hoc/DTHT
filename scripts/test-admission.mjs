// Test nhanh cho src/lib/admission/ — chạy: node scripts/test-admission.mjs
// Các mốc kiểm chứng lấy từ ALGORITHM.md §6-§7 và DATA-RESEARCH.md (neo HSA 2025).
import assert from 'node:assert';
import {
  phi, priorityApplied, equipercentile, forecastCutoff, sigmaEff, estimateChannel, bandOf, portfolioHealth,
} from '../src/lib/admission/predict.js';
import { normalizeMethodCode, getExam } from '../src/lib/admission/exams.js';
import { migrateLegacyScores, validateScoreInput } from '../src/lib/admission/scores.js';
import { groupHistories } from '../src/lib/admission/cutoffs.js';

let passed = 0;
const ok = (name, cond) => { assert.ok(cond, name); passed++; console.log('  ✓', name); };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

// 1) phi() khớp mốc band: z=-1.04 -> ~15%, z=0.52 -> ~70%, z=1.28 -> ~90%
ok('phi(-1.04) ≈ 0.15', near(phi(-1.04), 0.149, 0.01));
ok('phi(0.52) ≈ 0.70', near(phi(0.52), 0.699, 0.01));
ok('phi(1.28) ≈ 0.90', near(phi(1.28), 0.900, 0.01));
ok('phi(0) = 0.5', near(phi(0), 0.5, 0.001));

// 2) Điểm ưu tiên giảm dần: A00 25.35, KV2-NT -> +0.31 (không phải +0.50)
ok('priority 25.35 KV2-NT = 0.31', near(priorityApplied(25.35, 'KV2-NT', 'NONE'), 0.31, 0.005));
ok('priority <=22.5 giữ nguyên danh nghĩa', near(priorityApplied(20, 'KV1', 'NONE'), 0.75, 1e-9));
ok('priority KV3 = 0', priorityApplied(28, 'KV3', 'NONE') === 0);

// 3) Equipercentile neo HSA -> A00 (khung Bộ 2025, DATA-RESEARCH): 102 -> 27.50
const hsaAnchors = [
  { topPct: 0.5, src: 130, dst: 30 },
  { topPct: 1, src: 120, dst: 29.5 },
  { topPct: 3, src: 110, dst: 28.5 },
  { topPct: 5, src: 102, dst: 27.5 },
  { topPct: 10, src: 100, dst: 27.25 },
  { topPct: 20, src: 90, dst: 25.5 },
];
ok('equipercentile HSA 102 = 27.50', near(equipercentile(102, hsaAnchors).value, 27.5, 0.01));
ok('equipercentile HSA 105 nội suy giữa 102-110', near(equipercentile(105, hsaAnchors).value, 27.875, 0.01));
ok('equipercentile trên neo cao nhất -> kẹp extrapolated high', equipercentile(140, hsaAnchors).extrapolated === 'high');

// 4) Registry: sửa lỗi đảo nhãn/thang cũ
ok('HSA scale 150 ĐHQG Hà Nội', getExam('hsa').scale === 150 && getExam('hsa').org.includes('Hà Nội'));
ok('V-ACT scale 1200 ĐHQG TP.HCM', getExam('vact').scale === 1200 && getExam('vact').org.includes('Hồ Chí Minh'));
ok('normalize THPT_QG -> thpt', normalizeMethodCode('THPT_QG') === 'thpt');
ok('normalize COMPOSITE_100 -> combined', normalizeMethodCode('COMPOSITE_100') === 'combined');
ok('normalize BCA_COMBINED -> bca', normalizeMethodCode('BCA_COMBINED') === 'bca');

// 5) forecast + sigma sàn: lịch sử ổn định bất thường vẫn không cho sigma < sàn
const stable = [{ year: 2026, cutoff: 25 }, { year: 2025, cutoff: 25.1 }, { year: 2024, cutoff: 24.9 }];
ok('forecast ổn định ≈ 25', near(forecastCutoff(stable), 25.0, 0.15));
ok('sigma có sàn 0.75 cho THPT', sigmaEff(stable, 'thpt', { hasCurrentSpectrum: true }) >= 0.75);

// 6) estimateChannel: điểm cao hơn dự báo 2đ -> band Khá an toàn/An toàn, có confidence
const est = estimateChannel(27.5, stable, 'thpt', { channel: 'direct', hasSpectrum: 'official', quotaYears: 2, latestYearIsCurrentSeason: true });
ok('estimate trả probability 0-1', est.probability > 0.7 && est.probability <= 1);
ok('bandOf(0.95) = safe', bandOf(0.95).code === 'safe');
ok('bandOf(0.05) = far', bandOf(0.05).code === 'far');

// 7) Migration v1: hsa/vact bị cách ly, tsa từ localStorage thang đúng được tin
const mig = migrateLegacyScores(
  { thpt_exam_total: '27.50', hsa: { total: 900, quyDoi: '22.50' }, tsa: { total: 70, toan: 30, doc: 15, kh: 25 } },
  { my_hsa: '105', my_vact: '800' },
);
ok('migrate THPT total string -> number', mig.scores.thpt.total === 27.5);
ok('migrate hsa v1 -> legacy_unverified (không gán thẳng vào scores)', !!mig.legacy_unverified.hsa && mig.scores.hsa?.migratedFrom !== 'v1');
ok('migrate my_hsa (GPA, thang 150) -> scores.hsa', mig.scores.hsa.total === 105 && mig.scores.hsa.scale === 150);
ok('migrate my_vact -> legacy_unverified', !!mig.legacy_unverified.vact_localstorage);
ok('validate 0 là điểm hợp lệ', validateScoreInput('hsa', 0).ok === true);
ok('validate HSA 200 bị chặn', validateScoreInput('hsa', 200).ok === false);

// 8) groupHistories: bỏ record cutoff null, sắp năm mới -> cũ
const groups = groupHistories([
  { school_code: 'HUST', school_name: 'BKHN', major_name: 'IT1', method: 'THPT_QG', scale: 30, cutoff: 28, year: 2025, verified: true, source_url: 'https://example.vn' },
  { school_code: 'HUST', school_name: 'BKHN', major_name: 'IT1', method: 'THPT_QG', scale: 30, cutoff: 28.5, year: 2026, verified: true, source_url: 'https://example.vn' },
  { school_code: 'HUST', school_name: 'BKHN', major_name: 'IT1', method: 'THPT_QG', scale: 30, cutoff: null, year: 2024, verified: false, source_url: 'https://example.vn' },
]);
ok('groupHistories gom 1 nhóm, 2 năm, mới trước', groups.length === 1 && groups[0].history.length === 2 && groups[0].history[0].year === 2026);

// 9) Portfolio: toàn NV rủi ro -> cảnh báo đỏ NO_SAFE
const health = portfolioHealth([{ probability: 0.3, schoolCode: 'A' }, { probability: 0.2, schoolCode: 'B' }]);
ok('portfolio rủi ro có cảnh báo NO_SAFE', health.warnings.some((w) => w.code === 'NO_SAFE'));

console.log(`\nTất cả ${passed} test PASS`);
