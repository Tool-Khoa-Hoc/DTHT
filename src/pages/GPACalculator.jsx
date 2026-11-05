import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import ProgressBar from '../components/ui/ProgressBar';
import RankSeal from '../components/ui/RankSeal';

export default function GPACalculator() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [semester, setSemester] = useState('Học kỳ 1');
  const [targetScore, setTargetScore] = useState(8.5);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [courses, setCourses] = useState([
    { id: 1, name: 'Toán học', credits: 3, score: 8.5, icon: 'calculate' },
    { id: 2, name: 'Vật lý', credits: 2, score: 8.0, icon: 'science' },
    { id: 3, name: 'Ngữ văn', credits: 3, score: 7.5, icon: 'menu_book' },
    { id: 4, name: 'Tiếng Anh', credits: 3, score: 9.0, icon: 'language' },
  ]);

  useEffect(() => {
    if (profile?.target_gpa) {
      setTargetScore(profile.target_gpa);
    }
  }, [profile]);

  const fetchGpaRecord = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('gpa_records')
        .select('courses')
        .eq('user_id', user.id)
        .eq('semester', semester)
        .maybeSingle();

      if (error) throw error;

      if (data && data.courses && data.courses.length > 0) {
        setCourses(data.courses);
      } else {
        setCourses([
          { id: 1, name: 'Toán học', credits: 3, score: 8.5, icon: 'calculate' },
          { id: 2, name: 'Vật lý', credits: 2, score: 8.0, icon: 'science' },
          { id: 3, name: 'Ngữ văn', credits: 3, score: 7.5, icon: 'menu_book' },
          { id: 4, name: 'Tiếng Anh', credits: 3, score: 9.0, icon: 'language' },
        ]);
      }
    } catch (error) {
      console.error('Lỗi khi tải bảng điểm:', error.message);
    } finally {
      setIsLoading(false);
    }
  }, [semester, user]);

  useEffect(() => {
    fetchGpaRecord();
  }, [fetchGpaRecord]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('gpa_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('semester', semester)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('gpa_records')
          .update({ courses, updated_at: new Date() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('gpa_records')
          .insert([{ user_id: user.id, semester, courses }]);
        if (error) throw error;
      }

      await supabase.from('profiles').update({ target_gpa: targetScore }).eq('id', user.id);

      alert('Đã lưu bảng điểm thành công!');
    } catch (error) {
      console.error('Lỗi khi lưu bảng điểm:', error.message);
      alert('Có lỗi xảy ra khi lưu: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const totalCredits = courses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0);
  const totalPoints = courses.reduce(
    (sum, c) => sum + (parseFloat(c.credits) || 0) * (parseFloat(c.score) || 0),
    0,
  );
  const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';

  const getRank = (s) => {
    if (s >= 9.0)
      return {
        label: 'Xuất sắc',
        color: 'text-completed bg-completed-soft border-completed-border',
      };
    if (s >= 8.0)
      return {
        label: 'Giỏi',
        color: 'text-jade bg-jade-soft border-jade-border',
      };
    if (s >= 6.5)
      return {
        label: 'Khá',
        color: 'text-gold-dark bg-gold-soft border-gold',
      };
    if (s >= 5.0)
      return {
        label: 'Trung bình',
        color: 'text-accent bg-gold-soft/60 border-border-strong',
      };
    return {
      label: 'Yếu',
      color: 'text-primary bg-primary-soft border-primary/35',
    };
  };
  const rank = getRank(parseFloat(gpa));

  const handleUpdateCourse = (id, field, value) => {
    setCourses(courses.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleAddCourse = () => {
    const newId = courses.length > 0 ? Math.max(...courses.map((c) => c.id)) + 1 : 1;
    setCourses([...courses, { id: newId, name: '', credits: 1, score: '', icon: 'book' }]);
  };

  const handleRemoveCourse = (id) => {
    setCourses(courses.filter((c) => c.id !== id));
  };

  const handleReset = () => {
    if (window.confirm('Bạn có chắc muốn đặt lại toàn bộ điểm trên màn hình?')) {
      setCourses(courses.map((c) => ({ ...c, score: '' })));
    }
  };

  const isTargetReached = parseFloat(gpa) >= parseFloat(targetScore);
  const diff = (parseFloat(targetScore) - parseFloat(gpa)).toFixed(2);

  return (
    <div className="bg-background font-sans text-foreground min-h-full flex flex-col justify-between pb-24">
      <div className="max-w-4xl mx-auto w-full">
        {/* Top App Bar */}
        <header className="sticky top-0 z-50 bg-paper/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Quay lại"
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-alt transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-foreground" aria-hidden="true">
                arrow_back
              </span>
            </button>
            <div>
              <h1 className="font-display text-lg font-extrabold tracking-tight text-foreground">
                Bàn Tính Điểm Số
              </h1>
              <p className="text-[11px] text-secondary-text">GPA học kỳ · mục tiêu học bạ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              aria-label="Đặt lại điểm"
              title="Đặt lại điểm"
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-alt transition-colors text-secondary-text hover:text-foreground cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                restart_alt
              </span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-arena btn-arena-primary btn-arena-sm"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {isSaving ? 'hourglass_empty' : 'save'}
              </span>
              {isSaving ? 'Đang lưu...' : 'Lưu điểm'}
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="px-4 pt-4">
          <div className="flex border-b border-border gap-6 overflow-x-auto no-scrollbar">
            <button
              type="button"
              className="pb-3 border-b-2 border-primary text-primary font-display font-bold text-sm whitespace-nowrap flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                school
              </span>
              Điểm GPA (Cấp 3)
            </button>
            <button
              type="button"
              onClick={() => navigate('/admission')}
              className="pb-3 border-b-2 border-transparent text-secondary-text hover:text-foreground font-display font-semibold text-sm whitespace-nowrap flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                calculate
              </span>
              Điểm Xét Tuyển ĐH
            </button>
            <button
              type="button"
              onClick={() => navigate('/schools')}
              className="pb-3 border-b-2 border-transparent text-secondary-text hover:text-foreground font-display font-semibold text-sm whitespace-nowrap flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                account_balance
              </span>
              Chọn Trường ĐH
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 px-4 py-5 space-y-6">
          {/* Semester Selector & Summary Card */}
          <div className="imperial-frame p-5 relative overflow-hidden">
            <span
              aria-hidden="true"
              className="hanzi-watermark absolute -top-2 right-4 text-7xl font-bold text-accent/8"
            >
              算
            </span>

            <div className="flex justify-between items-center mb-4 relative z-10">
              <div className="relative">
                <select
                  aria-label="Chọn học kỳ"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="appearance-none bg-paper text-foreground font-display font-bold text-sm py-2 pl-3.5 pr-9 rounded-xl border border-border-strong focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="Học kỳ 1">Học kỳ 1</option>
                  <option value="Học kỳ 2">Học kỳ 2</option>
                  <option value="Cả năm">Cả năm</option>
                </select>
                <span
                  className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-secondary-text"
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${rank.color}`}>
                Học lực: {rank.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 items-end relative z-10 mb-4">
              <div>
                <p className="text-xs text-secondary-text mb-1 font-medium">Điểm trung bình (GPA)</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold tracking-tight text-primary tabular">
                    {gpa}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">/ 10</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-secondary-text mb-1 font-medium">Tổng hệ số / Tín chỉ</p>
                <p className="font-display text-xl font-bold text-foreground tabular">{totalCredits}</p>
              </div>
            </div>

            <div className="relative z-10">
              <ProgressBar
                value={parseFloat(gpa) || 0}
                max={10}
                tone="primary"
                label="Thang điểm 10"
                sublabel={`${gpa}/10`}
              />
            </div>
          </div>

          {/* Target Goal Section */}
          <div className="paper-card p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gold-soft border border-gold flex items-center justify-center text-accent no-shrink">
                <span className="material-symbols-outlined" aria-hidden="true">
                  flag
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-display font-bold text-foreground">Mục tiêu học kỳ</h2>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    aria-label="Điểm mục tiêu học kỳ"
                    value={targetScore}
                    onChange={(e) => setTargetScore(e.target.value)}
                    className="w-16 bg-paper border border-border-strong rounded-lg px-2 py-0.5 text-xs font-bold text-center text-primary tabular focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <p className="text-xs text-secondary-text mt-1">
                  {isTargetReached ? (
                    <span className="text-completed font-semibold">
                      Tuyệt vời! Bạn đã đạt mục tiêu đề ra.
                    </span>
                  ) : (
                    <span>
                      Cần tăng thêm <span className="text-primary font-bold tabular">{diff}</span> điểm
                      để đạt mục tiêu.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <RankSeal size="sm" variant="gold" icon="emoji_events" label="Mục tiêu" />
          </div>

          {/* Course List Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-extrabold text-foreground">
                Danh sách môn học ({courses.length})
              </h2>
              <button
                type="button"
                onClick={handleAddCourse}
                className="text-xs font-bold flex items-center gap-1 text-primary hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  add_circle
                </span>
                Thêm môn
              </button>
            </div>

            <div className="grid grid-cols-12 gap-2 px-3 text-xs font-bold text-secondary-text">
              <div className="col-span-6">Tên môn học</div>
              <div className="col-span-2 text-center">Hệ số</div>
              <div className="col-span-3 text-center">Điểm TB</div>
              <div className="col-span-1"></div>
            </div>

            {isLoading ? (
              <div className="py-8 flex justify-center">
                <span
                  className="material-symbols-outlined animate-spin text-primary text-3xl"
                  aria-hidden="true"
                >
                  sync
                </span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="grid grid-cols-12 gap-2 items-center paper-card p-2.5 focus-within:border-primary transition-all"
                  >
                    <div className="col-span-6 flex items-center gap-2">
                      <span
                        className="material-symbols-outlined text-accent text-lg pl-1"
                        aria-hidden="true"
                      >
                        {course.icon || 'book'}
                      </span>
                      <input
                        className="w-full bg-transparent border-none text-sm font-semibold text-foreground focus:outline-none focus:ring-0 p-1 placeholder:text-muted-foreground"
                        type="text"
                        placeholder="Nhập tên môn..."
                        value={course.name}
                        onChange={(e) => handleUpdateCourse(course.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        className="w-full bg-paper border border-border rounded-lg text-center text-sm font-medium text-foreground py-1.5 tabular focus:outline-none focus:ring-1 focus:ring-primary"
                        type="number"
                        min="1"
                        max="10"
                        value={course.credits}
                        onChange={(e) => handleUpdateCourse(course.id, 'credits', e.target.value)}
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        className="w-full bg-primary-soft border border-primary/30 text-primary rounded-lg text-center text-sm font-bold py-1.5 tabular focus:outline-none focus:ring-1 focus:ring-primary"
                        step="0.1"
                        min="0"
                        max="10"
                        placeholder="0.0"
                        type="number"
                        value={course.score}
                        onChange={(e) => handleUpdateCourse(course.id, 'score', e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveCourse(course.id)}
                        aria-label={`Xoá môn ${course.name || ''}`}
                        className="text-muted-foreground hover:text-primary transition-colors p-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-lg" aria-hidden="true">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddCourse}
              className="w-full py-3 border-2 border-dashed border-border-strong rounded-xl text-secondary-text hover:text-primary hover:border-primary hover:bg-primary-soft/40 transition-all flex items-center justify-center gap-2 text-sm font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                add
              </span>
              Thêm môn học mới
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
