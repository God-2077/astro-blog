/**
 * LanguageDetectPopup Component
 *
 * Detects browser language and shows a popup suggesting the user
 * switch to their preferred language. Styled to match the announcement popup.
 *
 * Popup text is displayed in the user's browser language first,
 * falling back to the current page language.
 */

import { animation, zIndex } from '@constants/design-tokens';
import { Icon } from '@iconify/react';
import { useStore } from '@nanostores/react';
import {
  closeLanguagePopup,
  dismissLanguagePopup,
  languagePopupOpen,
  suggestedLabel,
  suggestedLocale,
} from '@store/language-detect';
import { $locale } from '@store/locale';
import { AnimatePresence, motion } from 'motion/react';
import { getAlternateUrl, t as translate } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';

export default function LanguageDetectPopup() {
  const isOpen = useStore(languagePopupOpen);
  const targetLocale = useStore(suggestedLocale);
  const label = useStore(suggestedLabel);
  const pageLocale = useStore($locale);

  const targetUrl = typeof window !== 'undefined' ? getAlternateUrl(window.location.pathname, targetLocale) : '/';

  /** Translate using browser language first, fall back to page language */
  const t = (key: TranslationKey, params?: Record<string, string>) => {
    const result = translate(targetLocale, key, params);
    if (result === key) {
      return translate(pageLocale, key, params);
    }
    return result;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: zIndex.modalBackdrop }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLanguagePopup}
          />

          {/* Popup */}
          <motion.div
            className="fixed inset-x-3 top-1/2 mx-auto max-w-md overflow-hidden rounded-xl bg-card shadow-2xl md:inset-x-4 md:rounded-2xl"
            style={{ zIndex: zIndex.modal }}
            initial={{ opacity: 0, y: '-45%', scale: 0.95 }}
            animate={{ opacity: 1, y: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: '-45%', scale: 0.95 }}
            transition={animation.spring.default}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-border border-b bg-linear-to-r from-primary/5 to-transparent p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 md:h-10 md:w-10 md:rounded-xl">
                  <Icon icon="ri:translate-2" className="h-4 w-4 text-primary md:h-5 md:w-5" />
                </div>
                <h3 className="font-semibold text-sm md:text-base">{t('languageDetect.title')}</h3>
              </div>
              <button
                onClick={closeLanguagePopup}
                className="rounded-md p-1.5 transition-colors hover:bg-black/5 md:rounded-lg md:p-2 dark:hover:bg-white/10"
                aria-label={t('common.close')}
                type="button"
              >
                <Icon icon="ri:close-line" className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 md:p-6">
              <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
                {t('languageDetect.message', { lang: label })}
              </p>

              <div className="mt-5 flex items-center gap-3 md:mt-6">
                <a
                  href={targetUrl}
                  onClick={closeLanguagePopup}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground text-sm transition-all hover:opacity-90 md:rounded-xl md:px-5 md:py-3 md:text-base"
                >
                  <Icon icon="ri:arrow-right-line" className="h-4 w-4 md:h-5 md:w-5" />
                  {t('languageDetect.switch', { lang: label })}
                </a>
                <button
                  onClick={dismissLanguagePopup}
                  className="rounded-lg px-4 py-2.5 text-muted-foreground text-sm transition-colors hover:bg-muted md:rounded-xl md:px-5 md:py-3 md:text-base"
                  type="button"
                >
                  {t('languageDetect.dismiss')}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
