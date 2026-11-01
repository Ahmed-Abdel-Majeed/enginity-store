import React, { useState, useEffect } from 'react';
import {
  Lightbulb,
  TrendingUp,
  Users,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  CheckCircle2,
  Save,
  Rocket,
  Mail,
  MessageCircle
} from 'lucide-react';
import {
  DemandAnalyticsSummary,
  ProductSuggestion,
  ProductSuggestionStatus,
  PurchaseLikelihood
} from '../../types';
import {
  fetchAdminProductSuggestions,
  updateAdminProductSuggestion,
  createProduct,
  fetchCategories
} from '../../lib/data-store';

const SUGGESTION_STATUS_META: Record<
  ProductSuggestionStatus,
  { labelAr: string; badgeClass: string }
> = {
  under_review: {
    labelAr: 'قيد المراجعة (Under Review)',
    badgeClass: 'bg-blue-500/15 border-blue-500/30 text-blue-300'
  },
  planned: {
    labelAr: 'معتمد في الخطة (Planned)',
    badgeClass: 'bg-amber-500/15 border-amber-500/30 text-amber-300'
  },
  converted_coming_soon: {
    labelAr: 'تم تحويله لمنتج قريباً (Coming Soon)',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
  },
  rejected: {
    labelAr: 'مستبعد (Rejected)',
    badgeClass: 'bg-red-500/15 border-red-500/30 text-red-300'
  }
};

const LIKELIHOOD_META: Record<
  PurchaseLikelihood,
  { labelAr: string; badgeClass: string }
> = {
  very_likely: {
    labelAr: 'مرجح جداً للشراء 🔥',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
  },
  likely: {
    labelAr: 'مرجح للشراء',
    badgeClass: 'bg-teal-500/15 border-teal-500/30 text-teal-300'
  },
  not_sure: {
    labelAr: 'غير متأكد',
    badgeClass: 'bg-slate-800 border-slate-700 text-slate-300'
  },
  unlikely: {
    labelAr: 'فكرة عامة',
    badgeClass: 'bg-slate-900 border-slate-800 text-slate-400'
  }
};

interface ProductSuggestionsListProps {
  onProductCreated?: () => void;
}

export const ProductSuggestionsList: React.FC<ProductSuggestionsListProps> = ({
  onProductCreated
}) => {
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [analytics, setAnalytics] = useState<DemandAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [editStatus, setEditStatus] = useState<ProductSuggestionStatus>('under_review');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminProductSuggestions();
      setSuggestions(data.suggestions);
      setAnalytics(data.analytics);
      if (data.suggestions.length > 0 && !selectedId) {
        selectSuggestion(data.suggestions[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectSuggestion = (item: ProductSuggestion) => {
    setSelectedId(item.id);
    setEditStatus(item.status || 'under_review');
    setEditNotes(item.admin_notes || '');
    setFeedbackMsg(null);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    setFeedbackMsg(null);
    try {
      const res = await updateAdminProductSuggestion(selectedId, {
        status: editStatus,
        admin_notes: editNotes
      });
      if (res.success) {
        await loadData();
        setFeedbackMsg('تم حفظ حالة الاقتراح وملاحظات الإدارة بنجاح.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToComingSoon = async (suggestion: ProductSuggestion) => {
    setConverting(true);
    setFeedbackMsg(null);
    try {
      const categories = await fetchCategories();
      const defaultCategoryId = categories[0]?.id || 1;
      const slugBase = suggestion.proposed_name
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 45);
      const uniqueSlug = `${slugBase || 'suggested-workflow'}-${Date.now()
        .toString()
        .slice(-4)}`;

      const created = await createProduct({
        slug: uniqueSlug,
        status: 'coming_soon',
        category_id: defaultCategoryId,
        name_ar: suggestion.proposed_name,
        name_en: suggestion.proposed_name,
        short_ar: suggestion.problem_solved,
        short_en: suggestion.problem_solved,
        description_ar: `${suggestion.problem_solved}\n\nالفئة المستهدفة: ${
          suggestion.target_audience
        }${
          suggestion.expected_features
            ? `\nالمميزات المتوقعة: ${suggestion.expected_features}`
            : ''
        }`,
        description_en: suggestion.problem_solved,
        price_egp: 500,
        tools:
          suggestion.platforms_integrations?.length > 0
            ? suggestion.platforms_integrations
            : ['n8n'],
        level: 'intermediate',
        includes_ar: ['ملف n8n JSON كامل', 'دليل إعداد وتوثيق'],
        includes_en: ['Complete n8n JSON workflow', 'Setup documentation'],
        requirements_ar: [{ name: 'n8n', desc: 'بيئة عمل n8n نشطة' }],
        requirements_en: [{ name: 'n8n', desc: 'Active n8n workspace' }],
        steps_ar: [],
        steps_en: [],
        faq: [],
        sort_order: 20,
        waitlist_enabled: true
      });

      if (created) {
        await updateAdminProductSuggestion(suggestion.id, {
          status: 'converted_coming_soon',
          converted_product_id: created.id,
          admin_notes: `${
            editNotes ? editNotes + '\n' : ''
          }[تم تحويل الاقتراح إلى منتج قريباً (Coming Soon) برقم: ${created.id}]`
        });
        await loadData();
        setEditStatus('converted_coming_soon');
        setFeedbackMsg(
          'تم تحويل الاقتراح إلى منتج "قريباً (Coming Soon)" في المتجر وتفعيل قائمة الانتظار بنجاح!'
        );
        onProductCreated?.();
      }
    } catch {
      setFeedbackMsg('تعذّر تحويل الاقتراح إلى منتج تلقائياً.');
    } finally {
      setConverting(false);
    }
  };

  const filtered = suggestions.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.proposed_name.toLowerCase().includes(q) ||
      s.problem_solved.toLowerCase().includes(q) ||
      s.target_audience.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.platforms_integrations || []).some(p => p.toLowerCase().includes(q))
    );
  });

  const selectedSuggestion =
    suggestions.find(s => s.id === selectedId) || filtered[0] || null;

  const highIntentTotal = analytics
    ? analytics.intent_distribution.very_likely +
      analytics.intent_distribution.likely
    : 0;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              مقترحات المنتجات وتحليل الطلب الفعلي
            </h2>
            <p className="text-xs text-slate-400">
              تحليل المنتجات الأكثر طلباً، قياس نية الشراء المُعلنة من العملاء، وتحويل الأفكار لمنتجات قريباً
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث التحليلات</span>
        </button>
      </div>

      {/* Analytics KPI Cards (Tabular Numerals, Derived 100% from Stored Records) */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>إجمالي المقترحات المسجلة</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {analytics.total_submissions}
            </div>
            <div className="text-[11px] text-slate-500">
              بدون تكرار لنفس العميل والفكرة
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>عملاء مهتمون مميزون</span>
              <Users className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-teal-400 tabular-nums">
              {analytics.distinct_contacts}
            </div>
            <div className="text-[11px] text-slate-500">
              بريد إلكتروني أو واتساب فريد
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>نية شراء مرتفعة (مُعلنة)</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">
              {highIntentTotal}
            </div>
            <div className="text-[11px] text-slate-500">
              مرجح جداً ({analytics.intent_distribution.very_likely}) + مرجح ({analytics.intent_distribution.likely})
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>أكثر منصة مطلوبة للربط</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-base font-bold text-white truncate">
              {analytics.top_integrations[0]?.name || '—'}
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              {analytics.top_integrations[0]
                ? `طُلبت في ${analytics.top_integrations[0].count} اقتراح`
                : 'لا توجد بيانات بعد'}
            </div>
          </div>
        </div>
      )}

      {/* Top Grouped Product Ideas & Integrations */}
      {analytics && analytics.top_ideas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                ترتيب الأفكار حسب حجم الطلب ونية الشراء المُعلنة
              </h3>
              <span className="text-[11px] text-slate-400">
                مجمّعة تلقائياً حسب تشابه الفكرة
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 font-semibold">فكرة المنتج المقترح</th>
                    <th className="py-2 font-semibold">عدد الطلبات</th>
                    <th className="py-2 font-semibold">عملاء فريدون</th>
                    <th className="py-2 font-semibold">نية شراء عالية</th>
                    <th className="py-2 font-semibold">أهم التكاملات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {analytics.top_ideas.slice(0, 5).map(group => (
                    <tr key={group.normalized_title} className="hover:bg-slate-800/30">
                      <td className="py-2.5 font-bold text-white">
                        {group.display_name}
                      </td>
                      <td className="py-2.5 tabular-nums text-slate-300">
                        {group.submissions_count}
                      </td>
                      <td className="py-2.5 tabular-nums text-teal-300 font-semibold">
                        {group.distinct_contacts_count}
                      </td>
                      <td className="py-2.5 tabular-nums text-emerald-400 font-bold">
                        {group.high_intent_count}
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {group.top_integrations.slice(0, 3).map(intg => (
                            <span
                              key={intg}
                              className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300"
                            >
                              {intg}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">
              أكثر المنصات والتكاملات طلباً
            </h3>
            <div className="space-y-2">
              {analytics.top_integrations.slice(0, 6).map(item => {
                const max = analytics.top_integrations[0]?.count || 1;
                const pct = Math.max(12, Math.round((item.count / max) * 100));
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-200 font-medium">{item.name}</span>
                      <span className="text-teal-400 font-bold tabular-nums">
                        {item.count}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-teal-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search & Status Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم المنتج المقترح، المشكلة، المنصة، أو البريد الإلكتروني..."
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-teal-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-teal-500 focus:outline-none"
        >
          <option value="all">جميع الحالات ({suggestions.length})</option>
          {(Object.keys(SUGGESTION_STATUS_META) as ProductSuggestionStatus[]).map(
            st => (
              <option key={st} value={st}>
                {SUGGESTION_STATUS_META[st].labelAr}
              </option>
            )
          )}
        </select>
      </div>

      {/* Suggestions List & Inspector */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl">
          جاري تحميل مقترحات المنتجات وتحليل الطلب...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl">
          لا توجد مقترحات منتجات حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Suggestions List */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[650px] overflow-y-auto pe-1">
            {filtered.map(item => {
              const isSelected = selectedSuggestion?.id === item.id;
              const statusBadge =
                SUGGESTION_STATUS_META[item.status] ||
                SUGGESTION_STATUS_META.under_review;
              const intentBadge =
                LIKELIHOOD_META[item.purchase_likelihood] ||
                LIKELIHOOD_META.likely;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSuggestion(item)}
                  className={`w-full text-start p-4 rounded-xl border transition-all space-y-2 ${
                    isSelected
                      ? 'bg-teal-500/10 border-teal-500/50 shadow-lg'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-bold text-white">
                      {item.proposed_name}
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBadge.badgeClass}`}
                    >
                      {statusBadge.labelAr.split('(')[0].trim()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {item.problem_solved}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${intentBadge.badgeClass}`}
                    >
                      {intentBadge.labelAr}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {new Date(item.created_at).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Detail & Conversion Action */}
          {selectedSuggestion && (
            <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedSuggestion.proposed_name}
                  </h3>
                  <div className="text-xs text-teal-400 font-medium mt-0.5">
                    الفئة المستهدفة: {selectedSuggestion.target_audience}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSuggestion.email && (
                    <a
                      href={`mailto:${selectedSuggestion.email}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span dir="ltr">{selectedSuggestion.email}</span>
                    </a>
                  )}
                  {selectedSuggestion.whatsapp_number && (
                    <a
                      href={`https://wa.me/${selectedSuggestion.whatsapp_number.replace(
                        /[^\d]/g,
                        ''
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span dir="ltr">{selectedSuggestion.whatsapp_number}</span>
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="text-xs font-bold text-slate-300">
                    المشكلة التي يحلها المنتج:
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                    {selectedSuggestion.problem_solved}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="text-xs font-bold text-teal-300">
                    المميزات المتوقعة:
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                    {selectedSuggestion.expected_features || 'غير محدد'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-1">
                    نية الشراء المُعلنة والنطاق السعري
                  </div>
                  <div className="text-xs font-bold text-emerald-400">
                    {
                      LIKELIHOOD_META[selectedSuggestion.purchase_likelihood]
                        ?.labelAr
                    }{' '}
                    {selectedSuggestion.preferred_price_range
                      ? `(${selectedSuggestion.preferred_price_range})`
                      : ''}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-1">
                    المنصات والتكاملات المطلوبة
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(selectedSuggestion.platforms_integrations || []).map(p => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-teal-300"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Admin Status & Conversion */}
              <div className="pt-3 border-t border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      حالة الاقتراح
                    </label>
                    <select
                      value={editStatus}
                      onChange={e =>
                        setEditStatus(e.target.value as ProductSuggestionStatus)
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-teal-500 focus:outline-none"
                    >
                      {(
                        Object.keys(
                          SUGGESTION_STATUS_META
                        ) as ProductSuggestionStatus[]
                      ).map(st => (
                        <option key={st} value={st}>
                          {SUGGESTION_STATUS_META[st].labelAr}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedSuggestion.status !== 'converted_coming_soon' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleConvertToComingSoon(selectedSuggestion)
                      }
                      disabled={converting}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all"
                    >
                      <Rocket className="w-4 h-4" />
                      <span>
                        {converting
                          ? 'جاري الإنشاء...'
                          : 'تحويل إلى منتج "قريباً" في المتجر'}
                      </span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    ملاحظات الإدارة الداخلية (سرية)
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="سجّل ملاحظاتك حول جدوى المنتج أو خطة إطلاقه..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-teal-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  {feedbackMsg ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      {feedbackMsg}
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2f6bff] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
