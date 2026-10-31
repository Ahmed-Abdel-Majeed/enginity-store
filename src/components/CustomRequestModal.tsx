import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Send,
  Sparkles,
  Mail,
  MessageCircle,
  Building2,
  Clock,
  Wallet
} from 'lucide-react';
import { Lang } from '../types';
import { submitCustomRequest } from '../lib/data-store';
import {
  checkSubmissionCooldown,
  recordSubmissionTimestamp,
  isHoneypotTriggered
} from '../lib/validation';
import { useModalA11y } from '../lib/use-modal-a11y';

interface CustomRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  prefillTopic?: string;
}

const COMMON_TOOLS = [
  'n8n',
  'WhatsApp (Evolution / Cloud API)',
  'Facebook Messenger',
  'Instagram DM',
  'Telegram',
  'Google Sheets',
  'Google Calendar',
  'Gmail',
  'OpenAI / Gemini',
  'Shopify / WooCommerce',
  'Odoo / CRM',
  'Webhook / REST API'
];

export const CustomRequestModal: React.FC<CustomRequestModalProps> = ({
  isOpen,
  onClose,
  lang,
  prefillTopic
}) => {
  const isAr = lang === 'ar';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessProblem, setBusinessProblem] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>(['n8n']);
  const [customToolInput, setCustomToolInput] = useState('');
  const [expectedFeatures, setExpectedFeatures] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [deliveryTimeframe, setDeliveryTimeframe] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [honeypot, setHoneypot] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ message: string; requestId?: string } | null>(null);

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
      setBusinessProblem(prefillTopic);
    }
  }, [isOpen, prefillTopic]);

  if (!isOpen) return null;

  const toggleTool = (tool: string) => {
    setSelectedTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isHoneypotTriggered(honeypot)) {
      setSubmitted({
        message: isAr
          ? 'تم استلام طلب الأتمتة المخصص بنجاح! سيتواصل معك فريقنا الهندسي قريباً.'
          : 'Your custom automation request has been received!'
      });
      return;
    }

    const cooldown = checkSubmissionCooldown('custom_request');
    if (!cooldown.allowed) {
      setError(
        isAr
          ? `يرجى الانتظار ${cooldown.remainingSeconds} ثانية قبل إرسال طلب آخر.`
          : `Please wait ${cooldown.remainingSeconds} seconds before submitting another request.`
      );
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(
        isAr
          ? 'يرجى إدخال بريد إلكتروني صحيح للتواصل معك بخصوص عرض السعر.'
          : 'Please enter a valid email address so we can send your quote.'
      );
      return;
    }

    if (!businessType.trim() || !businessProblem.trim() || !desiredOutcome.trim()) {
      setError(
        isAr
          ? 'يرجى استكمال نوع النشاط، المشكلة الحالية، والنتيجة المطلوبة.'
          : 'Please fill in your business type, current problem, and desired outcome.'
      );
      return;
    }

    if (!marketingConsent) {
      setError(
        isAr
          ? 'يرجى الموافقة على التواصل معك لمناقشة تفاصيل طلبك وعرض السعر.'
          : 'Please consent to being contacted regarding your custom automation request.'
      );
      return;
    }

    const allTools = [...selectedTools];
    if (customToolInput.trim()) {
      allTools.push(
        ...customToolInput
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      );
    }

    setLoading(true);
    try {
      const res = await submitCustomRequest({
        name: name.trim(),
        email: email.trim(),
        whatsapp_number: whatsappNumber.trim(),
        business_type: businessType.trim(),
        business_problem: businessProblem.trim(),
        desired_outcome: desiredOutcome.trim(),
        current_tools: allTools,
        expected_features: expectedFeatures.trim(),
        budget_range: budgetRange.trim(),
        delivery_timeframe: deliveryTimeframe.trim(),
        additional_notes: additionalNotes.trim(),
        marketing_consent: marketingConsent,
        lang,
        website_url: honeypot
      });

      if (!res.success) {
        setError(res.message);
      } else {
        recordSubmissionTimestamp('custom_request');
        setSubmitted({ message: res.message, requestId: res.requestId });
      }
    } catch {
      setError(
        isAr
          ? 'حدث خطأ غير متوقع أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.'
          : 'An unexpected error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      dir={isAr ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-request-modal-title"
      onClick={resetAndClose}
    >
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#0d1526] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90dvh] flex flex-col"
      >
        {/* Top Accent Line */}
        <div className="h-1 w-full bg-gradient-to-r from-[#2f6bff] via-[#19d3c5] to-[#2f6bff]" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 id="custom-request-modal-title" className="text-lg font-bold text-white">
                {isAr ? 'طلب بناء نظام أتمتة مخصص' : 'Request a Custom Automation System'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAr
                  ? 'صمّم workflow متكامل ومفصل خصيصاً لدورة عمل شركتك'
                  : 'Get a production-grade workflow engineered specifically for your business'}
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
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-bold text-white">
                {isAr ? 'تم استلام طلب الأتمتة المخصص بنجاح!' : 'Custom Request Received!'}
              </h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                {submitted.message}
              </p>
              {submitted.requestId && (
                <div className="inline-block px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
                  {isAr ? 'رقم المرجع: ' : 'Reference ID: '}
                  <span className="text-blue-400">{submitted.requestId.slice(0, 8)}</span>
                </div>
              )}
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
            <form id="custom-request-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Hidden Honeypot Input */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="custom-request-website-url">Website</label>
                <input
                  id="custom-request-website-url"
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

              {/* Contact Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? 'الاسم أو اسم الشركة' : 'Your Name / Company'}
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={isAr ? 'مثال: أحمد / شركة نماء' : 'e.g. Ahmed / Namaa Co.'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-blue-400" />
                      {isAr ? 'البريد الإلكتروني *' : 'Email Address *'}
                    </span>
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      {isAr ? 'رقم الواتساب (اختياري)' : 'WhatsApp Number'}
                    </span>
                  </label>
                  <input
                    type="tel"
                    maxLength={20}
                    value={whatsappNumber}
                    onChange={e => setWhatsappNumber(e.target.value)}
                    placeholder="+2010..."
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Business Type */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    {isAr ? 'مجال العمل أو نوع النشاط التجاري *' : 'Business Type / Industry *'}
                  </span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={businessType}
                  onChange={e => setBusinessType(e.target.value)}
                  placeholder={
                    isAr
                      ? 'مثال: عيادة طبية، متجر إلكتروني، شركة عقارات، وكالة تسويق...'
                      : 'e.g. Medical Clinic, E-Commerce Store, Real Estate Agency, SaaS...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Problem & Outcome */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr
                      ? 'المشكلة الحالية أو المهام اليدوية المرهقة *'
                      : 'Current Business Problem / Manual Bottleneck *'}
                  </label>
                  <textarea
                    rows={3}
                    required
                    maxLength={2000}
                    value={businessProblem}
                    onChange={e => setBusinessProblem(e.target.value)}
                    placeholder={
                      isAr
                        ? 'اشرح ما الذي يستهلك وقت فريقك حالياً أو المشكلة التي تواجهها...'
                        : 'Describe the manual process or bottleneck slowing your team down...'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr
                      ? 'النتيجة المطلوبة وسير العمل المتوقع *'
                      : 'Desired Automation Outcome *'}
                  </label>
                  <textarea
                    rows={3}
                    required
                    maxLength={2000}
                    value={desiredOutcome}
                    onChange={e => setDesiredOutcome(e.target.value)}
                    placeholder={
                      isAr
                        ? 'كيف تريد أن يعمل النظام تلقائياً من البداية للنهاية؟'
                        : 'What should happen automatically from trigger to completion?'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Tools & Platforms */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  {isAr
                    ? 'الأدوات والمنصات المطلوب ربطها'
                    : 'Platforms & Tools Involved'}
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_TOOLS.map(tool => {
                    const active = selectedTools.includes(tool);
                    return (
                      <button
                        key={tool}
                        type="button"
                        onClick={() => toggleTool(tool)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                          active
                            ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tool}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  maxLength={300}
                  value={customToolInput}
                  onChange={e => setCustomToolInput(e.target.value)}
                  placeholder={
                    isAr
                      ? 'أدوات إضافية أخرى (افصل بينها بفاصلة)...'
                      : 'Other tools or APIs (comma-separated)...'
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Budget & Timeframe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    <span className="inline-flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-teal-400" />
                      {isAr ? 'الميزانية التقديرية (اختياري)' : 'Estimated Budget (Optional)'}
                    </span>
                  </label>
                  <select
                    value={budgetRange}
                    onChange={e => setBudgetRange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">{isAr ? 'اختر النطاق التقريبي...' : 'Select budget range...'}</option>
                    <option value="1,500 - 3,000 EGP">1,500 - 3,000 EGP ($30 - $60)</option>
                    <option value="3,000 - 7,500 EGP">3,000 - 7,500 EGP ($60 - $150)</option>
                    <option value="7,500 - 15,000 EGP">7,500 - 15,000 EGP ($150 - $300)</option>
                    <option value="15,000+ EGP (Enterprise)">
                      {isAr ? 'أكثر من 15,000 ج.م (نظام متكامل للشركات)' : '15,000+ EGP (Full Enterprise System)'}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      {isAr ? 'الوقت المتوقع للتسليم' : 'Preferred Delivery Timeframe'}
                    </span>
                  </label>
                  <select
                    value={deliveryTimeframe}
                    onChange={e => setDeliveryTimeframe(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">{isAr ? 'اختر الإطار الزمني...' : 'Select timeframe...'}</option>
                    <option value="urgent_3_days">{isAr ? 'عاجل (خلال 3 - 5 أيام)' : 'Urgent (3 - 5 days)'}</option>
                    <option value="1_2_weeks">{isAr ? 'خلال أسبوع إلى أسبوعين' : '1 - 2 weeks'}</option>
                    <option value="flexible">{isAr ? 'مرن حسب خطة التنفيذ' : 'Flexible'}</option>
                  </select>
                </div>
              </div>

              {/* Additional Features / Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {isAr ? 'ملاحظات أو تفاصيل تقنية إضافية (اختياري)' : 'Additional Technical Notes (Optional)'}
                </label>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={additionalNotes}
                  onChange={e => setAdditionalNotes(e.target.value)}
                  placeholder={
                    isAr
                      ? 'أي تفاصيل أخرى حول حجم الرسائل اليومي أو الأنظمة الداخلية...'
                      : 'Any extra details about daily volume, hosting preference, or APIs...'
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              {/* Explicit Consent */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={e => setMarketingConsent(e.target.checked)}
                  className="mt-1 rounded border-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  {isAr
                    ? 'أوافق على قيام فريق ENGINITY بالتواصل معي عبر البريد الإلكتروني أو الواتساب لمناقشة التفاصيل الفنية وعرض السعر المخصص لطلبي.'
                    : 'I agree to be contacted by the ENGINITY engineering team via email or WhatsApp regarding technical specifications and a custom quote.'}
                </span>
              </label>
            </form>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>
                {isAr
                  ? 'مراجعة هندسية مجانية خلال 24 ساعة'
                  : 'Free engineering review within 24 hours'}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={resetAndClose}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                form="custom-request-form"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2f6bff] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/25"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {loading
                    ? isAr
                      ? 'جاري إرسال الطلب...'
                      : 'Submitting...'
                    : isAr
                    ? 'إرسال طلب الأتمتة المخصص'
                    : 'Submit Custom Request'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
