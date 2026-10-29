import React, { useState } from 'react';
import { Product, Lang } from '../types';
import { Translations } from '../i18n/ar';
import { registerWaitlistInterest } from '../lib/data-store';
import { Bell, Mail, MessageCircle, X, CheckCircle2, ShieldCheck, Calendar, AlertCircle } from 'lucide-react';

interface WaitlistModalProps {
  product: Product;
  lang: Lang;
  t: Translations;
  onClose: () => void;
}

export const WaitlistModal: React.FC<WaitlistModalProps> = ({
  product,
  lang,
  t,
  onClose
}) => {
  const isRtl = lang === 'ar';
  const name = isRtl ? product.name_ar : product.name_en;

  const [emailConsent, setEmailConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [email, setEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!emailConsent && !whatsappConsent) {
      setErrorMessage(
        isRtl
          ? 'يرجى اختيار قناة تنبيه واحدة على الأقل والموافقة الصريحة عليها.'
          : 'Please select at least one notification channel with explicit consent.'
      );
      return;
    }

    if (emailConsent && !email.trim()) {
      setErrorMessage(
        isRtl ? 'يرجى إدخال البريد الإلكتروني الخاص بك.' : 'Please enter your email address.'
      );
      return;
    }

    if (whatsappConsent && !whatsappNumber.trim()) {
      setErrorMessage(
        isRtl ? 'يرجى إدخال رقم الواتساب الخاص بك.' : 'Please enter your WhatsApp phone number.'
      );
      return;
    }

    setLoading(true);

    try {
      const res = await registerWaitlistInterest({
        productId: product.id,
        email: emailConsent ? email.trim() : undefined,
        whatsappNumber: whatsappConsent ? whatsappNumber.trim() : undefined,
        emailConsent,
        whatsappConsent,
        lang
      });

      if (res.success) {
        setSuccessMessage(res.message);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err) {
      setErrorMessage(isRtl ? 'حدث خطأ أثناء التسجيل. حاول مرة أخرى.' : 'Registration error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-cairo animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 relative text-start overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2F6BFF] flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-slate-900 leading-snug">
                {isRtl ? 'تنبيهي عند إطلاق المنتج' : 'Notify Me at Launch'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isRtl ? 'قائمة انتظار واستلام إشعار الإطلاق' : 'Join waitlist for launch notification'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Preview Header */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3.5">
          {product.cover_path || product.diagram_path ? (
            <img
              src={product.cover_path || product.diagram_path || ''}
              alt={name}
              className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-900"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[#0B1F3A] text-white flex items-center justify-center font-mono font-bold text-sm shrink-0">
              ⚡
            </div>
          )}
          <div className="space-y-1">
            <div className="font-heading font-extrabold text-sm text-slate-900 line-clamp-1">
              <bdi dir="auto">{name}</bdi>
            </div>
            {product.expected_launch_date ? (
              <div className="flex items-center gap-1.5 text-xs text-[#2F6BFF] font-bold">
                <Calendar className="w-3.5 h-3.5" />
                <span>{isRtl ? `موعد الإطلاق المتوقع: ${product.expected_launch_date}` : `Expected Launch: ${product.expected_launch_date}`}</span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 font-medium">
                {isRtl ? 'قيد التطوير والاختبار المتقدم' : 'In final testing & engineering'}
              </div>
            )}
          </div>
        </div>

        {/* Form Body or Success State */}
        {successMessage ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-heading font-bold text-base text-emerald-900">
                {isRtl ? 'تم تسجيل طلبك بنجاح!' : 'Request Registered Successfully!'}
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                {successMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isRtl ? 'تم، إغلاق' : 'Close'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {errorMessage && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Email Channel Block */}
            <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailConsent}
                  onChange={e => setEmailConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#2F6BFF] rounded border-slate-300 focus:ring-[#2F6BFF]"
                />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#2F6BFF]" />
                    <span>{isRtl ? 'التنبيه عبر البريد الإلكتروني' : 'Email Notification'}</span>
                  </div>
                  <div className="text-slate-500">
                    {isRtl
                      ? 'أوافق على استلام إشعار عبر الإيميل عند إطلاق وتوفر هذا المنتج.'
                      : 'I agree to receive an email notification when this product launches.'}
                  </div>
                </div>
              </label>

              {emailConsent && (
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#2F6BFF]/30 focus:border-[#2F6BFF]"
                />
              )}
            </div>

            {/* WhatsApp Channel Block */}
            <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappConsent}
                  onChange={e => setWhatsappConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isRtl ? 'التنبيه عبر الواتساب' : 'WhatsApp Notification'}</span>
                  </div>
                  <div className="text-slate-500">
                    {isRtl
                      ? 'أوافق على استلام رسالة واتساب عند توفر المنتج للشراء.'
                      : 'I agree to receive a WhatsApp notification when this product launches.'}
                  </div>
                </div>
              </label>

              {whatsappConsent && (
                <div>
                  <input
                    type="tel"
                    value={whatsappNumber}
                    onChange={e => setWhatsappNumber(e.target.value)}
                    placeholder={isRtl ? '01012345678 أو +201012345678' : '+201012345678'}
                    className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-slate-900 text-xs font-mono focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    {isRtl ? 'يدعم الأرقام المصرية والدولية مع كود الدولة' : 'Supports local & international formats with country code'}
                  </div>
                </div>
              )}
            </div>

            {/* Privacy Notice */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {isRtl
                  ? 'بياناتك مشفرة ومحفوظة بخصوصية. لن نستخدم بياناتك لإعلانات غير متعلقة بالمنتج.'
                  : 'Your data is encrypted & private. We only notify you about this product launch.'}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#2F6BFF] hover:bg-[#1a56e8] active:bg-[#1546c2] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>{isRtl ? 'جاري التسجيل...' : 'Registering...'}</span>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>{isRtl ? 'تأكيد طلب التنبيه' : 'Confirm Launch Alert'}</span>
                </>
              )}
            </button>

          </form>
        )}

      </div>
    </div>
  );
};
