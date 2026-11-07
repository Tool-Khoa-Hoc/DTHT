// Dữ liệu môn học / giáo viên được sinh từ teachers.seed.json
// (nguồn sự thật: tool/all-pairs.json của hệ drive-to-sheet — 47 GV).
// Muốn cập nhật danh sách GV: chạy `node scripts/generate-teachers-seed.mjs`
// rồi commit lại seed. Không sửa tay danh sách trong file này.
import teachersSeed from './teachers.seed.json' with { type: 'json' };

export const ONLINE_SHEET_TITLE = 'Kho sheet học online theo từng môn và giáo viên';
export const ONLINE_SHEET_TITLE_EN = 'Online Study Sheets by Subject & Instructor';

const SUBJECT_EN_MAP = {
  TOAN: { labelEn: 'Mathematics', shortLabelEn: 'Math' },
  LY: { labelEn: 'Physics', shortLabelEn: 'Physics' },
  HOA: { labelEn: 'Chemistry', shortLabelEn: 'Chemistry' },
  ANH: { labelEn: 'English', shortLabelEn: 'English' },
  SINH: { labelEn: 'Biology', shortLabelEn: 'Biology' },
  VAN: { labelEn: 'Literature', shortLabelEn: 'Literature' },
  SU: { labelEn: 'History', shortLabelEn: 'History' },
  DIA: { labelEn: 'Geography', shortLabelEn: 'Geography' },
  DGNL: { labelEn: 'Aptitude Test (HSA/V-ACT)', shortLabelEn: 'Aptitude' },
  DGTD: { labelEn: 'Thinking Skills (TSA)', shortLabelEn: 'TSA' },
};

export const ONLINE_SUBJECTS = teachersSeed.subjects.map((subject) => ({
  id: subject.id,
  label: subject.label,
  shortLabel: subject.shortLabel,
  labelEn: SUBJECT_EN_MAP[subject.id]?.labelEn || subject.label,
  shortLabelEn: SUBJECT_EN_MAP[subject.id]?.shortLabelEn || subject.shortLabel,
  icon: subject.icon,
  color: subject.color,
  teachers: teachersSeed.teachers
    .filter((teacher) => teacher.subjectId === subject.id)
    .map((teacher) => ({
      title: teacher.title,
      sheetId: teacher.sheetId,
      url: teacher.url,
    })),
}));

export function getSubjectDisplayLabel(subject, lang = 'vi', short = false) {
  if (!subject) return '';
  if (lang === 'en') {
    return short
      ? subject.shortLabelEn || subject.labelEn || subject.shortLabel || subject.label
      : subject.labelEn || subject.label;
  }
  return short ? subject.shortLabel || subject.label : subject.label;
}

export const ONLINE_TEACHER_COUNT = ONLINE_SUBJECTS.reduce(
  (total, subject) => total + subject.teachers.length,
  0,
);

export function getTeacherKey(subjectId, teacher, index) {
  return `${subjectId}-${teacher.sheetId || index}-${index}`;
}

export function getSheetGid(teacher) {
  const gidMatch = teacher?.url?.match(/[?#&]gid=([^&#]+)/);
  return gidMatch ? decodeURIComponent(gidMatch[1]) : '0';
}

export function buildSheetEmbedUrl(teacher, refreshToken = '') {
  if (!teacher?.sheetId) return '';
  const gid = getSheetGid(teacher);
  const cacheBuster = refreshToken ? `&_=${encodeURIComponent(refreshToken)}` : '';

  return `https://docs.google.com/spreadsheets/d/${teacher.sheetId}/preview?gid=${encodeURIComponent(gid)}&widget=true&headers=false${cacheBuster}#gid=${encodeURIComponent(gid)}`;
}

export function buildSheetOpenUrl(teacher) {
  if (teacher?.url) return teacher.url;
  if (!teacher?.sheetId) return '#';

  const gid = getSheetGid(teacher);
  return `https://docs.google.com/spreadsheets/d/${teacher.sheetId}/edit?gid=${encodeURIComponent(gid)}#gid=${encodeURIComponent(gid)}`;
}
