import React from 'react';
import { Currency, Lang, Product, ProductRatingSummary } from '../types';
import { Translations } from '../i18n/ar';
import { formatEGPPrice, formatPrice, resolveProductPricing } from '../lib/utils';
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, Bell, Calendar, Star, Tag } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  currency: Currency;
  usdRate: number;
  lang: Lang;
  t: Translations;
  categoryName?: string;
  isSpotlight?: boolean;
  ratingSummary?: ProductRatingSummary;
  onOpenWaitlist?: (product: Product) => void;
}

const ProductCardComponent: React.FC<ProductCardProps> = ({
  product,
  currency,
  usdRate,
  lang,
  t,
  categoryName,
  isSpotlight = false,
  ratingSummary,
  onOpenWaitlist
}) => {
  const isRtl = lang === 'ar';
  const isComingSoon = product.status === 'coming_soon';
  const name = isRtl ? product.name_ar : product.name_en;
  const shortDesc = isRtl ? product.short_ar : product.short_en;
  const pricing = resolveProductPricing(product);
  const hasVerifiedRating = Boolean(ratingSummary && ratingSummary.totalReviews > 0);
  
  const levelText =
    product.level === 'beginner'
      ? (isRtl ? 'مبتدئ' : 'Beginner')
      : product.level === 'intermediate'
      ? (isRtl ? 'متوسط' : 'Intermediate')
      : (isRtl ? 'متقدم' : 'Advanced');

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const coverImageUrl = product.cover_path || product.diagram_path;

  const handleCardClick = (e: React.MouseEvent) => {
    if (isComingSoon && onOpenWaitlist) {
      e.preventDefault();
      onOpenWaitlist(product);
    }
  };

  // Render Spotlight Master Card layout when isSpotlight is true
  if (isSpotlight) {
    return (
      <a
        href={`/${lang}/products/${product.slug}`}
        onClick={handleCardClick}
        className="group bg-white rounded-3xl border border-slate-200 hover:border-[#2F6BFF] hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer block text-start font-cairo"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          
          {/* Visual Showcase Stage */}
          <div className="lg:col-span-7 bg-[#0B1F3A] relative min-h-[260px] lg:min-h-[360px] flex items-center justify-center overflow-hidden border-b lg:border-b-0 lg:border-e border-slate-100">
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt={name}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              />
            ) : (
              <div className="w-full h-full p-6 bg-gradient-to-br from-[#0B1F3A] via-[#122b50] to-[#1c3d6f] flex flex-col items-center justify-center text-white space-y-4">
                <div className="w-full max-w-sm p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#2F6BFF] text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs">
                        ⚡
                      </div>
                      <div>
                        <div className="font-mono text-xs font-bold text-white truncate max-w-[160px]">
                          {product.slug}
                        </div>
                        <div className="text-[10px] text-slate-300 font-mono">n8n Verified Workflow</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                      v1.0 Ready
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Overlays */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-slate-950/70 to-transparent pointer-events-none" />

            <div className="absolute top-4 start-4 flex flex-wrap items-center gap-2">
              {isComingSoon ? (
                <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5 animate-pulse">
                  <Bell className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'قريباً جداً' : 'Coming Soon'}</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-[#2F6BFF] text-white font-extrabold text-xs shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'المنتج المميز' : 'Featured Automation'}</span>
                </span>
              )}

              {pricing.hasDiscount && (
                <span className="px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs shadow-md flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{isRtl ? `خصم ${pricing.discountPercentage}%` : `${pricing.discountPercentage}% OFF`}</span>
                </span>
              )}

              {categoryName && (
                <span className="px-3 py-1 rounded-full bg-slate-900/80 text-white font-semibold text-xs backdrop-blur-md">
                  {categoryName}
                </span>
              )}
            </div>

            <div className="absolute top-4 end-4 px-3 py-1 rounded-full bg-slate-950/80 text-white font-mono text-xs font-semibold backdrop-blur-md border border-white/10">
              {levelText}
            </div>
          </div>

          {/* Details & Commercial Action */}
          <div className="lg:col-span-5 p-6 lg:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#2F6BFF] uppercase tracking-wider flex items-center gap-2">
                  <span>{isComingSoon ? (isRtl ? 'منتج قادم قريباً' : 'Upcoming System') : (isRtl ? 'نظام أتمتة جاهز للاستيراد' : 'Ready Automation System')}</span>
                  {isComingSoon && product.expected_launch_date && (
                    <span className="text-slate-500 font-mono text-[11px] font-normal flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-500" />
                      <span>{product.expected_launch_date}</span>
                    </span>
                  )}
                </div>

                {hasVerifiedRating && ratingSummary && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200/80 text-slate-800 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>{ratingSummary.averageRating.toFixed(1)}</span>
                    <span className="text-slate-400 text-[11px]">({ratingSummary.totalReviews})</span>
                  </div>
                )}
              </div>

              <h3 className="font-heading font-black text-xl lg:text-2xl text-slate-900 group-hover:text-[#2F6BFF] transition-colors leading-snug">
                <bdi dir="auto">{name}</bdi>
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed">
                <bdi dir="auto">{shortDesc}</bdi>
              </p>

              {/* Tools Tags */}
              {product.tools && product.tools.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">{isRtl ? 'الأدوات المدمجة:' : 'Integrated Tools:'}</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {product.tools.map((tool, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono font-medium border border-slate-200"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Price & Primary Action Box */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold">{t.priceOnce}</span>
                  {pricing.hasDiscount && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold">
                      {isRtl ? `خصم ${pricing.discountPercentage}%` : `${pricing.discountPercentage}% OFF`}
                    </span>
                  )}
                </div>

                {pricing.hasDiscount && (
                  <div dir="ltr" className="text-xs text-slate-400 line-through font-mono-code inline-block">
                    {formatPrice(pricing.originalPriceEgp, currency, lang, usdRate)}
                  </div>
                )}

                <div className="font-heading font-extrabold text-2xl text-slate-900 flex items-baseline gap-1">
                  {currency === 'EGP' ? (
                    <span dir="ltr" className="text-[#2F6BFF] font-mono-code">
                      {formatPrice(pricing.effectivePriceEgp, 'EGP', lang, usdRate)}
                    </span>
                  ) : (
                    <>
                      <span dir="ltr" className="text-[#2F6BFF] font-mono-code">
                        {formatPrice(pricing.effectivePriceEgp, 'USD', lang, usdRate)}
                      </span>
                      <span dir="ltr" className="text-xs text-slate-500 font-normal ms-1">
                        ({formatEGPPrice(pricing.effectivePriceEgp, lang)})
                      </span>
                    </>
                  )}
                </div>
              </div>

              {isComingSoon ? (
                <button
                  type="button"
                  onClick={handleCardClick}
                  className="h-12 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-sm font-extrabold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  <span>{isRtl ? 'تنبيهي عند الإطلاق' : 'Notify Me at Launch'}</span>
                </button>
              ) : (
                <div className="h-12 px-6 bg-[#2F6BFF] group-hover:bg-[#1a56e8] text-white rounded-xl text-sm font-extrabold transition-all shadow-md flex items-center justify-center gap-2">
                  <span>{t.viewDetails}</span>
                  <ArrowIcon className="w-4 h-4" />
                </div>
              )}
            </div>

          </div>

        </div>
      </a>
    );
  }

  // Standard Product Card layout
  return (
    <a
      href={`/${lang}/products/${product.slug}`}
      onClick={handleCardClick}
      className="group bg-white rounded-2xl border border-slate-200/90 hover:border-[#2F6BFF] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer block text-start font-cairo h-full"
    >
      <div>
        {/* Cover Image or Graphic Header */}
        <div className="relative w-full aspect-[16/9] bg-[#0B1F3A] overflow-hidden flex items-center justify-center border-b border-slate-100 shrink-0">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            />
          ) : (
            <div className="w-full h-full p-4 bg-gradient-to-br from-[#0B1F3A] via-[#122b50] to-[#1c3d6f] flex flex-col items-center justify-center text-white space-y-2">
              <div className="w-full max-w-xs flex items-center justify-between gap-2 p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#2F6BFF] text-white flex items-center justify-center font-mono font-bold text-xs shadow-2xs">
                    ⚡
                  </div>
                  <div className="text-start">
                    <div className="font-mono text-xs font-bold text-white truncate max-w-[130px]">
                      {product.slug}
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono">n8n Workflow</div>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>v1.0</span>
                </div>
              </div>
            </div>
          )}

          {/* Overlays */}
          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-slate-950/60 to-transparent pointer-events-none" />

          <div className="absolute top-2.5 start-2.5 flex flex-wrap items-center gap-1.5">
            {isComingSoon ? (
              <div className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] shadow-sm flex items-center gap-1">
                <Bell className="w-3 h-3" />
                <span>{isRtl ? 'قريباً' : 'Coming Soon'}</span>
              </div>
            ) : (
              categoryName && (
                <div className="px-2.5 py-1 rounded-full bg-[#2F6BFF]/90 text-white font-semibold text-[10px] backdrop-blur-md max-w-[130px] truncate">
                  {categoryName}
                </div>
              )
            )}

            {pricing.hasDiscount && (
              <div className="px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] shadow-sm flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>{isRtl ? `خصم ${pricing.discountPercentage}%` : `${pricing.discountPercentage}% OFF`}</span>
              </div>
            )}
          </div>

          <div className="absolute top-2.5 end-2.5 px-2.5 py-1 rounded-full bg-slate-950/80 text-white font-mono text-[10px] font-semibold backdrop-blur-md border border-white/10 max-w-[110px] truncate">
            {levelText}
          </div>
        </div>

        {/* Card Body Content */}
        <div className="p-4 sm:p-5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 group-hover:text-[#2F6BFF] transition-colors line-clamp-2 leading-snug">
              <bdi dir="auto">{name}</bdi>
            </h3>
            {hasVerifiedRating && ratingSummary && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200/80 text-slate-800 text-[11px] font-bold shrink-0">
                <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                <span>{ratingSummary.averageRating.toFixed(1)}</span>
                <span className="text-slate-400 text-[10px]">({ratingSummary.totalReviews})</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-600 line-clamp-2 sm:line-clamp-3 leading-relaxed">
            <bdi dir="auto">{shortDesc}</bdi>
          </p>

          {product.tools && product.tools.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {product.tools.slice(0, 4).map((tool, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-mono font-medium border border-slate-200/80"
                >
                  {tool}
                </span>
              ))}
              {product.tools.length > 4 && (
                <span className="text-[10px] text-slate-500 font-mono font-bold">
                  +{product.tools.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="p-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60 group-hover:bg-blue-50/20 transition-colors mt-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-medium">{t.priceOnce}</span>
            {pricing.hasDiscount && (
              <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold">
                {isRtl ? `خصم ${pricing.discountPercentage}%` : `${pricing.discountPercentage}% OFF`}
              </span>
            )}
          </div>

          {pricing.hasDiscount && (
            <div dir="ltr" className="text-[11px] text-slate-400 line-through font-mono-code inline-block">
              {formatPrice(pricing.originalPriceEgp, currency, lang, usdRate)}
            </div>
          )}

          <div className="font-heading font-extrabold text-base sm:text-lg text-slate-900 flex items-baseline gap-1">
            {currency === 'EGP' ? (
              <span dir="ltr" className="text-[#2F6BFF] font-mono-code">
                {formatPrice(pricing.effectivePriceEgp, 'EGP', lang, usdRate)}
              </span>
            ) : (
              <>
                <span dir="ltr" className="text-[#2F6BFF] font-mono-code">
                  {formatPrice(pricing.effectivePriceEgp, 'USD', lang, usdRate)}
                </span>
                <span dir="ltr" className="text-[10px] text-slate-500 font-normal ms-1">
                  ({formatEGPPrice(pricing.effectivePriceEgp, lang)})
                </span>
              </>
            )}
          </div>
        </div>

        {isComingSoon ? (
          <button
            type="button"
            onClick={handleCardClick}
            className="px-3.5 py-2 min-h-[40px] bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{isRtl ? 'تنبيهي عند الإطلاق' : 'Notify Me'}</span>
          </button>
        ) : (
          <div className="px-3.5 py-2 min-h-[40px] bg-[#2F6BFF] group-hover:bg-[#1a56e8] text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5">
            <span>{t.viewDetails}</span>
            <ArrowIcon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </a>
  );
};

export const ProductCard = React.memo(ProductCardComponent);

