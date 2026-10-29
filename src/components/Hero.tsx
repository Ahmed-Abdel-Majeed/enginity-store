import React from 'react';
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
    <section className="relative overflow-hidden pt-10 pb-16 md:pt-16 md:pb-24 bg-gradient-to-b from-blue-50/50 via-slate-50/30 to-slate-50 border-b border-slate-200/80 font-cairo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Main Content Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-start">
            
            {/* Top Kicker Label */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-100/80 text-[#0B1F3A] text-xs font-bold border border-blue-200/80 shadow-2xs">
              <Cpu className="w-4 h-4 text-[#2F6BFF]" />
              <span>{t.heroBadge}</span>
              <span className="text-slate-300 font-mono" aria-hidden="true">·</span>
              <span className="text-[#2F6BFF] font-mono text-[11px] font-extrabold dir-ltr">n8n Workflows</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-heading font-black text-2xl sm:text-4xl lg:text-5xl text-[#0B1F3A] tracking-tight leading-[1.25]">
              {t.heroTitle}
            </h1>

            {/* Subtitle Statement */}
            <p className="text-sm sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal">
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
                  className="w-full sm:w-auto px-6 py-3.5 min-h-[48px] bg-[#0B1F3A] hover:bg-slate-800 text-white font-bold text-sm rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Bot className="w-4 h-4 text-[#19D3C5]" />
                  <span>{t.assistantLauncherLabel}</span>
                </button>
              )}

              {onOpenCustomRequest ? (
                <button
                  type="button"
                  onClick={onOpenCustomRequest}
                  className="w-full sm:w-auto px-5 py-3.5 min-h-[48px] bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                >
                  <Wrench className="w-4 h-4 text-[#2F6BFF]" />
                  <span>{t.customRequestBtn}</span>
                </button>
              ) : (
                <a
                  href="#how-it-works"
                  onClick={handleScrollToHowItWorks}
                  className="w-full sm:w-auto px-7 py-3.5 min-h-[48px] bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-bold text-sm rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                >
                  <HelpCircle className="w-4.5 h-4.5 text-[#2F6BFF]" />
                  <span>{t.howItWorksBtn}</span>
                </a>
              )}

              {onOpenProductSuggestion && (
                <button
                  type="button"
                  onClick={onOpenProductSuggestion}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-[#2F6BFF] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t.suggestProductBtn}</span>
                </button>
              )}
            </div>

            {/* Key Value Indicators */}
            <div className="pt-5 border-t border-slate-200/80 flex flex-wrap items-center justify-center lg:justify-start gap-3 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/60 sm:bg-transparent sm:p-0 sm:border-0">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{t.featureInstantDelivery}</span>
              </div>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">·</span>
              <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/60 sm:bg-transparent sm:p-0 sm:border-0">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t.featureSecurePayment}</span>
              </div>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">·</span>
              <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/60 sm:bg-transparent sm:p-0 sm:border-0">
                <Wrench className="w-4 h-4 text-[#2F6BFF] shrink-0" />
                <span>{t.featureFreeSupport}</span>
              </div>
            </div>

          </div>

          {/* Right Column: Workflow Visual Canvas Component */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xl space-y-4 text-start">
              
              {/* Node Visual Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="font-mono text-xs font-bold text-[#0B1F3A]">n8n_production_pipeline.json</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-mono text-[11px] font-extrabold border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>v1.0 Verified</span>
                </div>
              </div>

              {/* Workflow Pipeline Display */}
              <div className="space-y-3 font-mono text-xs">
                
                {/* Node 1: Webhook Trigger */}
                <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between transition-colors shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      ⚡
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Webhook Listener</div>
                      <div className="text-[11px] text-slate-500">Incoming HTTP POST Listener</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-[#2F6BFF] text-[10px] font-bold">Trigger</span>
                </div>

                {/* Connector Line */}
                <div className="flex justify-center">
                  <div className="w-0.5 h-3 bg-[#2F6BFF] rounded-full" />
                </div>

                {/* Node 2: AI Logic Execution */}
                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2F6BFF] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      🤖
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">LLM Processing</div>
                      <div className="text-[11px] text-slate-500">OpenAI GPT-4o-mini Agent</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold dir-ltr">120ms</span>
                </div>

                {/* Connector Line */}
                <div className="flex justify-center">
                  <div className="w-0.5 h-3 bg-[#2F6BFF] rounded-full" />
                </div>

                {/* Node 3: Database & Notification Dispatch */}
                <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between transition-colors shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      📲
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Database & WhatsApp</div>
                      <div className="text-[11px] text-slate-500">Supabase DB + WhatsApp Notice</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Action</span>
                </div>

              </div>

              {/* Node Stats Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>جاهز للاستيراد 100%</span>
                <span>n8n Ready</span>
                <span>تسليم فوري</span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
