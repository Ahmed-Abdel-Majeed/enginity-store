import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  Sparkles,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Wrench,
  Lightbulb,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import {
  AssistantChatMessage,
  AssistantProductRecommendation,
  Lang,
  StoreSettings
} from '../types';
import { sendAssistantMessage } from '../lib/data-store';

interface AiShoppingAssistantProps {
  lang: Lang;
  settings: StoreSettings;
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  onSelectProductSlug: (slug: string) => void;
  onOpenCustomRequest: (prefillTopic?: string) => void;
  onOpenProductSuggestion: (prefillTopic?: string) => void;
}

export const AiShoppingAssistant: React.FC<AiShoppingAssistantProps> = ({
  lang,
  settings,
  isOpen,
  onToggleOpen,
  onSelectProductSlug,
  onOpenCustomRequest,
  onOpenProductSuggestion
}) => {
  const isAr = lang === 'ar';

  const getInitialWelcomeMessage = (): AssistantChatMessage => ({
    id: 'welcome-msg',
    role: 'assistant',
    content: isAr
      ? 'مرحباً بك! أنا مساعد التسوق الذكي في ENGINITY. أستطيع البحث في كتالوج المنتجات الفعلي لترشيح أنسب Workflow جاهز لأعمالك، أو مساعدتك في طلب نظام أتمتة مخصص. كيف يمكنني مساعدتك اليوم؟'
      : 'Welcome! I am the ENGINITY AI Shopping Advisor. I search our live product catalog to recommend the right automation workflow for your business, or guide you to a custom system. How can I help you today?',
    timestamp: new Date().toISOString()
  });

  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    getInitialWelcomeMessage()
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'welcome-msg') {
        return [getInitialWelcomeMessage()];
      }
      return prev;
    });
  }, [lang]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const starterPrompts = isAr
    ? [
        'أريد بوت للرد التلقائي على رسائل فيسبوك ماسنجر وحجز مواعيد',
        'هل يوجد نظام أتمتة للواتساب بالذكاء الاصطناعي؟',
        'عندي متجر شوبيفاي وأريد ربطه مع نظام أتمتة مخصص',
        'كيف أختار النظام المناسب لعيادة أو شركة خدمات؟'
      ]
    : [
        'I need an AI chatbot for Facebook Messenger with appointment booking',
        'Do you have a WhatsApp AI automation workflow?',
        'I run a Shopify store and need a custom automation integration',
        'Help me choose the right workflow for a medical clinic or agency'
      ];

  const handleSend = async (textOverride?: string) => {
    const query = (textOverride ?? input).trim();
    if (!query || loading) return;

    const userMsg: AssistantChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString()
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    if (!textOverride) setInput('');
    setLoading(true);

    try {
      const historyForApi = updatedHistory
        .filter(m => m.id !== 'welcome-msg')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const payload = await sendAssistantMessage({
        message: query,
        history: historyForApi,
        lang
      });

      const assistantMsg: AssistantChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: isAr ? payload.reply_ar : payload.reply_en,
        timestamp: new Date().toISOString(),
        payload
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: isAr
            ? 'عذراً، حدث خطأ مؤقت أثناء الاتصال بالمساعد. يمكنك تصفح المنتجات مباشرة أو طلب نظام أتمتة مخصص بالأسفل.'
            : 'Sorry, a temporary error occurred. You can browse products directly or request a custom automation system below.',
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([getInitialWelcomeMessage()]);
    setInput('');
  };

  const whatsappUrl = `https://wa.me/${(settings.whatsapp_number || '201501053538').replace(
    /[^\d]/g,
    ''
  )}?text=${encodeURIComponent(settings.whatsapp_default_message || '')}`;

  const renderRecommendationCard = (rec: AssistantProductRecommendation) => {
    const isComingSoon = rec.status === 'coming_soon';
    const title = isAr ? rec.name_ar : rec.name_en;
    const matchReason = isAr ? rec.match_reason_ar : rec.match_reason_en;
    const limitations = isAr ? rec.limitations_ar : rec.limitations_en;

    return (
      <div
        key={rec.product_id}
        className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-blue-500/40 transition-all space-y-2.5"
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-bold text-white leading-snug">{title}</h4>
          <span
            className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
              isComingSoon
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            }`}
          >
            {isComingSoon ? (
              <>
                <Clock className="w-2.5 h-2.5" />
                <span>{isAr ? 'قريباً' : 'Coming Soon'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>{isAr ? 'متاح الآن' : 'Available'}</span>
              </>
            )}
          </span>
        </div>

        {/* Match Reason */}
        <p className="text-xs text-slate-300 leading-relaxed">{matchReason}</p>

        {/* Limitations / Prerequisites */}
        {limitations && (
          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">
              {isAr ? 'المتطلبات والقيود: ' : 'Prerequisites & Scope: '}
            </span>
            {limitations}
          </div>
        )}

        {/* Tools & Price Row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1">
            {(rec.tools || []).slice(0, 4).map(t => (
              <span
                key={t}
                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="text-xs font-bold text-teal-400 tabular-nums shrink-0">
            {rec.price_egp} {isAr ? 'ج.م' : 'EGP'}
          </div>
        </div>

        {/* Direct CTA */}
        <button
          type="button"
          onClick={() => {
            onSelectProductSlug(rec.slug);
            onToggleOpen(false);
          }}
          className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            isComingSoon
              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
              : 'bg-[#2f6bff] hover:bg-blue-600 text-white'
          }`}
        >
          <span>
            {isComingSoon
              ? isAr
                ? 'استعرض المنتج وانضم لقائمة الانتظار'
                : 'View Product & Join Waitlist'
              : isAr
              ? 'عرض تفاصيل الـ Workflow والشراء'
              : 'View Workflow Details & Buy'}
          </span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <div
          className={`fixed bottom-5 z-40 ${isAr ? 'left-5' : 'right-5'}`}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <button
            type="button"
            onClick={() => onToggleOpen(true)}
            aria-label={isAr ? 'فتح مساعد التسوق الذكي' : 'Open AI Shopping Assistant'}
            className="group flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#2f6bff] to-[#1e50d8] hover:from-blue-600 hover:to-blue-700 text-white shadow-2xl shadow-blue-600/35 border border-blue-400/30 transition-all hover:scale-[1.02]"
          >
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <Bot className="w-5 h-5 text-teal-300" />
            </div>
            <div className="text-start">
              <div className="text-xs font-bold flex items-center gap-1">
                <span>{isAr ? 'مساعد ENGINITY الذكي' : 'ENGINITY AI Advisor'}</span>
                <Sparkles className="w-3 h-3 text-teal-300" />
              </div>
              <div className="text-[10px] text-blue-100/90">
                {isAr ? 'اختر الـ Workflow الأنسب لشركتك' : 'Find the right workflow for your business'}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Assistant Drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm"
          dir={isAr ? 'rtl' : 'ltr'}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-assistant-title"
        >
          <div className="relative w-full max-w-md bg-[#0b1324] border-s border-slate-800 h-full flex flex-col shadow-2xl">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800/90 bg-slate-900/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-teal-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="ai-assistant-title" className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{isAr ? 'مساعد ENGINITY الذكي' : 'ENGINITY AI Shopping Advisor'}</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 text-[10px] font-medium">
                      <ShieldCheck className="w-3 h-3" />
                      {isAr ? 'موثق من الكتالوج' : 'Verified Catalog'}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {isAr
                      ? 'يرشح لك المنتجات الفعلية المتاحة أو يوجهك لطلب مخصص'
                      : 'Grounded in real marketplace products & custom engineering'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleReset}
                  title={isAr ? 'بدء محادثة جديدة' : 'Reset conversation'}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleOpen(false)}
                  aria-label={isAr ? 'إغلاق المساعد' : 'Close assistant'}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(msg => {
                const isUser = msg.role === 'user';
                const payload = msg.payload;
                const clarifyingList = isAr
                  ? payload?.clarifying_questions_ar
                  : payload?.clarifying_questions_en;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2.5`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line ${
                        isUser
                          ? 'bg-[#2f6bff] text-white font-medium'
                          : 'bg-slate-900/95 border border-slate-800 text-slate-200'
                      }`}
                    >
                      {msg.content}
                    </div>

                    {/* Clarifying Questions */}
                    {!isUser && clarifyingList && clarifyingList.length > 0 && (
                      <div className="w-full max-w-[92%] p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-1.5">
                        <div className="text-[11px] font-bold text-blue-300 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>
                            {isAr ? 'أسئلة سريعة لتحديد الحل الأدق:' : 'Quick questions to narrow down:'}
                          </span>
                        </div>
                        <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                          {clarifyingList.map((q, idx) => (
                            <li key={idx}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Verified Product Recommendations */}
                    {!isUser &&
                      payload?.recommendations &&
                      payload.recommendations.length > 0 && (
                        <div className="w-full max-w-[94%] space-y-2.5">
                          {payload.recommendations.map(rec => renderRecommendationCard(rec))}
                        </div>
                      )}

                    {/* Next-Step Action Buttons */}
                    {!isUser &&
                      payload?.suggested_actions &&
                      payload.suggested_actions.length > 0 && (
                        <div className="w-full max-w-[94%] flex flex-wrap gap-1.5 pt-1">
                          {payload.suggested_actions.map((act, idx) => {
                            if (act.type === 'request_custom_system') {
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    onToggleOpen(false);
                                    onOpenCustomRequest(act.prefill_topic);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-[11px] font-semibold transition-colors"
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                  <span>{isAr ? act.label_ar : act.label_en}</span>
                                </button>
                              );
                            }
                            if (act.type === 'suggest_product') {
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    onToggleOpen(false);
                                    onOpenProductSuggestion(act.prefill_topic);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-[11px] font-semibold transition-colors"
                                >
                                  <Lightbulb className="w-3.5 h-3.5" />
                                  <span>{isAr ? act.label_ar : act.label_en}</span>
                                </button>
                              );
                            }
                            if (act.type === 'contact_human_support') {
                              return (
                                <a
                                  key={idx}
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>{isAr ? act.label_ar : act.label_en}</span>
                                </a>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                  </div>
                );
              })}

              {/* Starter Prompts on Initial State */}
              {messages.length === 1 && !loading && (
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-semibold text-slate-400">
                    {isAr ? 'جرّب أن تسأل عن:' : 'Try asking about:'}
                  </div>
                  <div className="space-y-1.5">
                    {starterPrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        className="w-full text-start p-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-800/90 hover:border-blue-500/40 text-xs text-slate-300 transition-all"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-slate-400 px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span>
                    {isAr
                      ? 'جاري فحص كتالوج المنتجات وتحليل طلبك...'
                      : 'Searching live catalog and analyzing your request...'}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Persistent Footer Bar for Custom Request / Suggestion */}
            <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onToggleOpen(false);
                  onOpenCustomRequest();
                }}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Wrench className="w-3 h-3 text-blue-400" />
                <span>{isAr ? 'طلب نظام مخصص' : 'Custom System'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleOpen(false);
                  onOpenProductSuggestion();
                }}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Lightbulb className="w-3 h-3 text-teal-400" />
                <span>{isAr ? 'اقتراح منتج جديد' : 'Suggest Product'}</span>
              </button>
            </div>

            {/* Input Form */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3.5 border-t border-slate-800 bg-[#080f1e] flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={
                  isAr
                    ? 'اكتب احتياجك أو اسم المنصة التي تريد أتمتتها...'
                    : 'Describe your automation goal or platform...'
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="px-4 py-2.5 rounded-xl bg-[#2f6bff] hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isAr ? 'إرسال' : 'Send'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
