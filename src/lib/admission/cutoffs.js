// Tầng dữ liệu điểm chuẩn — đọc file tĩnh public/data/admissions/cutoffs.json
// (sinh bởi scripts/build-admissions-data.mjs từ dữ liệu nguồn có source_url).
// Không dùng lại file chết /data/all_schools_scores.json của bản cũ.

import { normalizeMethodCode } from './exams.js';

let cache = null;

export async function loadCutoffs(fetchFn = fetch) {
  if (cache) return cache;
  const res = await fetchFn('/data/admissions/cutoffs.json');
  if (!res.ok) throw new Error(`Không tải được dữ liệu điểm chuẩn (HTTP ${res.status})`);
  cache = await res.json();
  return cache;
}

export function clearCutoffCache() {
  cache = null;
}

// Chuẩn hoá 1 record nguồn (format sample-cutoffs.json) về format runtime.
export function normalizeRecord(r) {
  return {
    schoolCode: r.school_code,
    schoolName: r.school_name,
    majorCode: r.major_code || null,
    majorName: r.major_name,
    combo: r.combo || null, // tổ hợp, vd "A00/A01"
    method: normalizeMethodCode(r.method),
    methodRaw: r.method,
    scale: r.scale ?? null, // thang của CHÍNH bản ghi này — bắt buộc khi so sánh
    cutoff: r.cutoff == null ? null : Number(r.cutoff),
    year: r.year,
    verified: !!r.verified,
    sourceUrl: r.source_url,
    sourceDate: r.source_date || null,
    reliability: r.reliability || null,
    note: r.note || null,
  };
}

// Gom records thành lịch sử theo (trường, ngành, tổ hợp, phương thức),
// sắp xếp năm mới -> cũ, bỏ record chưa verify được điểm (cutoff null).
export function groupHistories(records) {
  const map = new Map();
  for (const raw of records) {
    const r = normalizeRecord(raw);
    if (r.cutoff == null) continue;
    const key = [r.schoolCode, r.majorName, r.combo || '', r.method].join('|');
    if (!map.has(key)) {
      map.set(key, {
        schoolCode: r.schoolCode,
        schoolName: r.schoolName,
        majorCode: r.majorCode,
        majorName: r.majorName,
        combo: r.combo,
        method: r.method,
        scale: r.scale,
        history: [],
        sources: [],
      });
    }
    const g = map.get(key);
    g.history.push({ year: r.year, cutoff: r.cutoff });
    g.sources.push({ year: r.year, url: r.sourceUrl, date: r.sourceDate, verified: r.verified });
  }
  for (const g of map.values()) {
    g.history.sort((a, b) => b.year - a.year);
  }
  return [...map.values()];
}
