import React from 'react';
import { StoreSettings, Lang } from '../types';
import { Translations } from '../i18n/ar';
import { MessageCircle, ShieldCheck, Youtube, Linkedin, Facebook, Globe, Phone, Cpu } from 'lucide-react';

interface FooterProps {
  settings: StoreSettings;
  lang: Lang;
  t: Translations;
  onOpenCustomRequest?: () => void;
  onOpenProductSuggestion?: () => void;
  onOpenAssistant?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  settings,
  lang,
  t,
  onOpenCustomRequest,
  onOpenProductSuggestion,
  onOpenAssistant
}) => {
  const whatsappUrl = `https://wa.me/${settings.whatsapp_number || '201501053538'}?text=${encodeURIComponent(settings.whatsapp_default_message || '')}`;

  return (
    <footer className="bg-[#0B1F3A] text-slate-300 border-t border-slate-800 font-cairo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          
          {/* Brand Info Column */}
          <div className="md:col-span-5 space-y-4 text-start">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#2F6BFF] flex items-center justify-center text-white shadow-xs">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-heading font-black text-2xl text-white tracking-tight leading-none">
                  ENGINITY
                </span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest pt-0.5">
                  Automated Workflows Marketplace
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md font-normal">
              {t.footerDesc}
            </p>

            <div className="flex items-center gap-2 pt-1 text-xs text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>{t.processedViaXPay}</span>
            </div>
          </div>

          {/* Quick Links Column */}
          <div className="md:col-span-3 space-y-3 text-start">
            <h3 className="font-heading font-extrabold text-sm text-white uppercase tracking-wider">
              {t.footerQuickLinks}
            </h3>
            <ul className="space-y-2.5 text-xs font-medium">
              <li>
                <a href={`/${lang}#products`} className="hover:text-[#2F6BFF] transition-colors">
                  {t.navProducts}
                </a>
              </li>
              <li>
                <a href={`/${lang}#how-it-works`} className="hover:text-[#2F6BFF] transition-colors">
                  {t.navHowItWorks}
                </a>
              </li>
              <li>
                <a href={`/${lang}#faq`} className="hover:text-[#2F6BFF] transition-colors">
                  {t.navFaq}
                </a>
              </li>
              {onOpenAssistant && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenAssistant}
                    className="hover:text-[#19D3C5] text-teal-400 font-semibold transition-colors cursor-pointer"
                  >
                    {t.assistantLauncherLabel}
                  </button>
                </li>
              )}
              {onOpenCustomRequest && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenCustomRequest}
                    className="hover:text-[#2F6BFF] transition-colors cursor-pointer"
                  >
                    {t.customRequestBtn}
                  </button>
                </li>
              )}
              {onOpenProductSuggestion && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenProductSuggestion}
                    className="hover:text-[#2F6BFF] transition-colors cursor-pointer"
                  >
                    {t.suggestProductBtn}
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Support & Contact Column */}
          <div className="md:col-span-4 space-y-3 text-start">
            <h3 className="font-heading font-extrabold text-sm text-white uppercase tracking-wider">
              {t.footerSupport}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t.footerSupportDesc}
            </p>
            
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t.whatsappContactBtn}</span>
              </a>

              {settings.contact_email && (
                <a
                  href={`mailto:${settings.contact_email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors border border-slate-700"
                >
                  <Phone className="w-3.5 h-3.5 text-[#2F6BFF]" />
                  <span>{settings.contact_email}</span>
                </a>
              )}
            </div>

            {/* Social Links Row */}
            <div className="pt-2 flex items-center gap-2.5 text-slate-400">
              {settings.social_links?.youtube && (
                <a
                  href={settings.social_links.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                  title="YouTube"
                >
                  <Youtube className="w-4.5 h-4.5" />
                </a>
              )}

              {settings.social_links?.linkedin && (
                <a
                  href={settings.social_links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-[#2F6BFF] transition-colors cursor-pointer shrink-0"
                  title="LinkedIn"
                >
                  <Linkedin className="w-4.5 h-4.5" />
                </a>
              )}

              {settings.social_links?.facebook && (
                <a
                  href={settings.social_links.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-blue-500 transition-colors cursor-pointer shrink-0"
                  title="Facebook"
                >
                  <Facebook className="w-4.5 h-4.5" />
                </a>
              )}

              {settings.social_links?.portfolio && (
                <a
                  href={settings.social_links.portfolio}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
                  title="Portfolio"
                >
                  <Globe className="w-4.5 h-4.5" />
                </a>
              )}
            </div>
          </div>

        </div>

        {/* Copyright Footer Line */}
        <div className="mt-12 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div>{t.copyright}</div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
            <span>Enginity n8n Engine</span>
            <span>·</span>
            <span>XPay Checkout Ready</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
