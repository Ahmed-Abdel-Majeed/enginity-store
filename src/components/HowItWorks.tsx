import React from 'react';
import { Translations } from '../i18n/ar';
import { Search, Lock, FileCheck, Cpu } from 'lucide-react';

interface HowItWorksProps {
  t: Translations;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ t }) => {
  const steps = [
    {
      num: 1,
      title: t.step1Title,
      desc: t.step1Desc,
      icon: Search,
      badge: 'جاهز للاستيراد بضغط واحدة'
    },
    {
      num: 2,
      title: t.step2Title,
      desc: t.step2Desc,
      icon: Lock,
      badge: 'دفع مباشر عبر بوابات معتمدة'
    },
    {
      num: 3,
      title: t.step3Title,
      desc: t.step3Desc,
      icon: FileCheck,
      badge: 'تسليم فوري للملف والدليل'
    }
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-slate-50/80 border-y border-slate-200/80 font-cairo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 text-center">
        
        {/* Section Header */}
        <div className="space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-xl bg-blue-100/90 text-[#0B1F3A] font-mono text-xs font-bold border border-blue-200/80">
            <Cpu className="w-3.5 h-3.5 text-[#2F6BFF]" />
            <span>خطوات سريعة ومبسطة</span>
          </div>
          <h2 className="font-heading font-black text-2xl sm:text-3xl lg:text-4xl text-[#0B1F3A]">
            {t.howTitle}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            {t.howSubtitle}
          </p>
        </div>

        {/* 3 Step Cards Sequence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-start">
          {steps.map(step => {
            const IconComponent = step.icon;
            return (
              <div
                key={step.num}
                className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-2xs space-y-6 relative flex flex-col justify-between hover:border-[#2F6BFF] hover:shadow-md transition-all duration-300"
              >
                <div className="space-y-4">
                  
                  {/* Step Header */}
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-[#0B1F3A] text-white font-heading font-black text-lg flex items-center justify-center shadow-xs">
                      {step.num}
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50 text-[#2F6BFF] border border-blue-100">
                      <IconComponent className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Step Content */}
                  <h3 className="font-heading font-extrabold text-lg text-slate-900">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {step.desc}
                  </p>

                </div>

                {/* Bottom Kicker */}
                <div className="pt-3 border-t border-slate-100 font-mono text-[11px] text-[#2F6BFF] font-bold text-center bg-slate-50/80 rounded-xl py-2">
                  ✓ {step.badge}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
