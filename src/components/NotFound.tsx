import React from 'react';
import { Lang } from '../types';
import { Translations } from '../i18n/ar';
import { ArrowLeft, ArrowRight, FileQuestion } from 'lucide-react';

interface NotFoundProps {
  lang: Lang;
  t: Translations;
}

export const NotFound: React.FC<NotFoundProps> = ({ lang, t }) => {
  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 text-center font-cairo">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 space-y-6 shadow-sm">
        
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading font-extrabold text-2xl text-slate-900">
            {lang === 'ar' ? 'الصفحة غير موجودة (404)' : 'Page Not Found (404)'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {lang === 'ar'
              ? 'عذراً، الرابط الذي تحاول الوصول إليه غير موجود أو تم تحريكه.'
              : 'Sorry, the workflow or page you are looking for does not exist or has been moved.'}
          </p>
        </div>

        <a
          href={`/${lang}`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs"
        >
          <span>{lang === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}</span>
          <ArrowIcon className="w-4 h-4" />
        </a>

      </div>
    </div>
  );
};
