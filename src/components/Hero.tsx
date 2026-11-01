import React, { useState, useEffect, useRef } from 'react';
import { Translations } from '../i18n/ar';
import { Lang } from '../types';
import {
  Zap,
  ShieldCheck,
  Wrench,
  ArrowDown,
  HelpCircle,
  CheckCircle2,
  Cpu,
  Bot,
  Lightbulb,
  Sun,
  Moon
} from 'lucide-react';

interface HeroProps {
  t: Translations;
  lang: Lang;
  onOpenAssistant?: () => void;
  onOpenCustomRequest?: () => void;
  onOpenProductSuggestion?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  t,
  lang,
  onOpenAssistant,
  onOpenCustomRequest,
  onOpenProductSuggestion
}) => {
  const isRtl = lang === 'ar';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Active hero video mode: defaults to 'light' mode as requested, with dark mode toggle available
  const [heroTheme, setHeroTheme] = useState<'light' | 'dark'>('light');
  const isLight = heroTheme === 'light';

  // Dynamic asset paths according to selected theme
  const desktopWebm = isLight
    ? '/assets/hero/hero_light_desktop.webm'
    : '/assets/hero/hero_desktop.webm';
  const desktopMp4 = isLight
    ? '/assets/hero/hero_light_desktop.mp4'
    : '/assets/hero/hero_desktop.mp4';
  const mobileWebm = isLight
    ? '/assets/hero/hero_light_mobile.webm'
    : '/assets/hero/hero_mobile.webm';
  const mobileMp4 = isLight
    ? '/assets/hero/hero_light_mobile.mp4'
    : '/assets/hero/hero_mobile.mp4';
  const posterWebp = isLight
    ? '/assets/hero/hero_light_poster.webp'
    : '/assets/hero/hero_poster.webp';
  const posterJpg = isLight
    ? '/assets/hero/hero_light_poster.jpg'
    : '/assets/hero/hero_poster.jpg';
  const mobilePosterWebp = isLight
    ? '/assets/hero/hero_light_poster_mobile.webp'
    : '/assets/hero/hero_poster_mobile.webp';
  const mobilePosterJpg = isLight
    ? '/assets/hero/hero_light_poster_mobile.jpg'
    : '/assets/hero/hero_poster_mobile.jpg';

  // Accessibility: Detect prefers-reduced-motion & Save-Data network preference
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const checkReducedMotion = () => {
      const isDataSaver =
        'connection' in navigator && (navigator as any).connection?.saveData === true;
      setPrefersReducedMotion(motionQuery.matches || isDataSaver);
    };

    checkReducedMotion();

    try {
      motionQuery.addEventListener('change', checkReducedMotion);
      return () => motionQuery.removeEventListener('change', checkReducedMotion);
    } catch {
      motionQuery.addListener(checkReducedMotion);
      return () => motionQuery.removeListener(checkReducedMotion);
    }
  }, []);

  // Reload and play video on theme or reduced-motion change
  useEffect(() => {
    setIsVideoLoaded(false);
    if (!videoRef.current) return;
    videoRef.current.load();
    if (!prefersReducedMotion) {
      const p = videoRef.current.play();
      if (p !== undefined) {
        p.catch(() => {
          setIsVideoLoaded(false);
        });
      }
    }
  }, [heroTheme, prefersReducedMotion]);

  const handleScrollToProducts = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById('products');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScrollToHowItWorks = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById('how-it-works');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      className={`relative overflow-hidden pt-10 pb-16 md:pt-16 md:pb-24 border-b font-cairo transition-colors duration-500 ${
        isLight
          ? 'bg-[#f8fafc] border-slate-200/80 text-slate-900'
          : 'bg-[#0B1F3A] border-blue-950/80 text-white'
      }`}
    >
      {/* ======================================================== */}
      {/* Cinematic Background Video Layer                         */}
      {/* ======================================================== */}
      <div
        className={`absolute inset-0 z-0 overflow-hidden pointer-events-none select-none transition-colors duration-500 ${
          isLight ? 'bg-[#f8fafc]' : 'bg-[#0B1F3A]'
        }`}
        aria-hidden="true"
      >
        {/* Instant Poster Fallback (0ms layout shift, WebP/JPG) */}
        <picture
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
            isVideoLoaded ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <source media="(max-width: 767px)" srcSet={mobilePosterWebp} type="image/webp" />
          <source media="(max-width: 767px)" srcSet={mobilePosterJpg} type="image/jpeg" />
          <source media="(min-width: 768px)" srcSet={posterWebp} type="image/webp" />
          <img
            src={posterJpg}
            alt=""
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover object-[center_center] lg:object-[28%_center]"
          />
        </picture>

        {/* Video Element: Seamless Loop, Muted, Autoplay, No Audio Stream */}
        {!prefersReducedMotion && (
          <video
            ref={videoRef}
            key={heroTheme}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={posterJpg}
            onLoadedData={() => setIsVideoLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-1000 ${
              isVideoLoaded ? 'opacity-100' : 'opacity-0'
            } object-[center_center] lg:object-[28%_center]`}
          >
            {/* Mobile optimized stream (< 768px) */}
            <source media="(max-width: 767px)" src={mobileWebm} type="video/webm" />
            <source media="(max-width: 767px)" src={mobileMp4} type="video/mp4" />
            {/* Desktop high efficiency WebM VP9 */}
            <source src={desktopWebm} type="video/webm" />
            {/* Desktop universal compatibility MP4 H.264 */}
            <source src={desktopMp4} type="video/mp4" />
          </video>
        )}

        {/* Subtle Ambient Overlay */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            isLight ? 'bg-white/35 backdrop-brightness-[1.02]' : 'bg-[#0B1F3A]/40'
          }`}
        />

        {/* Directional Content Scrim: Emphasizes Text Readability on Content Column */}
        <div
          className={`absolute inset-0 transition-all duration-500 ${
            isLight
              ? isRtl
                ? 'bg-gradient-to-l from-white/95 via-white/75 sm:via-white/60 to-transparent'
                : 'bg-gradient-to-r from-white/95 via-white/75 sm:via-white/60 to-transparent'
              : isRtl
              ? 'bg-gradient-to-l from-[#0B1F3A]/95 via-[#0B1F3A]/75 sm:via-[#0B1F3A]/60 to-[#0B1F3A]/30'
              : 'bg-gradient-to-r from-[#0B1F3A]/95 via-[#0B1F3A]/75 sm:via-[#0B1F3A]/60 to-[#0B1F3A]/30'
          }`}
        />

        {/* Seamless Edge Fades to Header and Products Section */}
        <div
          className={`absolute inset-x-0 top-0 h-14 transition-colors duration-500 ${
            isLight
              ? 'bg-gradient-to-b from-white/80 to-transparent'
              : 'bg-gradient-to-b from-[#0B1F3A]/80 to-transparent'
          }`}
        />
        <div
          className={`absolute inset-x-0 bottom-0 h-20 transition-colors duration-500 ${
            isLight
              ? 'bg-gradient-to-t from-slate-50 to-transparent'
              : 'bg-gradient-to-t from-[#0B1F3A] to-transparent'
          }`}
        />
      </div>

      {/* ======================================================== */}
      {/* Foreground Hero Content Container                        */}
      {/* ======================================================== */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Main Content Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-start">
            {/* Top Kicker Label + Theme Switcher */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs border transition-colors ${
                  isLight
                    ? 'bg-blue-100/80 text-[#0B1F3A] border-blue-200/80'
                    : 'bg-blue-900/40 text-blue-200 border-blue-400/30 backdrop-blur-md'
                }`}
              >
                <Cpu className="w-4 h-4 text-[#2F6BFF]" />
                <span>{t.heroBadge}</span>
                <span
                  className={isLight ? 'text-slate-300 font-mono' : 'text-blue-300/50 font-mono'}
                  aria-hidden="true"
                >
                  ·
                </span>
                <span className="text-[#2F6BFF] font-mono text-[11px] font-extrabold dir-ltr">
                  n8n Workflows
                </span>
              </div>

              {/* Mode Switcher Button (Allows previewing Light / Dark background video) */}
              <button
                type="button"
                onClick={() => setHeroTheme(prev => (prev === 'light' ? 'dark' : 'light'))}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  isLight
                    ? 'bg-white/90 hover:bg-white text-slate-700 border-slate-300/80 shadow-2xs'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-blue-200 border-slate-700 shadow-xs'
                }`}
                title={isRtl ? 'تبديل وضع فيديو الخلفية (نهاري / ليلي)' : 'Toggle Hero Background Video'}
              >
                {isLight ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-700" />
                    <span>{isRtl ? 'الوضع الليلي' : 'Dark Video'}</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isRtl ? 'الوضع النهاري' : 'Light Video'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Main Headline */}
            <h1
              className={`font-heading font-black text-2xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.25] transition-colors ${
                isLight ? 'text-[#0B1F3A]' : 'text-white drop-shadow-xs'
              }`}
            >
              {t.heroTitle}
            </h1>

            {/* Subtitle Statement */}
            <p
              className={`text-sm sm:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal transition-colors ${
                isLight ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              {t.heroSubtitle}
            </p>

            {/* CTAs Row */}
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-3.5 pt-2">
              <a
                href="#products"
                onClick={handleScrollToProducts}
                className="w-full sm:w-auto px-7 py-3.5 min-h-[48px] bg-[#2F6BFF] hover:bg-[#1a56e8] active:bg-[#1546c2] text-white font-extrabold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-98"
              >
                <span>{t.browseProductsBtn}</span>
                <ArrowDown className="w-4 h-4 text-white" />
              </a>

              {onOpenAssistant && (
                <button
                  type="button"
                  onClick={onOpenAssistant}
                  className={`w-full sm:w-auto px-6 py-3.5 min-h-[48px] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                    isLight
                      ? 'bg-[#0B1F3A] hover:bg-slate-800 text-white border border-slate-700'
                      : 'bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700/80 backdrop-blur-xs'
                  }`}
                >
                  <Bot className="w-4 h-4 text-[#19D3C5]" />
                  <span>{t.assistantLauncherLabel}</span>
                </button>
              )}

              {onOpenCustomRequest ? (
                <button
                  type="button"
                  onClick={onOpenCustomRequest}
                  className={`w-full sm:w-auto px-5 py-3.5 min-h-[48px] font-bold text-sm rounded-xl border transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                      : 'bg-white/10 hover:bg-white/15 text-white border-white/25 backdrop-blur-xs'
                  }`}
                >
                  <Wrench className={`w-4 h-4 ${isLight ? 'text-[#2F6BFF]' : 'text-blue-300'}`} />
                  <span>{t.customRequestBtn}</span>
                </button>
              ) : (
                <a
                  href="#how-it-works"
                  onClick={handleScrollToHowItWorks}
                  className={`w-full sm:w-auto px-7 py-3.5 min-h-[48px] font-bold text-sm rounded-xl border transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                      : 'bg-white/10 hover:bg-white/15 text-white border-white/25 backdrop-blur-xs'
                  }`}
                >
                  <HelpCircle className={`w-4.5 h-4.5 ${isLight ? 'text-[#2F6BFF]' : 'text-blue-300'}`} />
                  <span>{t.howItWorksBtn}</span>
                </a>
              )}

              {onOpenProductSuggestion && (
                <button
                  type="button"
                  onClick={onOpenProductSuggestion}
                  className={`w-full sm:w-auto px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    isLight
                      ? 'text-slate-600 hover:text-[#2F6BFF]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Lightbulb className={`w-3.5 h-3.5 ${isLight ? 'text-amber-500' : 'text-amber-400'}`} />
                  <span>{t.suggestProductBtn}</span>
                </button>
              )}
            </div>

            {/* Key Value Indicators */}
            <div
              className={`pt-5 border-t flex flex-wrap items-center justify-center lg:justify-start gap-3 text-xs font-semibold ${
                isLight ? 'border-slate-200/80 text-slate-600' : 'border-slate-700/60 text-slate-300'
              }`}
            >
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border sm:p-0 sm:border-0 ${
                  isLight
                    ? 'bg-white/80 border-slate-200/60 sm:bg-transparent'
                    : 'bg-slate-900/60 border-slate-700/60 sm:bg-transparent'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{t.featureInstantDelivery}</span>
              </div>
              <span
                className={`${isLight ? 'text-slate-300' : 'text-slate-600'} hidden sm:inline`}
                aria-hidden="true"
              >
                ·
              </span>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border sm:p-0 sm:border-0 ${
                  isLight
                    ? 'bg-white/80 border-slate-200/60 sm:bg-transparent'
                    : 'bg-slate-900/60 border-slate-700/60 sm:bg-transparent'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t.featureSecurePayment}</span>
              </div>
              <span
                className={`${isLight ? 'text-slate-300' : 'text-slate-600'} hidden sm:inline`}
                aria-hidden="true"
              >
                ·
              </span>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border sm:p-0 sm:border-0 ${
                  isLight
                    ? 'bg-white/80 border-slate-200/60 sm:bg-transparent'
                    : 'bg-slate-900/60 border-slate-700/60 sm:bg-transparent'
                }`}
              >
                <Wrench className="w-4 h-4 text-[#2F6BFF] shrink-0" />
                <span>{t.featureFreeSupport}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Workflow Visual Canvas Component */}
          <div className="lg:col-span-5 relative">
            <div
              className={`relative mx-auto max-w-md lg:max-w-none rounded-2xl border p-5 shadow-xl space-y-4 text-start transition-colors ${
                isLight
                  ? 'bg-white/95 backdrop-blur-md border-slate-200/90 text-slate-900'
                  : 'bg-slate-900/85 backdrop-blur-xl border-blue-500/25 text-white'
              }`}
            >
              {/* Node Visual Header */}
              <div
                className={`flex items-center justify-between border-b pb-3 ${
                  isLight ? 'border-slate-100' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isLight ? 'bg-blue-600' : 'bg-blue-500 animate-pulse'
                    }`}
                  />
                  <span
                    className={`font-mono text-xs font-bold ${
                      isLight ? 'text-[#0B1F3A]' : 'text-slate-200'
                    }`}
                  >
                    n8n_production_pipeline.json
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] font-extrabold border ${
                    isLight
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}
                  />
                  <span>v1.0 Verified</span>
                </div>
              </div>

              {/* Workflow Pipeline Display */}
              <div className="space-y-3 font-mono text-xs">
                {/* Node 1: Webhook Trigger */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between transition-colors shadow-2xs ${
                    isLight
                      ? 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                      : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      ⚡
                    </div>
                    <div>
                      <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        Webhook Listener
                      </div>
                      <div className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Incoming HTTP POST Listener
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isLight
                        ? 'bg-blue-100 text-[#2F6BFF]'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-400/20'
                    }`}
                  >
                    Trigger
                  </span>
                </div>

                {/* Connector Line */}
                <div className="flex justify-center">
                  <div className="w-0.5 h-3 bg-[#2F6BFF] rounded-full" />
                </div>

                {/* Node 2: AI Logic Execution */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between shadow-2xs ${
                    isLight
                      ? 'bg-blue-50/70 border-blue-200/80'
                      : 'bg-blue-950/40 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2F6BFF] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      🤖
                    </div>
                    <div>
                      <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        LLM Processing
                      </div>
                      <div
                        className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-blue-200/70'}`}
                      >
                        OpenAI GPT-4o-mini Agent
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold dir-ltr ${
                      isLight
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    120ms
                  </span>
                </div>

                {/* Connector Line */}
                <div className="flex justify-center">
                  <div className="w-0.5 h-3 bg-[#2F6BFF] rounded-full" />
                </div>

                {/* Node 3: Database & Notification Dispatch */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between transition-colors shadow-2xs ${
                    isLight
                      ? 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                      : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      📲
                    </div>
                    <div>
                      <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        Database & WhatsApp
                      </div>
                      <div className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Supabase DB + WhatsApp Notice
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isLight
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    Action
                  </span>
                </div>
              </div>

              {/* Node Stats Footer */}
              <div
                className={`pt-2 border-t flex items-center justify-between text-[11px] font-mono ${
                  isLight ? 'border-slate-100 text-slate-500' : 'border-slate-800 text-slate-400'
                }`}
              >
                <span>جاهز للاستيراد 100%</span>
                <span className={isLight ? 'text-slate-700' : 'text-blue-400'}>n8n Ready</span>
                <span>تسليم فوري</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
