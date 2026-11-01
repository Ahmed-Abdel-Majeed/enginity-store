import { Product } from '../../types';
import { PlatformDefinition, PlatformMatchResult } from './types';

export const PLATFORM_REGISTRY: Record<string, PlatformDefinition> = {
  facebook: {
    id: 'facebook',
    name_ar: 'فيسبوك ماسنجر',
    name_en: 'Facebook Messenger',
    synonyms: [
      'فيسبوك',
      'فيس بوك',
      'فيس',
      'ماسنجر',
      'ماسينجر',
      'facebook',
      'messenger',
      'fb'
    ],
    catalogTools: ['Facebook Messenger', 'Meta for Developers', 'Facebook']
  },
  whatsapp: {
    id: 'whatsapp',
    name_ar: 'واتساب',
    name_en: 'WhatsApp',
    synonyms: [
      'واتساب',
      'واتس اب',
      'واتس',
      'الواتس',
      'whatsapp',
      'wa'
    ],
    catalogTools: ['WhatsApp', 'Evolution API']
  },
  instagram: {
    id: 'instagram',
    name_ar: 'انستجرام',
    name_en: 'Instagram',
    synonyms: [
      'انستجرام',
      'انستغرام',
      'انستا',
      'instagram',
      'insta',
      'ig'
    ],
    catalogTools: ['Instagram']
  },
  telegram: {
    id: 'telegram',
    name_ar: 'تيليجرام',
    name_en: 'Telegram',
    synonyms: [
      'تيليجرام',
      'تليجرام',
      'تيلجرام',
      'telegram',
      'tg'
    ],
    catalogTools: ['Telegram']
  },
  tiktok: {
    id: 'tiktok',
    name_ar: 'تيك توك',
    name_en: 'TikTok',
    synonyms: [
      'تيك توك',
      'تيكتوك',
      'tiktok'
    ],
    catalogTools: ['TikTok']
  },
  linkedin: {
    id: 'linkedin',
    name_ar: 'لينكد إن',
    name_en: 'LinkedIn',
    synonyms: [
      'لينكد ان',
      'لينكد إن',
      'لينكدإن',
      'لينكدان',
      'linkedin'
    ],
    catalogTools: ['LinkedIn']
  },
  shopify: {
    id: 'shopify',
    name_ar: 'شوبيفاي',
    name_en: 'Shopify',
    synonyms: [
      'شوبيفاي',
      'shopify'
    ],
    catalogTools: ['Shopify']
  },
  woocommerce: {
    id: 'woocommerce',
    name_ar: 'ووكومرس',
    name_en: 'WooCommerce',
    synonyms: [
      'ووكومرس',
      'woocommerce'
    ],
    catalogTools: ['WooCommerce']
  },
  salla: {
    id: 'salla',
    name_ar: 'سلة',
    name_en: 'Salla',
    synonyms: [
      'سلة',
      'منصة سلة',
      'salla'
    ],
    catalogTools: ['Salla']
  },
  zid: {
    id: 'zid',
    name_ar: 'زد',
    name_en: 'Zid',
    synonyms: [
      'زد',
      'منصة زد',
      'zid'
    ],
    catalogTools: ['Zid']
  },
  google_sheets: {
    id: 'google_sheets',
    name_ar: 'جوجل شيتس',
    name_en: 'Google Sheets',
    synonyms: [
      'جوجل شيت',
      'شيتس',
      'جوجل شيتس',
      'google sheets',
      'sheets'
    ],
    catalogTools: ['Google Sheets']
  }
};

/**
 * Normalizes text by removing diacritics, unifying Arabic letter variants,
 * and stripping non-alphanumeric noise to ensure accurate keyword matching.
 */
export function normalizeQueryText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel
    .replace(/\u0640/g, '') // Remove tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[؟،؛!?:,.\-_()\[\]{}'\"/\\~`@#$%^&*+=<>|]/g, ' ') // Strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects matching platform keywords from a user query against the data-driven registry.
 */
export function matchPlatformsInQuery(rawQuery: string): string[] {
  const normalized = ` ${normalizeQueryText(rawQuery)} `;
  if (!normalized.trim()) return [];

  const matched = new Set<string>();

  for (const platform of Object.values(PLATFORM_REGISTRY)) {
    for (const synonym of platform.synonyms) {
      const normSynonym = normalizeQueryText(synonym);
      if (!normSynonym) continue;

      // Ensure whole-word or phrase matching surrounded by spaces
      if (normalized.includes(` ${normSynonym} `)) {
        matched.add(platform.id);
        break;
      }
    }
  }

  return Array.from(matched);
}

/**
 * Matches a user query against the catalog products using the platform registry.
 * - If a platform is matched AND products exist in the catalog -> returns found=true with those products.
 * - If no products match or platform has no products -> returns found=false with any matched platform IDs.
 */
export function matchCatalogProducts(
  query: string,
  catalog: Product[]
): PlatformMatchResult {
  const matchedPlatforms = matchPlatformsInQuery(query);

  if (matchedPlatforms.length === 0) {
    return {
      matchedPlatforms: [],
      products: [],
      found: false
    };
  }

  // Find all products in the catalog that belong to the matched platforms
  const targetTools = new Set<string>();
  for (const pid of matchedPlatforms) {
    const pDef = PLATFORM_REGISTRY[pid];
    if (pDef) {
      pDef.catalogTools.forEach(tool => targetTools.add(tool.toLowerCase()));
    }
  }

  const matchingProducts: Product[] = [];
  const seenIds = new Set<string>();

  for (const prod of catalog) {
    if (prod.status !== 'published' && prod.status !== 'coming_soon') {
      continue;
    }

    const prodTools = (prod.tools || []).map(t => t.toLowerCase());
    const prodName = `${prod.name_ar} ${prod.name_en}`.toLowerCase();
    const prodDesc = `${prod.short_ar || ''} ${prod.short_en || ''} ${prod.description_ar || ''}`.toLowerCase();

    // Check if product contains any of the matched platform tools or names
    const hasMatchingTool = prodTools.some(t => {
      for (const targetTool of targetTools) {
        if (t.includes(targetTool) || targetTool.includes(t)) {
          return true;
        }
      }
      return false;
    });

    const hasMatchingText = Array.from(targetTools).some(targetTool =>
      prodName.includes(targetTool) || prodDesc.includes(targetTool)
    );

    if ((hasMatchingTool || hasMatchingText) && !seenIds.has(prod.id)) {
      seenIds.add(prod.id);
      matchingProducts.push(prod);
    }
  }

  const found = matchingProducts.length > 0;

  return {
    matchedPlatforms,
    products: matchingProducts,
    found
  };
}
