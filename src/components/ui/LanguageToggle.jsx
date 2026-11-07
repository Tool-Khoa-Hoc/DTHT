import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * LanguageToggle — Chuyển đổi ngôn ngữ Tiếng Việt (VI) ⇋ English (EN)
 * Hỗ trợ 2 chế độ hiển thị:
 *  - compact: Nút gọn (Header di động, trang Auth, ErrorBoundary)
 *  - segmented: Thanh chuyển 2 ngăn đồng bộ cho Sidebar / Mobile Drawer
 */
export default function LanguageToggle({ variant = 'compact', className = '' }) {
  const { lang, isEn, setLang, toggleLang, t } = useLanguage();

  if (variant === 'segmented') {
    return (
      <div
        role="group"
        aria-label={t('lang.groupAria')}
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border bg-surface shadow-2xs ${className}`.trim()}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 no-shrink items-center justify-center rounded-lg border border-gold/40 bg-gold-soft text-accent">
            <span className="material-symbols-outlined text-base leading-none" aria-hidden="true">
              translate
            </span>
          </div>
          <span className="text-xs font-bold text-foreground truncate">
            {isEn ? 'Language' : 'Ngôn ngữ'}
          </span>
        </div>

        <div className="inline-flex items-center rounded-lg bg-surface-alt p-0.5 border border-border no-shrink">
          <button
            type="button"
            onClick={() => setLang('vi')}
            aria-pressed={lang === 'vi'}
            aria-label={t('lang.switchToVi')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wide transition-all cursor-pointer ${
              lang === 'vi'
                ? 'bg-primary text-on-primary shadow-2xs'
                : 'text-secondary-text hover:text-foreground'
            }`}
          >
            VI
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            aria-label={t('lang.switchToEn')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wide transition-all cursor-pointer ${
              lang === 'en'
                ? 'bg-primary text-on-primary shadow-2xs'
                : 'text-secondary-text hover:text-foreground'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    );
  }

  const nextActionLabel = isEn ? t('lang.switchToVi') : t('lang.switchToEn');

  return (
    <button
      type="button"
      onClick={toggleLang}
      title={nextActionLabel}
      aria-label={nextActionLabel}
      className={`inline-flex h-9 min-w-[54px] items-center justify-center gap-1 px-2.5 rounded-xl border border-border bg-surface-alt text-foreground hover:bg-surface hover:border-gold transition-colors active:scale-95 cursor-pointer shadow-xs no-shrink ${className}`.trim()}
    >
      <span
        className="material-symbols-outlined text-base text-accent leading-none"
        aria-hidden="true"
      >
        translate
      </span>
      <span className="text-[11px] font-extrabold tracking-wider uppercase leading-none">
        {isEn ? 'EN' : 'VI'}
      </span>
    </button>
  );
}
