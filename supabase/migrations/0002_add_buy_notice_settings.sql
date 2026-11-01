-- Migration: 0002_add_buy_notice_settings.sql
-- Additive columns for buy notice settings on public product page

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS buy_notice_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS buy_notice_ar TEXT DEFAULT 'بعد الضغط على «اشتري الآن» راجع بياناتك قبل الإرسال، واكتب إيميلك صح وتأكد إنك تقدر تدخل عليه، لأن ملفاتك هتوصلك عليه.',
ADD COLUMN IF NOT EXISTS buy_notice_en TEXT DEFAULT 'After you click “Buy now”, review your details before submitting. Enter your email correctly and make sure you can access it — your files will be sent to it.';
