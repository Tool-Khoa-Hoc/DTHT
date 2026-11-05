import React from 'react';
import Avatar from '../Avatar';

export default function AdminCollaborator({
  usersList,
  collabEmailInput,
  setCollabEmailInput,
  isUpdatingCollab,
  onGrantByEmail,
  onSetUserRole,
}) {
  const collaborators = usersList.filter((u) => u.role === 'collaborator' || u.role === 'admin');

  return (
    <div className="space-y-6">
      {/* Form cấp quyền nhanh bằng Email */}
      <div className="paper-card p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-jade-soft border border-jade-border flex items-center justify-center text-jade">
            <span className="material-symbols-outlined" aria-hidden="true">
              person_add
            </span>
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-foreground">
              Thêm Cộng Tác Viên bằng Email
            </h2>
            <p className="text-xs text-secondary-text">
              Cộng tác viên có quyền đăng tài liệu vào Thư viện Free và cập nhật nhiệm vụ trong Lộ trình học.
            </p>
          </div>
        </div>

        <form onSubmit={onGrantByEmail} className="flex flex-col sm:flex-row gap-3 mt-4">
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
              placeholder="Nhập chính xác email tài khoản cần cấp quyền CTV..."
              value={collabEmailInput}
              onChange={(e) => setCollabEmailInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={isUpdatingCollab}
            className="btn-arena btn-arena-jade btn-arena-sm no-shrink"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              verified_user
            </span>
            {isUpdatingCollab ? 'Đang xử lý...' : 'Cấp quyền Cộng tác viên'}
          </button>
        </form>
      </div>

      {/* Danh sách đội ngũ hiện tại */}
      <div className="paper-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-paper">
          <div>
            <h3 className="font-display font-bold text-base text-foreground">
              Đội ngũ Quản trị &amp; Cộng tác viên ({collaborators.length})
            </h3>
            <p className="text-xs text-secondary-text mt-0.5">
              Danh sách các tài khoản có quyền biên tập nội dung trên hệ thống
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {collaborators.map((u) => (
            <div
              key={u.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-alt transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={u.avatar_url}
                  name={u.full_name || u.email}
                  className="w-10 h-10"
                  textSize="text-sm"
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-foreground text-sm">
                      {u.full_name || 'Chưa đặt tên'}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        u.role === 'admin'
                          ? 'bg-primary-soft text-primary border-primary/35'
                          : 'bg-jade-soft text-jade border-jade-border'
                      }`}
                    >
                      {u.role === 'admin' ? 'Admin' : 'Cộng tác viên'}
                    </span>
                  </div>
                  <p className="text-xs text-secondary-text">{u.email || 'Chưa đồng bộ email'}</p>
                </div>
              </div>

              {u.role === 'collaborator' && (
                <button
                  type="button"
                  onClick={() => onSetUserRole(u.id, 'student', u.full_name || u.email)}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-soft text-primary border border-primary/30 hover:bg-primary hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    person_remove
                  </span>
                  Thu hồi quyền CTV
                </button>
              )}
            </div>
          ))}

          {collaborators.length === 0 && (
            <div className="p-8 text-center text-secondary-text text-sm">
              Chưa có Cộng tác viên nào. Hãy nhập email ở ô phía trên để thêm!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
