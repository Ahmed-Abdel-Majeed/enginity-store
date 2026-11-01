import React from 'react';
import { StoreSettings, Lang } from '../types';
import { Translations } from '../i18n/ar';
import { Youtube, Linkedin, Facebook, Globe, MessageCircle, ArrowDown, Sparkles } from 'lucide-react';

interface AuthorCardProps {
  settings: StoreSettings;
  lang: Lang;
  t: Translations;
}

export const AuthorCard: React.FC<AuthorCardProps> = ({ settings, lang, t }) => {
  const isRtl = lang === 'ar';
  const whatsappUrl = `https://wa.me/${settings.whatsapp_number || '201501053538'}?text=${encodeURIComponent(settings.whatsapp_default_message || '')}`;

  // Bio selection with fallback to standard approved copy
  const customBio = isRtl ? settings.author_bio_ar : settings.author_bio_en;
  const bio = (customBio && customBio.trim().length > 0) ? customBio : t.authorBioDefault;

  // Name formatting & fallback
  const rawName = settings.author_name || t.authorDefaultName;
  const name = rawName.includes('(') ? rawName.split('(')[0].trim() : rawName;

  const handleScrollToProducts = (e: React.MouseEvent) => {
    e.preventDefault();
    const productsSection = document.getElementById('products');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="author" className="py-12 sm:py-16 bg-slate-50/60 border-t border-b border-slate-200/80 font-cairo">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Card Container */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-sm transition-shadow p-6 sm:p-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-12">
            
            {/* Founder Visual / Portrait Block */}
            <div className="flex flex-col items-center shrink-0 space-y-3">
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-2xl bg-[#0B1730] border-2 border-slate-100 shadow-md overflow-hidden flex items-center justify-center group">
                {settings.author_photo ? (
                  <img
                    src={settings.author_photo}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0B1730] to-[#1a2e56] flex flex-col items-center justify-center text-white p-4 text-center">
                    <span className="font-heading font-black text-3xl sm:text-4xl text-[#2D6BFF] tracking-tight">AF</span>
                    <span className="text-[10px] font-semibold text-slate-300 mt-1 uppercase tracking-wider">Enginity Founder</span>
                  </div>
                )}
              </div>

              {/* Status / Availability Marker */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/80 border border-slate-200/60 text-slate-600 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span>{isRtl ? 'متاح للاستشارات والحلول' : 'Available for Consultations'}</span>
              </div>
            </div>

            {/* Founder Information & Value Content */}
            <div className="flex-1 text-center md:text-start space-y-4">
              
              {/* Eyebrow Header */}
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2D6BFF] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t.authorEyebrow}</span>
              </div>

              {/* Name & Title Block */}
              <div>
                <h2 className="font-heading font-black text-2xl sm:text-3xl text-[#0B1730] tracking-tight">
                  <bdi dir="auto">{name}</bdi>
                </h2>
                <p className="text-sm sm:text-base font-bold text-[#2D6BFF] mt-1">
                  {t.authorHeadline}
                </p>
              </div>

              {/* Benefit-Driven Description */}
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl font-normal">
                <bdi dir="auto">{bio}</bdi>
              </p>

              {/* Supporting Value Line */}
              <div className="border-s-2 border-[#2D6BFF] ps-3 py-0.5 text-xs sm:text-sm text-slate-500 font-medium leading-relaxed max-w-2xl">
                <span>{t.authorBioSupporting}</span>
              </div>

              {/* Primary & Secondary Call to Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center md:justify-start gap-3">
                
                {/* Primary Action: Explore Workflows */}
                <a
                  href="#products"
                  onClick={handleScrollToProducts}
                  className="h-11 px-6 rounded-xl bg-[#0B1730] hover:bg-[#16274a] active:bg-[#070e1e] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs hover:shadow-md cursor-pointer group whitespace-nowrap"
                >
                  <span>{t.authorExploreBtn}</span>
                  <ArrowDown className="w-4 h-4 text-[#2D6BFF] transition-transform group-hover:translate-y-0.5" />
                </a>

                {/* Secondary Action: Direct Contact */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{t.authorContactBtn}</span>
                </a>
              </div>

              {/* Supporting Profiles / Portfolio Row */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-4 text-xs">
                <span className="text-slate-400 font-medium hidden sm:inline">{isRtl ? 'روابط التواصل:' : 'Connect:'}</span>
                
                {settings.social_links?.portfolio && (
                  <a
                    href={settings.social_links.portfolio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t.authorPortfolioBtn}</span>
                  </a>
                )}

                {settings.social_links?.linkedin && (
                  <a
                    href={settings.social_links.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium transition-colors"
                  >
                    <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
                    <span>LinkedIn</span>
                  </a>
                )}

                {settings.social_links?.youtube && (
                  <a
                    href={settings.social_links.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium transition-colors"
                  >
                    <Youtube className="w-3.5 h-3.5 text-[#FF0000]" />
                    <span>YouTube</span>
                  </a>
                )}

                {settings.social_links?.facebook && (
                  <a
                    href={settings.social_links.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium transition-colors"
                  >
                    <Facebook className="w-3.5 h-3.5 text-[#1877F2]" />
                    <span>Facebook</span>
                  </a>
                )}
              </div>

            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
