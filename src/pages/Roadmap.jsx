import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import ProgressBar from '../components/ui/ProgressBar';
import RankSeal from '../components/ui/RankSeal';

const EXAM_BLOCKS = ['Khối A00', 'Khối A01', 'Khối B00', 'Khối C00', 'Khối D01', 'Đánh giá năng lực'];

export default function Roadmap() {
  const { user, isAdmin, isCollaborator } = useAuth();
  const canEdit = isAdmin || isCollaborator;

  const [selectedBlock, setSelectedBlock] = useState('Khối A00');
  const [roadmapData, setRoadmapData] = useState(null);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [targetStepId, setTargetStepId] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRoadmapAndProgress = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rData, error: rError } = await supabase
        .from('roadmaps')
        .select(`
          id, block_name, title, description,
          roadmap_steps (
            id, step_number, phase_title, timeframe, description,
            roadmap_tasks ( id, task_title, is_custom )
          )
        `)
        .eq('block_name', selectedBlock)
        .maybeSingle();

      if (rError) throw rError;

      if (rData && rData.roadmap_steps) {
        rData.roadmap_steps.sort((a, b) => a.step_number - b.step_number);
      }
      setRoadmapData(rData);

      if (user) {
        const { data: pData, error: pError } = await supabase
          .from('user_completed_tasks')
          .select('task_id')
          .eq('user_id', user.id);

        if (pError) throw pError;
        if (pData) {
          setCompletedTasks(pData.map((item) => item.task_id));
        }
      }
    } catch (error) {
      console.error('Lỗi tải lộ trình:', error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedBlock, user]);

  useEffect(() => {
    fetchRoadmapAndProgress();
  }, [fetchRoadmapAndProgress]);

  const handleToggleTask = async (taskId) => {
    if (!user) return;
    const isCompleted = completedTasks.includes(taskId);

    if (isCompleted) {
      setCompletedTasks(completedTasks.filter((id) => id !== taskId));
      await supabase
        .from('user_completed_tasks')
        .delete()
        .eq('user_id', user.id)
        .eq('task_id', taskId);
    } else {
      setCompletedTasks([...completedTasks, taskId]);
      await supabase
        .from('user_completed_tasks')
        .insert([{ user_id: user.id, task_id: taskId }]);
    }
  };

  const handleAddCustomTask = async (e) => {
    e.preventDefault();
    if (!canEdit) {
      alert('Chỉ Admin hoặc Cộng tác viên mới được thêm nhiệm vụ vào lộ trình.');
      return;
    }
    if (!newTaskTitle.trim() || !targetStepId) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('roadmap_tasks')
        .insert([
          {
            step_id: targetStepId,
            task_title: newTaskTitle.trim(),
            is_custom: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const updatedSteps = roadmapData.roadmap_steps.map((step) => {
          if (step.id === targetStepId) {
            return { ...step, roadmap_tasks: [...step.roadmap_tasks, data] };
          }
          return step;
        });
        setRoadmapData({ ...roadmapData, roadmap_steps: updatedSteps });
      }

      setNewTaskTitle('');
      setIsAddTaskModalOpen(false);
    } catch (error) {
      alert('Lỗi khi thêm nhiệm vụ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomTask = async (stepId, taskId) => {
    if (!canEdit) return;
    if (!window.confirm('Bạn có chắc muốn xóa nhiệm vụ tự thêm này?')) return;
    try {
      const { error } = await supabase.from('roadmap_tasks').delete().eq('id', taskId);
      if (error) throw error;

      const updatedSteps = roadmapData.roadmap_steps.map((step) => {
        if (step.id === stepId) {
          return {
            ...step,
            roadmap_tasks: step.roadmap_tasks.filter((t) => t.id !== taskId),
          };
        }
        return step;
      });
      setRoadmapData({ ...roadmapData, roadmap_steps: updatedSteps });
      setCompletedTasks(completedTasks.filter((id) => id !== taskId));
    } catch (error) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

  const allTasks = roadmapData?.roadmap_steps?.flatMap((s) => s.roadmap_tasks) || [];
  const totalTasksCount = allTasks.length;
  const completedTasksCount = allTasks.filter((t) => completedTasks.includes(t.id)).length;
  const progressPercent =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div className="bg-background font-sans text-foreground min-h-full pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header & Block Selector */}
        <header className="imperial-frame p-5 sm:p-7 mb-6 relative overflow-hidden">
          <span
            aria-hidden="true"
            className="hanzi-watermark absolute top-2 right-6 text-8xl font-bold text-accent/8"
          >
            道途
          </span>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <div className="mb-2">
                <RankSeal size="sm" icon="route" label="Chiến Lược Ôn Thi · 2027" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-foreground">
                Lộ Trình Học Tập Chuẩn
              </h1>
              <p className="text-xs sm:text-sm text-secondary-text mt-1">
                Bám sát từng giai đoạn để tối ưu điểm số mục tiêu đại học
              </p>
            </div>

            {canEdit && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-jade-soft border border-jade-border text-jade text-xs font-bold self-start sm:self-auto">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  verified_user
                </span>
                Chế độ biên tập ({isAdmin ? 'Admin' : 'Cộng tác viên'})
              </div>
            )}
          </div>

          {/* Exam Block Chips */}
          <div className="relative z-10 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {EXAM_BLOCKS.map((block) => (
              <button
                key={block}
                type="button"
                onClick={() => {
                  setSelectedBlock(block);
                  setActiveStepIndex(0);
                }}
                aria-pressed={selectedBlock === block}
                className={`px-4 py-2 rounded-full text-xs font-display font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  selectedBlock === block
                    ? 'bg-primary text-on-primary border-primary shadow-xs'
                    : 'bg-surface border-border text-secondary-text hover:text-foreground hover:border-border-strong'
                }`}
              >
                {block}
              </button>
            ))}
          </div>
        </header>

        {/* Main Content */}
        <main className="space-y-6">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <span
                className="material-symbols-outlined animate-spin text-4xl text-primary"
                aria-hidden="true"
              >
                sync
              </span>
            </div>
          ) : roadmapData ? (
            <>
              {/* Overall Progress Card */}
              <div className="paper-card p-6 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
                  <div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-primary-soft text-primary border border-primary/30 mb-2">
                      {roadmapData.block_name}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-display font-extrabold text-foreground">
                      {roadmapData.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-secondary-text mt-1 max-w-2xl leading-relaxed">
                      {roadmapData.description}
                    </p>
                  </div>
                  <div className="text-left sm:text-right no-shrink">
                    <div className="text-3xl font-display font-extrabold text-primary tabular">
                      {progressPercent}%
                    </div>
                    <p className="text-xs text-secondary-text tabular">
                      Hoàn thành {completedTasksCount}/{totalTasksCount} mục tiêu
                    </p>
                  </div>
                </div>

                <ProgressBar
                  value={completedTasksCount}
                  max={totalTasksCount || 1}
                  tone="primary"
                  showPercent={false}
                />
              </div>

              {/* Timeline Steps */}
              <div className="space-y-4">
                <h3 className="text-base font-display font-extrabold text-foreground flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" aria-hidden="true">
                    timeline
                  </span>
                  Các giai đoạn chiến lược
                </h3>

                <div className="relative pl-4 sm:pl-6 border-l-2 border-border-strong space-y-6">
                  {roadmapData.roadmap_steps?.map((step, index) => {
                    const stepTasks = step.roadmap_tasks || [];
                    const stepCompletedCount = stepTasks.filter((t) =>
                      completedTasks.includes(t.id),
                    ).length;
                    const isStepDone =
                      stepTasks.length > 0 && stepCompletedCount === stepTasks.length;
                    const isActive = activeStepIndex === index;

                    return (
                      <div key={step.id} className="relative group">
                        {/* Timeline Node Dot */}
                        <div
                          onClick={() => setActiveStepIndex(isActive ? -1 : index)}
                          className={`absolute -left-[25px] sm:-left-[33px] top-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all border-2 ${
                            isStepDone
                              ? 'bg-completed border-completed text-white shadow-xs'
                              : isActive
                                ? 'bg-primary border-primary text-white ring-4 ring-primary/15'
                                : 'bg-surface border-border-strong text-secondary-text hover:border-primary'
                          }`}
                        >
                          {isStepDone ? (
                            <span
                              className="material-symbols-outlined text-[14px] font-bold"
                              aria-hidden="true"
                            >
                              check
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold tabular">
                              {step.step_number}
                            </span>
                          )}
                        </div>

                        {/* Step Card */}
                        <div
                          className={`paper-card overflow-hidden transition-all ${
                            isActive ? 'border-primary/50 shadow-md' : 'hover:border-border-strong'
                          }`}
                        >
                          {/* Step Header */}
                          <div
                            onClick={() => setActiveStepIndex(isActive ? -1 : index)}
                            className="p-4 sm:p-5 cursor-pointer flex items-start justify-between gap-4 select-none bg-paper/60"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gold-soft text-gold-dark border border-gold flex items-center gap-1">
                                  <span
                                    className="material-symbols-outlined text-[12px]"
                                    aria-hidden="true"
                                  >
                                    calendar_month
                                  </span>
                                  {step.timeframe}
                                </span>
                                <span className="text-xs text-secondary-text font-medium tabular">
                                  • Đã xong {stepCompletedCount}/{stepTasks.length}
                                </span>
                              </div>
                              <h4 className="font-display font-bold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors">
                                {step.phase_title}
                              </h4>
                              <p className="text-xs text-secondary-text line-clamp-2">
                                {step.description}
                              </p>
                            </div>

                            <button
                              type="button"
                              aria-label={isActive ? 'Thu gọn giai đoạn' : 'Mở rộng giai đoạn'}
                              className="p-1.5 rounded-lg bg-surface-alt text-secondary-text group-hover:text-foreground transition-colors"
                            >
                              <span className="material-symbols-outlined" aria-hidden="true">
                                {isActive ? 'expand_less' : 'expand_more'}
                              </span>
                            </button>
                          </div>

                          {/* Mini Progress Bar for Step */}
                          <div className="px-4 sm:px-5 pb-2">
                            <ProgressBar
                              value={stepCompletedCount}
                              max={stepTasks.length || 1}
                              tone={isStepDone ? 'completed' : 'primary'}
                              size="sm"
                              showPercent={false}
                            />
                          </div>

                          {/* Step Tasks (Collapsible) */}
                          {isActive && (
                            <div className="px-4 sm:px-5 pb-5 pt-3 border-t border-border bg-surface space-y-2.5">
                              <p className="text-xs font-bold text-secondary-text mb-3">
                                Danh sách nhiệm vụ cần hoàn thành:
                              </p>

                              {stepTasks.map((task) => {
                                const isChecked = completedTasks.includes(task.id);
                                return (
                                  <div
                                    key={task.id}
                                    onClick={() => handleToggleTask(task.id)}
                                    className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                      isChecked
                                        ? 'bg-completed-soft/60 border-completed-border text-secondary-text'
                                        : 'bg-paper border-border hover:border-primary/40 text-foreground'
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div
                                        className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center no-shrink transition-colors ${
                                          isChecked
                                            ? 'bg-completed text-white'
                                            : 'border-2 border-border-strong bg-surface'
                                        }`}
                                      >
                                        {isChecked && (
                                          <span
                                            className="material-symbols-outlined text-[14px] font-bold"
                                            aria-hidden="true"
                                          >
                                            check
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className={`text-sm leading-snug ${
                                          isChecked ? 'line-through text-muted-foreground' : 'font-medium'
                                        }`}
                                      >
                                        {task.task_title}
                                      </span>
                                    </div>

                                    {task.is_custom && (
                                      <div className="flex items-center gap-1 no-shrink">
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-alt text-secondary-text border border-border">
                                          Bổ sung
                                        </span>
                                        {canEdit && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteCustomTask(step.id, task.id);
                                            }}
                                            aria-label="Xoá nhiệm vụ"
                                            className="text-muted-foreground hover:text-primary p-0.5 cursor-pointer"
                                          >
                                            <span
                                              className="material-symbols-outlined text-[16px]"
                                              aria-hidden="true"
                                            >
                                              delete
                                            </span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetStepId(step.id);
                                    setIsAddTaskModalOpen(true);
                                  }}
                                  className="w-full mt-2 py-2.5 border border-dashed border-border-strong rounded-xl text-xs font-bold text-secondary-text hover:text-primary hover:border-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <span
                                    className="material-symbols-outlined text-base"
                                    aria-hidden="true"
                                  >
                                    add
                                  </span>
                                  Thêm mục tiêu vào giai đoạn này
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 paper-card">
              <p className="text-secondary-text">Chưa có dữ liệu lộ trình cho khối này.</p>
            </div>
          )}
        </main>
      </div>

      {/* Modal Thêm Nhiệm Vụ Cá Nhân */}
      {isAddTaskModalOpen && (
        <div className="fixed inset-0 z-[100] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="imperial-frame w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-foreground">
                Thêm mục tiêu học tập
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTaskModalOpen(false)}
                aria-label="Đóng"
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
            <form onSubmit={handleAddCustomTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Nội dung nhiệm vụ
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Giải 10 đề thi thử trường Chuyên..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(false)}
                  className="btn-arena btn-arena-secondary btn-arena-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-arena btn-arena-primary btn-arena-sm"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Thêm vào lộ trình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
