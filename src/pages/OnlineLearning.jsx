import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ONLINE_SHEET_TABS,
  ONLINE_SHEET_TITLE,
  embedUrl,
  openUrl,
} from '../config/onlineLearning';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#150a0d]';

function isGoogleAccount(user) {
  if (!user) return false;
  if (user.app_metadata?.provider === 'google') return true;
  const identities = Array.isArray(user.identities) ? user.identities : [];
  return identities.some((identity) => identity?.provider === 'google');
}

export default function OnlineLearning() {
  const { user, loading } = useAuth();
  const [activeGid, setActiveGid] = useState(ONLINE_SHEET_TABS[0]?.gid ?? '');
  const [iframeLoading, setIframeLoading] = useState(true);

  const googleLinked = useMemo(() => isGoogleAccount(user), [user]);
  const activeTab = ONLINE_SHEET_TABS.find((tab) => tab.gid === activeGid) ?? ONLINE_SHEET_TABS[0];

  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/hoc-online` },
      });
    } catch (error) {
      console.error('Lỗi đăng nhập Google:', error);
    }
  };

  const handleSelectTab = (gid) => {
    if (gid === activeGid) return;
    setIframeLoading(true);
    setActiveGid(gid);
  };

  if (loading && !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80dvh] flex-col bg-[#150a0d] text-white">
      {/* Header */}
      <header className="sticky top-[calc(3rem+env(safe-area-inset-top,0px))] z-30 border-b border-white/5 bg-[#201216]/95 px-4 py-3 shadow-lg shadow-[#150a0d]/30 backdrop-blur-md md:top-0 sm:px-6">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#10b981]/12 text-[#10b981]">
                <span className="material-symbols-outlined text-[22px] leading-none">computer</span>
              </span>
              <div className="min-w-0">
                <h1 className="text-base font-black leading-tight sm:text-lg">Học online</h1>
                <p className="truncate text-[11px] font-medium text-slate-400 sm:text-xs">{ONLINE_SHEET_TITLE}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#10b981]">
                  Đang xem: {activeTab?.title ?? 'Google Sheet'}
                </p>
              </div>
            </div>

            <a
              href={openUrl(activeGid)}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-extrabold text-slate-100 transition-all hover:border-[#10b981]/30 hover:bg-[#10b981]/12 active:scale-[0.98] ${focusRing}`}
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              Mở trong Google Sheets
            </a>
          </div>

          {/* Banner: khuyến nghị đăng nhập Google nếu tài khoản chưa liên kết Google */}
          {!googleLinked && (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-100 sm:flex-row sm:items-center sm:justify-between">
              <span className="leading-5">
                Nội dung được chia sẻ theo tài khoản Google. Hãy đăng nhập bằng Google cùng email đã được cấp quyền
                để xem sheet private ổn định hơn.
              </span>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-500/20 px-3 font-bold text-amber-50 transition-colors hover:bg-amber-500/30 active:scale-[0.98] ${focusRing}`}
              >
                <span className="material-symbols-outlined text-[16px]">login</span>
                Đăng nhập Google
              </button>
            </div>
          )}

          {/* Tab bar: 5 sheet */}
          <div
            role="tablist"
            aria-label="Các tab Google Sheet học online"
            className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide sm:mx-0 sm:px-0"
          >
            {ONLINE_SHEET_TABS.map((tab, index) => {
              const active = tab.gid === activeGid;
              return (
                <button
                  key={tab.gid}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="online-sheet-frame"
                  onClick={() => handleSelectTab(tab.gid)}
                  className={`inline-flex min-h-11 snap-start items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-extrabold transition-all active:scale-[0.98] ${focusRing} ${
                    active
                      ? 'border-[#10b981]/70 bg-[#10b981] text-white shadow-lg shadow-[#10b981]/20'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-[#10b981]/30 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className={active ? 'text-white/80' : 'text-slate-500'}>{String(index + 1).padStart(2, '0')}</span>
                  {tab.title}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Khung view sheet (iframe) */}
      <div className="relative w-full">
        {iframeLoading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#150a0d]/95">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-slate-300 shadow-xl shadow-black/20">
              <span className="material-symbols-outlined animate-spin text-2xl text-[#10b981]">progress_activity</span>
              Đang tải {activeTab?.title ?? 'sheet'}...
            </div>
          </div>
        )}
        <iframe
          id="online-sheet-frame"
          key={activeGid}
          title={`Sheet ${activeTab?.title ?? ''}`}
          src={embedUrl(activeGid)}
          onLoad={() => setIframeLoading(false)}
          className="h-[65dvh] min-h-[360px] w-full border-0 bg-white sm:h-[72vh] md:h-[calc(100dvh-11rem)]"
          loading="lazy"
        />
      </div>

      {/* Fallback hint cho mobile (iframe có thể bị chặn cookie bên thứ ba) */}
      <div className="border-t border-white/5 bg-[#201216] px-4 py-3 text-xs text-slate-400 sm:px-6">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-5">
            Nếu sheet trắng, báo quyền hoặc trình duyệt chặn cookie trên điện thoại, mở bằng Google Sheets. Các link
            học trong từng ô vẫn mở ở tab mới.
          </p>
          <a
            href={openUrl(activeGid)}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#10b981]/15 px-3 font-extrabold text-[#b8f4dd] transition-colors hover:bg-[#10b981]/25 active:scale-[0.98] ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Mở Google Sheets
          </a>
        </div>
      </div>
    </div>
  );
}
