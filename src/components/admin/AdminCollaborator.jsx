import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Avatar from '../Avatar';

const ADMIN_USER_DIRECTORY_SELECT_LIMIT = 200;

export default function AdminCollaborator({ isActive }) {
  const [collabSearchTerm, setCollabSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [loadingCollabs, setLoadingCollabs] = useState(false);

  useEffect(() => {
    if (isActive) {
      fetchCollaborators();
    }
  }, [isActive]);

  const adminUserDirectory = async ({ search = null, role = null, ids = null, limit = 10 } = {}) => {
    const { data, error } = await supabase.rpc('admin_user_directory', {
      p_search: search, p_role: role, p_ids: ids, p_limit: limit,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  const fetchCollaborators = async () => {
    setLoadingCollabs(true);
    try {
      const data = await adminUserDirectory({
        role: 'collaborator',
        limit: ADMIN_USER_DIRECTORY_SELECT_LIMIT,
      });
      setCollaborators(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCollabs(false);
    }
  };

  const searchUsers = async (e) => {
    e.preventDefault();
    if (!collabSearchTerm.trim()) return;
    setLoadingCollabs(true);
    try {
      const data = await adminUserDirectory({ search: collabSearchTerm.trim(), limit: 10 });
      setSearchResults(data.filter(candidate => candidate.role !== 'admin'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCollabs(false);
    }
  };

  const setCollaboratorRole = async (userId, makeCollaborator) => {
    try {
      const newRole = makeCollaborator ? 'collaborator' : 'user';
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      if (makeCollaborator) {
        alert('Đã thăng cấp thành Truyền Đạo Sư');
      } else {
        alert('Đã giáng cấp thành người dùng thường');
      }

      fetchCollaborators();
      if (collabSearchTerm) {
        searchUsers({ preventDefault: () => {} });
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi: ' + err.message);
    }
  };

  if (!isActive) return null;

  return (
    <div className="space-y-8">
      {/* Search & Add New Collaborators */}
      <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-xl">
        <h2 className="text-base font-black text-indigo-500 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">person_add</span> Thêm Truyền Đạo Sư Mới
        </h2>
        <form onSubmit={searchUsers} className="flex gap-2">
          <input
            type="text"
            placeholder="Nhập email hoặc tên..."
            value={collabSearchTerm}
            onChange={(e) => setCollabSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-500/50"
          />
          <button
            type="submit"
            disabled={loadingCollabs || !collabSearchTerm.trim()}
            className="px-5 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loadingCollabs ? <span className="material-symbols-outlined animate-spin text-[16px]">sync</span> : <span className="material-symbols-outlined text-[16px]">search</span>}
            Tìm user
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1 mb-2">Kết quả tìm kiếm</p>
            {searchResults.map((user) => (
              <div key={`search-${user.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-indigo-500/10 bg-indigo-50/50 dark:bg-indigo-500/5">
                <div className="flex items-center gap-4">
                  <Avatar user={user} size="md" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{user.display_name || user.full_name || 'Người dùng vô danh'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email || 'N/A'}</p>
                    {user.role === 'collaborator' && (
                      <span className="inline-block mt-1 text-[10px] bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-md font-bold">Đang là TDS</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => setCollaboratorRole(user.id, user.role !== 'collaborator')}
                    disabled={user.role === 'admin'}
                    className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${
                      user.role === 'collaborator'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20'
                        : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:scale-[1.02]'
                    } disabled:opacity-50`}
                  >
                    {user.role === 'collaborator' ? 'Giáng cấp' : 'Thăng cấp'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* List Collaborators */}
      <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-xl">
        <h2 className="text-base font-black text-indigo-500 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">group</span> Danh Sách Truyền Đạo Sư ({collaborators.length})
        </h2>
        
        {loadingCollabs && collaborators.length === 0 ? (
           <div className="flex justify-center p-8"><span className="material-symbols-outlined animate-spin text-indigo-500">sync</span></div>
        ) : collaborators.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
            <p className="text-slate-500 dark:text-slate-400 text-sm">Chưa có Truyền Đạo Sư nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collaborators.map((collab) => (
              <div key={`collab-${collab.id}`} className="group relative flex flex-col p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar user={collab} size="sm" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{collab.display_name || collab.full_name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{collab.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Bạn có chắc muốn giáng cấp ${collab.display_name || collab.email} trở thành người dùng bình thường?`)) {
                      setCollaboratorRole(collab.id, false);
                    }
                  }}
                  className="mt-auto px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-200/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-red-500/10 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
                >
                  GỠ QUYỀN TRUYỀN ĐẠO SƯ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
