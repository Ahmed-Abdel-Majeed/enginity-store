import React, { useState, useEffect, useRef } from 'react';
import { Translations } from '../i18n/ar';
import { Lang } from '../types';
import { Zap, ShieldCheck, Wrench, ArrowDown, HelpCircle, CheckCircle2, Cpu, Bot, Lightbulb } from 'lucide-react';

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
      // Fallback for older Safari
      motionQuery.addListener(checkReducedMotion);
      return () => motionQuery.removeListener(checkReducedMotion);
    }
  }, []);

  // Gracefully handle browser autoplay policies
  useEffect(() => {
    if (prefersReducedMotion || !videoRef.current) return;
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Browser blocked autoplay — keep high-resolution poster visible
        setIsVideoLoaded(false);
      });
    }
  }, [prefersReducedMotion]);

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
    <section className="relative overflow-hidden pt-10 pb-16 md:pt-16 md:pb-24 bg-[#0B1F3A] border-b border-blue-950/80 font-cairo text-white">
      {/* ======================================================== */}
      {/* Cinematic Background Video Layer                         */}
      {/* ======================================================== */}
      <div
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none bg-[#0B1F3A]"
        aria-hidden="true"
      >
        {/* Instant Poster Fallback (0ms layout shift, WebP/JPG) */}
        <picture
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
            isVideoLoaded ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <source
            media="(max-width: 767px)"
            srcSet="/assets/hero/hero_poster_mobile.webp"
            type="image/webp"
          />
          <source
            media="(max-width: 767px)"
            srcSet="/assets/hero/hero_poster_mobile.jpg"
            type="image/jpeg"
          />
          <source
            media="(min-width: 768px)"
            srcSet="/assets/hero/hero_poster.webp"
            type="image/webp"
          />
          <img
            src="/assets/hero/hero_poster.jpg"
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
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/assets/hero/hero_poster.jpg"
            onLoadedData={() => setIsVideoLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-1000 ${
              isVideoLoaded ? 'opacity-100' : 'opacity-0'
            } object-[center_center] lg:object-[28%_center]`}
          >
            {/* Mobile optimized stream (< 768px) */}
            <source
              media="(max-width: 767px)"
              src="/assets/hero/hero_mobile.webm"
              type="video/webm"
            />
            <source
              media="(max-width: 767px)"
              src="/assets/hero/hero_mobile.mp4"
              type="video/mp4"
            />
            {/* Desktop high efficiency WebM VP9 (441 KB) */}
            <source src="/assets/hero/hero_desktop.webm" type="video/webm" />
            {/* Desktop universal compatibility MP4 H.264 (624 KB) */}
            <source src="/assets/hero/hero_desktop.mp4" type="video/mp4" />
          </video>
        )}

        {/* Subtle Dark Navy Ambient Overlay (#0B1F3A) */}
        <div className="absolute inset-0 bg-[#0B1F3A]/40" />

        {/* Directional Content Scrim: Emphasizes Text Readability on Content Column */}
        <div
          className={`absolute inset-0 ${
            isRtl
              ? 'bg-gradient-to-l from-[#0B1F3A]/95 via-[#0B1F3A]/75 sm:via-[#0B1F3A]/60 to-[#0B1F3A]/30'
              : 'bg-gradient-to-r from-[#0B1F3A]/95 via-[#0B1F3A]/75 sm:via-[#0B1F3A]/60 to-[#0B1F3A]/30'
          }`}
        />

        {/* Seamless Edge Fades to Header and Products Section */}
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#0B1F3A]/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0B1F3A] to-transparent" />
      </div>

      {/* ======================================================== */}
      {/* Foreground Hero Content Container                        */}
      {/* ======================================================== */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Main Content Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-start">
            {/* Top Kicker Label */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-900/40 text-blue-200 text-xs font-bold border border-blue-400/30 backdrop-blur-md shadow-xs">
              <Cpu className="w-4 h-4 text-[#2F6BFF]" />
              <span>{t.heroBadge}</span>
              <span className="text-blue-300/50 font-mono" aria-hidden="true">
                ·
              </span>
              <span className="text-[#2F6BFF] font-mono text-[11px] font-extrabold dir-ltr">
                n8n Workflows
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="font-heading font-black text-2xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-[1.25] drop-shadow-xs">
              {t.heroTitle}
            </h1>

            {/* Subtitle Statement */}
            <p className="text-sm sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal">
              {t.heroSubtitle}
            </p>

            {/* CTAs Row */}
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-3.5 pt-2">
              <a
                href="#products"
                onClick={handleScrollToProducts}
                className="w-full sm:w-auto px-7 py-3.5 min-h-[48px] bg-[#2F6BFF] hover:bg-[#1a56e8] active:bg-[#1546c2] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-98"
              >
                <span>{t.browseProductsBtn}</span>
                <ArrowDown className="w-4 h-4 text-white" />
              </a>

              {onOpenAssistant && (
                <button
                  type="button"
                  onClick={onOpenAssistant}
                  className="w-full sm:w-auto px-6 py-3.5 min-h-[48px] bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-sm rounded-xl border border-slate-700/80 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer backdrop-blur-xs"
                >
                  <Bot className="w-4 h-4 text-[#19D3C5]" />
                  <span>{t.assistantLauncherLabel}</span>
                </button>
              )}

              {onOpenCustomRequest ? (
                <button
                  type="button"
                  onClick={onOpenCustomRequest}
                  className="w-full sm:w-auto px-5 py-3.5 min-h-[48px] bg-white/10 hover:bg-white/15 active:bg-white/20 text-white font-bold text-sm rounded-xl border border-white/25 transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer backdrop-blur-xs"
                >
                  <Wrench className="w-4 h-4 text-blue-300" />
                  <span>{t.customRequestBtn}</span>
                </button>
              ) : (
                <a
                  href="#how-it-works"
                  onClick={handleScrollToHowItWorks}
                  className="w-full sm:w-auto px-7 py-3.5 min-h-[48px] bg-white/10 hover:bg-white/15 active:bg-white/20 text-white font-bold text-sm rounded-xl border border-white/25 transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer backdrop-blur-xs"
                >
                  <HelpCircle className="w-4.5 h-4.5 text-blue-300" />
                  <span>{t.howItWorksBtn}</span>
                </a>
              )}

              {onOpenProductSuggestion && (
                <button
                  type="button"
                  onClick={onOpenProductSuggestion}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.suggestProductBtn}</span>
                </button>
              )}
            </div>

            {/* Key Value Indicators */}
            <div className="pt-5 border-t border-slate-700/60 flex flex-wrap items-center justify-center lg:justify-start gap-3 text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/60 sm:bg-transparent sm:p-0 sm:border-0">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{t.featureInstantDelivery}</span>
              </div>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
                ·
              </span>
              <div className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/60 sm:bg-transparent sm:p-0 sm:border-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{t.featureSecurePayment}</span>
              </div>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
                ·
              </span>
              <div className="flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700/60 sm:bg-transparent sm:p-0 sm:border-0">
                <Wrench className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{t.featureFreeSupport}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Workflow Visual Canvas Component */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none bg-slate-900/85 backdrop-blur-xl rounded-2xl border border-blue-500/25 p-5 shadow-2xl space-y-4 text-start">
              {/* Node Visual Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="font-mono text-xs font-bold text-slate-200">
                    n8n_production_pipeline.json
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 font-mono text-[11px] font-extrabold border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>v1.0 Verified</span>
                </div>
              </div>

              {/* Workflow Pipeline Display */}
              <div className="space-y-3 font-mono text-xs">
                {/* Node 1: Webhook Trigger */}
                <div className="p-3 bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700/70 flex items-center justify-between transition-colors shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0B1F3A] border border-blue-500/30 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      ⚡
                    </div>
                    <div>
                      <div className="font-bold text-slate-100">Webhook Listener</div>
                      <div className="text-[11px] text-slate-400">Incoming HTTP POST Listener</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-400/20">
                    Trigger
                  </span>
                </div>

                {/* Connector Line */}
                <div className="flex justify-center">
                  <div className="w-0.5 h-3 bg-[#2F6BFF] rounded-full shadow-xs shadow-blue-400" />
                </div>

                {/* Node 2: AI Logic Execution */}
                <div className="p-3 bg-blue-950/40 rounded-xl border border-blue-500/30 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2F6BFF] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      🤖
                    </div>
                    <div>
                      <div className="font-bold text-slate-100">LLM Processing</div>
                      <div className="text-[11px] text-blue-200/70">OpenAI GPT-4o-mini Agent</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 text-[10px] font-bold dir-ltr border border-emerald-500/30">
                    120ms
                  </span>
                </div>

                {/* Connector Line */}
                <div className="flex justify-center">
                  <div className="w-0.5 h-3 bg-[#2F6BFF] rounded-full shadow-xs shadow-blue-400" />
                </div>

                {/* Node 3: Database & Notification Dispatch */}
                <div className="p-3 bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700/70 flex items-center justify-between transition-colors shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-800 border border-emerald-500/30 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      📲
                    </div>
                    <div>
                      <div className="font-bold text-slate-100">Database & WhatsApp</div>
                      <div className="text-[11px] text-slate-400">Supabase DB + WhatsApp Notice</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                    Action
                  </span>
                </div>
              </div>

              {/* Node Stats Footer */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>جاهز للاستيراد 100%</span>
                <span className="text-blue-400">n8n Ready</span>
                <span>تسليم فوري</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
