import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_USER_DIRECTORY_SELECT_LIMIT = 200;

export default function AdminThongSoai({ isActive }) {
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  useEffect(() => {
    if (isActive) {
      fetchCandidates();
    }
  }, [isActive]);

  const adminUserDirectory = async ({ search = null, role = null, ids = null, limit = 10 } = {}) => {
    const { data, error } = await supabase.rpc('admin_user_directory', {
      p_search: search, p_role: role, p_ids: ids, p_limit: limit,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  const fetchCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const { data: camps } = await supabase.from('campaigns').select('user_id').eq('is_completed', true);
      if (camps) {
        const counts = {};
        camps.forEach(c => Object.assign(counts, { [c.user_id]: (counts[c.user_id] || 0) + 1 }));

        const eligibleIds = Object.keys(counts).filter(id => counts[id] >= 50);

        if (eligibleIds.length > 0) {
          const profiles = await adminUserDirectory({
            ids: eligibleIds,
            limit: Math.min(eligibleIds.length, ADMIN_USER_DIRECTORY_SELECT_LIMIT),
          });

          if (profiles.length > 0) {
            setCandidates(
              profiles
                .map(candidate => ({ ...candidate, completedCount: counts[candidate.id] || 0 }))
                .sort((a, b) => b.completedCount - a.completedCount)
            );
          }
        } else {
          setCandidates([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const approveBangChu = async (userId, currentStatus) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_approved_bang_chu: !currentStatus }).eq('id', userId);
      if (error) throw error;
      setCandidates(candidates.map(c => c.id === userId ? { ...c, is_approved_bang_chu: !currentStatus } : c));
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  if (!isActive) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-xl">
        <h2 className="text-base font-black text-rose-500 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">verified</span> Danh sách Ứng Cử Viên (≥ 50 khóa)
        </h2>
        {loadingCandidates ? (
          <div className="flex justify-center p-8"><span className="material-symbols-outlined animate-spin text-rose-500">sync</span></div>
        ) : candidates.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">inbox</span>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Chưa có user nào đạt điều kiện đủ 50 khóa học.</p>
          </div>
        ) : (
          <div className="grid gap-3 max-h-[500px] overflow-y-auto">
            {candidates.map(c => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{c.display_name || c.full_name || c.email || c.id}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-full font-bold border border-rose-500/20">
                      {c.completedCount} khóa
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${c.is_approved_bang_chu ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20'}`}>
                      {c.is_approved_bang_chu ? 'Đã duyệt Bảng Chủ' : 'Chưa duyệt'}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => approveBangChu(c.id, c.is_approved_bang_chu)}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${c.is_approved_bang_chu ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30 hover:scale-[1.02]'}`}
                  >
                    {c.is_approved_bang_chu ? 'Hủy Duyệt' : 'Duyệt Bảng Chủ'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
