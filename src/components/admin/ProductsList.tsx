import React, { useState } from 'react';
import { Category, Product, WaitlistEntry } from '../../types';
import { Plus, Search, Eye, Edit3, Trash2, ArrowUp, ArrowDown, Rocket, Users, Mail, Phone, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';
import { formatEGPPrice } from '../../lib/utils';
import { fetchAdminWaitlist, publishAndLaunchNotifications } from '../../lib/data-store';

interface ProductsListProps {
  products: Product[];
  categories: Category[];
  onAddNew: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (product: Product) => void;
  onUpdateSortOrder: (product: Product, newOrder: number) => void;
  onRefreshProducts?: () => void;
}

export const ProductsList: React.FC<ProductsListProps> = ({
  products,
  categories,
  onAddNew,
  onEdit,
  onDelete,
  onToggleStatus,
  onUpdateSortOrder,
  onRefreshProducts
}) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'coming_soon' | 'draft'>('all');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Waitlist Inspection State
  const [selectedProductForWaitlist, setSelectedProductForWaitlist] = useState<Product | null>(null);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [waitlistError, setWaitlistError] = useState('');

  // Launch Dispatch State
  const [launchingProduct, setLaunchingProduct] = useState<Product | null>(null);
  const [dispatchingLaunch, setDispatchingLaunch] = useState(false);
  const [launchResult, setLaunchResult] = useState<{
    success: boolean;
    sentEmailCount: number;
    sentWhatsappCount: number;
    failedEmailCount: number;
    failedWhatsappCount: number;
    message?: string;
  } | null>(null);

  const filtered = products.filter(p => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch =
      !query ||
      p.name_ar.toLowerCase().includes(query.toLowerCase()) ||
      p.name_en.toLowerCase().includes(query.toLowerCase()) ||
      p.slug.toLowerCase().includes(query.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getCategoryName = (catId: number) => {
    const c = categories.find(cat => cat.id === catId);
    return c ? c.name_ar : 'عام';
  };

  const handleOpenWaitlistModal = async (product: Product) => {
    setSelectedProductForWaitlist(product);
    setLoadingWaitlist(true);
    setWaitlistError('');
    try {
      const res = await fetchAdminWaitlist(product.id);
      if (res && res.entries) {
        setWaitlistEntries(res.entries);
      } else {
        setWaitlistEntries([]);
      }
    } catch {
      setWaitlistError('تعذّر تحميل قائمة المسجلين.');
    } finally {
      setLoadingWaitlist(false);
    }
  };

  const handleConfirmLaunch = async (product: Product) => {
    setDispatchingLaunch(true);
    setLaunchResult(null);
    try {
      const res = await publishAndLaunchNotifications(product.id);
      setLaunchResult({
        success: res.success,
        sentEmailCount: res.stats?.emailSent || 0,
        sentWhatsappCount: res.stats?.whatsappSent || 0,
        failedEmailCount: res.stats?.emailFailed || 0,
        failedWhatsappCount: res.stats?.whatsappFailed || 0,
        message: res.message
      });
      if (onRefreshProducts) onRefreshProducts();
    } catch (err: any) {
      setLaunchResult({
        success: false,
        sentEmailCount: 0,
        sentWhatsappCount: 0,
        failedEmailCount: 0,
        failedWhatsappCount: 0,
        message: err.message || 'فشل إرسال إشعارات الإطلاق'
      });
    } finally {
      setDispatchingLaunch(false);
    }
  };

  return (
    <div className="space-y-6 text-start font-cairo">
      
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-white">إدارة المنتجات وقوائم الانتظار</h2>
          <p className="text-xs text-slate-400">إضافة وتعديل الـ Workflows وإطلاق المنتجات القادمة للمشتركين</p>
        </div>

        <button
          onClick={onAddNew}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة منتج جديد</span>
        </button>
      </div>

      {/* Search & Status Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute inset-y-0 start-3 my-auto" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الـ slug..."
            className="w-full ps-10 pe-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 border border-slate-800 rounded-xl text-xs font-medium">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            الكل ({products.length})
          </button>
          <button
            onClick={() => setStatusFilter('published')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'published' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            المنشورة ({products.filter(p => p.status === 'published').length})
          </button>
          <button
            onClick={() => setStatusFilter('coming_soon')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'coming_soon' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            قريباً 🚀 ({products.filter(p => p.status === 'coming_soon').length})
          </button>
          <button
            onClick={() => setStatusFilter('draft')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'draft' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            المسودات ({products.filter(p => p.status === 'draft').length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/50">
        <table className="w-full text-xs text-start">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
            <tr>
              <th className="p-3.5">الترتيب</th>
              <th className="p-3.5">المنتج</th>
              <th className="p-3.5">التصنيف</th>
              <th className="p-3.5">السعر (EGP)</th>
              <th className="p-3.5">الحالة</th>
              <th className="p-3.5 text-end">إجراءات الإدارة والإطلاق</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  لا توجد منتجات تطابق الفلترة الحالية.
                </td>
              </tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                  
                  {/* Sort Order */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-1 font-mono">
                      <span className="w-6 text-slate-400">{p.sort_order}</span>
                      <button
                        onClick={() => onUpdateSortOrder(p, p.sort_order - 1)}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                        title="رفع"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onUpdateSortOrder(p, p.sort_order + 1)}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                        title="خفض"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </td>

                  {/* Product Title & Slug */}
                  <td className="p-3.5 space-y-0.5 max-w-xs">
                    <div className="font-bold text-white truncate">{p.name_ar}</div>
                    <div className="font-mono text-[10px] text-slate-500 truncate">{p.slug}</div>
                  </td>

                  {/* Category */}
                  <td className="p-3.5 text-slate-400">
                    {getCategoryName(p.category_id)}
                  </td>

                  {/* Price EGP */}
                  <td className="p-3.5 font-bold font-mono text-emerald-400">
                    {formatEGPPrice(p.price_egp)} ج.م
                  </td>

                  {/* Status Toggle & Badges */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleStatus(p)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          p.status === 'published'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900'
                            : p.status === 'coming_soon'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800 hover:bg-amber-900'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {p.status === 'published'
                          ? 'منشور'
                          : p.status === 'coming_soon'
                          ? 'قريباً 🚀'
                          : 'مسودة'}
                      </button>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="p-3.5 text-end">
                    <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                      
                      {/* Launch Button for Coming Soon Products */}
                      {p.status === 'coming_soon' && (
                        <>
                          <button
                            onClick={() => handleOpenWaitlistModal(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-300 text-[11px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 border border-amber-700/50"
                            title="عرض المشتركين في قائمة الانتظار"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>المشتركون</span>
                          </button>

                          <button
                            onClick={() => setLaunchingProduct(p)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-md"
                            title="إطلاق المنتج وإرسال التنبيهات"
                          >
                            <Rocket className="w-3.5 h-3.5" />
                            <span>إطلاق وتنبيه</span>
                          </button>
                        </>
                      )}

                      <a
                        href={`/ar/products/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                        title="معاينة حية"
                      >
                        <Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </a>

                      <button
                        onClick={() => onEdit(p)}
                        className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-300 transition-colors cursor-pointer shrink-0"
                        title="تعديل"
                      >
                        <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </button>

                      <button
                        onClick={() => setDeleteTargetId(p.id)}
                        className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 transition-colors cursor-pointer shrink-0"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                  </td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal 1: Waitlist Subscribers List */}
      {selectedProductForWaitlist && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-heading font-extrabold text-base text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <span>المشتركون في قائمة انتظار: {selectedProductForWaitlist.name_ar}</span>
                </h3>
                <p className="text-xs text-slate-400">إجمالي الراغبين في التنبيه عند الإطلاق</p>
              </div>
              <button
                onClick={() => setSelectedProductForWaitlist(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pe-1">
              {loadingWaitlist ? (
                <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>جاري تحميل المشتركين...</span>
                </div>
              ) : waitlistError ? (
                <div className="p-4 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl">
                  {waitlistError}
                </div>
              ) : waitlistEntries.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  لا يوجد مشتركون مسجلون في قائمة الانتظار حتى الآن.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {waitlistEntries.map(entry => (
                    <div key={entry.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-1">
                        {entry.email && (
                          <div className="flex items-center gap-2 text-slate-200 font-mono">
                            <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>{entry.email}</span>
                          </div>
                        )}
                        {entry.whatsapp_number && (
                          <div className="flex items-center gap-2 text-slate-300 font-mono">
                            <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span dir="ltr">{entry.whatsapp_number}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-800 font-mono">
                          {entry.created_at ? new Date(entry.created_at).toLocaleDateString('ar-EG') : ''}
                        </span>
                        {entry.email_status === 'sent' || entry.whatsapp_status === 'sent' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            تم التنبيه
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                            في الانتظار
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedProductForWaitlist(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Launch & Dispatch Confirmation */}
      {launchingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-heading font-extrabold text-lg text-white flex items-center gap-2">
              <Rocket className="w-5 h-5 text-emerald-400" />
              <span>إطلاق المنتج وإرسال التنبيهات</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              عند إطلاق المنتج <b className="text-white">"{launchingProduct.name_ar}"</b>:
              <br />
              1. سيتم تحويل حالة المنتج تلقائياً إلى <span className="text-emerald-400 font-bold">منشور (Published)</span> وتفعيل زر الشراء.
              <br />
              2. سيتم إرسال إشعار الإطلاق المخصص عبر الإيميل والواتساب لكل المشتركين المسجلين في قائمة الانتظار.
            </p>

            {launchResult ? (
              <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                launchResult.success ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200' : 'bg-red-950/80 border-red-800 text-red-200'
              }`}>
                <div className="font-bold flex items-center gap-1.5">
                  {launchResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                  <span>{launchResult.message || (launchResult.success ? 'تم الإطلاق بنجاح!' : 'حدث خطأ')}</span>
                </div>

                {launchResult.success && (
                  <div className="space-y-1 pt-1 font-mono text-[11px] text-slate-300">
                    <div>إيميلات تم الإرسال لها: {launchResult.sentEmailCount} (فشل: {launchResult.failedEmailCount})</div>
                    <div>واتساب تم الإرسال له: {launchResult.sentWhatsappCount} (فشل: {launchResult.failedWhatsappCount})</div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setLaunchingProduct(null);
                  setLaunchResult(null);
                }}
                disabled={dispatchingLaunch}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                {launchResult ? 'إغلاق' : 'إلغاء'}
              </button>

              {!launchResult && (
                <button
                  onClick={() => handleConfirmLaunch(launchingProduct)}
                  disabled={dispatchingLaunch}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {dispatchingLaunch ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري الإطلاق والإرسال...</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      <span>تأكيد الإطلاق والتنبيه</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-heading font-extrabold text-lg text-white">تأكيد حذف المنتج</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              هل أنت تأكد من حذف هذا المنتج نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  onDelete(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 cursor-pointer"
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
