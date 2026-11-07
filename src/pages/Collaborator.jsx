import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/ToastProvider';
import { sanitizeExternalUrl, assertSafeExternalUrl } from '../utils/urlSecurity';
import { getDocumentKindMeta } from '../lib/documents';
import {
  THPT_CATEGORY_KEYS,
  UNI_CATEGORY_KEYS,
  getLocalizedDocCategories,
  getLocalizedCategoryLabel,
  getLocalizedEducationLevel,
} from '../i18n/communityAndAdmin';
import RankSeal from '../components/ui/RankSeal';

export default function Collaborator() {
  const { user, profile } = useAuth();
  const { lang, t, formatNumber, formatDate } = useLanguage();
  const { showToast } = useToast();

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const canManage = profile?.role === 'collaborator' || profile?.role === 'admin';

  // Form State
  const [docId, setDocId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [educationLevel, setEducationLevel] = useState('thpt');
  const [category, setCategory] = useState('toan');
  const [major, setMajor] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [uploadMode, setUploadMode] = useState('link'); // 'link' | 'file'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // My Documents List State
  const [myDocuments, setMyDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const categories = getLocalizedDocCategories(educationLevel, t);

  const handleEducationLevelChange = (nextLevel) => {
    setEducationLevel(nextLevel);
    const validKeys = nextLevel === 'university' ? UNI_CATEGORY_KEYS : THPT_CATEGORY_KEYS;
    if (!validKeys.includes(category)) {
      setCategory(validKeys[0]);
    }
  };

  const fetchMyDocuments = useCallback(async () => {
    if (!user) return;
    setLoadingDocs(true);
    try {
      // Query documents uploaded by this collaborator using real columns
      const { data, error } = await supabase
        .from('documents')
        .select(
          'id, title, description, category, category_id, education_level, major, author_name, file_url, file_type, file_size, is_public, is_featured, uploaded_by, created_at, uploaded_at, publish_date',
        )
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyDocuments(data || []);
    } catch (err) {
      console.error('Error loading collaborator documents:', err);
      showToast(tRef.current('collaborator.toastLoadError', { error: err.message }), 'error');
    } finally {
      setLoadingDocs(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    if (canManage) {
      fetchMyDocuments();
    }
  }, [canManage, fetchMyDocuments]);

  const resetForm = () => {
    setDocId(null);
    setTitle('');
    setDescription('');
    setAuthorName('');
    setEducationLevel('thpt');
    setCategory('toan');
    setMajor('');
    setFileUrl('');
    setPublishDate('');
    setSelectedFile(null);
    const fileInputEl = document.getElementById('collab-file-input');
    if (fileInputEl) {
      fileInputEl.value = '';
    }
  };

  const handleEdit = (doc) => {
    setDocId(doc.id);
    setTitle(doc.title || '');
    setDescription(doc.description || '');
    setAuthorName(doc.author_name || '');
    setEducationLevel(doc.education_level || 'thpt');
    setCategory(doc.category || 'toan');
    setMajor(doc.major || '');
    setFileUrl(doc.file_url || '');
    setPublishDate(doc.publish_date || '');
    setUploadMode('link');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim()) {
      showToast(t('collaborator.toastTitleRequired'), 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalUrl = fileUrl.trim();

      // If user uploaded a file to Supabase storage
      if (uploadMode === 'file' && selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `uploads/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('documents').getPublicUrl(filePath);

        finalUrl = publicUrl;
      }

      const safeUrl = assertSafeExternalUrl(finalUrl, t('collaborator.toastInvalidUrl'));

      // ONLY valid columns for public.documents
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        category_id: category,
        education_level: educationLevel,
        major: major.trim(),
        author_name:
          authorName.trim() || profile?.display_name || t('collaborator.anonymousAuthor'),
        file_url: safeUrl,
        publish_date: publishDate || null,
        uploaded_by: user.id,
        is_public: true,
      };

      if (docId) {
        const { error } = await supabase
          .from('documents')
          .update(payload)
          .eq('id', docId)
          .eq('uploaded_by', user.id);

        if (error) throw error;
        showToast(t('collaborator.toastDocUpdated'), 'success');
      } else {
        const { error } = await supabase.from('documents').insert([payload]);
        if (error) throw error;
        showToast(t('collaborator.toastDocPublished'), 'success');
      }

      resetForm();
      fetchMyDocuments();
    } catch (err) {
      showToast(t('collaborator.toastSaveError', { error: err.message }), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const targetId = deleteConfirmId;
    setDeleteConfirmId(null);

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', targetId)
        .eq('uploaded_by', user.id);

      if (error) throw error;
      showToast(t('collaborator.toastDocDeleted'), 'info');
      if (docId === targetId) resetForm();
      setMyDocuments((prev) => prev.filter((d) => d.id !== targetId));
    } catch (err) {
      showToast(t('collaborator.toastDeleteError', { error: err.message }), 'error');
    }
  };

  if (!canManage) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center p-6">
        <div className="imperial-frame p-6 sm:p-8 max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-jade-soft text-jade border border-jade-border flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">
              security
            </span>
          </div>
          <h2 className="font-display font-bold text-xl text-foreground leading-snug">
            {t('collaborator.restrictedTitle')}
          </h2>
          <p className="text-xs text-secondary-text leading-relaxed">
            {t('collaborator.restrictedDesc')}
          </p>
          <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
            <Link to="/library" className="btn-arena btn-arena-jade btn-arena-sm">
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                menu_book
              </span>
              <span>{t('collaborator.backToLibrary')}</span>
            </Link>
            <Link to="/home" className="btn-arena btn-arena-secondary btn-arena-sm">
              <span>{t('collaborator.backToHome')}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header — calibrated p-5 sm:p-8 */}
        <header className="imperial-frame p-5 sm:p-8 mb-6 relative overflow-hidden">
          <span
            aria-hidden="true"
            className="hanzi-watermark absolute top-2 right-6 text-8xl font-bold text-jade/10 select-none pointer-events-none"
          >
            傳道
          </span>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="mb-2">
                <RankSeal size="sm" icon="edit_document" label={t('collaborator.sealLabel')} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground leading-snug">
                {t('collaborator.headerTitle')}
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1">
                {t('collaborator.headerDesc')}
              </p>
            </div>

            <Link
              to="/library"
              className="btn-arena btn-arena-secondary btn-arena-sm self-start sm:self-auto shrink-0"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                menu_book
              </span>
              <span>{t('collaborator.viewLibraryBtn')}</span>
            </Link>
          </div>
        </header>

        {/* Form and List Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add / Edit Form */}
          <div className="lg:col-span-5">
            <form onSubmit={handleSubmit} className="paper-card p-5 space-y-4 sticky top-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                  <span className="material-symbols-outlined text-jade" aria-hidden="true">
                    {docId ? 'edit' : 'cloud_upload'}
                  </span>
                  <span>
                    {docId ? t('collaborator.formTitleEdit') : t('collaborator.formTitleNew')}
                  </span>
                </h2>
                {docId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-secondary-text hover:text-primary transition-colors cursor-pointer"
                  >
                    {t('collaborator.cancelEditBtn')}
                  </button>
                )}
              </div>

              <div>
                <label
                  htmlFor="collab-doc-title"
                  className="block text-xs font-bold text-foreground mb-1"
                >
                  {t('collaborator.docTitleLabel')} <span className="text-primary">*</span>
                </label>
                <input
                  id="collab-doc-title"
                  type="text"
                  required
                  placeholder={t('collaborator.docTitlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="collab-doc-desc"
                  className="block text-xs font-bold text-foreground mb-1"
                >
                  {t('collaborator.docDescLabel')}
                </label>
                <textarea
                  id="collab-doc-desc"
                  rows={3}
                  placeholder={t('collaborator.docDescPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="collab-edu-level"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    {t('collaborator.eduLevelLabel')}
                  </label>
                  <select
                    id="collab-edu-level"
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
                    htmlFor="collab-category"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    {t('collaborator.subjectCategoryLabel')}
                  </label>
                  <select
                    id="collab-category"
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
                    htmlFor="collab-author"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    {t('collaborator.authorLabel')}
                  </label>
                  <input
                    id="collab-author"
                    type="text"
                    placeholder={t('collaborator.authorPlaceholder')}
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="collab-major"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    {t('collaborator.schoolMajorLabel')}
                  </label>
                  <input
                    id="collab-major"
                    type="text"
                    placeholder={t('collaborator.schoolMajorPlaceholder')}
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Upload Mode Selector */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-alt rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setUploadMode('link')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    uploadMode === 'link'
                      ? 'bg-jade text-white'
                      : 'text-secondary-text hover:text-foreground'
                  }`}
                >
                  {t('collaborator.modeLinkBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    uploadMode === 'file'
                      ? 'bg-jade text-white'
                      : 'text-secondary-text hover:text-foreground'
                  }`}
                >
                  {t('collaborator.modeFileBtn')}
                </button>
              </div>

              {uploadMode === 'link' ? (
                <div>
                  <label
                    htmlFor="collab-file-url"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    {t('collaborator.docUrlLabel')} <span className="text-primary">*</span>
                  </label>
                  <input
                    id="collab-file-url"
                    type="url"
                    required
                    placeholder={t('collaborator.docUrlPlaceholder')}
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="collab-file-input"
                    className="block text-xs font-bold text-foreground mb-1"
                  >
                    {t('collaborator.docFileLabel')}
                  </label>
                  <input
                    id="collab-file-input"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-secondary-text file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-jade-soft file:text-jade hover:file:bg-jade/20 cursor-pointer"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="collab-publish-date"
                  className="block text-xs font-bold text-foreground mb-1"
                >
                  {t('collaborator.publishDateLabel')}
                </label>
                <input
                  id="collab-publish-date"
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                {docId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn-arena btn-arena-secondary btn-arena-sm flex-1 cursor-pointer"
                  >
                    {t('collaborator.cancelBtn')}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-arena btn-arena-jade btn-arena-sm flex-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {isSubmitting ? 'hourglass_empty' : 'save'}
                  </span>
                  <span>
                    {isSubmitting
                      ? t('collaborator.uploadingBtn')
                      : docId
                        ? t('collaborator.updateDocBtn')
                        : t('collaborator.publishDocBtn')}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Contributed Documents */}
          <div className="lg:col-span-7 paper-card p-5 flex flex-col">
            <h3 className="font-display font-bold text-base text-foreground mb-4 flex items-center gap-2 border-b border-border pb-3">
              <span className="material-symbols-outlined text-jade" aria-hidden="true">
                inventory_2
              </span>
              <span>
                {t('collaborator.myDocsTitle', { count: formatNumber(myDocuments.length) })}
              </span>
            </h3>

            {loadingDocs ? (
              <div className="py-16 flex justify-center">
                <span
                  className="material-symbols-outlined animate-spin text-3xl text-jade"
                  aria-hidden="true"
                >
                  sync
                </span>
              </div>
            ) : myDocuments.length > 0 ? (
              <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                {myDocuments.map((doc) => {
                  const kind = getDocumentKindMeta(doc.title, doc.file_url, lang);
                  const safeUrl = sanitizeExternalUrl(doc.file_url);
                  const createdStr = formatDate(doc.created_at);

                  return (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-xl bg-paper border border-border hover:border-border-strong transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-jade-soft text-jade border border-jade-border whitespace-nowrap">
                              {getLocalizedCategoryLabel(doc.category, t)}
                            </span>
                          )}
                          {doc.is_featured && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gold-soft text-gold-dark border border-gold whitespace-nowrap">
                              {t('collaborator.statusFeatured')}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${
                              doc.is_public !== false
                                ? 'bg-surface-alt text-secondary-text border-border'
                                : 'bg-primary-soft text-primary border-primary/30'
                            }`}
                          >
                            {doc.is_public !== false
                              ? t('collaborator.statusPublic')
                              : t('collaborator.statusPrivate')}
                          </span>
                        </div>

                        <h4 className="font-display font-bold text-sm text-foreground truncate">
                          {doc.title}
                        </h4>
                        <p className="text-xs text-secondary-text truncate mt-0.5">
                          {doc.description || t('collaborator.noDescription')}
                        </p>
                        {createdStr && (
                          <p className="text-[10px] text-muted-foreground mt-1 tabular">
                            {t('collaborator.uploadedAtPrefix', { date: createdStr })}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {safeUrl && (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t('collaborator.openDocAria', {
                              title: doc.title || '',
                            }).trim()}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface-alt rounded-lg transition-colors cursor-pointer"
                            title={t('collaborator.openDocTitle')}
                          >
                            <span className="material-symbols-outlined text-lg" aria-hidden="true">
                              open_in_new
                            </span>
                          </a>
                        )}

                        <button
                          type="button"
                          aria-label={t('collaborator.editDocAria', {
                            title: doc.title || '',
                          }).trim()}
                          onClick={() => handleEdit(doc)}
                          className="p-2 text-muted-foreground hover:text-jade hover:bg-jade-soft rounded-lg transition-colors cursor-pointer"
                          title={t('collaborator.editShort')}
                        >
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">
                            edit
                          </span>
                        </button>

                        <button
                          type="button"
                          aria-label={t('collaborator.deleteDocAria', {
                            title: doc.title || '',
                          }).trim()}
                          onClick={() => setDeleteConfirmId(doc.id)}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary-soft rounded-lg transition-colors cursor-pointer"
                          title={t('collaborator.deleteShort')}
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
            ) : (
              <div className="p-12 text-center text-sm text-secondary-text border-2 border-dashed border-border rounded-xl">
                {t('collaborator.emptyDocs')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-[110] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={t('collaborator.deleteModalTitle')}
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
                  {t('collaborator.deleteModalTitle')}
                </h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  {t('collaborator.deleteModalDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="btn-arena btn-arena-secondary btn-arena-sm cursor-pointer"
              >
                {t('collaborator.cancelBtn')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="btn-arena btn-arena-primary btn-arena-sm cursor-pointer"
              >
                {t('collaborator.confirmDeleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
