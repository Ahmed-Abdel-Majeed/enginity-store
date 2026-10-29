import slugify from 'slugify';

/**
 * Validates whether a direct image URL is allowed and secure:
 * - Must use https
 * - Host must belong to allowed domains: 'i.ibb.co' or Supabase storage host (*.supabase.co)
 * - Explicitly rejects Google Drive / Dropbox / HTML viewer page links (e.g., ibb.co without i.ibb.co)
 */
export function isAllowedImageUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const trimmed = urlStr.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('data:image/')) return true;
    if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/public/uploads/')) return true;

    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();

    // Reject HTML viewer pages or file storage redirectors
    if (
      hostname === 'ibb.co' ||
      (hostname.includes('imgbb.com') && !hostname.startsWith('i.') && !hostname.startsWith('api.')) ||
      hostname.includes('drive.google.com') ||
      hostname.includes('dropbox.com') ||
      hostname.includes('photos.app.goo.gl')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates whether an XPay URL is secure (https).
 * XPAY_ALLOWED_HOSTS is optional:
 * - If empty/unset, accepts ANY valid https URL.
 * - If set, requires the hostname to match one of the comma-separated allowed hosts.
 */
export function validateXPayUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol !== 'https:') return false;

    const allowedHostsEnv = process.env.XPAY_ALLOWED_HOSTS || process.env.VITE_XPAY_ALLOWED_HOSTS || '';
    if (!allowedHostsEnv.trim()) {
      return true;
    }

    const allowedHosts = allowedHostsEnv.split(',').map(h => {
      let raw = h.trim().toLowerCase();
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        try {
          return new URL(raw).hostname.toLowerCase();
        } catch {
          // fallback
        }
      }
      return raw.replace(/^https?:\/\//, '').split('/')[0];
    }).filter(Boolean);

    if (allowedHosts.length === 0) return true;

    const hostname = parsed.hostname.toLowerCase();
    return allowedHosts.some(host => hostname === host || hostname.endsWith(`.${host}`) || host.endsWith(`.${hostname}`));
  } catch {
    return false;
  }
}

/**
 * Converts any YouTube video URL format (watch, shorts, embed, youtu.be) to privacy-friendly youtube-nocookie.com embed URL
 * Automatically strips tracking parameters (e.g. ?si=...)
 */
export function getYouTubeEmbedUrl(urlStr: string): string | null {
  if (!urlStr || typeof urlStr !== 'string') return null;
  try {
    let videoId: string | null = null;
    const parsed = new URL(urlStr.trim());
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.includes('youtu.be')) {
      videoId = parsed.pathname.slice(1);
    } else if (hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/shorts/')[1];
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/embed/')[1];
      } else if (parsed.pathname.includes('/watch')) {
        videoId = parsed.searchParams.get('v');
      }
    }

    if (videoId) {
      // Strip any query parameters or trailing paths attached to videoId
      const cleanId = videoId.split('/')[0].split('?')[0].split('&')[0].trim();
      if (cleanId) {
        return `https://www.youtube-nocookie.com/embed/${cleanId}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Converts price in EGP to rounded whole dollar USD based on usd_rate
 */
export function formatUSDPrice(priceEgp: number, usdRate: number): string {
  if (!usdRate || usdRate <= 0) return '$0';
  const usd = Math.ceil(priceEgp / usdRate);
  return `≈ $${usd}`;
}

/**
 * Generates URL-friendly slug from name
 */
export function generateSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true,
    trim: true
  }) || `product-${Date.now()}`;
}

/**
 * Formats EGP number cleanly
 */
export function formatEGPPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2
  }).format(price);
}

/**
 * Normalizes free-text or localized launch date into valid PostgreSQL DATE format (YYYY-MM-DD) or null
 */
export function normalizeDateToIso(val: string | null | undefined): string | null {
  if (!val || typeof val !== 'string' || !val.trim()) return null;
  const trimmed = val.trim();

  // YYYY-MM-DD check
  const matchIso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (matchIso) {
    const y = matchIso[1];
    const m = matchIso[2].padStart(2, '0');
    const day = matchIso[3].padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // DD/MM/YYYY check
  const matchEuro = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (matchEuro) {
    const day = matchEuro[1].padStart(2, '0');
    const m = matchEuro[2].padStart(2, '0');
    const y = matchEuro[3];
    return `${y}-${m}-${day}`;
  }

  // Standard JS Date parse check
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  // Year check (e.g. 2026) + month detection
  const matchYear = trimmed.match(/(20\d\d)/);
  if (matchYear) {
    const y = matchYear[1];
    let m = '01';
    if (trimmed.includes('يناير') || trimmed.includes('jan')) m = '01';
    else if (trimmed.includes('فبراير') || trimmed.includes('feb')) m = '02';
    else if (trimmed.includes('مارس') || trimmed.includes('mar')) m = '03';
    else if (trimmed.includes('أبريل') || trimmed.includes('ابريل') || trimmed.includes('apr')) m = '04';
    else if (trimmed.includes('مايو') || trimmed.includes('may')) m = '05';
    else if (trimmed.includes('يونيو') || trimmed.includes('jun')) m = '06';
    else if (trimmed.includes('يوليو') || trimmed.includes('jul')) m = '07';
    else if (trimmed.includes('أغسطس') || trimmed.includes('اغسطس') || trimmed.includes('aug')) m = '08';
    else if (trimmed.includes('سبتمبر') || trimmed.includes('sep')) m = '09';
    else if (trimmed.includes('أكتوبر') || trimmed.includes('اكتوبر') || trimmed.includes('oct')) m = '10';
    return `${y}-${m}-01`;
  }

  return null;
}

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('01') && cleaned.length === 11) {
      cleaned = '+20' + cleaned.slice(1);
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}
