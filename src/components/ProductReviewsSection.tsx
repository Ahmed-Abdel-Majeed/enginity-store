import React, { useState } from 'react';
import { Star, MessageSquarePlus, CheckCircle2, AlertCircle, User, ShieldCheck, Sparkles } from 'lucide-react';
import { Lang, ProductRatingSummary, ProductReview } from '../types';
import { submitProductReview } from '../lib/data-store';

interface ProductReviewsSectionProps {
  productId: string;
  productName: string;
  lang: Lang;
  reviews: ProductReview[];
  summary: ProductRatingSummary;
  loading?: boolean;
  onRefreshReviews?: () => void;
}

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  productId,
  productName,
  lang,
  reviews,
  summary,
  loading = false,
  onRefreshReviews
}) => {
  const isAr = lang === 'ar';

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activeStarValue = hoverRating || selectedRating;

  const starLabelsAr: Record<number, string> = {
    1: 'نجمة واحدة — غير راضٍ',
    2: 'نجمتان — مقبول',
    3: '3 نجوم — جيد',
    4: '4 نجوم — ممتاز',
    5: '5 نجوم — استثنائي وعملي جداً'
  };

  const starLabelsEn: Record<number, string> = {
    1: '1 Star — Poor',
    2: '2 Stars — Fair',
    3: '3 Stars — Good',
    4: '4 Stars — Very Good',
    5: '5 Stars — Exceptional'
  };

  const handleStarKeyDown = (e: React.KeyboardEvent, star: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedRating(star);
      setErrorMsg(null);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = isAr ? Math.max(1, star - 1) : Math.min(5, star + 1);
      setSelectedRating(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = isAr ? Math.min(5, star + 1) : Math.max(1, star - 1);
      setSelectedRating(prev);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedName = customerName.trim();
    const trimmedReview = reviewText.trim();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setErrorMsg(
        isAr
          ? 'يرجى إدخال اسمك الكامل أو الاسم المستعار (من حرفين إلى 100 حرف).'
          : 'Please enter your name (2 to 100 characters).'
      );
      return;
    }

    if (!Number.isInteger(selectedRating) || selectedRating < 1 || selectedRating > 5) {
      setErrorMsg(
        isAr
          ? 'يرجى اختيار التقييم بالنجوم (من نجمة واحدة إلى 5 نجوم).'
          : 'Please select a star rating from 1 to 5 stars.'
      );
      return;
    }

    if (trimmedReview.length > 2000) {
      setErrorMsg(
        isAr
          ? 'نص المراجعة طويل جداً (الحد الأقصى 2000 حرف).'
          : 'Review text cannot exceed 2000 characters.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitProductReview({
        product_id: productId,
        customer_name: trimmedName,
        rating: selectedRating,
        review_text: trimmedReview || null,
        lang
      });

      if (!result.success) {
        setErrorMsg(result.message);
      } else {
        setSuccessMsg(result.message);
        setCustomerName('');
        setSelectedRating(0);
        setHoverRating(0);
        setReviewText('');
        if (onRefreshReviews) {
          onRefreshReviews();
        }
      }
    } catch {
      setErrorMsg(
        isAr
          ? 'حدث خطأ أثناء إرسال التقييم. يرجى المحاولة مرة أخرى.'
          : 'An unexpected error occurred while submitting your review.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '';
    }
  };

  return (
    <section
      id="product-reviews"
      className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-8"
      aria-label={isAr ? 'تقييمات ومراجعات العملاء' : 'Customer Ratings and Reviews'}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-500 flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg sm:text-xl text-slate-900">
              {isAr ? 'تقييمات ومراجعات العملاء' : 'Customer Ratings & Reviews'}
            </h2>
            <p className="text-xs text-slate-500">
              {isAr
                ? `آراء حقيقية لعملاء قاموا بتجربة "${productName}"`
                : `Verified feedback from customers regarding "${productName}"`}
            </p>
          </div>
        </div>

        {summary.totalReviews > 0 && (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-slate-900">
            <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
            <span className="font-heading font-extrabold text-sm text-slate-900">
              {summary.averageRating.toFixed(1)} / 5
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs font-bold text-slate-600">
              {isAr
                ? `${summary.totalReviews} ${summary.totalReviews === 1 ? 'تقييم' : 'تقييمات'}`
                : `${summary.totalReviews} ${summary.totalReviews === 1 ? 'review' : 'reviews'}`}
            </span>
          </div>
        )}
      </div>

      {/* Top Grid: Rating Summary & Breakdown + Review Submission Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Right Column: Rating Summary or Empty State + Approved Reviews */}
        <div className="lg:col-span-7 space-y-6">
          {loading ? (
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-3">
              <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-500">
                {isAr ? 'جاري تحميل التقييمات...' : 'Loading reviews...'}
              </p>
            </div>
          ) : summary.totalReviews === 0 ? (
            <div className="p-7 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-blue-50/40 border border-slate-200/80 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-500 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900">
                {isAr
                  ? 'لسه مفيش تقييمات — كن أول من يقيّم المنتج'
                  : 'No reviews yet — be the first to review this product'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {isAr
                  ? 'نحن نعرض فقط التقييمات الحقيقية المعتمدة للعملاء بدون أي أرقام افتراضية. شاركنا تجربتك الآن عبر النموذج المجاور!'
                  : 'We only display authentic, moderated customer reviews without fabricated ratings. Share your experience using the form!'}
              </p>
            </div>
          ) : (
            <>
              {/* Summary & Distribution Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                <div className="sm:col-span-5 text-center sm:border-e border-slate-200/80 sm:pe-5 space-y-1.5">
                  <div className="font-heading font-extrabold text-4xl sm:text-5xl text-[#0B1F3A]">
                    {summary.averageRating.toFixed(1)}
                  </div>
                  <div className="flex items-center justify-center gap-1 py-1">
                    {[1, 2, 3, 4, 5].map(star => {
                      const filled = star <= Math.round(summary.averageRating);
                      return (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            filled
                              ? 'fill-amber-400 text-amber-500'
                              : 'fill-slate-200 text-slate-300'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-xs font-bold text-slate-500">
                    {isAr
                      ? `بناءً على ${summary.totalReviews} تقييم معتمد`
                      : `Based on ${summary.totalReviews} verified ${
                          summary.totalReviews === 1 ? 'review' : 'reviews'
                        }`}
                  </p>
                </div>

                {/* 5-to-1 Star Bars */}
                <div className="sm:col-span-7 space-y-2">
                  {([5, 4, 3, 2, 1] as const).map(star => {
                    const count = summary.distribution[star] || 0;
                    const pct =
                      summary.totalReviews > 0
                        ? Math.round((count / summary.totalReviews) * 100)
                        : 0;
                    return (
                      <div key={star} className="flex items-center gap-2.5 text-xs">
                        <div className="flex items-center gap-1 w-12 shrink-0 font-bold text-slate-700">
                          <span>{star}</span>
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        </div>
                        <div className="flex-1 h-2.5 rounded-full bg-slate-200/80 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-9 text-end font-mono text-[11px] font-bold text-slate-500">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Approved Reviews List */}
              <div className="space-y-3.5">
                {reviews.map(review => (
                  <article
                    key={review.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all space-y-2.5 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#0B1F3A] text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {review.customer_name.trim().charAt(0).toUpperCase() || (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-900">
                              {review.customer_name}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold">
                              <ShieldCheck className="w-3 h-3" />
                              {isAr ? 'تقييم معتمد' : 'Verified'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatDate(review.created_at)}
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-0.5 bg-amber-50/80 px-2.5 py-1 rounded-xl border border-amber-200/60"
                        aria-label={`${review.rating} out of 5 stars`}
                      >
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= review.rating
                                ? 'fill-amber-400 text-amber-500'
                                : 'fill-slate-200 text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {review.review_text && (
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed pt-1 whitespace-pre-line">
                        {review.review_text}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Submission Form Column */}
        <div className="lg:col-span-5">
          <form
            onSubmit={handleSubmit}
            className="p-5 sm:p-6 rounded-2xl bg-[#0B1F3A] text-white border border-slate-800 shadow-lg space-y-4"
            noValidate
          >
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center shrink-0">
                <MessageSquarePlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-white">
                  {isAr ? 'أضف تقييمك للمنتج' : 'Write a Customer Review'}
                </h3>
                <p className="text-[11px] text-slate-300">
                  {isAr
                    ? 'شارك تجربتك لمساعدة أصحاب الأعمال الآخرين'
                    : 'Share your experience with this automation workflow'}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs flex items-start gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMsg}</span>
              </div>
            )}

            {/* Star Rating Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-200">
                {isAr ? 'تقييمك العام للمنتج *' : 'Your Overall Rating *'}
              </label>
              <div
                role="radiogroup"
                aria-label={isAr ? 'اختر عدد النجوم من 1 إلى 5' : 'Select star rating from 1 to 5'}
                className="flex items-center gap-2 py-1"
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map(star => {
                  const isActive = star <= activeStarValue;
                  const isSelected = star === selectedRating;
                  return (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={isAr ? `${star} نجوم` : `${star} stars`}
                      onClick={() => {
                        setSelectedRating(star);
                        setErrorMsg(null);
                      }}
                      onMouseEnter={() => setHoverRating(star)}
                      onKeyDown={e => handleStarKeyDown(e, star)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                        isActive
                          ? 'bg-amber-400/20 border-amber-400/60 scale-105'
                          : 'bg-slate-800/90 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <Star
                        className={`w-6 h-6 transition-transform ${
                          isActive
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-transparent text-slate-400'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] font-semibold text-amber-300 min-h-[1.25rem]">
                {activeStarValue > 0
                  ? isAr
                    ? starLabelsAr[activeStarValue]
                    : starLabelsEn[activeStarValue]
                  : isAr
                  ? 'اضغط على النجوم لاختيار التقييم (1 إلى 5)'
                  : 'Click a star to select your rating (1 to 5)'}
              </div>
            </div>

            {/* Customer Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="review-customer-name"
                className="block text-xs font-bold text-slate-200"
              >
                {isAr ? 'الاسم *' : 'Your Name *'}
              </label>
              <input
                id="review-customer-name"
                type="text"
                required
                maxLength={100}
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder={isAr ? 'مثال: أحمد محمود / شركة النور' : 'e.g., Ahmed Mahmoud'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-[#2F6BFF] transition-colors"
              />
            </div>

            {/* Optional Written Review */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="review-text-input"
                  className="block text-xs font-bold text-slate-200"
                >
                  {isAr ? 'مراجعتك وتجربتك (اختياري)' : 'Your Review (Optional)'}
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {reviewText.length}/2000
                </span>
              </div>
              <textarea
                id="review-text-input"
                rows={3}
                maxLength={2000}
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder={
                  isAr
                    ? 'اكتب رأيك في سهولة الإعداد، جودة الـ Workflow، أو كيف ساعدك في عملك...'
                    : 'Share how this workflow helped your business or how smooth the setup was...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-[#2F6BFF] transition-colors resize-y"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-5 rounded-xl bg-[#2F6BFF] hover:bg-blue-600 disabled:opacity-60 text-white font-heading font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isAr ? 'جاري إرسال التقييم...' : 'Submitting Review...'}</span>
                </>
              ) : (
                <>
                  <Star className="w-4 h-4 fill-white" />
                  <span>{isAr ? 'إرسال التقييم' : 'Submit Review'}</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              {isAr
                ? 'تخضع جميع المراجعات للتدقيق السريع من إدارة المتجر لضمان مصداقية وجودة التقييمات المنشورة.'
                : 'All submitted reviews are moderated before publication to ensure authentic feedback.'}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};
