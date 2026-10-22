// Tầng dữ liệu điểm chuẩn v3.
// Nguồn chính: bảng Supabase `admission_cutoffs` (migration
// 20261022110000_admission_cutoffs.sql, nạp bằng
// scripts/ingest-admissions-supabase.mjs). Nếu Supabase chưa áp migration /
// lỗi mạng / chưa cấu hình -> fallback file tĩnh
// public/data/admissions/cutoffs.json (sinh bởi merge-admissions-data.mjs).
// UI luôn biết dữ liệu đến từ đâu qua trường `source` của kết quả.
//
// Gom lịch sử theo (schoolCode, majorCode, combo, method, segment) — không
// còn gom theo majorName như v1 (chuỗi dễ va chạm), reliability được giữ để
// predict.js hạ độ tin cậy với bản ghi nguồn thứ cấp.

import { normalizeMethodCode } from './exams.js';
import { parseComboField } from './combos.js';

let cache = null;

// Thử đọc Supabase trước. supabaseClient được truyền vào (tránh import cứng
// lib/supabase.js vốn dùng import.meta.env — file này cũng chạy trong script
// test bằng node). Trả null nếu không đọc được để nơi gọi fallback JSON.
export async function loadCutoffsFromSupabase(supabaseClient) {
  if (!supabaseClient) return null;
  try {
    const rows = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseClient
        .from('admission_cutoffs')
        .select(
          'school_code, major_code, major_name, combo, method, scale, cutoff, year, quota, segment, verified, reliability, source_url, source_date, note',
        )
        .order('year', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) return null;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    if (!rows.length) return null;
    // Bảng admission_cutoffs không có tên trường — tên nằm ở admission_schools
    // (name_vi). Ghép vào từng record để UI/tìm kiếm có school_name như bản
    // JSON tĩnh; bảng trường đọc lỗi thì bỏ qua, không chặn dữ liệu điểm.
    try {
      const { data: schools, error: schoolsError } = await supabaseClient
        .from('admission_schools')
        .select('code, name_vi');
      if (!schoolsError && Array.isArray(schools)) {
        const nameByCode = new Map(schools.map((s) => [s.code, s.name_vi]));
        for (const r of rows) {
          if (!r.school_name && nameByCode.has(r.school_code)) {
            r.school_name = nameByCode.get(r.school_code);
          }
        }
      }
    } catch { /* thiếu tên trường không được làm hỏng dữ liệu điểm chuẩn */ }
    return {
      meta: { source: 'supabase', table: 'admission_cutoffs', record_count: rows.length },
      records: rows,
      conversions: [],
      score_distributions: [],
    };
  } catch {
    return null;
  }
}

export async function loadCutoffs(fetchFn = fetch, supabaseClient = null) {
  if (cache) return cache;
  const fromDb = await loadCutoffsFromSupabase(supabaseClient);
  if (fromDb) {
    cache = { ...fromDb, source: 'supabase' };
    return cache;
  }
  const res = await fetchFn('/data/admissions/cutoffs.json');
  if (!res.ok) throw new Error(`Không tải được dữ liệu điểm chuẩn (HTTP ${res.status})`);
  const json = await res.json();
  cache = { ...json, source: 'json-static' };
  return cache;
}

export function clearCutoffCache() {
  cache = null;
}

// Chuẩn hoá 1 record nguồn về format runtime.
export function normalizeRecord(r) {
  // combo có HAI hình dạng tuỳ nguồn: file JSON tĩnh là chuỗi "A00/A01",
  // còn cột combo trên Supabase là text[] nên client trả về MẢNG ['A00','A01'].
  // Chuẩn hoá tại đây về 1 dạng duy nhất: combos = mảng mã, combo = chuỗi
  // "A00/A01" (hoặc null). Mọi nơi tiêu thụ (SchoolFinder.comboRaw từng gọi
  // combo.split() thẳng) đều an toàn với cả hai nguồn — lỗi "s.split is not
  // a function" ngày 22/10/2026 đến từ việc giữ nguyên mảng của Supabase.
  const combos = parseComboField(r.combo);
  return {
    schoolCode: r.school_code,
    schoolName: r.school_name || null,
    majorCode: r.major_code || null,
    majorName: r.major_name,
    combo: combos.length ? combos.join('/') : null,
    combos,
    method: normalizeMethodCode(r.method),
    methodRaw: r.method,
    scale: r.scale ?? null,
    cutoff: r.cutoff == null ? null : Number(r.cutoff),
    year: r.year,
    quota: r.quota ?? null,
    segment: r.segment || 'chung',
    verified: !!r.verified,
    sourceUrl: r.source_url,
    sourceDate: r.source_date || null,
    reliability: r.reliability || null,
    note: r.note || null,
  };
}

// Gom records thành lịch sử theo (trường, mã ngành, tổ hợp, phương thức,
// phân đoạn), sắp xếp năm mới -> cũ, bỏ record chưa có điểm (cutoff null).
export function groupHistories(records) {
  const map = new Map();
  for (const raw of records) {
    const r = normalizeRecord(raw);
    if (r.cutoff == null) continue;
    const key = [
      r.schoolCode,
      r.majorCode || '',
      r.majorName,
      r.combo || '',
      r.method,
      r.segment || 'chung',
    ].join('|');
    if (!map.has(key)) {
      map.set(key, {
        schoolCode: r.schoolCode,
        schoolName: r.schoolName,
        majorCode: r.majorCode,
        majorName: r.majorName,
        combo: r.combo,
        combos: r.combos,
        method: r.method,
        scale: r.scale,
        segment: r.segment,
        reliability: r.reliability,
        history: [],
        sources: [],
      });
    }
    const g = map.get(key);
    g.history.push({ year: r.year, cutoff: r.cutoff, quota: r.quota });
    g.sources.push({ year: r.year, url: r.sourceUrl, date: r.sourceDate, verified: r.verified });
    // Reliability của nhóm = của bản ghi mới nhất.
    if (r.year >= (g.history[0]?.year ?? 0)) g.reliability = r.reliability;
  }
  for (const g of map.values()) {
    g.history.sort((a, b) => b.year - a.year);
  }
  return [...map.values()];
}
