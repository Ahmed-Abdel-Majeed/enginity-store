import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Search,
  RefreshCw,
  Mail,
  MessageCircle,
  Calendar,
  Building2,
  Wallet,
  Clock,
  Save,
  CheckCircle2
} from 'lucide-react';
import { CustomAutomationRequest, CustomRequestStatus } from '../../types';
import {
  fetchAdminCustomRequests,
  updateAdminCustomRequest
} from '../../lib/data-store';

const STATUS_LABELS: Record<
  CustomRequestStatus,
  { labelAr: string; badgeClass: string }
> = {
  new: {
    labelAr: 'جديد (New)',
    badgeClass: 'bg-blue-500/15 border-blue-500/30 text-blue-300'
  },
  reviewing: {
    labelAr: 'قيد المراجعة (Reviewing)',
    badgeClass: 'bg-amber-500/15 border-amber-500/30 text-amber-300'
  },
  needs_clarification: {
    labelAr: 'يحتاج توضيح (Needs Clarification)',
    badgeClass: 'bg-purple-500/15 border-purple-500/30 text-purple-300'
  },
  quoted: {
    labelAr: 'تم إرسال عرض سعر (Quoted)',
    badgeClass: 'bg-teal-500/15 border-teal-500/30 text-teal-300'
  },
  accepted: {
    labelAr: 'مقبول / قيد التنفيذ (Accepted)',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
  },
  rejected: {
    labelAr: 'مرفوض / ملغي (Rejected)',
    badgeClass: 'bg-red-500/15 border-red-500/30 text-red-300'
  },
  completed: {
    labelAr: 'مكتمل (Completed)',
    badgeClass: 'bg-emerald-600/20 border-emerald-500/40 text-emerald-200'
  }
};

export const CustomRequestsList: React.FC = () => {
  const [requests, setRequests] = useState<CustomAutomationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [editStatus, setEditStatus] = useState<CustomRequestStatus>('new');
  const [editQuote, setEditQuote] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await fetchAdminCustomRequests();
      setRequests(list);
      if (list.length > 0 && !selectedId) {
        selectRequest(list[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectRequest = (req: CustomAutomationRequest) => {
    setSelectedId(req.id);
    setEditStatus(req.status || 'new');
    setEditQuote(
      req.estimated_quote_egp !== null && req.estimated_quote_egp !== undefined
        ? String(req.estimated_quote_egp)
        : ''
    );
    setEditNotes(req.admin_notes || '');
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const quoteNum =
        editQuote.trim() !== '' && !isNaN(Number(editQuote))
          ? Number(editQuote)
          : null;

      const res = await updateAdminCustomRequest(selectedId, {
        status: editStatus,
        admin_notes: editNotes,
        estimated_quote_egp: quoteNum
      });

      if (res.success && res.request) {
        setRequests(prev =>
          prev.map(r => (r.id === selectedId ? res.request! : r))
        );
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.name && r.name.toLowerCase().includes(q)) ||
      r.email.toLowerCase().includes(q) ||
      (r.whatsapp_number && r.whatsapp_number.toLowerCase().includes(q)) ||
      r.business_type.toLowerCase().includes(q) ||
      r.business_problem.toLowerCase().includes(q) ||
      r.desired_outcome.toLowerCase().includes(q)
    );
  });

  const selectedRequest =
    requests.find(r => r.id === selectedId) || filtered[0] || null;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              إدارة طلبات أنظمة الأتمتة المخصصة
            </h2>
            <p className="text-xs text-slate-400">
              مراجعة طلبات العملاء، تحديد عروض الأسعار، ومتابعة حالة التنفيذ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
            إجمالي الطلبات:{' '}
            <span className="font-bold text-white tabular-nums">
              {requests.length}
            </span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم، الإيميل، رقم الواتساب، نوع النشاط، أو المشكلة..."
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:border-blue-500 focus:outline-none"
        >
          <option value="all">جميع الحالات ({requests.length})</option>
          {(Object.keys(STATUS_LABELS) as CustomRequestStatus[]).map(st => (
            <option key={st} value={st}>
              {STATUS_LABELS[st].labelAr}
            </option>
          ))}
        </select>
      </div>

      {/* Main Split View */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl">
          جاري تحميل الطلبات المخصصة...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl">
          لا توجد طلبات أتمتة مخصصة تطابق بحثك حالياً.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Requests List */}
          <div className="lg:col-span-5 space-y-2.5 max-h-[680px] overflow-y-auto pe-1">
            {filtered.map(req => {
              const isSelected = selectedRequest?.id === req.id;
              const badge = STATUS_LABELS[req.status] || STATUS_LABELS.new;
              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => selectRequest(req)}
                  className={`w-full text-start p-4 rounded-xl border transition-all space-y-2 ${
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500/50 shadow-lg'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-white">
                        {req.name || req.email}
                      </div>
                      <div className="text-xs text-blue-400 font-medium">
                        {req.business_type}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.badgeClass}`}
                    >
                      {badge.labelAr.split('(')[0].trim()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {req.business_problem}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span className="tabular-nums">
                      {new Date(req.created_at).toLocaleDateString('ar-EG')}
                    </span>
                    {req.budget_range && (
                      <span className="text-teal-400 font-medium">
                        {req.budget_range}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Detail & Admin Controls */}
          {selectedRequest && (
            <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedRequest.name || 'عميل بدون اسم مسجل'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-400" />
                      {selectedRequest.business_type}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {new Date(selectedRequest.created_at).toLocaleString('ar-EG')}
                    </span>
                  </div>
                </div>

                {/* Quick Contact Actions */}
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${selectedRequest.email}?subject=${encodeURIComponent(
                      'بخصوص طلب نظام الأتمتة المخصص على ENGINITY'
                    )}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span dir="ltr">{selectedRequest.email}</span>
                  </a>
                  {selectedRequest.whatsapp_number && (
                    <a
                      href={`https://wa.me/${selectedRequest.whatsapp_number.replace(
                        /[^\d]/g,
                        ''
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span dir="ltr">{selectedRequest.whatsapp_number}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Problem & Outcome */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-1.5">
                  <div className="text-xs font-bold text-slate-300">
                    المشكلة الحالية:
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                    {selectedRequest.business_problem}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-1.5">
                  <div className="text-xs font-bold text-teal-300">
                    النتيجة المطلوبة:
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                    {selectedRequest.desired_outcome}
                  </p>
                </div>
              </div>

              {/* Tools, Budget, Timeframe */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-teal-400" />
                    <span>الميزانية المقترحة</span>
                  </div>
                  <div className="text-xs font-bold text-white">
                    {selectedRequest.budget_range || 'غير محدد'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>الإطار الزمني</span>
                  </div>
                  <div className="text-xs font-bold text-white">
                    {selectedRequest.delivery_timeframe || 'غير محدد'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-1">
                    الأدوات والمنصات
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(selectedRequest.current_tools || []).map(t => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-blue-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {selectedRequest.additional_notes && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                  <span className="font-bold text-slate-400">ملاحظات العميل الإضافية: </span>
                  {selectedRequest.additional_notes}
                </div>
              )}

              {/* Admin Action Panel */}
              <div className="pt-3 border-t border-slate-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      حالة الطلب
                    </label>
                    <select
                      value={editStatus}
                      onChange={e =>
                        setEditStatus(e.target.value as CustomRequestStatus)
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-blue-500 focus:outline-none"
                    >
                      {(Object.keys(STATUS_LABELS) as CustomRequestStatus[]).map(
                        st => (
                          <option key={st} value={st}>
                            {STATUS_LABELS[st].labelAr}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      عرض السعر المقدر (ج.م)
                    </label>
                    <input
                      type="number"
                      value={editQuote}
                      onChange={e => setEditQuote(e.target.value)}
                      placeholder="مثال: 4500"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-blue-500 focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    ملاحظات الإدارة الداخلية (سرية — لا تظهر للعملاء)
                  </label>
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="اكتب ملاحظاتك الهندسية، تفاصيل المكالمة، أو خطوات التنفيذ..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex items-center justify-between">
                  {saveSuccess ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      تم حفظ تحديثات الطلب بنجاح
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
                    <span>{saving ? 'جاري الحفظ...' : 'حفظ حالة وملاحظات الطلب'}</span>
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
