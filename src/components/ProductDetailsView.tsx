import React, { useState } from 'react';
import { Currency, Lang, Product, StoreSettings } from '../types';
import { Translations } from '../i18n/ar';
import { validateXPayUrl, getYouTubeEmbedUrl, formatEGPPrice, formatUSDPrice } from '../lib/utils';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Lock,
  Zap,
  ArrowRight,
  ArrowLeft,
  Maximize2,
  AlertTriangle,
  Play,
  Info,
  Layers,
  ListOrdered,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ImageIcon,
  FileCheck,
  ShieldCheck,
  Wrench,
  Bell,
  Calendar
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

interface ProductDetailsViewProps {
  product: Product;
  relatedProducts: Product[];
  settings: StoreSettings;
  currency: Currency;
  lang: Lang;
  t: Translations;
  categoryName?: string;
  onOpenWaitlist?: (product: Product) => void;
}

export const ProductDetailsView: React.FC<ProductDetailsViewProps> = ({
  product,
  relatedProducts,
  settings,
  currency,
  lang,
  t,
  categoryName,
  onOpenWaitlist
}) => {
  const isRtl = lang === 'ar';
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [showDiagramModal, setShowDiagramModal] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [coverImgError, setCoverImgError] = useState(false);
  const [diagramImgError, setDiagramImgError] = useState(false);

  const isCheckoutLinkValid = validateXPayUrl(product.xpay_url || '');
  const name = isRtl ? product.name_ar : product.name_en;
  const shortDesc = isRtl ? product.short_ar : product.short_en;
  const description = isRtl ? product.description_ar : product.description_en;
  const includes = isRtl ? product.includes_ar : product.includes_en;
  const requirements = isRtl ? product.requirements_ar : product.requirements_en;
  const steps = isRtl ? product.steps_ar : product.steps_en;

  const buyNoticeText = isRtl
    ? (settings.buy_notice_ar || 'سيتم توجيهك لرابط الدفع السريع والآمن لإتمام الطلب واستلام الـ Workflow فوراً.')
    : (settings.buy_notice_en || 'You will be redirected to a secure payment page to complete your order and receive the workflow immediately.');

  const levelText =
    product.level === 'beginner'
      ? (isRtl ? 'مبتدئ' : 'Beginner')
      : product.level === 'intermediate'
      ? (isRtl ? 'متوسط' : 'Intermediate')
      : (isRtl ? 'متقدم' : 'Advanced');

  const youtubeEmbed = getYouTubeEmbedUrl(product.video_url || '');
  const diagramImageUrl = product.diagram_path;
  const coverImageUrl = product.cover_path;
  const primaryMediaUrl = (coverImageUrl && !coverImgError) ? product.cover_path : product.diagram_path;

  // JSON-LD Product Schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: name,
    description: shortDesc,
    category: categoryName,
    image: [coverImageUrl, diagramImageUrl].filter(Boolean),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EGP',
      price: product.price_egp,
      availability: 'https://schema.org/InStock',
      url: `${process.env.APP_URL || ''}/${lang}/products/${product.slug}`
    }
  };

  const openLightbox = () => {
    setLightboxZoom(1);
    setShowDiagramModal(true);
  };

  return (
    <div className="pt-6 pb-24 sm:pt-8 sm:pb-16 bg-[#FAFAFA] min-h-screen font-cairo">
      
      {/* Inject JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* 1. Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <a href={`/${lang}`} className="hover:text-[#2F6BFF] transition-colors">
            {t.breadcrumbHome}
          </a>
          <span>/</span>
          <a href={`/${lang}#products`} className="hover:text-[#2F6BFF] transition-colors">
            {t.breadcrumbProducts}
          </a>
          <span>/</span>
          <span className="text-slate-900 font-semibold truncate max-w-xs">
            <bdi dir="auto">{name}</bdi>
          </span>
        </nav>

        {/* Product Headline & Meta Banner */}
        <div className="space-y-3 text-start">
          <div className="flex flex-wrap items-center gap-2">
            {categoryName && (
              <span className="px-3 py-1 rounded-full bg-blue-100 text-[#2F6BFF] font-extrabold text-xs">
                {categoryName}
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-800 font-mono text-xs font-semibold">
              n8n {levelText}
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono text-xs font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>⏱️ 15 دقيقة إعداد</span>
            </span>
          </div>

          <h1 className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-slate-900 leading-snug">
            <bdi dir="auto">{name}</bdi>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
            <bdi dir="auto">{shortDesc}</bdi>
          </p>
        </div>

        {/* 2. Top 2-Column Grid: Primary Stage & Sticky Buy Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Content Column */}
          <div className="lg:col-span-7 space-y-8 text-start">
            
            {/* Single Primary Media Stage (Prevents Identical Duplicate Previews) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-bold text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2F6BFF]" />
                  <span>معاينة الـ Workflow والمخطط</span>
                </div>
                {(diagramImageUrl || coverImageUrl) && (
                  <button
                    onClick={openLightbox}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2F6BFF] text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>تكبير الشاشة</span>
                  </button>
                )}
              </div>

              <div
                className="relative aspect-[16/9] w-full bg-[#0B1F3A] rounded-xl overflow-hidden group cursor-zoom-in flex items-center justify-center border border-slate-800"
                onClick={openLightbox}
              >
                {primaryMediaUrl ? (
                  <img
                    src={primaryMediaUrl}
                    alt={name}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setCoverImgError(true)}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="p-6 text-center text-white space-y-2">
                    <div className="font-mono text-sm font-bold">{product.slug}_schema.json</div>
                    <div className="text-xs text-slate-400">انقر لتكبير وتصفح مخطط العقد والمسارات</div>
                  </div>
                )}

                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="px-4 py-2 bg-[#2F6BFF] text-white text-xs font-extrabold rounded-xl shadow-lg flex items-center gap-2">
                    <Maximize2 className="w-4 h-4" />
                    <span>انقر لتكبير الشاشة بالتفصيل</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Comprehensive Explanation & Feature Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-4 shadow-2xs">
              <h2 className="font-heading font-black text-xl text-slate-900 border-b border-slate-100 pb-3">
                تفاصيل الشرح والخصائص
              </h2>
              <div className="prose prose-slate max-w-none text-base leading-[1.8] text-slate-700">
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                  {description}
                </ReactMarkdown>
              </div>
            </div>

          </div>

          {/* Sticky Commercial Purchase Sidebar */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-md space-y-6 sticky top-24 text-start">
            
            <div className="space-y-2 border-b border-slate-100 pb-5">
              <div className="text-xs text-slate-500 font-semibold">{t.priceOnce}</div>
              
              <div className="flex items-baseline gap-2">
                <span className="font-heading font-black text-3xl sm:text-4xl text-[#2F6BFF]">
                  {formatEGPPrice(product.price_egp)} {t.egpUnit}
                </span>
                
                {currency === 'USD' && (
                  <span className="font-mono text-base text-slate-500 font-semibold">
                    ({formatUSDPrice(product.price_egp, settings.usd_rate)})
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-500 font-medium">
                {t.usdNote}
              </div>
            </div>

            {/* Buy Notice Alert */}
            {(settings.buy_notice_enabled ?? true) && buyNoticeText && (
              <div className="p-4 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-start gap-3 text-blue-900 text-xs leading-relaxed shadow-2xs">
                <Info className="w-4.5 h-4.5 text-[#2F6BFF] shrink-0 mt-0.5" />
                <span>{buyNoticeText}</span>
              </div>
            )}

            {/* Primary Buy or Waitlist Action */}
            <div>
              {product.status === 'coming_soon' ? (
                product.waitlist_enabled !== false ? (
                  <button
                    type="button"
                    onClick={() => onOpenWaitlist && onOpenWaitlist(product)}
                    className="w-full py-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-xl font-extrabold text-base transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer"
                  >
                    <Bell className="w-5 h-5" />
                    <span>{isRtl ? 'تنبيهي عند الإطلاق' : 'Notify Me at Launch'}</span>
                  </button>
                ) : (
                  <div className="w-full py-3.5 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs text-center border border-slate-200">
                    {isRtl ? 'تسجيل قائمة الانتظار مغلق حالياً لربط النظام' : 'Waitlist registration is currently closed'}
                  </div>
                )
              ) : isCheckoutLinkValid ? (
                <a
                  href={product.xpay_url || '#'}
                  target="_self"
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-[#2F6BFF] hover:bg-[#1a56e8] text-white rounded-xl font-extrabold text-base transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer"
                >
                  <span>{t.buyNow}</span>
                  <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
                </a>
              ) : (
                <button
                  disabled
                  className="w-full py-4 bg-slate-200 text-slate-500 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-slate-300"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {isRtl
                      ? 'رابط الشراء لهذا المنتج غير متاح حالياً'
                      : 'Purchase link currently unavailable'}
                  </span>
                </button>
              )}
            </div>

            {/* Deliverables Included Summary */}
            {includes.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="font-bold text-slate-800">{t.whatYouGetTitle}:</div>
                <ul className="space-y-1.5 text-slate-600 font-medium">
                  {includes.slice(0, 4).map((inc, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate"><bdi dir="auto">{inc}</bdi></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trust Badges */}
            <div className="space-y-3 text-xs text-slate-600 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded bg-amber-100 text-amber-700">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-800">تسليم فوري ومباشر بعد الدفع</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded bg-emerald-100 text-emerald-700">
                  <Lock className="w-4 h-4" />
                </div>
                <span className="font-semibold text-slate-800">دفع آمن ومشفر 100% عبر بوابات معتمدة</span>
              </div>
            </div>

          </div>

        </div>

        {/* 3. Full-Width Interactive Workflow Schematic Card */}
        {product.diagram_path && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6 text-start shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 flex items-center gap-2">
                  <Layers className="w-6 h-6 text-[#2F6BFF]" />
                  <span>مخطط الـ Workflow الكامل</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  تفحص هيكلية العقد، الربط والمسارات البرمجية في هذا الـ Workflow بدقة عالية
                </p>
              </div>

              <button
                onClick={openLightbox}
                className="px-4 py-2.5 bg-[#0B1F3A] hover:bg-[#16355e] text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                <Maximize2 className="w-4 h-4" />
                <span>تكبير المخطط للشاشة كاملة</span>
              </button>
            </div>

            {/* High Definition Zoomable Diagram Canvas */}
            <div
              className="relative bg-[#0B1F3A] rounded-2xl overflow-hidden p-4 sm:p-6 border border-slate-800 cursor-zoom-in group flex items-center justify-center min-h-[350px] shadow-xl"
              onClick={openLightbox}
            >
              <img
                src={product.diagram_path}
                alt={`مخطط workflow - ${name}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-auto max-h-[680px] object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01]"
              />
              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="px-5 py-2.5 bg-[#2F6BFF] text-white text-xs font-extrabold rounded-xl shadow-xl flex items-center gap-2">
                  <Maximize2 className="w-4 h-4" />
                  <span>انقر لتكبير المخطط والتنقل فيه</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Delivered Files & Deliverables List */}
        {includes.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6 text-start shadow-2xs">
            <div className="space-y-1">
              <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900">
                {t.whatYouGetTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                {t.whatYouGetSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {includes.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3.5"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-sm text-slate-800">
                    <bdi dir="auto">{item}</bdi>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Prerequisites & Compatibility Checklist */}
        {requirements.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6 text-start shadow-2xs">
            <div className="space-y-1">
              <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900">
                {t.requirementsTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                {t.requirementsSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {requirements.map((req, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1"
                >
                  <div className="font-bold text-sm text-slate-900">
                    <bdi dir="auto">{req.name}</bdi>
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed">
                    <bdi dir="auto">{req.desc}</bdi>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Step-by-Step Execution Workflow Steps */}
        {steps.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6 text-start shadow-2xs">
            <div className="space-y-1">
              <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900">
                {t.workflowStepsTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                {t.workflowStepsSubtitle}
              </p>
            </div>

            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-4 sm:p-5 bg-slate-50 rounded-xl border border-slate-200/90 flex items-start gap-4"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#0B1F3A] text-white font-mono font-bold text-sm flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-sm sm:text-base text-slate-900">
                      <bdi dir="auto">{step.title}</bdi>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      <bdi dir="auto">{step.text}</bdi>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Video Import & Setup Tutorial */}
        {youtubeEmbed && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6 text-start shadow-2xs">
            <div className="space-y-1">
              <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900">
                {t.videoDemoTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                {t.videoDemoSubtitle}
              </p>
            </div>

            <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-lg">
              <iframe
                src={youtubeEmbed}
                title={name}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* 8. Product FAQs */}
        {product.faq && product.faq.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6 text-start shadow-2xs">
            <div className="space-y-1">
              <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900">
                {t.productFaqTitle}
              </h2>
            </div>

            <div className="space-y-3">
              {product.faq.map((faq, idx) => {
                const q = isRtl ? faq.q_ar : faq.q_en;
                const a = isRtl ? faq.a_ar : faq.a_en;
                const isOpen = openFaqIdx === idx;

                return (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      className="w-full p-4 flex items-center justify-between text-start hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="font-bold text-sm text-slate-900">
                        <bdi dir="auto">{q}</bdi>
                      </span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-[#2F6BFF]" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isOpen && (
                      <div className="p-4 pt-1 text-xs sm:text-sm text-slate-600 border-t border-slate-100 bg-slate-50/50 leading-relaxed">
                        <bdi dir="auto">{a}</bdi>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 9. Related Automations Grid */}
        {relatedProducts.length > 0 && (
          <div className="space-y-6 text-start pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-extrabold text-2xl text-slate-900">
                {t.relatedProductsTitle}
              </h2>
              <a href={`/${lang}#products`} className="text-xs font-bold text-[#2F6BFF] hover:underline">
                {t.viewAll} ↗
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedProducts.slice(0, 3).map(rel => (
                <a
                  key={rel.id}
                  href={`/${lang}/products/${rel.slug}`}
                  className="p-5 bg-white rounded-xl border border-slate-200 hover:border-[#2F6BFF] hover:shadow-md transition-all space-y-2 block"
                >
                  <div className="font-bold text-sm text-slate-900 line-clamp-1">
                    <bdi dir="auto">{isRtl ? rel.name_ar : rel.name_en}</bdi>
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-2">
                    <bdi dir="auto">{isRtl ? rel.short_ar : rel.short_en}</bdi>
                  </div>
                  <div className="pt-2 font-heading font-bold text-sm text-[#2F6BFF]">
                    {formatEGPPrice(rel.price_egp)} {t.egpUnit}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Mobile Sticky Bottom Buy Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3.5 sm:hidden shadow-2xl flex items-center justify-between gap-3 font-cairo">
        <div>
          <div className="text-[10px] text-slate-500 font-medium">{t.priceOnce}</div>
          <div className="font-heading font-extrabold text-base text-slate-900 leading-tight">
            {formatEGPPrice(product.price_egp)} {t.egpUnit}
          </div>
        </div>

        {product.status === 'coming_soon' ? (
          product.waitlist_enabled !== false ? (
            <button
              type="button"
              onClick={() => onOpenWaitlist && onOpenWaitlist(product)}
              className="px-5 py-2.5 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span>{isRtl ? 'تنبيهي عند الإطلاق' : 'Notify Me'}</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-medium px-3 py-2 bg-slate-100 rounded-lg">قريباً</span>
          )
        ) : isCheckoutLinkValid ? (
          <a
            href={product.xpay_url || '#'}
            target="_self"
            rel="noopener noreferrer"
            className="px-5 py-2.5 min-h-[44px] bg-[#2F6BFF] hover:bg-[#1a56e8] active:bg-[#1546c2] text-white rounded-xl font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>{t.buyNow}</span>
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
          </a>
        ) : (
          <span className="text-xs text-slate-400 font-medium px-3 py-2 bg-slate-100 rounded-lg">غير متاح</span>
        )}
      </div>

      {/* Interactive Lightbox Modal with Full Zoom Controls */}
      {showDiagramModal && (diagramImageUrl || coverImageUrl) && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 cursor-zoom-out font-cairo"
          onClick={() => setShowDiagramModal(false)}
        >
          <div
            className="bg-slate-900 rounded-2xl max-w-6xl w-full p-4 sm:p-6 space-y-4 max-h-[94vh] flex flex-col border border-slate-800 shadow-2xl cursor-default"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
              <h3 className="font-heading font-bold text-xs sm:text-base text-white truncate max-w-full sm:max-w-md">
                <bdi dir="auto">{name} - مخطط الـ Workflow الكامل</bdi>
              </h3>

              <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => setLightboxZoom(prev => Math.max(0.6, prev - 0.2))}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  title="تصغير"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <span className="font-mono text-xs text-slate-300 font-semibold w-12 text-center shrink-0">
                  {Math.round(lightboxZoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => setLightboxZoom(prev => Math.min(3, prev + 0.2))}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  title="تكبير"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setLightboxZoom(1)}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  title="إعادة الضبط"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowDiagramModal(false)}
                  className="w-10 h-10 rounded-xl bg-red-900/80 hover:bg-red-800 active:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer ms-1.5 flex items-center justify-center shrink-0"
                  title="إغلاق"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scalable Viewport */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950 rounded-xl border border-slate-800 min-h-[350px]">
              <img
                src={diagramImageUrl || coverImageUrl || ''}
                alt={name}
                style={{ transform: `scale(${lightboxZoom})`, transformOrigin: 'center center' }}
                className="max-w-full h-auto max-h-[75vh] object-contain rounded-lg transition-transform duration-200 ease-out"
              />
            </div>

            <div className="text-center text-[11px] text-slate-400 font-mono">
              استخدم أزرار التكبير فوق لتفحص أدق تفاصيل العقد والبيانات في الـ Workflow.
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
