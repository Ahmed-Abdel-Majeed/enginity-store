import type {
  Currency,
  Lang,
  Product,
  ProductRatingSummary,
  ProductReview,
} from '../types';

export function cn(...inputs: Array<string | undefined | null | false>): string {
  return inputs.filter(Boolean).join(' ');
}

export interface ResolvedProductPricing {
  effectivePriceEgp: number;
  currentPriceEgp: number;
  originalPriceEgp: number;
  salePriceEgp: number | null;
  discountAmountEgp: number;
  discountPercentage: number;
  hasDiscount: boolean;
}

export function calculateDiscountPercentage(
  originalPriceEgp?: number | null,
  salePriceEgp?: number | null
): number {
  const orig = Number(originalPriceEgp);
  const sale = Number(salePriceEgp);
  if (
    !Number.isFinite(orig) ||
    !Number.isFinite(sale) ||
    orig <= 0 ||
    sale <= 0 ||
    sale >= orig
  ) {
    return 0;
  }
  return Math.round(((orig - sale) / orig) * 100);
}

export interface ValidatePricingInputObject {
  originalPriceEgp?: number | string | null;
  salePriceEgp?: number | string | null;
  hasDiscount?: boolean;
  discountEnabled?: boolean;
}

export function validateProductPricing(
  originalOrInput?: number | string | null | ValidatePricingInputObject,
  salePriceArg?: number | string | null
): {
  valid: boolean;
  errorAr?: string;
  errorEn?: string;
  discountPercentage: number;
  effectivePriceEgp: number;
  normalized: {
    price_egp: number;
    original_price_egp: number;
    sale_price_egp: number | null;
    discount_percentage: number;
  };
} {
  let rawOrig: number | string | null | undefined;
  let rawSale: number | string | null | undefined;
  let discountFlag: boolean | undefined;

  if (originalOrInput && typeof originalOrInput === 'object') {
    rawOrig = originalOrInput.originalPriceEgp;
    rawSale = originalOrInput.salePriceEgp;
    discountFlag =
      originalOrInput.discountEnabled !== undefined
        ? originalOrInput.discountEnabled
        : originalOrInput.hasDiscount;
  } else {
    rawOrig = originalOrInput;
    rawSale = salePriceArg;
  }

  const orig = Number(rawOrig);
  if (!Number.isFinite(orig) || orig <= 0) {
    return {
      valid: false,
      errorAr: 'يجب أن يكون السعر الأصلي رقماً موجباً أكبر من صفر.',
      errorEn: 'Original price must be a positive number greater than zero.',
      discountPercentage: 0,
      effectivePriceEgp: 0,
      normalized: {
        price_egp: 0,
        original_price_egp: 0,
        sale_price_egp: null,
        discount_percentage: 0,
      },
    };
  }

  const isDiscountDisabled =
    discountFlag === false ||
    rawSale === null ||
    rawSale === undefined ||
    String(rawSale).trim() === '';

  if (isDiscountDisabled) {
    return {
      valid: true,
      discountPercentage: 0,
      effectivePriceEgp: orig,
      normalized: {
        price_egp: orig,
        original_price_egp: orig,
        sale_price_egp: null,
        discount_percentage: 0,
      },
    };
  }

  const sale = Number(rawSale);
  if (!Number.isFinite(sale) || sale <= 0) {
    return {
      valid: false,
      errorAr: 'يجب أن يكون سعر الخصم رقماً موجباً أكبر من صفر.',
      errorEn: 'Discounted price must be a positive number greater than zero.',
      discountPercentage: 0,
      effectivePriceEgp: orig,
      normalized: {
        price_egp: orig,
        original_price_egp: orig,
        sale_price_egp: null,
        discount_percentage: 0,
      },
    };
  }

  if (sale >= orig) {
    return {
      valid: false,
      errorAr: 'يجب أن يكون سعر الخصم أقل من السعر الأصلي.',
      errorEn: 'Discounted price must be strictly less than the original price.',
      discountPercentage: 0,
      effectivePriceEgp: orig,
      normalized: {
        price_egp: orig,
        original_price_egp: orig,
        sale_price_egp: null,
        discount_percentage: 0,
      },
    };
  }

  const discountPercentage = calculateDiscountPercentage(orig, sale);

  return {
    valid: true,
    discountPercentage,
    effectivePriceEgp: sale,
    normalized: {
      price_egp: sale,
      original_price_egp: orig,
      sale_price_egp: sale,
      discount_percentage: discountPercentage,
    },
  };
}

/**
 * Canonical pricing resolver (TASK-004):
 * Computes effective EGP price, original price, sale price, discount amount,
 * and rounded integer discount percentage from a single source of truth.
 */
export function getEffectiveProductPricing(
  product: Pick<Product, 'price_egp' | 'original_price_egp' | 'sale_price_egp'>
): ResolvedProductPricing {
  const rawPrice = Number(product.price_egp);
  const fallbackBase = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;

  const rawOriginal =
    product.original_price_egp !== null && product.original_price_egp !== undefined
      ? Number(product.original_price_egp)
      : fallbackBase;

  const originalPriceEgp =
    Number.isFinite(rawOriginal) && rawOriginal > 0 ? rawOriginal : fallbackBase;

  const rawSale =
    product.sale_price_egp !== null && product.sale_price_egp !== undefined
      ? Number(product.sale_price_egp)
      : null;

  const hasDiscount =
    rawSale !== null &&
    Number.isFinite(rawSale) &&
    rawSale > 0 &&
    originalPriceEgp > 0 &&
    rawSale < originalPriceEgp;

  const salePriceEgp = hasDiscount ? rawSale : null;
  const effectivePriceEgp = hasDiscount && salePriceEgp !== null ? salePriceEgp : originalPriceEgp;
  const discountAmountEgp =
    hasDiscount && salePriceEgp !== null
      ? Math.max(0, Number((originalPriceEgp - salePriceEgp).toFixed(2)))
      : 0;
  const discountPercentage =
    hasDiscount && salePriceEgp !== null
      ? calculateDiscountPercentage(originalPriceEgp, salePriceEgp)
      : 0;

  return {
    effectivePriceEgp,
    currentPriceEgp: effectivePriceEgp,
    originalPriceEgp,
    salePriceEgp,
    discountAmountEgp,
    discountPercentage,
    hasDiscount,
  };
}

export function resolveProductPricing(
  product: Pick<Product, 'price_egp' | 'original_price_egp' | 'sale_price_egp'>
): ResolvedProductPricing {
  return getEffectiveProductPricing(product);
}

export function computeProductRatingSummary(
  productIdOrReviews: string | Array<Pick<ProductReview, 'rating'> & { product_id?: string; status?: string }>,
  maybeReviews?: Array<Pick<ProductReview, 'rating'> & { product_id?: string; status?: string }>
): ProductRatingSummary {
  const productId = typeof productIdOrReviews === 'string' ? productIdOrReviews : '';
  const reviewsList = Array.isArray(productIdOrReviews)
    ? productIdOrReviews
    : Array.isArray(maybeReviews)
    ? maybeReviews
    : [];

  const approved = reviewsList.filter(
    (r) =>
      (!productId || !r.product_id || r.product_id === productId) &&
      (!r.status || r.status === 'approved') &&
      Number.isFinite(Number(r.rating)) &&
      Number(r.rating) >= 1 &&
      Number(r.rating) <= 5
  );

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  let sum = 0;
  for (const r of approved) {
    const star = Math.min(5, Math.max(1, Math.round(Number(r.rating)))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += 1;
    sum += Number(r.rating);
  }

  const totalReviews = approved.length;
  const averageRating = totalReviews > 0 ? Number((sum / totalReviews).toFixed(1)) : 0;

  return {
    productId,
    product_id: productId,
    averageRating,
    average_rating: averageRating,
    totalReviews,
    total_reviews: totalReviews,
    distribution,
  };
}

/**
 * Centralized currency formatter (TASK-012):
 * - EGP is the canonical billing currency.
 * - USD is displayed as an approximate converted amount prefixed with `~` (e.g., `~$10 USD`).
 */
export function formatPrice(
  priceEgp: number,
  currency: Currency,
  lang: Lang = 'ar',
  usdRate: number = 50
): string {
  const safeAmount = Number.isFinite(Number(priceEgp)) ? Number(priceEgp) : 0;
  const safeRate = Number.isFinite(Number(usdRate)) && Number(usdRate) > 0 ? Number(usdRate) : 50;

  if (currency === 'USD') {
    const usdAmount = Math.ceil(safeAmount / safeRate);
    return `~$${usdAmount.toLocaleString('en-US')} USD`;
  }

  return formatEGPPrice(safeAmount, lang);
}

export function formatEGPPrice(priceEgp: number, lang: Lang = 'ar'): string {
  const safeAmount = Number.isFinite(Number(priceEgp)) ? Number(priceEgp) : 0;
  return lang === 'ar'
    ? `${safeAmount.toLocaleString('ar-EG')} ج.م`
    : `${safeAmount.toLocaleString('en-US')} EGP`;
}

export function formatUSDPrice(priceEgp: number, usdRate: number = 50): string {
  const safeAmount = Number.isFinite(Number(priceEgp)) ? Number(priceEgp) : 0;
  const safeRate = Number.isFinite(Number(usdRate)) && Number(usdRate) > 0 ? Number(usdRate) : 50;
  const usdValue = Math.ceil(safeAmount / safeRate);
  return `≈ $${usdValue}`;
}

export function formatExactEgpCharge(priceEgp: number, lang: Lang = 'ar'): string {
  return formatEGPPrice(priceEgp, lang);
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateXPayUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;

    const allowedHostsEnv =
      typeof process !== 'undefined' && process.env?.XPAY_ALLOWED_HOSTS
        ? process.env.XPAY_ALLOWED_HOSTS
        : '';

    if (allowedHostsEnv.trim()) {
      const allowedList = allowedHostsEnv
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
      return allowedList.includes(parsed.hostname.toLowerCase());
    }

    return true;
  } catch {
    return false;
  }
}

export function isAllowedImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'i.ibb.co') return true;
    if (
      host.endsWith('.supabase.co') &&
      parsed.pathname.includes('/storage/v1/object/public/')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    let videoId: string | null = null;

    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/watch')) {
        videoId = parsed.searchParams.get('v');
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/embed/')[1]?.split('/')[0] || null;
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/shorts/')[1]?.split('/')[0] || null;
      }
    } else if (parsed.hostname.includes('youtu.be')) {
      videoId = parsed.pathname.slice(1).split('/')[0] || null;
    }

    if (videoId && /^[a-zA-Z0-9_-]{6,15}$/.test(videoId)) {
      return `https://www.youtube-nocookie.com/embed/${videoId}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function getWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
