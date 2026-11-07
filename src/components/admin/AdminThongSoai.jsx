import React, { useState } from 'react';
import Avatar from '../Avatar';
import { useLanguage } from '../../contexts/LanguageContext';
import { isSoleBangChuAccount } from '../../utils/rankHelper';

export default function AdminThongSoai({
  candidates = [],
  approvedBangChuList = [],
  loadingCandidates = false,
  onToggleBangChu,
}) {
  const { t, formatNumber } = useLanguage();
  const [toggleConfirmTarget, setToggleConfirmTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleConfirmToggle = () => {
    if (!toggleConfirmTarget) return;
    const { userId, currentStatus, name } = toggleConfirmTarget;
    setToggleConfirmTarget(null);
    onToggleBangChu(userId, currentStatus, name);
  };

  const filteredCandidates = candidates.filter((cand) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (cand.display_name || '').toLowerCase().includes(q) ||
      (cand.full_name || '').toLowerCase().includes(q) ||
      (cand.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Exclusive Guildmaster Seat Banner */}
      <div className="paper-card p-5 sm:p-6 relative overflow-hidden">
        <span
          aria-hidden="true"
          className="hanzi-watermark absolute top-2 right-5 text-7xl font-bold text-primary/8 select-none pointer-events-none"
        >
          幫主
        </span>

        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gold-soft border border-gold flex items-center justify-center text-gold-dark shrink-0">
            <span className="material-symbols-outlined text-2xl icon-fill" aria-hidden="true">
              workspace_premium
            </span>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-foreground leading-snug">
              {t('adminThongSoai.bannerTitle')}
            </h2>
            <p className="text-xs text-secondary-text mt-0.5 leading-relaxed">
              {t('adminThongSoai.bannerDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Sole Guildmaster Account Table */}
      <div className="space-y-3">
        <div className="paper-card p-5 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-accent" aria-hidden="true">
                military_tech
              </span>
              <span>{t('adminThongSoai.soleSectionTitle')}</span>
            </h3>
            <p className="text-xs text-secondary-text mt-0.5">
              {t('adminThongSoai.soleSectionDesc')}
            </p>
          </div>
        </div>

        {approvedBangChuList.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper border-b border-border text-secondary-text font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">{t('adminThongSoai.colScholar')}</th>
                  <th className="p-3.5 whitespace-nowrap">{t('adminThongSoai.colEmailOrg')}</th>
                  <th className="p-3.5 whitespace-nowrap">{t('adminThongSoai.colStatus')}</th>
                  <th className="p-3.5 text-right whitespace-nowrap">
                    {t('adminThongSoai.colAction')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {approvedBangChuList.map((u) => {
                  const displayName =
                    u.display_name ||
                    u.full_name ||
                    u.email ||
                    t('adminThongSoai.anonymousScholar');
                  const isSoleOwner = isSoleBangChuAccount(u.role, u.id);
                  return (
                    <tr key={u.id} className="hover:bg-surface-alt transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={u.avatar_url}
                            name={displayName}
                            id={u.id}
                            className="w-11 h-11 border-2 border-gold shrink-0"
                            textSize="text-base"
                          />
                          <span className="font-display font-bold text-foreground text-sm whitespace-nowrap">
                            {displayName}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-secondary-text whitespace-nowrap">
                        {u.email || t('adminThongSoai.noEmailSynced')} •{' '}
                        {u.university || t('adminThongSoai.adminBoardFallback')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isSoleOwner ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gold-soft text-gold-dark border border-gold whitespace-nowrap">
                              <span
                                className="material-symbols-outlined text-[12px] icon-fill"
                                aria-hidden="true"
                              >
                                verified
                              </span>
                              <span>{t('adminThongSoai.soleBadge')}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/30 whitespace-nowrap">
                              {t('adminThongSoai.legacyFlagBadge')}
                            </span>
                          )}
                          {u.is_vip && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/30 whitespace-nowrap">
                              VIP
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {isSoleOwner ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border bg-gold-soft text-gold-dark border-gold whitespace-nowrap">
                            <span
                              className="material-symbols-outlined text-sm icon-fill"
                              aria-hidden="true"
                            >
                              lock
                            </span>
                            <span>{t('adminThongSoai.lockedSeatBadge')}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setToggleConfirmTarget({
                                userId: u.id,
                                currentStatus: true,
                                name: displayName,
                              })
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer bg-primary-soft text-primary border-primary/30 hover:bg-primary hover:text-white whitespace-nowrap"
                          >
                            <span className="material-symbols-outlined text-sm" aria-hidden="true">
                              remove_moderator
                            </span>
                            <span>{t('adminThongSoai.revokeFlagBtn')}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-secondary-text text-sm">
            {t('adminThongSoai.loadingSole')}
          </div>
        )}
      </div>

      {/* Top Campaign & EXP Scholars Table */}
      <div className="space-y-3">
        <div className="paper-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">
                leaderboard
              </span>
              <span>
                {t('adminThongSoai.candidatesTitle', {
                  count: formatNumber(filteredCandidates.length),
                })}
              </span>
            </h3>
            <p className="text-xs text-secondary-text mt-0.5">
              {t('adminThongSoai.candidatesDesc')}
            </p>
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <span
              className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="text"
              placeholder={t('adminThongSoai.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {loadingCandidates ? (
          <div className="rounded-2xl border border-border bg-surface py-12 flex justify-center">
            <span
              className="material-symbols-outlined animate-spin text-3xl text-primary"
              aria-hidden="true"
            >
              sync
            </span>
          </div>
        ) : filteredCandidates.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper border-b border-border text-secondary-text font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">{t('adminThongSoai.colScholar')}</th>
                  <th className="p-3.5 whitespace-nowrap">{t('adminThongSoai.colCampaigns')}</th>
                  <th className="p-3.5 text-right whitespace-nowrap">
                    {t('adminThongSoai.colProgression')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCandidates.map((cand) => {
                  const displayName =
                    cand.display_name ||
                    cand.full_name ||
                    cand.email ||
                    t('adminThongSoai.anonymousScholar');
                  const isSoleOwner = isSoleBangChuAccount(cand.role, cand.id);
                  const countVal = cand.completedCount || cand.completed_count || 0;

                  return (
                    <tr key={cand.id} className="hover:bg-surface-alt transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={cand.avatar_url}
                            name={displayName}
                            id={cand.id}
                            className="w-10 h-10 border border-border shrink-0"
                            textSize="text-sm"
                          />
                          <div>
                            <p className="font-display font-bold text-foreground text-sm whitespace-nowrap">
                              {displayName}
                            </p>
                            <p className="text-xs text-secondary-text mt-0.5 whitespace-nowrap">
                              {cand.email || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-jade-soft text-jade border border-jade-border tabular whitespace-nowrap">
                            {t('adminThongSoai.campaignsCountBadge', {
                              count: formatNumber(countVal),
                            })}
                          </span>
                          {isSoleOwner && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-soft text-gold-dark border border-gold whitespace-nowrap">
                              {t('adminThongSoai.soleBadge')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <span className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-alt text-secondary-text border border-border whitespace-nowrap">
                          {isSoleOwner
                            ? t('adminThongSoai.soleStatusText')
                            : t('adminThongSoai.expProgressionText')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-secondary-text text-sm">
            {candidates.length === 0
              ? t('adminThongSoai.emptyCandidates')
              : t('adminThongSoai.emptySearch')}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {toggleConfirmTarget && (
        <div
          className="fixed inset-0 z-[110] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setToggleConfirmTarget(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={t('adminThongSoai.confirmModalTitle')}
            className="imperial-frame w-full max-w-sm p-6 sm:p-7 bg-surface shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-soft text-gold-dark flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl icon-fill" aria-hidden="true">
                  workspace_premium
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  {t('adminThongSoai.confirmModalTitle')}
                </h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  {toggleConfirmTarget.currentStatus
                    ? t('adminThongSoai.confirmRevokeMsg', { name: toggleConfirmTarget.name })
                    : t('adminThongSoai.confirmApproveMsg', { name: toggleConfirmTarget.name })}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setToggleConfirmTarget(null)}
                className="btn-arena btn-arena-secondary btn-arena-sm cursor-pointer"
              >
                {t('adminThongSoai.cancelBtn')}
              </button>
              <button
                type="button"
                onClick={handleConfirmToggle}
                className="btn-arena btn-arena-primary btn-arena-sm cursor-pointer"
              >
                {t('adminThongSoai.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
