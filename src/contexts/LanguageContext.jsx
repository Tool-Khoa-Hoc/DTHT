import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getStoredLanguage,
  translate,
} from '../i18n';

const LanguageContext = createContext({
  lang: DEFAULT_LANGUAGE,
  isEn: false,
  locale: 'vi-VN',
  setLang: () => {},
  toggleLang: () => {},
  t: (key) => key,
  pick: (viVal) => viVal,
  formatNumber: (val) => String(val ?? ''),
  formatDate: (val) => String(val ?? ''),
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getStoredLanguage);

  const setLang = useCallback((nextLang) => {
    if (nextLang === 'vi' || nextLang === 'en') {
      setLangState(nextLang);
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'en' ? 'vi' : 'en'));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    document.title = translate(lang, 'brand.pageTitle');

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore private browsing storage failures
    }
  }, [lang]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === LANGUAGE_STORAGE_KEY) {
        setLangState(event.newValue === 'en' ? 'en' : 'vi');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const isEn = lang === 'en';
  const locale = isEn ? 'en-US' : 'vi-VN';

  const t = useCallback((key, params) => translate(lang, key, params), [lang]);

  const pick = useCallback(
    (viVal, enVal) => (lang === 'en' && enVal !== undefined ? enVal : viVal),
    [lang],
  );

  const formatNumber = useCallback(
    (value, options) => {
      if (value == null || !Number.isFinite(Number(value))) return '—';
      return Number(value).toLocaleString(locale, options);
    },
    [locale],
  );

  const formatDate = useCallback(
    (dateInput, options) => {
      if (!dateInput) return null;
      const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
      if (Number.isNaN(d.getTime())) return String(dateInput);
      return d.toLocaleDateString(locale, options);
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      lang,
      isEn,
      locale,
      setLang,
      toggleLang,
      t,
      pick,
      formatNumber,
      formatDate,
    }),
    [lang, isEn, locale, setLang, toggleLang, t, pick, formatNumber, formatDate],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
