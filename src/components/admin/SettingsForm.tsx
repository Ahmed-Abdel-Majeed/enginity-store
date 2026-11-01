import React, { useState } from 'react';
import { StoreSettings, GeneralFaq } from '../../types';
import { Save, Plus, Trash2, CheckCircle2, Download } from 'lucide-react';

interface SettingsFormProps {
  settings: StoreSettings;
  onSaveSettings: (settingsData: Partial<StoreSettings>) => Promise<void>;
}

export const SettingsForm: React.FC<SettingsFormProps> = ({
  settings,
  onSaveSettings
}) => {
  const [usdRate, setUsdRate] = useState<number>(settings.usd_rate || 50.0);
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsapp_number || '');
  const [whatsappMessage, setWhatsappMessage] = useState(settings.whatsapp_default_message || '');
  const [authorName, setAuthorName] = useState(settings.author_name || '');
  const [authorBioAr, setAuthorBioAr] = useState(settings.author_bio_ar || '');
  const [authorBioEn, setAuthorBioEn] = useState(settings.author_bio_en || '');
  const [authorPhoto, setAuthorPhoto] = useState(settings.author_photo || '');
  const [followersAr, setFollowersAr] = useState(settings.author_followers_text_ar || '');
  const [followersEn, setFollowersEn] = useState(settings.author_followers_text_en || '');
  const [contactEmail, setContactEmail] = useState(settings.contact_email || '');
  const [buyNoticeEnabled, setBuyNoticeEnabled] = useState<boolean>(Boolean(settings.buy_notice_enabled));
  const [buyNoticeAr, setBuyNoticeAr] = useState<string>(settings.buy_notice_ar || 'سيتم توجيهك لرابط الدفع السريع والآمن لإتمام الطلب استلام الـ Workflow فوراً.');
  const [buyNoticeEn, setBuyNoticeEn] = useState<string>(settings.buy_notice_en || 'You will be redirected to a secure payment page to complete your order and receive the workflow immediately.');
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState<string>(
    settings.social_links?.n8n_launch_webhook_url ||
    settings.n8n_launch_webhook_url ||
    'https://n8n-enginity.duckdns.org/webhook/send-email-from-user-product-publish'
  );
  const [resendKey, setResendKey] = useState<string>(
    settings.social_links?.resend_api_key ||
    settings.resend_api_key ||
    ''
  );
  const [youtube, setYoutube] = useState(settings.social_links?.youtube || '');
  const [linkedin, setLinkedin] = useState(settings.social_links?.linkedin || '');
  const [facebook, setFacebook] = useState(settings.social_links?.facebook || '');
  const [portfolio, setPortfolio] = useState(settings.social_links?.portfolio || '');
  const [generalFaq, setGeneralFaq] = useState<GeneralFaq[]>(settings.general_faq || []);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await onSaveSettings({
        usd_rate: Number(usdRate),
        whatsapp_number: whatsappNumber,
        whatsapp_default_message: whatsappMessage,
        author_name: authorName,
        author_bio_ar: authorBioAr,
        author_bio_en: authorBioEn,
        author_photo: authorPhoto,
        author_followers_text_ar: followersAr,
        author_followers_text_en: followersEn,
        contact_email: contactEmail,
        buy_notice_enabled: buyNoticeEnabled,
        buy_notice_ar: buyNoticeAr,
        buy_notice_en: buyNoticeEn,
        n8n_launch_webhook_url: n8nWebhookUrl.trim(),
        resend_api_key: resendKey.trim(),
        social_links: {
          youtube,
          linkedin,
          facebook,
          portfolio,
          n8n_launch_webhook_url: n8nWebhookUrl.trim(),
          resend_api_key: resendKey.trim()
        },
        general_faq: generalFaq
      });
      setSavedSuccess(true);
    } catch {
      alert('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 text-start font-cairo">
      
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-white">إعدادات المتجر العامة</h2>
          <p className="text-xs text-slate-400">سعر الصرف، رقم الواتساب، إشعار الشراء، معلومات المؤسس، والأسئلة الشائعة</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>تم حفظ الإعدادات بنجاح!</span>
        </div>
      )}

      {/* Currency & Financials */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-heading font-bold text-sm text-blue-400 uppercase tracking-wider">
          1. سعر الصرف والعملات (USD Rate)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">سعر الدولار مقابل الجنيه (USD Conversion Rate)</label>
            <input
              type="number"
              step="0.01"
              required
              value={usdRate}
              onChange={e => setUsdRate(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
            />
            <span className="text-[11px] text-slate-500">يستخدم لتحويل السعر تلقائياً عند اختيار تحويل $ في واجهة المتجر.</span>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">البريد الإلكتروني للتواصل (Contact Email)</label>
            <input
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Buy Notice Notice Box Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-bold text-sm text-blue-400 uppercase tracking-wider">
            2. إشعار صندوق الشراء (Buy Notice Banner)
          </h3>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={buyNoticeEnabled}
              onChange={e => setBuyNoticeEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-800 bg-slate-950"
            />
            <span>تفعيل إشعار التوجيه بالشراء في صفحة المنتج</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">نص الإشعار بالعربية</label>

            <textarea
              rows={2}
              value={buyNoticeAr}
              onChange={e => setBuyNoticeAr(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Notice Text in English</label>
            <textarea
              rows={2}
              value={buyNoticeEn}
              onChange={e => setBuyNoticeEn(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
            />
          </div>
        </div>
      </div>

      {/* WhatsApp Integration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-heading font-bold text-sm text-blue-400 uppercase tracking-wider">
          3. إعدادات الواتساب للدعم (WhatsApp Settings)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">رقم الواتساب مع رمز الدولة (بدون +)</label>
            <input
              type="text"
              value={whatsappNumber}
              onChange={e => setWhatsappNumber(e.target.value)}
              placeholder="201000000000"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">نص الرسالة التلقائية عند النقر</label>
            <input
              type="text"
              value={whatsappMessage}
              onChange={e => setWhatsappMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
            />
          </div>
        </div>
      </div>

      {/* n8n Automation & Launch Webhook Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-heading font-bold text-sm text-emerald-400 uppercase tracking-wider flex items-center gap-2">
          <span>⚡ أتمتة n8n وإشعار إطلاق المنتجات (n8n Webhook & Launch Dispatch)</span>
        </h3>
        <p className="text-xs text-slate-400">
          عند النقر على زر <strong>إطلاق المنتج (Publish)</strong>، سيرسل النظام تلقائياً حمولة بيانات كاملة (JSON Payload) لكل المشتركون والمنتج إلى رابط Webhook الخاص بنظام n8n ليعالج إرسال الإيميلات والواتساب عبر سيناريوهاتك المخصصة.
        </p>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200">رابط الـ Webhook الخاص بنظام n8n لإشعارات الإطلاق (n8n Launch Webhook URL)</label>
            <input
              type="url"
              value={n8nWebhookUrl}
              onChange={e => setN8nWebhookUrl(e.target.value)}
              placeholder="https://n8n.enginity.store/webhook/launch-notifications"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 text-xs font-mono focus:border-emerald-500 focus:outline-hidden"
            />
            <span className="text-[11px] text-slate-500">
              يستقبل الـ Webhook كود أحداث <code className="text-emerald-400">product_launched</code> وتفاصيل المنتج ورابطه وقائمة الإيميلات والأرقام المسجلة في قائمة الانتظار.
            </span>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div>
              <div className="text-xs font-bold text-slate-200">قالب n8n Workflow جاهز للاستيراد المباشر</div>
              <div className="text-[11px] text-slate-400">يتضمن استقبال الـ Webhook وتصفية الإيميلات وتمريرها في حلقة تكرار (Loop) لإرسال التنبيهات.</div>
            </div>
            <a
              href="/enginity-launch-n8n-workflow.json"
              download="enginity-launch-n8n-workflow.json"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>تحميل ملف n8n Workflow (JSON)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Author Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-heading font-bold text-sm text-blue-400 uppercase tracking-wider">
          4. بيانات المؤسس والمطور (Author Bio & Links)
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">اسم المطور / المالك</label>
            <input
              type="text"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">رابط الصورة الشخصية</label>
            <input
              type="text"
              value={authorPhoto}
              onChange={e => setAuthorPhoto(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">نص المتابعين بالعربية</label>
            <input
              type="text"
              value={followersAr}
              onChange={e => setFollowersAr(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Followers text in English</label>
            <input
              type="text"
              value={followersEn}
              onChange={e => setFollowersEn(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">نبذة المؤسس بالعربية</label>
            <textarea
              rows={3}
              value={authorBioAr}
              onChange={e => setAuthorBioAr(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Author Bio in English</label>
            <textarea
              rows={3}
              value={authorBioEn}
              onChange={e => setAuthorBioEn(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">رابط قناة يوتيوب</label>
            <input
              type="url"
              value={youtube}
              onChange={e => setYoutube(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">رابط حساب LinkedIn</label>
            <input
              type="url"
              value={linkedin}
              onChange={e => setLinkedin(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">رابط صفحة Facebook</label>
            <input
              type="url"
              value={facebook}
              onChange={e => setFacebook(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">رابط معرض الأعمال (Portfolio)</label>
            <input
              type="url"
              value={portfolio}
              onChange={e => setPortfolio(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* General FAQ Repeater */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-bold text-sm text-blue-400 uppercase tracking-wider">
            5. الأسئلة الشائعة العامة (General FAQ Repeater)
          </h3>
          <button
            type="button"
            onClick={() => setGeneralFaq([...generalFaq, { q_ar: '', q_en: '', a_ar: '', a_en: '' }])}
            className="px-3 py-1 rounded-lg bg-blue-900/60 text-blue-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة سؤال</span>
          </button>
        </div>

        <div className="space-y-4">
          {generalFaq.map((faqItem, idx) => (
            <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>سؤال عام {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => setGeneralFaq(generalFaq.filter((_, i) => i !== idx))}
                  className="text-red-400 hover:text-red-300 cursor-pointer"
                >
                  حذف
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="السؤال بالعربية"
                  value={faqItem.q_ar}
                  onChange={e => {
                    const copy = [...generalFaq];
                    copy[idx] = { ...copy[idx], q_ar: e.target.value };
                    setGeneralFaq(copy);
                  }}
                  className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                />
                <input
                  type="text"
                  placeholder="Question in English"
                  value={faqItem.q_en}
                  onChange={e => {
                    const copy = [...generalFaq];
                    copy[idx] = { ...copy[idx], q_en: e.target.value };
                    setGeneralFaq(copy);
                  }}
                  className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <textarea
                  rows={2}
                  placeholder="الإجابة بالعربية"
                  value={faqItem.a_ar}
                  onChange={e => {
                    const copy = [...generalFaq];
                    copy[idx] = { ...copy[idx], a_ar: e.target.value };
                    setGeneralFaq(copy);
                  }}
                  className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                />
                <textarea
                  rows={2}
                  placeholder="Answer in English"
                  value={faqItem.a_en}
                  onChange={e => {
                    const copy = [...generalFaq];
                    copy[idx] = { ...copy[idx], a_en: e.target.value };
                    setGeneralFaq(copy);
                  }}
                  className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

    </form>
  );
};

