import React, { useState } from 'react';
import Avatar from '../Avatar';
import { useLanguage } from '../../contexts/LanguageContext';
import { isSoleBangChuAccount } from '../../utils/rankHelper';

export default function AdminCollaborator({
  collaborators = [],
  searchResults = [],
  collabSearchTerm = '',
  setCollabSearchTerm,
  loadingCollabs = false,
  directoryWarning = '',
  onSearchUsers,
  onSetUserRole,
}) {
  const { t, formatNumber } = useLanguage();
  const [roleConfirmTarget, setRoleConfirmTarget] = useState(null);

  const handleConfirmRoleChange = () => {
    if (!roleConfirmTarget) return;
    const { userId, newRole, name } = roleConfirmTarget;
    setRoleConfirmTarget(null);
    onSetUserRole(userId, newRole, name);
  };

  return (
    <div className="space-y-6">
      {/* Scholar Directory Search & Curator Appointment */}
      <div className="paper-card p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-jade-soft border border-jade-border flex items-center justify-center text-jade shrink-0">
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">
              person_search
            </span>
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-foreground">
              {t('adminCollab.directoryTitle')}
            </h2>
            <p className="text-xs text-secondary-text">{t('adminCollab.directoryDesc')}</p>
          </div>
        </div>

        {directoryWarning && (
          <div className="p-3 mb-4 rounded-xl bg-gold-soft border border-gold text-xs text-gold-dark flex items-center gap-2">
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              info
            </span>
            <span>{directoryWarning}</span>
          </div>
        )}

        <form onSubmit={onSearchUsers} className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <span
              className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="text"
              required
              placeholder={t('adminCollab.searchPlaceholder')}
              value={collabSearchTerm}
              onChange={(e) => setCollabSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-paper border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loadingCollabs}
            className="btn-arena btn-arena-jade btn-arena-sm shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              {loadingCollabs ? 'sync' : 'person_search'}
            </span>
            <span>
              {loadingCollabs ? t('adminCollab.searchingBtn') : t('adminCollab.searchBtn')}
            </span>
          </button>
        </form>

        {/* Search Results Table */}
        {searchResults.length > 0 && (
          <div className="mt-5 space-y-2.5 pt-4 border-t border-border">
            <h3 className="text-xs font-bold text-secondary-text uppercase tracking-wider">
              {t('adminCollab.searchResultsHeading', { count: formatNumber(searchResults.length) })}
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full text-left text-xs">
                <thead className="bg-paper border-b border-border text-secondary-text font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5 whitespace-nowrap">{t('adminCollab.colScholar')}</th>
                    <th className="p-3.5 whitespace-nowrap">{t('adminCollab.colEmail')}</th>
                    <th className="p-3.5 whitespace-nowrap">{t('adminCollab.colRole')}</th>
                    <th className="p-3.5 text-right whitespace-nowrap">
                      {t('adminCollab.colActions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {searchResults.map((usr) => {
                    const isCollab = usr.role === 'collaborator';
                    const isAdminUser = usr.role === 'admin';
                    const isBangChu = isSoleBangChuAccount(usr.role, usr.id);
                    const displayName =
                      usr.display_name ||
                      usr.full_name ||
                      usr.email ||
                      t('adminCollab.anonymousScholar');

                    return (
                      <tr key={usr.id} className="hover:bg-surface-alt transition-colors">
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={usr.avatar_url}
                              name={displayName}
                              id={usr.id}
                              className="w-9 h-9 border border-border shrink-0"
                            />
                            <span className="font-bold text-sm text-foreground whitespace-nowrap">
                              {displayName}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-muted-foreground whitespace-nowrap">
                          {usr.email || '—'}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isAdminUser ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/30 uppercase whitespace-nowrap">
                                {t('adminCollab.roleAdmin')}
                              </span>
                            ) : isCollab ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-jade-soft text-jade border border-jade-border uppercase whitespace-nowrap">
                                {t('adminCollab.roleCurator')}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-alt text-secondary-text border border-border uppercase whitespace-nowrap">
                                {t('adminCollab.roleScholar')}
                              </span>
                            )}
                            {isBangChu && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-soft text-gold-dark border border-gold uppercase whitespace-nowrap">
                                {t('adminCollab.roleBangChu')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          {!isAdminUser && (
                            <button
                              type="button"
                              onClick={() =>
                                setRoleConfirmTarget({
                                  userId: usr.id,
                                  newRole: isCollab ? 'user' : 'collaborator',
                                  name: displayName,
                                })
                              }
                              className={`btn-arena btn-arena-sm cursor-pointer whitespace-nowrap ${
                                isCollab ? 'btn-arena-secondary text-primary' : 'btn-arena-jade'
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                                {isCollab ? 'person_remove' : 'verified_user'}
                              </span>
                              <span>
                                {isCollab
                                  ? t('adminCollab.revokeShortBtn')
                                  : t('adminCollab.grantCuratorBtn')}
                              </span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Active Curators Table */}
      <div className="space-y-3">
        <div className="paper-card p-5 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-jade" aria-hidden="true">
                groups
              </span>
              <span>
                {t('adminCollab.currentTeamTitle', {
                  count: formatNumber(collaborators.length),
                })}
              </span>
            </h3>
            <p className="text-xs text-secondary-text mt-0.5">
              {t('adminCollab.currentTeamDesc')}
            </p>
          </div>
        </div>

        {collaborators.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper border-b border-border text-secondary-text font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">{t('adminCollab.colScholar')}</th>
                  <th className="p-3.5 whitespace-nowrap">{t('adminCollab.colEmail')}</th>
                  <th className="p-3.5 whitespace-nowrap">{t('adminCollab.colRole')}</th>
                  <th className="p-3.5 text-right whitespace-nowrap">
                    {t('adminCollab.colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {collaborators.map((c) => {
                  const displayName =
                    c.display_name ||
                    c.full_name ||
                    c.email ||
                    t('adminCollab.anonymousScholar');
                  return (
                    <tr key={c.id} className="hover:bg-surface-alt transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={c.avatar_url}
                            name={displayName}
                            id={c.id}
                            className="w-10 h-10 border border-jade/40 shrink-0"
                          />
                          <span className="font-display font-bold text-foreground text-sm whitespace-nowrap">
                            {displayName}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-secondary-text whitespace-nowrap">
                        {c.email || t('adminCollab.noEmailSynced')}
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-jade-soft text-jade border border-jade-border whitespace-nowrap">
                          {t('adminCollab.roleCurator')}
                        </span>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setRoleConfirmTarget({
                              userId: c.id,
                              newRole: 'user',
                              name: displayName,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-soft text-primary border border-primary/30 hover:bg-primary hover:text-white transition-all cursor-pointer whitespace-nowrap"
                        >
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">
                            person_remove
                          </span>
                          <span>{t('adminCollab.revokeRoleBtn')}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-secondary-text text-sm">
            {t('adminCollab.emptyTeam')}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {roleConfirmTarget && (
        <div
          className="fixed inset-0 z-[110] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRoleConfirmTarget(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={t('adminCollab.confirmModalTitle')}
            className="imperial-frame w-full max-w-sm p-6 sm:p-7 bg-surface shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-jade-soft text-jade flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  security
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  {t('adminCollab.confirmModalTitle')}
                </h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  {roleConfirmTarget.newRole === 'collaborator'
                    ? t('adminCollab.confirmGrantMsg', { name: roleConfirmTarget.name })
                    : t('adminCollab.confirmRevokeMsg', { name: roleConfirmTarget.name })}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoleConfirmTarget(null)}
                className="btn-arena btn-arena-secondary btn-arena-sm cursor-pointer"
              >
                {t('adminCollab.cancelBtn')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRoleChange}
                className="btn-arena btn-arena-primary btn-arena-sm cursor-pointer"
              >
                {t('adminCollab.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
