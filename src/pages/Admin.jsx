import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
  const { showToast } = useToast();

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
  const [directoryWarning, setDirectoryWarning] = useState('');

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
      console.error('Lỗi tải tài liệu:', err.message);
      showToast('Lỗi tải kho tài liệu: ' + err.message, 'error');
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
      console.error('Lỗi tải báo cáo:', err.message);
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
      showToast('Vui lòng nhập tiêu đề tài liệu!', 'warning');
      return;
    }

    let safeUrl = '';
    try {
      safeUrl = assertSafeExternalUrl(fileUrl, 'URL tài liệu không hợp lệ!');
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
        author_name: authorName.trim() || profile?.display_name || 'Khuyết danh',
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
        showToast('Đã cập nhật tài liệu thành công!', 'success');
      } else {
        const { error } = await supabase.from('documents').insert([payload]);
        if (error) throw error;
        showToast('Đã thêm tài liệu mới vào Thư viện!', 'success');
      }

      handleResetDocForm();
      fetchDocuments();
    } catch (err) {
      showToast('Lỗi lưu tài liệu: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (targetDocId) => {
    try {
      const { error } = await supabase.from('documents').delete().eq('id', targetDocId);
      if (error) throw error;
      showToast('Đã xóa tài liệu khỏi hệ thống', 'info');
      fetchDocuments();
      fetchReports();
    } catch (err) {
      showToast('Lỗi khi xóa tài liệu: ' + err.message, 'error');
    }
  };

  const handleResolveReport = async (reportId) => {
    try {
      const { error } = await supabase
        .from('document_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;
      showToast('Đã giải quyết báo cáo sự cố', 'success');
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      showToast('Lỗi xử lý báo cáo: ' + err.message, 'error');
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
      console.error('Lỗi tải danh sách CTV:', err);
    } finally {
      setLoadingCollabs(false);
    }
  }, []);

  const handleSearchUsers = async (e) => {
    if (e) e.preventDefault();
    const queryTerm = collabSearchTerm.trim();
    if (!queryTerm) return;

    setLoadingCollabs(true);
    setDirectoryWarning('');
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
      setDirectoryWarning('Đang tìm kiếm dự phòng qua bảng profiles.');
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
        showToast('Lỗi tìm kiếm: ' + fErr.message, 'error');
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
          ? `Đã sắc phong Truyền Đạo Sư cho ${name}!`
          : `Đã thu hồi quyền Truyền Đạo Sư của ${name}!`,
        'success',
      );

      // Refresh both lists
      fetchCollaborators();
      setSearchResults((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (err) {
      showToast('Lỗi cập nhật phân quyền: ' + err.message, 'error');
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
      console.error('Lỗi tải dữ liệu Bang Chủ:', err);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  const handleToggleBangChu = async (userId, currentStatus, name) => {
    const nextStatus = !currentStatus;
    if (nextStatus && !isSoleBangChuAccount(null, userId)) {
      showToast(
        'Ngôi vị Bang Chủ là độc tôn — không tài khoản nào khác được phép là Bang Chủ!',
        'warning',
      );
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
          ? `Đã xác nhận ngôi vị Bang Chủ cho ${name}!`
          : `Đã thu hồi danh hiệu Bang Chủ của ${name}!`,
        'success',
      );

      fetchThongSoaiData();
    } catch (err) {
      showToast('Lỗi cập nhật Bang Chủ: ' + err.message, 'error');
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
      console.error('Lỗi tải danh sách đơn hàng:', err);
      showToast('Lỗi tải đơn hàng: ' + err.message, 'error');
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

      showToast(`Đã cập nhật trạng thái đơn thành "${newStatus}"!`, 'success');
      fetchOrders();
    } catch (err) {
      showToast('Lỗi cập nhật đơn: ' + err.message, 'error');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Trigger loads based on active tab
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
        <div className="imperial-frame p-8 max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">
              admin_panel_settings
            </span>
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">
            Khu vực Quản trị Quân Sư
          </h2>
          <p className="text-xs text-secondary-text leading-relaxed">
            Trang này chỉ dành riêng cho Ban Quản trị hệ thống Đấu Trường Học Tập.
          </p>
          <Link to="/" className="btn-arena btn-arena-primary inline-flex">
            <span>Về trang chủ</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header */}
        <header className="imperial-frame p-5 sm:p-7 mb-6 relative overflow-hidden">
          <span
            aria-hidden="true"
            className="hanzi-watermark absolute top-2 right-6 text-8xl font-bold text-accent/8"
          >
            政務
          </span>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="mb-2">
                <RankSeal size="sm" icon="admin_panel_settings" label="Nội Các Triều Đình" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground">
                Trung Tâm Quản Trị Hệ Thống
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1">
                Điều phối kho tàng học liệu, duyệt Bang Chủ, quản lý đơn hàng &amp; danh bạ sĩ tử
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="relative z-10 flex gap-2 overflow-x-auto pt-3 border-t border-border no-scrollbar">
            {[
              { id: 'library', label: 'Quản lý Thư viện', icon: 'menu_book' },
              { id: 'users', label: 'Danh bạ & Truyền Đạo Sư', icon: 'groups' },
              { id: 'thongsoai', label: 'Sắc phong Bang Chủ', icon: 'workspace_premium' },
              { id: 'orders', label: 'Lịch sử Đơn hàng & VIP', icon: 'receipt_long' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border cursor-pointer ${
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
              directoryWarning={directoryWarning}
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
                    <span>Danh sách Giao dịch &amp; Đơn hàng ({orders.length})</span>
                  </h3>
                  <p className="text-xs text-secondary-text mt-0.5">
                    Quản lý các yêu cầu nâng cấp gói VIP &amp; đối soát thanh toán VietQR
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-secondary-text">Trạng thái:</span>
                  <select
                    value={orderFilterStatus}
                    onChange={(e) => setOrderFilterStatus(e.target.value)}
                    className="px-3 py-1.5 bg-paper border border-border-strong rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="all">Tất cả đơn</option>
                    <option value="pending">Chờ thanh toán (pending)</option>
                    <option value="paid">Đã thanh toán (paid)</option>
                    <option value="expired">Đã hết hạn (expired)</option>
                  </select>
                </div>
              </div>

              {/* Orders Table */}
              <div className="paper-card overflow-hidden">
                {loadingOrders ? (
                  <div className="py-16 flex justify-center">
                    <span
                      className="material-symbols-outlined animate-spin text-3xl text-primary"
                      aria-hidden="true"
                    >
                      sync
                    </span>
                  </div>
                ) : orders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-paper border-b border-border text-secondary-text font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3.5">Mã chuyển khoản</th>
                          <th className="p-3.5">Gói VIP</th>
                          <th className="p-3.5">Số tiền</th>
                          <th className="p-3.5">Thời gian tạo</th>
                          <th className="p-3.5">Trạng thái</th>
                          <th className="p-3.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {orders.map((ord) => {
                          const isPending = ord.status === 'pending';
                          const isPaid = ord.status === 'paid';

                          return (
                            <tr
                              key={ord.id}
                              className="hover:bg-surface-alt transition-colors"
                            >
                              <td className="p-3.5 font-mono font-bold text-foreground">
                                {ord.transfer_code || 'Chưa tạo'}
                              </td>
                              <td className="p-3.5">
                                <span className="font-bold text-foreground">
                                  {ord.package_id || '1m'}
                                </span>{' '}
                                ({ord.vip_days || 30} ngày)
                              </td>
                              <td className="p-3.5 font-bold text-primary tabular">
                                {Number(ord.amount || 0).toLocaleString('vi-VN')} đ
                              </td>
                              <td className="p-3.5 text-muted-foreground">
                                {new Date(ord.created_at).toLocaleString('vi-VN')}
                              </td>
                              <td className="p-3.5">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                                    isPaid
                                      ? 'bg-jade-soft text-jade border-jade-border'
                                      : isPending
                                        ? 'bg-gold-soft text-gold-dark border-gold'
                                        : 'bg-surface-alt text-muted-foreground border-border'
                                  }`}
                                >
                                  {ord.status}
                                </span>
                              </td>
                              <td className="p-3.5 text-right space-x-2">
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
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-jade-soft text-jade border border-jade-border hover:bg-jade hover:text-white transition-all cursor-pointer"
                                  >
                                    Duyệt kích hoạt
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
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-surface-alt text-secondary-text border border-border hover:text-primary transition-all cursor-pointer"
                                  >
                                    Đánh dấu hết hạn
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
                  <div className="p-12 text-center text-sm text-secondary-text">
                    Không có đơn hàng nào khớp bộ lọc.
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
