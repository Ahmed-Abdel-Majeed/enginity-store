import React, { useState } from 'react';
import { Currency, Lang } from '../types';
import { Translations } from '../i18n/ar';
import { ShieldCheck, MessageCircle, Cpu, Menu, X } from 'lucide-react';

interface HeaderProps {
  lang: Lang;
  currency: Currency;
  t: Translations;
  onToggleLang: (newLang: Lang) => void;
  onToggleCurrency: (newCurrency: Currency) => void;
  whatsappNumber?: string;
  whatsappMessage?: string;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  currency,
  t,
  onToggleLang,
  onToggleCurrency,
  whatsappNumber,
  whatsappMessage
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const whatsappUrl = `https://wa.me/${whatsappNumber || '201501053538'}?text=${encodeURIComponent(whatsappMessage || '')}`;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 transition-all font-cairo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <a href={`/${lang}`} className="flex items-center gap-2.5 group focus:outline-hidden">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0B1F3A] flex items-center justify-center text-white shadow-xs group-hover:bg-[#2F6BFF] transition-colors shrink-0">
              <Cpu className="w-5 h-5 text-blue-400 group-hover:text-white transition-colors" />
            </div>
            <div className="flex flex-col text-start">
              <span className="font-heading font-black text-lg sm:text-xl tracking-tight text-[#0B1F3A] group-hover:text-[#2F6BFF] transition-colors leading-none">
                ENGINITY
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono font-medium text-slate-500 tracking-wider uppercase pt-0.5">
                n8n Marketplace
              </span>
            </div>
          </a>
        </div>

        {/* Zone 2: Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-700">
          <a
            href={`/${lang}#products`}
            className="hover:text-[#2F6BFF] transition-colors whitespace-nowrap shrink-0 py-1.5"
          >
            {t.navProducts}
          </a>
          <a
            href={`/${lang}#how-it-works`}
            className="hover:text-[#2F6BFF] transition-colors whitespace-nowrap shrink-0 py-1.5"
          >
            {t.navHowItWorks}
          </a>
          <a
            href={`/${lang}#faq`}
            className="hover:text-[#2F6BFF] transition-colors whitespace-nowrap shrink-0 py-1.5"
          >
            {t.navFaq}
          </a>
        </nav>

        {/* Zone 3: Controls & Primary Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Currency Segmented Toggle */}
          <div className="hidden sm:flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold border border-slate-200/80">
            <button
              type="button"
              onClick={() => onToggleCurrency('EGP')}
              className={`px-2.5 py-1.5 min-h-[36px] flex items-center justify-center rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                currency === 'EGP'
                  ? 'bg-white text-[#2F6BFF] shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.currencyEGP}
            </button>
            <button
              type="button"
              onClick={() => onToggleCurrency('USD')}
              className={`px-2.5 py-1.5 min-h-[36px] flex items-center justify-center rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                currency === 'USD'
                  ? 'bg-white text-[#2F6BFF] shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              $ USD
            </button>
          </div>

          {/* Language Segmented Toggle */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold border border-slate-200/80">
            <button
              type="button"
              onClick={() => onToggleLang('ar')}
              className={`px-2.5 py-1.5 min-h-[36px] flex items-center justify-center rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                lang === 'ar'
                  ? 'bg-white text-[#2F6BFF] shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              عربي
            </button>
            <button
              type="button"
              onClick={() => onToggleLang('en')}
              className={`px-2.5 py-1.5 min-h-[36px] flex items-center justify-center rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                lang === 'en'
                  ? 'bg-white text-[#2F6BFF] shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EN
            </button>
          </div>

          {/* Direct WhatsApp Contact Button */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors border border-slate-200 shadow-2xs min-h-[40px]"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span className="whitespace-nowrap">{t.navContact}</span>
          </a>

          {/* Admin Link */}
          <a
            href="/admin"
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-500 hover:text-[#2F6BFF] rounded-xl hover:bg-slate-100 transition-colors shrink-0"
            title={t.adminPanel}
          >
            <ShieldCheck className="w-5 h-5" />
          </a>

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white p-4 space-y-4 shadow-lg animate-in slide-in-from-top-2 duration-200">
          
          <nav className="flex flex-col space-y-2 text-sm font-bold text-slate-800">
            <a
              href={`/${lang}#products`}
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-lg hover:bg-slate-50 hover:text-[#2F6BFF] transition-colors"
            >
              {t.navProducts}
            </a>
            <a
              href={`/${lang}#how-it-works`}
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-lg hover:bg-slate-50 hover:text-[#2F6BFF] transition-colors"
            >
              {t.navHowItWorks}
            </a>
            <a
              href={`/${lang}#faq`}
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-lg hover:bg-slate-50 hover:text-[#2F6BFF] transition-colors"
            >
              {t.navFaq}
            </a>
          </nav>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            
            {/* Mobile Currency Toggle */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold border border-slate-200/80">
              <button
                type="button"
                onClick={() => onToggleCurrency('EGP')}
                className={`px-3 py-1.5 rounded-lg ${currency === 'EGP' ? 'bg-white text-[#2F6BFF] shadow-xs' : 'text-slate-600'}`}
              >
                {t.currencyEGP}
              </button>
              <button
                type="button"
                onClick={() => onToggleCurrency('USD')}
                className={`px-3 py-1.5 rounded-lg ${currency === 'USD' ? 'bg-white text-[#2F6BFF] shadow-xs' : 'text-slate-600'}`}
              >
                $ USD
              </button>
            </div>

            {/* Mobile WhatsApp Button */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-1.5 shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{t.navContact}</span>
            </a>

          </div>

        </div>
      )}
    </header>
  );
};
