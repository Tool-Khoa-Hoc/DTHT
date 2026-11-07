import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import ProgressBar from '../components/ui/ProgressBar';
import RankSeal from '../components/ui/RankSeal';
import { ListItemSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastProvider';
import { toGpa4, gpaSemester, gpaCumulative, getGpaScale } from '../lib/admission/gpa';
import {
  SUBJECTS,
  getSubjectLabel,
  canonicalSubjectKey,
  canonicalSubjects,
} from '../lib/admission/subjects';
import { COMBOS, allComboScores } from '../lib/admission/combos';
import { migrateLegacyScores, saveScoreEntry } from '../lib/admission/scores';
import { fmt } from '../lib/admission/format';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STARTER_UNI_LABELS = {
  u1: { vi: 'Toán cao cấp', en: 'Advanced Calculus' },
  u2: { vi: 'Triết học Mác – Lênin', en: 'Marxist–Leninist Philosophy' },
  u3: { vi: 'Tiếng Anh học thuật', en: 'Academic English' },
};

const UNI_DATALIST_SUGGESTIONS = {
  vi: [
    'Triết học Mác – Lênin',
    'Kinh tế chính trị Mác – Lênin',
    'Chủ nghĩa xã hội khoa học',
    'Tư tưởng Hồ Chí Minh',
    'Lịch sử Đảng Cộng sản Việt Nam',
    'Toán cao cấp',
    'Đại số tuyến tính',
    'Giải tích 1',
    'Giải tích 2',
    'Xác suất thống kê',
    'Vật lí đại cương',
    'Pháp luật đại cương',
    'Tiếng Anh học thuật',
    'Tin học đại cương',
  ],
  en: [
    'Advanced Calculus',
    'Linear Algebra',
    'Calculus I',
    'Calculus II',
    'Probability & Statistics',
    'General Physics',
    'Introduction to Law',
    'Academic English',
    'Introduction to Informatics',
    'Microeconomics',
    'Macroeconomics',
    'Data Structures & Algorithms',
  ],
};

const DEFAULT_UNI_COURSES = [
  { id: 'tmp-u1', name: 'Toán cao cấp', starterKey: 'u1', code: '', credits: 3, grade: '', persisted: false },
  { id: 'tmp-u2', name: 'Triết học Mác – Lênin', starterKey: 'u2', code: '', credits: 3, grade: '', persisted: false },
  { id: 'tmp-u3', name: 'Tiếng Anh học thuật', starterKey: 'u3', code: '', credits: 2, grade: '', persisted: false },
];

const DEFAULT_THPT_SUBJECTS = [
  { id: 'tmp-s1', name: 'Toán', starterKey: 'toan', credits: 1, score: '8.5' },
  { id: 'tmp-s2', name: 'Ngữ văn', starterKey: 'van', credits: 1, score: '7.8' },
  { id: 'tmp-s3', name: 'Tiếng Anh', starterKey: 'anh', credits: 1, score: '8.4' },
  { id: 'tmp-s4', name: 'Vật lí', starterKey: 'ly', credits: 1, score: '8.2' },
  { id: 'tmp-s5', name: 'Hoá học', starterKey: 'hoa', credits: 1, score: '8.0' },
];

const THPT_SUBJECT_ICONS = {
  toan: 'calculate',
  van: 'auto_stories',
  anh: 'translate',
  ly: 'bolt',
  hoa: 'science',
  sinh: 'biotech',
  su: 'history_edu',
  dia: 'map',
  gdkp: 'gavel',
  tin: 'computer',
  congnghe: 'engineering',
  phap: 'translate',
  trung: 'translate',
  duc: 'translate',
  nhat: 'translate',
  han: 'translate',
  nga: 'translate',
};

function resolveUniCourseName(course, lang) {
  if (course?.starterKey && STARTER_UNI_LABELS[course.starterKey]) {
    return STARTER_UNI_LABELS[course.starterKey][lang === 'en' ? 'en' : 'vi'];
  }
  return course?.name ?? '';
}

function resolveThptSubjectName(subj, lang) {
  if (subj?.starterKey) {
    return getSubjectLabel(subj.starterKey, lang);
  }
  return subj?.name ?? '';
}

function getThptSubjectIcon(name, starterKey) {
  const key = starterKey || canonicalSubjectKey(name);
  return (key && THPT_SUBJECT_ICONS[key]) || 'book';
}

function normalizeCalcMode(raw) {
  if (raw === 'student' || raw === 'thpt') return 'student';
  if (raw === 'university' || raw === 'uni' || raw === 'sv') return 'university';
  return 'university';
}

function clampNumeric32(val, maxAllowed = 9.99) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.round(Math.min(maxAllowed, Math.max(0, num)) * 100) / 100;
}

function toLetterGrade(score10) {
  if (score10 === '' || score10 == null || !Number.isFinite(Number(score10))) return null;
  const g = Number(score10);
  if (g >= 8.5) return 'A';
  if (g >= 8.0) return 'B+';
  if (g >= 7.0) return 'B';
  if (g >= 6.5) return 'C+';
  if (g >= 5.5) return 'C';
  if (g >= 5.0) return 'D+';
  if (g >= 4.0) return 'D';
  return 'F';
}

function getUniAcademicRank(gpa4, lang = 'vi') {
  const isEn = lang === 'en';
  if (gpa4 == null || !Number.isFinite(gpa4)) {
    return {
      label: isEn ? 'Unranked' : 'Chưa xếp loại',
      color: 'text-secondary-text bg-surface-alt border-border',
    };
  }
  if (gpa4 >= 3.6) {
    return {
      label: isEn ? 'Distinction' : 'Xuất sắc',
      color: 'text-completed bg-completed-soft border-completed-border',
    };
  }
  if (gpa4 >= 3.2) {
    return {
      label: isEn ? 'Very Good' : 'Giỏi',
      color: 'text-jade bg-jade-soft border-jade-border',
    };
  }
  if (gpa4 >= 2.5) {
    return {
      label: isEn ? 'Good' : 'Khá',
      color: 'text-gold-dark bg-gold-soft border-gold',
    };
  }
  if (gpa4 >= 2.0) {
    return {
      label: isEn ? 'Average' : 'Trung bình',
      color: 'text-accent bg-gold-soft/60 border-border-strong',
    };
  }
  return {
    label: isEn ? 'Below Average' : 'Yếu',
    color: 'text-primary bg-primary-soft border-primary/35',
  };
}

function getThptAcademicRank(gpa10, lang = 'vi') {
  const isEn = lang === 'en';
  if (gpa10 == null || !Number.isFinite(gpa10)) {
    return {
      label: isEn ? 'Unranked' : 'Chưa xếp loại',
      color: 'text-secondary-text bg-surface-alt border-border',
    };
  }
  if (gpa10 >= 9.0) {
    return {
      label: isEn ? 'Distinction' : 'Xuất sắc',
      color: 'text-completed bg-completed-soft border-completed-border',
    };
  }
  if (gpa10 >= 8.0) {
    return {
      label: isEn ? 'Very Good' : 'Giỏi',
      color: 'text-jade bg-jade-soft border-jade-border',
    };
  }
  if (gpa10 >= 6.5) {
    return {
      label: isEn ? 'Good' : 'Khá',
      color: 'text-gold-dark bg-gold-soft border-gold',
    };
  }
  if (gpa10 >= 5.0) {
    return {
      label: isEn ? 'Average' : 'Trung bình',
      color: 'text-accent bg-gold-soft/60 border-border-strong',
    };
  }
  return {
    label: isEn ? 'Below Average' : 'Yếu',
    color: 'text-primary bg-primary-soft border-primary/35',
  };
}

export default function GPACalculator() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { lang, isEn, locale, pick, t } = useLanguage();
  const { showToast } = useToast();

  const tempIdRef = useRef(100);
  const admissionScoresRef = useRef(null);
  const nextTempId = (prefix = 'tmp') => {
    tempIdRef.current += 1;
    return `${prefix}-${tempIdRef.current}`;
  };

  const [mode, setMode] = useState(() => normalizeCalcMode(profile?.user_mode));
  const [modeSyncedUser, setModeSyncedUser] = useState(null);

  // University state (`semesters` + `subjects`)
  const scaleId = 'vn-common';
  const [semesters, setSemesters] = useState([]);
  const [selectedSemId, setSelectedSemId] = useState('');
  const [uniSubjects, setUniSubjects] = useState(DEFAULT_UNI_COURSES);
  const [allUniSubjects, setAllUniSubjects] = useState([]);
  const [targetGpa4, setTargetGpa4] = useState(() => {
    const raw = Number(profile?.target_gpa);
    return Number.isFinite(raw) && raw > 0 && raw <= 4 ? String(raw) : '3.20';
  });
  const [plannedCredits, setPlannedCredits] = useState('15');

  // Semester management UI state
  const [showNewSemForm, setShowNewSemForm] = useState(false);
  const [newSemName, setNewSemName] = useState('');
  const [isCreatingSem, setIsCreatingSem] = useState(false);
  const [isRenamingSem, setIsRenamingSem] = useState(false);
  const [renameSemValue, setRenameSemValue] = useState('');
  const [confirmDeleteSem, setConfirmDeleteSem] = useState(false);

  // THPT state (`user_grades` + `profiles.admission_scores`)
  const [thptSubjects, setThptSubjects] = useState(DEFAULT_THPT_SUBJECTS);
  const [targetThpt, setTargetThpt] = useState(() => {
    const raw = Number(profile?.target_thpt);
    return Number.isFinite(raw) && raw > 0 ? String(raw) : '25.5';
  });
  const [targetDgnl, setTargetDgnl] = useState(() => {
    const raw = Number(profile?.target_dgnl);
    return Number.isFinite(raw) && raw > 0 ? String(raw) : '900';
  });

  // Shared UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Sync initial targets & mode when profile arrives
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (profile.admission_scores) {
        admissionScoresRef.current = profile.admission_scores;
      }
      if (profile.id && modeSyncedUser !== profile.id) {
        setMode(normalizeCalcMode(profile.user_mode));
        setModeSyncedUser(profile.id);
      }
      const gpaTarget = Number(profile.target_gpa);
      if (Number.isFinite(gpaTarget) && gpaTarget > 0 && gpaTarget <= 4) {
        setTargetGpa4(String(gpaTarget));
      }
      const thptTarget = Number(profile.target_thpt);
      if (Number.isFinite(thptTarget) && thptTarget > 0) {
        setTargetThpt(String(thptTarget));
      }
      const dgnlTarget = Number(profile.target_dgnl);
      if (Number.isFinite(dgnlTarget) && dgnlTarget > 0) {
        setTargetDgnl(String(dgnlTarget));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modeSyncedUser, profile]);

  const loadSemesterSubjects = useCallback(async (semId) => {
    if (!semId) {
      setUniSubjects(DEFAULT_UNI_COURSES);
      return;
    }
    const { data, error } = await supabase
      .from('subjects')
      .select('id, semester_id, name, code, credits, grade_letter, grade_number, status, created_at')
      .eq('semester_id', semId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      setUniSubjects(
        data.map((row) => ({
          id: row.id,
          name: row.name || '',
          code: row.code || '',
          credits: row.credits ?? 3,
          grade: row.grade_number == null ? '' : String(row.grade_number),
          persisted: true,
        })),
      );
    } else {
      setUniSubjects([
        { id: 'tmp-empty-1', name: '', code: '', credits: 3, grade: '', persisted: false },
      ]);
    }
  }, []);

  const loadUniversityData = useCallback(
    async (preferredSemId) => {
      if (!user) return;
      setIsLoading(true);
      try {
        const [semRes, subRes] = await Promise.all([
          supabase
            .from('semesters')
            .select('id, name, status, total_credits, gpa, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('subjects')
            .select('id, semester_id, name, code, credits, grade_letter, grade_number')
            .eq('user_id', user.id),
        ]);

        if (semRes.error) throw semRes.error;
        if (subRes.error) throw subRes.error;

        const semList = semRes.data || [];
        setSemesters(semList);
        setAllUniSubjects(subRes.data || []);

        const activeId =
          preferredSemId && semList.some((s) => s.id === preferredSemId)
            ? preferredSemId
            : semList.length > 0
              ? semList[semList.length - 1].id
              : '';

        setSelectedSemId(activeId);
        if (activeId) {
          await loadSemesterSubjects(activeId);
        } else {
          setUniSubjects(DEFAULT_UNI_COURSES);
        }
      } catch (err) {
        console.error('Failed to load semester data:', err);
        showToast(
          pick(
            'Không thể tải dữ liệu học kỳ từ máy chủ.',
            'Could not load semester data from the server.',
          ),
          'error',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [loadSemesterSubjects, pick, showToast, user],
  );

  const loadStudentData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_grades')
        .select('id, subject, credits, score, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setThptSubjects(
          data.map((row) => ({
            id: row.id,
            name: row.subject || '',
            credits: row.credits ?? 1,
            score: row.score == null ? '' : String(row.score),
          })),
        );
      } else if (profile?.admission_scores) {
        const migrated = migrateLegacyScores(profile.admission_scores);
        const hocbaSubs = migrated?.scores?.hocba?.subjects;
        if (hocbaSubs && Object.keys(hocbaSubs).length > 0) {
          setThptSubjects(
            Object.entries(hocbaSubs).map(([key, val], index) => ({
              id: `hb-${index}-${key}`,
              name: getSubjectLabel(key, 'vi'),
              starterKey: canonicalSubjectKey(key) || undefined,
              credits: 1,
              score: String(val),
            })),
          );
        }
      }
    } catch (err) {
      console.error('Failed to load high school transcript:', err);
      showToast(
        pick('Không thể tải bảng điểm học bạ.', 'Could not load high school transcript.'),
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  }, [pick, profile?.admission_scores, showToast, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await Promise.all([loadUniversityData(), loadStudentData()]);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStudentData, loadUniversityData, user]);

  // Select another semester
  const handleSelectSemester = async (semId) => {
    setSelectedSemId(semId);
    setIsRenamingSem(false);
    setConfirmDeleteSem(false);
    if (!user || !semId) {
      setUniSubjects(DEFAULT_UNI_COURSES);
      return;
    }
    setIsLoading(true);
    try {
      await loadSemesterSubjects(semId);
    } catch (err) {
      console.error('Failed to load semester courses:', err);
      showToast(
        pick('Không thể tải danh sách môn học.', 'Could not load courses for this semester.'),
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSemester = async () => {
    if (!user) {
      showToast(
        pick(
          'Vui lòng đăng nhập để tạo học kỳ mới.',
          'Please sign in to create a new semester.',
        ),
        'warning',
      );
      return;
    }
    const cleanName = newSemName.trim();
    if (!cleanName) {
      showToast(
        pick(
          'Vui lòng nhập tên học kỳ (ví dụ: Học kỳ 1 - Năm 1).',
          'Please enter a semester name (e.g. Semester 1 - Year 1).',
        ),
        'warning',
      );
      return;
    }
    setIsCreatingSem(true);
    try {
      const { data, error } = await supabase
        .from('semesters')
        .insert([
          {
            user_id: user.id,
            name: cleanName,
            status: 'in_progress',
            total_credits: 0,
            gpa: 0,
          },
        ])
        .select('id, name, status, total_credits, gpa, created_at')
        .single();

      if (error) throw error;

      setNewSemName('');
      setShowNewSemForm(false);
      await loadUniversityData(data.id);
      showToast(
        pick(`Đã tạo "${cleanName}"!`, `Created "${cleanName}"!`),
        'success',
      );
    } catch (err) {
      console.error('Failed to create semester:', err);
      showToast(
        pick('Không thể tạo học kỳ: ', 'Could not create semester: ') + err.message,
        'error',
      );
    } finally {
      setIsCreatingSem(false);
    }
  };

  const handleRenameSemester = async () => {
    if (!user || !selectedSemId) return;
    const cleanName = renameSemValue.trim();
    if (!cleanName) {
      showToast(
        pick('Tên học kỳ không được để trống.', 'Semester name cannot be empty.'),
        'warning',
      );
      return;
    }
    try {
      const { error } = await supabase
        .from('semesters')
        .update({ name: cleanName })
        .eq('id', selectedSemId)
        .eq('user_id', user.id);
      if (error) throw error;

      setIsRenamingSem(false);
      setSemesters((prev) =>
        prev.map((sem) => (sem.id === selectedSemId ? { ...sem, name: cleanName } : sem)),
      );
      showToast(pick('Đã đổi tên học kỳ.', 'Semester renamed.'), 'success');
    } catch (err) {
      console.error('Failed to rename semester:', err);
      showToast(
        pick('Không thể đổi tên học kỳ: ', 'Could not rename semester: ') + err.message,
        'error',
      );
    }
  };

  const handleDeleteSemester = async () => {
    if (!user || !selectedSemId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('semesters')
        .delete()
        .eq('id', selectedSemId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Recalculate cumulative GPA from remaining subjects
      const remainingSubs = allUniSubjects.filter((s) => s.semester_id !== selectedSemId);
      const bySem = {};
      for (const s of remainingSubs) {
        if (s.grade_number == null) continue;
        (bySem[s.semester_id] ||= []).push({ credits: s.credits, grade: s.grade_number });
      }
      const nextCum = gpaCumulative(
        Object.values(bySem).map((list) => ({ subjects: list })),
        scaleId,
      );
      await supabase
        .from('profiles')
        .update({ current_gpa: clampNumeric32(nextCum.gpa4 ?? 0, 4.0) })
        .eq('id', user.id);

      setConfirmDeleteSem(false);
      await loadUniversityData();
      await refreshProfile?.();
      showToast(
        pick(
          'Đã xoá học kỳ và cập nhật lại GPA tích luỹ.',
          'Semester deleted and cumulative GPA updated.',
        ),
        'info',
      );
    } catch (err) {
      console.error('Failed to delete semester:', err);
      showToast(
        pick('Không thể xoá học kỳ: ', 'Could not delete semester: ') + err.message,
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  };

  // University GPA calculations
  const semResult = useMemo(
    () =>
      gpaSemester(
        uniSubjects.map((s) => ({
          credits: Math.max(1, Math.round(Number(s.credits) || 1)),
          grade: s.grade === '' || s.grade == null ? null : Number(s.grade),
        })),
        scaleId,
      ),
    [uniSubjects],
  );

  // Live cumulative GPA combining other saved semesters + current semester edits
  const liveCumulative = useMemo(() => {
    const bySem = {};
    for (const s of allUniSubjects) {
      if (selectedSemId && s.semester_id === selectedSemId) continue;
      if (s.grade_number == null) continue;
      (bySem[s.semester_id] ||= []).push({
        credits: Math.max(1, Math.round(Number(s.credits) || 1)),
        grade: Number(s.grade_number),
      });
    }
    const activeRows = uniSubjects
      .filter((s) => s.grade !== '' && s.grade != null && Number.isFinite(Number(s.grade)))
      .map((s) => ({
        credits: Math.max(1, Math.round(Number(s.credits) || 1)),
        grade: Number(s.grade),
      }));
    if (activeRows.length > 0) {
      bySem[selectedSemId || '__draft__'] = activeRows;
    }
    return gpaCumulative(
      Object.values(bySem).map((list) => ({ subjects: list })),
      scaleId,
    );
  }, [allUniSubjects, selectedSemId, uniSubjects]);

  const uniRank = getUniAcademicRank(semResult.gpa4, lang);
  const parsedTargetGpa4 = Number(targetGpa4) || 3.2;
  const activeGpaForTarget = liveCumulative.gpa4 ?? semResult.gpa4 ?? 0;
  const activeCreditsForTarget = liveCumulative.credits || semResult.credits || 0;
  const isUniTargetReached =
    activeCreditsForTarget > 0 && activeGpaForTarget >= parsedTargetGpa4;
  const uniTargetDiff = Math.max(0, parsedTargetGpa4 - activeGpaForTarget);

  // Target GPA Simulator for planned remaining credits
  const parsedPlannedCredits = Math.max(1, Math.round(Number(plannedCredits) || 15));
  const requiredFutureGpa4 = useMemo(() => {
    const totalNeededPoints = parsedTargetGpa4 * (activeCreditsForTarget + parsedPlannedCredits);
    const currentPoints = activeGpaForTarget * activeCreditsForTarget;
    const req = (totalNeededPoints - currentPoints) / parsedPlannedCredits;
    return Math.round(req * 100) / 100;
  }, [activeCreditsForTarget, activeGpaForTarget, parsedPlannedCredits, parsedTargetGpa4]);

  const maxReachableGpa4 = useMemo(() => {
    const maxPts = activeGpaForTarget * activeCreditsForTarget + 4.0 * parsedPlannedCredits;
    return Math.round((maxPts / (activeCreditsForTarget + parsedPlannedCredits)) * 100) / 100;
  }, [activeCreditsForTarget, activeGpaForTarget, parsedPlannedCredits]);

  // THPT calculations
  const thptResult = useMemo(() => {
    let credits = 0;
    let weightedSum = 0;
    for (const row of thptSubjects) {
      if (row.score === '' || row.score == null) continue;
      const sc = Number(row.score);
      const cr = Math.max(1, Math.round(Number(row.credits) || 1));
      if (!Number.isFinite(sc) || sc < 0 || sc > 10) continue;
      credits += cr;
      weightedSum += sc * cr;
    }
    return {
      gpa10: credits > 0 ? Math.round((weightedSum / credits) * 100) / 100 : null,
      credits,
    };
  }, [thptSubjects]);

  const thptCanonicalMap = useMemo(() => {
    const raw = {};
    for (const row of thptSubjects) {
      const effectiveKey = row.starterKey || row.name?.trim();
      if (!effectiveKey || row.score === '' || row.score == null) continue;
      const sc = Number(row.score);
      if (Number.isFinite(sc) && sc >= 0 && sc <= 10) {
        raw[effectiveKey] = sc;
      }
    }
    return canonicalSubjects(raw);
  }, [thptSubjects]);

  const thptCombos = useMemo(() => {
    const all = allComboScores(thptCanonicalMap);
    const priority = ['A00', 'A01', 'D01', 'D07', 'B00', 'C00', 'C01', 'A02'];
    return Object.entries(all)
      .map(([code, score]) => ({
        code,
        score: Math.round(score * 100) / 100,
        subjectLabels: (COMBOS[code]?.subjects || [])
          .map((k) => getSubjectLabel(k, lang))
          .join(' · '),
        priorityIdx: priority.indexOf(code),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const pa = a.priorityIdx === -1 ? 99 : a.priorityIdx;
        const pb = b.priorityIdx === -1 ? 99 : b.priorityIdx;
        return pa - pb;
      });
  }, [lang, thptCanonicalMap]);

  const thptRank = getThptAcademicRank(thptResult.gpa10, lang);
  const bestCombo = thptCombos[0] || null;
  const parsedTargetThpt = Number(targetThpt) || 25.5;
  const isThptTargetReached = bestCombo != null && bestCombo.score >= parsedTargetThpt;
  const thptTargetDiff = bestCombo != null ? Math.max(0, parsedTargetThpt - bestCombo.score) : null;

  // Row mutators
  const updateUniCourse = (id, field, value) => {
    setUniSubjects((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (field === 'name') {
          return { ...c, name: value, starterKey: null };
        }
        return { ...c, [field]: value };
      }),
    );
  };

  const addUniCourse = () => {
    setUniSubjects((prev) => [
      ...prev,
      { id: nextTempId('uni'), name: '', code: '', credits: 3, grade: '', persisted: false },
    ]);
  };

  const removeUniCourse = (id) => {
    setUniSubjects((prev) =>
      prev.length > 1
        ? prev.filter((c) => c.id !== id)
        : [{ id: nextTempId('uni'), name: '', code: '', credits: 3, grade: '', persisted: false }],
    );
  };

  const updateThptSubject = (id, field, value) => {
    setThptSubjects((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (field === 'name') {
          return { ...c, name: value, starterKey: null };
        }
        return { ...c, [field]: value };
      }),
    );
  };

  const addThptSubject = () => {
    setThptSubjects((prev) => [
      ...prev,
      { id: nextTempId('thpt'), name: '', credits: 1, score: '' },
    ]);
  };

  const removeThptSubject = (id) => {
    setThptSubjects((prev) =>
      prev.length > 1
        ? prev.filter((c) => c.id !== id)
        : [{ id: nextTempId('thpt'), name: '', credits: 1, score: '' }],
    );
  };

  const handleConfirmResetScores = () => {
    if (mode === 'university') {
      setUniSubjects((prev) => prev.map((c) => ({ ...c, grade: '' })));
    } else {
      setThptSubjects((prev) => prev.map((c) => ({ ...c, score: '' })));
    }
    setConfirmReset(false);
    showToast(
      pick(
        'Đã đặt lại các ô điểm trên màn hình. Nhấn "Lưu bảng điểm" nếu muốn ghi nhận.',
        'Cleared score inputs on screen. Click "Save Grades" to persist changes.',
      ),
      'info',
    );
  };

  const handleModeSwitch = async (nextMode) => {
    setMode(nextMode);
    setConfirmReset(false);
    if (user && profile?.user_mode !== nextMode) {
      try {
        await supabase.from('profiles').update({ user_mode: nextMode }).eq('id', user.id);
        await refreshProfile?.();
      } catch {
        /* non-blocking mode preference sync */
      }
    }
  };

  const handleSaveUniversity = async () => {
    if (!user) {
      showToast(
        pick(
          'Vui lòng đăng nhập để lưu bảng điểm Đại học.',
          'Please sign in to save your University transcript.',
        ),
        'warning',
      );
      return;
    }

    // Validate grades 0..10
    for (const row of uniSubjects) {
      if (row.grade !== '' && row.grade != null) {
        const g = Number(row.grade);
        const shownName = resolveUniCourseName(row, lang) || pick('Chưa đặt tên', 'Untitled course');
        if (!Number.isFinite(g) || g < 0 || g > 10) {
          showToast(
            pick(
              `Điểm môn "${shownName}" phải nằm trong khoảng 0.0 – 10.0.`,
              `Grade for "${shownName}" must be between 0.0 and 10.0.`,
            ),
            'error',
          );
          return;
        }
      }
    }

    const cleanTargetGpa = clampNumeric32(parsedTargetGpa4, 4.0);
    setIsSaving(true);
    try {
      let activeSemId = selectedSemId;
      if (!activeSemId) {
        const defaultName =
          semesters.length === 0
            ? pick('Học kỳ 1', 'Semester 1')
            : pick(`Học kỳ ${semesters.length + 1}`, `Semester ${semesters.length + 1}`);
        const { data: createdSem, error: semCreateErr } = await supabase
          .from('semesters')
          .insert([
            {
              user_id: user.id,
              name: defaultName,
              status: 'in_progress',
              total_credits: 0,
              gpa: 0,
            },
          ])
          .select('id')
          .single();

        if (semCreateErr) throw semCreateErr;
        activeSemId = createdSem.id;
        setSelectedSemId(activeSemId);
      }

      const semGpaValue = clampNumeric32(semResult.gpa4 ?? 0, 4.0);
      const semStatus = semResult.credits > 0 ? 'completed' : 'in_progress';

      const { error: semUpdateErr } = await supabase
        .from('semesters')
        .update({
          gpa: semGpaValue,
          total_credits: semResult.credits,
          status: semStatus,
        })
        .eq('id', activeSemId)
        .eq('user_id', user.id);

      if (semUpdateErr) throw semUpdateErr;

      // Prepare valid rows to persist
      const nonEmptyRows = uniSubjects.filter((s) => {
        const effectiveName = resolveUniCourseName(s, lang).trim();
        return effectiveName !== '' || (s.grade !== '' && s.grade != null);
      });

      // Delete removed persisted rows while preserving existing subject UUIDs
      const existingIdsForSem = allUniSubjects
        .filter((s) => s.semester_id === activeSemId)
        .map((s) => s.id);
      const keptPersistedIds = new Set(
        nonEmptyRows
          .filter((s) => s.persisted && UUID_REGEX.test(String(s.id)))
          .map((s) => s.id),
      );
      const idsToDelete = existingIdsForSem.filter((id) => !keptPersistedIds.has(id));

      if (idsToDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('subjects')
          .delete()
          .in('id', idsToDelete)
          .eq('user_id', user.id);
        if (delErr) throw delErr;
      }

      const existingPayload = [];
      const newPayload = [];

      nonEmptyRows.forEach((s, idx) => {
        const hasGrade = s.grade !== '' && s.grade != null && Number.isFinite(Number(s.grade));
        const grade10 = hasGrade ? Math.round(Number(s.grade) * 10) / 10 : null;
        const effectiveName =
          resolveUniCourseName(s, lang).trim() ||
          pick(`Học phần ${idx + 1}`, `Course ${idx + 1}`);
        const baseRecord = {
          user_id: user.id,
          semester_id: activeSemId,
          name: effectiveName,
          code: s.code?.trim() || null,
          credits: Math.max(1, Math.round(Number(s.credits) || 1)),
          grade_number: grade10,
          grade_letter: hasGrade ? toLetterGrade(grade10) : null,
          status: hasGrade ? 'completed' : 'in_progress',
          progress_percentage: hasGrade ? 100 : 0,
        };

        if (s.persisted && UUID_REGEX.test(String(s.id))) {
          existingPayload.push({ id: s.id, ...baseRecord });
        } else {
          newPayload.push(baseRecord);
        }
      });

      if (existingPayload.length > 0) {
        const { error: upsertErr } = await supabase
          .from('subjects')
          .upsert(existingPayload, { onConflict: 'id' });
        if (upsertErr) throw upsertErr;
      }

      if (newPayload.length > 0) {
        const { error: insErr } = await supabase.from('subjects').insert(newPayload);
        if (insErr) throw insErr;
      }

      const cumulativeToSave = clampNumeric32(
        liveCumulative.gpa4 ?? semResult.gpa4 ?? 0,
        4.0,
      );

      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          current_gpa: cumulativeToSave,
          target_gpa: cleanTargetGpa,
          user_mode: 'university',
        })
        .eq('id', user.id);

      if (profErr) throw profErr;

      await loadUniversityData(activeSemId);
      await refreshProfile?.();
      showToast(
        pick(
          'Đã lưu bảng điểm học kỳ và đồng bộ GPA tích luỹ!',
          'Saved semester courses and synced cumulative GPA!',
        ),
        'success',
      );
    } catch (err) {
      console.error('Failed to save university GPA:', err);
      showToast(
        pick('Không thể lưu bảng điểm: ', 'Could not save transcript: ') + err.message,
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStudent = async () => {
    if (!user) {
      showToast(
        pick(
          'Vui lòng đăng nhập để lưu bảng điểm THPT & mục tiêu.',
          'Please sign in to save your High School transcript & targets.',
        ),
        'warning',
      );
      return;
    }

    for (const row of thptSubjects) {
      if (row.score !== '' && row.score != null) {
        const sc = Number(row.score);
        const shownName = resolveThptSubjectName(row, lang) || pick('Chưa đặt tên', 'Untitled subject');
        if (!Number.isFinite(sc) || sc < 0 || sc > 10) {
          showToast(
            pick(
              `Điểm môn "${shownName}" phải nằm trong khoảng 0.0 – 10.0.`,
              `Score for "${shownName}" must be between 0.0 and 10.0.`,
            ),
            'error',
          );
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const validRows = thptSubjects
        .filter((r) => {
          const effectiveName = resolveThptSubjectName(r, lang).trim();
          return effectiveName !== '' && r.score !== '' && r.score != null;
        })
        .map((r) => ({
          user_id: user.id,
          subject: r.starterKey ? getSubjectLabel(r.starterKey, 'vi') : r.name.trim(),
          credits: Math.max(1, Math.round(Number(r.credits) || 1)),
          score: Math.round(Number(r.score) * 100) / 100,
        }));

      const { error: delErr } = await supabase
        .from('user_grades')
        .delete()
        .eq('user_id', user.id);
      if (delErr) throw delErr;

      if (validRows.length > 0) {
        const { error: insErr } = await supabase.from('user_grades').insert(validRows);
        if (insErr) throw insErr;
      }

      const rawScores = admissionScoresRef.current ?? profile?.admission_scores ?? {};
      const migratedProfile = migrateLegacyScores(rawScores);
      const allCombosMap = allComboScores(thptCanonicalMap);
      const comboVals = Object.values(allCombosMap);
      const bestComboTotal =
        comboVals.length > 0 ? Math.round(Math.max(...comboVals) * 100) / 100 : null;
      const updatedAdmissionScores =
        Object.keys(thptCanonicalMap).length > 0
          ? saveScoreEntry(migratedProfile, 'hocba', {
              status: 'actual',
              mode: 'gia-tri-don',
              subjects: thptCanonicalMap,
              byGroup: allCombosMap,
              total: bestComboTotal,
              gpa10: thptResult.gpa10 ?? null,
            })
          : migratedProfile;
      admissionScoresRef.current = updatedAdmissionScores;

      const cleanThpt = Math.max(0, Math.min(30, Number(targetThpt) || 25.5));
      const cleanDgnl = Math.max(0, Math.min(1500, Math.round(Number(targetDgnl) || 900)));

      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          target_thpt: cleanThpt,
          target_dgnl: cleanDgnl,
          user_mode: 'student',
          admission_scores: updatedAdmissionScores,
        })
        .eq('id', user.id);

      if (profErr) throw profErr;

      await loadStudentData();
      await refreshProfile?.();
      showToast(
        pick(
          'Đã lưu bảng điểm học bạ và đồng bộ hồ sơ xét tuyển!',
          'Saved high school transcript and synced admission profile!',
        ),
        'success',
      );
    } catch (err) {
      console.error('Failed to save high school transcript:', err);
      showToast(
        pick('Không thể lưu bảng điểm THPT: ', 'Could not save transcript: ') + err.message,
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (mode === 'university') {
      handleSaveUniversity();
    } else {
      handleSaveStudent();
    }
  };

  const selectedSemesterObj = semesters.find((s) => s.id === selectedSemId) || null;
  const gpaScaleMeta = getGpaScale(scaleId, lang);

  return (
    <div className="bg-background font-sans text-foreground min-h-full flex flex-col justify-between pb-24">
      <div className="max-w-4xl mx-auto w-full">
        {/* Sticky Dual-Theme App Bar */}
        <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={pick('Quay lại', 'Go back')}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface-alt hover:bg-surface transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-foreground" aria-hidden="true">
                arrow_back
              </span>
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-extrabold tracking-tight text-foreground truncate">
                {pick('Bàn Tính Điểm Số', 'Academic GPA Calculator')}
              </h1>
              <p className="text-[11px] text-secondary-text truncate">
                {mode === 'university'
                  ? pick(
                      'GPA Đại học (Hệ 4.0 & Hệ 10) · Quản lý học kỳ',
                      'University GPA (4.0 & 10-pt Scales) · Semester Manager',
                    )
                  : pick(
                      'Học bạ THPT · Tổ hợp xét tuyển · Mục tiêu ĐH',
                      'High School Transcript · 3-Subject Combos · Admission Goals',
                    )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmReset((v) => !v)}
              aria-label={pick('Đặt lại điểm trên màn hình', 'Reset scores on screen')}
              title={pick('Đặt lại điểm trên màn hình', 'Reset scores on screen')}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface-alt hover:bg-surface transition-colors text-secondary-text hover:text-foreground cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                restart_alt
              </span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-arena btn-arena-primary btn-arena-sm cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {isSaving ? 'hourglass_empty' : 'save'}
              </span>
              <span>
                {isSaving
                  ? pick('Đang lưu...', 'Saving...')
                  : pick('Lưu bảng điểm', 'Save Grades')}
              </span>
            </button>
          </div>
        </header>

        {/* Cross-page Navigation Tabs */}
        <nav
          aria-label={pick('Điều hướng công cụ học thuật', 'Academic tools navigation')}
          className="px-4 pt-4"
        >
          <div className="flex border-b border-border gap-6 overflow-x-auto no-scrollbar">
            <button
              type="button"
              aria-current="page"
              className="pb-3 border-b-2 border-primary text-primary font-display font-bold text-sm whitespace-nowrap flex items-center gap-2 cursor-pointer"
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
              onClick={() => navigate('/schools')}
              className="pb-3 border-b-2 border-transparent text-secondary-text hover:text-foreground font-display font-semibold text-sm whitespace-nowrap flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                account_balance
              </span>
              {t('academics.nav.schools')}
            </button>
          </div>
        </nav>

        <main className="flex-1 px-4 py-5 space-y-5">
          {/* Guest Notice Banner */}
          {!user && (
            <div className="paper-card border border-gold/60 bg-gold-soft/40 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-foreground">
                <span className="material-symbols-outlined text-accent text-lg" aria-hidden="true">
                  info
                </span>
                <span>
                  {pick(
                    'Bạn đang dùng bàn tính ở chế độ khách. Đăng nhập để lưu các học kỳ và đồng bộ mục tiêu vào hồ sơ.',
                    'You are using the calculator in guest mode. Sign in to save semesters and sync academic goals to your profile.',
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                {pick('Đăng nhập ngay', 'Sign in now')}
              </button>
            </div>
          )}

          {/* Inline Reset Confirmation Banner */}
          {confirmReset && (
            <div className="paper-card border border-primary/40 bg-primary-soft/50 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-foreground">
                {pick(
                  'Xoá trắng các ô điểm đang nhập trên màn hình hiện tại? (Chưa ảnh hưởng dữ liệu đã lưu)',
                  'Clear all score inputs currently on screen? (Saved database records remain untouched)',
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmResetScores}
                  className="px-3.5 h-9 rounded-xl bg-primary text-on-primary border border-primary-hover text-xs font-bold cursor-pointer"
                >
                  {pick('Đặt lại điểm', 'Clear Scores')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-3.5 h-9 rounded-xl bg-surface border border-border text-xs font-semibold text-secondary-text hover:text-foreground cursor-pointer"
                >
                  {pick('Huỷ', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Dual-Mode Switcher: Sinh viên ĐH vs Học sinh THPT */}
          <div
            role="tablist"
            aria-label={pick('Chế độ tính điểm', 'Calculator mode')}
            className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-surface-alt border border-border"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'university'}
              onClick={() => handleModeSwitch('university')}
              className={`py-2.5 px-3 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mode === 'university'
                  ? 'bg-primary text-on-primary border border-primary-hover shadow-xs'
                  : 'border border-transparent text-secondary-text hover:text-foreground hover:bg-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                workspace_premium
              </span>
              <span>{t('academics.modes.university')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'student'}
              onClick={() => handleModeSwitch('student')}
              className={`py-2.5 px-3 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mode === 'student'
                  ? 'bg-primary text-on-primary border border-primary-hover shadow-xs'
                  : 'border border-transparent text-secondary-text hover:text-foreground hover:bg-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                menu_book
              </span>
              <span>{t('academics.modes.highSchool')}</span>
            </button>
          </div>

          {mode === 'university' ? (
            <>
              {/* UNIVERSITY SUMMARY & SEMESTER MANAGER */}
              <section className="imperial-frame border border-border-strong p-5 relative overflow-hidden space-y-4">
                <span
                  aria-hidden="true"
                  className="hanzi-watermark absolute -top-2 right-4 text-7xl font-bold text-accent/8 select-none pointer-events-none"
                >
                  算
                </span>

                {/* Semester Selector Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <select
                        aria-label={pick('Chọn học kỳ Đại học', 'Select university semester')}
                        value={selectedSemId}
                        onChange={(e) => handleSelectSemester(e.target.value)}
                        className="appearance-none h-10 bg-surface text-foreground font-display font-bold text-sm pl-3.5 pr-9 rounded-xl border border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary cursor-pointer"
                      >
                        {semesters.length === 0 ? (
                          <option value="">
                            {pick('Học kỳ 1 (Chưa lưu)', 'Semester 1 (Unsaved draft)')}
                          </option>
                        ) : (
                          semesters.map((sem) => (
                            <option key={sem.id} value={sem.id}>
                              {sem.name} · GPA {fmt(sem.gpa ?? 0, 2, locale)}
                            </option>
                          ))
                        )}
                      </select>
                      <span
                        className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-secondary-text"
                        aria-hidden="true"
                      >
                        expand_more
                      </span>
                    </div>

                    {user && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewSemForm((v) => !v);
                          setIsRenamingSem(false);
                          setConfirmDeleteSem(false);
                        }}
                        className="h-10 px-3 rounded-xl bg-surface border border-border hover:border-primary text-xs font-bold text-primary flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                          add
                        </span>
                        {pick('Kỳ mới', 'New Term')}
                      </button>
                    )}

                    {user && selectedSemesterObj && !isRenamingSem && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setRenameSemValue(selectedSemesterObj.name);
                            setIsRenamingSem(true);
                            setShowNewSemForm(false);
                            setConfirmDeleteSem(false);
                          }}
                          aria-label={pick('Đổi tên học kỳ', 'Rename semester')}
                          title={pick('Đổi tên học kỳ', 'Rename semester')}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border hover:border-border-strong text-secondary-text hover:text-foreground transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteSem((v) => !v);
                            setShowNewSemForm(false);
                          }}
                          aria-label={pick('Xoá học kỳ này', 'Delete this semester')}
                          title={pick('Xoá học kỳ này', 'Delete this semester')}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border hover:border-primary/40 text-secondary-text hover:text-primary transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                            delete
                          </span>
                        </button>
                      </>
                    )}
                  </div>

                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${uniRank.color}`}>
                    {pick('Học lực:', 'Standing:')} {uniRank.label}
                  </span>
                </div>

                {/* Inline New Semester Input */}
                {showNewSemForm && (
                  <div className="relative z-10 flex flex-wrap gap-2 p-3 rounded-xl bg-paper/90 border border-border">
                    <input
                      type="text"
                      value={newSemName}
                      onChange={(e) => setNewSemName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateSemester();
                        if (e.key === 'Escape') setShowNewSemForm(false);
                      }}
                      placeholder={pick(
                        'Tên học kỳ mới (VD: HK1 Năm 2 / HK251)...',
                        'New semester name (e.g. Fall Year 2 / Sem 1)...',
                      )}
                      aria-label={pick('Tên học kỳ mới', 'New semester name')}
                      className="flex-1 min-w-[200px] h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={handleCreateSemester}
                      disabled={isCreatingSem}
                      className="btn-arena btn-arena-primary btn-arena-sm cursor-pointer"
                    >
                      {isCreatingSem
                        ? pick('Đang tạo...', 'Creating...')
                        : pick('Tạo học kỳ', 'Create Term')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewSemForm(false)}
                      className="h-10 px-3 rounded-xl border border-border bg-surface text-xs font-semibold text-secondary-text hover:text-foreground cursor-pointer"
                    >
                      {pick('Đóng', 'Close')}
                    </button>
                  </div>
                )}

                {/* Inline Rename Semester Input */}
                {isRenamingSem && (
                  <div className="relative z-10 flex flex-wrap gap-2 p-3 rounded-xl bg-paper/90 border border-border">
                    <input
                      type="text"
                      value={renameSemValue}
                      onChange={(e) => setRenameSemValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSemester();
                        if (e.key === 'Escape') setIsRenamingSem(false);
                      }}
                      placeholder={pick('Nhập tên mới cho học kỳ...', 'Enter new semester name...')}
                      aria-label={pick('Tên mới cho học kỳ', 'New semester name')}
                      className="flex-1 min-w-[200px] h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={handleRenameSemester}
                      className="btn-arena btn-arena-primary btn-arena-sm cursor-pointer"
                    >
                      {pick('Lưu tên', 'Save Name')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRenamingSem(false)}
                      className="h-10 px-3 rounded-xl border border-border bg-surface text-xs font-semibold text-secondary-text hover:text-foreground cursor-pointer"
                    >
                      {pick('Huỷ', 'Cancel')}
                    </button>
                  </div>
                )}

                {/* Inline Delete Semester Confirmation */}
                {confirmDeleteSem && selectedSemesterObj && (
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-primary-soft border border-primary/35">
                    <p className="text-xs font-semibold text-foreground">
                      {pick(
                        <>
                          Xoá vĩnh viễn <strong>{selectedSemesterObj.name}</strong> cùng toàn bộ học
                          phần trong kỳ này?
                        </>,
                        <>
                          Permanently delete <strong>{selectedSemesterObj.name}</strong> and all its
                          courses?
                        </>,
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteSemester}
                        disabled={isSaving}
                        className="px-3.5 h-9 rounded-xl bg-primary text-on-primary border border-primary-hover text-xs font-bold cursor-pointer"
                      >
                        {pick('Xoá học kỳ', 'Delete Term')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSem(false)}
                        className="px-3.5 h-9 rounded-xl bg-surface border border-border text-xs font-semibold text-secondary-text hover:text-foreground cursor-pointer"
                      >
                        {pick('Không', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}

                {/* GPA Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                  <div className="p-3.5 rounded-xl bg-paper/80 border border-border">
                    <p className="text-[11px] text-secondary-text font-semibold uppercase tracking-wider mb-1">
                      {pick('GPA Học Kỳ (Hệ 4.0)', 'Semester GPA (4.0 Scale)')}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-3xl font-extrabold text-primary tabular">
                        {fmt(semResult.gpa4, 2, locale)}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        / {fmt(4, 2, locale)}
                      </span>
                    </div>
                    <p className="text-[11px] text-secondary-text mt-1 tabular">
                      {pick('Hệ 10:', '10-pt:')}{' '}
                      <strong className="text-foreground">{fmt(semResult.gpa10, 2, locale)}</strong>{' '}
                      · {semResult.credits} {pick('tín chỉ', 'credits')}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-paper/80 border border-border">
                    <p className="text-[11px] text-secondary-text font-semibold uppercase tracking-wider mb-1">
                      {pick('GPA Tích Luỹ Toàn Khoá', 'Cumulative GPA')}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-3xl font-extrabold text-jade tabular">
                        {fmt(liveCumulative.gpa4, 2, locale)}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        / {fmt(4, 2, locale)}
                      </span>
                    </div>
                    <p className="text-[11px] text-secondary-text mt-1 tabular">
                      {pick('Hệ 10:', '10-pt:')}{' '}
                      <strong className="text-foreground">
                        {fmt(liveCumulative.gpa10, 2, locale)}
                      </strong>{' '}
                      · {liveCumulative.credits} {pick('TC tích luỹ', 'earned credits')}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-paper/80 border border-border flex flex-col justify-between">
                    <p className="text-[11px] text-secondary-text font-semibold uppercase tracking-wider">
                      {pick('Tổng Quan Học Kỳ', 'Term Overview')}
                    </p>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-xs text-secondary-text">
                        {pick('Số kỳ đã lưu:', 'Saved terms:')}
                      </span>
                      <span className="font-display text-lg font-extrabold text-foreground tabular">
                        {semesters.length}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-secondary-text">
                        {pick('Môn trong kỳ:', 'Courses in term:')}
                      </span>
                      <span className="font-display text-sm font-bold text-foreground tabular">
                        {uniSubjects.length} {pick('học phần', 'courses')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative z-10">
                  <ProgressBar
                    value={activeGpaForTarget}
                    max={4}
                    tone="primary"
                    label={pick('Tiến độ thang chuẩn 4.0', '4.0 Scale Progress')}
                    sublabel={`${fmt(activeGpaForTarget, 2, locale)} / ${fmt(4, 2, locale)}`}
                  />
                </div>
              </section>

              {/* UNIVERSITY TARGET GOAL & GPA PLANNER / SIMULATOR */}
              <section className="paper-card border border-border p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-gold-soft border border-gold flex items-center justify-center text-accent shrink-0">
                      <span className="material-symbols-outlined" aria-hidden="true">
                        flag
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-display font-bold text-foreground">
                        {pick(
                          'Hoạch định & Mô phỏng GPA mục tiêu (Hệ 4.0)',
                          'Target GPA Planner & Credit Simulator (4.0 Scale)',
                        )}
                      </h2>
                      <p className="text-xs text-secondary-text mt-0.5">
                        {activeCreditsForTarget === 0 ? (
                          <span>
                            {pick(
                              'Nhập điểm hệ 10 các học phần bên dưới để mô phỏng lộ trình GPA.',
                              'Enter 10-pt course grades below to simulate your cumulative GPA trajectory.',
                            )}
                          </span>
                        ) : isUniTargetReached ? (
                          <span className="text-completed font-semibold">
                            {pick(
                              'Xuất sắc! GPA hiện tại đã chạm/vượt ngưỡng mục tiêu đề ra.',
                              'On track! Your current GPA meets or exceeds your target.',
                            )}
                          </span>
                        ) : (
                          <span>
                            {pick('Còn cách mục tiêu ', 'Currently ')}
                            <span className="text-primary font-bold tabular">
                              {fmt(uniTargetDiff, 2, locale)}
                            </span>
                            {pick(' điểm (hệ 4.0).', ' pts below your 4.0 target.')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:block shrink-0">
                    <RankSeal
                      size="sm"
                      variant="gold"
                      icon="emoji_events"
                      label={pick('Khoa Bảng', 'Honors')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border">
                  <div className="p-3 rounded-xl bg-surface-alt border border-border flex items-center justify-between gap-3">
                    <div>
                      <label
                        htmlFor="target-gpa4-input"
                        className="block text-xs font-bold text-foreground"
                      >
                        {pick('GPA mục tiêu (/ 4.00)', 'Target GPA (/ 4.00)')}
                      </label>
                      <span className="text-[11px] text-secondary-text">
                        {pick('Ví dụ: 3.20 (Giỏi) · 3.60 (Xuất sắc)', 'e.g. 3.20 (Very Good) · 3.60 (Distinction)')}
                      </span>
                    </div>
                    <input
                      id="target-gpa4-input"
                      type="number"
                      step="0.05"
                      min="0"
                      max="4"
                      value={targetGpa4}
                      onChange={(e) => setTargetGpa4(e.target.value)}
                      className="w-24 h-10 rounded-xl border border-border bg-surface px-3 text-sm font-bold text-center text-primary tabular focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary shrink-0"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-surface-alt border border-border flex items-center justify-between gap-3">
                    <div>
                      <label
                        htmlFor="planned-credits-input"
                        className="block text-xs font-bold text-foreground"
                      >
                        {pick('Số tín chỉ dự kiến học tiếp', 'Planned Next Credits')}
                      </label>
                      <span className="text-[11px] text-secondary-text">
                        {requiredFutureGpa4 <= 0
                          ? pick(
                              'Đủ duy trì mục tiêu ngay cả ở mức đạt cơ bản',
                              'Target maintained with passing coursework',
                            )
                          : requiredFutureGpa4 > 4.0
                            ? pick(
                                `Tối đa đạt ${fmt(maxReachableGpa4, 2, locale)} sau ${parsedPlannedCredits} TC — cần thêm tín chỉ`,
                                `Max reachable is ${fmt(maxReachableGpa4, 2, locale)} in ${parsedPlannedCredits} cr — add more credits`,
                              )
                            : pick(
                                `Cần TB tối thiểu ${fmt(requiredFutureGpa4, 2, locale)} / 4.00 trong ${parsedPlannedCredits} TC tới`,
                                `Need ≥ ${fmt(requiredFutureGpa4, 2, locale)} / 4.00 across next ${parsedPlannedCredits} credits`,
                              )}
                      </span>
                    </div>
                    <input
                      id="planned-credits-input"
                      type="number"
                      step="1"
                      min="1"
                      max="150"
                      value={plannedCredits}
                      onChange={(e) => setPlannedCredits(e.target.value)}
                      className="w-24 h-10 rounded-xl border border-border bg-surface px-3 text-sm font-bold text-center text-jade tabular focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary shrink-0"
                    />
                  </div>
                </div>
              </section>

              {/* UNIVERSITY COURSES TABLE */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-extrabold text-foreground">
                    {pick(
                      `Học phần trong kỳ (${uniSubjects.length})`,
                      `Courses in Semester (${uniSubjects.length})`,
                    )}
                  </h2>
                  <button
                    type="button"
                    onClick={addUniCourse}
                    className="text-xs font-bold flex items-center gap-1 text-primary hover:underline cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      add_circle
                    </span>
                    {pick('Thêm học phần', 'Add Course')}
                  </button>
                </div>

                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 text-xs font-bold text-secondary-text">
                  <div className="col-span-5">{pick('Tên học phần', 'Course Name')}</div>
                  <div className="col-span-2 text-center">{pick('Tín chỉ', 'Credits')}</div>
                  <div className="col-span-2 text-center">{pick('Điểm hệ 10', '10-pt Grade')}</div>
                  <div className="col-span-2 text-center">{pick('Quy đổi', '4.0 / Letter')}</div>
                  <div className="col-span-1"></div>
                </div>

                {isLoading ? (
                  <div className="space-y-2.5">
                    <ListItemSkeleton />
                    <ListItemSkeleton />
                    <ListItemSkeleton />
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {uniSubjects.map((course, idx) => {
                      const letter = toLetterGrade(course.grade);
                      const gpa4Val =
                        course.grade === '' || course.grade == null
                          ? null
                          : toGpa4(course.grade, scaleId);
                      const displayCourseName = resolveUniCourseName(course, lang);
                      return (
                        <div
                          key={course.id}
                          className="grid grid-cols-12 gap-2 items-center paper-card border border-border p-3 focus-within:border-primary transition-all"
                        >
                          <div className="col-span-12 sm:col-span-5 flex items-center gap-2">
                            <span
                              className="material-symbols-outlined text-accent text-lg shrink-0"
                              aria-hidden="true"
                            >
                              menu_book
                            </span>
                            <input
                              list="uni-subjects"
                              type="text"
                              placeholder={pick(
                                `Học phần ${idx + 1} (VD: Giải tích 1)...`,
                                `Course ${idx + 1} (e.g. Calculus I)...`,
                              )}
                              aria-label={pick(
                                `Tên học phần ${idx + 1}`,
                                `Course ${idx + 1} name`,
                              )}
                              value={displayCourseName}
                              onChange={(e) => updateUniCourse(course.id, 'name', e.target.value)}
                              className="w-full h-10 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary placeholder:text-muted-foreground"
                            />
                          </div>

                          <div className="col-span-4 sm:col-span-2">
                            <label className="sm:hidden block text-[10px] text-secondary-text mb-1 text-center">
                              {pick('Tín chỉ', 'Credits')}
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              aria-label={pick(
                                `Số tín chỉ ${displayCourseName || idx + 1}`,
                                `Credits for ${displayCourseName || idx + 1}`,
                              )}
                              value={course.credits}
                              onChange={(e) => updateUniCourse(course.id, 'credits', e.target.value)}
                              className="w-full h-10 rounded-xl border border-border bg-surface px-3 text-center text-sm font-medium text-foreground tabular focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                            />
                          </div>

                          <div className="col-span-4 sm:col-span-2">
                            <label className="sm:hidden block text-[10px] text-secondary-text mb-1 text-center">
                              {pick('Điểm hệ 10', '10-pt Grade')}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              placeholder={pick('Chưa có', 'Pending')}
                              aria-label={pick(
                                `Điểm hệ 10 ${displayCourseName || idx + 1}`,
                                `10-pt grade for ${displayCourseName || idx + 1}`,
                              )}
                              value={course.grade}
                              onChange={(e) => updateUniCourse(course.id, 'grade', e.target.value)}
                              className="w-full h-10 rounded-xl border border-border bg-surface px-3 text-center text-sm font-bold text-primary tabular focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary placeholder:text-muted-foreground placeholder:font-normal"
                            />
                          </div>

                          <div className="col-span-3 sm:col-span-2 flex flex-col items-center justify-center">
                            <span className="sm:hidden text-[10px] text-secondary-text mb-1">
                              {pick('Hệ 4', '4.0')}
                            </span>
                            {letter ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-jade-soft text-jade border border-jade-border tabular">
                                {letter} · {fmt(gpa4Val, 1, locale)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground tabular">—</span>
                            )}
                          </div>

                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => removeUniCourse(course.id)}
                              aria-label={pick(
                                `Xoá học phần ${displayCourseName || idx + 1}`,
                                `Remove course ${displayCourseName || idx + 1}`,
                              )}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                                delete
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={addUniCourse}
                  className="w-full py-3 border-2 border-dashed border-border-strong rounded-xl text-secondary-text hover:text-primary hover:border-primary hover:bg-primary-soft/40 transition-all flex items-center justify-center gap-2 text-sm font-bold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">
                    add
                  </span>
                  {pick('Thêm học phần mới', 'Add New Course')}
                </button>

                <p className="text-[11px] text-secondary-text leading-relaxed px-1">
                  {pick(
                    'Học phần để trống ô điểm sẽ được lưu ở trạng thái đang học và không bị tính là 0 điểm.',
                    'Courses left blank are saved as in-progress and excluded from GPA rather than counted as 0.',
                  )}{' '}
                  {gpaScaleMeta.displaySourceNote}
                </p>
              </section>
            </>
          ) : (
            <>
              {/* HIGH SCHOOL (THPT) SUMMARY CARD */}
              <section className="imperial-frame border border-border-strong p-5 relative overflow-hidden space-y-4">
                <span
                  aria-hidden="true"
                  className="hanzi-watermark absolute -top-2 right-4 text-7xl font-bold text-accent/8 select-none pointer-events-none"
                >
                  榜
                </span>

                <div className="flex flex-wrap items-center justify-between gap-2 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl" aria-hidden="true">
                      workspace_premium
                    </span>
                    <span className="font-display font-bold text-sm text-foreground">
                      {pick(
                        'Tổng hợp Học bạ & Tổ hợp Xét tuyển THPT',
                        'High School Transcript & Admission Combo Summary',
                      )}
                    </span>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${thptRank.color}`}>
                    {pick('Học lực:', 'Standing:')} {thptRank.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                  <div className="p-3.5 rounded-xl bg-paper/80 border border-border">
                    <p className="text-[11px] text-secondary-text font-semibold uppercase tracking-wider mb-1">
                      {pick('Điểm TB Học Bạ', 'Transcript Average')}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-3xl font-extrabold text-primary tabular">
                        {fmt(thptResult.gpa10, 2, locale)}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        / {fmt(10, 1, locale)}
                      </span>
                    </div>
                    <p className="text-[11px] text-secondary-text mt-1 tabular">
                      {pick('Tổng hệ số:', 'Total weight:')}{' '}
                      <strong className="text-foreground">{thptResult.credits}</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-paper/80 border border-border">
                    <p className="text-[11px] text-secondary-text font-semibold uppercase tracking-wider mb-1">
                      {pick('Tổ Hợp Cao Nhất', 'Best 3-Subject Combo')}
                    </p>
                    {bestCombo ? (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-display text-3xl font-extrabold text-jade tabular">
                            {fmt(bestCombo.score, 2, locale)}
                          </span>
                          <span className="text-xs font-bold text-jade px-2 py-0.5 rounded-full bg-jade-soft border border-jade-border">
                            {bestCombo.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-secondary-text mt-1 truncate">
                          {bestCombo.subjectLabels}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-display text-2xl font-extrabold text-muted-foreground tabular">
                          —
                        </p>
                        <p className="text-[11px] text-secondary-text mt-1">
                          {pick(
                            'Nhập tối thiểu 3 môn chuẩn để tính tổ hợp',
                            'Enter at least 3 standard subjects to compute combos',
                          )}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-paper/80 border border-border flex flex-col justify-between">
                    <p className="text-[11px] text-secondary-text font-semibold uppercase tracking-wider">
                      {pick('Đồng Bộ Xét Tuyển', 'Admission Sync')}
                    </p>
                    <p className="text-xs text-secondary-text leading-snug my-1">
                      {pick(
                        'Điểm học bạ tự động đồng bộ sang công cụ tính điểm & tìm trường ĐH.',
                        'Transcript scores automatically sync with Admission Scores & School Finder.',
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/admission')}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>
                        {pick('Mở máy tính ĐGNL / THPTQG', 'Open Exam Score Calculator')}
                      </span>
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">
                        arrow_forward
                      </span>
                    </button>
                  </div>
                </div>

                <div className="relative z-10">
                  <ProgressBar
                    value={thptResult.gpa10 ?? 0}
                    max={10}
                    tone="primary"
                    label={pick('Thang điểm 10', '10-Point Scale')}
                    sublabel={`${fmt(thptResult.gpa10, 2, locale)} / 10`}
                  />
                </div>
              </section>

              {/* THPT TARGETS CARD (target_thpt & target_dgnl) */}
              <section className="paper-card border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gold-soft border border-gold flex items-center justify-center text-accent shrink-0">
                      <span className="material-symbols-outlined" aria-hidden="true">
                        ads_click
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-display font-bold text-foreground">
                        {pick(
                          'Mục tiêu Kỳ thi THPTQG & Đánh giá năng lực',
                          'National Exam & Competency Assessment Targets',
                        )}
                      </h2>
                      <p className="text-xs text-secondary-text">
                        {pick(
                          'Lưu trực tiếp vào hồ sơ học giả để theo dõi tiến độ vượt vũ môn',
                          'Saved directly to your scholar profile to track admission readiness',
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:block shrink-0">
                    <RankSeal
                      size="sm"
                      variant="gold"
                      icon="military_tech"
                      label={pick('Mục tiêu', 'Targets')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-surface-alt border border-border flex items-center justify-between gap-3">
                    <div>
                      <label
                        htmlFor="target-thpt-input"
                        className="block text-xs font-bold text-foreground"
                      >
                        {pick('Mục tiêu Tổ hợp THPTQG (/30)', 'National Exam Combo Target (/30)')}
                      </label>
                      <span className="text-[11px] text-secondary-text">
                        {bestCombo == null
                          ? pick(
                              'Nhập đủ 3 môn của tổ hợp để so sánh',
                              'Enter all 3 subjects in a combo to compare',
                            )
                          : isThptTargetReached
                            ? pick('Đã đạt/vượt mục tiêu tổ hợp!', 'Combo target reached!')
                            : pick(
                                `Còn thiếu ${fmt(thptTargetDiff, 2, locale)} điểm so với tổ hợp ${bestCombo.code}`,
                                `${fmt(thptTargetDiff, 2, locale)} pts below target on ${bestCombo.code}`,
                              )}
                      </span>
                    </div>
                    <input
                      id="target-thpt-input"
                      type="number"
                      step="0.25"
                      min="0"
                      max="30"
                      value={targetThpt}
                      onChange={(e) => setTargetThpt(e.target.value)}
                      className="w-24 h-10 rounded-xl border border-border bg-surface px-3 text-sm font-bold text-center text-primary tabular focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary shrink-0"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-surface-alt border border-border flex items-center justify-between gap-3">
                    <div>
                      <label
                        htmlFor="target-dgnl-input"
                        className="block text-xs font-bold text-foreground"
                      >
                        {pick('Mục tiêu ĐGNL (HSA / V-ACT)', 'Competency Target (HSA / V-ACT)')}
                      </label>
                      <span className="text-[11px] text-secondary-text">
                        {pick(
                          'Ví dụ: 100+ (HSA) hoặc 900+ (V-ACT)',
                          'e.g. 100+ (HSA /150) or 900+ (V-ACT /1200)',
                        )}
                      </span>
                    </div>
                    <input
                      id="target-dgnl-input"
                      type="number"
                      step="5"
                      min="0"
                      max="1500"
                      value={targetDgnl}
                      onChange={(e) => setTargetDgnl(e.target.value)}
                      className="w-24 h-10 rounded-xl border border-border bg-surface px-3 text-sm font-bold text-center text-jade tabular focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary shrink-0"
                    />
                  </div>
                </div>
              </section>

              {/* LIVE 3-SUBJECT COMBINATIONS PREVIEW */}
              {thptCombos.length > 0 && (
                <section className="paper-card border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-sm font-extrabold text-foreground">
                      {pick(
                        `Điểm Tổ Hợp 3 Môn Tự Động (${thptCombos.length} tổ hợp)`,
                        `Auto-Computed 3-Subject Combos (${thptCombos.length} eligible)`,
                      )}
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigate('/schools')}
                      className="text-xs font-bold text-primary hover:underline cursor-pointer shrink-0"
                    >
                      {pick('Tra cứu điểm chuẩn', 'Browse Cutoffs')}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {thptCombos.slice(0, 6).map((item) => (
                      <div
                        key={item.code}
                        className="p-2.5 rounded-xl bg-surface-alt border border-border flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-display font-extrabold text-primary block">
                            {pick(`Khối ${item.code}`, `Group ${item.code}`)}
                          </span>
                          <span className="text-[10px] text-secondary-text block truncate">
                            {item.subjectLabels}
                          </span>
                        </div>
                        <span className="font-display text-base font-extrabold text-foreground tabular shrink-0">
                          {fmt(item.score, 2, locale)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* THPT SUBJECTS LIST */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-extrabold text-foreground">
                    {pick(
                      `Danh sách môn học THPT (${thptSubjects.length})`,
                      `High School Subjects (${thptSubjects.length})`,
                    )}
                  </h2>
                  <button
                    type="button"
                    onClick={addThptSubject}
                    className="text-xs font-bold flex items-center gap-1 text-primary hover:underline cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      add_circle
                    </span>
                    {pick('Thêm môn', 'Add Subject')}
                  </button>
                </div>

                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 text-xs font-bold text-secondary-text">
                  <div className="col-span-6">{pick('Tên môn học', 'Subject Name')}</div>
                  <div className="col-span-2 text-center">{pick('Hệ số', 'Weight')}</div>
                  <div className="col-span-3 text-center">{pick('Điểm TB', 'Avg Score')}</div>
                  <div className="col-span-1"></div>
                </div>

                {isLoading ? (
                  <div className="space-y-2.5">
                    <ListItemSkeleton />
                    <ListItemSkeleton />
                    <ListItemSkeleton />
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {thptSubjects.map((subj, idx) => {
                      const displaySubjName = resolveThptSubjectName(subj, lang);
                      return (
                        <div
                          key={subj.id}
                          className="grid grid-cols-12 gap-2 items-center paper-card border border-border p-3 focus-within:border-primary transition-all"
                        >
                          <div className="col-span-12 sm:col-span-6 flex items-center gap-2">
                            <span
                              className="material-symbols-outlined text-accent text-lg shrink-0"
                              aria-hidden="true"
                            >
                              {getThptSubjectIcon(subj.name, subj.starterKey)}
                            </span>
                            <input
                              list="thpt-subjects"
                              type="text"
                              placeholder={pick(
                                `Môn học ${idx + 1} (VD: Toán)...`,
                                `Subject ${idx + 1} (e.g. Mathematics)...`,
                              )}
                              aria-label={pick(
                                `Tên môn học ${idx + 1}`,
                                `Subject ${idx + 1} name`,
                              )}
                              value={displaySubjName}
                              onChange={(e) => updateThptSubject(subj.id, 'name', e.target.value)}
                              className="w-full h-10 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary placeholder:text-muted-foreground"
                            />
                          </div>
                          <div className="col-span-5 sm:col-span-2">
                            <label className="sm:hidden block text-[10px] text-secondary-text mb-1 text-center">
                              {pick('Hệ số', 'Weight')}
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              aria-label={pick(
                                `Hệ số môn ${displaySubjName || idx + 1}`,
                                `Weight for ${displaySubjName || idx + 1}`,
                              )}
                              value={subj.credits}
                              onChange={(e) =>
                                updateThptSubject(subj.id, 'credits', e.target.value)
                              }
                              className="w-full h-10 rounded-xl border border-border bg-surface px-3 text-center text-sm font-medium text-foreground tabular focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                            />
                          </div>
                          <div className="col-span-5 sm:col-span-3">
                            <label className="sm:hidden block text-[10px] text-secondary-text mb-1 text-center">
                              {pick('Điểm TB', 'Avg Score')}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              placeholder="0.0"
                              aria-label={pick(
                                `Điểm trung bình môn ${displaySubjName || idx + 1}`,
                                `Average score for ${displaySubjName || idx + 1}`,
                              )}
                              value={subj.score}
                              onChange={(e) => updateThptSubject(subj.id, 'score', e.target.value)}
                              className="w-full h-10 rounded-xl border border-border bg-surface px-3 text-center text-sm font-bold text-primary tabular focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary placeholder:text-muted-foreground placeholder:font-normal"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-1 flex justify-center items-end">
                            <button
                              type="button"
                              onClick={() => removeThptSubject(subj.id)}
                              aria-label={pick(
                                `Xoá môn ${displaySubjName || idx + 1}`,
                                `Remove subject ${displaySubjName || idx + 1}`,
                              )}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                                delete
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={addThptSubject}
                  className="w-full py-3 border-2 border-dashed border-border-strong rounded-xl text-secondary-text hover:text-primary hover:border-primary hover:bg-primary-soft/40 transition-all flex items-center justify-center gap-2 text-sm font-bold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">
                    add
                  </span>
                  {pick('Thêm môn học mới', 'Add New Subject')}
                </button>
              </section>
            </>
          )}
        </main>
      </div>

      {/* Subject Autocomplete Datalists */}
      <datalist id="uni-subjects">
        {UNI_DATALIST_SUGGESTIONS[isEn ? 'en' : 'vi'].map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <datalist id="thpt-subjects">
        {SUBJECTS.map((s) => (
          <option key={s.key} value={isEn ? s.labelEn : s.label} />
        ))}
      </datalist>
    </div>
  );
}
