import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DOCUMENT_SELECT_FIELDS } from '../lib/documents';
import { Link } from 'react-router-dom';
import { getUserRank } from '../utils/rankHelper';
import { getLevelFromExp, getLevelAccent } from '../utils/levelHelper';
import Avatar from '../components/Avatar';
import AdminCollaborator from '../components/admin/AdminCollaborator';
import AdminThongSoai from '../components/admin/AdminThongSoai';
import AdminLibrary from '../components/admin/AdminLibrary';
import RankSeal from '../components/ui/RankSeal';

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [collabEmailInput, setCollabEmailInput] = useState('');
  const [isUpdatingCollab, setIsUpdatingCollab] = useState(false);

  const [thongSoaiEmail, setThongSoaiEmail] = useState('');
  const [isGrantingThongSoai, setIsGrantingThongSoai] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docGrade, setDocGrade] = useState('Lớp 12');
  const [docSubject, setDocSubject] = useState('Toán');
  const [docCategory, setDocCategory] = useState('Đề thi thử');
  const [uploadMode, setUploadMode] = useState('file');
  const [selectedFile, setSelectedFile] = useState(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [resourceLabel, setResourceLabel] = useState('Sheet / Link');
  const [isUploading, setIsUploading] = useState(false);

  const [roadmaps, setRoadmaps] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState('Khối A00');
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [newTaskInputs, setNewTaskInputs] = useState({});

  const [vipOrders, setVipOrders] = useState([]);
  const [loadingVipOrders, setLoadingVipOrders] = useState(false);
  const [vipFilterStatus, setVipFilterStatus] = useState('all');
  const [reviewingOrderId, setReviewingOrderId] = useState(null);

  const fetchVipOrders = useCallback(async () => {
    setLoadingVipOrders(true);
    try {
      const { data, error } = await supabase
        .from('vip_course_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setVipOrders(data);
    } catch (error) {
      console.error('Lỗi tải danh sách đơn VIP:', error.message);
    } finally {
      setLoadingVipOrders(false);
    }
  }, []);

  const handleReviewVipOrder = async (orderId, decision) => {
    const label = decision === 'approved' ? 'DUYỆT & MỞ KHÓA HỌC' : 'TỪ CHỐI';
    const note = window.prompt(
      `Nhập ghi chú phản hồi cho học viên (${label}) — có thể bỏ trống:`,
      decision === 'approved'
        ? 'Đã nhận đủ 50.000đ. Chúc bạn ôn thi hiệu quả!'
        : 'Chưa tìm thấy giao dịch khớp nội dung chuyển khoản.',
    );
    if (note === null) return;

    setReviewingOrderId(orderId);
    try {
      const { error } = await supabase.rpc('admin_review_vip_order', {
        p_order_id: orderId,
        p_decision: decision,
        p_admin_note: note,
      });

      if (error) throw error;
      await fetchVipOrders();
    } catch (error) {
      alert('Lỗi cập nhật đơn: ' + error.message);
    } finally {
      setReviewingOrderId(null);
    }
  };

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setUsersList(data);
    } catch (error) {
      console.error('Lỗi tải danh sách user:', error.message);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(DOCUMENT_SELECT_FIELDS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setDocuments(data);
    } catch (error) {
      console.error('Lỗi tải tài liệu:', error.message);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const fetchRoadmaps = useCallback(async () => {
    setLoadingRoadmap(true);
    try {
      const { data, error } = await supabase
        .from('roadmaps')
        .select(`
          id, block_name, title, description,
          roadmap_steps (
            id, step_number, phase_title, timeframe, description,
            roadmap_tasks ( id, task_title, is_custom )
          )
        `)
        .order('block_name', { ascending: true });

      if (error) throw error;
      if (data) {
        data.forEach((r) => {
          if (r.roadmap_steps) {
            r.roadmap_steps.sort((a, b) => a.step_number - b.step_number);
          }
        });
        setRoadmaps(data);
      }
    } catch (error) {
      console.error('Lỗi tải lộ trình:', error.message);
    } finally {
      setLoadingRoadmap(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    if (
      activeTab === 'users' ||
      activeTab === 'collaborator' ||
      activeTab === 'thong_soai'
    ) {
      fetchUsers();
    }
    if (activeTab === 'library') fetchDocuments();
    if (activeTab === 'roadmap') fetchRoadmaps();
    if (activeTab === 'vip_orders') fetchVipOrders();
  }, [activeTab, fetchDocuments, fetchRoadmaps, fetchUsers, fetchVipOrders, isAdmin]);

  const handleSetUserRole = async (targetUserId, newRole, userName) => {
    if (targetUserId === user.id) {
      alert('Bạn không thể tự thay đổi quyền của chính mình!');
      return;
    }

    const roleLabel =
      newRole === 'admin'
        ? 'Quản trị viên (Admin)'
        : newRole === 'collaborator'
          ? 'Cộng tác viên'
          : 'Học sinh';

    if (
      !window.confirm(
        `Bạn có chắc muốn đổi quyền của "${userName || 'Học viên này'}" thành [${roleLabel}]?`,
      )
    )
      return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUserId);

      if (error) throw error;
      setUsersList(
        usersList.map((u) => (u.id === targetUserId ? { ...u, role: newRole } : u)),
      );
    } catch (error) {
      alert('Lỗi cập nhật quyền: ' + error.message);
    }
  };

  const handleGrantCollaboratorByEmail = async (e) => {
    e.preventDefault();
    const targetEmail = collabEmailInput.trim().toLowerCase();
    if (!targetEmail) return;

    setIsUpdatingCollab(true);
    try {
      const foundUser = usersList.find(
        (u) => (u.email || '').toLowerCase() === targetEmail,
      );

      if (!foundUser) {
        alert(
          'Không tìm thấy tài khoản nào có email: ' +
            targetEmail +
            '. Hãy bảo bạn ấy đăng ký tài khoản trước nhé!',
        );
        return;
      }

      if (foundUser.role === 'admin') {
        alert('Tài khoản này đang là Admin (đã có toàn quyền).');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ role: 'collaborator' })
        .eq('id', foundUser.id);

      if (error) throw error;

      setUsersList(
        usersList.map((u) =>
          u.id === foundUser.id ? { ...u, role: 'collaborator' } : u,
        ),
      );
      setCollabEmailInput('');
      alert(
        `Đã cấp quyền Cộng tác viên cho ${foundUser.full_name || targetEmail} thành công!`,
      );
    } catch (error) {
      alert('Lỗi khi cấp quyền CTV: ' + error.message);
    } finally {
      setIsUpdatingCollab(false);
    }
  };

  const handleToggleThongSoai = async (targetUserId, currentStatus, userName) => {
    const newStatus = !currentStatus;
    const actionText = newStatus
      ? 'SẮC PHONG danh hiệu Thống Soái đặc cách'
      : 'THU HỒI danh hiệu Thống Soái đặc cách';

    if (!window.confirm(`Bạn muốn ${actionText} cho "${userName || 'chiến binh này'}"?`))
      return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_thong_soai: newStatus })
        .eq('id', targetUserId);

      if (error) throw error;
      setUsersList(
        usersList.map((u) =>
          u.id === targetUserId ? { ...u, is_thong_soai: newStatus } : u,
        ),
      );
    } catch (error) {
      alert('Lỗi cập nhật danh hiệu Thống Soái: ' + error.message);
    }
  };

  const handleAdjustUserExp = async (targetUser) => {
    const currentExp = Number(targetUser.exp) || 0;
    const currentLv = getLevelFromExp(currentExp).level;
    const raw = window.prompt(
      `Điều chỉnh EXP cho "${targetUser.full_name || targetUser.email || 'học viên'}"\n` +
        `Hiện tại: ${currentExp} EXP (Lv.${currentLv}).\n` +
        `Nhập số dương để cộng (vd: 120) hoặc số âm để trừ (vd: -60):`,
      '60',
    );
    if (raw === null) return;
    const delta = parseInt(raw.trim(), 10);
    if (!Number.isFinite(delta) || delta === 0) {
      alert('Vui lòng nhập một số nguyên khác 0.');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('admin_adjust_user_exp', {
        p_target_user: targetUser.id,
        p_delta: delta,
        p_reason: 'admin_panel',
      });
      if (error) throw error;

      const nextExp = data?.exp ?? Math.max(0, currentExp + delta);
      setUsersList(
        usersList.map((u) => (u.id === targetUser.id ? { ...u, exp: nextExp } : u)),
      );
    } catch (error) {
      alert(
        'Không thể điều chỉnh EXP (hãy chắc chắn đã chạy migration 20261022000000_exp_system_v2.sql): ' +
          error.message,
      );
    }
  };

  const handleGrantThongSoaiByEmail = async (e) => {
    e.preventDefault();
    const targetEmail = thongSoaiEmail.trim().toLowerCase();
    if (!targetEmail) return;

    setIsGrantingThongSoai(true);
    try {
      const foundUser = usersList.find(
        (u) => (u.email || '').toLowerCase() === targetEmail,
      );

      if (!foundUser) {
        alert('Không tìm thấy chiến binh nào có email: ' + targetEmail);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ is_thong_soai: true })
        .eq('id', foundUser.id);

      if (error) throw error;

      setUsersList(
        usersList.map((u) =>
          u.id === foundUser.id ? { ...u, is_thong_soai: true } : u,
        ),
      );
      setThongSoaiEmail('');
      alert(
        `Đã sắc phong Thống Soái cho ${foundUser.full_name || targetEmail} thành công!`,
      );
    } catch (error) {
      alert('Lỗi khi phong hàm Thống Soái: ' + error.message);
    } finally {
      setIsGrantingThongSoai(false);
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      alert('Vui lòng nhập tên tài liệu!');
      return;
    }
    if (uploadMode === 'file' && !selectedFile) {
      alert('Vui lòng chọn file PDF!');
      return;
    }
    if (uploadMode === 'link' && !externalUrl.trim()) {
      alert('Vui lòng nhập link Google Sheet / Google Drive!');
      return;
    }

    setIsUploading(true);
    try {
      let finalUrl = '';
      let finalFileName = '';
      let finalFileSize = '';

      if (uploadMode === 'file') {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `${docGrade}/${docSubject}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('documents').getPublicUrl(filePath);

        finalUrl = publicUrl;
        finalFileName = selectedFile.name;
        finalFileSize = (selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB';
      } else {
        const normalizedUrl = externalUrl.trim();
        if (!/^https?:\/\//i.test(normalizedUrl)) {
          throw new Error('Link phải bắt đầu bằng http:// hoặc https://');
        }
        finalUrl = normalizedUrl;
        finalFileName = normalizedUrl;
        finalFileSize = resourceLabel.trim() || 'Link ngoài';
      }

      const { error: dbError } = await supabase.from('documents').insert([
        {
          title: docTitle.trim(),
          grade: docGrade,
          subject: docSubject,
          category: docCategory,
          file_name: finalFileName,
          file_size: finalFileSize,
          file_url: finalUrl,
          uploaded_by: user.id,
        },
      ]);

      if (dbError) throw dbError;

      alert('Tải tài liệu lên thành công!');
      setDocTitle('');
      setSelectedFile(null);
      setExternalUrl('');
      if (document.getElementById('file-upload')) {
        document.getElementById('file-upload').value = '';
      }
      fetchDocuments();
    } catch (error) {
      alert('Lỗi khi tải tài liệu: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này?')) return;
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      setDocuments(documents.filter((doc) => doc.id !== id));
    } catch (error) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

  const handleAddOfficialTask = async (stepId) => {
    const taskTitle = newTaskInputs[stepId];
    if (!taskTitle || !taskTitle.trim()) return;

    try {
      const { error } = await supabase
        .from('roadmap_tasks')
        .insert([{ step_id: stepId, task_title: taskTitle.trim(), is_custom: false }]);

      if (error) throw error;
      setNewTaskInputs({ ...newTaskInputs, [stepId]: '' });
      fetchRoadmaps();
    } catch (error) {
      alert('Lỗi thêm nhiệm vụ: ' + error.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Xóa nhiệm vụ này khỏi lộ trình chuẩn?')) return;
    try {
      const { error } = await supabase.from('roadmap_tasks').delete().eq('id', taskId);
      if (error) throw error;
      fetchRoadmaps();
    } catch (error) {
      alert('Lỗi xóa nhiệm vụ: ' + error.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center bg-background">
        <span className="material-symbols-outlined text-6xl text-primary mb-4" aria-hidden="true">
          gpp_bad
        </span>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">
          Truy Cập Bị Từ Chối!
        </h1>
        <p className="text-secondary-text max-w-md mb-6 text-sm">
          Khu vực này chỉ dành riêng cho Ban Quản Trị (Admin) của Đấu Trường Học Tập.
        </p>
        <Link to="/home" className="btn-arena btn-arena-primary btn-arena-sm">
          Quay về Trang chủ
        </Link>
      </div>
    );
  }

  const currentRoadmap = roadmaps.find((r) => r.block_name === selectedBlock);

  const ADMIN_TABS = [
    { id: 'users', label: 'Học viên', icon: 'group' },
    { id: 'collaborator', label: 'Cộng tác viên', icon: 'group_add' },
    { id: 'thong_soai', label: 'Phong Thống Soái', icon: 'emoji_events' },
    { id: 'vip_orders', label: 'Đơn Khóa Học 50K', icon: 'workspace_premium' },
    { id: 'library', label: 'Kho Tài liệu', icon: 'folder_open' },
    { id: 'roadmap', label: 'Lộ trình Chuẩn', icon: 'timeline' },
  ];

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Admin Header */}
        <header className="imperial-frame p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
          <span
            aria-hidden="true"
            className="hanzi-watermark absolute top-2 right-5 text-7xl font-bold text-primary/8"
          >
            中樞
          </span>

          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-primary-soft border border-primary/35 flex items-center justify-center text-primary no-shrink">
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                admin_panel_settings
              </span>
            </div>
            <div>
              <div className="mb-1">
                <RankSeal size="sm" icon="gavel" label="Soái Phủ · Trung Tâm Quản Trị" />
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-extrabold tracking-tight text-foreground">
                Trung Tâm Quản Trị (Admin Panel)
              </h1>
              <p className="text-xs text-secondary-text">
                Quản lý học viên, Cộng tác viên, sắc phong Thống Soái và kho học liệu
              </p>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-border no-scrollbar">
          {ADMIN_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-bold text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-secondary-text hover:bg-surface-alt hover:text-foreground'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <main>
          {activeTab === 'users' && (
            <div className="paper-card overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-border flex justify-between items-center bg-paper">
                <h2 className="font-display font-bold text-base text-foreground">
                  Tổng số thành viên ({usersList.length})
                </h2>
                <button
                  type="button"
                  onClick={fetchUsers}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-bold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    refresh
                  </span>
                  Làm mới
                </button>
              </div>

              {loadingUsers ? (
                <div className="p-12 flex justify-center">
                  <span
                    className="material-symbols-outlined animate-spin text-3xl text-primary"
                    aria-hidden="true"
                  >
                    sync
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-alt text-secondary-text text-xs uppercase tracking-wider border-b border-border">
                        <th className="p-4 font-bold">Học viên</th>
                        <th className="p-4 font-bold">Trường / Khối</th>
                        <th className="p-4 font-bold">Cấp bậc &amp; Giờ học</th>
                        <th className="p-4 font-bold">Level &amp; EXP</th>
                        <th className="p-4 font-bold">Vai trò</th>
                        <th className="p-4 font-bold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {usersList.map((u) => {
                        const rInfo = getUserRank(u.total_study_minutes || 0, u.is_thong_soai);
                        const lvInfo = getLevelFromExp(u.exp || 0);
                        const lvAccent = getLevelAccent(lvInfo.level);
                        return (
                          <tr key={u.id} className="hover:bg-surface-alt/70 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <Avatar
                                  src={u.avatar_url}
                                  name={u.full_name || u.email}
                                  className="w-9 h-9"
                                  textSize="text-xs"
                                />
                                <div>
                                  <p className="font-bold text-foreground">
                                    {u.full_name || 'Chưa đặt tên'}
                                  </p>
                                  <p className="text-xs text-secondary-text">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <p className="text-foreground">{u.school_name || '—'}</p>
                              <p className="text-xs text-secondary-text">{u.grade || 'Lớp 12'}</p>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${rInfo.bg} ${rInfo.color} ${rInfo.border}`}
                                >
                                  <span
                                    className="material-symbols-outlined text-[12px]"
                                    aria-hidden="true"
                                  >
                                    {rInfo.icon}
                                  </span>
                                  {rInfo.name}
                                </span>
                                <span className="text-xs text-secondary-text tabular">
                                  ({u.total_study_minutes || 0}p)
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`tabular inline-flex items-center text-[11px] font-extrabold px-2 py-0.5 rounded border ${lvAccent.badge}`}
                                >
                                  Lv.{lvInfo.level}
                                </span>
                                <span className="tabular text-xs text-foreground font-semibold">
                                  {lvInfo.totalExp} EXP
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustUserExp(u)}
                                  title="Cộng / trừ EXP"
                                  className="px-2 py-0.5 rounded text-[11px] font-bold bg-gold-soft text-gold-dark border border-gold hover:bg-gold/30 transition-colors cursor-pointer"
                                >
                                  ±EXP
                                </button>
                              </div>
                            </td>
                            <td className="p-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  u.role === 'admin'
                                    ? 'bg-primary-soft text-primary border-primary/35'
                                    : u.role === 'collaborator'
                                      ? 'bg-jade-soft text-jade border-jade-border'
                                      : 'bg-surface-alt text-secondary-text border-border'
                                }`}
                              >
                                {u.role === 'admin'
                                  ? 'Admin'
                                  : u.role === 'collaborator'
                                    ? 'Cộng tác viên'
                                    : 'Học sinh'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <select
                                aria-label={`Đổi vai trò của ${u.full_name || u.email}`}
                                value={u.role || 'student'}
                                onChange={(e) =>
                                  handleSetUserRole(
                                    u.id,
                                    e.target.value,
                                    u.full_name || u.email,
                                  )
                                }
                                disabled={u.id === user.id}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-paper border border-border-strong text-foreground focus:outline-none focus:border-primary disabled:opacity-40"
                              >
                                <option value="student">Học sinh</option>
                                <option value="collaborator">Cộng tác viên</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'collaborator' && (
            <AdminCollaborator
              usersList={usersList}
              collabEmailInput={collabEmailInput}
              setCollabEmailInput={setCollabEmailInput}
              isUpdatingCollab={isUpdatingCollab}
              onGrantByEmail={handleGrantCollaboratorByEmail}
              onSetUserRole={handleSetUserRole}
            />
          )}

          {activeTab === 'thong_soai' && (
            <AdminThongSoai
              usersList={usersList}
              thongSoaiEmail={thongSoaiEmail}
              setThongSoaiEmail={setThongSoaiEmail}
              isGrantingThongSoai={isGrantingThongSoai}
              onGrantByEmail={handleGrantThongSoaiByEmail}
              onToggleThongSoai={handleToggleThongSoai}
            />
          )}

          {activeTab === 'vip_orders' && (
            <div className="paper-card overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-paper">
                <div>
                  <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                    <span
                      className="material-symbols-outlined text-primary"
                      aria-hidden="true"
                    >
                      workspace_premium
                    </span>
                    Đơn đăng ký COMBO ĐTHT – HS12 (2K9) · 50.000đ ({vipOrders.length})
                  </h2>
                  <p className="text-xs text-secondary-text mt-0.5">
                    Hệ thống tự động đối soát qua API MB Bank khi học viên bấm kiểm tra; Admin cũng có thể duyệt thủ công tại đây.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'submitted', label: 'Chờ duyệt' },
                    { id: 'approved', label: 'Đã duyệt' },
                    { id: 'pending', label: 'Mới tạo mã' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setVipFilterStatus(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border cursor-pointer ${
                        vipFilterStatus === f.id
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface text-secondary-text border-border hover:text-foreground'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={fetchVipOrders}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-surface hover:bg-surface-alt border border-border-strong text-primary flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      refresh
                    </span>
                    Làm mới
                  </button>
                </div>
              </div>

              {loadingVipOrders ? (
                <div className="p-12 flex justify-center">
                  <span
                    className="material-symbols-outlined animate-spin text-3xl text-primary"
                    aria-hidden="true"
                  >
                    sync
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-alt text-secondary-text text-xs uppercase tracking-wider border-b border-border">
                        <th className="p-4 font-bold">Mã CK</th>
                        <th className="p-4 font-bold">Học viên</th>
                        <th className="p-4 font-bold">Số tiền</th>
                        <th className="p-4 font-bold">Ghi chú giao dịch</th>
                        <th className="p-4 font-bold">Trạng thái</th>
                        <th className="p-4 font-bold text-right">Duyệt đơn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {vipOrders
                        .filter((o) =>
                          vipFilterStatus === 'all' ? true : o.status === vipFilterStatus,
                        )
                        .map((order) => (
                          <tr key={order.id} className="hover:bg-surface-alt/70">
                            <td className="p-4">
                              <span className="font-mono font-extrabold text-primary bg-primary-soft border border-primary/30 px-2.5 py-1 rounded-lg text-xs">
                                {order.transfer_code}
                              </span>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {new Date(order.created_at).toLocaleString('vi-VN')}
                              </p>
                            </td>
                            <td className="p-4">
                              <p className="font-bold text-foreground">
                                {order.user_full_name || 'Học viên'}
                              </p>
                              <p className="text-xs text-secondary-text">{order.user_email}</p>
                            </td>
                            <td className="p-4 font-display font-extrabold text-completed tabular">
                              {(order.amount || 50000).toLocaleString('vi-VN')}đ
                            </td>
                            <td className="p-4 max-w-xs">
                              <p className="text-xs text-foreground break-words">
                                {order.user_note || (
                                  <span className="text-muted-foreground italic">
                                    Chưa gửi ghi chú
                                  </span>
                                )}
                              </p>
                              {order.admin_note && (
                                <p className="text-[11px] text-accent mt-1">
                                  Admin: {order.admin_note}
                                </p>
                              )}
                            </td>
                            <td className="p-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  order.status === 'approved'
                                    ? 'bg-completed-soft text-completed border-completed-border'
                                    : order.status === 'submitted'
                                      ? 'bg-gold-soft text-gold-dark border-gold'
                                      : order.status === 'rejected'
                                        ? 'bg-primary-soft text-primary border-primary/35'
                                        : 'bg-surface-alt text-secondary-text border-border'
                                }`}
                              >
                                {order.status === 'approved'
                                  ? 'Đã kích hoạt'
                                  : order.status === 'submitted'
                                    ? 'Đã báo CK · Chờ duyệt'
                                    : order.status === 'rejected'
                                      ? 'Từ chối'
                                      : 'Mới tạo mã'}
                              </span>
                              {order.auto_matched && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-jade-soft text-jade border border-jade-border">
                                  <span
                                    className="material-symbols-outlined text-[12px]"
                                    aria-hidden="true"
                                  >
                                    bolt
                                  </span>
                                  Tự động
                                </span>
                              )}
                              {order.bank_transaction_id && (
                                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                                  Mã GD: #{order.bank_transaction_id}
                                </p>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {order.status !== 'approved' && (
                                  <button
                                    type="button"
                                    disabled={reviewingOrderId === order.id}
                                    onClick={() => handleReviewVipOrder(order.id, 'approved')}
                                    className="px-3 py-1.5 rounded-lg bg-completed hover:bg-completed/90 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                  >
                                    Duyệt mở khóa
                                  </button>
                                )}
                                {order.status !== 'rejected' && (
                                  <button
                                    type="button"
                                    disabled={reviewingOrderId === order.id}
                                    onClick={() => handleReviewVipOrder(order.id, 'rejected')}
                                    className="px-2.5 py-1.5 rounded-lg bg-primary-soft hover:bg-primary hover:text-white text-primary border border-primary/30 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                  >
                                    Từ chối
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {vipOrders.length === 0 && (
                    <div className="p-8 text-center text-secondary-text text-sm">
                      Chưa có đơn đăng ký khóa học nào.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'library' && (
            <AdminLibrary
              documents={documents}
              loadingDocs={loadingDocs}
              docTitle={docTitle}
              setDocTitle={setDocTitle}
              docGrade={docGrade}
              setDocGrade={setDocGrade}
              docSubject={docSubject}
              setDocSubject={setDocSubject}
              docCategory={docCategory}
              setDocCategory={setDocCategory}
              uploadMode={uploadMode}
              setUploadMode={setUploadMode}
              setSelectedFile={setSelectedFile}
              externalUrl={externalUrl}
              setExternalUrl={setExternalUrl}
              resourceLabel={resourceLabel}
              setResourceLabel={setResourceLabel}
              isUploading={isUploading}
              onUploadDocument={handleUploadDocument}
              onDeleteDocument={handleDeleteDocument}
            />
          )}

          {activeTab === 'roadmap' && (
            <div className="space-y-6">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {[
                  'Khối A00',
                  'Khối A01',
                  'Khối B00',
                  'Khối C00',
                  'Khối D01',
                  'Đánh giá năng lực',
                ].map((block) => (
                  <button
                    key={block}
                    type="button"
                    onClick={() => setSelectedBlock(block)}
                    className={`px-4 py-2 rounded-xl text-xs font-display font-bold whitespace-nowrap transition-all border cursor-pointer ${
                      selectedBlock === block
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface border-border text-secondary-text hover:text-foreground'
                    }`}
                  >
                    {block}
                  </button>
                ))}
              </div>

              {loadingRoadmap ? (
                <div className="flex justify-center py-12">
                  <span
                    className="material-symbols-outlined animate-spin text-3xl text-primary"
                    aria-hidden="true"
                  >
                    sync
                  </span>
                </div>
              ) : currentRoadmap ? (
                <div className="space-y-6">
                  {currentRoadmap.roadmap_steps?.map((step) => (
                    <div key={step.id} className="paper-card p-5 space-y-4">
                      <div className="border-b border-border pb-3">
                        <span className="text-[10px] font-bold text-gold-dark uppercase tracking-wider bg-gold-soft border border-gold px-2 py-0.5 rounded">
                          {step.timeframe}
                        </span>
                        <h3 className="text-lg font-display font-bold text-foreground mt-1">
                          {step.phase_title}
                        </h3>
                        <p className="text-xs text-secondary-text">{step.description}</p>
                      </div>

                      <div className="space-y-2">
                        {step.roadmap_tasks?.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-paper border border-border"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="material-symbols-outlined text-jade text-sm"
                                aria-hidden="true"
                              >
                                check_circle
                              </span>
                              <span className="text-sm text-foreground">{task.task_title}</span>
                              {task.is_custom && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold-soft text-gold-dark border border-gold">
                                  User tự thêm
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              aria-label="Xoá nhiệm vụ"
                              className="text-muted-foreground hover:text-primary p-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-base" aria-hidden="true">
                                close
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          placeholder="Nhập nhiệm vụ chuẩn mới cho giai đoạn này..."
                          value={newTaskInputs[step.id] || ''}
                          onChange={(e) =>
                            setNewTaskInputs({ ...newTaskInputs, [step.id]: e.target.value })
                          }
                          onKeyDown={(e) =>
                            e.key === 'Enter' && handleAddOfficialTask(step.id)
                          }
                          className="flex-1 px-3.5 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddOfficialTask(step.id)}
                          className="btn-arena btn-arena-primary btn-arena-sm"
                        >
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">
                            add
                          </span>
                          Thêm
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
