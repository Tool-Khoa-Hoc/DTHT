import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/ToastProvider';
import { assertSafeExternalUrl } from '../utils/urlSecurity';
import { SOLE_BANG_CHU_ID, isSoleBangChuAccount } from '../utils/rankHelper';
import RankSeal from '../components/ui/RankSeal';
import AdminLibrary from '../components/admin/AdminLibrary';
import AdminCollaborator from '../components/admin/AdminCollaborator';
import AdminThongSoai from '../components/admin/AdminThongSoai';

const ADMIN_FALLBACK_SELECT =
  'id, display_name, full_name, email, avatar_url, role, is_vip, vip_expired_at, is_approved_bang_chu';

const normalizeDirectoryRow = (row) => ({
  id: row?.id ?? null,
  email: row?.email ?? null,
  display_name: row?.display_name ?? null,
  full_name: row?.full_name ?? null,
  avatar_url: row?.avatar_url ?? null,
  role: row?.role ?? 'user',
  is_vip: Boolean(row?.is_vip),
  vip_expired_at: row?.vip_expired_at ?? null,
  is_approved_bang_chu: Boolean(row?.is_approved_bang_chu),
});

export default function Admin() {
  const { user, profile, isAdmin } = useAuth();
  const { locale, t, formatNumber } = useLanguage();
  const { showToast } = useToast();

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'users' | 'thongsoai' | 'orders'

  // Tab 1: Library & Reports State
  const [documents, setDocuments] = useState([]);
  const [reports, setReports] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [docId, setDocId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [educationLevel, setEducationLevel] = useState('thpt');
  const [category, setCategory] = useState('toan');
  const [major, setMajor] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [publishDate, setPublishDate] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Tab 2: User Directory & Collaborator State
  const [collabSearchTerm, setCollabSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [loadingCollabs, setLoadingCollabs] = useState(false);
  const [hasDirectoryWarning, setHasDirectoryWarning] = useState(false);

  // Tab 3: Thong Soai & Bang Chu State
  const [candidates, setCandidates] = useState([]);
  const [approvedBangChuList, setApprovedBangChuList] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Tab 4: Orders / VIP State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderFilterStatus, setOrderFilterStatus] = useState('all');
  const [processingOrderId, setProcessingOrderId] = useState(null);

  // -------------------------------------------------------------
  // TAB 1: LIBRARY & REPORTS
  // -------------------------------------------------------------
  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(
          'id, title, description, category, category_id, education_level, major, author_name, file_url, file_type, file_size, is_public, is_featured, uploaded_by, created_at, uploaded_at, publish_date',
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error('Error loading documents:', err.message);
      showToast(tRef.current('admin.toastLoadDocsError', { error: err.message }), 'error');
    } finally {
      setLoadingDocs(false);
    }
  }, [showToast]);

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from('document_reports')
        .select(
          'id, document_id, reported_by, reason, created_at, documents(id, title, author_name)',
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Error loading reports:', err.message);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const handleResetDocForm = () => {
    setDocId(null);
    setTitle('');
    setDescription('');
    setAuthorName('');
    setEducationLevel('thpt');
    setCategory('toan');
    setMajor('');
    setFileUrl('');
    setIsFeatured(false);
    setIsPublic(true);
    setPublishDate('');
  };

  const handleEditDocument = (doc) => {
    setDocId(doc.id);
    setTitle(doc.title || '');
    setDescription(doc.description || '');
    setAuthorName(doc.author_name || '');
    setEducationLevel(doc.education_level || 'thpt');
    setCategory(doc.category || 'toan');
    setMajor(doc.major || '');
    setFileUrl(doc.file_url || '');
    setIsFeatured(Boolean(doc.is_featured));
    setIsPublic(doc.is_public !== false);
    setPublishDate(doc.publish_date || '');
  };

  const handleSaveDocument = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast(t('admin.toastTitleRequired'), 'warning');
      return;
    }

    let safeUrl = '';
    try {
      safeUrl = assertSafeExternalUrl(fileUrl, t('admin.toastInvalidUrl'));
    } catch (urlErr) {
      showToast(urlErr.message, 'warning');
      return;
    }

    setIsUploading(true);
    try {
      // ONLY valid columns for public.documents
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        category_id: category,
        education_level: educationLevel,
        major: major.trim(),
        author_name: authorName.trim() || profile?.display_name || t('admin.anonymousAuthor'),
        file_url: safeUrl,
        is_featured: isFeatured,
        is_public: isPublic,
        publish_date: publishDate || null,
        uploaded_by: user.id,
      };

      if (docId) {
        const { error } = await supabase
          .from('documents')
          .update(payload)
          .eq('id', docId);

        if (error) throw error;
        showToast(t('admin.toastDocUpdated'), 'success');
      } else {
        const { error } = await supabase.from('documents').insert([payload]);
        if (error) throw error;
        showToast(t('admin.toastDocAdded'), 'success');
      }

      handleResetDocForm();
      fetchDocuments();
    } catch (err) {
      showToast(t('admin.toastSaveDocError', { error: err.message }), 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (targetDocId) => {
    try {
      const { error } = await supabase.from('documents').delete().eq('id', targetDocId);
      if (error) throw error;
      showToast(t('admin.toastDocDeleted'), 'info');
      fetchDocuments();
      fetchReports();
    } catch (err) {
      showToast(t('admin.toastDeleteDocError', { error: err.message }), 'error');
    }
  };

  const handleResolveReport = async (reportId) => {
    try {
      const { error } = await supabase
        .from('document_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;
      showToast(t('admin.toastReportResolved'), 'success');
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      showToast(t('admin.toastReportError', { error: err.message }), 'error');
    }
  };

  // -------------------------------------------------------------
  // TAB 2: USER DIRECTORY & COLLABORATOR
  // -------------------------------------------------------------
  const fetchCollaborators = useCallback(async () => {
    setLoadingCollabs(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(ADMIN_FALLBACK_SELECT)
        .eq('role', 'collaborator')
        .order('display_name', { ascending: true });

      if (error) throw error;
      setCollaborators((data || []).map(normalizeDirectoryRow));
    } catch (err) {
      console.error('Error loading collaborators:', err);
    } finally {
      setLoadingCollabs(false);
    }
  }, []);

  const handleSearchUsers = async (e) => {
    if (e) e.preventDefault();
    const queryTerm = collabSearchTerm.trim();
    if (!queryTerm) return;

    setLoadingCollabs(true);
    setHasDirectoryWarning(false);
    try {
      // 1. Try RPC admin_user_directory first
      const { data, error } = await supabase.rpc('admin_user_directory', {
        p_search: queryTerm,
        p_limit: 25,
      });

      if (!error && Array.isArray(data)) {
        setSearchResults(data.map(normalizeDirectoryRow));
        return;
      }
      throw error || new Error('RPC returned empty');
    } catch (rpcErr) {
      // 2. Fallback to profiles query
      console.warn('admin_user_directory rpc failed, fallback to profiles query:', rpcErr);
      setHasDirectoryWarning(true);
      try {
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('profiles')
          .select(ADMIN_FALLBACK_SELECT)
          .or(`display_name.ilike.%${queryTerm}%,full_name.ilike.%${queryTerm}%,email.ilike.%${queryTerm}%`)
          .limit(25);

        if (!fallbackErr && fallbackData) {
          setSearchResults(fallbackData.map(normalizeDirectoryRow));
        }
      } catch (fErr) {
        showToast(t('admin.toastSearchError', { error: fErr.message }), 'error');
      }
    } finally {
      setLoadingCollabs(false);
    }
  };

  const handleSetUserRole = async (userId, newRole, name) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      showToast(
        newRole === 'collaborator'
          ? t('admin.toastGrantedCurator', { name })
          : t('admin.toastRevokedCurator', { name }),
        'success',
      );

      // Refresh both lists
      fetchCollaborators();
      setSearchResults((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (err) {
      showToast(t('admin.toastRoleError', { error: err.message }), 'error');
    }
  };

  // -------------------------------------------------------------
  // TAB 3: THONG SOAI & BANG CHU
  // -------------------------------------------------------------
  const fetchThongSoaiData = useCallback(async () => {
    setLoadingCandidates(true);
    try {
      // 1. Fetch Candidates via RPC
      try {
        const { data, error } = await supabase.rpc('admin_get_thongsoai_candidates', {
          p_min_completed: 50,
        });
        if (!error && data) {
          setCandidates(
            data.map((r) => ({
              ...r,
              completedCount: Number(r.completed_count) || 0,
            })),
          );
        }
      } catch (rpcErr) {
        console.warn('RPC admin_get_thongsoai_candidates error:', rpcErr);
      }

      // 2. Fetch sole Bang Chu account (and any legacy approved rows so they can be revoked if needed)
      const { data: bangChuData, error: bcError } = await supabase
        .from('profiles')
        .select(ADMIN_FALLBACK_SELECT)
        .or(`id.eq.${SOLE_BANG_CHU_ID},is_approved_bang_chu.eq.true`);

      if (!bcError && bangChuData) {
        setApprovedBangChuList(bangChuData.map(normalizeDirectoryRow));
      }
    } catch (err) {
      console.error('Error loading Guildmaster data:', err);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  const handleToggleBangChu = async (userId, currentStatus, name) => {
    const nextStatus = !currentStatus;
    if (nextStatus && !isSoleBangChuAccount(null, userId)) {
      showToast(t('admin.toastSoleBangChuWarning'), 'warning');
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved_bang_chu: nextStatus })
        .eq('id', userId);

      if (error) throw error;

      showToast(
        nextStatus
          ? t('admin.toastApprovedBangChu', { name })
          : t('admin.toastRevokedBangChu', { name }),
        'success',
      );

      fetchThongSoaiData();
    } catch (err) {
      showToast(t('admin.toastBangChuError', { error: err.message }), 'error');
    }
  };

  // -------------------------------------------------------------
  // TAB 4: ORDERS / VIP
  // -------------------------------------------------------------
  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      // Select real columns from public.orders
      let query = supabase
        .from('orders')
        .select(
          'id, user_id, package_id, amount, vip_days, status, transfer_code, created_at, updated_at',
        )
        .order('created_at', { ascending: false });

      if (orderFilterStatus !== 'all') {
        query = query.eq('status', orderFilterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error loading orders:', err);
      showToast(tRef.current('admin.toastLoadOrdersError', { error: err.message }), 'error');
    } finally {
      setLoadingOrders(false);
    }
  }, [orderFilterStatus, showToast]);

  const handleUpdateOrderStatus = async (orderId, newStatus, userId, vipDays = 30) => {
    setProcessingOrderId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      // If approved / paid, grant VIP on user's profile
      if (newStatus === 'paid' && userId) {
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() + (Number(vipDays) || 30));
        await supabase
          .from('profiles')
          .update({
            is_vip: true,
            vip_expired_at: expiredDate.toISOString(),
          })
          .eq('id', userId);
      }

      const localizedStatus =
        newStatus === 'paid'
          ? t('admin.statusPaid')
          : newStatus === 'expired'
            ? t('admin.statusExpired')
            : t('admin.statusPending');
      showToast(t('admin.toastOrderUpdated', { status: localizedStatus }), 'success');
      fetchOrders();
    } catch (err) {
      showToast(t('admin.toastOrderError', { error: err.message }), 'error');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Load baseline overview metrics once for admins
  useEffect(() => {
    if (!isAdmin) return;
    fetchDocuments();
    fetchReports();
    fetchCollaborators();
  }, [isAdmin, fetchDocuments, fetchReports, fetchCollaborators]);

  // Trigger tab-specific refreshes
  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'library') {
      fetchDocuments();
      fetchReports();
    } else if (activeTab === 'users') {
      fetchCollaborators();
    } else if (activeTab === 'thongsoai') {
      fetchThongSoaiData();
    } else if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [
    activeTab,
    isAdmin,
    fetchDocuments,
    fetchReports,
    fetchCollaborators,
    fetchThongSoaiData,
    fetchOrders,
  ]);

  if (!isAdmin) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center p-6">
        <div className="imperial-frame p-6 sm:p-8 max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">
              admin_panel_settings
            </span>
          </div>
          <h2 className="font-display font-bold text-xl text-foreground leading-snug">
            {t('admin.restrictedTitle')}
          </h2>
          <p className="text-xs text-secondary-text leading-relaxed">
            {t('admin.restrictedDesc')}
          </p>
          <Link to="/" className="btn-arena btn-arena-primary inline-flex">
            <span>{t('admin.backHome')}</span>
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'library', label: t('admin.tabLibrary'), icon: 'menu_book' },
    { id: 'users', label: t('admin.tabUsers'), icon: 'groups' },
    { id: 'thongsoai', label: t('admin.tabThongSoai'), icon: 'workspace_premium' },
    { id: 'orders', label: t('admin.tabOrders'), icon: 'receipt_long' },
  ];

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header — calibrated p-5 sm:p-8 */}
        <header className="imperial-frame p-5 sm:p-8 mb-6 relative overflow-hidden">
          <span
            aria-hidden="true"
            className="hanzi-watermark absolute top-2 right-6 text-8xl font-bold text-accent/8 select-none pointer-events-none"
          >
            政務
          </span>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <div className="mb-2">
                <RankSeal size="sm" icon="admin_panel_settings" label={t('admin.sealLabel')} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground leading-snug">
                {t('admin.title')}
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1">{t('admin.subtitle')}</p>
            </div>
          </div>

          {/* Overview Quick Stats Tiles */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="p-3.5 rounded-xl bg-paper border border-border">
              <p className="text-[11px] text-secondary-text">{t('admin.statDocs')}</p>
              <p className="text-lg font-display font-extrabold text-foreground tabular mt-0.5">
                {formatNumber(documents.length)}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-paper border border-border">
              <p className="text-[11px] text-secondary-text">{t('admin.statReports')}</p>
              <p className="text-lg font-display font-extrabold text-primary tabular mt-0.5">
                {formatNumber(reports.length)}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-paper border border-border">
              <p className="text-[11px] text-secondary-text">{t('admin.statCurators')}</p>
              <p className="text-lg font-display font-extrabold text-jade tabular mt-0.5">
                {formatNumber(collaborators.length)}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-paper border border-border">
              <p className="text-[11px] text-secondary-text">{t('admin.statOrders')}</p>
              <p className="text-lg font-display font-extrabold text-accent tabular mt-0.5">
                {formatNumber(orders.length)}
              </p>
            </div>
          </div>

          {/* Tab Navigation — clean pill borders on 375px mobile */}
          <div
            role="tablist"
            aria-label={t('admin.tabsAria')}
            className="relative z-10 flex flex-wrap sm:flex-nowrap gap-2 overflow-x-auto pt-3 border-t border-border no-scrollbar"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-surface border-border text-secondary-text hover:text-foreground hover:border-border-strong'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Tab Content */}
        <main>
          {activeTab === 'library' && (
            <AdminLibrary
              documents={documents}
              reports={reports}
              loadingDocs={loadingDocs}
              loadingReports={loadingReports}
              docId={docId}
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              authorName={authorName}
              setAuthorName={setAuthorName}
              educationLevel={educationLevel}
              setEducationLevel={setEducationLevel}
              category={category}
              setCategory={setCategory}
              major={major}
              setMajor={setMajor}
              fileUrl={fileUrl}
              setFileUrl={setFileUrl}
              isFeatured={isFeatured}
              setIsFeatured={setIsFeatured}
              isPublic={isPublic}
              setIsPublic={setIsPublic}
              publishDate={publishDate}
              setPublishDate={setPublishDate}
              isUploading={isUploading}
              onSaveDocument={handleSaveDocument}
              onEditDocument={handleEditDocument}
              onResetForm={handleResetDocForm}
              onDeleteDocument={handleDeleteDocument}
              onResolveReport={handleResolveReport}
            />
          )}

          {activeTab === 'users' && (
            <AdminCollaborator
              collaborators={collaborators}
              searchResults={searchResults}
              collabSearchTerm={collabSearchTerm}
              setCollabSearchTerm={setCollabSearchTerm}
              loadingCollabs={loadingCollabs}
              directoryWarning={hasDirectoryWarning ? t('admin.directoryFallbackWarning') : ''}
              onSearchUsers={handleSearchUsers}
              onSetUserRole={handleSetUserRole}
            />
          )}

          {activeTab === 'thongsoai' && (
            <AdminThongSoai
              candidates={candidates}
              approvedBangChuList={approvedBangChuList}
              loadingCandidates={loadingCandidates}
              onToggleBangChu={handleToggleBangChu}
            />
          )}

          {activeTab === 'orders' && (
            <div className="space-y-6">
              {/* Orders Header & Filter */}
              <div className="paper-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary" aria-hidden="true">
                      receipt_long
                    </span>
                    <span>
                      {t('admin.ordersTitle', { count: formatNumber(orders.length) })}
                    </span>
                  </h3>
                  <p className="text-xs text-secondary-text mt-0.5">{t('admin.ordersDesc')}</p>
                </div>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="admin-order-status-filter"
                    className="text-xs font-bold text-secondary-text whitespace-nowrap"
                  >
                    {t('admin.statusFilterLabel')}
                  </label>
                  <select
                    id="admin-order-status-filter"
                    value={orderFilterStatus}
                    onChange={(e) => setOrderFilterStatus(e.target.value)}
                    className="px-3 py-1.5 bg-paper border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="all">{t('admin.filterAll')}</option>
                    <option value="pending">{t('admin.filterPending')}</option>
                    <option value="paid">{t('admin.filterPaid')}</option>
                    <option value="expired">{t('admin.filterExpired')}</option>
                  </select>
                </div>
              </div>

              {/* Orders Table — calibrated overflow-x-auto rounded-2xl border border-border bg-surface */}
              {loadingOrders ? (
                <div className="rounded-2xl border border-border bg-surface py-16 flex justify-center">
                  <span
                    className="material-symbols-outlined animate-spin text-3xl text-primary"
                    aria-hidden="true"
                  >
                    sync
                  </span>
                </div>
              ) : orders.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-paper border-b border-border text-secondary-text font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3.5 whitespace-nowrap">{t('admin.colTransferCode')}</th>
                        <th className="p-3.5 whitespace-nowrap">{t('admin.colVipPackage')}</th>
                        <th className="p-3.5 whitespace-nowrap">{t('admin.colAmount')}</th>
                        <th className="p-3.5 whitespace-nowrap">{t('admin.colCreatedAt')}</th>
                        <th className="p-3.5 whitespace-nowrap">{t('admin.colStatus')}</th>
                        <th className="p-3.5 text-right whitespace-nowrap">
                          {t('admin.colActions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orders.map((ord) => {
                        const isPending = ord.status === 'pending';
                        const isPaid = ord.status === 'paid';
                        const statusLabel = isPaid
                          ? t('admin.statusPaid')
                          : isPending
                            ? t('admin.statusPending')
                            : t('admin.statusExpired');

                        return (
                          <tr
                            key={ord.id}
                            className="hover:bg-surface-alt transition-colors"
                          >
                            <td className="p-3.5 font-mono font-bold text-foreground whitespace-nowrap">
                              {ord.transfer_code || t('admin.notGenerated')}
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className="font-bold text-foreground">
                                {ord.package_id || '1m'}
                              </span>{' '}
                              {t('admin.vipDaysCount', { days: ord.vip_days || 30 })}
                            </td>
                            <td className="p-3.5 font-bold text-primary tabular whitespace-nowrap">
                              {formatNumber(Number(ord.amount || 0))} ₫
                            </td>
                            <td className="p-3.5 text-muted-foreground tabular whitespace-nowrap">
                              {ord.created_at
                                ? new Date(ord.created_at).toLocaleString(locale)
                                : '—'}
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase whitespace-nowrap ${
                                  isPaid
                                    ? 'bg-jade-soft text-jade border-jade-border'
                                    : isPending
                                      ? 'bg-gold-soft text-gold-dark border-gold'
                                      : 'bg-surface-alt text-muted-foreground border-border'
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap space-x-2">
                              {isPending && (
                                <button
                                  type="button"
                                  disabled={processingOrderId === ord.id}
                                  onClick={() =>
                                    handleUpdateOrderStatus(
                                      ord.id,
                                      'paid',
                                      ord.user_id,
                                      ord.vip_days,
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-jade-soft text-jade border border-jade-border hover:bg-jade hover:text-white transition-all cursor-pointer whitespace-nowrap"
                                >
                                  {t('admin.approveActivateBtn')}
                                </button>
                              )}
                              {isPaid && (
                                <button
                                  type="button"
                                  disabled={processingOrderId === ord.id}
                                  onClick={() =>
                                    handleUpdateOrderStatus(
                                      ord.id,
                                      'expired',
                                      ord.user_id,
                                      0,
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-surface-alt text-secondary-text border border-border hover:text-primary transition-all cursor-pointer whitespace-nowrap"
                                >
                                  {t('admin.markExpiredBtn')}
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
                <div className="rounded-2xl border border-border bg-surface p-12 text-center text-sm text-secondary-text">
                  {t('admin.emptyOrders')}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
