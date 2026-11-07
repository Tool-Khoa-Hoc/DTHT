import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * ThemeToggle — Nút chuyển đổi phong cách "Thư Phòng Sáng" ⇋ "Mặc Dạ Tối"
 * Phù hợp chủ đề Trung Hoa / Khoa Bảng Á Đông.
 */
export default function ThemeToggle({ variant = 'desktop', className = '' }) {
  const { toggleTheme, isDark } = useTheme();
  const { t } = useLanguage();

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-alt text-foreground hover:bg-surface hover:border-gold transition-colors active:scale-95 cursor-pointer shadow-xs ${className}`.trim()}
        title={isDark ? t('theme.toLightTitle') : t('theme.toDarkTitle')}
        aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
      >
        <span
          className={`material-symbols-outlined text-lg transition-transform duration-300 ${
            isDark ? 'text-gold rotate-0' : 'text-primary rotate-180'
          }`}
          aria-hidden="true"
        >
          {isDark ? 'dark_mode' : 'light_mode'}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group flex items-center justify-between w-full px-3 py-2 rounded-xl border border-border bg-surface hover:bg-surface-alt hover:border-gold/60 transition-all cursor-pointer shadow-2xs ${className}`.trim()}
      title={isDark ? t('theme.toLightTitle') : t('theme.toDarkTitle')}
      aria-label={t('theme.toggleAria')}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            isDark
              ? 'border-gold/40 bg-gold-soft text-gold'
              : 'border-primary/30 bg-primary-soft text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-base leading-none" aria-hidden="true">
            {isDark ? 'dark_mode' : 'light_mode'}
          </span>
        </div>
        <div className="text-left min-w-0">
          <p className="text-xs font-bold leading-tight text-foreground truncate">
            {isDark ? t('theme.darkName') : t('theme.lightName')}
          </p>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5 truncate">
            {isDark ? t('theme.darkSub') : t('theme.lightSub')}
          </p>
        </div>
      </div>

      <div
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
          isDark ? 'bg-primary border-primary-hover justify-end' : 'bg-surface-alt border-border justify-start'
        } px-0.5`}
        aria-hidden="true"
      >
        <div
          className={`h-3.5 w-3.5 rounded-full transition-transform ${
            isDark ? 'bg-white shadow-xs' : 'bg-primary shadow-xs'
          }`}
        />
      </div>
    </button>
  );
}
