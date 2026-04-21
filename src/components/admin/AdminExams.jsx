import React, { useState, useEffect } from 'react';
import { clearExamIndexCache } from '../../utils/examIndexCache';
import {
  deleteAdminExamKeys,
  getAdminExamKey,
  hasPopulatedAnswerKey,
  listAdminExamKeys,
  normalizeExamResources,
  upsertAdminExamKeyBundle,
  uploadExamAnswerFile,
  uploadExamDocumentFile,
  listAdminSubjects
} from '../../services/adminExamApi';

const DEFAULT_EXAM_EDIT_FORM = {
  title: '', subject_folder: '', exam_path: '', time: '', questions: '', status: 'ongoing', answer_key: '{}',
  folder_url: '', lecture_url: '', document_url: '', answer_file_url: '',
};

const EXAM_STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Đang mở' },
  { value: 'upcoming', label: 'Sắp mở' },
  { value: 'ended', label: 'Đã đóng' },
];

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');
const toOptionalPositiveInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};
const countQuestionsFromExamJson = (examJson) => {
  if (!Array.isArray(examJson?.parts)) return 0;
  return examJson.parts.reduce((total, part) => (
    total + (Array.isArray(part?.questions) ? part.questions.length : 0)
  ), 0);
};

export default function AdminExams({ isActive, onNavigateToSubjects }) {
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [examSearch, setExamSearch] = useState('');
  const [editingExam, setEditingExam] = useState(null);
  const [examEditForm, setExamEditForm] = useState(DEFAULT_EXAM_EDIT_FORM);
  const [selectedAnswerFile, setSelectedAnswerFile] = useState(null);
  const [selectedExamFile, setSelectedExamFile] = useState(null);
  const [savingExam, setSavingExam] = useState(false);
  const [keysError, setKeysError] = useState(null);
  const [examsDbError, setExamsDbError] = useState(null);
  const [examSubjects, setExamSubjects] = useState([]);
  const [toastMsg, setToastMsg] = useState('');
  // refs removed — file inputs use id/htmlFor pattern, no ref needed

  // ─── Helper functions ────────────────────────────────────────────────
  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // ─── Lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isActive) {
      loadInitialData();
    }
  }, [isActive]);

  // ─── Data loading ────────────────────────────────────────────────────
  const loadInitialData = async () => {
    try {
      const subjects = await listAdminSubjects();
      setExamSubjects(subjects);
      await fetchExams();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExams = async () => {
    setLoadingExams(true);
    setExamsDbError(null);
    setKeysError(null);
    try {
      const dbExams = await listAdminExamKeys();
      const unifiedExams = dbExams.map(ex => ({
        id: ex.exam_id || ex.id,
        title: ex.title || ex.exam_id || ex.id,
        subjectFolder: ex.subject_folder || ex.subject || 'khac',
        examPath: ex.exam_path || ex.examPath || ex.exam_id || ex.id,
        hasAnswers: ex.has_answers,
        hasMetadata: ex.has_metadata,
        is_in_db: true,
        resources: ex.resources || {},
        source: 'DB',
        created_at: ex.created_at,
        updated_at: ex.updated_at,
      }));
      setExams(unifiedExams);
    } catch (error) {
      console.error('Error fetching exams:', error);
      setExamsDbError(error.message);
    } finally {
      setLoadingExams(false);
    }
  };

  // ─── CRUD actions ────────────────────────────────────────────────────
  const deleteExam = async (examId) => {
    const safeExamId = toTrimmedString(examId);
    if (!safeExamId) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đề thi ${safeExamId} vĩnh viễn? Hành động này sẽ xóa cả metadata, đáp án và các bản ghi liên quan trong database.`)) return;

    setLoadingExams(true);
    try {
      const result = await deleteAdminExamKeys([safeExamId]);
      if (Array.isArray(result?.failed) && result.failed.length > 0) {
        throw new Error(result.failed[0]?.error || 'Xóa đề thi thất bại.');
      }
      if (!Array.isArray(result?.deleted) || result.deleted.length === 0) {
        throw new Error('Không tìm thấy đề để xóa trên database.');
      }
      clearExamIndexCache();
      setExams((prev) => prev.filter((item) => item.id.toLowerCase() !== safeExamId.toLowerCase()));
      if (editingExam?.toLowerCase() === safeExamId.toLowerCase()) {
        setEditingExam(null);
        setExamEditForm(DEFAULT_EXAM_EDIT_FORM);
      }
      toast('Đã xóa đề thi thành công');
      await fetchExams();
    } catch (err) {
      alert('Lỗi khi xóa đề thi: ' + err.message);
    } finally {
      setLoadingExams(false);
    }
  };

  const toggleExamKeyVisibility = async (examId, currentHasKey) => {
    try {
      const payload = await getAdminExamKey(examId);
      if (!payload) {
        alert(`Đề thi ${examId} chưa có bản ghi đáp án trên database.`);
        return;
      }
      const resources = normalizeExamResources(payload.resources);
      const answerCount = hasPopulatedAnswerKey(payload.answer_key)
        ? Object.keys(payload.answer_key).length
        : 0;
      alert(
        `Mã đề: ${payload.exam_id}\n` +
        `- Có đáp án: ${currentHasKey ? 'Có' : 'Chưa'}\n` +
        `- Số key: ${answerCount}\n` +
        `- File đáp án: ${resources.answer_file_url || 'Chưa có'}\n` +
        `- Video: ${resources.video_url || 'Chưa có'}`,
      );
    } catch (error) {
      alert('Không thể tải thông tin đáp án: ' + error.message);
    }
  };

  const handleCreateExam = () => {
    const rawExamId = window.prompt('Nhập mã đề thi mới (exam_id):');
    const newExamId = toTrimmedString(rawExamId);
    if (!newExamId) return;

    const existed = exams.find((item) => item.id.toLowerCase() === newExamId.toLowerCase());
    if (existed) {
      handleStartEdit(existed);
      return;
    }

    setEditingExam(newExamId);
    setSelectedAnswerFile(null);
    setExamEditForm({
      ...DEFAULT_EXAM_EDIT_FORM,
      title: newExamId,
      exam_path: newExamId,
      answer_key: '{}',
    });
  };

  const handleStartEdit = async (ex) => {
    if (!ex?.id) return;
    setEditingExam(ex.id);
    setSelectedAnswerFile(null);

    const fallbackResources = normalizeExamResources(ex.resources || {});
    let remotePayload = null;
    try {
      remotePayload = await getAdminExamKey(ex.id);
    } catch (error) {
      console.error(error);
    }

    const remoteResources = normalizeExamResources(remotePayload?.resources || {});
    const mergedResources = normalizeExamResources({
      ...fallbackResources,
      ...remoteResources,
    });

    const answerKeySource = hasPopulatedAnswerKey(remotePayload?.answer_key)
      ? remotePayload.answer_key
      : (hasPopulatedAnswerKey(ex.answer_key) ? ex.answer_key : {});

    setExamEditForm({
      ...DEFAULT_EXAM_EDIT_FORM,
      title: toTrimmedString(ex.title || mergedResources.title || ex.id),
      subject_folder: toTrimmedString(
        ex.subjectFolder ||
        ex.subject ||
        mergedResources.subject_folder ||
        mergedResources.subjectFolder ||
        mergedResources.subject,
      ).toLowerCase(),
      exam_path: toTrimmedString(
        ex.examPath ||
        mergedResources.exam_path ||
        mergedResources.examPath ||
        mergedResources.path ||
        ex.id,
      ),
      time: String(
        ex.time ??
        toOptionalPositiveInteger(mergedResources.time ?? mergedResources.duration_minutes) ??
        '',
      ),
      questions: String(
        ex.questions ??
        toOptionalPositiveInteger(mergedResources.questions ?? mergedResources.question_count) ??
        '',
      ),
      status: toTrimmedString(mergedResources.status || ex.status || 'ongoing') || 'ongoing',
      answer_key: JSON.stringify(answerKeySource, null, 2),
      folder_url: toTrimmedString(mergedResources.folder_url || ex.folder_url),
      lecture_url: toTrimmedString(mergedResources.lecture_url || ex.lecture_url),
      document_url: toTrimmedString(mergedResources.document_url || ex.document_url),
      answer_file_url: toTrimmedString(mergedResources.answer_file_url || ex.answer_file_url),
    });
  };

  const handleSyncFromJson = async () => {
    if (!editingExam) return;
    const ex = exams.find((item) => item.id === editingExam);
    if (!ex) return;

    setLoadingExams(true);
    try {
      const subjectFolder = toTrimmedString(ex.subjectFolder || ex.subject || examEditForm.subject_folder).toLowerCase();
      const examPath = toTrimmedString(ex.examPath || examEditForm.exam_path || ex.id);
      const resp = await fetch(`/data/exams/${subjectFolder}/${examPath}/exam.json`, { cache: 'no-store' });
      if (!resp.ok) throw new Error('Không tìm thấy file exam.json cục bộ.');

      const data = await resp.json();
      const resources = normalizeExamResources(data.resources || {});
      const questionCount = countQuestionsFromExamJson(data);

      // BUG FIX: use functional update to avoid stale closure overwriting user-typed values
      setExamEditForm(prev => ({
        ...prev,
        title: toTrimmedString(data.title || prev.title || ex.title),
        subject_folder: toTrimmedString(data.subject || subjectFolder).toLowerCase(),
        exam_path: examPath,
        time: String(toOptionalPositiveInteger(data.time) ?? prev.time ?? ''),
        questions: String(questionCount || toOptionalPositiveInteger(prev.questions) || ''),
        answer_key: JSON.stringify(data.answer_key || {}, null, 2),
        folder_url: toTrimmedString(resources.folder_url || prev.folder_url),
        lecture_url: toTrimmedString(resources.lecture_url || data.lecture_url || data.lectureUrl || prev.lecture_url),
        document_url: toTrimmedString(resources.document_url || prev.document_url),
        answer_file_url: toTrimmedString(resources.answer_file_url || prev.answer_file_url),
      }));

      toast('Đã nạp dữ liệu từ file JSON thành công!');
    } catch (err) {
      alert('Lỗi khi đồng bộ: ' + err.message);
    } finally {
      setLoadingExams(false);
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(examEditForm.answer_key);
      setExamEditForm({ ...examEditForm, answer_key: JSON.stringify(parsed, null, 2) });
    } catch {
      alert('JSON không hợp lệ để định dạng.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingExam) return;

    setSavingExam(true);
    try {
      let parsedKey;
      try {
        parsedKey = JSON.parse(examEditForm.answer_key);
      } catch {
        throw new Error('Đáp án JSON không hợp lệ. Vui lòng kiểm tra lại cú pháp.');
      }

      const currentExamId = toTrimmedString(editingExam);
      if (!currentExamId) throw new Error('Thiếu mã đề thi để lưu.');

      const nextExamId = currentExamId;
      const subjectFolder = toTrimmedString(examEditForm.subject_folder).toLowerCase();
      if (!subjectFolder) throw new Error('Vui lòng nhập môn học (subject_folder) trước khi lưu.');

      const examPath = toTrimmedString(examEditForm.exam_path || currentExamId);
      const title = toTrimmedString(examEditForm.title || currentExamId);
      const durationMinutes = toOptionalPositiveInteger(examEditForm.time);
      const questionCount = toOptionalPositiveInteger(examEditForm.questions);
      const status = toTrimmedString(examEditForm.status || 'ongoing') || 'ongoing';

      const ex = exams.find((item) => item.id.toLowerCase() === currentExamId.toLowerCase());
      const currentResources = normalizeExamResources(ex?.resources || {});
      const currentExamPath = toTrimmedString(
        currentResources.exam_path || currentResources.examPath || currentResources.path || ex?.examPath || currentExamId,
      );
      const currentBundlePath = toTrimmedString(
        currentResources.bundle_path || currentResources.bundlePath || currentExamPath || currentExamId,
      );

      const nextResources = normalizeExamResources({
        ...currentResources,
        title,
        subject_folder: subjectFolder,
        subjectFolder,
        subject: subjectFolder,
        exam_path: examPath,
        examPath,
        path: examPath,
        bundle_path: currentBundlePath,
        bundlePath: currentBundlePath,
        status,
        time: durationMinutes,
        duration_minutes: durationMinutes,
        questions: questionCount,
        question_count: questionCount,
        folder_url: toTrimmedString(examEditForm.folder_url) || currentResources.folder_url || '',
        lecture_url: toTrimmedString(examEditForm.lecture_url) || currentResources.lecture_url || '',
        // document_url & answer_file_url: only updated by explicit file upload below
        document_url: toTrimmedString(examEditForm.document_url) || currentResources.document_url || '',
        answer_file_url: toTrimmedString(examEditForm.answer_file_url) || currentResources.answer_file_url || '',
      });

      if (selectedExamFile) {
        if (currentResources.document_url) {
          if (!window.confirm('Đề thi này đã có bản PDF đề bài lưu trong máy chủ.\nBạn có CHẮC CHẮN muốn ghi đè bằng file mới không?\n(File cũ sẽ bị xoá vĩnh viễn)')) {
            setSavingExam(false);
            return;
          }
        }
        const uploadDocResult = await uploadExamDocumentFile(nextExamId, subjectFolder, selectedExamFile, currentResources.document_url);
        nextResources.document_url = uploadDocResult.path;
      }

      if (selectedAnswerFile) {
        if (currentResources.answer_file_url) {
          if (!window.confirm('Đề thi này đã có bản PDF đáp án lưu trong máy chủ.\nBạn có CHẮC CHẮN muốn ghi đè bằng file mới không?\n(File cũ sẽ bị xoá vĩnh viễn)')) {
            setSavingExam(false);
            return;
          }
        }
        const uploadResult = await uploadExamAnswerFile(nextExamId, selectedAnswerFile, currentResources.answer_file_url);
        nextResources.answer_file_url = uploadResult.path;
      }

      await upsertAdminExamKeyBundle({
        examId: nextExamId,
        answerKey: parsedKey,
        resources: nextResources,
      });

      toast('Cập nhật dữ liệu đề thi thành công!');
      setEditingExam(null);
      setExamEditForm(DEFAULT_EXAM_EDIT_FORM);
      setSelectedAnswerFile(null);
      setSelectedExamFile(null);
      clearExamIndexCache();
      await fetchExams();
    } catch (err) {
      alert('Lỗi khi lưu: ' + err.message);
    } finally {
      setSavingExam(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingExam(null);
    setSelectedAnswerFile(null);
    setSelectedExamFile(null);
    setExamEditForm(DEFAULT_EXAM_EDIT_FORM);
  };

  // ─── Computed values ─────────────────────────────────────────────────
  const normalizedExamSearch = examSearch.trim().toLowerCase();
  const uniqueSubjects = examSubjects.length > 0
    ? examSubjects.map(s => s.id).sort()
    : [...new Set(exams.map(ex => toTrimmedString(ex.subjectFolder || ex.subject || 'khac')))].filter(Boolean).sort();

  const filteredExams = exams.filter((item) => {
    const sFolder = toTrimmedString(item.subjectFolder || item.subject || 'khac');
    if (selectedSubject !== 'ALL' && sFolder !== selectedSubject) return false;
    if (!normalizedExamSearch) return true;
    return (
      item.id.toLowerCase().includes(normalizedExamSearch) ||
      (item.title && item.title.toLowerCase().includes(normalizedExamSearch))
    );
  });

  // ─── Guard ───────────────────────────────────────────────────────────
  if (!isActive) return null;

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-4">
        {/* Toast Notification */}
        {toastMsg && (
          <div className="px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            {toastMsg}
          </div>
        )}

        {/* Error Display for DB Issues */}
        {(keysError || examsDbError) && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold animate-pulse">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[18px]">database_off</span>
              <span>CẢNH BÁO DATABASE: Dữ liệu từ Supabase có thể không đầy đủ.</span>
            </div>
            {keysError && <div className="ml-7">• Lỗi Kho khóa: {keysError}</div>}
            {examsDbError && <div className="ml-7">• Lỗi Metadata: {examsDbError}</div>}
          </div>
        )}

        {/* ── 2-Column Layout ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

          {/* ── LEFT COLUMN: Exam List ── */}
          <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2 text-blue-500">
                <span className="material-symbols-outlined text-[20px]">quiz</span>
                Kho đề thi
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigateToSubjects?.()}
                  className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  title="Quản lý môn học"
                >
                  <span className="material-symbols-outlined text-[14px]">category</span>
                  <span className="hidden sm:inline">Môn học</span>
                </button>
                <button
                  onClick={handleCreateExam}
                  className="text-xs bg-blue-500 text-white hover:bg-blue-600 font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  <span className="hidden sm:inline">Tạo mới</span>
                </button>
                <button
                  onClick={fetchExams}
                  className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-1.5 rounded-lg transition-colors"
                  title="Làm mới"
                >
                  <span className={`material-symbols-outlined text-[16px] ${loadingExams ? 'animate-spin text-blue-500' : ''}`}>refresh</span>
                </button>
              </div>
            </div>

            {/* Subject Tabs */}
            <div className="flex bg-slate-100 dark:bg-[#1a0f12] p-1 rounded-xl w-full overflow-x-auto scrollbar-hide gap-1 border border-slate-200 dark:border-white/5 shadow-inner snap-x">
              <button
                onClick={() => setSelectedSubject('ALL')}
                className={`snap-start whitespace-nowrap px-3 py-1.5 text-[11px] font-black rounded-lg transition-all ${selectedSubject === 'ALL' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
              >
                TẤT CẢ ({exams.length})
              </button>
              {uniqueSubjects.map(sub => {
                const count = exams.filter(e => toTrimmedString(e.subjectFolder || e.subject || 'khac') === sub).length;
                const subjectData = examSubjects.find(s => s.id === sub);
                return (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubject(sub)}
                    className={`snap-start whitespace-nowrap px-3 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center gap-1 ${selectedSubject === sub ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
                  >
                    {subjectData?.name || sub} <span className={`text-[10px] px-1 py-0.5 rounded ${selectedSubject === sub ? 'bg-white/20 dark:bg-black/10' : 'bg-slate-200 dark:bg-white/10'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">search</span>
                </span>
                <input
                  type="text"
                  placeholder="Tìm mã đề hoặc tên đề thi..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500 font-semibold">
                Tổng: {exams.length} đề | Hiển thị: {filteredExams.length}
              </div>
            </div>

            {/* Exam List */}
            <div className="overflow-y-auto max-h-[calc(100vh-320px)] grid grid-cols-1 lg:grid-cols-2 gap-2 pr-1">
              {loadingExams ? (
                <div className="flex justify-center py-10">
                  <span className="material-symbols-outlined animate-spin text-blue-500 text-3xl">sync</span>
                </div>
              ) : exams.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">inventory_2</span>
                  <p className="text-slate-500 font-medium text-sm">Chưa có đề thi nào trong hệ thống.</p>
                </div>
              ) : filteredExams.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">search_off</span>
                  <p className="text-slate-500 font-medium text-sm">Không có đề nào khớp từ khóa.</p>
                </div>
              ) : (
                filteredExams.map(ex => {
                  const isSelected = editingExam === ex.id;
                  return (
                    <div
                      key={ex.id}
                      onClick={() => handleStartEdit(ex)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all group ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-md shadow-blue-500/10'
                          : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] hover:border-blue-400/50 hover:bg-blue-50/50 dark:hover:bg-blue-500/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${ex.is_in_db ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-500/10 text-slate-500'}`}>
                              {ex.is_in_db ? 'DB' : 'Local'}
                            </span>
                            <span className="text-[9px] font-mono font-bold text-slate-400 truncate max-w-[120px]">{ex.id}</span>
                          </div>
                          <p className="text-sm font-bold leading-tight line-clamp-2 text-slate-800 dark:text-white">
                            {ex.title || 'Đề thi chưa đặt tên'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isSelected && (
                            <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">Đang sửa</span>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                          {toTrimmedString(ex.subjectFolder || ex.subject || 'khac')}
                        </span>
                        <span className={`flex items-center gap-0.5 text-[10px] font-bold ${ex.hasAnswers ? 'text-green-500' : 'text-slate-400'}`}>
                          <span className="material-symbols-outlined text-[12px]">{ex.hasAnswers ? 'check_circle' : 'cancel'}</span>
                          Đáp án
                        </span>
                        <span className={`flex items-center gap-0.5 text-[10px] font-bold ${ex.resources?.answer_file_url ? 'text-cyan-500' : 'text-slate-400'}`}>
                          <span className="material-symbols-outlined text-[12px]">{ex.resources?.answer_file_url ? 'check_circle' : 'cancel'}</span>
                          File PDF
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-slate-200 dark:border-white/10">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(ex); }}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-500/10 hover:text-blue-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                          Sửa
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExamKeyVisibility(ex.id, ex.hasAnswers); }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-500 text-[11px] font-bold transition-all flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteExam(ex.id); }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-500/10 hover:text-red-500 text-[11px] font-bold transition-all flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN: Edit Form ── */}
          <div className="bg-white dark:bg-[#201216] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-xl sticky top-4">
            {editingExam ? (
              <div className="space-y-4">
                {/* Form Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-black text-blue-600 dark:text-blue-400 flex items-center gap-2 text-base">
                      <span className="material-symbols-outlined text-[20px]">edit_note</span>
                      Chỉnh sửa
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[260px]">{editingExam}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={handleSyncFromJson}
                      className="px-2.5 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1 hover:bg-amber-600 shadow-sm"
                      title="Tự động lấy đáp án và link từ file JSON cục bộ"
                    >
                      <span className="material-symbols-outlined text-[14px]">sync</span>
                      <span className="hidden sm:inline">Đồng bộ File</span>
                    </button>
                    <button onClick={handleCancelEdit} className="text-slate-400 hover:text-slate-600 p-1">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </div>

                {/* Basic Info */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tên đề thi</label>
                    <input type="text" value={examEditForm.title} onChange={(e) => setExamEditForm({ ...examEditForm, title: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-sm focus:border-blue-500 outline-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Môn học</label>
                      <input type="text" placeholder="VD: sinh, toan..." value={examEditForm.subject_folder} onChange={(e) => setExamEditForm({ ...examEditForm, subject_folder: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Trạng thái</label>
                      <select value={examEditForm.status} onChange={(e) => setExamEditForm({ ...examEditForm, status: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-sm focus:border-blue-500 outline-none">
                        {EXAM_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Đường dẫn</label>
                      <input type="text" value={examEditForm.exam_path} onChange={(e) => setExamEditForm({ ...examEditForm, exam_path: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">TG (phút)</label>
                      <input type="number" min="0" value={examEditForm.time} onChange={(e) => setExamEditForm({ ...examEditForm, time: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Số câu</label>
                      <input type="number" min="0" value={examEditForm.questions} onChange={(e) => setExamEditForm({ ...examEditForm, questions: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-sm focus:border-blue-500 outline-none" />
                    </div>
                  </div>
                </div>

                {/* Links */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">folder_open</span> Link Folder
                    </label>
                    <input type="text" placeholder="https://drive.google.com/drive/folders/..." value={examEditForm.folder_url} onChange={(e) => setExamEditForm({ ...examEditForm, folder_url: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-sm focus:border-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">play_circle</span> Link bài giảng
                    </label>
                    <input type="text" placeholder="https://youtube.com/..." value={examEditForm.lecture_url} onChange={(e) => setExamEditForm({ ...examEditForm, lecture_url: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-sm focus:border-blue-500 outline-none" />
                  </div>
                </div>

                {/* PDF Uploads */}
                <div className="grid grid-cols-2 gap-3">
                  {/* PDF Đề thi */}
                  <div className="p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-blue-500">description</span>
                        PDF Đề
                      </label>
                      {examEditForm.document_url && (
                        <span className="text-[9px] font-bold text-green-500 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[11px]">check_circle</span> Có file
                        </span>
                      )}
                    </div>
                    <input type="file" accept=".pdf" id="exam-doc-file" onChange={(e) => setSelectedExamFile(e.target.files?.[0] || null)} className="hidden" />
                    <label htmlFor="exam-doc-file" className="block w-full text-center px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-500 text-[10px] font-bold cursor-pointer transition-all">
                      {selectedExamFile ? `✓ ${selectedExamFile.name.slice(0,16)}...` : (examEditForm.document_url ? '🔄 Đổi file' : '📂 Chọn PDF')}
                    </label>
                  </div>

                  {/* PDF Đáp án */}
                  <div className="p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-amber-500">key</span>
                        PDF Đáp án
                      </label>
                      {examEditForm.answer_file_url && (
                        <span className="text-[9px] font-bold text-green-500 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[11px]">check_circle</span> Có file
                        </span>
                      )}
                    </div>
                    <input type="file" accept=".pdf" id="exam-answer-file" onChange={(e) => setSelectedAnswerFile(e.target.files?.[0] || null)} className="hidden" />
                    <label htmlFor="exam-answer-file" className="block w-full text-center px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 text-[10px] font-bold cursor-pointer transition-all">
                      {selectedAnswerFile ? `✓ ${selectedAnswerFile.name.slice(0,16)}...` : (examEditForm.answer_file_url ? '🔄 Đổi file' : '📂 Chọn PDF')}
                    </label>
                  </div>
                </div>

                {/* JSON Answer Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase">Đáp án (JSON)</label>
                    <button onClick={formatJson} className="text-[10px] font-bold text-blue-500 hover:underline">Định dạng</button>
                  </div>
                  <textarea
                    rows="10"
                    value={examEditForm.answer_key}
                    onChange={(e) => setExamEditForm({ ...examEditForm, answer_key: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1a0f12] border border-slate-200 dark:border-white/10 text-xs font-mono focus:border-blue-500 outline-none resize-none"
                  />
                </div>

                {/* Save / Cancel */}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-white/5 transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={savingExam}
                    className="px-5 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-70 disabled:hover:scale-100"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${savingExam ? 'animate-spin' : ''}`}>{savingExam ? 'sync' : 'save'}</span>
                    {savingExam ? 'Đang lưu...' : 'Lưu kho khóa'}
                  </button>
                </div>
              </div>
            ) : (
              /* Empty state for right panel */
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl text-blue-400">edit_note</span>
                </div>
                <h3 className="font-bold text-slate-600 dark:text-slate-300 mb-2">Chọn đề thi để chỉnh sửa</h3>
                <p className="text-sm text-slate-400 max-w-[220px]">Nhấn vào một đề thi ở danh sách bên trái để xem và chỉnh sửa thông tin.</p>
                <button
                  onClick={handleCreateExam}
                  className="mt-6 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Tạo đề thi mới
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
