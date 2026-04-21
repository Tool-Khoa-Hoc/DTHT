import React, { useState, useEffect } from 'react';
import { listAdminSubjects, upsertAdminSubject, deleteAdminSubject } from '../../services/adminExamApi';

export default function AdminSubjects({ isActive, onNavigateToExams }) {
  const [examSubjects, setExamSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [savingSubject, setSavingSubject] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [subjectForm, setSubjectForm] = useState({ id: '', name: '', icon: 'folder', color: 'from-blue-500 to-indigo-600', order: 0 });
  const [toastMsg, setToastMsg] = useState('');

  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  useEffect(() => {
    if (isActive) fetchSubjects();
  }, [isActive]);

  const fetchSubjects = async () => {
    setLoadingSubjects(true);
    try {
      const data = await listAdminSubjects();
      setExamSubjects(data);
    } catch (err) {
      console.error('Lỗi khi tải môn học:', err);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleOpenSubjectModal = (sub = null) => {
    if (sub) {
      setEditingSubject(sub.id);
      setSubjectForm({
        id: sub.id,
        name: sub.name,
        icon: sub.icon || 'folder',
        color: sub.color || 'from-blue-500 to-indigo-600',
        order: sub.display_order || 0
      });
    } else {
      setEditingSubject(null);
      setSubjectForm({ id: '', name: '', icon: 'folder', color: 'from-blue-500 to-indigo-600', order: 0 });
    }
    setIsSubjectModalOpen(true);
  };

  const handleSaveSubject = async (e) => {
    e.preventDefault();
    if (!subjectForm.id || !subjectForm.name) {
      alert('Vui lòng nhập mã và tên môn học.');
      return;
    }
    setSavingSubject(true);
    try {
      await upsertAdminSubject({
        id: subjectForm.id.toLowerCase().trim(),
        name: subjectForm.name.trim(),
        icon: subjectForm.icon,
        color: subjectForm.color,
        display_order: parseInt(subjectForm.order) || 0
      });
      toast('Đã lưu môn học thành công');
      setIsSubjectModalOpen(false);
      fetchSubjects();
    } catch (err) {
      alert('Lỗi khi lưu môn học: ' + err.message);
    } finally {
      setSavingSubject(false);
    }
  };

  const handleDeleteSubject = async (id) => {
    if (!window.confirm(`Xóa môn học "${id}"? Lưu ý: Các đề thi thuộc môn này sẽ không bị xóa nhưng sẽ không hiển thị đúng nhóm.`)) return;
    try {
      await deleteAdminSubject(id);
      toast('Đã xóa môn học');
      fetchSubjects();
    } catch (err) {
      alert('Lỗi khi xóa môn học: ' + err.message);
    }
  };

  if (!isActive) return null;

  return (
    <>
      <div className="space-y-6">
        {/* Toast */}
        {toastMsg && (
          <div className="px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            {toastMsg}
          </div>
        )}

        <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/10 rounded-2xl p-6 xl:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-500">
              <span className="material-symbols-outlined">category</span>
              Quản lý Môn học (Subjects)
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => handleOpenSubjectModal()} className="text-xs bg-indigo-500 text-white hover:bg-indigo-600 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">add</span> Thêm môn mới
              </button>
              <button onClick={() => onNavigateToExams?.()} className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">arrow_back</span> Quay lại Exams
              </button>
            </div>
          </div>

          {loadingSubjects ? (
            <div className="flex justify-center py-12"><span className="material-symbols-outlined animate-spin text-indigo-500 text-3xl">sync</span></div>
          ) : examSubjects.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
              <span className="material-symbols-outlined text-5xl text-slate-300 mb-2">category</span>
              <p className="text-slate-500 font-medium">Chưa có môn học nào. Hãy thêm môn học đầu tiên.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {examSubjects.map(sub => (
                <div key={sub.id} className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${sub.color || 'from-slate-400 to-slate-500'} flex items-center justify-center text-white shadow-lg`}>
                      <span className="material-symbols-outlined">{sub.icon || 'folder'}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white uppercase">{sub.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Mã: {sub.id} | Thứ tự: {sub.display_order}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenSubjectModal(sub)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-all">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => handleDeleteSubject(sub.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subject Modal */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#201216] w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-white/5">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500">category</span>
                {editingSubject ? `Sửa môn: ${editingSubject}` : 'Thêm môn học mới'}
              </h3>
              <button onClick={() => setIsSubjectModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 ml-1">Mã môn học (ID)</label>
                <input
                  type="text"
                  required
                  disabled={!!editingSubject}
                  placeholder="toan, ly, hoa, sinh..."
                  value={subjectForm.id}
                  onChange={e => setSubjectForm({ ...subjectForm, id: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 ml-1">Tên môn học</label>
                <input
                  type="text"
                  required
                  placeholder="Toán Học, Vật Lý..."
                  value={subjectForm.name}
                  onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 ml-1">Icon (Material)</label>
                  <input
                    type="text"
                    placeholder="functions, science..."
                    value={subjectForm.icon}
                    onChange={e => setSubjectForm({ ...subjectForm, icon: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 ml-1">Thứ tự hiển thị</label>
                  <input
                    type="number"
                    value={subjectForm.order}
                    onChange={e => setSubjectForm({ ...subjectForm, order: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 ml-1">Màu sắc (Tailwind gradients)</label>
                <input
                  type="text"
                  placeholder="from-blue-500 to-indigo-600"
                  value={subjectForm.color}
                  onChange={e => setSubjectForm({ ...subjectForm, color: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingSubject}
                  className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {savingSubject ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
                  Lưu môn học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
