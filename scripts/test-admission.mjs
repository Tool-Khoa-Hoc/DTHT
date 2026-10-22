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

// ===========================================================================
// SCORE-V3 — test theo RESTRUCTURE-DESIGN.md Mục 5 (TC-01..TC-20)
// ===========================================================================
import { readFileSync } from 'node:fs';
import { priorityAppliedForScale, normalizeMarginTo30 } from '../src/lib/admission/predict.js';
import { convertScore, validateAnchorSet, CONVERSION_SETS } from '../src/lib/admission/conversions.js';
import { comboScore, allComboScores, COMBOS } from '../src/lib/admission/combos.js';
import { bcaCombinedScore, hcmutCombinedScore, vsatComboScore, sptComboScore, hscaComboScore, integrated100Score } from '../src/lib/admission/formulas.js';
import { gpaSemester, gpaCumulative, toGpa4 } from '../src/lib/admission/gpa.js';
import { migrateToV3, validateEntry, saveScoreEntry, SCORES_VERSION } from '../src/lib/admission/scores.js';
import { percentileOf, spectrumEvidence } from '../src/lib/admission/distributions.js';

// TC-01 (đã có ở bộ cũ, giữ) + TC-02 mốc ưu tiên
ok('TC-02 priority 20 KV1 = 0.75', near(priorityApplied(20, 'KV1', 'NONE'), 0.75, 1e-9));
ok('TC-02 priority 22.5 KV1 = 0.75', near(priorityApplied(22.5, 'KV1', 'NONE'), 0.75, 1e-9));
ok('TC-02 priority 28 KV3 = 0', priorityApplied(28, 'KV3', 'NONE') === 0);
ok('TC-02 priority 30 KV1+UT2 = 0', near(priorityApplied(30, 'KV1', 'UT2'), 0, 1e-9));

// TC-03 ưu tiên đa thang
ok('TC-03 priority 27 KV1+UT1 = 1.10', near(priorityApplied(27, 'KV1', 'UT1'), 1.10, 0.005));
ok('TC-03 priority 24 KV2+UT2 = 1.00', near(priorityApplied(24, 'KV2', 'UT2'), 1.00, 0.005));
ok('TC-03 priorityAppliedForScale 84.5/100 KV2-NT = 1.03', near(priorityAppliedForScale(84.5, 100, 'KV2-NT', 'NONE'), 1.03, 0.005));

// TC-05 quy đổi equiprecentile qua conversions.js (neo chính thức, không phải tuyến tính)
const cv = (score, combo = 'A00') => convertScore(score, { fromExam: 'hsa', combo, year: 2025 });
ok('TC-05 convertScore HSA 102 = 27.50', near(cv(102).value, 27.5, 0.01));
ok('TC-05 convertScore HSA 105 = 27.875', near(cv(105).value, 27.875, 0.01));
ok('TC-05 convertScore HSA 115 = 29.00', near(cv(115).value, 29.0, 0.01));
ok('TC-05 convertScore HSA 95 = 26.375', near(cv(95).value, 26.375, 0.01));
ok('TC-05 convertScore HSA 90 = 25.50', near(cv(90).value, 25.5, 0.01));
ok('TC-05 khẳng định KHÔNG tuyến tính: HSA 102 != 20.40', Math.abs(cv(102).value - 20.4) > 1);

// TC-06 kẹp biên + chưa có neo minh bạch
ok('TC-06 convertScore HSA 140 kẹp 30.00 (high)', near(cv(140).value, 30, 0.01) && cv(140).extrapolated === 'high');
ok('TC-06 convertScore HSA 50 kẹp 23.25 (low)', near(cv(50).value, 23.25, 0.01) && cv(50).extrapolated === 'low');
const noAnchor = convertScore(800, { fromExam: 'vact', combo: 'A00', year: 2025 });
ok('TC-06 V-ACT toàn cục chưa có neo -> value null, reason no-anchor', noAnchor.value === null && noAnchor.reason === 'no-anchor');
const noAnchorTsa = convertScore(70, { fromExam: 'tsa', combo: 'A00', year: 2025 });
ok('TC-06 TSA chưa có neo -> no-anchor (cấm quy đổi chéo năm/tuyến tính)', noAnchorTsa.value === null && noAnchorTsa.reason === 'no-anchor');

// TC-06b chống hồi quy F-01: không còn đường tuyến tính trong trang/lib
const gpaSrc = readFileSync(new URL('../src/pages/GPACalculator.jsx', import.meta.url), 'utf8');
const admSrc = readFileSync(new URL('../src/pages/AdmissionCalculator.jsx', import.meta.url), 'utf8');
const sfSrc = readFileSync(new URL('../src/pages/SchoolFinder.jsx', import.meta.url), 'utf8');
ok('TC-06b GPACalculator không còn hsaQuy30 / BKHCMCalc / THPTExamCalc', !/hsaQuy30|BKHCMCalc|THPTExamCalc|DGNLSection/.test(gpaSrc));
ok('TC-06b không trang nào còn quy đổi tuyến tính HSA (/150 * 30)', !/150\)\s*\*\s*30|\/\s*150\s*\)\s*\*\s*30/.test(gpaSrc + admSrc + sfSrc));
ok('TC-06b SchoolFinder không còn trích neo bằng regex trên note (extractAnchors)', !sfSrc.includes('extractAnchors'));
ok('TC-06b SchoolFinder không còn REGION_BY_SCHOOL hardcode', !sfSrc.includes('REGION_BY_SCHOOL'));
ok('TC-06b percentileOf HSA 2025 tại 102 dùng phổ (không tuyến tính)', percentileOf('hsa', 2025, 102) > 90);

// TC-07/TC-08 BCA kết hợp
ok('TC-07 bcaCombinedScore(24, 70) = 22.20', near(bcaCombinedScore({ thptComboScore: 24, bcaExamScore: 70 }).value, 22.2, 0.01));
ok('TC-08 bcaCombinedScore(27, 80) = 25.20', near(bcaCombinedScore({ thptComboScore: 27, bcaExamScore: 80 }).value, 25.2, 0.01));

// TC-09/TC-10/TC-11 HCMUT (TC-11 bắt lỗi mẫu số F-02)
const hcmutBase = {
  thptScores: [9, 8, 8], thptMathScore: 9, hocbaScores: [9, 8, 8], hocbaMathScore: 9,
  region: 'KV3', category: 'NONE', bonus: 0,
};
const tc09 = hcmutCombinedScore({ ...hcmutBase, vactTotal: 850, vactToan: 250, doubleMath: true });
ok('TC-09 HCMUT ĐT2.1 điểm năng lực 73.33', near(tc09.breakdown.diemNL, 73.33, 0.01));
ok('TC-09 HCMUT TNTHPT quy đổi 85.00', near(tc09.breakdown.tnthptQD, 85, 0.01));
ok('TC-09 HCMUT học bạ quy đổi 85.00', near(tc09.breakdown.hbQD, 85, 0.01));
ok('TC-09 HCMUT ĐXT 76.83', near(tc09.value, 76.83, 0.01));
const tc10 = hcmutCombinedScore({ ...hcmutBase, vactTotal: null, doubleMath: true });
ok('TC-10 HCMUT ĐT2.2 điểm năng lực 63.75', near(tc10.breakdown.diemNL, 63.75, 0.01));
ok('TC-10 HCMUT ĐXT 70.13 (70.125)', near(tc10.value, 70.125, 0.01));
const tc11 = hcmutCombinedScore({
  vactTotal: 1200, vactToan: 300, doubleMath: false,
  thptScores: [10, 10, 10], thptMathScore: 10, hocbaScores: [10, 10, 10], hocbaMathScore: 10,
  region: 'KV3', category: 'NONE',
});
ok('TC-11 HCMUT không nhân Toán: V-ACT 1200 -> năng lực 100.00 (không phải 80)', near(tc11.breakdown.diemNL, 100, 0.01));
ok('TC-11 HCMUT tuyệt đối mọi thành phần -> ĐXT 100', near(tc11.value, 100, 0.01));

// TC-12/TC-13 V-SAT + SPT + H-SCA
ok('TC-12 vsatComboScore(95,110,80) = 285 (khớp điểm chuẩn V-SAT Y khoa HUTECH 2026)', vsatComboScore({ mon_1: 95, mon_2: 110, mon_3: 80 }).value === 285);
ok('TC-13 sptComboScore A00 (8.5, 9, 8) = 25.50 thang 30', near(sptComboScore({ toan: 8.5, ly: 9, hoa: 8 }, 'A00').value, 25.5, 0.01));
ok('TC-13b hscaComboScore (0.5*9 + 0.35*8 + 0.15*7) * 3 = 25.05', near(hscaComboScore({ monChinh: 9, hb1: 8, hb2: 7 }).value, 25.05, 0.01));
ok('TC-13c UEH tổng hợp: chưa có văn bản -> formula-unverified minh bạch', integrated100Score('UEH', {}).reason === 'formula-unverified');

// TC-14 tổ hợp đầy đủ
const fullSubjects = { toan: 9, ly: 8.5, hoa: 8, sinh: 7.5, van: 8, su: 7, dia: 7.5, anh: 9, gdkp: 8 };
ok('TC-14 comboScore A00 = 25.50', near(comboScore(fullSubjects, 'A00'), 25.5, 0.01));
ok('TC-14 allComboScores cho > 8 tổ hợp (có B00/C00/D01/D07/K01/A02)', (() => { const all = allComboScores(fullSubjects); return Object.keys(all).length > 8 && ['B00', 'C00', 'D01', 'D07', 'K01', 'A02'].every((c) => c in all); })());
ok('TC-14 comboScore thiếu môn -> null', comboScore({ toan: 9, ly: 8 }, 'A00') === null);
ok('TC-14 registry tổ hợp > 40 mã', Object.keys(COMBOS).length > 40);

// TC-16/TC-17 GPA
const tc16 = gpaSemester([
  { name: 'Toán', credits: 3, grade: 8.5 },
  { name: 'Vật lí', credits: 2, grade: 7.0 },
  { name: 'Tiếng Anh', credits: 2, grade: 9.0 },
]);
ok('TC-16 gpaSemester hệ 4 = 3.71', near(tc16.gpa4, 3.71, 0.01));
ok('TC-16 gpaSemester hệ 10 = 8.21', near(tc16.gpa10, 8.21, 0.01));
const tc17 = gpaSemester([
  { name: 'Chưa nhập', credits: 3, grade: null },
  { name: 'Trượt thật', credits: 2, grade: 0 },
  { name: 'Tiếng Anh', credits: 2, grade: 8.0 },
]);
ok('TC-17 môn null bị loại, môn 0 vẫn tính: credits=4, GPA4=1.75', tc17.credits === 4 && near(tc17.gpa4, 1.75, 0.01));
ok('TC-17b toGpa4(8.5) = 4.0 theo thang vn-common', toGpa4(8.5) === 4.0);
const cum = gpaCumulative([{ subjects: [{ credits: 3, grade: 8.5 }] }, { subjects: [{ credits: 3, grade: 5.0 }] }]);
ok('TC-17c gpaCumulative trọng số tín chỉ 2 kỳ = (4.0+1.5)/2 = 2.75', near(cum.gpa4, 2.75, 0.01));

// TC-15 + TC-18 migration v3 không làm rơi dữ liệu
const mig3 = migrateLegacyScores(
  {
    thpt_exam_total: '27.50',
    thpt_exam: [{ name: 'Toán', grade: 9.5 }, { name: 'Vật lý', grade: 9 }, { name: 'Hóa học', grade: 9 }],
    thpt_transcript: [
      { name: 'Toán', g10: 8.0, g11: 8.5, g12: 9.0 },
      { name: 'Vật lí', g10: 7.0, g11: 7.5, g12: 8.0 },
    ],
    bkhcm: { dgnl: 900, toan: 250 },
    hsa: { total: 900 },
  },
  { my_hsa: '105' },
);
ok('TC-18 hồ sơ sau migrate là version 3', mig3.version === 3 && SCORES_VERSION === 3);
ok('TC-18 THPT tổng 27.50 giữ nguyên', mig3.scores.thpt.total === 27.5);
ok('TC-18 THPT từng môn chuẩn hoá khoá (Vật lý -> ly)', mig3.scores.thpt.subjects.ly === 9);
ok('TC-15/TC-18 học bạ giữ điểm từng môn: TB 3 năm Toán = 8.50', near(mig3.scores.hocba.subjects.toan, 8.5, 0.01));
ok('TC-18 học bạ giữ yearly 3 năm', Array.isArray(mig3.scores.hocba.yearly.toan) && mig3.scores.hocba.yearly.toan[1] === 8.5);
ok('TC-18 bkhcm v1 -> combined.HCMUT migratedFrom v1-bkhcm + giữ rawInput', mig3.scores.combined?.HCMUT?.migratedFrom === 'v1-bkhcm' && mig3.scores.combined.HCMUT.rawInput.dgnl === 900);
ok('TC-18 hsa v1 (900, thang sai) vẫn cách ly legacy_unverified', !!mig3.legacy_unverified.hsa && mig3.scores.hsa?.total !== 900);
ok('TC-18 my_hsa 105 (thang 150 đúng) -> scores.hsa', mig3.scores.hsa.total === 105);
const migV2 = migrateToV3({ version: 2, candidate: { region: 'KV1', category: 'NONE' }, scores: { hsa: { status: 'actual', total: 100, scale: 150 } }, legacy_unverified: {} });
ok('TC-18b migrateToV3 từ v2 giữ nguyên entry hsa', migV2.version === 3 && migV2.scores.hsa.total === 100);
ok('TC-18c validateEntry: SPT từng môn 0-10 hợp lệ, tổng tổ hợp không bị chặn bởi thang 10', validateEntry('spt', { subjects: { toan: 9 } }).ok === true && validateEntry('hsa', { total: 0 }).ok === true);
const saved3 = saveScoreEntry(mig3, 'tsa', { status: 'actual', total: 70, scale: 100 });
ok('TC-18d saveScoreEntry merge sâu không rơi entry khác', saved3.scores.tsa.total === 70 && saved3.scores.hsa.total === 105 && !!saved3.scores.combined.HCMUT);

// TC-19 toàn vẹn dữ liệu sau merge (đọc file runtime thật)
const merged = JSON.parse(readFileSync(new URL('../public/data/admissions/cutoffs.json', import.meta.url), 'utf8'));
const DIA = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
ok('TC-19 mọi record có source_url', merged.records.every((r) => !!r.source_url));
ok('TC-19 cutoff trong [0, scale] hoặc có cảnh báo vượt thang trong note', merged.records.every((r) => r.cutoff == null || r.scale == null || r.cutoff <= r.scale || String(r.note || '').includes('vượt thang')));
ok('TC-19 không còn ngành giả __...__ trong records', merged.records.every((r) => !String(r.major_name || '').startsWith('__')));
ok('TC-19 tên trường 100% có dấu; tên ngành không dấu chỉ thuộc nhóm từ mượn (Y khoa/Marketing...)', merged.records.every((r) => DIA.test(r.school_name)) && merged.records.filter((r) => !DIA.test(r.major_name)).every((r) => ['Y khoa', 'Marketing', 'Digital Marketing'].includes(r.major_name)));
ok('TC-19 số record sau merge >= 1200 và verified >= 1150', merged.records.length >= 1200 && merged.meta.verified_count >= 1150);
ok('TC-19 conversions trong file >= 19 bộ và các bộ verified đơn điệu', merged.conversions.length >= 19 && merged.conversions.filter((c) => c.status === 'verified').every((c) => validateAnchorSet({ anchors: [...(c.anchors || [])].sort((a, b) => b.src - a.src) }).ok));
ok('TC-19 bộ neo HSA A00 trong conversions.js đơn điệu + đủ mốc', CONVERSION_SETS.filter((s) => s.status === 'verified').every((s) => validateAnchorSet(s).ok));
ok('TC-19 phổ điểm: HSA 2025 bằng chứng official', spectrumEvidence('hsa', 2025) === 'official');
ok('TC-19 normalizeMarginTo30 chỉ cho margin: 2.5 trên thang 100 -> 0.75', near(normalizeMarginTo30(2.5, 100), 0.75, 1e-9));

// TC-20 đầu-cuối: HSA 105 -> quy đổi 27.875 -> ước tính band an toàn với ngành ổn định ~25
const conv20 = convertScore(105, { fromExam: 'hsa', combo: 'A00', year: 2025 });
const est20 = estimateChannel(conv20.value, stable, 'thpt', { channel: 'equi-official', hasSpectrum: 'official', quotaYears: 2, latestYearIsCurrentSeason: true });
ok('TC-20 điểm quy đổi HSA 105 = 27.875', near(conv20.value, 27.875, 0.01));
ok('TC-20 band thuộc Khá an toàn / An toàn', ['likely', 'safe'].includes(est20.band));

console.log(`\nTổng cộng ${passed} test PASS (gồm bộ cũ + TC-01..TC-20 score-v3)`);
