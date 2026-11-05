import React from 'react';
import Avatar from '../Avatar';

export default function AdminThongSoai({
  usersList,
  thongSoaiEmail,
  setThongSoaiEmail,
  isGrantingThongSoai,
  onGrantByEmail,
  onToggleThongSoai,
}) {
  const thongSoaiUsers = usersList.filter(
    (u) => u.is_thong_soai || (u.total_study_minutes || 0) >= 4500,
  );

  return (
    <div className="space-y-6">
      <div className="paper-card p-6 relative overflow-hidden">
        <span
          aria-hidden="true"
          className="hanzi-watermark absolute top-2 right-5 text-7xl font-bold text-primary/8"
        >
          統帥
        </span>

        <div className="relative z-10 flex items-center gap-3.5 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-primary-soft border border-primary/35 flex items-center justify-center text-primary no-shrink">
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">
              emoji_events
            </span>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-foreground">
              Sắc Phong Danh Hiệu &ldquo;Thống Soái&rdquo; Đặc Cách
            </h2>
            <p className="text-xs text-secondary-text">
              Cấp trực tiếp danh hiệu cao quý nhất Đấu Trường cho tài khoản mà không cần đủ 4.500 phút học.
            </p>
          </div>
        </div>

        <form onSubmit={onGrantByEmail} className="relative z-10 flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <span
              className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg"
              aria-hidden="true"
            >
              mail
            </span>
            <input
              type="email"
              required
              placeholder="Nhập email tài khoản muốn phong hàm Thống Soái..."
              value={thongSoaiEmail}
              onChange={(e) => setThongSoaiEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={isGrantingThongSoai}
            className="btn-arena btn-arena-primary btn-arena-sm no-shrink"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              military_tech
            </span>
            {isGrantingThongSoai ? 'Đang sắc phong...' : 'Phong Hàm Thống Soái'}
          </button>
        </form>
      </div>

      {/* Danh sách các Thống Soái hiện tại */}
      <div className="paper-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-paper">
          <div>
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-accent" aria-hidden="true">
                workspace_premium
              </span>
              Danh sách các Thống Soái hiện tại ({thongSoaiUsers.length})
            </h3>
            <p className="text-xs text-secondary-text mt-0.5">
              Bao gồm cả chiến binh được Admin đặc cách và chiến binh tự cày đủ 4.500 phút
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {thongSoaiUsers.map((u) => (
            <div
              key={u.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-alt transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={u.avatar_url}
                  name={u.full_name || u.email}
                  className="w-11 h-11 border border-gold"
                  textSize="text-base"
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-foreground text-sm">
                      {u.full_name || 'Chưa đặt tên'}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/35">
                      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                        emoji_events
                      </span>
                      Thống Soái
                    </span>
                    {u.is_thong_soai && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-soft text-gold-dark border border-gold">
                        Đặc cách Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-secondary-text mt-0.5 tabular">
                    {u.email || 'Chưa đồng bộ email'} • Tích lũy: {u.total_study_minutes || 0} phút
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggleThongSoai(u.id, u.is_thong_soai, u.full_name || u.email)}
                className={`self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                  u.is_thong_soai
                    ? 'bg-primary-soft text-primary border-primary/30 hover:bg-primary hover:text-white'
                    : 'bg-gold-soft text-gold-dark border-gold hover:bg-gold/30'
                }`}
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  {u.is_thong_soai ? 'remove_moderator' : 'add_moderator'}
                </span>
                {u.is_thong_soai ? 'Gỡ đặc cách' : 'Bật đặc cách cố định'}
              </button>
            </div>
          ))}

          {thongSoaiUsers.length === 0 && (
            <div className="p-8 text-center text-secondary-text text-sm">
              Chưa có chiến binh nào đạt cấp Thống Soái.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
