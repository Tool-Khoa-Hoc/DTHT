// GPA đại học + quy đổi thang 4 — tách khỏi trang GPACalculator (trước đây
// convertTo4() sống trong file trang). GPA đại học KHÔNG dùng chung hồ sơ
// admission_scores; module này chỉ chứa toán thuần.
//
// Phân biệt bắt buộc: môn CHƯA NHẬP (grade === null) bị loại khỏi kỳ tính;
// môn 0 ĐIỂM THẬT được tính (sửa lỗi falsy-zero `parseFloat(grade) || 0` cũ).

export const GPA_SCALES = {
  'vn-common': {
    id: 'vn-common',
    label: 'Thang bậc thang phổ biến (mặc định)',
    sourceNote:
      'Thang quy đổi bậc thang đang được nhiều trường Việt Nam dùng: ≥8,5→4,0 · ≥8,0→3,5 · ≥7,0→3,0 · ≥6,5→2,5 · ≥5,5→2,0 · ≥5,0→1,5 · ≥4,0→1,0 · <4,0→0. Đây là bộ thang app đã dùng trước score-v3 — giữ làm mặc định để không đổi kết quả của sinh viên hiện tại.',
    steps: [
      [8.5, 4.0], [8.0, 3.5], [7.0, 3.0], [6.5, 2.5],
      [5.5, 2.0], [5.0, 1.5], [4.0, 1.0], [0, 0],
    ],
  },
};

export function getGpaScale(scaleId = 'vn-common') {
  return GPA_SCALES[scaleId] || GPA_SCALES['vn-common'];
}

export function convertTo4(grade10, scaleId = 'vn-common') {
  return toGpa4(grade10, scaleId);
}

export function toGpa4(grade10, scaleId = 'vn-common') {
  if (grade10 == null || !Number.isFinite(Number(grade10))) return null;
  const g = Number(grade10);
  for (const [min, val] of getGpaScale(scaleId).steps) {
    if (g >= min) return val;
  }
  return 0;
}

// subjects: [{ grade: number|null (hệ 10), credits: number }]
export function gpaSemester(subjects, scaleId = 'vn-common') {
  const rows = (subjects || []).filter((s) => s && s.grade !== null && s.grade !== undefined && s.grade !== '');
  let credits = 0;
  let sum4 = 0;
  let sum10 = 0;
  for (const s of rows) {
    const cr = Number(s.credits) || 0;
    const g4 = toGpa4(s.grade, scaleId);
    if (g4 == null || cr <= 0) continue;
    credits += cr;
    sum4 += cr * g4;
    sum10 += cr * Number(s.grade);
  }
  if (credits === 0) return { gpa4: null, gpa10: null, credits: 0 };
  return {
    gpa4: Math.round((sum4 / credits) * 100) / 100,
    gpa10: Math.round((sum10 / credits) * 100) / 100,
    credits,
  };
}

// GPA tích luỹ toàn khoá: trọng số tín chỉ qua các kỳ (khác GPA của kỳ đang
// chọn — ngộ nhận cũ trong UniCalc).
export function gpaCumulative(semesters, scaleId = 'vn-common') {
  let credits = 0;
  let sum4 = 0;
  let sum10 = 0;
  for (const sem of semesters || []) {
    const r = gpaSemester(sem?.subjects || sem || [], scaleId);
    if (!r.credits) continue;
    credits += r.credits;
    sum4 += r.gpa4 * r.credits;
    sum10 += r.gpa10 * r.credits;
  }
  if (credits === 0) return { gpa4: null, gpa10: null, credits: 0 };
  return {
    gpa4: Math.round((sum4 / credits) * 100) / 100,
    gpa10: Math.round((sum10 / credits) * 100) / 100,
    credits,
  };
}

export function gpa10Average(subjects) {
  return gpaSemester(subjects).gpa10;
}
