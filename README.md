# Enginity - Ready-Made n8n Workflows Store

Enginity is a developer-centric, bilingual (Arabic primary, LTR English) digital marketplace selling ready-made n8n workflows with direct single-click checkout and a private admin management panel.

---

## 🌟 Key Features

- **Primary Bilingual Engine (AR & EN)**:
  - Default route `/ar` with full native RTL alignment (`dir="rtl"`).
  - English locale segment `/en` with LTR layout.
  - Route `/` automatically redirects to `/ar`.
- **EGP / USD Currency Toggle**:
  - Base product prices stored in EGP.
  - Interactive header toggle (`ج.م | $` / `EGP | USD`) stored in cookie `enginity_currency`.
  - USD price calculated as `Math.ceil(price_egp / settings.usd_rate)` labeled `"≈ $X"`.
- **Direct Checkout Flow**:
  - Clicking "اشتري الآن / Buy Now" redirects the customer directly to the product's payment URL.
  - `xpay_url` / payment URL is entered per product by the admin in the admin panel and validated as a secure `https` URL.
  - Optional `XPAY_ALLOWED_HOSTS` env variable: if set, restricts hostname; if empty, accepts any valid `https` URL.
- **Buy Notice Banner**:
  - Global Store Setting to toggle and customize the notice banner shown directly above the "Buy Now" button.
- **ImgBB Product Image Hosting (Workstream A)**:
  - Product images (cover & diagram) uploaded via server-side endpoint `/api/admin/upload-image` directly to ImgBB free hosting.
  - Validated by file magic bytes (JPEG, PNG, WEBP only, max 2MB).
  - Server reads secret `IMGBB_API_KEY` (never exposed to client). Returns direct image URL `https://i.ibb.co/...`.
  - Admin UI features upload progress bar, thumbnail preview, copy direct link, replace/remove actions, and direct URL paste validation (`isAllowedImageUrl`).
- **Product JSON Import & Export (Workstream B)**:
  - Admin form includes "استيراد من ملف" (auto-fills product form from standardized JSON file with schema validation and warning list).
  - "تنزيل قالب الملف" button downloads `enginity-product-template.json`.
  - "تصدير المنتج كملف" exports current product as formatted JSON.
- **Enhanced Product Details & Diagram Section (Workstream C)**:
  - Dedicated "مخطط الـ Workflow" section with lazy loading, light-box zoom modal, and fallback.
  - Wrapped mixed-language titles in `<bdi dir="auto">` for proper RTL/LTR directional text flow.
  - Privacy-friendly YouTube embed via `youtube-nocookie.com`.
  - Cleaned public copy removing gateway brand mentions.
- **Private Admin Portal (`/admin`)**:
  - Protected strictly by Supabase Auth (email + password, signups disabled) + `admins` table verification & RLS.
- **SEO & Structured Data**:
  - Dynamic `sitemap.xml` and `robots.txt` generation using `NEXT_PUBLIC_SITE_URL`.
  - Hreflang alternates between `/ar` and `/en`.
  - OpenGraph meta tags and JSON-LD `Product` schema on details pages.

---

## 📸 ImgBB API Key & Image Hosting Setup

### 1. Creating the ImgBB Key
1. Sign up / log in to [ImgBB](https://imgbb.com/).
2. Go to [ImgBB API Documentation](https://api.imgbb.com/) and click **Get API Key**.
3. Copy your API Key string.

### 2. Setting `IMGBB_API_KEY`
Add `IMGBB_API_KEY` to your environment variables on your server or hosting platform (Vercel, Railway, etc.):

```env
IMGBB_API_KEY="your_imgbb_api_key_here"
```

If using Supabase Edge Functions:
```bash
supabase secrets set IMGBB_API_KEY="your_imgbb_api_key_here"
```

### 3. Image Upload Security & Validation
- **Endpoint**: `POST /api/admin/upload-image` (Requires authenticated admin session).
- **Validation**:
  - Max file size: 2 MB.
  - Allowed formats: JPEG, PNG, WEBP (validated by magic bytes in buffer).
  - Host restriction: Returns only direct URLs starting with `https://i.ibb.co/`.
- **Rollback Strategy**:
  If ImgBB service is unavailable or key expires:
  1. Admins can paste direct image URLs manually using any valid `https://i.ibb.co/` or legacy Supabase storage URL verified by `isAllowedImageUrl()`.
  2. To revert to local/Supabase uploads, update `/api/admin/upload-image` to fallback to Supabase Storage bucket `product-media`.

---

## 📑 JSON Import Schema & Field Mapping Table

When using "استيراد من ملف", upload a JSON file (up to 1 MB) structured as follows:

| JSON Key | Target Form Field / State | Rules & Notes |
| :--- | :--- | :--- |
| `name_ar` | `name_ar` | Required string |
| `name_en` | `name_en` | Required string |
| `slug` | `slug` | Optional string (auto-generated if omitted) |
| `category` | `category_id` | Matches category slug, `name_ar`, or `name_en` |
| `price_egp` | `price_egp` | Required number |
| `status` | *(Ignored)* | **Will NOT override current form status** (defaults to Draft) |
| `level` | `level` | `beginner` \| `intermediate` \| `advanced` |
| `sort_order` | `sort_order` | Optional number |
| `payment_url` / `xpay_url` | `xpay_url` | Valid HTTPS URL |
| `tools` | `toolsInput` | Array of strings or comma-separated string |
| `short_desc_ar` / `short_ar` | `shortAr` | Text string |
| `short_desc_en` / `short_en` | `shortEn` | Text string |
| `full_desc_ar` / `description_ar` | `descAr` | Markdown text |
| `full_desc_en` / `description_en` | `descEn` | Markdown text |
| `cover_image_url` / `cover_path` | *(Ignored)* | **Will NOT touch image fields** (upload manually in UI) |
| `diagram_image_url` / `diagram_path` | *(Ignored)* | **Will NOT touch image fields** (upload manually in UI) |
| `youtube_url` / `video_url` | `videoUrl` | YouTube URL |
| `includes` | `includesAr`, `includesEn` | Repeater array |
| `steps` | `stepsAr`, `stepsEn` | Repeater array |

---

## 🛠️ Tech Stack

- **Frontend & Fullstack Server**: React 19 + Express + Vite + TypeScript
- **Styling & Fonts**: Tailwind CSS v4 + Cairo, IBM Plex Sans Arabic, Space Grotesk, JetBrains Mono
- **Database & Auth**: Supabase Postgres + Supabase Auth + Supabase Storage
- **Validation**: Zod + rehype-sanitize for Markdown
- **Testing**: Smoke test suite (`tsx tests/smoke.test.ts`)

---

## 🚀 Setup & Installation Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in values:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 🧪 Verification & Build Commands

- **Run Smoke Tests**:
  ```bash
  npx tsx tests/smoke.test.ts
  ```
- **Type Check & Linting**:
  ```bash
  npm run lint
  ```
- **Production Build**:
  ```bash
  npm run build
  ```
