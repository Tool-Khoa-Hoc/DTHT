import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DOCUMENT_SELECT_FIELDS } from '../lib/documents';
import { Link } from 'react-router-dom';
import RankSeal from '../components/ui/RankSeal';

export default function Collaborator() {
  const { user, profile, isCollaborator } = useAuth();
  const [activeTab, setActiveTab] = useState('library');

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

  useEffect(() => {
    if (!isCollaborator) return;
    if (activeTab === 'library') fetchDocuments();
    if (activeTab === 'roadmap') fetchRoadmaps();
  }, [activeTab, isCollaborator]);

  const fetchDocuments = async () => {
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
      alert('Vui lòng nhập link Google Sheet / Google Drive / tài liệu!');
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

      alert('Đã đăng tài liệu thành công!');
      setDocTitle('');
      setSelectedFile(null);
      setExternalUrl('');
      if (document.getElementById('collab-file-upload')) {
        document.getElementById('collab-file-upload').value = '';
      }
      fetchDocuments();
    } catch (error) {
      alert('Lỗi khi đăng tài liệu: ' + error.message);
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

  const fetchRoadmaps = async () => {
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

  if (!isCollaborator) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center bg-background">
        <span className="material-symbols-outlined text-6xl text-primary mb-4" aria-hidden="true">
          gpp_bad
        </span>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">
          Khu Vực Dành Cho Cộng Tác Viên
        </h1>
        <p className="text-secondary-text max-w-md mb-6 text-sm">
          Tài khoản của bạn chưa được cấp quyền Cộng tác viên hoặc Quản trị viên.
        </p>
        <Link to="/home" className="btn-arena btn-arena-primary btn-arena-sm">
          Quay về Trang chủ
        </Link>
      </div>
    );
  }

  const currentRoadmap = roadmaps.find((r) => r.block_name === selectedBlock);

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header */}
        <header className="imperial-frame p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-jade-soft border border-jade-border flex items-center justify-center text-jade no-shrink">
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                group_add
              </span>
            </div>
            <div>
              <div className="mb-1">
                <RankSeal size="sm" icon="verified_user" label="Ban Biên Tập Học Liệu" />
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-extrabold tracking-tight text-foreground">
                 Bàn Làm Việc Cộng Tác Viên
              </h1>
              <p className="text-xs text-secondary-text">
                Xin chào {profile?.full_name || user?.email} • Đóng góp tài liệu &amp; lộ trình học tập
              </p>
            </div>
          </div>

          <Link to="/profile" className="btn-arena btn-arena-secondary btn-arena-sm">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              person
            </span>
            Hồ sơ của tôi
          </Link>
        </header>

        {/* Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-bold text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'library'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-secondary-text hover:bg-surface-alt hover:text-foreground'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              folder_open
            </span>
            Đăng &amp; Quản lý Tài liệu Free
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roadmap')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-bold text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'roadmap'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-secondary-text hover:bg-surface-alt hover:text-foreground'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              timeline
            </span>
            Cập nhật Lộ trình Học
          </button>
        </div>

        <main>
          {activeTab === 'library' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cột trái: Form Upload */}
              <div className="lg:col-span-1">
                <form
                  onSubmit={handleUploadDocument}
                  className="paper-card p-5 space-y-4 sticky top-6"
                >
                  <h2 className="font-display font-bold text-base text-foreground flex items-center gap-2 border-b border-border pb-3">
                    <span className="material-symbols-outlined text-primary" aria-hidden="true">
                      cloud_upload
                    </span>
                    Đăng tài liệu mới
                  </h2>

                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-alt rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setUploadMode('file')}
                      className={`py-2 rounded-lg text-xs font-display font-bold transition-all cursor-pointer ${
                        uploadMode === 'file'
                          ? 'bg-primary text-white'
                          : 'text-secondary-text hover:text-foreground'
                      }`}
                    >
                      Tải file PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('link')}
                      className={`py-2 rounded-lg text-xs font-display font-bold transition-all cursor-pointer ${
                        uploadMode === 'link'
                          ? 'bg-primary text-white'
                          : 'text-secondary-text hover:text-foreground'
                      }`}
                    >
                      Dán link Sheet / Drive
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Tên tài liệu / Đề thi
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Tổng hợp đề thi thử Toán 2027..."
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">
                        Khối lớp
                      </label>
                      <select
                        value={docGrade}
                        onChange={(e) => setDocGrade(e.target.value)}
                        className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="Lớp 10">Lớp 10</option>
                        <option value="Lớp 11">Lớp 11</option>
                        <option value="Lớp 12">Lớp 12</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">
                        Môn học
                      </label>
                      <select
                        value={docSubject}
                        onChange={(e) => setDocSubject(e.target.value)}
                        className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="Toán">Toán</option>
                        <option value="Vật Lý">Vật Lý</option>
                        <option value="Hóa Học">Hóa Học</option>
                        <option value="Sinh Học">Sinh Học</option>
                        <option value="Tiếng Anh">Tiếng Anh</option>
                        <option value="Ngữ Văn">Ngữ Văn</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Thể loại
                    </label>
                    <select
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="Đề thi thử">Đề thi thử</option>
                      <option value="Tóm tắt lý thuyết">Tóm tắt lý thuyết</option>
                      <option value="Sơ đồ tư duy">Sơ đồ tư duy</option>
                      <option value="Chuyên đề nâng cao">Chuyên đề nâng cao</option>
                      <option value="Kho khóa học / Sheet">Kho khóa học / Sheet</option>
                    </select>
                  </div>

                  {uploadMode === 'file' ? (
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1">
                        Chọn File (PDF, Word...)
                      </label>
                      <input
                        id="collab-file-upload"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                        className="w-full text-xs text-secondary-text file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary-soft file:text-primary hover:file:bg-primary/20 cursor-pointer"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                          Link Google Sheet / Google Drive / Facebook
                        </label>
                        <input
                          type="url"
                          required
                          placeholder="https://docs.google.com/spreadsheets/..."
                          value={externalUrl}
                          onChange={(e) => setExternalUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1">
                          Nhãn hiển thị nguồn
                        </label>
                        <input
                          type="text"
                          placeholder="VD: Google Sheet / Folder Drive / Tổng hợp"
                          value={resourceLabel}
                          onChange={(e) => setResourceLabel(e.target.value)}
                          className="w-full px-3 py-2 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={isUploading}
                    className="btn-arena btn-arena-primary w-full"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      {isUploading ? 'hourglass_empty' : 'upload_file'}
                    </span>
                    {isUploading ? 'Đang tải lên...' : 'Đăng lên Thư viện'}
                  </button>
                </form>
              </div>

              {/* Cột phải: Danh sách tài liệu */}
              <div className="lg:col-span-2 paper-card p-5">
                <h2 className="font-display font-bold text-base text-foreground mb-4">
                  Danh sách tài liệu trong kho ({documents.length})
                </h2>

                {loadingDocs ? (
                  <div className="flex justify-center py-12">
                    <span
                      className="material-symbols-outlined animate-spin text-3xl text-primary"
                      aria-hidden="true"
                    >
                      sync
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-paper border border-border hover:border-border-strong transition-all"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-soft text-primary border border-primary/30">
                              {doc.grade}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-alt text-secondary-text border border-border">
                              {doc.subject}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {doc.file_size}
                            </span>
                          </div>
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-bold text-foreground hover:text-primary truncate block"
                          >
                            {doc.title}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          aria-label="Xóa tài liệu"
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary-soft rounded-lg transition-colors no-shrink cursor-pointer"
                          title="Xóa tài liệu"
                        >
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">
                            delete
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'roadmap' && (
            <div className="space-y-6">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {['Khối A00', 'Khối A01', 'Khối B00', 'Khối C00', 'Khối D01', 'Đánh giá năng lực'].map(
                  (block) => (
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
                  ),
                )}
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
                                  Bổ sung
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
                          placeholder="Thêm nhiệm vụ chuẩn mới vào giai đoạn này..."
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
              ) : (
                <div className="p-8 text-center text-secondary-text paper-card">
                  Chưa có dữ liệu lộ trình cho khối này.
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
