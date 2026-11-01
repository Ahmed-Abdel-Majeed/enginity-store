import React, { useEffect, useState } from 'react';
import { Product, ProductReview, ProductReviewStatus } from '../../types';
import {
  fetchAdminReviews,
  updateAdminReviewStatus,
  deleteAdminReview
} from '../../lib/data-store';
import {
  Star,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  Search,
  MessageSquareQuote,
  Clock,
  ShieldCheck,
  AlertCircle,
  Filter
} from 'lucide-react';

interface ReviewsListProps {
  products: Product[];
}

export const ReviewsList: React.FC<ReviewsListProps> = ({ products }) => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductReviewStatus>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const loadReviews = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminReviews();
      setReviews(data);
    } catch (err: any) {
      setError(err.message || 'تعذّر تحميل التقييمات والمراجعات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const getProductInfo = (productId: string) => {
    const found = products.find(p => p.id === productId);
    return {
      name: found ? found.name_ar : 'منتج غير معروف',
      slug: found ? found.slug : ''
    };
  };

  const handleModerate = async (id: string, status: ProductReviewStatus) => {
    setActionLoadingId(id);
    setError('');
    try {
      const res = await updateAdminReviewStatus(id, status);
      if (res.success && res.review) {
        setReviews(prev => prev.map(r => (r.id === id ? res.review! : r)));
      } else {
        setError(res.message || 'تعذّر تحديث حالة التقييم.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحديث التقييم.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoadingId(id);
    setError('');
    try {
      const res = await deleteAdminReview(id);
      if (res.success) {
        setReviews(prev => prev.filter(r => r.id !== id));
      } else {
        setError(res.message || 'تعذّر حذف التقييم.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حذف التقييم.');
    } finally {
      setActionLoadingId(null);
      setDeleteTargetId(null);
    }
  };

  const filteredReviews = reviews.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesProduct = productFilter === 'all' || r.product_id === productFilter;
    const pInfo = getProductInfo(r.product_id);
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.customer_name.toLowerCase().includes(q) ||
      (r.review_text || '').toLowerCase().includes(q) ||
      pInfo.name.toLowerCase().includes(q);
    return matchesStatus && matchesProduct && matchesSearch;
  });

  const pendingCount = reviews.filter(r => r.status === 'pending').length;
  const approvedCount = reviews.filter(r => r.status === 'approved').length;
  const rejectedCount = reviews.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6 text-start font-cairo">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-white flex items-center gap-2">
            <MessageSquareQuote className="w-5 h-5 text-amber-400" />
            <span>إدارة التقييمات ومراجعات العملاء</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            مراجعة واعتماد تقييمات العملاء قبل ظهورها في صفحات المنتجات وحساب متوسط التقييم
          </p>
        </div>

        <button
          onClick={loadReviews}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          <span>تحديث القائمة</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] text-slate-400 font-semibold">إجمالي التقييمات</div>
          <div className="text-2xl font-extrabold text-white font-mono mt-1">{reviews.length}</div>
        </div>
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4">
          <div className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>بانتظار المراجعة</span>
          </div>
          <div className="text-2xl font-extrabold text-amber-400 font-mono mt-1">{pendingCount}</div>
        </div>
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-4">
          <div className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>معتمدة ومنشورة</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">{approvedCount}</div>
        </div>
        <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4">
          <div className="text-[11px] text-red-300 font-semibold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>مرفوضة</span>
          </div>
          <div className="text-2xl font-extrabold text-red-400 font-mono mt-1">{rejectedCount}</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute inset-y-0 start-3 my-auto" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم العميل، نص التقييم، أو اسم المنتج..."
            className="w-full ps-10 pe-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={productFilter}
            onChange={e => setProductFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
          >
            <option value="all">كل المنتجات</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name_ar}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 border border-slate-800 rounded-xl text-xs font-medium">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            الكل ({reviews.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'pending' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            قيد المراجعة ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'approved' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            معتمدة ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'rejected' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            مرفوضة ({rejectedCount})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/70 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reviews List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2 bg-slate-900/40 border border-slate-800 rounded-xl">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
          <span>جاري تحميل التقييمات...</span>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/40 border border-slate-800 rounded-xl">
          لا توجد تقييمات تطابق معايير البحث أو الفلترة الحالية.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReviews.map(rev => {
            const pInfo = getProductInfo(rev.product_id);
            const isBusy = actionLoadingId === rev.id;

            return (
              <div
                key={rev.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 sm:p-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  {/* Top Meta Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-white">{rev.customer_name}</span>

                    {/* Stars */}
                    <div className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-800/60">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= rev.rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-700 fill-slate-700'
                          }`}
                        />
                      ))}
                      <span className="ms-1 text-[11px] font-bold text-amber-300 font-mono">
                        {rev.rating}/5
                      </span>
                    </div>

                    {/* Status Badge */}
                    {rev.status === 'approved' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                        معتمد ومنشور
                      </span>
                    ) : rev.status === 'rejected' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold">
                        مرفوض
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-bold">
                        بانتظار المراجعة
                      </span>
                    )}

                    {/* Date */}
                    <span className="text-[11px] text-slate-500 font-mono">
                      {rev.created_at
                        ? new Date(rev.created_at).toLocaleString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : ''}
                    </span>
                  </div>

                  {/* Product Link */}
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span>المنتج:</span>
                    {pInfo.slug ? (
                      <a
                        href={`/ar/products/${pInfo.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline font-semibold"
                      >
                        {pInfo.name}
                      </a>
                    ) : (
                      <span className="text-slate-300 font-semibold">{pInfo.name}</span>
                    )}
                  </div>

                  {/* Review Text */}
                  {rev.review_text ? (
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
                      {rev.review_text}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 italic">تقييم بالنجوم فقط (بدون تعليق نصي)</p>
                  )}
                </div>

                {/* Moderation Actions */}
                <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0">
                  {rev.status !== 'approved' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleModerate(rev.id, 'approved')}
                      className="w-full sm:w-32 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>اعتماد ونشر</span>
                    </button>
                  )}

                  {rev.status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleModerate(rev.id, 'rejected')}
                      className="w-full sm:w-32 px-3 py-2 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-700/60 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>رفض وإخفاء</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setDeleteTargetId(rev.id)}
                    className="w-full sm:w-32 px-3 py-2 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800/60 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف نهائي</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-heading font-extrabold text-lg text-white">تأكيد حذف التقييم</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              هل أنت متأكد من حذف هذا التقييم نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteTargetId)}
                disabled={actionLoadingId === deleteTargetId}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 cursor-pointer disabled:opacity-50"
              >
                حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
