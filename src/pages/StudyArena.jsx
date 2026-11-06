import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserRank, RANK_TIERS } from '../utils/rankHelper';
import { getLevelFromExp, getLevelAccent, formatStudyTime } from '../utils/levelHelper';
import Avatar from '../components/Avatar';
import ProgressBar from '../components/ui/ProgressBar';
import RankSeal from '../components/ui/RankSeal';
import { ListItemSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastProvider';

const PUBLIC_PROFILE_DAILY_COLS =
  'id, display_name, avatar_url, role, university, user_mode, target_gpa, target_thpt, target_dgnl, current_gpa, is_approved_bang_chu, exp, study_seconds, study_streak, today_seconds, today_minutes, today_exp';

const PUBLIC_PROFILE_FULL_COLS =
  'id, display_name, avatar_url, role, university, user_mode, target_gpa, target_thpt, target_dgnl, current_gpa, is_approved_bang_chu, exp, study_seconds, study_streak';

const PUBLIC_PROFILE_FALLBACK_COLS =
  'id, display_name, avatar_url, role, university, user_mode, target_gpa, target_thpt, target_dgnl, current_gpa, is_approved_bang_chu';

function computeCampaignProgress(targets, isCompleted) {
  if (isCompleted) return { pct: 100, label: '100% · Hoàn thành' };
  if (!Array.isArray(targets) || targets.length === 0) {
    return { pct: 0, label: 'Đang thực hiện' };
  }
  const done = targets.filter((t) => Boolean(t?.completed)).length;
  const pct = Math.round((done / targets.length) * 100);
  return { pct, label: `${pct}% (${done}/${targets.length})` };
}

function formatDateVi(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('vi-VN');
}

export default function StudyArena() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const subTargetCounterRef = useRef(1);
  const nextSubTargetId = () => {
    subTargetCounterRef.current += 1;
    return `st-${Date.now()}-${subTargetCounterRef.current}`;
  };

  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'my_campaigns' | 'public'

  // Shared rank data: user_id -> completed campaigns count
  const [completedCountsMap, setCompletedCountsMap] = useState({});

  // Tab 1: Leaderboard state
  const [leaderboardMode, setLeaderboardMode] = useState('daily'); // 'daily' | 'all_time'
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [myRankPosition, setMyRankPosition] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);

  // Tab 2: My Campaigns state
  const [myCampaigns, setMyCampaigns] = useState([]);
  const [loadingMyCampaigns, setLoadingMyCampaigns] = useState(false);
  const [myFilter, setMyFilter] = useState('all'); // 'all' | 'active' | 'completed'
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Campaign creation form
  const [title, setTitle] = useState('');
  const [targetGoal, setTargetGoal] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPublicOption, setIsPublicOption] = useState(true);
  const [subTargets, setSubTargets] = useState([]);
  const [newSubTargetText, setNewSubTargetText] = useState('');
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  // Tab 3: Community Public Campaigns state
  const [publicCampaigns, setPublicCampaigns] = useState([]);
  const [loadingPublicCampaigns, setLoadingPublicCampaigns] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');

  const fetchCompletedCounts = useCallback(async (targetUserIds = []) => {
    const uniqueIds = [...new Set((targetUserIds || []).filter(Boolean))];
    if (uniqueIds.length === 0) return {};

    try {
      const counts = {};
      for (const uid of uniqueIds) {
        counts[uid] = 0;
      }

      // 1. Prefer server-side Index-Only Scan aggregation RPC (10k CCU safe)
      const rpcRes = await supabase.rpc('get_completed_campaign_counts', {
        p_user_ids: uniqueIds,
      });

      if (!rpcRes.error && Array.isArray(rpcRes.data)) {
        for (const row of rpcRes.data) {
          if (row.user_id) {
            counts[row.user_id] = Number(row.completed_count) || 0;
          }
        }
        setCompletedCountsMap((prev) => ({ ...prev, ...counts }));
        return counts;
      }

      // 2. Fallback: scoped .in('user_id', uniqueIds) query (never scan whole table)
      const { data, error } = await supabase
        .from('campaigns')
        .select('user_id')
        .eq('is_completed', true)
        .in('user_id', uniqueIds);

      if (error || !data) return counts;
      for (const row of data) {
        if (row.user_id) {
          counts[row.user_id] = (counts[row.user_id] || 0) + 1;
        }
      }
      setCompletedCountsMap((prev) => ({ ...prev, ...counts }));
      return counts;
    } catch {
      return {};
    }
  }, []);

  const adjustMyCompletedCount = useCallback(
    (delta) => {
      if (!user?.id || !delta) return;
      setCompletedCountsMap((prev) => {
        const nextVal = Math.max(0, (prev[user.id] || 0) + delta);
        return { ...prev, [user.id]: nextVal };
      });
      setLeaderboard((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? { ...item, completedCampaigns: Math.max(0, (item.completedCampaigns || 0) + delta) }
            : item,
        ),
      );
    },
    [user],
  );

  const fetchPublicProfilesByIds = useCallback(async (ids) => {
    const uniqueIds = [...new Set((ids || []).filter(Boolean))];
    if (uniqueIds.length === 0) return {};

    let res = await supabase
      .from('public_profile_view')
      .select(PUBLIC_PROFILE_FULL_COLS)
      .in('id', uniqueIds);

    if (res.error && res.error.code === '42703') {
      res = await supabase
        .from('public_profile_view')
        .select(PUBLIC_PROFILE_FALLBACK_COLS)
        .in('id', uniqueIds);
    }

    if (res.error || !res.data) return {};
    const map = {};
    for (const row of res.data) {
      map[row.id] = row;
    }
    return map;
  }, []);

  const fetchLeaderboardData = useCallback(
    async (modeOverride) => {
      const targetMode = modeOverride || leaderboardMode;
      setLoadingLeaderboard(true);
      try {
        let rawRows = null;

        if (targetMode === 'daily') {
          const rpcRes = await supabase.rpc('get_daily_top_scholars', {
            p_limit: 50,
            p_fallback: true,
          });
          if (!rpcRes.error && Array.isArray(rpcRes.data) && rpcRes.data.length > 0) {
            rawRows = rpcRes.data;
          }
        }

        if (!rawRows) {
          let res = await supabase
            .from('public_profile_view')
            .select(PUBLIC_PROFILE_DAILY_COLS)
            .order(targetMode === 'daily' ? 'today_seconds' : 'exp', {
              ascending: false,
              nullsFirst: false,
            })
            .order('exp', { ascending: false })
            .order('study_seconds', { ascending: false })
            .limit(50);

          if (res.error) {
            res = await supabase
              .from('public_profile_view')
              .select(PUBLIC_PROFILE_FULL_COLS)
              .order('exp', { ascending: false })
              .order('study_seconds', { ascending: false })
              .limit(50);
          }

          if (res.error && res.error.code === '42703') {
            res = await supabase
              .from('public_profile_view')
              .select(PUBLIC_PROFILE_FALLBACK_COLS)
              .limit(50);
          }

          if (res.error) throw res.error;
          rawRows = res.data || [];
        }

        const counts = await fetchCompletedCounts([
          ...rawRows.map((u) => u.id),
          user?.id,
        ]);

        const rows = rawRows.map((u) => {
          const todaySec = Number(u.today_seconds) || 0;
          const todayMin =
            Number(u.today_minutes) || Math.floor(Math.max(0, todaySec) / 60);
          return {
            ...u,
            exp: Number(u.exp) || 0,
            study_seconds: Number(u.study_seconds) || 0,
            study_streak: Number(u.study_streak) || 0,
            today_seconds: todaySec,
            today_minutes: todayMin,
            today_exp: Number(u.today_exp) || 0,
            is_today: Boolean(u.is_today) || todayMin > 0,
            completedCampaigns: counts[u.id] || 0,
          };
        });

        rows.sort((a, b) => {
          if (targetMode === 'daily') {
            if (a.is_today !== b.is_today) return a.is_today ? -1 : 1;
            if (b.today_seconds !== a.today_seconds) return b.today_seconds - a.today_seconds;
          }
          if (b.exp !== a.exp) return b.exp - a.exp;
          if (b.study_seconds !== a.study_seconds) return b.study_seconds - a.study_seconds;
          return b.completedCampaigns - a.completedCampaigns;
        });

        let currentRank = 1;
        const ranked = rows.map((u, idx) => {
          if (idx > 0) {
            const prev = rows[idx - 1];
            const isDifferent =
              targetMode === 'daily'
                ? u.today_seconds < prev.today_seconds ||
                  u.is_today !== prev.is_today ||
                  (u.today_seconds === 0 && (u.exp < prev.exp || u.study_seconds < prev.study_seconds))
                : u.exp < prev.exp || u.study_seconds < prev.study_seconds;
            if (isDifferent) {
              currentRank = idx + 1;
            }
          }
          return { ...u, rank: currentRank };
        });

        setLeaderboard(ranked);

        if (user) {
          const mine = ranked.find((item) => item.id === user.id);
          setMyRankPosition(mine ? mine.rank : '50+');
        } else {
          setMyRankPosition(null);
        }
      } catch (err) {
        console.error('Lỗi tải Bảng Vàng Công Lực:', err);
        showToast('Không thể tải Bảng Vàng Công Lực lúc này.', 'error');
      } finally {
        setLoadingLeaderboard(false);
      }
    },
    [fetchCompletedCounts, leaderboardMode, showToast, user],
  );

  const fetchMyCampaigns = useCallback(async () => {
    if (!user) {
      setMyCampaigns([]);
      return;
    }
    setLoadingMyCampaigns(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select(
          'id, user_id, title, description, target, targets, start_date, end_date, is_completed, is_public, created_at',
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMyCampaigns(data || []);
    } catch (err) {
      console.error('Lỗi tải chiến dịch cá nhân:', err);
      showToast('Không thể tải danh sách chiến dịch của bạn.', 'error');
    } finally {
      setLoadingMyCampaigns(false);
    }
  }, [showToast, user]);

  const fetchPublicCampaigns = useCallback(async () => {
    setLoadingPublicCampaigns(true);
    try {
      const campRes = await supabase
        .from('campaigns')
        .select(
          'id, user_id, title, description, target, targets, start_date, end_date, is_completed, is_public, created_at',
        )
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(60);

      if (campRes.error) throw campRes.error;
      const list = campRes.data || [];
      const authorIds = list.map((c) => c.user_id);

      const [profilesMap] = await Promise.all([
        fetchPublicProfilesByIds(authorIds),
        fetchCompletedCounts(authorIds),
      ]);

      setPublicCampaigns(
        list.map((c) => ({
          ...c,
          author: profilesMap[c.user_id] || null,
        })),
      );
    } catch (err) {
      console.error('Lỗi tải chiến dịch cộng đồng:', err);
      showToast('Không thể tải chiến dịch cộng đồng.', 'error');
    } finally {
      setLoadingPublicCampaigns(false);
    }
  }, [fetchCompletedCounts, fetchPublicProfilesByIds, showToast]);

  // Initial load for leaderboard & my campaigns count
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await fetchLeaderboardData();
      if (user) {
        await fetchMyCampaigns();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchLeaderboardData, fetchMyCampaigns, user]);

  // Load tab-specific data on tab switch
  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'leaderboard') {
      fetchLeaderboardData();
    } else if (tab === 'my_campaigns' && user) {
      fetchMyCampaigns();
    } else if (tab === 'public') {
      fetchPublicCampaigns();
    }
  };

  // Sub-target form helpers
  const handleAddSubTarget = () => {
    const clean = newSubTargetText.trim();
    if (!clean) return;
    setSubTargets((prev) => [...prev, { id: nextSubTargetId(), text: clean, completed: false }]);
    setNewSubTargetText('');
  };

  const handleRemoveSubTarget = (id) => {
    setSubTargets((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('Vui lòng đăng nhập để khởi tạo chiến dịch.', 'warning');
      return;
    }
    const cleanTitle = title.trim();
    const cleanDesc = description.trim();
    if (!cleanTitle || !cleanDesc) {
      showToast('Vui lòng nhập đầy đủ Tên chiến dịch và Mô tả kế hoạch.', 'warning');
      return;
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      showToast('Ngày bắt đầu không được lớn hơn ngày kết thúc.', 'error');
      return;
    }

    setIsCreatingCampaign(true);
    try {
      const payload = {
        user_id: user.id,
        title: cleanTitle,
        description: cleanDesc,
        target: targetGoal.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        targets: subTargets,
        is_completed: false,
        is_public: isPublicOption,
      };

      const { data, error } = await supabase
        .from('campaigns')
        .insert([payload])
        .select(
          'id, user_id, title, description, target, targets, start_date, end_date, is_completed, is_public, created_at',
        )
        .single();

      if (error) throw error;

      setMyCampaigns((prev) => [data, ...prev]);
      setTitle('');
      setTargetGoal('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setSubTargets([]);
      setNewSubTargetText('');
      showToast('Đã khởi động chiến dịch học tập mới!', 'success');
    } catch (err) {
      console.error('Lỗi tạo chiến dịch:', err);
      showToast('Không thể tạo chiến dịch: ' + err.message, 'error');
    } finally {
      setIsCreatingCampaign(false);
    }
  };

  const handleToggleSubTarget = async (campaign, subTargetId) => {
    if (!user) return;
    const currentList = Array.isArray(campaign.targets) ? campaign.targets : [];
    const updatedTargets = currentList.map((item) =>
      item.id === subTargetId ? { ...item, completed: !item.completed } : item,
    );
    const allDone = updatedTargets.length > 0 && updatedTargets.every((t) => Boolean(t.completed));

    setMyCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaign.id ? { ...c, targets: updatedTargets, is_completed: allDone } : c,
      ),
    );

    const { error } = await supabase
      .from('campaigns')
      .update({ targets: updatedTargets, is_completed: allDone })
      .eq('id', campaign.id)
      .eq('user_id', user.id);

    if (error) {
      showToast('Không thể cập nhật mục tiêu nhỏ: ' + error.message, 'error');
      fetchMyCampaigns();
      return;
    }

    if (allDone && !campaign.is_completed) {
      showToast(`Chúc mừng! Bạn đã hoàn thành chiến dịch "${campaign.title}"!`, 'success');
    }
    if (allDone !== Boolean(campaign.is_completed)) {
      adjustMyCompletedCount(allDone ? 1 : -1);
    }
  };

  const handleToggleCampaignComplete = async (campaign) => {
    if (!user) return;
    const nextCompleted = !campaign.is_completed;

    setMyCampaigns((prev) =>
      prev.map((c) => (c.id === campaign.id ? { ...c, is_completed: nextCompleted } : c)),
    );

    const { error } = await supabase
      .from('campaigns')
      .update({ is_completed: nextCompleted })
      .eq('id', campaign.id)
      .eq('user_id', user.id);

    if (error) {
      showToast('Không thể cập nhật trạng thái chiến dịch: ' + error.message, 'error');
      fetchMyCampaigns();
      return;
    }

    showToast(
      nextCompleted
        ? `Tuyệt vời! Đã hoàn thành chiến dịch "${campaign.title}".`
        : 'Đã mở lại chiến dịch để tiếp tục rèn luyện.',
      nextCompleted ? 'success' : 'info',
    );
    adjustMyCompletedCount(nextCompleted ? 1 : -1);
  };

  const handleToggleCampaignPublic = async (campaign) => {
    if (!user) return;
    const nextPublic = !campaign.is_public;

    setMyCampaigns((prev) =>
      prev.map((c) => (c.id === campaign.id ? { ...c, is_public: nextPublic } : c)),
    );

    const { error } = await supabase
      .from('campaigns')
      .update({ is_public: nextPublic })
      .eq('id', campaign.id)
      .eq('user_id', user.id);

    if (error) {
      showToast('Không thể đổi chế độ hiển thị: ' + error.message, 'error');
      fetchMyCampaigns();
      return;
    }

    showToast(
      nextPublic ? 'Đã chia sẻ chiến dịch lên Cộng đồng.' : 'Đã chuyển chiến dịch về Riêng tư.',
      'info',
    );
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!user) return;
    const backup = myCampaigns;
    const deletedTarget = myCampaigns.find((c) => c.id === campaignId);
    setMyCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    setConfirmDeleteId(null);

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('user_id', user.id);

    if (error) {
      setMyCampaigns(backup);
      showToast('Không thể xoá chiến dịch: ' + error.message, 'error');
      return;
    }

    showToast('Đã xoá chiến dịch.', 'info');
    if (deletedTarget?.is_completed) {
      adjustMyCompletedCount(-1);
    }
  };

  // Derived personal stats
  const myCompletedCount = user
    ? myCampaigns.length > 0
      ? myCampaigns.filter((c) => c.is_completed).length
      : completedCountsMap[user.id] || 0
    : 0;

  const myExp = Number(profile?.exp) || 0;
  const myRankInfo = getUserRank(
    myExp,
    profile?.role,
    profile?.is_approved_bang_chu,
    user?.id,
  );
  const myStudySeconds = Number(profile?.study_seconds) || 0;
  const myStreak = Number(profile?.study_streak) || 0;
  const myLevel = getLevelFromExp(myExp);
  const myLevelAccent = getLevelAccent(myLevel.level);
  const myDisplayName =
    profile?.display_name || profile?.full_name || user?.email?.split('@')[0] || 'Học giả';

  // Filtered leaderboard
  const filteredLeaderboard = leaderboard.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = (item.display_name || '').toLowerCase().includes(q);
    const uniMatch = (item.university || '').toLowerCase().includes(q);
    return nameMatch || uniMatch;
  });

  const isSearching = searchQuery.trim().length > 0;
  const top3 = !isSearching ? filteredLeaderboard.slice(0, 3) : [];
  const restOfList = !isSearching ? filteredLeaderboard.slice(3) : filteredLeaderboard;

  // Filtered personal campaigns
  const visibleMyCampaigns = myCampaigns.filter((c) => {
    if (myFilter === 'completed') return Boolean(c.is_completed);
    if (myFilter === 'active') return !c.is_completed;
    return true;
  });

  // Filtered community campaigns
  const visiblePublicCampaigns = publicCampaigns.filter((c) => {
    if (!communitySearch.trim()) return true;
    const q = communitySearch.toLowerCase();
    return (
      (c.title || '').toLowerCase().includes(q) ||
      (c.target || '').toLowerCase().includes(q) ||
      (c.author?.display_name || '').toLowerCase().includes(q) ||
      (c.author?.university || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      {/* Imperial Header Banner */}
      <div className="relative bg-paper border-b border-border overflow-hidden py-8 sm:py-10 px-4">
        <span
          aria-hidden="true"
          className="hanzi-watermark hidden md:block absolute top-3 right-10 text-[120px] font-bold text-accent/8 select-none pointer-events-none"
        >
          金榜
        </span>

        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <div className="mb-3">
            <RankSeal icon="local_fire_department" label="Đấu Trường Học Tập · Khoa Bảng" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-foreground mb-2">
            Đấu Trường &amp; Bảng Vàng Công Lực
          </h1>
          <p className="text-secondary-text text-sm sm:text-base max-w-2xl mx-auto mb-6 leading-relaxed">
            Tích luỹ <strong className="text-foreground">Công Lực (EXP)</strong> qua thời gian tự học xác thực
            và chinh phục các <strong className="text-foreground">Chiến Dịch Học Tập</strong> để thăng tiến Quân Hàm!
          </p>

          {/* 3-Tab Switcher */}
          <div
            role="tablist"
            aria-label="Phân khu Đấu Trường Học Tập"
            className="inline-flex flex-wrap justify-center p-1.5 bg-surface-alt border border-border rounded-2xl gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'leaderboard'}
              onClick={() => handleSelectTab('leaderboard')}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-display font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-secondary-text hover:text-foreground'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                emoji_events
              </span>
              <span>Bảng Vàng Công Lực</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'my_campaigns'}
              onClick={() => handleSelectTab('my_campaigns')}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-display font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'my_campaigns'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-secondary-text hover:text-foreground'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                flag
              </span>
              <span>Chiến Dịch Của Ta</span>
              {user && myCampaigns.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full tabular ${
                    activeTab === 'my_campaigns'
                      ? 'bg-paper/20 text-primary-foreground'
                      : 'bg-paper border border-border text-foreground'
                  }`}
                >
                  {myCampaigns.length}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'public'}
              onClick={() => handleSelectTab('public')}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-display font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'public'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-secondary-text hover:text-foreground'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                public
              </span>
              <span>Chiến Dịch Cộng Đồng</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 -mt-5 relative z-20 space-y-6">
        {/* PERSONAL SCHOLAR CARD */}
        {user && (
          <section className="imperial-frame p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0">
                  <Avatar
                    src={profile?.avatar_url}
                    name={myDisplayName}
                    className="w-16 h-16 border-2 border-gold shadow-xs"
                    textSize="text-2xl"
                  />
                  <div
                    className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md text-[10px] font-bold border ${myRankInfo.bg} ${myRankInfo.color} ${myRankInfo.border} shadow-2xs flex items-center gap-0.5 whitespace-nowrap`}
                  >
                    <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                      {myRankInfo.icon}
                    </span>
                    <span>{myRankInfo.name}</span>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-secondary-text font-medium">Lệnh bài sĩ tử:</span>
                    <button
                      type="button"
                      onClick={() => setIsRankModalOpen(true)}
                      className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                        help_outline
                      </span>
                      <span>Cấp bậc &amp; Quân hàm</span>
                    </button>
                  </div>

                  <h2 className="text-lg font-display font-extrabold text-foreground truncate">
                    {myDisplayName}
                  </h2>

                  <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-secondary-text flex items-center gap-1">
                      <span
                        className="material-symbols-outlined text-[15px] text-accent"
                        aria-hidden="true"
                      >
                        trophy
                      </span>
                      Hạng:{' '}
                      <strong className="text-foreground tabular">
                        #{myRankPosition || '...'}
                      </strong>
                    </span>

                    <span className="text-border-strong">•</span>

                    <span
                      className={`tabular inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${myLevelAccent.badge}`}
                    >
                      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                        bolt
                      </span>
                      Lv.{myLevel.level} · {myLevel.totalExp.toLocaleString('vi-VN')} EXP
                    </span>

                    <span className="text-border-strong">•</span>

                    <span className="text-xs font-semibold text-secondary-text flex items-center gap-1 tabular">
                      <span
                        className="material-symbols-outlined text-[15px] text-jade"
                        aria-hidden="true"
                      >
                        schedule
                      </span>
                      <strong className="text-foreground">{formatStudyTime(myStudySeconds)}</strong>
                    </span>

                    {myStreak > 0 && (
                      <>
                        <span className="text-border-strong">•</span>
                        <span className="text-xs font-bold text-primary flex items-center gap-0.5 tabular">
                          <span
                            className="material-symbols-outlined text-[15px]"
                            aria-hidden="true"
                          >
                            local_fire_department
                          </span>
                          {myStreak} ngày liên tiếp
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Dual Progression Box: Level EXP & Campaign Rank */}
              <div className="w-full lg:w-80 bg-paper p-3.5 rounded-xl border border-border space-y-3">
                <ProgressBar
                  value={myLevel.progressPct}
                  max={100}
                  tone="jade"
                  label={`Công lực Lv.${myLevel.level} → Lv.${myLevel.level + 1}`}
                  sublabel={`${myLevel.expIntoLevel}/${myLevel.expForThisLevel} EXP`}
                />

                {myRankInfo.nextRank && myRankInfo.progress ? (
                  <div>
                    <ProgressBar
                      value={myRankInfo.progress.percentage}
                      max={100}
                      tone="primary"
                      label={`Quân hàm → ${myRankInfo.nextRank.name}`}
                      sublabel={`${myExp.toLocaleString('vi-VN')}/${myRankInfo.progress.target.toLocaleString('vi-VN')} EXP`}
                    />
                  </div>
                ) : (
                  <p className="text-[11px] font-display font-bold text-primary flex items-center justify-between pt-1 border-t border-border">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">
                        auto_awesome
                      </span>
                      {myRankInfo.isBangChu
                        ? 'Ngôi vị độc tôn: Bang Chủ'
                        : `Hạng tối đa: ${myRankInfo.name}`}
                    </span>
                    <span className="tabular text-secondary-text">
                      {myExp.toLocaleString('vi-VN')} EXP · {myCompletedCount} CD
                    </span>
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* TAB 1: BẢNG VÀNG CÔNG LỰC (LIVE LEADERBOARD)                        */}
        {/* =================================================================== */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {/* Search & Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <span
                  className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg"
                  aria-hidden="true"
                >
                  search
                </span>
                <input
                  type="text"
                  placeholder="Tìm sĩ tử theo tên hiển thị hoặc trường học..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 bg-surface border border-border-strong rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Xoá từ khoá tìm kiếm"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      close
                    </span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="inline-flex p-1 rounded-xl bg-surface-alt border border-border gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLeaderboardMode('daily');
                      fetchLeaderboardData('daily');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      leaderboardMode === 'daily'
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-secondary-text hover:text-foreground'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      local_fire_department
                    </span>
                    <span>Top Hôm Nay (Phút học)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLeaderboardMode('all_time');
                      fetchLeaderboardData('all_time');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      leaderboardMode === 'all_time'
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-secondary-text hover:text-foreground'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      emoji_events
                    </span>
                    <span>Tổng Công Lực</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/hoc-online')}
                  className="btn-arena btn-arena-secondary btn-arena-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-jade" aria-hidden="true">
                    bolt
                  </span>
                  <span>Luyện công +EXP</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRankModalOpen(true)}
                  className="btn-arena btn-arena-secondary btn-arena-sm cursor-pointer"
                >
                  <span
                    className="material-symbols-outlined text-base text-accent"
                    aria-hidden="true"
                  >
                    military_tech
                  </span>
                  <span>Quân hàm</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchLeaderboardData()}
                  className="btn-arena btn-arena-gold btn-arena-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    refresh
                  </span>
                  <span>Làm mới</span>
                </button>
              </div>
            </div>

            {loadingLeaderboard ? (
              <div className="space-y-3">
                <ListItemSkeleton />
                <ListItemSkeleton />
                <ListItemSkeleton />
                <ListItemSkeleton />
              </div>
            ) : filteredLeaderboard.length === 0 ? (
              <div className="text-center py-16 paper-card border-dashed">
                <span
                  className="material-symbols-outlined text-4xl text-muted-foreground mb-2"
                  aria-hidden="true"
                >
                  person_search
                </span>
                <p className="text-foreground font-display font-bold">
                  {isSearching
                    ? 'Không tìm thấy sĩ tử nào khớp với từ khoá'
                    : 'Bảng Vàng đang chờ những sĩ tử đầu tiên ghi danh'}
                </p>
                <p className="text-xs text-secondary-text mt-1">
                  {isSearching
                    ? 'Hãy thử tìm bằng tên khác hoặc tên trường viết tắt.'
                    : 'Mở trang Học Online để tích luỹ Công Lực (EXP) và chiếm ngôi Trạng Nguyên!'}
                </p>
              </div>
            ) : (
              <>
                {/* Top 3 Imperial Podium */}
                {!isSearching && top3.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 md:pt-6 items-end">
                    {top3[1] && (
                      <PodiumCard
                        scholar={top3[1]}
                        place={2}
                        mode={leaderboardMode}
                        isCurrentUser={top3[1].id === user?.id}
                      />
                    )}
                    {top3[0] && (
                      <PodiumCard
                        scholar={top3[0]}
                        place={1}
                        mode={leaderboardMode}
                        isCurrentUser={top3[0].id === user?.id}
                      />
                    )}
                    {top3[2] && (
                      <PodiumCard
                        scholar={top3[2]}
                        place={3}
                        mode={leaderboardMode}
                        isCurrentUser={top3[2].id === user?.id}
                      />
                    )}
                  </div>
                )}

                {/* Detailed Leaderboard List */}
                <div className="paper-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-paper">
                    <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                      <span
                        className="material-symbols-outlined text-primary text-lg"
                        aria-hidden="true"
                      >
                        format_list_bulleted
                      </span>
                      {isSearching
                        ? `Kết quả tìm kiếm (${filteredLeaderboard.length})`
                        : leaderboardMode === 'daily'
                          ? 'Sĩ Tử Tiêu Biểu Trong Ngày (Theo Số Phút Học Thực Tế)'
                          : 'Danh Sách Khoa Bảng Chi Tiết (Top 50 Công Lực)'}
                    </h3>
                    <span className="text-[11px] text-secondary-text font-medium">
                      Nhấn vào sĩ tử để xem Hồ sơ &amp; Chiến dịch công khai
                    </span>
                  </div>

                  {restOfList.length > 0 ? (
                    <div className="divide-y divide-border">
                      {restOfList.map((scholar) => {
                        const isMe = Boolean(user && scholar.id === user.id);
                        const sRank = getUserRank(
                          scholar.exp,
                          scholar.role,
                          scholar.is_approved_bang_chu,
                          scholar.id,
                        );
                        const sLv = getLevelFromExp(scholar.exp);
                        const sLvAccent = getLevelAccent(sLv.level);

                        return (
                          <Link
                            to={`/profile/${scholar.id}`}
                            key={scholar.id}
                            className={`px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 transition-colors hover:bg-surface-alt ${
                              isMe ? 'bg-primary-soft/50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                              <span
                                className={`w-8 text-center font-display font-extrabold text-sm shrink-0 tabular ${
                                  scholar.rank <= 3
                                    ? 'text-accent'
                                    : isMe
                                      ? 'text-primary'
                                      : 'text-muted-foreground'
                                }`}
                              >
                                #{scholar.rank}
                              </span>

                              <Avatar
                                src={scholar.avatar_url}
                                name={scholar.display_name || 'Sĩ tử'}
                                className="w-10 h-10 shrink-0"
                                textSize="text-sm"
                              />

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p
                                    className={`text-sm font-bold truncate ${
                                      isMe ? 'text-primary' : 'text-foreground'
                                    }`}
                                  >
                                    {scholar.display_name || 'Sĩ tử ẩn danh'}
                                  </p>
                                  {isMe && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                                      Bạn
                                    </span>
                                  )}
                                  <span
                                    className={`hidden sm:inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded border ${sRank.bg} ${sRank.color} ${sRank.border}`}
                                  >
                                    <span
                                      className="material-symbols-outlined text-[12px]"
                                      aria-hidden="true"
                                    >
                                      {sRank.icon}
                                    </span>
                                    {sRank.name}
                                  </span>
                                  <span
                                    className={`tabular inline-flex items-center text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${sLvAccent.badge}`}
                                  >
                                    Lv.{sLv.level}
                                  </span>
                                </div>

                                <p className="text-xs text-secondary-text truncate mt-0.5">
                                  {scholar.university || 'Chưa cập nhật trường'}
                                  {scholar.completedCampaigns > 0
                                    ? ` · ${scholar.completedCampaigns} chiến dịch hoàn thành`
                                    : ''}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-2.5">
                              <div>
                                {leaderboardMode === 'daily' && scholar.today_minutes > 0 ? (
                                  <>
                                    <p className="text-sm font-display font-extrabold text-jade tabular">
                                      {scholar.today_minutes >= 60
                                        ? formatStudyTime(scholar.today_seconds)
                                        : `${scholar.today_minutes} phút hôm nay`}
                                    </p>
                                    <p className="text-[11px] text-secondary-text tabular">
                                      +{scholar.today_exp.toLocaleString('vi-VN')} EXP hôm nay · Tổng{' '}
                                      {scholar.exp.toLocaleString('vi-VN')} EXP
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-sm font-display font-extrabold text-primary tabular">
                                      {scholar.exp.toLocaleString('vi-VN')} EXP
                                    </p>
                                    <p className="text-[11px] text-secondary-text tabular">
                                      {formatStudyTime(scholar.study_seconds)}
                                      {scholar.today_minutes > 0
                                        ? ` · Hôm nay ${scholar.today_minutes}p`
                                        : ''}
                                      {scholar.study_streak > 0
                                        ? ` · 🔥${scholar.study_streak}n`
                                        : ''}
                                    </p>
                                  </>
                                )}
                              </div>
                              <span
                                className="material-symbols-outlined text-muted-foreground text-sm hidden sm:inline-block"
                                aria-hidden="true"
                              >
                                chevron_right
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    !isSearching && (
                      <div className="p-8 text-center text-secondary-text text-sm">
                        Hiện có {top3.length} sĩ tử dẫn đầu trên Bục Vinh Quang. Hãy rủ thêm đồng môn cùng thi đua!
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: CHIẾN DỊCH CỦA TA (CAMPAIGNS CRUD)                           */}
        {/* =================================================================== */}
        {activeTab === 'my_campaigns' && (
          <div>
            {!user ? (
              <div className="paper-card p-10 text-center space-y-4">
                <span
                  className="material-symbols-outlined text-5xl text-accent"
                  aria-hidden="true"
                >
                  flag_circle
                </span>
                <h3 className="font-display text-xl font-extrabold text-foreground">
                  Đăng nhập để lập Chiến Dịch Học Tập
                </h3>
                <p className="text-sm text-secondary-text max-w-md mx-auto">
                  Chia nhỏ mục tiêu ôn thi thành từng chặng rõ ràng, theo dõi tiến độ mỗi ngày và
                  kết hợp tích lũy EXP học tập để thăng cấp Quân Hàm!
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="btn-arena btn-arena-primary cursor-pointer"
                >
                  Đăng nhập ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Campaign Creation Form */}
                <div className="lg:col-span-5 paper-card p-5 space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-border">
                    <div className="w-9 h-9 rounded-xl bg-primary-soft border border-primary/30 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">
                        add_task
                      </span>
                    </div>
                    <div>
                      <h3 className="font-display text-base font-extrabold text-foreground">
                        Khởi Tạo Chiến Dịch Mới
                      </h3>
                      <p className="text-[11px] text-secondary-text">
                        Hoàn thành chiến dịch để thăng Quân Hàm
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateCampaign} className="space-y-4">
                    <div>
                      <label
                        htmlFor="camp-title"
                        className="block text-xs font-bold text-foreground mb-1.5"
                      >
                        Tên chiến dịch <span className="text-primary">*</span>
                      </label>
                      <input
                        id="camp-title"
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="VD: Tổng ôn 30 đề Toán chinh phục 9.2+"
                        className="w-full bg-surface border border-border-strong rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="camp-target"
                        className="block text-xs font-bold text-foreground mb-1.5"
                      >
                        Mục tiêu trọng tâm (Đích đến)
                      </label>
                      <input
                        id="camp-target"
                        type="text"
                        value={targetGoal}
                        onChange={(e) => setTargetGoal(e.target.value)}
                        placeholder="VD: Đỗ NV1 Bách Khoa · 27.5+ Khối A00 / GPA 3.6"
                        className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="camp-desc"
                        className="block text-xs font-bold text-foreground mb-1.5"
                      >
                        Lời thề quyết tâm / Kế hoạch <span className="text-primary">*</span>
                      </label>
                      <textarea
                        id="camp-desc"
                        rows={3}
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Mô tả chiến lược ôn luyện, khung giờ học mỗi ngày..."
                        className="w-full bg-surface border border-border-strong rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="camp-start"
                          className="block text-xs font-bold text-foreground mb-1"
                        >
                          Ngày bắt đầu
                        </label>
                        <input
                          id="camp-start"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary tabular"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="camp-end"
                          className="block text-xs font-bold text-foreground mb-1"
                        >
                          Hạn hoàn thành
                        </label>
                        <input
                          id="camp-end"
                          type="date"
                          min={startDate || undefined}
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary tabular"
                        />
                      </div>
                    </div>

                    {/* Checklist Builder */}
                    <div className="p-3.5 rounded-xl bg-surface-alt border border-border space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          Danh sách nhiệm vụ nhỏ
                        </span>
                        <span className="text-[11px] text-secondary-text tabular">
                          {subTargets.length} nhiệm vụ
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newSubTargetText}
                          onChange={(e) => setNewSubTargetText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSubTarget();
                            }
                          }}
                          placeholder="Thêm bước thực hiện (Enter để thêm)..."
                          className="flex-1 bg-paper border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={handleAddSubTarget}
                          aria-label="Thêm nhiệm vụ nhỏ"
                          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold cursor-pointer"
                        >
                          Thêm
                        </button>
                      </div>

                      {subTargets.length > 0 && (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                          {subTargets.map((item, idx) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-paper border border-border text-xs"
                            >
                              <span className="truncate text-foreground">
                                <strong className="text-secondary-text tabular mr-1.5">
                                  {idx + 1}.
                                </strong>
                                {item.text}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSubTarget(item.id)}
                                aria-label={`Xoá mục ${item.text}`}
                                className="text-muted-foreground hover:text-primary cursor-pointer shrink-0"
                              >
                                <span
                                  className="material-symbols-outlined text-sm"
                                  aria-hidden="true"
                                >
                                  close
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Public Toggle */}
                    <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-paper border border-border cursor-pointer hover:border-border-strong transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`material-symbols-outlined text-lg ${
                            isPublicOption ? 'text-jade' : 'text-secondary-text'
                          }`}
                          aria-hidden="true"
                        >
                          {isPublicOption ? 'public' : 'lock'}
                        </span>
                        <div>
                          <span className="block text-xs font-bold text-foreground">
                            Công khai lên Chiến Dịch Cộng Đồng
                          </span>
                          <span className="block text-[11px] text-secondary-text">
                            Lan toả tinh thần hiếu học cùng các đồng môn
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isPublicOption}
                        onChange={(e) => setIsPublicOption(e.target.checked)}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={isCreatingCampaign}
                      className="btn-arena btn-arena-primary w-full justify-center cursor-pointer disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">
                        {isCreatingCampaign ? 'hourglass_empty' : 'rocket_launch'}
                      </span>
                      <span>
                        {isCreatingCampaign ? 'Đang khởi tạo...' : 'Phất Cờ Khởi Động Chiến Dịch'}
                      </span>
                    </button>
                  </form>
                </div>

                {/* Right Column: Personal Campaigns List */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display text-base font-extrabold text-foreground flex items-center gap-2">
                      <span
                        className="material-symbols-outlined text-primary text-xl"
                        aria-hidden="true"
                      >
                        swords
                      </span>
                      <span>Chiến Dịch Đang Theo Đuổi ({myCampaigns.length})</span>
                    </h3>

                    <div className="inline-flex p-1 rounded-xl bg-surface-alt border border-border gap-1">
                      {[
                        { key: 'all', label: 'Tất cả' },
                        { key: 'active', label: 'Đang chạy' },
                        { key: 'completed', label: 'Hoàn thành' },
                      ].map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setMyFilter(f.key)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            myFilter === f.key
                              ? 'bg-paper text-primary border border-border-strong'
                              : 'text-secondary-text hover:text-foreground'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loadingMyCampaigns ? (
                    <div className="space-y-3">
                      <ListItemSkeleton />
                      <ListItemSkeleton />
                    </div>
                  ) : visibleMyCampaigns.length === 0 ? (
                    <div className="paper-card border-dashed p-10 text-center space-y-2">
                      <span
                        className="material-symbols-outlined text-4xl text-muted-foreground"
                        aria-hidden="true"
                      >
                        inventory_2
                      </span>
                      <p className="font-display font-bold text-foreground">
                        {myCampaigns.length === 0
                          ? 'Bạn chưa lập chiến dịch nào'
                          : 'Không có chiến dịch nào trong bộ lọc này'}
                      </p>
                      <p className="text-xs text-secondary-text">
                        Điền biểu mẫu bên trái để dựng ngọn cờ mục tiêu đầu tiên của bạn!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visibleMyCampaigns.map((camp) => {
                        const prog = computeCampaignProgress(camp.targets, camp.is_completed);
                        const startFmt = formatDateVi(camp.start_date);
                        const endFmt = formatDateVi(camp.end_date);

                        return (
                          <article
                            key={camp.id}
                            className={`paper-card p-5 space-y-4 transition-all ${
                              camp.is_completed
                                ? 'border-completed-border bg-completed-soft/25'
                                : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-display text-base font-extrabold text-foreground">
                                    {camp.title}
                                  </h4>
                                  {camp.is_completed && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-completed-soft text-completed border border-completed-border">
                                      <span
                                        className="material-symbols-outlined text-[12px]"
                                        aria-hidden="true"
                                      >
                                        verified
                                      </span>
                                      Đã hoàn thành
                                    </span>
                                  )}
                                  {camp.target && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gold-soft text-gold-dark border border-gold">
                                      <span
                                        className="material-symbols-outlined text-[12px]"
                                        aria-hidden="true"
                                      >
                                        ads_click
                                      </span>
                                      {camp.target}
                                    </span>
                                  )}
                                </div>

                                {(startFmt || endFmt) && (
                                  <p className="text-[11px] text-secondary-text flex items-center gap-1 tabular">
                                    <span
                                      className="material-symbols-outlined text-[14px]"
                                      aria-hidden="true"
                                    >
                                      calendar_month
                                    </span>
                                    <span>
                                      {startFmt || 'Bắt đầu ngay'} → {endFmt || 'Không giới hạn'}
                                    </span>
                                  </p>
                                )}
                              </div>

                              {/* Quick Actions: Toggle Public & Delete */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCampaignPublic(camp)}
                                  title={
                                    camp.is_public
                                      ? 'Đang công khai · Nhấn để chuyển sang Riêng tư'
                                      : 'Đang riêng tư · Nhấn để chia sẻ Cộng đồng'
                                  }
                                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                    camp.is_public
                                      ? 'bg-jade-soft text-jade border-jade-border'
                                      : 'bg-surface-alt text-secondary-text border-border'
                                  }`}
                                >
                                  <span
                                    className="material-symbols-outlined text-[14px]"
                                    aria-hidden="true"
                                  >
                                    {camp.is_public ? 'public' : 'lock'}
                                  </span>
                                  <span>{camp.is_public ? 'Công khai' : 'Riêng tư'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDeleteId((prev) =>
                                      prev === camp.id ? null : camp.id,
                                    )
                                  }
                                  aria-label={`Xoá chiến dịch ${camp.title}`}
                                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                                >
                                  <span
                                    className="material-symbols-outlined text-[16px]"
                                    aria-hidden="true"
                                  >
                                    delete
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* Inline Delete Confirmation */}
                            {confirmDeleteId === camp.id && (
                              <div className="p-3 rounded-xl bg-primary-soft border border-primary/35 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground">
                                  Xác nhận xoá chiến dịch này?
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCampaign(camp.id)}
                                    className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold cursor-pointer"
                                  >
                                    Xoá vĩnh viễn
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-3 py-1 rounded-lg bg-paper border border-border text-xs font-semibold text-secondary-text cursor-pointer"
                                  >
                                    Huỷ
                                  </button>
                                </div>
                              </div>
                            )}

                            <p className="text-xs sm:text-sm text-secondary-text bg-surface-alt p-3 rounded-xl border border-border leading-relaxed">
                              {camp.description}
                            </p>

                            <ProgressBar
                              value={prog.pct}
                              max={100}
                              tone={camp.is_completed ? 'jade' : 'primary'}
                              label="Tiến độ chiến dịch"
                              sublabel={prog.label}
                            />

                            {/* Interactive Sub-targets Checklist */}
                            {Array.isArray(camp.targets) && camp.targets.length > 0 && (
                              <div className="space-y-2 pt-1">
                                {camp.targets.map((item) => {
                                  const checked = Boolean(item.completed);
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => handleToggleSubTarget(camp, item.id)}
                                      className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                                        checked
                                          ? 'bg-completed-soft/40 border-completed-border text-completed'
                                          : 'bg-paper border-border hover:border-primary/40 text-foreground'
                                      }`}
                                    >
                                      <span
                                        className="material-symbols-outlined text-lg shrink-0"
                                        aria-hidden="true"
                                      >
                                        {checked ? 'check_circle' : 'radio_button_unchecked'}
                                      </span>
                                      <span
                                        className={`text-xs sm:text-sm font-medium ${
                                          checked ? 'line-through opacity-80' : ''
                                        }`}
                                      >
                                        {item.text}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Complete / Reopen Campaign Button */}
                            <div className="pt-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleToggleCampaignComplete(camp)}
                                className={`px-4 py-2 rounded-xl text-xs font-display font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  camp.is_completed
                                    ? 'bg-surface-alt border border-border text-secondary-text hover:text-foreground'
                                    : 'bg-jade text-white hover:opacity-95 shadow-2xs'
                                }`}
                              >
                                <span
                                  className="material-symbols-outlined text-base"
                                  aria-hidden="true"
                                >
                                  {camp.is_completed ? 'replay' : 'task_alt'}
                                </span>
                                <span>
                                  {camp.is_completed
                                    ? 'Mở lại chiến dịch'
                                    : 'Đánh dấu Hoàn thành Chiến dịch'}
                                </span>
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: CHIẾN DỊCH CỘNG ĐỒNG (PUBLIC CAMPAIGNS)                      */}
        {/* =================================================================== */}
        {activeTab === 'public' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <span
                  className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg"
                  aria-hidden="true"
                >
                  search
                </span>
                <input
                  type="text"
                  value={communitySearch}
                  onChange={(e) => setCommunitySearch(e.target.value)}
                  placeholder="Tìm chiến dịch theo chủ đề, mục tiêu hoặc tên sĩ tử..."
                  className="w-full pl-10 pr-9 py-2.5 bg-surface border border-border-strong rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                {communitySearch && (
                  <button
                    type="button"
                    onClick={() => setCommunitySearch('')}
                    aria-label="Xoá tìm kiếm"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      close
                    </span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={fetchPublicCampaigns}
                className="btn-arena btn-arena-gold btn-arena-sm cursor-pointer self-end sm:self-auto"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  refresh
                </span>
                <span>Làm mới</span>
              </button>
            </div>

            {loadingPublicCampaigns ? (
              <div className="space-y-3">
                <ListItemSkeleton />
                <ListItemSkeleton />
                <ListItemSkeleton />
              </div>
            ) : visiblePublicCampaigns.length === 0 ? (
              <div className="paper-card border-dashed p-12 text-center space-y-2">
                <span
                  className="material-symbols-outlined text-4xl text-muted-foreground"
                  aria-hidden="true"
                >
                  public_off
                </span>
                <p className="font-display font-bold text-foreground">
                  {communitySearch.trim()
                    ? 'Không tìm thấy chiến dịch cộng đồng phù hợp'
                    : 'Chưa có chiến dịch công khai nào'}
                </p>
                <p className="text-xs text-secondary-text">
                  Hãy tạo một chiến dịch ở mục &ldquo;Chiến Dịch Của Ta&rdquo; và bật chế độ Công khai để truyền cảm hứng!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visiblePublicCampaigns.map((camp) => {
                  const author = camp.author;
                  const authorRank = getUserRank(
                    author?.exp || 0,
                    author?.role,
                    author?.is_approved_bang_chu,
                    camp.user_id,
                  );
                  const authorLv = getLevelFromExp(author?.exp || 0);
                  const authorLvAccent = getLevelAccent(authorLv.level);
                  const prog = computeCampaignProgress(camp.targets, camp.is_completed);
                  const endFmt = formatDateVi(camp.end_date);

                  return (
                    <article
                      key={camp.id}
                      className="paper-card p-5 flex flex-col justify-between gap-4 hover:border-border-strong transition-all"
                    >
                      <div className="space-y-3">
                        {/* Author Header */}
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to={`/profile/${camp.user_id}`}
                            className="flex items-center gap-2.5 min-w-0 group"
                          >
                            <Avatar
                              src={author?.avatar_url}
                              name={author?.display_name || 'Sĩ tử'}
                              className="w-10 h-10 border border-border shrink-0"
                              textSize="text-xs"
                            />
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {author?.display_name || 'Sĩ tử ẩn danh'}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span
                                  className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${authorRank.bg} ${authorRank.color} ${authorRank.border}`}
                                >
                                  <span
                                    className="material-symbols-outlined text-[11px]"
                                    aria-hidden="true"
                                  >
                                    {authorRank.icon}
                                  </span>
                                  {authorRank.name}
                                </span>
                                <span
                                  className={`tabular text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${authorLvAccent.badge}`}
                                >
                                  Lv.{authorLv.level}
                                </span>
                              </div>
                            </div>
                          </Link>

                          <span className="text-[11px] text-muted-foreground tabular shrink-0">
                            {formatDateVi(camp.created_at)}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-display text-base font-extrabold text-foreground">
                              {camp.title}
                            </h4>
                            {camp.target && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-soft text-gold-dark border border-gold">
                                {camp.target}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-secondary-text line-clamp-3 leading-relaxed">
                            {camp.description}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-border space-y-2">
                        <ProgressBar
                          value={prog.pct}
                          max={100}
                          tone={camp.is_completed ? 'jade' : 'primary'}
                          label={camp.is_completed ? 'Đã về đích' : 'Tiến độ'}
                          sublabel={prog.label}
                        />
                        {endFmt && (
                          <p className="text-[11px] text-secondary-text flex items-center justify-end gap-1 tabular">
                            <span
                              className="material-symbols-outlined text-[13px]"
                              aria-hidden="true"
                            >
                              event
                            </span>
                            Hạn đích: {endFmt}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* RANK & LEVEL GUIDE MODAL */}
      {isRankModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsRankModalOpen(false)}
        >
          <div
            className="imperial-frame w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-paper">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">
                  military_tech
                </span>
                <h3 className="font-display font-bold text-base text-foreground">
                  Hệ Thống Công Lực &amp; Quân Hàm (EXP)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRankModalOpen(false)}
                aria-label="Đóng hộp thoại"
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[75vh] overflow-y-auto bg-surface">
              <div className="p-3.5 rounded-xl bg-jade-soft/50 border border-jade-border text-xs text-foreground leading-relaxed">
                <strong>1. Cấp độ Công Lực (Lv &amp; EXP):</strong> Tích luỹ tự động mỗi phút bạn ôn tập tại{' '}
                <strong>Học Online</strong> (+10 EXP/phút, tối đa 5 giờ/ngày + thưởng chuỗi ngày học liên tiếp).
              </div>
              <div className="p-3.5 rounded-xl bg-gold-soft/50 border border-gold text-xs text-foreground leading-relaxed">
                <strong>2. Mức Hạng Quân Hàm:</strong> EXP tích luỹ càng cao thì mức hạng càng cao.
                Riêng ngôi vị <strong>Bang Chủ</strong> chỉ có duy nhất 1 tài khoản tối cao nắm giữ (không ai khác được phép là Bang Chủ):
              </div>

              {RANK_TIERS.map((tier) => {
                const isCurrent = myRankInfo.name === tier.name;
                return (
                  <div
                    key={tier.name}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isCurrent
                        ? `${tier.bg} ${tier.border} ring-1 ring-primary/30`
                        : 'bg-paper border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border ${tier.bg} ${tier.color} ${tier.border}`}
                      >
                        <span className="material-symbols-outlined text-xl" aria-hidden="true">
                          {tier.icon}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`font-display font-bold text-sm ${tier.color}`}>
                            {tier.name}
                          </h4>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                              Quân hàm hiện tại
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary-text mt-0.5 tabular">
                          {tier.exclusiveBangChu
                            ? 'Ngôi vị độc tôn — Chỉ duy nhất 1 tài khoản được phép là Bang Chủ'
                            : tier.min === 0
                              ? 'Khởi điểm khi gia nhập Đấu Trường (0 EXP)'
                              : `Tích lũy đạt từ ${tier.min.toLocaleString('vi-VN')} EXP`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-display font-extrabold text-secondary-text tabular">
                      {tier.exclusiveBangChu
                        ? 'Độc tôn'
                        : `${tier.min.toLocaleString('vi-VN')} EXP`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PodiumCard({ scholar, place, mode = 'daily', isCurrentUser }) {
  const rank = getUserRank(
    scholar.exp || 0,
    scholar.role,
    scholar.is_approved_bang_chu,
    scholar.id,
  );
  const lv = getLevelFromExp(scholar.exp || 0);
  const lvAccent = getLevelAccent(lv.level);
  const todayMin =
    Number(scholar.today_minutes) ||
    Math.floor(Math.max(0, Number(scholar.today_seconds) || 0) / 60);

  const placeConfig = {
    1: {
      order: 'md:order-2 md:-mt-4',
      border:
        'border-gold ring-2 ring-gold/35 bg-gradient-to-b from-gold-soft/70 via-surface to-surface',
      badgeBg: 'bg-primary text-primary-foreground border border-gold',
      label: 'TRẠNG NGUYÊN · TOP 1',
      icon: 'workspace_premium',
      avatarSize: 'w-20 h-20',
    },
    2: {
      order: 'md:order-1',
      border: 'border-border-strong bg-surface',
      badgeBg: 'bg-surface-alt text-foreground border border-border-strong',
      label: 'BẢNG NHÃN · TOP 2',
      icon: 'diamond',
      avatarSize: 'w-16 h-16',
    },
    3: {
      order: 'md:order-3',
      border: 'border-gold/60 bg-surface',
      badgeBg: 'bg-gold-soft text-gold-dark border border-gold',
      label: 'THÁM HOA · TOP 3',
      icon: 'local_fire_department',
      avatarSize: 'w-16 h-16',
    },
  }[place];

  return (
    <Link
      to={`/profile/${scholar.id}`}
      className={`${placeConfig.order} relative flex flex-col items-center p-5 rounded-2xl border ${placeConfig.border} shadow-sm transition-transform hover:-translate-y-1 cursor-pointer group`}
    >
      <div
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider mb-3 shadow-xs ${placeConfig.badgeBg}`}
      >
        <span className="material-symbols-outlined text-xs" aria-hidden="true">
          {placeConfig.icon}
        </span>
        <span>{placeConfig.label}</span>
      </div>

      <div className="relative mb-3">
        <Avatar
          src={scholar.avatar_url}
          name={scholar.display_name || 'Sĩ tử'}
          className={`${placeConfig.avatarSize} border-2 border-gold shadow-xs group-hover:scale-105 transition-transform`}
          textSize={place === 1 ? 'text-2xl' : 'text-xl'}
        />
      </div>

      <h3 className="font-display font-bold text-base text-foreground text-center line-clamp-1 group-hover:text-primary transition-colors">
        {scholar.display_name || 'Sĩ tử ẩn danh'} {isCurrentUser ? '(Bạn)' : ''}
      </h3>
      <p className="text-xs text-secondary-text text-center line-clamp-1 mb-3">
        {scholar.university || 'Chưa cập nhật trường'}
      </p>

      <div className="flex items-center gap-1.5 mb-3 flex-wrap justify-center">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${rank.bg} ${rank.color} ${rank.border}`}
        >
          <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
            {rank.icon}
          </span>
          {rank.name}
        </span>
        <span
          className={`tabular inline-flex items-center text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${lvAccent.badge}`}
        >
          Lv.{lv.level}
        </span>
      </div>

      <div className="w-full pt-3 border-t border-border text-center space-y-0.5">
        {mode === 'daily' && todayMin > 0 ? (
          <>
            <p className="text-lg font-display font-extrabold text-jade tabular">
              {todayMin >= 60 ? formatStudyTime(scholar.today_seconds) : `${todayMin} phút hôm nay`}
            </p>
            <p className="text-[11px] text-secondary-text tabular">
              +{(scholar.today_exp || 0).toLocaleString('vi-VN')} EXP hôm nay · Tổng{' '}
              {(scholar.exp || 0).toLocaleString('vi-VN')} EXP
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-display font-extrabold text-primary tabular">
              {(scholar.exp || 0).toLocaleString('vi-VN')} EXP
            </p>
            <p className="text-[11px] text-secondary-text tabular">
              {formatStudyTime(scholar.study_seconds)}
              {todayMin > 0 ? ` · Hôm nay ${todayMin}p` : ''}
              {scholar.study_streak > 0 ? ` · 🔥 ${scholar.study_streak} ngày` : ''}
            </p>
          </>
        )}
      </div>
    </Link>
  );
}
