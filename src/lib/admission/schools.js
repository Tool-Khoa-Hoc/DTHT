// Dữ liệu trường — thay bảng REGION_BY_SCHOOL hardcode trong SchoolFinder.
// Nguồn đích lâu dài là bảng Supabase `admission_schools` (migration
// 20261022110000); bản seed dưới đây bao phủ các trường đã có trong dữ liệu
// điểm chuẩn score-v3, trường ngoài danh sách rơi về 'khac' như trước.
// Tên trường có dấu lấy từ chính dữ liệu điểm chuẩn (school_name trong
// cutoffs.json) ở runtime — file này chỉ giữ khu vực là thông tin tĩnh.

export const REGION_LABELS = {
  bac: 'Miền Bắc',
  trung: 'Miền Trung',
  nam: 'Miền Nam',
  khac: 'Khu vực khác',
};

export const SCHOOL_REGIONS = {
  // Miền Bắc
  HUST: 'bac', NEU: 'bac', FTU: 'bac', HMU: 'bac', UET: 'bac', UED: 'bac',
  ULIS: 'bac', HNUE: 'bac', HPU2: 'bac', HLU: 'bac', HVCSND: 'bac',
  TMU: 'bac', HVQUANY: 'bac', HUS: 'bac', HUMG: 'bac', PTIT: 'bac',
  HVNH: 'bac', HVTC: 'bac', USSH: 'bac', HUCE: 'bac', HAU: 'bac',
  'VNU-LAW': 'bac', DAV: 'bac', AJC: 'bac', HANU: 'bac', MTA: 'bac',
  HVANND: 'bac', DHCSND: 'bac', DHANND: 'bac', HVCTCAND: 'bac',
  HUP: 'bac', HUB: 'bac',
  // Miền Trung
  DHS: 'trung', DDS: 'trung', 'FTU-HCM': 'nam',
  // Miền Nam
  HCMUT: 'nam', UEH: 'nam', UMP: 'nam', UIT: 'nam', HCMUS: 'nam',
  HCMUE: 'nam', HUTECH: 'nam', ULAW_HCM: 'nam', 'ULAW-HCM': 'nam',
  HCMUSSH: 'nam', UEL: 'nam', UFM: 'nam', HCMOU: 'nam', HCMUAF: 'nam',
  HCMUTE: 'nam', IUH: 'nam', UEF: 'nam', VLU: 'nam', SGU: 'nam',
  HUFLIT: 'nam', TDTU: 'nam', NTTU: 'nam', HUIT: 'nam', HVQT: 'nam',
  DHPCCC: 'nam', UHS: 'nam', CTU: 'nam',
};

export function regionOfSchool(code) {
  return SCHOOL_REGIONS[String(code || '').toUpperCase()] || 'khac';
}
