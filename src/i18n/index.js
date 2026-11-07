import { common } from './common';
import { auth } from './auth';
import { homeAndCourses } from './homeAndCourses';
import { academics } from './academics';
import { communityAndAdmin } from './communityAndAdmin';

export const SUPPORTED_LANGUAGES = ['vi', 'en'];
export const DEFAULT_LANGUAGE = 'vi';
export const LANGUAGE_STORAGE_KEY = 'dtht_lang';

export const dictionaries = {
  vi: {
    ...common.vi,
    ...auth.vi,
    ...homeAndCourses.vi,
    ...academics.vi,
    ...communityAndAdmin.vi,
  },
  en: {
    ...common.en,
    ...auth.en,
    ...homeAndCourses.en,
    ...academics.en,
    ...communityAndAdmin.en,
  },
};

function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  return String(path)
    .split('.')
    .reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

export function interpolate(template, params = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined && params[key] !== null ? String(params[key]) : `{${key}}`,
  );
}

export function translate(lang = DEFAULT_LANGUAGE, key, params) {
  const safeLang = lang === 'en' ? 'en' : 'vi';
  const primary = resolvePath(dictionaries[safeLang], key);
  const fallback = resolvePath(dictionaries.vi, key);
  const raw = primary !== undefined ? primary : fallback !== undefined ? fallback : key;
  return typeof raw === 'string' && params ? interpolate(raw, params) : raw;
}

export function getStoredLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'en' ? 'en' : 'vi';
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
