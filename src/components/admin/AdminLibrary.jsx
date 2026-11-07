import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { sanitizeExternalUrl } from '../../utils/urlSecurity';
import { getDocumentKindMeta } from '../../lib/documents';
import {
  THPT_CATEGORY_KEYS,
  UNI_CATEGORY_KEYS,
  getLocalizedDocCategories,
  getLocalizedCategoryLabel,
  getLocalizedEducationLevel,
} from '../../i18n/communityAndAdmin';

export default function AdminLibrary({
  documents = [],
  reports = [],
  loadingDocs = false,
  loadingReports = false,
  docId,
  title,
  setTitle,
  description,
  setDescription,
  authorName,
  setAuthorName,
  educationLevel,
  setEducationLevel,
  category,
  setCategory,
  major,
  setMajor,
  fileUrl,
  setFileUrl,
  isFeatured,
  setIsFeatured,
  isPublic,
  setIsPublic,
  publishDate,
  setPublishDate,
  isUploading,
  onSaveDocument,
  onEditDocument,
  onResetForm,
  onDeleteDocument,
  onResolveReport,
}) {
  const { lang, locale, t, formatNumber, formatDate } = useLanguage();

  const [activeSubTab, setActiveSubTab] = useState('docs'); // 'docs' | 'reports'
  const [searchDocQuery, setSearchDocQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all'); // 'all' | 'thpt' | 'university'
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState(null);

  const categories = getLocalizedDocCategories(educationLevel, t);

  const handleEducationLevelChange = (nextLevel) => {
    setEducationLevel(nextLevel);
    const validKeys = nextLevel === 'university' ? UNI_CATEGORY_KEYS : THPT_CATEGORY_KEYS;
    if (!validKeys.includes(category)) {
      setCategory(validKeys[0]);
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (levelFilter !== 'all' && (d.education_level || 'thpt') !== levelFilter) {
      return false;
    }
    if (!searchDocQuery.trim()) return true;
    const q = searchDocQuery.toLowerCase();
    const localizedCat = getLocalizedCategoryLabel(d.category, t).toLowerCase();
    return (
      (d.title || '').toLowerCase().includes(q) ||
      (d.author_name || '').toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q) ||
      localizedCat.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Subtab Navigation — clean pill borders */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('docs')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'docs'
              ? 'bg-primary text-white border-primary shadow-xs'
              : 'bg-surface border-border text-secondary-text hover:text-foreground'
          }`}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            library_books
          </span>
          <span>{t('adminLibrary.subtabDocs', { count: formatNumber(documents.length) })}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('reports')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'reports'
              ? 'bg-primary text-white border-primary shadow-xs'
              : 'bg-surface border-border text-secondary-text hover:text-foreground'
          }`}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            report
          </span>
          <span>{t('adminLibrary.subtabReports', { count: formatNumber(reports.length) })}</span>
          {reports.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" aria-hidden="true" />
          )}
        </button>
      </div>

      {activeSubTab === 'docs' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add / Edit Form */}
          <div className="lg:col-span-5">
            <form onSubmit={onSaveDocument} className="paper-card p-5 space-y-4 sticky top-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" aria-hidden="true">
                    {docId ? 'edit_document' : 'cloud_upload'}
                  </span>
                  <span>
                    {docId ? t('adminLibrary.formTitleEdit') : t('adminLibrary.formTitleNew')}
                  </span>
                </h2>
                {docId && (
                  <button
                    type="button"
                    onClick={onResetForm}
                    className="text-xs text-secondary-text hover:text-primary transition-colors cursor-pointer"
                  >
                    {t('adminLibrary.cancelEdit')}
                  </button>
                )}
              </div>

              <div>
                <label
                  htmlFor="admin-doc-title"
                  className="block text-xs font-bold text-foreground mb-1"
                >
                  {t('adminLibrary.titleLabel')} <span className="text-primary">*</span>
                </label>
                <input
                  id="admin-doc-title"
                  type="text"
                  required
                  placeholder={t('adminLibrary.titlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-doc-desc"
                  className="block text-xs font-bold text-foreground mb-1"
                >
                  {t('adminLibrary.descLabel')}
                </label>
                <textarea
                  id="admin-doc-desc"
                  rows={3}
                  placeholder={t('adminLibrary.descPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="admin-doc-level"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    {t('adminLibrary.eduLevelLabel')}
                  </label>
                  <select
                    id="admin-doc-level"
                    value={educationLevel}
                    onChange={(e) => handleEducationLevelChange(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="thpt">{t('docCategories.levelThpt')}</option>
                    <option value="university">{t('docCategories.levelUniversity')}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="admin-doc-category"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    {t('adminLibrary.categoryLabel')}
                  </label>
                  <select
                    id="admin-doc-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="admin-doc-author"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    {t('adminLibrary.authorLabel')}
                  </label>
                  <input
                    id="admin-doc-author"
                    type="text"
                    placeholder={t('adminLibrary.authorPlaceholder')}
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-doc-major"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    {t('adminLibrary.majorLabel')}
                  </label>
                  <input
                    id="admin-doc-major"
                    type="text"
                    placeholder={t('adminLibrary.majorPlaceholder')}
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-doc-url"
                  className="block text-xs font-bold text-foreground mb-1"
                >
                  {t('adminLibrary.urlLabel')} <span className="text-primary">*</span>
                </label>
                <input
                  id="admin-doc-url"
                  type="url"
                  required
                  placeholder={t('adminLibrary.urlPlaceholder')}
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-doc-date"
                  className="block text-xs font-bold text-foreground mb-1"
                >
                  {t('adminLibrary.dateLabel')}
                </label>
                <input
                  id="admin-doc-date"
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-alt border border-border flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="text-primary focus:ring-primary rounded"
                  />
                  <span>{t('adminLibrary.featuredCheck')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="text-primary focus:ring-primary rounded"
                  />
                  <span>{t('adminLibrary.publicCheck')}</span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                {docId && (
                  <button
                    type="button"
                    onClick={onResetForm}
                    className="btn-arena btn-arena-secondary btn-arena-sm flex-1 cursor-pointer"
                  >
                    {t('adminLibrary.cancelEdit')}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isUploading}
                  className="btn-arena btn-arena-primary btn-arena-sm flex-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {isUploading ? 'hourglass_empty' : 'save'}
                  </span>
                  <span>
                    {isUploading
                      ? t('adminLibrary.processingBtn')
                      : docId
                        ? t('adminLibrary.updateBtn')
                        : t('adminLibrary.saveNewBtn')}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Documents */}
          <div className="lg:col-span-7 paper-card p-5 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="font-display font-bold text-base text-foreground">
                {t('adminLibrary.listTitle', { count: formatNumber(filteredDocs.length) })}
              </h3>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  aria-label={t('adminLibrary.eduLevelLabel')}
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="all">{t('adminLibrary.filterAllLevels')}</option>
                  <option value="thpt">{t('docCategories.levelThpt')}</option>
                  <option value="university">{t('docCategories.levelUniversity')}</option>
                </select>

                <input
                  type="text"
                  placeholder={t('adminLibrary.searchPlaceholder')}
                  value={searchDocQuery}
                  onChange={(e) => setSearchDocQuery(e.target.value)}
                  className="px-3 py-1.5 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary w-full sm:w-52"
                />
              </div>
            </div>

            {loadingDocs ? (
              <div className="flex justify-center py-16">
                <span
                  className="material-symbols-outlined animate-spin text-3xl text-primary"
                  aria-hidden="true"
                >
                  sync
                </span>
              </div>
            ) : filteredDocs.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-border bg-surface max-h-[680px] overflow-y-auto">
                <div className="divide-y divide-border">
                  {filteredDocs.map((doc) => {
                    const kind = getDocumentKindMeta(doc.title, doc.file_url, lang);
                    const safeUrl = sanitizeExternalUrl(doc.file_url);
                    const createdStr = formatDate(doc.created_at) || '—';

                    return (
                      <div
                        key={doc.id}
                        className="p-3.5 hover:bg-surface-alt transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${kind.badgeClass}`}
                            >
                              {kind.label}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt text-secondary-text border border-border uppercase whitespace-nowrap">
                              {getLocalizedEducationLevel(doc.education_level, t)}
                            </span>
                            {doc.category && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-soft text-primary border border-primary/30 whitespace-nowrap">
                                {getLocalizedCategoryLabel(doc.category, t)}
                              </span>
                            )}
                            {doc.is_featured && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gold-soft text-gold-dark border border-gold whitespace-nowrap">
                                {t('adminLibrary.featuredBadge')}
                              </span>
                            )}
                            {!doc.is_public && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-600 border border-red-300 whitespace-nowrap">
                                {t('adminLibrary.hiddenBadge')}
                              </span>
                            )}
                          </div>

                          <h4 className="font-display font-bold text-sm text-foreground truncate">
                            {doc.title}
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate tabular">
                            {t('adminLibrary.authorPrefix', {
                              author: doc.author_name || t('adminLibrary.anonymousAuthor'),
                            })}{' '}
                            • {t('adminLibrary.createdAtPrefix', { date: createdStr })}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {safeUrl && (
                            <a
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={t('adminLibrary.openLinkAria', {
                                title: doc.title || '',
                              }).trim()}
                              className="p-2 text-muted-foreground hover:text-foreground hover:bg-paper rounded-lg transition-colors cursor-pointer"
                              title={t('adminLibrary.openLinkTitle')}
                            >
                              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                                open_in_new
                              </span>
                            </a>
                          )}

                          <button
                            type="button"
                            aria-label={t('adminLibrary.editDocAria', {
                              title: doc.title || '',
                            }).trim()}
                            onClick={() => onEditDocument(doc)}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary-soft rounded-lg transition-colors cursor-pointer"
                            title={t('adminLibrary.editShort')}
                          >
                            <span className="material-symbols-outlined text-lg" aria-hidden="true">
                              edit
                            </span>
                          </button>

                          <button
                            type="button"
                            aria-label={t('adminLibrary.deleteDocAria', {
                              title: doc.title || '',
                            }).trim()}
                            onClick={() => setDeleteConfirmDocId(doc.id)}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary-soft rounded-lg transition-colors cursor-pointer"
                            title={t('adminLibrary.deleteShort')}
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
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-secondary-text">
                {t('adminLibrary.emptyDocs')}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Reports Subtab */
        <div className="paper-card p-5 sm:p-6">
          <div className="border-b border-border pb-4 mb-4">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">
                report
              </span>
              <span>
                {t('adminLibrary.reportsTitle', { count: formatNumber(reports.length) })}
              </span>
            </h3>
            <p className="text-xs text-secondary-text mt-1">{t('adminLibrary.reportsDesc')}</p>
          </div>

          {loadingReports ? (
            <div className="py-12 flex justify-center">
              <span
                className="material-symbols-outlined animate-spin text-3xl text-primary"
                aria-hidden="true"
              >
                sync
              </span>
            </div>
          ) : reports.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <div className="divide-y divide-border">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 hover:bg-surface-alt transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-600 border border-red-300 whitespace-nowrap">
                          {t('adminLibrary.issueBadge')}
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {report.documents?.title ||
                            t('adminLibrary.fallbackDocId', { id: report.document_id })}
                        </span>
                      </div>

                      <p className="text-xs text-primary font-medium">
                        {t('adminLibrary.reasonPrefix')} &ldquo;{report.reason}&rdquo;
                      </p>

                      <p className="text-[10px] text-muted-foreground tabular">
                        {t('adminLibrary.reportedAtPrefix', {
                          date: report.created_at
                            ? new Date(report.created_at).toLocaleString(locale)
                            : '—',
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onResolveReport(report.id)}
                        className="btn-arena btn-arena-jade btn-arena-sm cursor-pointer whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">
                          check
                        </span>
                        <span>{t('adminLibrary.markResolvedBtn')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onDeleteDocument(report.document_id);
                          onResolveReport(report.id);
                        }}
                        className="btn-arena btn-arena-primary btn-arena-sm cursor-pointer whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">
                          delete
                        </span>
                        <span>{t('adminLibrary.deleteFaultyDocBtn')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface py-12 px-4 text-center text-sm text-secondary-text">
              {t('adminLibrary.emptyReports')}
            </div>
          )}
        </div>
      )}

      {/* Delete Document Confirmation Dialog */}
      {deleteConfirmDocId && (
        <div
          className="fixed inset-0 z-[110] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmDocId(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={t('adminLibrary.deleteModalTitle')}
            className="imperial-frame w-full max-w-sm p-6 sm:p-7 bg-surface shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  delete_forever
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  {t('adminLibrary.deleteModalTitle')}
                </h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  {t('adminLibrary.deleteModalDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmDocId(null)}
                className="btn-arena btn-arena-secondary btn-arena-sm cursor-pointer"
              >
                {t('adminLibrary.cancelBtn')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDocument(deleteConfirmDocId);
                  setDeleteConfirmDocId(null);
                }}
                className="btn-arena btn-arena-primary btn-arena-sm cursor-pointer"
              >
                {t('adminLibrary.confirmDeleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
