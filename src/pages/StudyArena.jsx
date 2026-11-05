import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserRank, RANK_TIERS } from '../utils/rankHelper';
import { getLevelFromExp, getLevelAccent } from '../utils/levelHelper';
import Avatar from '../components/Avatar';
import ProgressBar from '../components/ui/ProgressBar';
import RankSeal from '../components/ui/RankSeal';

export default function StudyArena() {
  const { user, profile } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myRankPosition, setMyRankPosition] = useState(null);

  const [timeFilter, setTimeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);

  const fetchAllTimeLeaderboard = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, school_name, grade, total_study_minutes, exp, avatar_url, is_thong_soai')
      .order('total_study_minutes', { ascending: false })
      .limit(100);

    if (error) throw error;

    if (data) {
      let currentRank = 1;
      const rankedData = data.map((u, index) => {
        if (index > 0 && (u.total_study_minutes || 0) < (data[index - 1].total_study_minutes || 0)) {
          currentRank = index + 1;
        }
        return { ...u, rank: currentRank };
      });

      setLeaderboard(rankedData);

      if (user) {
        const myData = rankedData.find((u) => u.id === user.id);
        if (myData) {
          setMyRankPosition(myData.rank);
        } else {
          const myMinutes = profile?.total_study_minutes || 0;
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gt('total_study_minutes', myMinutes);

          setMyRankPosition(count !== null ? count + 1 : '100+');
        }
      }
    }
  }, [profile?.total_study_minutes, user]);

  const fetchWeeklyLeaderboard = useCallback(async () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const day = String(monday.getDate()).padStart(2, '0');
    const startOfWeekStr = `${year}-${month}-${day}`;

    const { data, error } = await supabase.rpc('get_weekly_leaderboard', {
      start_date: startOfWeekStr,
    });

    if (error) {
      console.error('Chưa cài đặt hàm SQL get_weekly_leaderboard:', error);
      await fetchAllTimeLeaderboard();
      return;
    }

    if (data) {
      let currentRank = 1;
      const rankedData = data.map((u, index) => {
        if (index > 0 && (u.total_study_minutes || 0) < (data[index - 1].total_study_minutes || 0)) {
          currentRank = index + 1;
        }
        return { ...u, rank: currentRank };
      });

      setLeaderboard(rankedData);

      if (user) {
        const myData = rankedData.find((u) => u.id === user.id);
        setMyRankPosition(myData ? myData.rank : 'Chưa có');
      }
    }
  }, [fetchAllTimeLeaderboard, user]);

  const fetchLeaderboardData = useCallback(async () => {
    setLoading(true);
    try {
      if (timeFilter === 'all') {
        await fetchAllTimeLeaderboard();
      } else {
        await fetchWeeklyLeaderboard();
      }
    } catch (err) {
      console.error('Lỗi tải BXH:', err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchAllTimeLeaderboard, fetchWeeklyLeaderboard, timeFilter]);

  useEffect(() => {
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  const formatTime = (minutes) => {
    if (!minutes || minutes <= 0) return '0 phút';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} phút`;
    if (m === 0) return `${h} giờ`;
    return `${h}h ${m}p`;
  };

  const myMinutes =
    timeFilter === 'all'
      ? profile?.total_study_minutes || 0
      : leaderboard.find((u) => u.id === user?.id)?.total_study_minutes || 0;

  const rankInfo = getUserRank(profile?.total_study_minutes || 0, profile?.is_thong_soai);
  const myLevel = getLevelFromExp(profile?.exp || 0);
  const myLevelAccent = getLevelAccent(myLevel.level);

  const filteredLeaderboard = leaderboard.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = (item.full_name || '').toLowerCase().includes(query);
    const schoolMatch = (item.school_name || '').toLowerCase().includes(query);
    return nameMatch || schoolMatch;
  });

  const isSearching = searchQuery.trim().length > 0;
  const top3 = !isSearching ? filteredLeaderboard.slice(0, 3) : [];
  const restOfList = !isSearching ? filteredLeaderboard.slice(3) : filteredLeaderboard;

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      {/* Header Banner */}
      <div className="relative bg-paper border-b border-border overflow-hidden py-8 sm:py-10 px-4">
        <span
          aria-hidden="true"
          className="hanzi-watermark hidden md:block absolute top-4 right-10 text-[120px] font-bold text-accent/8"
        >
          金榜
        </span>

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <div className="mb-3">
            <RankSeal icon="local_fire_department" label="Đấu Trường Chăm Chỉ · Bảng Vàng" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-foreground mb-2">
            Bảng Phong Thần Học Tập
          </h1>
          <p className="text-secondary-text text-sm sm:text-base max-w-xl mx-auto mb-6 leading-relaxed">
            Nơi vinh danh những sĩ tử kiên trì nhất. Thời gian học được tự động tích lũy mỗi phút khi bạn ôn luyện trên hệ thống!
          </p>

          {/* Time Filter Tabs */}
          <div className="inline-flex p-1.5 bg-surface-alt border border-border rounded-xl">
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-5 py-2 rounded-lg text-xs sm:text-sm font-display font-bold transition-all flex items-center gap-2 cursor-pointer ${
                timeFilter === 'all'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-secondary-text hover:text-foreground'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                military_tech
              </span>
              Tổng Toàn Thời Gian
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('weekly')}
              className={`px-5 py-2 rounded-lg text-xs sm:text-sm font-display font-bold transition-all flex items-center gap-2 cursor-pointer ${
                timeFilter === 'weekly'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-secondary-text hover:text-foreground'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                bolt
              </span>
              Đua Top Tuần Này
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 -mt-5 relative z-20 space-y-6">
        {/* Thẻ Thành Tích Cá Nhân */}
        {user && (
          <div className="imperial-frame p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="relative">
                  <Avatar
                    src={profile?.avatar_url}
                    name={profile?.full_name || user?.email}
                    className="w-16 h-16 border-2 border-gold shadow-xs"
                    textSize="text-2xl"
                  />
                  <div
                    className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md text-[10px] font-bold border ${rankInfo.bg} ${rankInfo.color} ${rankInfo.border} shadow-2xs flex items-center gap-0.5`}
                  >
                    <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                      {rankInfo.icon}
                    </span>
                    {rankInfo.name}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-secondary-text font-medium">Chiến binh:</p>
                    <button
                      type="button"
                      onClick={() => setIsRankModalOpen(true)}
                      className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                        help_outline
                      </span>
                      Hệ thống cấp bậc
                    </button>
                  </div>
                  <h2 className="text-lg font-display font-extrabold text-foreground">
                    {profile?.full_name || 'Học viên ẩn danh'}
                  </h2>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs font-semibold text-secondary-text flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-accent" aria-hidden="true">
                        trophy
                      </span>
                      Hạng {timeFilter === 'weekly' ? 'Tuần' : 'Tổng'}:{' '}
                      <strong className="text-foreground tabular">
                        {myRankPosition === 'Chưa có' ? 'Chưa có' : `#${myRankPosition || '...'}`}
                      </strong>
                    </span>
                    <span className="text-border-strong">•</span>
                    <span className="text-xs font-semibold text-secondary-text flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-jade" aria-hidden="true">
                        schedule
                      </span>
                      {timeFilter === 'weekly' ? 'Tuần này' : 'Tích lũy'}:{' '}
                      <strong className="text-primary tabular">{formatTime(myMinutes)}</strong>
                    </span>
                    <span className="text-border-strong">•</span>
                    <span
                      className={`tabular inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${myLevelAccent.badge}`}
                      title={`${myLevel.expInLevel}/${myLevel.expForNext} EXP tới cấp tiếp theo`}
                    >
                      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                        bolt
                      </span>
                      Lv.{myLevel.level} · {myLevel.totalExp} EXP
                    </span>
                  </div>
                </div>
              </div>

              {/* Thanh tiến trình lên bậc tiếp theo */}
              <div className="w-full sm:w-64 bg-paper p-3.5 rounded-xl border border-border">
                {rankInfo.nextRank ? (
                  <>
                    <ProgressBar
                      value={rankInfo.progress}
                      max={100}
                      tone="primary"
                      label={`Tiến trình lên ${rankInfo.nextRank.name}`}
                    />
                    <p className="text-[10px] text-secondary-text mt-1.5 text-right tabular">
                      Cần thêm{' '}
                      <strong className="text-foreground">
                        {formatTime(rankInfo.nextRank.min - (profile?.total_study_minutes || 0))}
                      </strong>{' '}
                      tổng thời gian
                    </p>
                  </>
                ) : (
                  <div className="text-center py-1">
                    <p className="text-xs font-display font-bold text-primary flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-base" aria-hidden="true">
                        auto_awesome
                      </span>
                      Đỉnh Cao Thống Soái
                    </p>
                    <p className="text-[10px] text-secondary-text mt-0.5">
                      Bạn là huyền thoại của Đấu Trường Học Tập!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Thanh Tìm Kiếm & Nút Làm Mới */}
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
              placeholder="Tìm kiếm chiến binh theo tên hoặc trường..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-surface border border-border-strong rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xoá từ khoá"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  close
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsRankModalOpen(true)}
              className="btn-arena btn-arena-secondary btn-arena-sm"
            >
              <span className="material-symbols-outlined text-base text-accent" aria-hidden="true">
                military_tech
              </span>
              Xem bảng cấp bậc
            </button>
            <button
              type="button"
              onClick={fetchLeaderboardData}
              className="btn-arena btn-arena-gold btn-arena-sm"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                refresh
              </span>
              Làm mới
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span
              className="material-symbols-outlined animate-spin text-4xl text-primary"
              aria-hidden="true"
            >
              sync
            </span>
            <p className="text-xs text-secondary-text">Đang triệu hồi Bảng Phong Thần...</p>
          </div>
        ) : filteredLeaderboard.length === 0 ? (
          <div className="text-center py-16 paper-card border-dashed">
            <span
              className="material-symbols-outlined text-4xl text-muted-foreground mb-2"
              aria-hidden="true"
            >
              event_busy
            </span>
            <p className="text-foreground font-display font-bold">
              {isSearching
                ? 'Không tìm thấy chiến binh nào khớp với từ khóa'
                : 'Chưa có dữ liệu học tập trong tuần này'}
            </p>
            <p className="text-xs text-secondary-text mt-1">
              {isSearching
                ? 'Hãy thử tìm bằng tên khác hoặc tên trường viết tắt xem sao nhé!'
                : 'Hãy là người đầu tiên mở sách và chiếm lấy Ngôi Vương tuần này!'}
            </p>
          </div>
        ) : (
          <>
            {/* Bục Vinh Quang (Top 3 Podium) */}
            {!isSearching && top3.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 md:pt-6 items-end">
                {/* Hạng 2 */}
                {top3[1] && (
                  <PodiumCard
                    student={top3[1]}
                    place={2}
                    formatTime={formatTime}
                    isCurrentUser={top3[1].id === user?.id}
                  />
                )}

                {/* Hạng 1 */}
                {top3[0] && (
                  <PodiumCard
                    student={top3[0]}
                    place={1}
                    formatTime={formatTime}
                    isCurrentUser={top3[0].id === user?.id}
                  />
                )}

                {/* Hạng 3 */}
                {top3[2] && (
                  <PodiumCard
                    student={top3[2]}
                    place={3}
                    formatTime={formatTime}
                    isCurrentUser={top3[2].id === user?.id}
                  />
                )}
              </div>
            )}

            {/* Danh sách xếp hạng chi tiết */}
            <div className="paper-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-paper">
                <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-primary text-lg"
                    aria-hidden="true"
                  >
                    format_list_bulleted
                  </span>
                  {isSearching
                    ? `Kết quả tìm kiếm (${filteredLeaderboard.length})`
                    : 'Bảng Xếp Hạng Chi Tiết'}
                </h3>
                <span className="text-[11px] text-secondary-text font-medium">
                  Nhấn vào tên để xem Hồ sơ Chiến binh
                </span>
              </div>

              {restOfList.length > 0 ? (
                <div className="divide-y divide-border">
                  {restOfList.map((student) => {
                    const isMe = user && student.id === user.id;
                    const sRank = getUserRank(student.total_study_minutes, student.is_thong_soai);
                    const sLv = getLevelFromExp(student.exp || 0);
                    const sLvAccent = getLevelAccent(sLv.level);

                    return (
                      <Link
                        to={`/profile/${student.id}`}
                        key={student.id}
                        className={`content-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 transition-colors hover:bg-surface-alt ${
                          isMe ? 'bg-primary-soft/60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <span
                            className={`w-7 text-center font-display font-extrabold text-sm no-shrink tabular ${
                              student.rank <= 3
                                ? 'text-accent'
                                : isMe
                                  ? 'text-primary'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            #{student.rank}
                          </span>

                          <Avatar
                            src={student.avatar_url}
                            name={student.full_name}
                            className="w-10 h-10 no-shrink"
                            textSize="text-sm"
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p
                                className={`text-sm font-bold truncate transition-colors ${
                                  isMe ? 'text-primary' : 'text-foreground'
                                }`}
                              >
                                {student.full_name || 'Chiến binh ẩn danh'}
                              </p>
                              {isMe && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-white">
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
                              {student.school_name || 'Chưa cập nhật trường'}{' '}
                              {student.grade ? `• ${student.grade}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right no-shrink flex items-center gap-2">
                          <div>
                            <p className="text-sm font-display font-bold text-foreground tabular">
                              {formatTime(student.total_study_minutes)}
                            </p>
                            <p className="text-[10px] text-secondary-text sm:hidden">{sRank.name}</p>
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
                    Hiện chỉ mới có {top3.length} chiến binh trên bảng vàng. Hãy rủ thêm bạn bè cùng học nhé!
                  </div>
                )
              )}
            </div>
          </>
        )}
      </main>

      {/* MODAL BẢNG CẤP BẬC */}
      {isRankModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
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
                  Hệ Thống Cấp Bậc Chiến Binh
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRankModalOpen(false)}
                aria-label="Đóng"
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[75vh] overflow-y-auto bg-surface">
              <p className="text-xs text-secondary-text mb-4 leading-relaxed">
                Cấp bậc được tính dựa trên{' '}
                <strong className="text-foreground">Tổng thời gian học tập toàn thời gian</strong> của bạn trên Đấu Trường Học Tập.
              </p>

              {RANK_TIERS.map((tier, idx) => {
                const isCurrent = rankInfo.name === tier.name;
                return (
                  <div
                    key={idx}
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
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                              Cấp của bạn
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary-text mt-0.5 tabular">
                          Yêu cầu:{' '}
                          {tier.min === 0 ? 'Mặc định khi tham gia' : `Từ ${formatTime(tier.min)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-muted-foreground tabular">
                        {tier.max === Infinity ? '4500+ phút' : `${tier.min} - ${tier.max}p`}
                      </span>
                    </div>
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

function PodiumCard({ student, place, formatTime, isCurrentUser }) {
  const rank = getUserRank(student.total_study_minutes, student.is_thong_soai);
  const lv = getLevelFromExp(student.exp || 0);
  const lvAccent = getLevelAccent(lv.level);

  const placeConfig = {
    1: {
      order: 'md:order-2 md:-mt-4',
      border: 'border-gold ring-2 ring-gold/35 bg-gradient-to-b from-gold-soft/70 via-surface to-surface',
      badgeBg: 'bg-primary text-white border border-gold',
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
      to={`/profile/${student.id}`}
      className={`${placeConfig.order} relative flex flex-col items-center p-5 rounded-2xl border ${placeConfig.border} shadow-sm transition-transform hover:-translate-y-1 cursor-pointer group`}
    >
      <div
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider mb-3 shadow-xs ${placeConfig.badgeBg}`}
      >
        <span className="material-symbols-outlined text-xs icon-fill" aria-hidden="true">
          {placeConfig.icon}
        </span>
        <span>{placeConfig.label}</span>
      </div>

      <div className="relative mb-3">
        <Avatar
          src={student.avatar_url}
          name={student.full_name}
          className={`${placeConfig.avatarSize} border-2 border-gold shadow-xs group-hover:scale-105 transition-transform`}
          textSize={place === 1 ? 'text-2xl' : 'text-xl'}
        />
      </div>

      <h3 className="font-display font-bold text-base text-foreground text-center line-clamp-1 group-hover:text-primary transition-colors">
        {student.full_name || 'Chiến binh'} {isCurrentUser && '(Bạn)'}
      </h3>
      <p className="text-xs text-secondary-text text-center line-clamp-1 mb-3">
        {student.school_name || 'THPT Quốc Gia'}
      </p>

      <div className="flex items-center gap-1.5 mb-3 flex-wrap justify-center">
        <div
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${rank.bg} ${rank.color} ${rank.border}`}
        >
          <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
            {rank.icon}
          </span>
          {rank.name}
        </div>
        <span
          className={`tabular inline-flex items-center text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${lvAccent.badge}`}
        >
          Lv.{lv.level}
        </span>
      </div>

      <div className="w-full pt-3 border-t border-border text-center">
        <span className="text-lg font-display font-extrabold text-primary tabular">
          {formatTime(student.total_study_minutes)}
        </span>
      </div>
    </Link>
  );
}
