import React, { useState } from 'react';
import Avatar from '../Avatar';

export default function AdminThongSoai({
  candidates = [],
  approvedBangChuList = [],
  loadingCandidates = false,
  onToggleBangChu,
}) {
  const [toggleConfirmTarget, setToggleConfirmTarget] = useState(null);

  const handleConfirmToggle = () => {
    if (!toggleConfirmTarget) return;
    const { userId, currentStatus, name } = toggleConfirmTarget;
    setToggleConfirmTarget(null);
    onToggleBangChu(userId, currentStatus, name);
  };

  return (
    <div className="space-y-6">
      {/* Banner Sắc phong Bang Chủ */}
      <div className="paper-card p-6 relative overflow-hidden">
        <span
          aria-hidden="true"
          className="hanzi-watermark absolute top-2 right-5 text-7xl font-bold text-primary/8"
        >
          幫主
        </span>

        <div className="relative z-10 flex items-center gap-3.5 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gold-soft border border-gold flex items-center justify-center text-gold-dark no-shrink">
            <span className="material-symbols-outlined text-2xl icon-fill" aria-hidden="true">
              workspace_premium
            </span>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-foreground">
              Sắc Phong Bang Chủ &amp; Vinh Danh Thống Soái
            </h2>
            <p className="text-xs text-secondary-text">
              Duyệt các chiến binh xuất sắc (hoàn thành trên 50 nhiệm vụ / tích lũy thời gian rèn luyện cao) lên vị trí Bang Chủ bang hội.
            </p>
          </div>
        </div>
      </div>

      {/* Danh sách Bang Chủ đã được sắc phong */}
      <div className="paper-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-paper">
          <div>
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-accent" aria-hidden="true">
                military_tech
              </span>
              <span>Danh sách Bang Chủ chính thức ({approvedBangChuList.length})</span>
            </h3>
            <p className="text-xs text-secondary-text mt-0.5">
              Những thủ lĩnh đã được Admin phê chuẩn con dấu Bang Chủ trên toàn cõi Đấu Trường
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {approvedBangChuList.map((u) => {
            const displayName = u.display_name || u.full_name || u.email || 'Khuyết danh';
            return (
              <div
                key={u.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-alt transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={u.avatar_url}
                    name={displayName}
                    id={u.id}
                    className="w-11 h-11 border-2 border-gold"
                    textSize="text-base"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-bold text-foreground text-sm">
                        {displayName}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-soft text-gold-dark border border-gold">
                        <span className="material-symbols-outlined text-[12px] icon-fill" aria-hidden="true">
                          verified
                        </span>
                        Bang Chủ Phê Chuẩn
                      </span>
                      {u.is_vip && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/30">
                          VIP
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-secondary-text mt-0.5">
                      {u.email || 'Chưa đồng bộ email'} • {u.university || 'Sĩ tử THPT'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setToggleConfirmTarget({
                      userId: u.id,
                      currentStatus: true,
                      name: displayName,
                    })
                  }
                  className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer bg-primary-soft text-primary border-primary/30 hover:bg-primary hover:text-white"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    remove_moderator
                  </span>
                  <span>Bỏ chức Bang Chủ</span>
                </button>
              </div>
            );
          })}

          {approvedBangChuList.length === 0 && (
            <div className="p-8 text-center text-secondary-text text-sm">
              Chưa có Bang Chủ nào được phê chuẩn. Hãy duyệt các ứng viên tiềm năng ở danh sách dưới!
            </div>
          )}
        </div>
      </div>

      {/* Danh sách Ứng viên Thống Soái tiềm năng (RPC) */}
      <div className="paper-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-paper">
          <div>
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">
                leaderboard
              </span>
              <span>Ứng viên Thống Soái tiềm năng ({candidates.length})</span>
            </h3>
            <p className="text-xs text-secondary-text mt-0.5">
              Thống kê từ RPC `admin_get_thongsoai_candidates` (đạt từ 50 mốc học tập trở lên)
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {loadingCandidates ? (
            <div className="py-12 flex justify-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary" aria-hidden="true">
                sync
              </span>
            </div>
          ) : candidates.length > 0 ? (
            candidates.map((cand) => {
              const displayName = cand.display_name || cand.full_name || cand.email || 'Khuyết danh';
              const isApproved = Boolean(cand.is_approved_bang_chu);

              return (
                <div
                  key={cand.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-alt transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={cand.avatar_url}
                      name={displayName}
                      id={cand.id}
                      className="w-10 h-10 border border-border"
                      textSize="text-sm"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display font-bold text-foreground text-sm">
                          {displayName}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-jade-soft text-jade border border-jade-border tabular">
                          {cand.completedCount || cand.completed_count || 0} nhiệm vụ
                        </span>
                        {isApproved && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-soft text-gold-dark border border-gold">
                            Đã phê chuẩn
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-secondary-text mt-0.5">{cand.email || '—'}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setToggleConfirmTarget({
                        userId: cand.id,
                        currentStatus: isApproved,
                        name: displayName,
                      })
                    }
                    className={`self-start sm:self-auto px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                      isApproved
                        ? 'bg-primary-soft text-primary border-primary/30 hover:bg-primary hover:text-white'
                        : 'bg-gold-soft text-gold-dark border-gold hover:bg-gold hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      {isApproved ? 'close' : 'check'}
                    </span>
                    <span>{isApproved ? 'Hủy sắc phong' : 'Sắc phong Bang Chủ'}</span>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-secondary-text text-sm">
              Chưa có ứng viên nào đạt điều kiện mốc hoàn thành.
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {toggleConfirmTarget && (
        <div
          className="fixed inset-0 z-[110] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setToggleConfirmTarget(null)}
        >
          <div
            className="imperial-frame w-full max-w-sm p-6 bg-surface shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-soft text-gold-dark flex items-center justify-center no-shrink">
                <span className="material-symbols-outlined text-2xl icon-fill" aria-hidden="true">
                  workspace_premium
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  Xác nhận sắc phong Bang Chủ
                </h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  {toggleConfirmTarget.currentStatus
                    ? `Thu hồi vị trí Bang Chủ của ${toggleConfirmTarget.name}?`
                    : `Sắc phong ${toggleConfirmTarget.name} làm Bang Chủ chính thức?`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setToggleConfirmTarget(null)}
                className="btn-arena btn-arena-secondary btn-arena-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmToggle}
                className="btn-arena btn-arena-primary btn-arena-sm"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
