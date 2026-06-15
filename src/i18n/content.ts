/**
 * i18n Content Translation Loader
 *
 * Loads content-level translations (category names, series fields, featured category fields)
 * from config/i18n-content.yaml. These are user-configurable strings separate from UI strings.
 *
 * Lookup: YAML content config → caller provides fallback
 */

import i18nContent from '../../config/i18n-content.yaml';
import type { I18nContentConfig } from './content-types';

const config = i18nContent as I18nContentConfig;

/**
 * Look up a translated category name from the YAML content config.
 * Returns undefined if no translation is defined for the given locale/slug.
 */
export function getContentCategoryName(locale: string, slug: string): string | undefined {
  return config[locale]?.categories?.[slug];
}

/**
 * Look up a translated series field (label, fullName, description) from the YAML content config.
 * Returns undefined if no translation is defined.
 */
export function getContentSeriesField(locale: string, slug: string, field: string): string | undefined {
  const series = config[locale]?.series?.[slug];
  if (!series) return undefined;
  return series[field as keyof typeof series];
}

/**
 * Look up a translated featured category field (label, description) from the YAML content config.
 * The `link` parameter matches the `link` field in featuredCategories config (e.g. 'life', 'note/front-end').
 */
export function getContentFeaturedCategoryField(locale: string, link: string, field: string): string | undefined {
  const cat = config[locale]?.featuredCategories?.[link];
  if (!cat) return undefined;
  return cat[field as keyof typeof cat];
}

/**
 * Look up a translated navigation name from the YAML content config.
 * The `nameKey` matches the `nameKey` field in site.yaml navigation items (e.g. 'nav.home').
 */
export function getContentNavName(locale: string, nameKey: string): string | undefined {
  return config[locale]?.navigation?.[nameKey];
}

/**
 * Look up a translated site metadata field (title, alternate, mobileLogoText, subtitle, description) from the YAML content config.
 */
export function getContentSiteField(
  locale: string,
  field: 'title' | 'alternate' | 'mobileLogoText' | 'subtitle' | 'description',
): string | undefined {
  return config[locale]?.site?.[field];
}

/**
 * Look up translated site keywords from the YAML content config.
 */
export function getContentSiteKeywords(locale: string): string[] | undefined {
  return config[locale]?.site?.keywords;
}
