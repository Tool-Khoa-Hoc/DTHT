import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const VIP_PRESET_DAYS = [7, 30, 90, 365];
const ADMIN_USER_DIRECTORY_SELECT_LIMIT = 200;

export default function AdminVip({ isActive }) {
  const [vipSearch, setVipSearch] = useState('');
  const [vipGrantEmail, setVipGrantEmail] = useState('');
  const [vipGrantDays, setVipGrantDays] = useState(30);
  const [vipUsers, setVipUsers] = useState([]);
  const [vipLoading, setVipLoading] = useState(false);
  const [vipGrantLoading, setVipGrantLoading] = useState(false);
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [paymentLogsLoading, setPaymentLogsLoading] = useState(false);
  const [vipMsg, setVipMsg] = useState({ type: '', text: '' });
  const [vipMembers, setVipMembers] = useState([]);
  const [vipMembersLoading, setVipMembersLoading] = useState(false);

  useEffect(() => {
    if (isActive) {
      fetchPaymentLogs();
      fetchVipMembers();
    }
  }, [isActive]);

  const showVipMessage = (type, text) => {
    setVipMsg({ type, text });
    window.setTimeout(() => setVipMsg({ type: '', text: '' }), 3000);
  };

  const adminUserDirectory = async ({ search = null, role = null, ids = null, limit = 10 } = {}) => {
    const { data, error } = await supabase.rpc('admin_user_directory', {
      p_search: search,
      p_role: role,
      p_ids: ids,
      p_limit: limit,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  const searchVipUsers = async (searchValue = vipSearch) => {
    const keyword = searchValue.trim();
    if (!keyword) {
      setVipUsers([]);
      return;
    }
    setVipLoading(true);
    try {
      const data = await adminUserDirectory({ search: keyword, limit: 10 });
      setVipUsers(data);
      if (data.length === 0) {
        showVipMessage('error', 'Không tìm thấy người dùng phù hợp với từ khóa này.');
      }
    } catch (err) {
      console.error(err);
      showVipMessage('error', 'Không tìm thấy người dùng phù hợp hoặc truy vấn bị lỗi.');
    } finally {
      setVipLoading(false);
    }
  };

  const extendVipMembership = async (userId, days) => {
    if (!days || days <= 0) throw new Error('Số ngày VIP phải lớn hơn 0.');
    const { data: p, error: profileError } = await supabase
      .from('profiles')
      .select('vip_expired_at')
      .eq('id', userId)
      .single();
    if (profileError) throw profileError;

    const base = (p?.vip_expired_at && new Date(p.vip_expired_at) > new Date())
      ? new Date(p.vip_expired_at)
      : new Date();
    const newExpiry = new Date(base.getTime() + days * 86400000);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_vip: true, vip_expired_at: newExpiry.toISOString() })
      .eq('id', userId);
    if (updateError) throw updateError;
    return newExpiry;
  };

  const addVipDays = async (userId, days) => {
    try {
      await extendVipMembership(userId, days);
      showVipMessage('success', `Đã cộng ${days} ngày VIP!`);
      await searchVipUsers();
      await fetchVipMembers();
    } catch (err) {
      showVipMessage('error', 'Lỗi: ' + err.message);
    }
  };

  const toggleVip = async (userId, currentState) => {
    try {
      const { error } = await supabase.from('profiles').update({
        is_vip: !currentState,
        vip_expired_at: !currentState ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
      }).eq('id', userId);
      if (error) throw error;
      showVipMessage('success', currentState ? 'Đã tắt VIP.' : 'Đã bật VIP 30 ngày.');
      await searchVipUsers();
      await fetchVipMembers();
    } catch (err) {
      showVipMessage('error', 'Lỗi: ' + err.message);
    }
  };

  const grantVipByEmail = async (e) => {
    e.preventDefault();
    const normalizedEmail = vipGrantEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      showVipMessage('error', 'Vui lòng nhập gmail hoặc email tài khoản cần cấp VIP.');
      return;
    }
    if (!vipGrantDays || vipGrantDays <= 0) {
      showVipMessage('error', 'Số ngày VIP phải lớn hơn 0.');
      return;
    }
    setVipGrantLoading(true);
    try {
      const matches = await adminUserDirectory({ search: normalizedEmail, limit: 20 });
      const targetUser = matches.find(candidate => candidate.email?.toLowerCase() === normalizedEmail);
      if (!targetUser) throw new Error('Không tìm thấy tài khoản với email này.');
      await extendVipMembership(targetUser.id, vipGrantDays);
      setVipGrantEmail(targetUser.email || normalizedEmail);
      setVipSearch(targetUser.email || normalizedEmail);
      await searchVipUsers(targetUser.email || normalizedEmail);
      showVipMessage('success', `Đã cấp ${vipGrantDays} ngày VIP cho ${targetUser.display_name || targetUser.full_name || targetUser.email || 'người dùng'}.`);
      await fetchVipMembers();
    } catch (err) {
      showVipMessage('error', 'Lỗi: ' + err.message);
    } finally {
      setVipGrantLoading(false);
    }
  };

  const fetchPaymentLogs = async () => {
    setPaymentLogsLoading(true);
    try {
      const { data } = await supabase.from('payment_logs').select('*').order('created_at', { ascending: false }).limit(30);
      setPaymentLogs(data || []);
    } catch (err) { console.error(err); }
    finally { setPaymentLogsLoading(false); }
  };

  const fetchVipMembers = async () => {
    setVipMembersLoading(true);
    try {
      const rows = await adminUserDirectory({ limit: ADMIN_USER_DIRECTORY_SELECT_LIMIT });
      const nowTs = Date.now();
      const members = rows
        .filter((row) => {
          if (row?.is_vip) return true;
          if (!row?.vip_expired_at) return false;
          return new Date(row.vip_expired_at).getTime() > nowTs;
        })
        .sort((a, b) => {
          const aTs = a?.vip_expired_at ? new Date(a.vip_expired_at).getTime() : 0;
          const bTs = b?.vip_expired_at ? new Date(b.vip_expired_at).getTime() : 0;
          return bTs - aTs;
        });
      setVipMembers(members);
    } catch (error) {
      console.error(error);
      setVipMembers([]);
    } finally {
      setVipMembersLoading(false);
    }
  };

  if (!isActive) return null;

  return (
    <div className="space-y-6">
      {vipMsg.text && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 ${
          vipMsg.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          <span className="material-symbols-outlined text-[16px]">{vipMsg.type === 'success' ? 'check_circle' : 'error'}</span>
          {vipMsg.text}
        </div>
      )}

      {/* User search */}
      <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-xl space-y-6">
        <div>
          <h2 className="text-base font-black text-amber-500 flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[18px]">alternate_email</span> Cấp VIP trực tiếp qua Gmail
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Nhập đúng gmail/email tài khoản và số ngày cần cấp để nâng user lên VIP ngay.
          </p>

          <form onSubmit={grantVipByEmail} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_auto] gap-3">
            <input
              type="email"
              placeholder="gmail@example.com"
              value={vipGrantEmail}
              onChange={e => setVipGrantEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-amber-500/50"
            />
            <input
              type="number"
              min="1"
              value={vipGrantDays}
              onChange={e => setVipGrantDays(Number(e.target.value) || 0)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500/50"
            />
            <button
              type="submit"
              disabled={vipGrantLoading}
              className="px-5 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {vipGrantLoading ? <span className="material-symbols-outlined animate-spin text-[16px]">sync</span> : <span className="material-symbols-outlined text-[16px]">workspace_premium</span>}
              Cấp VIP
            </button>
          </form>

          <div className="flex flex-wrap gap-2 mt-3">
            {VIP_PRESET_DAYS.map(days => (
              <button
                key={`vip-preset-${days}`}
                type="button"
                onClick={() => setVipGrantDays(days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  vipGrantDays === days
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                }`}
              >
                {days} ngày
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-white/10 pt-6">
          <h2 className="text-base font-black text-amber-500 flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px]">manage_accounts</span> Tìm kiếm & quản lý VIP
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nhập tên hoặc email..."
              value={vipSearch}
              onChange={e => setVipSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchVipUsers()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={() => searchVipUsers()}
              disabled={vipLoading}
              className="px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors flex items-center gap-2 disabled:opacity-70"
            >
              {vipLoading ? <span className="material-symbols-outlined animate-spin text-[16px]">sync</span> : <span className="material-symbols-outlined text-[16px]">search</span>}
              Tìm
            </button>
          </div>

          {vipUsers.length > 0 && (
            <div className="mt-4 space-y-3">
              {vipUsers.map(u => (
                <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{u.display_name || u.full_name || u.email || u.id}</p>
                    {u.email && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{u.email}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        u.is_vip ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {u.is_vip ? 'VIP' : 'Free'}
                      </span>
                      {u.vip_expired_at && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Hết: {new Date(u.vip_expired_at).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {VIP_PRESET_DAYS.map(d => (
                      <button
                        key={d}
                        onClick={() => addVipDays(u.id, d)}
                        className="px-3 py-1.5 text-xs font-black rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-colors"
                      >
                        +{d}d
                      </button>
                    ))}
                    <button
                      onClick={() => toggleVip(u.id, u.is_vip)}
                      className={`px-3 py-1.5 text-xs font-black rounded-lg border transition-colors ${
                        u.is_vip
                          ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                          : 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/20'
                      }`}
                    >
                      {u.is_vip ? 'Tắt VIP' : 'Bật VIP'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-amber-500 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">workspace_premium</span> Danh sách thành viên VIP
          </h2>
          <button
            onClick={fetchVipMembers}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span> Tải lại
          </button>
        </div>

        {vipMembersLoading ? (
          <div className="flex justify-center py-6">
            <span className="material-symbols-outlined animate-spin text-amber-500">sync</span>
          </div>
        ) : vipMembers.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Chưa có thành viên VIP nào.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {vipMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {member.display_name || member.full_name || member.email || member.id}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{member.email || 'Không có email'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-bold text-amber-500 uppercase">VIP</p>
                  <p className="text-xs text-slate-500">
                    {member.vip_expired_at
                      ? new Date(member.vip_expired_at).toLocaleDateString('vi-VN')
                      : 'Không rõ hạn'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Logs */}
      <div className="bg-white dark:bg-[#201216] border border-white/10 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-slate-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">receipt_long</span> Webhook Logs
          </h2>
          <button onClick={fetchPaymentLogs} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">refresh</span> Tải lại
          </button>
        </div>
        {paymentLogsLoading ? (
          <div className="flex justify-center py-6"><span className="material-symbols-outlined animate-spin text-slate-400">sync</span></div>
        ) : paymentLogs.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">Chưa có webhook log nào.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {paymentLogs.map(log => (
              <div key={log.id} className={`flex items-center gap-3 p-3 rounded-xl border text-xs ${
                log.status === 'ok' ? 'border-green-500/20 bg-green-500/5 text-green-400'
                : log.status === 'duplicate' ? 'border-blue-500/20 bg-blue-500/5 text-blue-400'
                : 'border-red-500/20 bg-red-500/5 text-red-400'
              }`}>
                <span className="font-mono font-bold uppercase">{log.status}</span>
                <span className="text-slate-500 flex-1 truncate">{log.error_message || 'OK'}</span>
                <span className="text-slate-600 shrink-0">{new Date(log.created_at).toLocaleString('vi-VN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
