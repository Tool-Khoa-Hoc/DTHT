// Dữ liệu môn học / giáo viên được sinh từ teachers.seed.json
// (nguồn sự thật: tool/all-pairs.json của hệ drive-to-sheet — 47 GV).
// Muốn cập nhật danh sách GV: chạy `node scripts/generate-teachers-seed.mjs`
// rồi commit lại seed. Không sửa tay danh sách trong file này.
import teachersSeed from './teachers.seed.json' with { type: 'json' };

export const ONLINE_SHEET_TITLE = 'Kho sheet học online theo từng môn và giáo viên';

export const ONLINE_SUBJECTS = teachersSeed.subjects.map((subject) => ({
  id: subject.id,
  label: subject.label,
  shortLabel: subject.shortLabel,
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
