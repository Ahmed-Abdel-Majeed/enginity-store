import React from 'react';
import { MessageCircle } from 'lucide-react';

interface FloatingWhatsAppProps {
  number: string;
  message: string;
  lang: 'ar' | 'en';
}

export const FloatingWhatsApp: React.FC<FloatingWhatsAppProps> = ({
  number,
  message,
  lang
}) => {
  const url = `https://wa.me/${number || '201000000000'}?text=${encodeURIComponent(message || '')}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed bottom-20 sm:bottom-6 ${
        lang === 'ar' ? 'left-4 sm:left-6' : 'right-4 sm:right-6'
      } z-50 p-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 group min-w-[48px] min-h-[48px]`}
      title="تواصل مباشر عبر الواتساب / Chat on WhatsApp"
    >
      <MessageCircle className="w-6 h-6 fill-current" />
      <span className="sr-only">WhatsApp Support</span>
      
      {/* Tooltip on hover */}
      <span className={`absolute bottom-full mb-2 hidden group-hover:block px-3 py-1 bg-slate-900 text-white text-[11px] rounded-md whitespace-nowrap shadow-md ${
        lang === 'ar' ? 'left-0' : 'right-0'
      }`}>
        {lang === 'ar' ? 'دعم الواتساب المباشر' : 'WhatsApp Support'}
      </span>
    </a>
  );
};
