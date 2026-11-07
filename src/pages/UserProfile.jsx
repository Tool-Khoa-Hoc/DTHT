import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getUserRank } from '../utils/rankHelper';
import { getLevelFromExp, getLevelAccent, formatStudyTime } from '../utils/levelHelper';
import { sanitizeExternalUrl } from '../utils/urlSecurity';
import { getDocumentKindMeta } from '../lib/documents';
import { getLocalizedCategoryLabel } from '../i18n/communityAndAdmin';
import Avatar from '../components/Avatar';
import ProgressBar from '../components/ui/ProgressBar';
import { ListItemSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastProvider';

const PUBLIC_VIEW_FULL_COLS =
  'id, display_name, avatar_url, role, university, user_mode, target_gpa, target_thpt, target_dgnl, current_gpa, is_approved_bang_chu, exp, study_seconds, study_streak';

const PUBLIC_VIEW_FALLBACK_COLS =
  'id, display_name, avatar_url, role, university, user_mode, target_gpa, target_thpt, target_dgnl, current_gpa, is_approved_bang_chu';

function computeCampaignProgress(targets, isCompleted, t) {
  if (isCompleted) return { pct: 100, label: t('userProfile.campaignCompletedLabel') };
  if (!Array.isArray(targets) || targets.length === 0) {
    return { pct: 0, label: t('userProfile.campaignInProgress') };
  }
  const done = targets.filter((item) => Boolean(item?.completed || item?.is_completed)).length;
  const pct = Math.round((done / targets.length) * 100);
  return { pct, label: `${pct}% (${done}/${targets.length})` };
}

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { lang, t, formatNumber, formatDate } = useLanguage();
  const { showToast } = useToast();

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [scholar, setScholar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completedCampaignsCount, setCompletedCampaignsCount] = useState(0);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [campaigns, setCampaigns] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState('campaigns'); // 'campaigns' | 'documents'

  const fetchScholarAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      let profileRes = await supabase
        .from('public_profile_view')
        .select(PUBLIC_VIEW_FULL_COLS)
        .eq('id', id)
        .maybeSingle();

      if (profileRes.error && profileRes.error.code === '42703') {
        profileRes = await supabase
          .from('public_profile_view')
          .select(PUBLIC_VIEW_FALLBACK_COLS)
          .eq('id', id)
          .maybeSingle();
      }

      if (profileRes.error) throw profileRes.error;
      setScholar(profileRes.data || null);

      if (!profileRes.data) {
        setLoading(false);
        return;
      }

      const [
        completedRes,
        followersRes,
        followingRes,
        followStatusRes,
        pubCampaignsRes,
        pubDocsRes,
      ] = await Promise.all([
        supabase
          .from('campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', id)
          .eq('is_completed', true),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', id),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', id),
        currentUser && currentUser.id !== id
          ? supabase
              .from('follows')
              .select('id')
              .eq('follower_id', currentUser.id)
              .eq('following_id', id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('campaigns')
          .select(
            'id, title, description, target, targets, start_date, end_date, is_completed, created_at',
          )
          .eq('user_id', id)
          .eq('is_public', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('documents')
          .select(
            'id, title, description, category, education_level, major, file_url, file_type, file_size, downloads_count, uploaded_at, created_at',
          )
          .eq('uploaded_by', id)
          .eq('is_public', true)
          .order('uploaded_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false }),
      ]);

      if (!completedRes.error) {
        setCompletedCampaignsCount(completedRes.count || 0);
      }
      if (!followersRes.error) {
        setFollowersCount(followersRes.count || 0);
      }
      if (!followingRes.error) {
        setFollowingCount(followingRes.count || 0);
      }
      if (!followStatusRes.error) {
        setIsFollowing(Boolean(followStatusRes.data));
      }
      if (!pubCampaignsRes.error) {
        setCampaigns(pubCampaignsRes.data || []);
      }
      if (!pubDocsRes.error) {
        setDocuments(pubDocsRes.data || []);
      }
    } catch (err) {
      console.error('Error loading public scholar profile:', err);
      showToast(tRef.current('userProfile.toastLoadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [currentUser, id, showToast]);

  useEffect(() => {
    if (currentUser && currentUser.id === id) {
      navigate('/profile', { replace: true });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) {
        await fetchScholarAll();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, fetchScholarAll, id, navigate]);

  const handleToggleFollow = async () => {
    if (!currentUser) {
      showToast(t('userProfile.toastSignInToFollow'), 'warning');
      navigate('/auth');
      return;
    }
    if (!id || currentUser.id === id) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', id);

        if (error) throw error;
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
        showToast(t('userProfile.toastUnfollowed'), 'info');
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: currentUser.id, following_id: id });

        if (error) throw error;
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
        showToast(
          t('userProfile.toastFollowed', {
            name: scholar?.display_name || t('userProfile.defaultScholar'),
          }),
          'success',
        );
      }
    } catch (err) {
      console.error('Error updating follow status:', err);
      showToast(t('userProfile.toastFollowError', { error: err.message }), 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-background min-h-full py-10 px-4 max-w-4xl mx-auto space-y-4">
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </div>
    );
  }

  if (!scholar) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center py-24 px-4 text-center bg-background">
        <span
          className="material-symbols-outlined text-5xl text-muted-foreground mb-3"
          aria-hidden="true"
        >
          person_off
        </span>
        <h2 className="text-xl font-display font-bold text-foreground mb-1">
          {t('userProfile.notFoundTitle')}
        </h2>
        <p className="text-xs text-secondary-text mb-6 max-w-md">
          {t('userProfile.notFoundDesc')}
        </p>
        <Link to="/arena" className="btn-arena btn-arena-primary btn-arena-sm">
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          <span>{t('userProfile.backToArenaBtn')}</span>
        </Link>
      </div>
    );
  }

  const scholarMode =
    scholar.user_mode === 'student' || scholar.user_mode === 'thpt' ? 'student' : 'university';
  const expTotal = Number(scholar.exp) || 0;
  const studySeconds = Number(scholar.study_seconds) || 0;
  const studyStreak = Number(scholar.study_streak) || 0;

  const rankInfo = getUserRank(
    expTotal,
    scholar.role,
    scholar.is_approved_bang_chu,
    scholar.id,
    lang,
  );
  const levelInfo = getLevelFromExp(expTotal);
  const levelAccent = getLevelAccent(levelInfo.level);
  const joinedStr = scholar.created_at ? formatDate(scholar.created_at) : null;

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      {/* Imperial Top Banner */}
      <div className="h-36 sm:h-44 bg-gradient-to-r from-primary-soft via-paper to-gold-soft/60 relative overflow-hidden border-b border-border">
        <span
          aria-hidden="true"
          className="hanzi-watermark absolute right-8 top-4 text-8xl font-bold text-primary/8 select-none pointer-events-none"
        >
          名帖
        </span>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface/90 hover:bg-surface text-foreground text-xs font-bold border border-border shadow-xs transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          <span>{t('userProfile.backBtn')}</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 space-y-6">
        {/* SCHOLAR IDENTITY HEADER CARD — calibrated p-5 sm:p-8 */}
        <section className="imperial-frame p-5 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-5">
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <div className="relative shrink-0">
                <Avatar
                  src={scholar.avatar_url}
                  name={scholar.display_name || t('userProfile.defaultScholar')}
                  className="w-24 h-24 border-4 border-surface shadow-md"
                  textSize="text-3xl"
                />
                <div
                  className={`absolute -bottom-2 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:-right-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${rankInfo.bg} ${rankInfo.color} ${rankInfo.border} shadow-xs flex items-center gap-1`}
                >
                  <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                    {rankInfo.icon}
                  </span>
                  <span>{rankInfo.displayName}</span>
                </div>
              </div>

              <div className="mt-2 sm:mt-0 space-y-1.5">
                <div className="flex flex-col sm:flex-row items-center gap-2 flex-wrap justify-center sm:justify-start">
                  <h1 className="text-2xl font-display font-extrabold text-foreground leading-snug">
                    {scholar.display_name || t('userProfile.anonymousScholar')}
                  </h1>

                  <span
                    className={`tabular inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border whitespace-nowrap ${levelAccent.badge}`}
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      bolt
                    </span>
                    Lv.{levelInfo.level} · {formatNumber(levelInfo.totalExp)} EXP
                  </span>

                  {scholar.role === 'admin' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary text-on-primary whitespace-nowrap">
                      {t('userProfile.roleAdmin')}
                    </span>
                  )}
                  {scholar.role === 'collaborator' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-jade text-white whitespace-nowrap">
                      {t('userProfile.roleCurator')}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-secondary-text flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    {scholarMode === 'student' ? 'local_library' : 'school'}
                  </span>
                  <span>
                    {scholar.university ||
                      (scholarMode === 'student'
                        ? t('userProfile.studentNoSchool')
                        : t('userProfile.uniNoSchool'))}
                  </span>
                  {joinedStr && (
                    <span className="text-muted-foreground tabular">
                      · {t('userProfile.joinedOn', { date: joinedStr })}
                    </span>
                  )}
                </p>

                {/* Follower / Following Counters */}
                <div className="flex items-center justify-center sm:justify-start gap-4 pt-1 text-xs">
                  <span className="text-secondary-text">
                    <strong className="text-foreground font-display tabular">
                      {formatNumber(followersCount)}
                    </strong>{' '}
                    {t('userProfile.followers')}
                  </span>
                  <span className="text-border-strong" aria-hidden="true">
                    •
                  </span>
                  <span className="text-secondary-text">
                    <strong className="text-foreground font-display tabular">
                      {formatNumber(followingCount)}
                    </strong>{' '}
                    {t('userProfile.following')}
                  </span>
                </div>
              </div>
            </div>

            {/* Follow / Unfollow Action Button */}
            {(!currentUser || currentUser.id !== id) && (
              <button
                type="button"
                onClick={handleToggleFollow}
                disabled={followLoading}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  isFollowing
                    ? 'bg-surface-alt border border-border-strong text-foreground hover:border-primary hover:text-primary'
                    : 'btn-arena btn-arena-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  {followLoading ? 'hourglass_empty' : isFollowing ? 'how_to_reg' : 'person_add'}
                </span>
                <span>
                  {followLoading
                    ? t('userProfile.processingBtn')
                    : isFollowing
                      ? t('userProfile.followingBtn')
                      : t('userProfile.followScholarBtn')}
                </span>
              </button>
            )}
          </div>
        </section>

        {/* ACHIEVEMENT HIGHLIGHTS */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="paper-card p-5 flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${rankInfo.bg} ${rankInfo.color} ${rankInfo.border}`}
            >
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                {rankInfo.icon}
              </span>
            </div>
            <div>
              <p className="text-xs text-secondary-text">{t('userProfile.rankCardLabel')}</p>
              <p className={`text-lg font-display font-extrabold leading-snug ${rankInfo.color}`}>
                {rankInfo.displayName}
              </p>
              <p className="text-[11px] text-secondary-text tabular">
                {t('userProfile.expAndCampaigns', {
                  exp: formatNumber(expTotal),
                  count: formatNumber(completedCampaignsCount),
                })}
              </p>
            </div>
          </div>

          <div className="paper-card p-5 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-jade-soft border border-jade-border text-jade flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                schedule
              </span>
            </div>
            <div>
              <p className="text-xs text-secondary-text">{t('userProfile.verifiedStudyTime')}</p>
              <p className="text-lg font-display font-extrabold text-foreground tabular leading-snug">
                {formatStudyTime(studySeconds, lang)}
              </p>
              <p className="text-[11px] text-secondary-text tabular">
                {t('userProfile.streakLabel', { days: formatNumber(studyStreak) })}
              </p>
            </div>
          </div>

          <div className="paper-card p-5 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gold-soft border border-gold text-accent flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                ads_click
              </span>
            </div>
            <div>
              <p className="text-xs text-secondary-text">
                {scholarMode === 'student'
                  ? t('userProfile.targetThptLabel')
                  : t('userProfile.targetGpaLabel')}
              </p>
              <p className="text-lg font-display font-extrabold text-foreground tabular leading-snug">
                {scholarMode === 'student'
                  ? scholar.target_thpt != null
                    ? `${Number(scholar.target_thpt).toFixed(2)} / 30`
                    : t('userProfile.notSet')
                  : scholar.target_gpa != null
                    ? `${Number(scholar.target_gpa).toFixed(2)} / 4.00`
                    : t('userProfile.notSet')}
              </p>
              {scholarMode === 'university' && scholar.current_gpa != null && (
                <p className="text-[11px] text-jade font-semibold tabular">
                  {t('userProfile.currentGpa', {
                    gpa: Number(scholar.current_gpa).toFixed(2),
                  })}
                </p>
              )}
              {scholarMode === 'student' && scholar.target_dgnl != null && (
                <p className="text-[11px] text-secondary-text tabular">
                  {t('userProfile.targetDgnl', { score: scholar.target_dgnl })}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* LEVEL EXP BAR */}
        <section className="paper-card p-5">
          <div className="flex items-center justify-between text-xs mb-2 flex-wrap gap-2">
            <span className="text-secondary-text font-medium flex items-center gap-2">
              <span
                className={`tabular inline-flex items-center gap-1 font-extrabold px-2 py-0.5 rounded-md border ${levelAccent.badge}`}
              >
                Lv.{levelInfo.level}
              </span>
              <span>{t('userProfile.expProgressLabel')}</span>
            </span>
            <span className="tabular font-bold text-foreground">
              {formatNumber(levelInfo.expIntoLevel)} / {formatNumber(levelInfo.expForThisLevel)} EXP (
              {levelInfo.progressPct}%)
            </span>
          </div>
          <ProgressBar
            value={levelInfo.expIntoLevel}
            max={levelInfo.expForThisLevel}
            tone="jade"
            showPercent={false}
          />
        </section>

        {/* CONTENT TABS: PUBLIC CAMPAIGNS & PUBLIC DOCUMENTS */}
        <section className="space-y-4">
          <div
            role="tablist"
            aria-label={t('userProfile.publicActivityAria')}
            className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-surface-alt border border-border"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'campaigns'}
              onClick={() => setActiveTab('campaigns')}
              className={`py-2.5 px-3 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'campaigns'
                  ? 'bg-paper text-primary border border-border-strong shadow-2xs'
                  : 'text-secondary-text hover:text-foreground'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                swords
              </span>
              <span>
                {t('userProfile.publicCampaignsTab', { count: formatNumber(campaigns.length) })}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'documents'}
              onClick={() => setActiveTab('documents')}
              className={`py-2.5 px-3 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'documents'
                  ? 'bg-paper text-primary border border-border-strong shadow-2xs'
                  : 'text-secondary-text hover:text-foreground'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                folder_open
              </span>
              <span>
                {t('userProfile.contributedDocsTab', { count: formatNumber(documents.length) })}
              </span>
            </button>
          </div>

          {activeTab === 'campaigns' ? (
            campaigns.length === 0 ? (
              <div className="paper-card border-dashed p-10 text-center space-y-2">
                <span
                  className="material-symbols-outlined text-4xl text-muted-foreground"
                  aria-hidden="true"
                >
                  event_busy
                </span>
                <p className="font-display font-bold text-foreground">
                  {t('userProfile.emptyCampaignsTitle')}
                </p>
                <p className="text-xs text-secondary-text">{t('userProfile.emptyCampaignsDesc')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campaigns.map((camp) => {
                  const prog = computeCampaignProgress(camp.targets, camp.is_completed, t);
                  const endFmt = formatDate(camp.end_date);
                  return (
                    <article
                      key={camp.id}
                      className="paper-card p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-base font-extrabold text-foreground leading-snug">
                            {camp.title}
                          </h3>
                          {camp.is_completed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-completed-soft text-completed border border-completed-border shrink-0 whitespace-nowrap">
                              <span
                                className="material-symbols-outlined text-[12px]"
                                aria-hidden="true"
                              >
                                verified
                              </span>
                              <span>{t('userProfile.completedBadge')}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-soft text-gold-dark border border-gold shrink-0 whitespace-nowrap">
                              {t('userProfile.runningBadge')}
                            </span>
                          )}
                        </div>

                        {camp.target && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface-alt border border-border text-primary">
                            {t('userProfile.targetBadgePrefix', { target: camp.target })}
                          </span>
                        )}

                        <p className="text-xs text-secondary-text leading-relaxed line-clamp-3">
                          {camp.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-border space-y-2">
                        <ProgressBar
                          value={prog.pct}
                          max={100}
                          tone={camp.is_completed ? 'jade' : 'primary'}
                          label={t('userProfile.progressLabel')}
                          sublabel={prog.label}
                        />
                        {endFmt && (
                          <p className="text-[11px] text-secondary-text text-right tabular">
                            {t('userProfile.deadlinePrefix', { date: endFmt })}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : documents.length === 0 ? (
            <div className="paper-card border-dashed p-10 text-center space-y-2">
              <span
                className="material-symbols-outlined text-4xl text-muted-foreground"
                aria-hidden="true"
              >
                folder_off
              </span>
              <p className="font-display font-bold text-foreground">
                {t('userProfile.emptyDocsTitle')}
              </p>
              <p className="text-xs text-secondary-text">{t('userProfile.emptyDocsDesc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc) => {
                const safeUrl = sanitizeExternalUrl(doc.file_url);
                const meta = getDocumentKindMeta(
                  doc.file_type || doc.title,
                  doc.file_url,
                  lang,
                );
                const uploadedStr = formatDate(doc.uploaded_at || doc.created_at);

                return safeUrl ? (
                  <a
                    key={doc.id}
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="paper-card p-4 flex items-start gap-3.5 hover:border-primary transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary-soft border border-primary/25 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-xl" aria-hidden="true">
                        {meta.icon}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        {doc.category && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-alt border border-border text-secondary-text whitespace-nowrap">
                            {getLocalizedCategoryLabel(doc.category, t)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {doc.title}
                      </h3>
                      <p className="text-[11px] text-secondary-text tabular">
                        {uploadedStr
                          ? t('userProfile.uploadedOn', { date: uploadedStr })
                          : t('userProfile.studyResourceFallback')}
                        {doc.downloads_count
                          ? t('userProfile.opensCount', {
                              count: formatNumber(doc.downloads_count),
                            })
                          : ''}
                      </p>
                    </div>
                    <span
                      className="material-symbols-outlined text-muted-foreground group-hover:text-primary text-base shrink-0 mt-1"
                      aria-hidden="true"
                    >
                      open_in_new
                    </span>
                  </a>
                ) : (
                  <div
                    key={doc.id}
                    className="paper-card p-4 flex items-center gap-3.5 opacity-75 border-dashed"
                  >
                    <div className="w-11 h-11 rounded-xl bg-surface-alt border border-border text-muted-foreground flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl" aria-hidden="true">
                        link_off
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-sm text-foreground truncate">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-secondary-text">
                        {t('userProfile.unavailableLink')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
