/**
 * Language Detection State Management
 *
 * Detects browser language and compares with current site locale.
 * Shows a popup suggesting the user switch to their preferred language.
 * Persists dismissal in localStorage.
 */

import { atom } from 'nanostores';
import { defaultLocale, isI18nEnabled, localeList } from '@/i18n/config';

const STORAGE_KEY = 'language-detect-dismissed';

/** Whether the language suggestion popup is visible */
export const languagePopupOpen = atom<boolean>(false);

/** The target locale code to suggest switching to */
export const suggestedLocale = atom<string>('');

/** The display label for the suggested language */
export const suggestedLabel = atom<string>('');

/**
 * Map a browser language code (e.g. "en-US", "zh-CN") to a site locale code.
 * Returns null if the browser language doesn't match any supported locale.
 */
function mapBrowserLang(lang: string): string | null {
  const primary = lang.split('-')[0].toLowerCase();
  if (localeList.includes(primary)) return primary;
  // Full match (e.g. "zh-CN" → "zh" is already handled above, "zh-TW" → "zh")
  if (primary === 'zh' && localeList.includes('zh')) return 'zh';
  if (primary === 'ja' && localeList.includes('ja')) return 'ja';
  if (primary === 'en' && localeList.includes('en')) return 'en';
  return null;
}

/**
 * Get a human-readable label for a locale code in the locale's own language.
 */
function getLocaleSelfLabel(code: string): string {
  const labels: Record<string, string> = {
    zh: '中文',
    en: 'English',
    ja: '日本語',
  };
  return labels[code] ?? code;
}

/**
 * Initialize language detection.
 * Compares browser language with current site locale and opens popup if they differ.
 * Does nothing if i18n is disabled or the user has dismissed before.
 */
export function initLanguageDetect(): void {
  if (typeof window === 'undefined') return;
  if (!isI18nEnabled) return;

  // Check if user has dismissed
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
  } catch {
    // localStorage unavailable, skip
    return;
  }

  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || '';
  const targetLocale = mapBrowserLang(browserLang);

  if (!targetLocale) return;

  // Get current locale from URL
  const pathname = window.location.pathname;
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  const currentLocale = firstSegment && localeList.includes(firstSegment) ? firstSegment : defaultLocale;

  if (targetLocale === currentLocale) return;

  suggestedLocale.set(targetLocale);
  suggestedLabel.set(getLocaleSelfLabel(targetLocale));
  languagePopupOpen.set(true);
}

/**
 * Dismiss the popup permanently (save to localStorage)
 */
export function dismissLanguagePopup(): void {
  languagePopupOpen.set(false);
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage unavailable
  }
}

/**
 * Close the popup without dismissing permanently
 */
export function closeLanguagePopup(): void {
  languagePopupOpen.set(false);
}
