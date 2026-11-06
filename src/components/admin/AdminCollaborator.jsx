import React, { useState } from 'react';
import Avatar from '../Avatar';
import { isSoleBangChuAccount } from '../../utils/rankHelper';

export default function AdminCollaborator({
  collaborators = [],
  searchResults = [],
  collabSearchTerm = '',
  setCollabSearchTerm,
  loadingCollabs = false,
  directoryWarning = '',
  onSearchUsers,
  onSetUserRole,
}) {
  const [roleConfirmTarget, setRoleConfirmTarget] = useState(null);

  const handleConfirmRoleChange = () => {
    if (!roleConfirmTarget) return;
    const { userId, newRole, name } = roleConfirmTarget;
    setRoleConfirmTarget(null);
    onSetUserRole(userId, newRole, name);
  };

  return (
    <div className="space-y-6">
      {/* Tìm kiếm & Sắc phong Truyền Đạo Sư */}
      <div className="paper-card p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-jade-soft border border-jade-border flex items-center justify-center text-jade no-shrink">
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">
              person_search
            </span>
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-foreground">
              Danh bạ Sĩ tử &amp; Sắc phong Truyền Đạo Sư (Collaborator)
            </h2>
            <p className="text-xs text-secondary-text">
              Tìm sĩ tử qua email hoặc tên hiển thị để trao quyền biên tập và đăng tài liệu vào Thư Viện.
            </p>
          </div>
        </div>

        {directoryWarning && (
          <div className="p-3 mb-4 rounded-xl bg-gold-soft border border-gold text-xs text-gold-dark flex items-center gap-2">
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              info
            </span>
            <span>{directoryWarning}</span>
          </div>
        )}

        <form onSubmit={onSearchUsers} className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <span
              className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="text"
              required
              placeholder="Nhập email hoặc tên sĩ tử cần tìm..."
              value={collabSearchTerm}
              onChange={(e) => setCollabSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-paper border border-border-strong rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loadingCollabs}
            className="btn-arena btn-arena-jade btn-arena-sm no-shrink"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              {loadingCollabs ? 'sync' : 'person_search'}
            </span>
            <span>{loadingCollabs ? 'Đang tìm...' : 'Tìm kiếm'}</span>
          </button>
        </form>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-5 space-y-2.5 pt-4 border-t border-border">
            <h3 className="text-xs font-bold text-secondary-text uppercase tracking-wider">
              Kết quả tìm kiếm ({searchResults.length}):
            </h3>
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-surface">
              {searchResults.map((usr) => {
                const isCollab = usr.role === 'collaborator';
                const isAdmin = usr.role === 'admin';
                const displayName = usr.display_name || usr.full_name || usr.email || 'Khuyết danh';

                return (
                  <div
                    key={usr.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-alt transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={usr.avatar_url}
                        name={displayName}
                        id={usr.id}
                        className="w-10 h-10 border border-border"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">
                            {displayName}
                          </span>
                          {isAdmin && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/30 uppercase">
                              Admin
                            </span>
                          )}
                          {isCollab && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-jade-soft text-jade border border-jade-border uppercase">
                              Truyền Đạo Sư
                            </span>
                          )}
                          {isSoleBangChuAccount(usr.role, usr.id) && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-soft text-gold-dark border border-gold uppercase">
                              Bang Chủ
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{usr.email || '—'}</div>
                      </div>
                    </div>

                    {!isAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          setRoleConfirmTarget({
                            userId: usr.id,
                            newRole: isCollab ? 'user' : 'collaborator',
                            name: displayName,
                          })
                        }
                        className={`btn-arena btn-arena-sm self-start sm:self-auto cursor-pointer ${
                          isCollab ? 'btn-arena-secondary text-primary' : 'btn-arena-jade'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">
                          {isCollab ? 'person_remove' : 'verified_user'}
                        </span>
                        <span>{isCollab ? 'Thu hồi quyền CTV' : 'Sắc phong Truyền Đạo Sư'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Danh sách Truyền Đạo Sư hiện tại */}
      <div className="paper-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between bg-paper">
          <div>
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-jade" aria-hidden="true">
                groups
              </span>
              <span>Đội ngũ Truyền Đạo Sư hiện tại ({collaborators.length})</span>
            </h3>
            <p className="text-xs text-secondary-text mt-0.5">
              Các tài khoản có quyền đóng góp đề thi &amp; biên soạn tài liệu vào Thư viện
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {collaborators.map((c) => {
            const displayName = c.display_name || c.full_name || c.email || 'Khuyết danh';
            return (
              <div
                key={c.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-alt transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={c.avatar_url}
                    name={displayName}
                    id={c.id}
                    className="w-10 h-10 border border-jade/40"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-bold text-foreground text-sm">
                        {displayName}
                      </p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-jade-soft text-jade border border-jade-border">
                        Truyền Đạo Sư
                      </span>
                    </div>
                    <p className="text-xs text-secondary-text">{c.email || 'Chưa đồng bộ email'}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setRoleConfirmTarget({
                      userId: c.id,
                      newRole: 'user',
                      name: displayName,
                    })
                  }
                  className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-soft text-primary border border-primary/30 hover:bg-primary hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    person_remove
                  </span>
                  <span>Thu hồi quyền</span>
                </button>
              </div>
            );
          })}

          {collaborators.length === 0 && (
            <div className="p-8 text-center text-secondary-text text-sm">
              Hệ thống chưa có Truyền Đạo Sư nào. Tìm kiếm người dùng ở ô trên để sắc phong!
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {roleConfirmTarget && (
        <div
          className="fixed inset-0 z-[110] bg-foreground/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRoleConfirmTarget(null)}
        >
          <div
            className="imperial-frame w-full max-w-sm p-6 bg-surface shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-jade-soft text-jade flex items-center justify-center no-shrink">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">
                  security
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-foreground">
                  Xác nhận phân quyền
                </h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  {roleConfirmTarget.newRole === 'collaborator'
                    ? `Sắc phong Truyền Đạo Sư cho ${roleConfirmTarget.name}?`
                    : `Thu hồi quyền Truyền Đạo Sư của ${roleConfirmTarget.name}?`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoleConfirmTarget(null)}
                className="btn-arena btn-arena-secondary btn-arena-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmRoleChange}
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
