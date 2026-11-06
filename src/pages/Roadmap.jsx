import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
      subtitle:
        'Hệ thống hoá kiến thức cốt lõi các môn trong tổ hợp xét tuyển, nắm chắc cấu trúc đề mới.',
      status: 'done',
      progress: 100,
    },
    {
      id: 'starter-s2',
      sort_order: 1,
      title: 'Giai đoạn 2 · Chuyên đề vận dụng & ĐGNL đợt sớm',
      subtitle:
        'Chinh phục nhóm câu hỏi phân loại 8.5+ và rèn chiến thuật làm bài HSA / V-ACT / TSA.',
      status: 'active',
      progress: 60,
    },
    {
      id: 'starter-s3',
      sort_order: 2,
      title: 'Giai đoạn 3 · Thực chiến luyện đề bấm giờ',
      subtitle:
        'Hoàn thành 25–30 đề chuẩn cấu trúc, ghi chép sổ tay lỗi sai và lấp lỗ hổng từng chương.',
      status: 'locked',
      progress: 0,
    },
    {
      id: 'starter-s4',
      sort_order: 3,
      title: 'Giai đoạn 4 · Về đích & Tối ưu Nguyện vọng 1',
      subtitle:
        'Ổn định tâm lý phòng thi, đối chiếu phổ điểm chuẩn và sắp xếp danh sách nguyện vọng tối ưu.',
      status: 'locked',
      progress: 0,
    },
  ],
  university: [
    {
      id: 'starter-u1',
      sort_order: 0,
      title: 'Năm 1 · Chinh phục Đại cương & Phương pháp Đại học',
      subtitle:
        'Làm chủ Toán cao cấp, Triết học, Pháp luật đại cương; xây dựng nền tảng GPA ≥ 3.2/4.0.',
      status: 'done',
      progress: 100,
    },
    {
      id: 'starter-u2',
      sort_order: 1,
      title: 'Năm 2 · Cơ sở ngành & Chuẩn ngoại ngữ đầu ra',
      subtitle:
        'Tập trung các học phần cốt lõi chuyên ngành và hoàn thành chứng chỉ Tiếng Anh quốc tế.',
      status: 'active',
      progress: 45,
    },
    {
      id: 'starter-u3',
      sort_order: 2,
      title: 'Năm 3 · Chuyên ngành sâu, Nghiên cứu & Thực tập',
      subtitle:
        'Tham gia nhóm nghiên cứu khoa học / đồ án thực tế và ứng tuyển kỳ thực tập doanh nghiệp.',
      status: 'locked',
      progress: 0,
    },
    {
      id: 'starter-u4',
      sort_order: 3,
      title: 'Năm 4 · Khoá luận tốt nghiệp & Bứt phá sự nghiệp',
      subtitle:
        'Bảo vệ khoá luận xuất sắc, tối ưu GPA tích luỹ toàn khoá và sẵn sàng chinh phục nhà tuyển dụng.',
      status: 'locked',
      progress: 0,
    },
  ],
};

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
    label: 'Hoàn thành',
    icon: 'check_circle',
    badgeClass: 'bg-completed-soft text-completed border-completed-border',
    nodeClass: 'bg-completed border-completed text-white shadow-xs',
    cardClass: 'border-completed-border/80 bg-surface',
    barTone: 'completed',
    next: 'locked',
  },
  active: {
    label: 'Đang thực hiện',
    icon: 'trending_up',
    badgeClass: 'bg-gold-soft text-gold-dark border-gold',
    nodeClass: 'bg-primary border-primary text-white ring-4 ring-primary/15',
    cardClass: 'border-primary/45 shadow-md bg-surface',
    barTone: 'primary',
    next: 'done',
  },
  locked: {
    label: 'Đang chờ',
    icon: 'schedule',
    badgeClass: 'bg-surface-alt text-secondary-text border-border-strong',
    nodeClass: 'bg-surface border-border-strong text-secondary-text hover:border-primary',
    cardClass: 'border-border bg-paper/70 hover:border-border-strong',
    barTone: 'jade',
    next: 'active',
  },
};

const QUICK_STEPS = [0, 25, 50, 75, 100];

export default function Roadmap() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [mode, setMode] = useState(() => normalizeRoadmapMode(profile?.user_mode));
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
      const rowsToInsert = (sourceList || STARTER_MILESTONES[targetMode]).map((item, idx) => {
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
          title: (item.title || `Cột mốc ${idx + 1}`).trim(),
          subtitle: (item.subtitle || '').trim(),
          status,
          progress,
        };
      });

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
    [user],
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
              legacySaved || STARTER_MILESTONES[targetMode],
            );
            setMilestones(seeded);
          } else {
            setMilestones([]);
          }
        }
      } catch (err) {
        console.error('Lỗi tải lộ trình:', err);
        showToast('Không thể tải lộ trình từ máy chủ. Đang hiển thị bản xem trước.', 'error');
        setMilestones((STARTER_MILESTONES[targetMode] || []).map(mapMilestoneRow));
      } finally {
        setLoading(false);
      }
    },
    [seedStarterToDb, showToast, user],
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
      showToast('Đã nạp lộ trình mẫu (đăng nhập để lưu vĩnh viễn).', 'info');
      return;
    }

    setIsSeeding(true);
    try {
      const seeded = await seedStarterToDb(mode, STARTER_MILESTONES[mode]);
      setMilestones(seeded);
      showToast('Đã khởi tạo lộ trình mẫu thành công!', 'success');
    } catch (err) {
      showToast(`Không thể khởi tạo lộ trình mẫu: ${err.message}`, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const openCreateModal = () => {
    if (!user) {
      showToast('Vui lòng đăng nhập để thêm cột mốc cá nhân.', 'warning');
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
      showToast('Vui lòng đăng nhập để chỉnh sửa lộ trình cá nhân.', 'warning');
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
      showToast('Vui lòng nhập tiêu đề giai đoạn / cột mốc.', 'warning');
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
        showToast('Đã thêm cột mốc mới vào lộ trình!', 'success');
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
        showToast('Đã cập nhật cột mốc thành công!', 'success');
      }
      setIsEditModalOpen(false);
    } catch (err) {
      showToast(`Lỗi lưu cột mốc: ${err.message}`, 'error');
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
      showToast(`Không thể cập nhật trạng thái: ${error.message}`, 'error');
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
      showToast(`Không thể lưu tiến độ: ${error.message}`, 'error');
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
      // 3-step swap avoids collision on UNIQUE (user_id, mode, sort_order)
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
    } catch (err) {
      setMilestones(prevMilestones);
      showToast(`Không thể đổi thứ tự cột mốc: ${err.message}`, 'error');
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
      showToast(`Lỗi khi xoá cột mốc: ${error.message}`, 'error');
    } else {
      showToast('Đã xoá cột mốc khỏi lộ trình.', 'info');
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
      showToast('Vui lòng đăng nhập để lưu mục tiêu chiến lược.', 'warning');
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
      showToast('Đã cập nhật mục tiêu chiến lược!', 'success');
    } catch (err) {
      showToast(`Lỗi lưu mục tiêu: ${err.message}`, 'error');
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
                      ? 'Chiến Lược Khoa Trường · THPT'
                      : 'Lộ Trình Học Thuật · Đại Học'
                  }
                />
                {user && (
                  <span className="paper-chip text-jade border-jade-border bg-jade-soft">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      cloud_done
                    </span>
                    Đồng bộ trực tiếp
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground">
                Lộ Trình Học Tập Cá Nhân
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1 max-w-2xl">
                Thiết lập các cột mốc chiến lược, theo dõi tiến độ từng giai đoạn và giữ vững mục
                tiêu chinh phục bảng vàng.
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
                Mục tiêu
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="btn-arena btn-arena-primary btn-arena-sm"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  add_circle
                </span>
                Thêm cột mốc
              </button>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
            <div
              role="tablist"
              aria-label="Chọn bậc học lộ trình"
              className="inline-flex p-1 bg-surface-alt border border-border rounded-xl self-start"
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
                Học Sinh THPT
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
                Sinh Viên Đại Học
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
                    THPT: {profile?.target_thpt ?? 27.0}/30
                  </span>
                  <span className="paper-chip bg-jade-soft text-jade border-jade-border tabular">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      psychology
                    </span>
                    ĐGNL: {profile?.target_dgnl ?? 900}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/schools')}
                    className="paper-chip hover:border-primary hover:text-primary cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      account_balance
                    </span>
                    Tra cứu điểm chuẩn
                  </button>
                </>
              ) : (
                <>
                  <span className="paper-chip bg-jade-soft text-jade border-jade-border tabular">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      analytics
                    </span>
                    GPA hiện tại:{' '}
                    {profile?.current_gpa ? Number(profile.current_gpa).toFixed(2) : '—'}/4.0
                  </span>
                  <span className="paper-chip bg-gold-soft text-gold-dark border-gold tabular">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      workspace_premium
                    </span>
                    Mục tiêu:{' '}
                    {profile?.target_gpa && Number(profile.target_gpa) <= 4
                      ? Number(profile.target_gpa).toFixed(2)
                      : '3.60'}
                    /4.0
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/gpa')}
                    className="paper-chip hover:border-primary hover:text-primary cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      calculate
                    </span>
                    Bàn tính GPA
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {!user && (
          <div className="paper-card border-gold bg-gold-soft/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm font-medium text-foreground">
              Bạn đang xem lộ trình mẫu ở chế độ khách. Đăng nhập để lưu trữ và tuỳ biến cột mốc
              cá nhân trên đám mây.
            </p>
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="btn-arena btn-arena-gold btn-arena-sm self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                login
              </span>
              Đăng nhập ngay
            </button>
          </div>
        )}

        {/* Overall Progress Summary Card */}
        <section aria-label="Tổng quan tiến độ" className="paper-card p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
            <div>
              <span className="inline-block text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-primary-soft text-primary border border-primary/30 mb-2">
                {mode === 'student' ? 'Chiến dịch Vượt Vũ Môn' : 'Hành trình Tốt Nghiệp Xuất Sắc'}
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-foreground">
                Tổng Tiến Độ Lộ Trình
              </h2>
              <p className="text-xs sm:text-sm text-secondary-text mt-1 tabular">
                Đã hoàn thành <strong className="text-completed">{doneCount}</strong>/{totalCount}{' '}
                cột mốc · Đang thực hiện <strong className="text-accent">{activeCount}</strong> giai
                đoạn
              </p>
            </div>

            <div className="text-left sm:text-right no-shrink">
              <div className="text-3xl sm:text-4xl font-display font-extrabold text-primary tabular">
                {overallPercent}%
              </div>
              <p className="text-xs text-muted-foreground">Hoàn thành toàn lộ trình</p>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-display font-extrabold text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">
                timeline
              </span>
              Các Cột Mốc Chiến Lược ({totalCount})
            </h3>
            <p className="text-xs text-secondary-text">
              Nhấn vào nhãn trạng thái hoặc thanh phần trăm để cập nhật nhanh
            </p>
          </div>

          {loading ? (
            <div className="space-y-3" role="status" aria-label="Đang tải lộ trình">
              <ListItemSkeleton />
              <ListItemSkeleton />
              <ListItemSkeleton />
            </div>
          ) : milestones.length === 0 ? (
            <div className="paper-card p-10 text-center space-y-4 border-dashed">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gold-soft border border-gold flex items-center justify-center text-accent">
                <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                  explore
                </span>
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="font-display text-lg font-bold text-foreground">
                  Chưa có cột mốc nào cho chế độ này
                </h4>
                <p className="text-xs sm:text-sm text-secondary-text leading-relaxed">
                  Khởi tạo bộ lộ trình chuẩn chỉ với 1 cú nhấp hoặc tự thiết kế các giai đoạn ôn
                  luyện mang dấu ấn riêng của bạn.
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
                  {isSeeding ? 'Đang khởi tạo...' : 'Khởi tạo lộ trình mẫu'}
                </button>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="btn-arena btn-arena-primary btn-arena-sm"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    add
                  </span>
                  Tự tạo cột mốc đầu tiên
                </button>
              </div>
            </div>
          ) : (
            <div className="relative pl-5 sm:pl-7 border-l-2 border-border-strong space-y-5">
              {milestones.map((m, index) => {
                const meta = STATUS_META[m.status] || STATUS_META.locked;
                const isFirst = index === 0;
                const isLast = index === milestones.length - 1;
                const isConfirmingDelete = confirmDeleteId === m.id;

                return (
                  <article key={m.id} className="relative">
                    {/* Timeline Node Button (cycles status) */}
                    <button
                      type="button"
                      onClick={() => handleCycleStatus(m)}
                      title={`Đổi trạng thái cột mốc (hiện tại: ${meta.label})`}
                      aria-label={`Đổi trạng thái cột mốc ${index + 1}: ${m.title}`}
                      className={`absolute -left-[33px] sm:-left-[41px] top-4 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all border-2 ${meta.nodeClass}`}
                    >
                      {m.status === 'done' ? (
                        <span
                          className="material-symbols-outlined text-[15px] font-bold"
                          aria-hidden="true"
                        >
                          check
                        </span>
                      ) : (
                        <span className="text-xs font-bold tabular">{index + 1}</span>
                      )}
                    </button>

                    <div className={`paper-card p-4 sm:p-5 transition-all ${meta.cardClass}`}>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCycleStatus(m)}
                              title="Nhấn để chuyển trạng thái tiếp theo"
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-opacity hover:opacity-85 cursor-pointer ${meta.badgeClass}`}
                            >
                              <span
                                className="material-symbols-outlined text-[13px]"
                                aria-hidden="true"
                              >
                                {meta.icon}
                              </span>
                              {meta.label}
                            </button>
                            <span className="text-xs font-bold text-secondary-text tabular">
                              • Tiến độ {m.progress}%
                            </span>
                          </div>

                          <h4
                            className={`font-display font-bold text-base sm:text-lg leading-snug ${
                              m.status === 'locked' ? 'text-secondary-text' : 'text-foreground'
                            }`}
                          >
                            {m.title}
                          </h4>
                          {m.subtitle && (
                            <p className="text-xs sm:text-sm text-secondary-text leading-relaxed">
                              {m.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Action Controls */}
                        <div className="flex items-center gap-1 self-end sm:self-start no-shrink">
                          <button
                            type="button"
                            disabled={isFirst || Boolean(reorderingId)}
                            onClick={() => handleMoveMilestone(index, 'up')}
                            aria-label="Chuyển lên trên"
                            title="Chuyển lên trên"
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
                            disabled={isLast || Boolean(reorderingId)}
                            onClick={() => handleMoveMilestone(index, 'down')}
                            aria-label="Chuyển xuống dưới"
                            title="Chuyển xuống dưới"
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
                            aria-label={`Chỉnh sửa ${m.title}`}
                            title="Chỉnh sửa"
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
                            aria-label={`Xoá ${m.title}`}
                            title="Xoá cột mốc"
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
                            Bạn chắc chắn muốn xoá cột mốc này khỏi lộ trình?
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-bold text-secondary-text hover:text-foreground cursor-pointer"
                            >
                              Huỷ
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMilestone(m.id)}
                              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold cursor-pointer"
                            >
                              Xác nhận xoá
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
                              Kéo tiến độ:
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
                Thêm cột mốc chiến lược mới
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
            className="imperial-frame w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">
                  edit_note
                </span>
                {editingForm.id ? 'Chỉnh sửa cột mốc' : 'Thêm cột mốc mới'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                aria-label="Đóng hộp thoại"
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
                  Tiêu đề giai đoạn / Mục tiêu <span className="text-primary">*</span>
                </label>
                <input
                  id="milestone-title"
                  type="text"
                  required
                  maxLength={140}
                  placeholder="VD: Giai đoạn luyện 20 đề thực chiến Toán - Lý - Hoá"
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
                  Mô tả chi tiết / Kế hoạch hành động
                </label>
                <textarea
                  id="milestone-subtitle"
                  rows={3}
                  maxLength={400}
                  placeholder="VD: Mỗi tuần giải 3 đề bấm giờ, tổng hợp công thức giải nhanh..."
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
                    Trạng thái
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
                    <option value="active">Đang thực hiện</option>
                    <option value="done">Hoàn thành (100%)</option>
                    <option value="locked">Đang chờ (0%)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="milestone-progress"
                    className="block text-xs font-bold text-foreground mb-1.5 tabular"
                  >
                    Tiến độ ({editingForm.progress}%)
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
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-arena btn-arena-primary btn-arena-sm"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    save
                  </span>
                  {isSubmitting ? 'Đang lưu...' : 'Lưu cột mốc'}
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
            className="imperial-frame w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-accent" aria-hidden="true">
                  tune
                </span>
                Thiết lập Mục tiêu ({mode === 'student' ? 'THPT' : 'Đại học'})
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="Đóng hộp thoại mục tiêu"
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
                    <div className="flex items-center justify-between">
                      <label htmlFor="target-thpt" className="text-xs font-bold text-foreground">
                        Mục tiêu điểm thi THPT Quốc Gia (Hệ 30)
                      </label>
                      <span className="font-display font-extrabold text-lg text-primary tabular">
                        {targetThpt}đ
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
                    <div className="flex items-center justify-between">
                      <label htmlFor="target-dgnl" className="text-xs font-bold text-foreground">
                        Mục tiêu Đánh giá năng lực (Thang 1200)
                      </label>
                      <span className="font-display font-extrabold text-lg text-jade tabular">
                        {targetDgnl}đ
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
                  <div className="flex items-center justify-between">
                    <label htmlFor="target-gpa-uni" className="text-xs font-bold text-foreground">
                      Mục tiêu GPA tích luỹ Đại học (Hệ 4.0)
                    </label>
                    <span className="font-display font-extrabold text-lg text-primary tabular">
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
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="btn-arena btn-arena-primary btn-arena-sm"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    save
                  </span>
                  {isSavingSettings ? 'Đang lưu...' : 'Lưu mục tiêu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
