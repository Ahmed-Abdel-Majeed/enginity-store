import React, { useState } from 'react';
import { GeneralFaq as GeneralFaqType, Lang } from '../types';
import { Translations } from '../i18n/ar';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface GeneralFaqProps {
  faqs: GeneralFaqType[];
  lang: Lang;
  t: Translations;
}

export const GeneralFaq: React.FC<GeneralFaqProps> = ({ faqs, lang, t }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggleAccordion = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-16 md:py-24 bg-slate-50/80 border-b border-slate-200/80 font-cairo">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-center">
        
        {/* Section Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-xl bg-blue-100/90 text-[#0B1F3A] text-xs font-bold border border-blue-200/80">
            <HelpCircle className="w-3.5 h-3.5 text-[#2F6BFF]" />
            <span>الأسئلة الشائعة</span>
          </div>
          <h2 className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-[#0B1F3A]">
            {t.faqTitle}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed font-normal">
            {t.faqSubtitle}
          </p>
        </div>

        {/* Accessible Accordion List */}
        <div className="space-y-3.5 text-start">
          {faqs.map((faq, idx) => {
            const question = lang === 'ar' ? faq.q_ar : faq.q_en;
            const answer = lang === 'ar' ? faq.a_ar : faq.a_en;
            const isOpen = openIdx === idx;

            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs transition-all hover:border-[#2F6BFF]/60"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(idx)}
                  aria-expanded={isOpen}
                  className="w-full p-5 sm:p-6 flex items-center justify-between gap-4 text-start hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <span className="font-heading font-extrabold text-base text-slate-900 leading-snug">
                    {question}
                  </span>
                  <div className="p-1.5 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[#2F6BFF]" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 sm:px-6 pb-6 pt-1 text-sm text-slate-700 leading-relaxed border-t border-slate-100 bg-slate-50/40">
                    {answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
