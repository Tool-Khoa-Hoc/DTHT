import React, { useState } from 'react';
import Avatar from '../Avatar';
import { isSoleBangChuAccount } from '../../utils/rankHelper';

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
      {/* Banner Ngôi vị Bang Chủ Độc Tôn */}
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
              Ngôi Vị Bang Chủ Độc Tôn
            </h2>
            <p className="text-xs text-secondary-text">
              Trên toàn Đấu Trường Học Tập chỉ có duy nhất 1 tài khoản tối cao giữ ngôi vị Bang Chủ. Các sĩ tử khác thăng hạng theo tổng EXP tích lũy (tối đa đến Phó Bang Chủ).
            </p>
          </div>
        </div>
      </div>

      {/* Tài khoản Bang Chủ duy nhất */}
      <div className="paper-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-paper">
          <div>
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-accent" aria-hidden="true">
                military_tech
              </span>
              <span>Bang Chủ Tối Cao Duy Nhất</span>
            </h3>
            <p className="text-xs text-secondary-text mt-0.5">
              Không có bất kỳ tài khoản nào khác được phép sắc phong làm Bang Chủ
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {approvedBangChuList.map((u) => {
            const displayName = u.display_name || u.full_name || u.email || 'Khuyết danh';
            const isSoleOwner = isSoleBangChuAccount(u.role, u.id);
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
                      {isSoleOwner ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-soft text-gold-dark border border-gold">
                          <span className="material-symbols-outlined text-[12px] icon-fill" aria-hidden="true">
                            verified
                          </span>
                          Bang Chủ Độc Tôn
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/30">
                          Cần thu hồi cờ cũ
                        </span>
                      )}
                      {u.is_vip && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/30">
                          VIP
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-secondary-text mt-0.5">
                      {u.email || 'Chưa đồng bộ email'} • {u.university || 'Ban Quản Trị'}
                    </p>
                  </div>
                </div>

                {isSoleOwner ? (
                  <span className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-bold border bg-gold-soft text-gold-dark border-gold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm icon-fill" aria-hidden="true">
                      lock
                    </span>
                    <span>Ngôi vị cố định</span>
                  </span>
                ) : (
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
                    <span>Thu hồi cờ Bang Chủ</span>
                  </button>
                )}
              </div>
            );
          })}

          {approvedBangChuList.length === 0 && (
            <div className="p-8 text-center text-secondary-text text-sm">
              Đang tải thông tin tài khoản Bang Chủ tối cao...
            </div>
          )}
        </div>
      </div>

      {/* Danh sách Sĩ tử xuất sắc (Chỉ vinh danh Phó Bang Chủ / Cao thủ, không sắc phong Bang Chủ) */}
      <div className="paper-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-paper">
          <div>
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">
                leaderboard
              </span>
              <span>Bảng Cao Thủ Chiến Dịch ({candidates.length})</span>
            </h3>
            <p className="text-xs text-secondary-text mt-0.5">
              Các sĩ tử hoàn thành nhiều chiến dịch (chỉ theo dõi thành tích, quyền Bang Chủ đã khoá độc quyền cho 1 tài khoản duy nhất)
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
              const isSoleOwner = isSoleBangChuAccount(cand.role, cand.id);

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
                        {isSoleOwner && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-soft text-gold-dark border border-gold">
                            Bang Chủ Độc Tôn
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-secondary-text mt-0.5">{cand.email || '—'}</p>
                    </div>
                  </div>

                  <span className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-alt text-secondary-text border border-border">
                    {isSoleOwner ? 'Bang Chủ Duy Nhất' : 'Thăng hạng theo EXP (Tối đa Phó Bang Chủ)'}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-secondary-text text-sm">
              Chưa có sĩ tử nào vượt mốc 50 chiến dịch.
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
