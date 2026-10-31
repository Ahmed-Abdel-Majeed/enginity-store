import React, { useState, useEffect } from 'react';
import {
  X,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  Send,
  TrendingUp,
  Mail,
  MessageCircle,
  Users,
  Layers
} from 'lucide-react';
import { Lang, PurchaseLikelihood } from '../types';
import { submitProductSuggestion } from '../lib/data-store';
import {
  checkSubmissionCooldown,
  recordSubmissionTimestamp,
  isHoneypotTriggered
} from '../lib/validation';
import { useModalA11y } from '../lib/use-modal-a11y';

interface ProductSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  prefillTopic?: string;
}

const SUGGESTION_PLATFORMS = [
  'n8n',
  'WhatsApp API',
  'Facebook / Instagram',
  'Telegram',
  'Shopify / WooCommerce',
  'Salla / Zid (سلة / زد)',
  'Google Sheets',
  'Google Calendar',
  'Odoo / ERP',
  'HubSpot / CRM',
  'Stripe / Paymob / XPay',
  'Gemini / OpenAI'
];

export const ProductSuggestionModal: React.FC<ProductSuggestionModalProps> = ({
  isOpen,
  onClose,
  lang,
  prefillTopic
}) => {
  const isAr = lang === 'ar';

  const [proposedName, setProposedName] = useState('');
  const [problemSolved, setProblemSolved] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [expectedFeatures, setExpectedFeatures] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['n8n']);
  const [customPlatform, setCustomPlatform] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [purchaseLikelihood, setPurchaseLikelihood] = useState<PurchaseLikelihood>('very_likely');
  const [preferredPriceRange, setPreferredPriceRange] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [contactConsent, setContactConsent] = useState(true);
  const [honeypot, setHoneypot] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ message: string; suggestionId?: string } | null>(
    null
  );

  const resetAndClose = () => {
    setSubmitted(null);
    setError(null);
    onClose();
  };

  const dialogRef = useModalA11y<HTMLDivElement>({
    isOpen,
    onClose: resetAndClose
  });

  useEffect(() => {
    if (isOpen && prefillTopic) {
      setProblemSolved(prefillTopic);
    }
  }, [isOpen, prefillTopic]);

  if (!isOpen) return null;

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(item => item !== p) : [...prev, p]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isHoneypotTriggered(honeypot)) {
      setSubmitted({
        message: isAr
          ? 'شكراً لمشاركتك! تم تسجيل اقتراح المنتج في قاعدة بيانات تطوير المتجر.'
          : 'Thank you! Your product suggestion has been recorded.'
      });
      return;
    }

    const cooldown = checkSubmissionCooldown('product_suggestion');
    if (!cooldown.allowed) {
      setError(
        isAr
          ? `يرجى الانتظار ${cooldown.remainingSeconds} ثانية قبل إرسال اقتراح آخر.`
          : `Please wait ${cooldown.remainingSeconds} seconds before submitting another suggestion.`
      );
      return;
    }

    if (!proposedName.trim() || !problemSolved.trim() || !targetAudience.trim()) {
      setError(
        isAr
          ? 'يرجى إدخال اسم المنتج المقترح، المشكلة التي يحلها، والفئة المستهدفة.'
          : 'Please enter the proposed product name, problem solved, and target audience.'
      );
      return;
    }

    if (!email.trim() && !whatsappNumber.trim()) {
      setError(
        isAr
          ? 'يرجى إدخال البريد الإلكتروني أو رقم الواتساب لإبلاغك عند توفير المنتج.'
          : 'Please provide at least an email or WhatsApp number so we can notify you when built.'
      );
      return;
    }

    if (!contactConsent) {
      setError(
        isAr
          ? 'يرجى الموافقة على إشعارك عند إطلاق هذا المنتج في المتجر.'
          : 'Please consent to receiving a launch notification if we build this product.'
      );
      return;
    }

    const platforms = [...selectedPlatforms];
    if (customPlatform.trim()) {
      platforms.push(
        ...customPlatform
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      );
    }

    setLoading(true);
    try {
      const res = await submitProductSuggestion({
        proposed_name: proposedName.trim(),
        problem_solved: problemSolved.trim(),
        target_audience: targetAudience.trim(),
        expected_features: expectedFeatures.trim(),
        platforms_integrations: platforms,
        email: email.trim(),
        whatsapp_number: whatsappNumber.trim(),
        purchase_likelihood: purchaseLikelihood,
        preferred_price_range: preferredPriceRange.trim(),
        additional_context: additionalContext.trim(),
        contact_consent: contactConsent,
        lang,
        website_url: honeypot
      });

      if (!res.success) {
        setError(res.message);
      } else {
        recordSubmissionTimestamp('product_suggestion');
        setSubmitted({ message: res.message, suggestionId: res.suggestionId });
      }
    } catch {
      setError(
        isAr
          ? 'تعذّر إرسال الاقتراح حالياً، يرجى المحاولة مرة أخرى.'
          : 'Failed to submit suggestion. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const likelihoodOptions: {
    value: PurchaseLikelihood;
    labelAr: string;
    labelEn: string;
    descAr: string;
    descEn: string;
  }[] = [
    {
      value: 'very_likely',
      labelAr: 'مرجح جداً للشراء فور توفره',
      labelEn: 'Very Likely to Buy Immediately',
      descAr: 'أحتاجه بشدة في عملي حالياً',
      descEn: 'I actively need this workflow now'
    },
    {
      value: 'likely',
      labelAr: 'مرجح للشراء',
      labelEn: 'Likely to Buy',
      descAr: 'مفيد جداً إذا كان السعر والمميزات مناسبين',
      descEn: 'Strong fit if features & price match'
    },
    {
      value: 'not_sure',
      labelAr: 'غير متأكد بعد',
      labelEn: 'Not Sure Yet',
      descAr: 'أود الاطلاع على التفاصيل عند الإطلاق',
      descEn: 'Would evaluate once launched'
    },
    {
      value: 'unlikely',
      labelAr: 'اقتراح عام فقط',
      labelEn: 'General Idea Only',
      descAr: 'أقترح الفكرة لإثراء المتجر',
      descEn: 'Sharing as a general catalog idea'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      dir={isAr ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-suggestion-modal-title"
      onClick={resetAndClose}
    >
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#0d1526] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90dvh] flex flex-col"
      >
        {/* Top Accent Line */}
        <div className="h-1 w-full bg-gradient-to-r from-[#19d3c5] via-[#2f6bff] to-[#19d3c5]" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h2 id="product-suggestion-modal-title" className="text-lg font-bold text-white">
                {isAr ? 'اقترح منتج أتمتة جديد للمتجر' : 'Suggest a New Marketplace Product'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAr
                  ? 'شاركنا فكرة القالب الذي تحتاجه لنعطيه أولوية في الإصدارات القادمة'
                  : 'Help us prioritize the next ready-made n8n workflow template'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {submitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-bold text-white">
                {isAr ? 'شكراً لمشاركتك! تم تسجيل اقتراحك' : 'Suggestion Recorded!'}
              </h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                {submitted.message}
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="px-6 py-2.5 rounded-xl bg-[#2f6bff] hover:bg-blue-600 text-white font-semibold text-sm transition-colors"
                >
                  {isAr ? 'العودة للمتجر' : 'Return to Store'}
                </button>
              </div>
            </div>
          ) : (
            <form id="product-suggestion-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Hidden Honeypot Input */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="product-suggestion-website-url">Website</label>
                <input
                  id="product-suggestion-website-url"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-300 text-xs"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Proposed Name & Target Audience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-teal-400" />
                      {isAr ? 'اسم القالب أو المنتج المقترح *' : 'Proposed Product / Template Name *'}
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    value={proposedName}
                    onChange={e => setProposedName(e.target.value)}
                    placeholder={
                      isAr
                        ? 'مثال: بوت متابعة سلات الشراء المتروكة لسلة وشوبيفاي'
                        : 'e.g. Abandoned Cart Recovery Bot for Shopify & WhatsApp'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      {isAr ? 'الفئة المستهدفة من هذا المنتج *' : 'Target Business / User *'}
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    value={targetAudience}
                    onChange={e => setTargetAudience(e.target.value)}
                    placeholder={
                      isAr
                        ? 'مثال: المتاجر الإلكترونية، العيادات، شركات الشحن...'
                        : 'e.g. E-commerce stores, clinics, real estate agencies...'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Problem Solved & Expected Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? 'ما المشكلة التي يجب أن يحلها هذا المنتج؟ *' : 'What Problem Should It Solve? *'}
                  </label>
                  <textarea
                    rows={3}
                    required
                    maxLength={2000}
                    value={problemSolved}
                    onChange={e => setProblemSolved(e.target.value)}
                    placeholder={
                      isAr
                        ? 'اشرح السيناريو والمشكلة التي سيعالجها هذا القالب...'
                        : 'Describe the core operational pain point this template solves...'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-teal-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? 'المميزات المتوقعة داخل القالب (اختياري)' : 'Expected Features (Optional)'}
                  </label>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={expectedFeatures}
                    onChange={e => setExpectedFeatures(e.target.value)}
                    placeholder={
                      isAr
                        ? 'مثال: تنبيهات تلقائية، لوحة Google Sheets، تقارير أسبوعية...'
                        : 'e.g. Auto-reminders, Google Sheets sync, Telegram admin alerts...'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-teal-500 focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Platforms & Integrations */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  {isAr ? 'المنصات والتكاملات المطلوبة' : 'Platforms & Integrations'}
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SUGGESTION_PLATFORMS.map(platform => {
                    const active = selectedPlatforms.includes(platform);
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => togglePlatform(platform)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                          active
                            ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {platform}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  maxLength={300}
                  value={customPlatform}
                  onChange={e => setCustomPlatform(e.target.value)}
                  placeholder={
                    isAr
                      ? 'منصات أخرى (افصل بفاصلة)...'
                      : 'Other platforms or tools (comma-separated)...'
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>

              {/* Self-Reported Purchase Intent Signal */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-teal-400" />
                    {isAr
                      ? 'ما مدى احتمالية شرائك لهذا المنتج في حال توفيره في المتجر؟ *'
                      : 'How likely are you to purchase this template if we build it? *'}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {isAr ? '(مؤشر اهتمام غير ملزم)' : '(Self-reported interest)'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {likelihoodOptions.map(opt => {
                    const selected = purchaseLikelihood === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPurchaseLikelihood(opt.value)}
                        className={`text-start p-2.5 rounded-xl border transition-all ${
                          selected
                            ? 'bg-blue-500/15 border-blue-500 text-white'
                            : 'bg-slate-950/60 border-slate-800/90 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold">
                          {isAr ? opt.labelAr : opt.labelEn}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {isAr ? opt.descAr : opt.descEn}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contact + Optional Price Range */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-blue-400" />
                      {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                    </span>
                  </label>
                  <input
                    type="email"
                    maxLength={254}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      {isAr ? 'رقم الواتساب' : 'WhatsApp Number'}
                    </span>
                  </label>
                  <input
                    type="tel"
                    maxLength={20}
                    value={whatsappNumber}
                    onChange={e => setWhatsappNumber(e.target.value)}
                    placeholder="+2010..."
                    dir="ltr"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? 'السعر المناسب لك (اختياري)' : 'Fair Price Range (Optional)'}
                  </label>
                  <select
                    value={preferredPriceRange}
                    onChange={e => setPreferredPriceRange(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-teal-500 focus:outline-none"
                  >
                    <option value="">{isAr ? 'اختر النطاق...' : 'Select price range...'}</option>
                    <option value="300 - 600 EGP">300 - 600 EGP</option>
                    <option value="600 - 1,200 EGP">600 - 1,200 EGP</option>
                    <option value="1,200 - 2,500 EGP">1,200 - 2,500 EGP</option>
                    <option value="2,500+ EGP">2,500+ EGP</option>
                  </select>
                </div>
              </div>

              {/* Consent */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactConsent}
                  onChange={e => setContactConsent(e.target.checked)}
                  className="mt-1 rounded border-slate-700 text-teal-500 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  {isAr
                    ? 'أوافق على حفظ بيانات التواصل لإشعاري فور إطلاق هذا المنتج أو إضافته لقسم "قريباً" في متجر ENGINITY.'
                    : 'I consent to being notified via email or WhatsApp when this suggested product is added or launched on ENGINITY.'}
                </span>
              </label>
            </form>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              form="product-suggestion-form"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-teal-500/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {loading
                  ? isAr
                    ? 'جاري الحفظ...'
                    : 'Submitting...'
                  : isAr
                  ? 'إرسال اقتراح المنتج'
                  : 'Submit Product Suggestion'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
