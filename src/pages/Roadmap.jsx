import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import ProgressBar from '../components/ui/ProgressBar';
import RankSeal from '../components/ui/RankSeal';
import { ListItemSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastProvider';

const STARTER_MILESTONES = {
  student: [
    {
      id: 'starter-s1',
      sort_order: 0,
      title: 'Giai đoạn 1 · Tổng ôn nền tảng THPT',
      titleEn: 'Stage 1 · Core High School Foundations',
      subtitle:
        'Hệ thống hoá kiến thức cốt lõi các môn trong tổ hợp xét tuyển, nắm chắc cấu trúc đề mới.',
      subtitleEn:
        'Systematize core concepts across your target exam subjects and master the updated exam structure.',
      status: 'done',
      progress: 100,
    },
    {
      id: 'starter-s2',
      sort_order: 1,
      title: 'Giai đoạn 2 · Chuyên đề vận dụng & ĐGNL đợt sớm',
      titleEn: 'Stage 2 · Advanced Topics & Early Aptitude Tests',
      subtitle:
        'Chinh phục nhóm câu hỏi phân loại 8.5+ và rèn chiến thuật làm bài HSA / V-ACT / TSA.',
      subtitleEn:
        'Tackle high-distinction 8.5+ problem sets and sharpen test-taking strategies for HSA / V-ACT / TSA.',
      status: 'active',
      progress: 60,
    },
    {
      id: 'starter-s3',
      sort_order: 2,
      title: 'Giai đoạn 3 · Thực chiến luyện đề bấm giờ',
      titleEn: 'Stage 3 · Timed Full-Length Mock Exams',
      subtitle:
        'Hoàn thành 25–30 đề chuẩn cấu trúc, ghi chép sổ tay lỗi sai và lấp lỗ hổng từng chương.',
      subtitleEn:
        'Complete 25–30 full timed mock papers, log error patterns, and close remaining chapter gaps.',
      status: 'locked',
      progress: 0,
    },
    {
      id: 'starter-s4',
      sort_order: 3,
      title: 'Giai đoạn 4 · Về đích & Tối ưu Nguyện vọng 1',
      titleEn: 'Stage 4 · Final Sprint & Top-Choice Admission',
      subtitle:
        'Ổn định tâm lý phòng thi, đối chiếu phổ điểm chuẩn và sắp xếp danh sách nguyện vọng tối ưu.',
      subtitleEn:
        'Build exam-day composure, benchmark score distributions, and optimize your university preference order.',
      status: 'locked',
      progress: 0,
    },
  ],
  university: [
    {
      id: 'starter-u1',
      sort_order: 0,
      title: 'Năm 1 · Chinh phục Đại cương & Phương pháp Đại học',
      titleEn: 'Year 1 · General Curriculum & University Study Habits',
      subtitle:
        'Làm chủ Toán cao cấp, Triết học, Pháp luật đại cương; xây dựng nền tảng GPA ≥ 3.2/4.0.',
      subtitleEn:
        'Master Higher Mathematics, Philosophy, and General Law while building a ≥ 3.2/4.0 GPA foundation.',
      status: 'done',
      progress: 100,
    },
    {
      id: 'starter-u2',
      sort_order: 1,
      title: 'Năm 2 · Cơ sở ngành & Chuẩn ngoại ngữ đầu ra',
      titleEn: 'Year 2 · Core Major Courses & Foreign Language Benchmark',
      subtitle:
        'Tập trung các học phần cốt lõi chuyên ngành và hoàn thành chứng chỉ Tiếng Anh quốc tế.',
      subtitleEn:
        'Focus on foundational major coursework and complete your international English proficiency certificate.',
      status: 'active',
      progress: 45,
    },
    {
      id: 'starter-u3',
      sort_order: 2,
      title: 'Năm 3 · Chuyên ngành sâu, Nghiên cứu & Thực tập',
      titleEn: 'Year 3 · Advanced Specialization, Research & Internship',
      subtitle:
        'Tham gia nhóm nghiên cứu khoa học / đồ án thực tế và ứng tuyển kỳ thực tập doanh nghiệp.',
      subtitleEn:
        'Join faculty research labs or capstone projects and secure a competitive industry internship.',
      status: 'locked',
      progress: 0,
    },
    {
      id: 'starter-u4',
      sort_order: 3,
      title: 'Năm 4 · Khoá luận tốt nghiệp & Bứt phá sự nghiệp',
      titleEn: 'Year 4 · Honors Thesis & Career Launch',
      subtitle:
        'Bảo vệ khoá luận xuất sắc, tối ưu GPA tích luỹ toàn khoá và sẵn sàng chinh phục nhà tuyển dụng.',
      subtitleEn:
        'Defend your graduation thesis with honors, maximize cumulative GPA, and launch your career.',
      status: 'locked',
      progress: 0,
    },
  ],
};

const STARTER_BY_ID = Object.values(STARTER_MILESTONES)
  .flat()
  .reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

function buildStarterSource(targetMode, isEn) {
  return (STARTER_MILESTONES[targetMode] || []).map((item) => ({
    ...item,
    title: isEn && item.titleEn ? item.titleEn : item.title,
    subtitle: isEn && item.subtitleEn ? item.subtitleEn : item.subtitle,
  }));
}

function normalizeRoadmapMode(raw) {
  if (raw === 'university' || raw === 'uni' || raw === 'sv') return 'university';
  if (raw === 'student' || raw === 'thpt') return 'student';
  return 'student';
}

function normalizeStatus(value) {
  if (value === 'done' || value === 'completed') return 'done';
  if (value === 'active' || value === 'in-progress') return 'active';
  return 'locked';
}

function normalizeProgress(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function mapMilestoneRow(row, fallbackIdx = 0) {
  const status = normalizeStatus(row.status);
  const rawProgress = normalizeProgress(row.progress);
  const progress = status === 'done' ? 100 : status === 'locked' ? 0 : rawProgress;
  return {
    id: row.id,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : fallbackIdx,
    title: row.title || '',
    subtitle: row.subtitle || '',
    status,
    progress,
  };
}

const STATUS_META = {
  done: {
    labelVi: 'Hoàn thành',
    labelEn: 'Completed',
    icon: 'check_circle',
    badgeClass: 'bg-completed-soft text-completed border-completed-border',
    nodeClass: 'bg-completed border-completed text-white shadow-xs',
    cardClass: 'border-completed-border bg-surface hover:border-completed',
    barTone: 'completed',
    next: 'locked',
  },
  active: {
    labelVi: 'Đang thực hiện',
    labelEn: 'In Progress',
    icon: 'trending_up',
    badgeClass: 'bg-gold-soft text-gold-dark border-gold',
    nodeClass: 'bg-primary border-primary text-on-primary ring-4 ring-primary/15',
    cardClass: 'border-primary/50 shadow-sm bg-surface hover:border-primary',
    barTone: 'primary',
    next: 'done',
  },
  locked: {
    labelVi: 'Đang chờ',
    labelEn: 'Upcoming',
    icon: 'schedule',
    badgeClass: 'bg-surface-alt text-secondary-text border-border-strong',
    nodeClass: 'bg-surface border-border-strong text-secondary-text hover:border-primary',
    cardClass: 'border-border bg-paper/75 hover:border-border-strong',
    barTone: 'jade',
    next: 'active',
  },
};

const QUICK_STEPS = [0, 25, 50, 75, 100];

export default function Roadmap() {
  const { user, profile, refreshProfile } = useAuth();
  const { isEn, pick } = useLanguage();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [mode, setMode] = useState(() => normalizeRoadmapMode(profile?.user_mode));
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'done'
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [reorderingId, setReorderingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Modal Thêm / Sửa cột mốc
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingForm, setEditingForm] = useState({
    id: null,
    title: '',
    subtitle: '',
    status: 'active',
    progress: 50,
  });

  // Modal Mục tiêu Chiến lược
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [targetThpt, setTargetThpt] = useState(27.0);
  const [targetDgnl, setTargetDgnl] = useState(900);
  const [targetGpa, setTargetGpa] = useState(3.6);

  // Sync initial mode once profile arrives if user hasn't switched manually
  const [hasManualMode, setHasManualMode] = useState(false);
  if (profile?.user_mode && !hasManualMode) {
    const profileMode = normalizeRoadmapMode(profile.user_mode);
    if (profileMode !== mode) {
      setMode(profileMode);
    }
  }

  const seedStarterToDb = useCallback(
    async (targetMode, sourceList) => {
      if (!user) return [];
      const fallbackPrefix = isEn ? 'Milestone' : 'Cột mốc';
      const rowsToInsert = (sourceList || buildStarterSource(targetMode, isEn)).map(
        (item, idx) => {
          const status = normalizeStatus(item.status);
          const progress =
            status === 'done'
              ? 100
              : status === 'locked'
                ? 0
                : normalizeProgress(item.progress ?? 50);
          return {
            user_id: user.id,
            mode: targetMode,
            sort_order: idx,
            title: (item.title || `${fallbackPrefix} ${idx + 1}`).trim(),
            subtitle: (item.subtitle || '').trim(),
            status,
            progress,
          };
        },
      );

      const { data: inserted, error } = await supabase
        .from('roadmap_milestones')
        .insert(rowsToInsert)
        .select(
          'id, user_id, mode, sort_order, title, subtitle, status, progress, created_at, updated_at',
        );

      if (error) throw error;

      try {
        window.localStorage.setItem(`dtht_roadmap_seeded_${user.id}_${targetMode}`, '1');
        window.localStorage.removeItem(`roadmap_${user.id}_${targetMode}`);
      } catch {
        /* ignore storage quota */
      }

      return [...(inserted || [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(mapMilestoneRow);
    },
    [user, isEn],
  );

  const fetchMilestones = useCallback(
    async (targetMode) => {
      if (!user) {
        setMilestones((STARTER_MILESTONES[targetMode] || []).map(mapMilestoneRow));
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('roadmap_milestones')
          .select(
            'id, user_id, mode, sort_order, title, subtitle, status, progress, created_at, updated_at',
          )
          .eq('user_id', user.id)
          .eq('mode', targetMode)
          .order('sort_order', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          try {
            window.localStorage.setItem(`dtht_roadmap_seeded_${user.id}_${targetMode}`, '1');
          } catch {
            /* ignore */
          }
          setMilestones(data.map(mapMilestoneRow));
        } else {
          let alreadySeeded = false;
          let legacySaved = null;
          try {
            alreadySeeded =
              window.localStorage.getItem(`dtht_roadmap_seeded_${user.id}_${targetMode}`) === '1';
            const rawLegacy = window.localStorage.getItem(`roadmap_${user.id}_${targetMode}`);
            if (rawLegacy) {
              const parsed = JSON.parse(rawLegacy);
              if (Array.isArray(parsed) && parsed.length > 0) legacySaved = parsed;
            }
          } catch {
            /* ignore */
          }

          if (!alreadySeeded) {
            const seeded = await seedStarterToDb(
              targetMode,
              legacySaved || buildStarterSource(targetMode, isEn),
            );
            setMilestones(seeded);
          } else {
            setMilestones([]);
          }
        }
      } catch (err) {
        console.error('Lỗi tải lộ trình:', err);
        showToast(
          pick(
            'Không thể tải lộ trình từ máy chủ. Đang hiển thị bản xem trước.',
            'Unable to load roadmap from server. Showing preview template.',
          ),
          'error',
        );
        setMilestones((STARTER_MILESTONES[targetMode] || []).map(mapMilestoneRow));
      } finally {
        setLoading(false);
      }
    },
    [seedStarterToDb, showToast, user, isEn, pick],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) {
        await fetchMilestones(mode);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMilestones, mode]);

  const handleSwitchMode = async (nextMode) => {
    if (nextMode === mode) return;
    setHasManualMode(true);
    setConfirmDeleteId(null);
    setStatusFilter('all');
    setLoading(true);
    setMode(nextMode);

    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ user_mode: nextMode, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (!error) {
        refreshProfile?.();
      }
    }
  };

  const handleSeedStarterClick = async () => {
    if (!user) {
      setMilestones((STARTER_MILESTONES[mode] || []).map(mapMilestoneRow));
      showToast(
        pick(
          'Đã nạp lộ trình mẫu (đăng nhập để lưu vĩnh viễn).',
          'Starter roadmap loaded (sign in to save permanently).',
        ),
        'info',
      );
      return;
    }

    setIsSeeding(true);
    try {
      const seeded = await seedStarterToDb(mode, buildStarterSource(mode, isEn));
      setMilestones(seeded);
      showToast(
        pick('Đã khởi tạo lộ trình mẫu thành công!', 'Starter roadmap initialized!'),
        'success',
      );
    } catch (err) {
      showToast(
        pick(
          `Không thể khởi tạo lộ trình mẫu: ${err.message}`,
          `Failed to initialize starter roadmap: ${err.message}`,
        ),
        'error',
      );
    } finally {
      setIsSeeding(false);
    }
  };

  const openCreateModal = () => {
    if (!user) {
      showToast(
        pick(
          'Vui lòng đăng nhập để thêm cột mốc cá nhân.',
          'Please sign in to add personal milestones.',
        ),
        'warning',
      );
      return;
    }
    setEditingForm({
      id: null,
      title: '',
      subtitle: '',
      status: 'active',
      progress: 30,
    });
    setIsEditModalOpen(true);
  };

  const openEditModal = (milestone) => {
    if (!user) {
      showToast(
        pick(
          'Vui lòng đăng nhập để chỉnh sửa lộ trình cá nhân.',
          'Please sign in to edit your personal roadmap.',
        ),
        'warning',
      );
      return;
    }
    setEditingForm({
      id: milestone.id,
      title: milestone.title,
      subtitle: milestone.subtitle || '',
      status: milestone.status,
      progress: milestone.progress,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveMilestone = async (e) => {
    e.preventDefault();
    if (!user) return;
    const trimmedTitle = editingForm.title.trim();
    if (!trimmedTitle) {
      showToast(
        pick(
          'Vui lòng nhập tiêu đề giai đoạn / cột mốc.',
          'Please enter a milestone title.',
        ),
        'warning',
      );
      return;
    }

    const status = normalizeStatus(editingForm.status);
    const progress =
      status === 'done'
        ? 100
        : status === 'locked'
          ? 0
          : Math.max(1, Math.min(99, normalizeProgress(editingForm.progress) || 50));

    const payload = {
      title: trimmedTitle,
      subtitle: editingForm.subtitle.trim(),
      status,
      progress,
    };

    setIsSubmitting(true);
    try {
      if (!editingForm.id) {
        const nextSortOrder =
          milestones.length > 0
            ? Math.max(...milestones.map((m) => Number(m.sort_order) || 0)) + 1
            : 0;

        const { data, error } = await supabase
          .from('roadmap_milestones')
          .insert({
            user_id: user.id,
            mode,
            sort_order: nextSortOrder,
            ...payload,
          })
          .select(
            'id, user_id, mode, sort_order, title, subtitle, status, progress, created_at, updated_at',
          )
          .single();

        if (error) throw error;
        setMilestones((prev) => [...prev, mapMilestoneRow(data, nextSortOrder)]);
        showToast(
          pick('Đã thêm cột mốc mới vào lộ trình!', 'New milestone added to your roadmap!'),
          'success',
        );
      } else {
        const { error } = await supabase
          .from('roadmap_milestones')
          .update(payload)
          .eq('id', editingForm.id)
          .eq('user_id', user.id);

        if (error) throw error;
        setMilestones((prev) =>
          prev.map((m) => (m.id === editingForm.id ? { ...m, ...payload } : m)),
        );
        showToast(
          pick('Đã cập nhật cột mốc thành công!', 'Milestone updated!'),
          'success',
        );
      }
      setIsEditModalOpen(false);
    } catch (err) {
      showToast(
        pick(`Lỗi lưu cột mốc: ${err.message}`, `Failed to save milestone: ${err.message}`),
        'error',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCycleStatus = async (milestone) => {
    const meta = STATUS_META[milestone.status] || STATUS_META.locked;
    const nextStatus = meta.next;
    const nextProgress =
      nextStatus === 'done'
        ? 100
        : nextStatus === 'locked'
          ? 0
          : milestone.progress > 0 && milestone.progress < 100
            ? milestone.progress
            : 50;

    const prevMilestones = milestones;
    setMilestones((list) =>
      list.map((m) =>
        m.id === milestone.id ? { ...m, status: nextStatus, progress: nextProgress } : m,
      ),
    );

    if (!user) return;

    const { error } = await supabase
      .from('roadmap_milestones')
      .update({ status: nextStatus, progress: nextProgress })
      .eq('id', milestone.id)
      .eq('user_id', user.id);

    if (error) {
      setMilestones(prevMilestones);
      showToast(
        pick(
          `Không thể cập nhật trạng thái: ${error.message}`,
          `Failed to update status: ${error.message}`,
        ),
        'error',
      );
    }
  };

  const handleCommitProgress = async (milestone, rawValue) => {
    const nextProgress = normalizeProgress(rawValue);
    const nextStatus =
      nextProgress >= 100 ? 'done' : nextProgress <= 0 ? 'locked' : 'active';

    const prevMilestones = milestones;
    setMilestones((list) =>
      list.map((m) =>
        m.id === milestone.id ? { ...m, progress: nextProgress, status: nextStatus } : m,
      ),
    );

    if (!user) return;

    const { error } = await supabase
      .from('roadmap_milestones')
      .update({ progress: nextProgress, status: nextStatus })
      .eq('id', milestone.id)
      .eq('user_id', user.id);

    if (error) {
      setMilestones(prevMilestones);
      showToast(
        pick(
          `Không thể lưu tiến độ: ${error.message}`,
          `Failed to save progress: ${error.message}`,
        ),
        'error',
      );
    }
  };

  const handlePreviewProgress = (milestoneId, rawValue) => {
    const nextProgress = normalizeProgress(rawValue);
    const nextStatus =
      nextProgress >= 100 ? 'done' : nextProgress <= 0 ? 'locked' : 'active';
    setMilestones((list) =>
      list.map((m) =>
        m.id === milestoneId ? { ...m, progress: nextProgress, status: nextStatus } : m,
      ),
    );
  };

  const handleMoveMilestone = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= milestones.length) return;
    if (reorderingId) return;

    const itemA = milestones[index];
    const itemB = milestones[targetIndex];
    const orderA = typeof itemA.sort_order === 'number' ? itemA.sort_order : index;
    const orderB = typeof itemB.sort_order === 'number' ? itemB.sort_order : targetIndex;
    const finalOrderA = orderA === orderB ? targetIndex : orderB;
    const finalOrderB = orderA === orderB ? index : orderA;

    const prevMilestones = milestones;
    const swapped = [...milestones];
    swapped[index] = { ...itemB, sort_order: finalOrderB };
    swapped[targetIndex] = { ...itemA, sort_order: finalOrderA };
    setMilestones(swapped);

    if (!user) return;

    setReorderingId(itemA.id);
    try {
      // 1. Prefer single-round-trip atomic RPC (10k CCU optimization)
      const rpcRes = await supabase.rpc('swap_roadmap_milestones', {
        p_first_id: itemA.id,
        p_second_id: itemB.id,
      });

      if (rpcRes.error) {
        // 2. Fallback: 3-step swap if RPC migration is not yet deployed
        const tempOrder = -1000 - (Date.now() % 900000);
        const { error: err1 } = await supabase
          .from('roadmap_milestones')
          .update({ sort_order: tempOrder })
          .eq('id', itemA.id)
          .eq('user_id', user.id);
        if (err1) throw err1;

        const { error: err2 } = await supabase
          .from('roadmap_milestones')
          .update({ sort_order: finalOrderB })
          .eq('id', itemB.id)
          .eq('user_id', user.id);
        if (err2) throw err2;

        const { error: err3 } = await supabase
          .from('roadmap_milestones')
          .update({ sort_order: finalOrderA })
          .eq('id', itemA.id)
          .eq('user_id', user.id);
        if (err3) throw err3;
      }
    } catch (err) {
      setMilestones(prevMilestones);
      showToast(
        pick(
          `Không thể đổi thứ tự cột mốc: ${err.message}`,
          `Failed to reorder milestones: ${err.message}`,
        ),
        'error',
      );
    } finally {
      setReorderingId(null);
    }
  };

  const handleDeleteMilestone = async (id) => {
    if (!user) return;
    const prevMilestones = milestones;
    setConfirmDeleteId(null);
    setMilestones((list) => list.filter((m) => m.id !== id));

    const { error } = await supabase
      .from('roadmap_milestones')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      setMilestones(prevMilestones);
      showToast(
        pick(
          `Lỗi khi xoá cột mốc: ${error.message}`,
          `Failed to delete milestone: ${error.message}`,
        ),
        'error',
      );
    } else {
      showToast(
        pick('Đã xoá cột mốc khỏi lộ trình.', 'Milestone removed from roadmap.'),
        'info',
      );
    }
  };

  const openSettingsModal = () => {
    setTargetThpt(Number(profile?.target_thpt) || 27.0);
    setTargetDgnl(Number(profile?.target_dgnl) || 900);
    const rawGpa = Number(profile?.target_gpa);
    setTargetGpa(rawGpa > 0 && rawGpa <= 4.0 ? rawGpa : 3.6);
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast(
        pick(
          'Vui lòng đăng nhập để lưu mục tiêu chiến lược.',
          'Please sign in to save your strategic targets.',
        ),
        'warning',
      );
      return;
    }

    setIsSavingSettings(true);
    try {
      const updates = {
        user_mode: mode,
        updated_at: new Date().toISOString(),
      };
      if (mode === 'student') {
        updates.target_thpt = Math.max(0, Math.min(30, Number(targetThpt) || 27.0));
        updates.target_dgnl = targetDgnl ? Math.max(0, Math.min(1200, Number(targetDgnl))) : null;
      } else {
        updates.target_gpa = Math.max(0, Math.min(4.0, Number(targetGpa) || 3.6));
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;

      await refreshProfile?.();
      setIsSettingsOpen(false);
      showToast(
        pick('Đã cập nhật mục tiêu chiến lược!', 'Strategic targets updated!'),
        'success',
      );
    } catch (err) {
      showToast(
        pick(`Lỗi lưu mục tiêu: ${err.message}`, `Failed to save targets: ${err.message}`),
        'error',
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const totalCount = milestones.length;
  const doneCount = milestones.filter((m) => m.status === 'done').length;
  const activeCount = milestones.filter((m) => m.status === 'active').length;
  const overallPercent =
    totalCount > 0
      ? Math.round(
          milestones.reduce(
            (sum, m) =>
              sum + (m.status === 'done' ? 100 : m.status === 'active' ? m.progress || 0 : 0),
            0,
          ) / totalCount,
        )
      : 0;

  const visibleMilestones = milestones.filter((m) => {
    if (statusFilter === 'active') return m.status === 'active';
    if (statusFilter === 'done') return m.status === 'done';
    return true;
  });

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Imperial Header & Mode Switcher */}
        <header className="imperial-frame p-5 sm:p-7 relative overflow-hidden">
          <span
            aria-hidden="true"
            className="hanzi-watermark absolute top-2 right-6 text-8xl font-bold text-accent/10"
          >
            道途
          </span>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <RankSeal
                  size="sm"
                  icon="route"
                  label={
                    mode === 'student'
                      ? pick(
                          'Chiến Lược Khoa Trường · THPT',
                          'Imperial Exam Strategy · High School',
                        )
                      : pick('Lộ Trình Học Thuật · Đại Học', 'Academic Roadmap · University')
                  }
                />
                {user && (
                  <span className="paper-chip text-jade border-jade-border bg-jade-soft">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      cloud_done
                    </span>
                    <span>{pick('Đồng bộ trực tiếp', 'Live Cloud Sync')}</span>
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground">
                {pick('Lộ Trình Học Tập Cá Nhân', 'Personal Study Roadmap')}
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1 max-w-2xl">
                {pick(
                  'Thiết lập các cột mốc chiến lược, theo dõi tiến độ từng giai đoạn và giữ vững mục tiêu chinh phục bảng vàng.',
                  'Set strategic milestones, track stage-by-stage progress, and stay aligned with your Honor Roll goals.',
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={openSettingsModal}
                className="btn-arena btn-arena-secondary btn-arena-sm"
              >
                <span className="material-symbols-outlined text-base text-accent" aria-hidden="true">
                  tune
                </span>
                <span>{pick('Mục tiêu', 'Targets')}</span>
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="btn-arena btn-arena-primary btn-arena-sm"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  add_circle
                </span>
                <span>{pick('Thêm cột mốc', 'Add Milestone')}</span>
              </button>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
            <div
              role="tablist"
              aria-label={pick('Chọn bậc học lộ trình', 'Select education track')}
              className="inline-flex flex-wrap p-1 bg-surface-alt border border-border rounded-xl self-start gap-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'student'}
                onClick={() => handleSwitchMode('student')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-display font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  mode === 'student'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-secondary-text hover:text-foreground'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  backpack
                </span>
                <span>{pick('Học Sinh THPT', 'High School')}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'university'}
                onClick={() => handleSwitchMode('university')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-display font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  mode === 'university'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-secondary-text hover:text-foreground'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  school
                </span>
                <span>{pick('Sinh Viên Đại Học', 'University')}</span>
              </button>
            </div>

            {/* Quick Targets Summary */}
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'student' ? (
                <>
                  <span className="paper-chip bg-gold-soft text-gold-dark border-gold tabular">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      flag
                    </span>
                    <span>
                      {pick('THPT', 'HS Exam')}: {profile?.target_thpt ?? 27.0}/30
                    </span>
                  </span>
                  <span className="paper-chip bg-jade-soft text-jade border-jade-border tabular">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      psychology
                    </span>
                    <span>
                      {pick('ĐGNL', 'Aptitude')}: {profile?.target_dgnl ?? 900}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/schools')}
                    className="paper-chip hover:border-primary hover:text-primary cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      account_balance
                    </span>
                    <span>{pick('Tra cứu điểm chuẩn', 'Admission Cutoffs')}</span>
                  </button>
                </>
              ) : (
                <>
                  <span className="paper-chip bg-jade-soft text-jade border-jade-border tabular">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      analytics
                    </span>
                    <span>
                      {pick('GPA hiện tại:', 'Current GPA:')}{' '}
                      {profile?.current_gpa ? Number(profile.current_gpa).toFixed(2) : '—'}/4.0
                    </span>
                  </span>
                  <span className="paper-chip bg-gold-soft text-gold-dark border-gold tabular">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      workspace_premium
                    </span>
                    <span>
                      {pick('Mục tiêu:', 'Target:')}{' '}
                      {profile?.target_gpa && Number(profile.target_gpa) <= 4
                        ? Number(profile.target_gpa).toFixed(2)
                        : '3.60'}
                      /4.0
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/gpa')}
                    className="paper-chip hover:border-primary hover:text-primary cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      calculate
                    </span>
                    <span>{pick('Bàn tính GPA', 'GPA Calculator')}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {!user && (
          <div className="paper-card border border-gold bg-gold-soft/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm font-medium text-foreground">
              {pick(
                'Bạn đang xem lộ trình mẫu ở chế độ khách. Đăng nhập để lưu trữ và tuỳ biến cột mốc cá nhân trên đám mây.',
                'You are viewing a sample roadmap in guest mode. Sign in to save and customize your personal milestones in the cloud.',
              )}
            </p>
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="btn-arena btn-arena-gold btn-arena-sm self-start sm:self-auto shrink-0"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                login
              </span>
              <span>{pick('Đăng nhập ngay', 'Sign in now')}</span>
            </button>
          </div>
        )}

        {/* Overall Progress Summary Card */}
        <section
          aria-label={pick('Tổng quan tiến độ', 'Overall progress summary')}
          className="paper-card border border-border p-5 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
            <div>
              <span className="inline-block text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-primary-soft text-primary border border-primary/30 mb-2">
                {mode === 'student'
                  ? pick('Chiến dịch Vượt Vũ Môn', 'Dragon Gate Campaign')
                  : pick('Hành trình Tốt Nghiệp Xuất Sắc', 'Honors Graduation Track')}
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-foreground">
                {pick('Tổng Tiến Độ Lộ Trình', 'Overall Roadmap Progress')}
              </h2>
              <p className="text-xs sm:text-sm text-secondary-text mt-1 tabular">
                {isEn ? (
                  <>
                    Completed <strong className="text-completed">{doneCount}</strong>/{totalCount}{' '}
                    milestones · <strong className="text-accent">{activeCount}</strong> in progress
                  </>
                ) : (
                  <>
                    Đã hoàn thành <strong className="text-completed">{doneCount}</strong>/
                    {totalCount} cột mốc · Đang thực hiện{' '}
                    <strong className="text-accent">{activeCount}</strong> giai đoạn
                  </>
                )}
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="text-3xl sm:text-4xl font-display font-extrabold text-primary tabular">
                {overallPercent}%
              </div>
              <p className="text-xs text-muted-foreground">
                {pick('Hoàn thành toàn lộ trình', 'Total completion')}
              </p>
            </div>
          </div>

          <ProgressBar
            value={overallPercent}
            max={100}
            tone={overallPercent >= 100 ? 'completed' : 'primary'}
            showPercent={false}
          />
        </section>

        {/* Timeline Milestones */}
        <main className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-display font-extrabold text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">
                  timeline
                </span>
                <span>
                  {pick('Các Cột Mốc Chiến Lược', 'Strategic Milestones')} ({totalCount})
                </span>
              </h3>
              <p className="text-xs text-secondary-text mt-0.5">
                {pick(
                  'Nhấn vào nhãn trạng thái hoặc thanh phần trăm để cập nhật nhanh',
                  'Click a status badge or percentage chip to update progress quickly',
                )}
              </p>
            </div>

            {milestones.length > 0 && (
              <div
                role="tablist"
                aria-label={pick('Lọc trạng thái cột mốc', 'Filter milestones by status')}
                className="inline-flex flex-wrap p-1 rounded-xl bg-surface-alt border border-border gap-1 self-start sm:self-auto"
              >
                {[
                  { id: 'all', label: pick('Tất cả', 'All'), count: totalCount },
                  { id: 'active', label: pick('Đang thực hiện', 'In Progress'), count: activeCount },
                  { id: 'done', label: pick('Hoàn thành', 'Completed'), count: doneCount },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer tabular ${
                      statusFilter === tab.id
                        ? 'bg-paper text-primary border border-border-strong shadow-2xs'
                        : 'text-secondary-text hover:text-foreground'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div
              className="space-y-3"
              role="status"
              aria-label={pick('Đang tải lộ trình', 'Loading roadmap')}
            >
              <ListItemSkeleton />
              <ListItemSkeleton />
              <ListItemSkeleton />
            </div>
          ) : milestones.length === 0 ? (
            <div className="paper-card p-10 text-center space-y-4 border border-dashed border-border-strong">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gold-soft border border-gold flex items-center justify-center text-accent">
                <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                  explore
                </span>
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="font-display text-lg font-bold text-foreground">
                  {pick(
                    'Chưa có cột mốc nào cho chế độ này',
                    'No milestones for this track yet',
                  )}
                </h4>
                <p className="text-xs sm:text-sm text-secondary-text leading-relaxed">
                  {pick(
                    'Khởi tạo bộ lộ trình chuẩn chỉ với 1 cú nhấp hoặc tự thiết kế các giai đoạn ôn luyện mang dấu ấn riêng của bạn.',
                    'Initialize our curated starter roadmap in one click, or design custom study stages tailored to your goals.',
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSeeding}
                  onClick={handleSeedStarterClick}
                  className="btn-arena btn-arena-gold btn-arena-sm"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    auto_awesome
                  </span>
                  <span>
                    {isSeeding
                      ? pick('Đang khởi tạo...', 'Initializing...')
                      : pick('Khởi tạo lộ trình mẫu', 'Load Starter Roadmap')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="btn-arena btn-arena-primary btn-arena-sm"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    add
                  </span>
                  <span>{pick('Tự tạo cột mốc đầu tiên', 'Create First Milestone')}</span>
                </button>
              </div>
            </div>
          ) : visibleMilestones.length === 0 ? (
            <div className="paper-card p-8 text-center space-y-3 border border-dashed border-border-strong">
              <span
                className="material-symbols-outlined text-3xl text-muted-foreground"
                aria-hidden="true"
              >
                filter_list_off
              </span>
              <p className="font-display font-bold text-sm text-foreground">
                {pick(
                  'Không có cột mốc nào thuộc bộ lọc trạng thái này',
                  'No milestones match this status filter',
                )}
              </p>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="btn-arena btn-arena-secondary btn-arena-sm"
              >
                {pick('Xem tất cả cột mốc', 'Show all milestones')}
              </button>
            </div>
          ) : (
            <div className="relative ml-3.5 sm:ml-4 pl-5 sm:pl-7 border-l-2 border-border-strong space-y-5">
              {visibleMilestones.map((m) => {
                const realIndex = milestones.findIndex((item) => item.id === m.id);
                const meta = STATUS_META[m.status] || STATUS_META.locked;
                const statusLabel = isEn ? meta.labelEn : meta.labelVi;
                const isFirst = realIndex <= 0;
                const isLast = realIndex === milestones.length - 1;
                const isConfirmingDelete = confirmDeleteId === m.id;
                const starterRef = STARTER_BY_ID[m.id];
                const displayTitle =
                  starterRef && isEn ? starterRef.titleEn : m.title;
                const displaySubtitle =
                  starterRef && isEn ? starterRef.subtitleEn : m.subtitle;

                return (
                  <article key={m.id} className="relative">
                    {/* Timeline Node Button (cycles status) */}
                    <button
                      type="button"
                      onClick={() => handleCycleStatus(m)}
                      title={pick(
                        `Đổi trạng thái cột mốc (hiện tại: ${statusLabel})`,
                        `Cycle milestone status (current: ${statusLabel})`,
                      )}
                      aria-label={pick(
                        `Đổi trạng thái cột mốc ${realIndex + 1}: ${displayTitle}`,
                        `Cycle status for milestone ${realIndex + 1}: ${displayTitle}`,
                      )}
                      className={`absolute -left-[35px] sm:-left-[43px] top-4 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all border-2 ${meta.nodeClass}`}
                    >
                      {m.status === 'done' ? (
                        <span
                          className="material-symbols-outlined text-[15px] font-bold"
                          aria-hidden="true"
                        >
                          check
                        </span>
                      ) : (
                        <span className="text-xs font-bold tabular">{realIndex + 1}</span>
                      )}
                    </button>

                    <div className={`paper-card border p-4 sm:p-5 transition-all ${meta.cardClass}`}>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCycleStatus(m)}
                              title={pick(
                                'Nhấn để chuyển trạng thái tiếp theo',
                                'Click to cycle to next status',
                              )}
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-opacity hover:opacity-85 cursor-pointer ${meta.badgeClass}`}
                            >
                              <span
                                className="material-symbols-outlined text-[13px]"
                                aria-hidden="true"
                              >
                                {meta.icon}
                              </span>
                              <span>{statusLabel}</span>
                            </button>
                            <span className="text-xs font-bold text-secondary-text tabular">
                              {pick(`• Tiến độ ${m.progress}%`, `• ${m.progress}% complete`)}
                            </span>
                          </div>

                          <h4
                            className={`font-display font-bold text-base sm:text-lg leading-snug ${
                              m.status === 'locked' ? 'text-secondary-text' : 'text-foreground'
                            }`}
                          >
                            {displayTitle}
                          </h4>
                          {displaySubtitle && (
                            <p className="text-xs sm:text-sm text-secondary-text leading-relaxed">
                              {displaySubtitle}
                            </p>
                          )}
                        </div>

                        {/* Action Controls */}
                        <div className="flex items-center gap-1 self-end sm:self-start shrink-0">
                          <button
                            type="button"
                            disabled={statusFilter !== 'all' || isFirst || Boolean(reorderingId)}
                            onClick={() => handleMoveMilestone(realIndex, 'up')}
                            aria-label={pick('Chuyển lên trên', 'Move milestone up')}
                            title={pick('Chuyển lên trên', 'Move up')}
                            className="w-9 h-9 rounded-lg bg-surface-alt border border-border text-secondary-text hover:text-foreground hover:border-border-strong disabled:opacity-40 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                          >
                            <span
                              className="material-symbols-outlined text-[18px]"
                              aria-hidden="true"
                            >
                              arrow_upward
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={statusFilter !== 'all' || isLast || Boolean(reorderingId)}
                            onClick={() => handleMoveMilestone(realIndex, 'down')}
                            aria-label={pick('Chuyển xuống dưới', 'Move milestone down')}
                            title={pick('Chuyển xuống dưới', 'Move down')}
                            className="w-9 h-9 rounded-lg bg-surface-alt border border-border text-secondary-text hover:text-foreground hover:border-border-strong disabled:opacity-40 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                          >
                            <span
                              className="material-symbols-outlined text-[18px]"
                              aria-hidden="true"
                            >
                              arrow_downward
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(m)}
                            aria-label={pick(
                              `Chỉnh sửa ${displayTitle}`,
                              `Edit ${displayTitle}`,
                            )}
                            title={pick('Chỉnh sửa', 'Edit')}
                            className="w-9 h-9 rounded-lg bg-surface-alt border border-border text-secondary-text hover:text-primary hover:border-primary/40 flex items-center justify-center cursor-pointer"
                          >
                            <span
                              className="material-symbols-outlined text-[18px]"
                              aria-hidden="true"
                            >
                              edit
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteId(isConfirmingDelete ? null : m.id)
                            }
                            aria-label={pick(`Xoá ${displayTitle}`, `Delete ${displayTitle}`)}
                            title={pick('Xoá cột mốc', 'Delete milestone')}
                            className="w-9 h-9 rounded-lg bg-surface-alt border border-border text-secondary-text hover:text-primary hover:border-primary/40 flex items-center justify-center cursor-pointer"
                          >
                            <span
                              className="material-symbols-outlined text-[18px]"
                              aria-hidden="true"
                            >
                              delete
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Inline Delete Confirmation */}
                      {isConfirmingDelete && (
                        <div className="mt-3 p-3 rounded-xl bg-primary-soft border border-primary/35 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {pick(
                              'Bạn chắc chắn muốn xoá cột mốc này khỏi lộ trình?',
                              'Are you sure you want to remove this milestone from your roadmap?',
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-bold text-secondary-text hover:text-foreground cursor-pointer"
                            >
                              {pick('Huỷ', 'Cancel')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMilestone(m.id)}
                              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold cursor-pointer"
                            >
                              {pick('Xác nhận xoá', 'Confirm Delete')}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Progress Bar + Interactive Slider & Step Chips */}
                      <div className="mt-4 pt-3 border-t border-border space-y-2.5">
                        <ProgressBar
                          value={m.progress}
                          max={100}
                          tone={meta.barTone}
                          size="sm"
                          showPercent={false}
                        />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 flex-1 max-w-xs">
                            <label
                              htmlFor={`progress-range-${m.id}`}
                              className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap"
                            >
                              {pick('Kéo tiến độ:', 'Slide progress:')}
                            </label>
                            <input
                              id={`progress-range-${m.id}`}
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={m.progress}
                              onChange={(e) => handlePreviewProgress(m.id, e.target.value)}
                              onPointerUp={(e) =>
                                handleCommitProgress(m, e.currentTarget.value)
                              }
                              onKeyUp={(e) => handleCommitProgress(m, e.currentTarget.value)}
                              className="w-full accent-primary cursor-pointer"
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-1">
                            {QUICK_STEPS.map((pct) => {
                              const selected = m.progress === pct;
                              return (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => handleCommitProgress(m, pct)}
                                  className={`px-2 py-1 rounded-md text-[11px] font-bold tabular border transition-colors cursor-pointer ${
                                    selected
                                      ? 'bg-primary text-on-primary border-primary'
                                      : 'bg-paper text-secondary-text border-border hover:border-border-strong hover:text-foreground'
                                  }`}
                                >
                                  {pct}%
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              {/* Add Milestone Dashed CTA */}
              <button
                type="button"
                onClick={openCreateModal}
                className="w-full py-3.5 border-2 border-dashed border-border-strong rounded-2xl text-xs sm:text-sm font-bold text-secondary-text hover:text-primary hover:border-primary hover:bg-primary-soft/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  add_circle
                </span>
                <span>
                  {pick('Thêm cột mốc chiến lược mới', 'Add a new strategic milestone')}
                </span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modal Thêm / Sửa Cột Mốc */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="imperial-frame w-full max-w-md p-6 bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">
                  edit_note
                </span>
                <span>
                  {editingForm.id
                    ? pick('Chỉnh sửa cột mốc', 'Edit Milestone')
                    : pick('Thêm cột mốc mới', 'Add New Milestone')}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                aria-label={pick('Đóng hộp thoại', 'Close dialog')}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <form onSubmit={handleSaveMilestone} className="space-y-4">
              <div>
                <label
                  htmlFor="milestone-title"
                  className="block text-xs font-bold text-foreground mb-1.5"
                >
                  {pick('Tiêu đề giai đoạn / Mục tiêu', 'Stage / Milestone Title')}{' '}
                  <span className="text-primary">*</span>
                </label>
                <input
                  id="milestone-title"
                  type="text"
                  required
                  maxLength={140}
                  placeholder={pick(
                    'VD: Giai đoạn luyện 20 đề thực chiến Toán - Lý - Hoá',
                    'e.g., Complete 20 full-length Math–Physics–Chemistry mock tests',
                  )}
                  value={editingForm.title}
                  onChange={(e) =>
                    setEditingForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="milestone-subtitle"
                  className="block text-xs font-bold text-foreground mb-1.5"
                >
                  {pick('Mô tả chi tiết / Kế hoạch hành động', 'Description / Action Plan')}
                </label>
                <textarea
                  id="milestone-subtitle"
                  rows={3}
                  maxLength={400}
                  placeholder={pick(
                    'VD: Mỗi tuần giải 3 đề bấm giờ, tổng hợp công thức giải nhanh...',
                    'e.g., Solve 3 timed papers per week and summarize key shortcut formulas...',
                  )}
                  value={editingForm.subtitle}
                  onChange={(e) =>
                    setEditingForm((prev) => ({ ...prev, subtitle: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="milestone-status"
                    className="block text-xs font-bold text-foreground mb-1.5"
                  >
                    {pick('Trạng thái', 'Status')}
                  </label>
                  <select
                    id="milestone-status"
                    value={editingForm.status}
                    onChange={(e) => {
                      const nextSt = e.target.value;
                      setEditingForm((prev) => ({
                        ...prev,
                        status: nextSt,
                        progress:
                          nextSt === 'done'
                            ? 100
                            : nextSt === 'locked'
                              ? 0
                              : prev.progress > 0 && prev.progress < 100
                                ? prev.progress
                                : 50,
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="active">{pick('Đang thực hiện', 'In Progress')}</option>
                    <option value="done">{pick('Hoàn thành (100%)', 'Completed (100%)')}</option>
                    <option value="locked">{pick('Đang chờ (0%)', 'Upcoming (0%)')}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="milestone-progress"
                    className="block text-xs font-bold text-foreground mb-1.5 tabular"
                  >
                    {pick('Tiến độ', 'Progress')} ({editingForm.progress}%)
                  </label>
                  <input
                    id="milestone-progress"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    disabled={editingForm.status !== 'active'}
                    value={editingForm.progress}
                    onChange={(e) =>
                      setEditingForm((prev) => ({
                        ...prev,
                        progress: Number(e.target.value),
                      }))
                    }
                    className="w-full mt-2.5 accent-primary disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn-arena btn-arena-secondary btn-arena-sm"
                >
                  {pick('Huỷ', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-arena btn-arena-primary btn-arena-sm"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    save
                  </span>
                  <span>
                    {isSubmitting
                      ? pick('Đang lưu...', 'Saving...')
                      : pick('Lưu cột mốc', 'Save Milestone')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cài đặt Mục tiêu Chiến lược */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="imperial-frame w-full max-w-md p-6 bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-accent" aria-hidden="true">
                  tune
                </span>
                <span>
                  {pick('Thiết lập Mục tiêu', 'Strategic Targets')} (
                  {mode === 'student'
                    ? pick('THPT', 'High School')
                    : pick('Đại học', 'University')}
                  )
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label={pick('Đóng hộp thoại mục tiêu', 'Close targets dialog')}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {mode === 'student' ? (
                <>
                  <div className="p-4 rounded-xl bg-paper border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="target-thpt" className="text-xs font-bold text-foreground">
                        {pick(
                          'Mục tiêu điểm thi THPT Quốc Gia (Hệ 30)',
                          'National High School Exam Target (Scale 30)',
                        )}
                      </label>
                      <span className="font-display font-extrabold text-lg text-primary tabular shrink-0">
                        {targetThpt}
                        {pick('đ', ' pts')}
                      </span>
                    </div>
                    <input
                      id="target-thpt"
                      type="range"
                      min="15"
                      max="30"
                      step="0.25"
                      value={targetThpt}
                      onChange={(e) => setTargetThpt(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-paper border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="target-dgnl" className="text-xs font-bold text-foreground">
                        {pick(
                          'Mục tiêu Đánh giá năng lực (Thang 1200)',
                          'Aptitude Test Target (Scale 1200)',
                        )}
                      </label>
                      <span className="font-display font-extrabold text-lg text-jade tabular shrink-0">
                        {targetDgnl}
                        {pick('đ', ' pts')}
                      </span>
                    </div>
                    <input
                      id="target-dgnl"
                      type="range"
                      min="500"
                      max="1200"
                      step="10"
                      value={targetDgnl}
                      onChange={(e) => setTargetDgnl(Number(e.target.value))}
                      className="w-full accent-jade"
                    />
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-xl bg-paper border border-border space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="target-gpa-uni" className="text-xs font-bold text-foreground">
                      {pick(
                        'Mục tiêu GPA tích luỹ Đại học (Hệ 4.0)',
                        'Cumulative University GPA Target (Scale 4.0)',
                      )}
                    </label>
                    <span className="font-display font-extrabold text-lg text-primary tabular shrink-0">
                      {Number(targetGpa).toFixed(2)} / 4.0
                    </span>
                  </div>
                  <input
                    id="target-gpa-uni"
                    type="range"
                    min="2.0"
                    max="4.0"
                    step="0.05"
                    value={targetGpa}
                    onChange={(e) => setTargetGpa(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="btn-arena btn-arena-secondary btn-arena-sm"
                >
                  {pick('Huỷ', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="btn-arena btn-arena-primary btn-arena-sm"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    save
                  </span>
                  <span>
                    {isSavingSettings
                      ? pick('Đang lưu...', 'Saving...')
                      : pick('Lưu mục tiêu', 'Save Targets')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
