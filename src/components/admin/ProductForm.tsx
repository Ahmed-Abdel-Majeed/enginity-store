import React, { useState } from 'react';
import Cookies from 'js-cookie';
import { Category, Product, ProductLevel, ProductStatus, RequirementItem, StepItem, FaqItem } from '../../types';
import {
  generateSlug,
  validateXPayUrl,
  isAllowedImageUrl,
  calculateDiscountPercentage,
  resolveProductPricing,
  validateProductPricing,
  formatEGPPrice
} from '../../lib/utils';
import { uploadImageToImgBB } from '../../lib/data-store';
import { ArrowLeft, Save, Plus, Trash2, Eye, Upload, AlertCircle, Download, FileText, Copy, Check, RefreshCw, AlertTriangle, Tag } from 'lucide-react';
import { z } from 'zod';

interface ProductFormProps {
  initialProduct?: Product | null;
  categories: Category[];
  onSave: (productData: Partial<Product>) => Promise<void>;
  onCancel: () => void;
  onUploadImage?: (file: File) => Promise<string | null>;
}

// Zod Schema for JSON Import Validation
const jsonImportSchema = z.object({
  _schema_version: z.number().optional(),
  name_ar: z.string().min(1, 'اسم المنتج بالعربية (name_ar) مطلوب'),
  name_en: z.string().min(1, 'اسم المنتج بالإنجليزية (name_en) مطلوب'),
  slug: z.string().optional(),
  category: z.string().optional(),
  price_egp: z.number().min(0, 'السعر بالجنيه (price_egp) يجب أن يكون رقماً بالموجب'),
  original_price_egp: z.number().min(0).nullable().optional(),
  sale_price_egp: z.number().min(0).nullable().optional(),
  status: z.string().optional(),

  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  sort_order: z.number().optional(),
  payment_url: z.string().optional(),
  xpay_url: z.string().optional(),
  tools: z.union([z.array(z.string()), z.string()]).optional(),
  short_desc_ar: z.string().optional(),
  short_ar: z.string().optional(),
  short_desc_en: z.string().optional(),
  short_en: z.string().optional(),
  full_desc_ar: z.string().optional(),
  description_ar: z.string().optional(),
  full_desc_en: z.string().optional(),
  description_en: z.string().optional(),
  cover_image_url: z.any().optional(),
  diagram_image_url: z.any().optional(),
  cover_path: z.any().optional(),
  diagram_path: z.any().optional(),
  youtube_url: z.string().optional(),
  video_url: z.string().optional(),
  includes: z.array(z.union([
    z.string(),
    z.object({ ar: z.string().optional(), en: z.string().optional() })
  ])).optional(),
  steps: z.array(z.union([
    z.object({ title: z.string().optional(), text: z.string().optional() }),
    z.object({
      ar: z.union([z.string(), z.object({ title: z.string().optional(), text: z.string().optional() })]).optional(),
      en: z.union([z.string(), z.object({ title: z.string().optional(), text: z.string().optional() })]).optional()
    })
  ])).optional()
});

const KNOWN_IMPORT_KEYS = new Set([
  '_schema_version', 'name_ar', 'name_en', 'slug', 'category', 'price_egp',
  'status', 'level', 'sort_order', 'payment_url', 'xpay_url', 'tools',
  'short_desc_ar', 'short_ar', 'short_desc_en', 'short_en', 'full_desc_ar',
  'description_ar', 'full_desc_en', 'description_en', 'cover_image_url',
  'diagram_image_url', 'cover_path', 'diagram_path', 'youtube_url',
  'video_url', 'includes', 'steps'
]);

export const ProductForm: React.FC<ProductFormProps> = ({
  initialProduct,
  categories,
  onSave,
  onCancel
}) => {
  const initialResolvedPricing = initialProduct
    ? resolveProductPricing(initialProduct)
    : {
        hasDiscount: false,
        originalPriceEgp: 1000,
        salePriceEgp: null,
        effectivePriceEgp: 1000,
        discountPercentage: 0
      };

  const [nameAr, setNameAr] = useState(initialProduct?.name_ar || '');
  const [nameEn, setNameEn] = useState(initialProduct?.name_en || '');
  const [slug, setSlug] = useState(initialProduct?.slug || '');
  const [isSlugCustom, setIsSlugCustom] = useState(Boolean(initialProduct?.slug));
  const [status, setStatus] = useState<ProductStatus>(initialProduct?.status || 'draft');
  const [categoryId, setCategoryId] = useState<number>(initialProduct?.category_id || categories[0]?.id || 1);
  const [originalPriceEgp, setOriginalPriceEgp] = useState<string>(
    String(initialResolvedPricing.originalPriceEgp)
  );
  const [discountEnabled, setDiscountEnabled] = useState<boolean>(initialResolvedPricing.hasDiscount);
  const [salePriceEgp, setSalePriceEgp] = useState<string>(
    initialResolvedPricing.salePriceEgp !== null ? String(initialResolvedPricing.salePriceEgp) : ''
  );
  const [xpayUrl, setXpayUrl] = useState(initialProduct?.xpay_url || '');
  const [fileUrl, setFileUrl] = useState(initialProduct?.file_url || '');
  const [shortAr, setShortAr] = useState(initialProduct?.short_ar || '');
  const [shortEn, setShortEn] = useState(initialProduct?.short_en || '');
  const [descAr, setDescAr] = useState(initialProduct?.description_ar || '');
  const [descEn, setDescEn] = useState(initialProduct?.description_en || '');
  const [coverPath, setCoverPath] = useState(initialProduct?.cover_path || '');
  const [diagramPath, setDiagramPath] = useState(initialProduct?.diagram_path || '');
  const [videoUrl, setVideoUrl] = useState(initialProduct?.video_url || '');
  const [level, setLevel] = useState<ProductLevel>(initialProduct?.level || 'intermediate');
  const [toolsInput, setToolsInput] = useState(initialProduct?.tools?.join(', ') || '');
  const [sortOrder, setSortOrder] = useState<number>(initialProduct?.sort_order || 1);

  // Coming Soon & Waitlist States
  const [expectedLaunchDate, setExpectedLaunchDate] = useState(initialProduct?.expected_launch_date || '');
  const [launchAnnouncement, setLaunchAnnouncement] = useState(initialProduct?.launch_announcement || '');
  const [waitlistEnabled, setWaitlistEnabled] = useState<boolean>(initialProduct?.waitlist_enabled ?? true);
  const [adminNotes, setAdminNotes] = useState(initialProduct?.admin_notes || '');

  // Repeater States
  const [includesAr, setIncludesAr] = useState<string[]>(initialProduct?.includes_ar || []);
  const [includesEn, setIncludesEn] = useState<string[]>(initialProduct?.includes_en || []);
  const [requirementsAr, setRequirementsAr] = useState<RequirementItem[]>(initialProduct?.requirements_ar || []);
  const [requirementsEn, setRequirementsEn] = useState<RequirementItem[]>(initialProduct?.requirements_en || []);
  const [stepsAr, setStepsAr] = useState<StepItem[]>(initialProduct?.steps_ar || []);
  const [stepsEn, setStepsEn] = useState<StepItem[]>(initialProduct?.steps_en || []);
  const [faq, setFaq] = useState<FaqItem[]>(initialProduct?.faq || []);

  const [isFormDirty, setIsFormDirty] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<'cover' | 'diagram' | null>(null);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');
  const [copiedCover, setCopiedCover] = useState(false);
  const [copiedDiagram, setCopiedDiagram] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  const markDirty = () => {
    if (!isFormDirty) setIsFormDirty(true);
  };

  // Auto generate slug from English name if not explicitly customized
  const handleNameEnChange = (val: string) => {
    setNameEn(val);
    markDirty();
    if (!isSlugCustom) {
      setSlug(generateSlug(val));
    }
  };

  // ImgBB Upload Handler via /api/admin/upload-image with direct ImgBB client fallback
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'cover' | 'diagram') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('حجم الصورة يتجاوز الحد المسموح به (5 ميجابايت). يرجى اختيار صورة أصغر.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormError('نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPEG أو PNG أو WEBP فقط.');
      return;
    }

    setUploadingTarget(target);
    setUploadProgressMsg('جاري رفع الصورة عبر خادم الإدارة الآمن...');
    setFormError('');

    let uploadedUrl: string | null = null;

    try {
      uploadedUrl = await uploadImageToImgBB(file);
    } catch (err: any) {
      console.warn('Server ImgBB upload error:', err?.message || err);
    }

    if (uploadedUrl) {
      if (target === 'cover') {
        setCoverPath(uploadedUrl);
      } else {
        setDiagramPath(uploadedUrl);
      }
      setFormError('');
      markDirty();
    } else {
      setFormError(
        'تعذّر رفع الصورة عبر الخادم الآمن (/api/admin/upload-image). يرجى التأكد من جلسة المشرف أو إدخال رابط الصورة المباشر.'
      );
    }

    setUploadingTarget(null);
    setUploadProgressMsg('');
    e.target.value = '';
  };

  // Direct pasted URL validation handler with image load check
  const handlePastedUrlChange = (val: string, target: 'cover' | 'diagram') => {
    const trimmed = val.trim();
    if (target === 'cover') setCoverPath(trimmed);
    else setDiagramPath(trimmed);
    markDirty();

    if (!trimmed) return;

    if (!isAllowedImageUrl(trimmed)) {
      setFormError('ده مش رابط صورة مباشر. ارفع الصورة بالزرار أو استخدم رابط i.ibb.co المباشر.');
      return;
    }

    // Verify it loads as an actual image
    const img = new Image();
    img.onload = () => setFormError('');
    img.onerror = () => {
      setFormError('الرابط المدخل لا يشير إلى ملف صورة متوافق ومتاح المعاينة.');
    };
    img.src = trimmed;
  };

  // Workstream B: JSON Product Import
  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
      setFormError('حجم ملف الاستيراد يتجاوز الحد المسموح به (1 ميجابايت).');
      return;
    }

    if (isFormDirty) {
      const confirmReplace = window.confirm('هل أنت متاكد من استبدال البيانات الحالية بالبيانات من الملف؟');
      if (!confirmReplace) {
        e.target.value = '';
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let content = event.target?.result as string;
        if (!content) return;

        // Remove UTF-8 BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }

        const rawJson = JSON.parse(content);
        const parsed = jsonImportSchema.safeParse(rawJson);

        if (!parsed.success) {
          const errors = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
          setFormError(`فشل التحقق من صحة الملف:\n${errors.join('\n')}`);
          return;
        }

        const data = parsed.data;
        const warnings: string[] = [];

        // Check unknown keys
        const unknownKeys = Object.keys(rawJson).filter(k => !KNOWN_IMPORT_KEYS.has(k));
        if (unknownKeys.length > 0) {
          warnings.push(`تم تجاهل الحقول غير المعروفة: ${unknownKeys.join(', ')}`);
        }

        // Apply fields
        if (data.name_ar) setNameAr(data.name_ar);
        if (data.name_en) setNameEn(data.name_en);
        if (data.slug) {
          setSlug(data.slug);
          setIsSlugCustom(true);
        }

        // Map Cover & Diagram Images from JSON
        const coverVal = data.cover_image_url || data.cover_path;
        if (coverVal && typeof coverVal === 'string') {
          setCoverPath(coverVal);
        }
        const diagramVal = data.diagram_image_url || data.diagram_path;
        if (diagramVal && typeof diagramVal === 'string') {
          setDiagramPath(diagramVal);
        }

        // Category mapping
        if (data.category) {
          const catMatch = categories.find(
            c => c.slug.toLowerCase() === data.category?.toLowerCase() ||
                 c.name_ar === data.category ||
                 c.name_en.toLowerCase() === data.category?.toLowerCase()
          );
          if (catMatch) {
            setCategoryId(catMatch.id);
          } else {
            warnings.push(`لم يتم العثور على التصنيف "${data.category}". تم الاحتفاظ بالتصنيف الحالي.`);
          }
        }

        if (typeof data.original_price_egp === 'number') {
          setOriginalPriceEgp(String(data.original_price_egp));
        } else if (typeof data.price_egp === 'number') {
          setOriginalPriceEgp(String(data.price_egp));
        }

        if (typeof data.sale_price_egp === 'number') {
          setDiscountEnabled(true);
          setSalePriceEgp(String(data.sale_price_egp));
        } else {
          setDiscountEnabled(false);
          setSalePriceEgp('');
        }
        if (data.level) setLevel(data.level);
        if (typeof data.sort_order === 'number') setSortOrder(data.sort_order);

        const paymentUrl = data.payment_url || data.xpay_url;
        if (paymentUrl) setXpayUrl(paymentUrl);

        if (data.tools) {
          if (Array.isArray(data.tools)) setToolsInput(data.tools.join(', '));
          else setToolsInput(data.tools);
        }

        const shortArVal = data.short_desc_ar || data.short_ar;
        if (shortArVal) setShortAr(shortArVal);

        const shortEnVal = data.short_desc_en || data.short_en;
        if (shortEnVal) setShortEn(shortEnVal);

        const descArVal = data.full_desc_ar || data.description_ar;
        if (descArVal) setDescAr(descArVal);

        const descEnVal = data.full_desc_en || data.description_en;
        if (descEnVal) setDescEn(descEnVal);

        const videoVal = data.youtube_url || data.video_url;
        if (videoVal) setVideoUrl(videoVal);

        // Map includes
        if (data.includes) {
          const incAr: string[] = [];
          const incEn: string[] = [];
          data.includes.forEach(inc => {
            if (typeof inc === 'string') {
              incAr.push(inc);
              incEn.push(inc);
            } else if (inc && typeof inc === 'object') {
              if (inc.ar) incAr.push(inc.ar);
              if (inc.en) incEn.push(inc.en);
            }
          });
          setIncludesAr(incAr);
          setIncludesEn(incEn);
        }

        // Map steps
        if (data.steps) {
          const stAr: StepItem[] = [];
          const stEn: StepItem[] = [];
          data.steps.forEach(step => {
            if ('title' in step || 'text' in step) {
              const item = step as { title?: string; text?: string };
              stAr.push({ title: item.title || '', text: item.text || '' });
              stEn.push({ title: item.title || '', text: item.text || '' });
            } else if ('ar' in step || 'en' in step) {
              const item = step as any;
              if (item.ar) {
                stAr.push(typeof item.ar === 'string' ? { title: item.ar, text: '' } : { title: item.ar.title || '', text: item.ar.text || '' });
              }
              if (item.en) {
                stEn.push(typeof item.en === 'string' ? { title: item.en, text: '' } : { title: item.en.title || '', text: item.en.text || '' });
              }
            }
          });
          setStepsAr(stAr);
          setStepsEn(stEn);
        }

        setImportWarnings(warnings);
        setFormError('');
        markDirty();
      } catch (err: any) {
        setFormError(`خطأ في قراءة ملف JSON: ${err.message}`);
      } finally {
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  // Template Downloader
  const handleDownloadTemplate = () => {
    const template = {
      _schema_version: 1,
      name_ar: "مساعد حجز واتساب بالذكاء الاصطناعي",
      name_en: "WhatsApp AI Booking Assistant",
      slug: "whatsapp-ai-booking-assistant",
      category: "ai-assistants",
      price_egp: 1850,
      status: "draft",
      level: "intermediate",
      sort_order: 1,
      payment_url: "https://xpay.app/p/enginity-workflow",
      tools: ["n8n", "WhatsApp API", "OpenAI", "Supabase"],
      short_desc_ar: "نظام أتمتة كامل لإدارة الحجوزات عبر الواتساب والذكاء الاصطناعي",
      short_desc_en: "Complete automation system for managing WhatsApp bookings using AI",
      full_desc_ar: "### تفاصيل الـ Workflow\nيتضمن هذا الـ Workflow أتمتة شاملة لربط محادثات الواتساب بنموذج الذكاء الاصطناعي.",
      full_desc_en: "### Workflow Details\nThis workflow includes comprehensive automation connecting WhatsApp to AI models.",
      cover_image_url: null,
      diagram_image_url: null,
      youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      includes: [
        { ar: "ملف n8n JSON الخاص بالـ Workflow", en: "n8n JSON Workflow schema file" },
        { ar: "دليل إعداد المفاتيح خطوة بخطوة", en: "Step-by-step setup guide" }
      ],
      steps: [
        {
          ar: { title: "استلام طلب المحادثة", text: "استقبال رسالة العميل عبر الواتساب ويب هوك" },
          en: { title: "Receive Chat Request", text: "Receive customer message via WhatsApp webhook" }
        }
      ]
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'enginity-product-template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Product Exporter
  const handleExportJson = () => {
    const parsedOrig = Number(originalPriceEgp) || 0;
    const parsedSale = discountEnabled && salePriceEgp.trim() !== '' ? Number(salePriceEgp) : null;
    const effectiveExportPrice =
      parsedSale !== null && parsedOrig > 0 && parsedSale < parsedOrig ? parsedSale : parsedOrig;

    const exportData = {
      _schema_version: 1,
      name_ar: nameAr,
      name_en: nameEn,
      slug: slug,
      category: categories.find(c => c.id === categoryId)?.slug || '',
      price_egp: effectiveExportPrice,
      original_price_egp: parsedOrig,
      sale_price_egp: parsedSale,
      status: status,
      level: level,
      sort_order: sortOrder,
      payment_url: xpayUrl,
      tools: toolsInput.split(',').map(t => t.trim()).filter(Boolean),
      short_desc_ar: shortAr,
      short_desc_en: shortEn,
      full_desc_ar: descAr,
      full_desc_en: descEn,
      cover_image_url: coverPath || null,
      diagram_image_url: diagramPath || null,
      youtube_url: videoUrl || null,
      includes: includesAr.map((ar, idx) => ({ ar, en: includesEn[idx] || '' })),
      steps: stepsAr.map((st, idx) => ({
        ar: { title: st.title, text: st.text },
        en: { title: stepsEn[idx]?.title || '', text: stepsEn[idx]?.text || '' }
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'product'}-enginity.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!nameAr.trim() || !nameEn.trim()) {
      setFormError('يرجى إدخال اسم المنتج باللغتين العربية والإنجليزية.');
      return;
    }

    if (xpayUrl && !validateXPayUrl(xpayUrl)) {
      setFormError('رابط الدفع يجب أن يكون HTTPS وينتمي إلى نطاق مسموح به.');
      return;
    }

    if (coverPath && !isAllowedImageUrl(coverPath)) {
      setFormError('رابط صورة الغلاف غير صالح. ده مش رابط صورة مباشر.');
      return;
    }

    if (diagramPath && !isAllowedImageUrl(diagramPath)) {
      setFormError('رابط صورة المخطط غير صالح. ده مش رابط صورة مباشر.');
      return;
    }

    const parsedOriginal = originalPriceEgp.trim() === '' ? NaN : Number(originalPriceEgp);
    const parsedSale =
      discountEnabled && salePriceEgp.trim() !== '' ? Number(salePriceEgp) : discountEnabled ? NaN : null;

    const pricingValidation = validateProductPricing({
      originalPriceEgp: parsedOriginal,
      salePriceEgp: parsedSale,
      discountEnabled
    });

    if (!pricingValidation.valid) {
      setFormError(pricingValidation.errorAr || 'بيانات التسعير والخصم غير صالحة.');
      return;
    }

    const toolsList = toolsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      await onSave({
        id: initialProduct?.id,
        name_ar: nameAr,
        name_en: nameEn,
        slug: slug.trim() || generateSlug(nameEn),
        status,
        category_id: categoryId,
        price_egp: pricingValidation.normalized.price_egp,
        original_price_egp: pricingValidation.normalized.original_price_egp,
        sale_price_egp: pricingValidation.normalized.sale_price_egp,
        xpay_url: xpayUrl.trim(),
        file_url: fileUrl.trim(),
        short_ar: shortAr,
        short_en: shortEn,
        description_ar: descAr,
        description_en: descEn,
        cover_path: coverPath,
        diagram_path: diagramPath,
        video_url: videoUrl.trim(),
        level,
        tools: toolsList,
        sort_order: Number(sortOrder),
        includes_ar: includesAr,
        includes_en: includesEn,
        requirements_ar: requirementsAr,
        requirements_en: requirementsEn,
        steps_ar: stepsAr,
        steps_en: stepsEn,
        faq,
        expected_launch_date: expectedLaunchDate || undefined,
        launch_announcement: launchAnnouncement || undefined,
        waitlist_enabled: waitlistEnabled,
        admin_notes: adminNotes || undefined
      });
      setIsFormDirty(false);
    } catch (err: any) {
      console.error('Product save error:', err);
      setFormError(err.message || 'حدث خطأ أثناء حفظ بيانات المنتج.');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, target: 'cover' | 'diagram') => {
    navigator.clipboard.writeText(text);
    if (target === 'cover') {
      setCopiedCover(true);
      setTimeout(() => setCopiedCover(false), 2000);
    } else {
      setCopiedDiagram(true);
      setTimeout(() => setCopiedDiagram(false), 2000);
    }
  };

  return (
    <div className="space-y-8 text-start font-cairo">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-heading font-extrabold text-xl text-white">
              {initialProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}
            </h2>
            <p className="text-xs text-slate-400">إدخال كافة بيانات الـ Workflow واستيراد المخططات والملفات</p>
          </div>
        </div>

        {/* Header Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* JSON File Import Button */}
          <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700">
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>استيراد من ملف</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleJsonImport}
              className="hidden"
            />
          </label>

          {/* Download Template Button */}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>تنزيل قالب الملف</span>
          </button>

          {/* Export JSON Button (In edit mode) */}
          {initialProduct && (
            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>تصدير المنتج كملف</span>
            </button>
          )}

          {slug && (
            <a
              href={`/ar/products/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>معاينة حية</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ المنتج'}</span>
          </button>
        </div>
      </div>

      {formError && (
        <div className="p-4 bg-red-950/80 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2 font-medium whitespace-pre-line">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <span>{formError}</span>
        </div>
      )}

      {importWarnings.length > 0 && (
        <div className="p-4 bg-amber-950/80 border border-amber-800 text-amber-300 text-xs rounded-xl space-y-1">
          <div className="flex items-center gap-2 font-bold text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>تنبيهات استيراد الملف:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 ps-2">
            {importWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Section 1: Core Product Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h3 className="font-heading font-bold text-sm text-blue-400 uppercase tracking-wider">
            1. المعلومات الأساسية (Core Info)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Name AR */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">اسم المنتج بالعربية *</label>
              <input
                type="text"
                required
                value={nameAr}
                onChange={e => { setNameAr(e.target.value); markDirty(); }}
                placeholder="مساعد حجز واتساب بالذكاء الاصطناعي"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Name EN */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Product Name (English) *</label>
              <input
                type="text"
                required
                value={nameEn}
                onChange={e => handleNameEnChange(e.target.value)}
                placeholder="WhatsApp AI Booking Assistant"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">الـ Slug (رابط المنتج الفريد)</label>
              <input
                type="text"
                required
                value={slug}
                onChange={e => {
                  setSlug(e.target.value);
                  setIsSlugCustom(true);
                  markDirty();
                }}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Category Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">التصنيف (Category)</label>
              <select
                value={categoryId}
                onChange={e => { setCategoryId(Number(e.target.value)); markDirty(); }}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name_ar} ({c.name_en})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">حالة النشر (Status)</label>
              <select
                value={status}
                onChange={e => { setStatus(e.target.value as ProductStatus); markDirty(); }}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
              >
                <option value="draft">مسودة (Draft)</option>
                <option value="coming_soon">قريباً / قائمة انتظار (Coming Soon)</option>
                <option value="published">منشور (Published)</option>
                <option value="archived">مؤرشف (Archived)</option>
              </select>
            </div>

            {/* Level */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">مستوى الصعوبة (Level)</label>
              <select
                value={level}
                onChange={e => { setLevel(e.target.value as ProductLevel); markDirty(); }}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
              >
                <option value="beginner">مبتدئ (Beginner)</option>
                <option value="intermediate">متوسط (Intermediate)</option>
                <option value="advanced">متقدم (Advanced)</option>
              </select>
            </div>

            {/* Sort Order */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">ترتيب العرض (Sort Order)</label>
              <input
                type="number"
                value={sortOrder}
                onChange={e => { setSortOrder(Number(e.target.value)); markDirty(); }}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

          </div>

          {/* Dynamic Pricing & Discount Engine Panel */}
          <div className="p-5 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    إعدادات التسعير والخصومات (Pricing & Automatic Discount)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    حدد السعر قبل الخصم وفعّل الخصم لحساب نسبة الخصم تلقائياً وعرضها في المتجر
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discountEnabled}
                    onChange={e => {
                      const checked = e.target.checked;
                      setDiscountEnabled(checked);
                      if (!checked) {
                        setSalePriceEgp('');
                      } else if (!salePriceEgp && Number(originalPriceEgp) > 0) {
                        setSalePriceEgp(String(Math.round(Number(originalPriceEgp) * 0.75)));
                      }
                      markDirty();
                    }}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-200">تفعيل الخصم</span>
                </label>

                {discountEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountEnabled(false);
                      setSalePriceEgp('');
                      markDirty();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    إلغاء الخصم
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {/* Original Price (السعر قبل الخصم) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  {discountEnabled
                    ? 'السعر قبل الخصم (Original Price EGP) *'
                    : 'السعر الأساسي بالجنيه (Price EGP) *'}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={originalPriceEgp}
                  onChange={e => {
                    setOriginalPriceEgp(e.target.value);
                    markDirty();
                  }}
                  placeholder="1000"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-500 block">
                  يظهر مشطوباً (~~1,000 ج.م~~) عند تفعيل الخصم.
                </span>
              </div>

              {/* Sale Price (السعر بعد الخصم) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  السعر بعد الخصم (Sale Price EGP) {discountEnabled ? '*' : '(غير مفعل)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!discountEnabled}
                  required={discountEnabled}
                  value={salePriceEgp}
                  onChange={e => {
                    setSalePriceEgp(e.target.value);
                    markDirty();
                  }}
                  placeholder={discountEnabled ? '750' : 'فعّل الخصم لإدخال سعر الخصم'}
                  className="w-full px-3.5 py-2.5 bg-slate-900 disabled:bg-slate-900/40 disabled:text-slate-600 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-emerald-500"
                />
                {discountEnabled &&
                  salePriceEgp.trim() !== '' &&
                  Number(salePriceEgp) >= Number(originalPriceEgp) && (
                    <span className="text-[11px] text-rose-400 font-bold block">
                      ⚠️ السعر بعد الخصم يجب أن يكون أقل من السعر قبل الخصم.
                    </span>
                  )}
                {discountEnabled && Number(salePriceEgp) < 0 && (
                  <span className="text-[11px] text-rose-400 font-bold block">
                    ⚠️ لا يُسمح بإدخال سعر سالب.
                  </span>
                )}
              </div>

              {/* Automatically Calculated Discount Percentage & Storefront Preview */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  نسبة الخصم المحسوبة تلقائياً (Discount %)
                </label>
                {(() => {
                  const numOrig = Number(originalPriceEgp);
                  const numSale = discountEnabled && salePriceEgp.trim() !== '' ? Number(salePriceEgp) : null;
                  const pct =
                    discountEnabled && numSale !== null
                      ? calculateDiscountPercentage(numOrig, numSale)
                      : 0;
                  const isValidDiscount =
                    discountEnabled &&
                    numSale !== null &&
                    Number.isFinite(numOrig) &&
                    Number.isFinite(numSale) &&
                    numOrig > 0 &&
                    numSale >= 0 &&
                    numSale < numOrig &&
                    pct > 0;

                  return (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] text-slate-400">معاينة السعر النهائي:</div>
                        {isValidDiscount ? (
                          <div className="flex items-baseline gap-2 pt-0.5">
                            <span className="font-mono font-extrabold text-sm text-emerald-400">
                              {formatEGPPrice(numSale)} ج.م
                            </span>
                            <span className="font-mono text-xs text-slate-500 line-through">
                              {formatEGPPrice(numOrig)} ج.م
                            </span>
                          </div>
                        ) : (
                          <div className="font-mono font-extrabold text-sm text-blue-400 pt-0.5">
                            {Number.isFinite(numOrig) && numOrig >= 0 ? formatEGPPrice(numOrig) : '0'} ج.م
                          </div>
                        )}
                      </div>

                      <div
                        className={`px-3 py-1.5 rounded-xl font-mono text-xs font-black border ${
                          isValidDiscount
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {isValidDiscount ? `خصم ${pct}%` : 'بدون خصم (0%)'}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Payment URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">رابط الدفع المباشر (Payment URL)</label>
            <input
              type="url"
              dir="ltr"
              value={xpayUrl}
              onChange={e => { setXpayUrl(e.target.value); markDirty(); }}
              placeholder="https://checkout.xpay.app/p/..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-blue-500"
            />
            <span className="text-[11px] text-slate-400 block">
              رابط الدفع المباشر المخصص لهذا المنتج (HTTPS). ملاحظة هامة: تأكد أن قيمة رابط الدفع في لوحة XPay تطابق السعر النهائي المستحق بعد الخصم.
            </span>
          </div>

          {/* Protected Deliverable File URL (TASK-001) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              رابط ملف التسليم بعد الدفع (Protected Deliverable File URL — Admin & Fulfillment Only)
            </label>
            <input
              type="url"
              dir="ltr"
              value={fileUrl}
              onChange={e => { setFileUrl(e.target.value); markDirty(); }}
              placeholder="https://drive.google.com/... أو رابط تحميل ملف JSON المحمي"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-blue-500"
            />
            <span className="text-[11px] text-emerald-400/90 block">
              🔒 محمي عبر جدول <code className="font-mono">product_deliverables</code> ولا يظهر أبداً للزوار في المتجر العام؛ يُرسل فقط للعميل بعد تأكيد الدفع.
            </span>
          </div>

          {/* Tools input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">الأدوات والتطبيقات المستخدمة (مفصولة بفاصلة)</label>
            <input
              type="text"
              value={toolsInput}
              onChange={e => { setToolsInput(e.target.value); markDirty(); }}
              placeholder="n8n, WhatsApp API, OpenAI, Google Calendar, Supabase"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Coming Soon & Waitlist Settings */}
          <div className="p-4 bg-amber-950/20 border border-amber-800/50 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400">🚀 إعدادات الإطلاق وقائمة الانتظار (Coming Soon & Waitlist)</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waitlistEnabled}
                  onChange={e => { setWaitlistEnabled(e.target.checked); markDirty(); }}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs text-slate-300 font-semibold">تفعيل تسجيل قائمة الانتظار للجمهور</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">تاريخ الإطلاق المتوقع (Expected Launch Date)</label>
                <input
                  type="text"
                  value={expectedLaunchDate}
                  onChange={e => { setExpectedLaunchDate(e.target.value); markDirty(); }}
                  placeholder="مثال: 15 نوفمبر 2026 أو الربع الرابع"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">ملاحظات الإدارة الداخلية (Admin Notes)</label>
                <input
                  type="text"
                  value={adminNotes}
                  onChange={e => { setAdminNotes(e.target.value); markDirty(); }}
                  placeholder="ملاحظات للفريق..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">نص رسالة الإطلاق عبر الإيميل والواتساب (Launch Announcement)</label>
              <textarea
                rows={2}
                value={launchAnnouncement}
                onChange={e => { setLaunchAnnouncement(e.target.value); markDirty(); }}
                placeholder="تم إطلاق هذا السيستم رسمياً! اضغط هنا للوصول المباشر والشراء."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-500">سيتم إرفاق هذا النص في إشعارات الإطلاق لجميع المشتركين بضغطة زر واحدة.</span>
            </div>
          </div>

        </div>

        {/* Section 2: Descriptions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h3 className="font-heading font-bold text-sm text-blue-400 uppercase tracking-wider">
            2. الوصف المختصر والمفصل (Markdown Descriptions)
          </h3>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">وصف قصير بالعربية</label>
              <textarea
                rows={2}
                value={shortAr}
                onChange={e => { setShortAr(e.target.value); markDirty(); }}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Short Description (English)</label>
              <textarea
                rows={2}
                value={shortEn}
                onChange={e => { setShortEn(e.target.value); markDirty(); }}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">الوصف الشامل بالعربية (Markdown)</label>
              <textarea
                rows={6}
                value={descAr}
                onChange={e => { setDescAr(e.target.value); markDirty(); }}
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Full Description (English Markdown)</label>
              <textarea
                rows={6}
                value={descEn}
                onChange={e => { setDescEn(e.target.value); markDirty(); }}
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Media Uploads & Video */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h3 className="font-heading font-bold text-sm text-blue-400 uppercase tracking-wider">
            3. الوسائط والصور والفيديو (Media Uploads via ImgBB)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Cover Image Upload (Workstream A) */}
            <div className="space-y-3 p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <label className="text-xs font-semibold text-slate-300 block">صورة الغلاف (Cover Image)</label>
              
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={e => handleImageFileChange(e, 'cover')}
                  className="hidden"
                  id="cover-upload"
                />
                <label
                  htmlFor="cover-upload"
                  className="px-4 py-2 bg-blue-900/60 hover:bg-blue-800 text-blue-200 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer border border-blue-700/60"
                >
                  <Upload className="w-4 h-4" />
                  <span>{uploadingTarget === 'cover' ? 'جاري الرفع...' : 'اختر صورة...'}</span>
                </label>

                {coverPath && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400 font-medium">تم تعيين الصورة ✓</span>
                    <button
                      type="button"
                      onClick={() => { setCoverPath(''); markDirty(); }}
                      className="px-2 py-1 text-[11px] bg-red-900/40 text-red-300 hover:bg-red-800 rounded-lg cursor-pointer"
                    >
                      إزالة
                    </button>
                  </div>
                )}
              </div>

              {uploadingTarget === 'cover' && (
                <div className="flex items-center gap-2 text-xs text-blue-400 font-medium animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{uploadProgressMsg}</span>
                </div>
              )}

              {/* Cover Preview Thumbnail */}
              {coverPath && (
                <div className="relative group w-full h-32 bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
                  <img src={coverPath} alt="Cover Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(coverPath, 'cover')}
                      className="px-2.5 py-1 bg-slate-800 text-white rounded text-xs flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCover ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCover ? 'تم النسخ' : 'نسخ الرابط'}</span>
                    </button>
                  </div>
                </div>
              )}

              <input
                type="text"
                value={coverPath}
                onChange={e => handlePastedUrlChange(e.target.value, 'cover')}
                placeholder="أو ضع رابط i.ibb.co المباشر هنا..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Diagram Image Upload (Workstream A) */}
            <div className="space-y-3 p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <label className="text-xs font-semibold text-slate-300 block">صورة المخطط (Diagram Image)</label>
              
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={e => handleImageFileChange(e, 'diagram')}
                  className="hidden"
                  id="diagram-upload"
                />
                <label
                  htmlFor="diagram-upload"
                  className="px-4 py-2 bg-blue-900/60 hover:bg-blue-800 text-blue-200 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer border border-blue-700/60"
                >
                  <Upload className="w-4 h-4" />
                  <span>{uploadingTarget === 'diagram' ? 'جاري الرفع...' : 'اختر صورة...'}</span>
                </label>

                {diagramPath && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400 font-medium">تم تعيين الصورة ✓</span>
                    <button
                      type="button"
                      onClick={() => { setDiagramPath(''); markDirty(); }}
                      className="px-2 py-1 text-[11px] bg-red-900/40 text-red-300 hover:bg-red-800 rounded-lg cursor-pointer"
                    >
                      إزالة
                    </button>
                  </div>
                )}
              </div>

              {uploadingTarget === 'diagram' && (
                <div className="flex items-center gap-2 text-xs text-blue-400 font-medium animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{uploadProgressMsg}</span>
                </div>
              )}

              {/* Diagram Preview Thumbnail */}
              {diagramPath && (
                <div className="relative group w-full h-32 bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
                  <img src={diagramPath} alt="Diagram Preview" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(diagramPath, 'diagram')}
                      className="px-2.5 py-1 bg-slate-800 text-white rounded text-xs flex items-center gap-1 cursor-pointer"
                    >
                      {copiedDiagram ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedDiagram ? 'تم النسخ' : 'نسخ الرابط'}</span>
                    </button>
                  </div>
                </div>
              )}

              <input
                type="text"
                value={diagramPath}
                onChange={e => handlePastedUrlChange(e.target.value, 'diagram')}
                placeholder="أو ضع رابط i.ibb.co المباشر هنا..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

          </div>

          {/* YouTube Video URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">رابط فيديو الشرح من يوتيوب (YouTube Video URL)</label>
            <input
              type="url"
              value={videoUrl}
              onChange={e => { setVideoUrl(e.target.value); markDirty(); }}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
            />
          </div>

        </div>

        {/* Section 4: Repeaters (Includes, Requirements, Steps, FAQ) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h3 className="font-heading font-bold text-sm text-blue-400 uppercase tracking-wider">
            4. المكونات والمتطلبات والخطوات (Repeaters)
          </h3>

          {/* Includes Repeater */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">قائمة المستلمات بعد الدفع (Includes list)</label>
              <button
                type="button"
                onClick={() => {
                  setIncludesAr([...includesAr, '']);
                  setIncludesEn([...includesEn, '']);
                  markDirty();
                }}
                className="px-3 py-1 rounded-lg bg-blue-900/60 text-blue-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة بند</span>
              </button>
            </div>

            {includesAr.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="عنصر بالعربية"
                  value={includesAr[idx] || ''}
                  onChange={e => {
                    const copy = [...includesAr];
                    copy[idx] = e.target.value;
                    setIncludesAr(copy);
                    markDirty();
                  }}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                />
                <input
                  type="text"
                  placeholder="Item in English"
                  value={includesEn[idx] || ''}
                  onChange={e => {
                    const copy = [...includesEn];
                    copy[idx] = e.target.value;
                    setIncludesEn(copy);
                    markDirty();
                  }}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIncludesAr(includesAr.filter((_, i) => i !== idx));
                    setIncludesEn(includesEn.filter((_, i) => i !== idx));
                    markDirty();
                  }}
                  className="p-2 text-red-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Steps Repeater */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">خطوات تشغيل الـ Workflow (Steps list)</label>
              <button
                type="button"
                onClick={() => {
                  setStepsAr([...stepsAr, { title: '', text: '' }]);
                  setStepsEn([...stepsEn, { title: '', text: '' }]);
                  markDirty();
                }}
                className="px-3 py-1 rounded-lg bg-blue-900/60 text-blue-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة خطوة</span>
              </button>
            </div>

            {stepsAr.map((step, idx) => (
              <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>خطوة {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStepsAr(stepsAr.filter((_, i) => i !== idx));
                      setStepsEn(stepsEn.filter((_, i) => i !== idx));
                      markDirty();
                    }}
                    className="text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    حذف الخطوة
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="عنوان الخطوة بالعربية"
                    value={stepsAr[idx]?.title || ''}
                    onChange={e => {
                      const copy = [...stepsAr];
                      copy[idx] = { ...copy[idx], title: e.target.value };
                      setStepsAr(copy);
                      markDirty();
                    }}
                    className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Step title in English"
                    value={stepsEn[idx]?.title || ''}
                    onChange={e => {
                      const copy = [...stepsEn];
                      copy[idx] = { ...copy[idx], title: e.target.value };
                      setStepsEn(copy);
                      markDirty();
                    }}
                    className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <textarea
                    rows={2}
                    placeholder="تفاصيل الخطوة بالعربية"
                    value={stepsAr[idx]?.text || ''}
                    onChange={e => {
                      const copy = [...stepsAr];
                      copy[idx] = { ...copy[idx], text: e.target.value };
                      setStepsAr(copy);
                      markDirty();
                    }}
                    className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                  />
                  <textarea
                    rows={2}
                    placeholder="Step text details in English"
                    value={stepsEn[idx]?.text || ''}
                    onChange={e => {
                      const copy = [...stepsEn];
                      copy[idx] = { ...copy[idx], text: e.target.value };
                      setStepsEn(copy);
                      markDirty();
                    }}
                    className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs"
                  />
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Form Bottom Save Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ المنتج'}</span>
          </button>
        </div>

      </form>
    </div>
  );
};
