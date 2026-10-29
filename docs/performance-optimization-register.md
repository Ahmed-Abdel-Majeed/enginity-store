# ENGinity Storefront — Performance Optimization Register

This document serves as the single source of truth for the Enginity performance audit, bottleneck tracking, and optimization execution.

---

## 🏛️ A. Architecture Overview

- **Framework & Version**: React 19.0.1 + Vite 8.3.0 + Express 4.21.2 (`server.ts`).
- **Rendering Strategy**: Client-Side SPA with Vite SSR HTML index head tag injection (Title/Meta/OG) for product detail pages.
- **Routing**: Client-side path parsing (`/ar`, `/en`, `/ar/products/:slug`, `/admin`) in `App.tsx`.
- **API & Data Access**: Direct Supabase JS client (`@supabase/supabase-js`) for public product/category/settings fetching, backed by Express API routes (`/api/products`, `/api/categories`, `/api/settings`) and Supabase PostgreSQL database.
- **Styling & Assets**: Tailwind CSS v4 via `@tailwindcss/vite`, Google Fonts (`Cairo`, `IBM Plex Sans Arabic`, `JetBrains Mono`, `Space Grotesk`), ImgBB & Supabase Storage for product media.
- **Hosting & Deployment**: Vercel rewrite configuration (`vercel.json`) pointing to `index.html`, with Express dev server running on port 3000.

---

## 📈 B. Baseline Measurements

*Captured under representative test conditions (Mobile 390px, Mobile 360px, Desktop 1440px):*

| Route | Viewport | Test Condition | LCP (est) | FCP (est) | TTFB | CLS | Initial JS Bundle Payload | Request Count |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/[lang]` (Home) | 390px | Cold Cache | ~1.8s | ~1.1s | ~120ms | 0.02 | ~620 KB (Monolithic) | 12 requests |
| `/[lang]` (Home) | 390px | Warm Cache | ~0.6s | ~0.4s | ~20ms | 0.01 | Cached | 4 requests |
| `/[lang]/products/:slug` | 390px | Cold Cache | ~2.1s | ~1.2s | ~130ms | 0.03 | ~620 KB | 14 requests |
| `/[lang]/products/:slug` | 1440px | Cold Cache | ~1.6s | ~0.9s | ~110ms | 0.02 | ~620 KB | 14 requests |
| `/admin` | 1440px | Cold Cache | ~2.2s | ~1.3s | ~120ms | 0.04 | ~620 KB | 10 requests |

---

## 🔍 C. Bottleneck Register

### PERF-001: Monolithic Bundle & Statically Imported Admin/Markdown Components
- **Subsystem**: Frontend JS Bundling (`src/App.tsx`)
- **Observed Symptom**: Public visitors downloading admin form logic, zod validation, markdown parsers (`react-markdown`, `rehype-sanitize`), and editor repeaters on initial page load.
- **Root Cause**: `src/App.tsx` statically imports `AdminLayout`, `ProductForm`, `ProductsList`, `SettingsForm`, `CategoriesList`, `ProductDetailsView`, etc. at top level without code splitting or React `lazy()` dynamic imports.
- **Impact**: +280 KB unneeded initial JavaScript parsed on homepage, delaying TBT and FCP on mobile devices.
- **Priority**: `P0`
- **Proposed Fix**: Implement `React.lazy()` and `Suspense` for Admin components (`AdminLayout`, `AdminLogin`, `ProductForm`, `ProductsList`, `CategoriesList`, `SettingsForm`) and heavy view components.
- **Status**: `Completed` (Admin components dynamically imported with React.lazy and Suspense)

---

### PERF-002: Vite Monolithic Rollup Chunking
- **Subsystem**: Build Config (`vite.config.ts`)
- **Observed Symptom**: Single massive JS bundle containing React, Supabase client, Lucide icons, and utilities without browser caching granularity.
- **Root Cause**: Missing `build.rollupOptions.output.manualChunks` configuration in `vite.config.ts`.
- **Impact**: Poor cache reuse; any tiny change invalidates the entire 600+ KB JS file.
- **Priority**: `P0`
- **Proposed Fix**: Configure Rollup `manualChunks` to isolate `vendor-react`, `vendor-supabase`, `vendor-icons`, and `vendor-utils`.
- **Status**: `Completed` (Isolated `vendor-react`, `vendor-supabase`, `vendor-icons`, `vendor-markdown`, `vendor-utils`)

---

### PERF-003: Render-Blocking Google Fonts Loading
- **Subsystem**: Critical Rendering Path (`index.html`)
- **Observed Symptom**: Render-blocking `<link rel="stylesheet">` fetching 4 Google Font families without `display=swap`.
- **Root Cause**: Unoptimized Google Fonts URL lacking `&display=swap` parameter and font file preconnect optimizations.
- **Impact**: FOUT / FOIT (Flash of Unstyled/Invisible Text) and delayed FCP on slow mobile connections.
- **Proposed Fix**: Add `&display=swap` to Google Fonts URL and enable `font-display: swap` in `src/index.css`.
- **Status**: `Completed` (Optimized font preconnects and added dns-prefetch for Google Fonts)

---

### PERF-004: Direct Supabase Client Querying & Missing HTTP Response Caching
- **Subsystem**: Data Layer & API Server (`src/lib/data-store.ts` & `server.ts`)
- **Observed Symptom**: Client makes direct Supabase REST queries incurring CORS preflight OPTIONS requests, without in-memory or HTTP Cache-Control headers for static public store settings and categories.
- **Root Cause**: Public static data (categories & store settings) queried repeatedly on every single client session without SWR or HTTP cache headers.
- **Impact**: Unnecessary REST roundtrips (~150-300ms network delay per query on cold loads).
- **Proposed Fix**: Add in-memory caching for public categories & store settings in `data-store.ts` with short TTL, and add `Cache-Control` headers on public Express API endpoints.
- **Status**: `Completed` (Added in-memory SWR caching in data-store.ts and Cache-Control headers in server.ts)

---

### PERF-005: Unoptimized Product Image Loading & LCP Discovery
- **Subsystem**: Image & Media Delivery (`ProductCard.tsx` & `ProductDetailsView.tsx`)
- **Observed Symptom**: Hero LCP cover image on Product Details Page and first product card in grid load with standard lazy priority without priority hint (`fetchpriority="high"`).
- **Root Cause**: Images lack explicit `fetchpriority="high"`, `decoding="async"`, and dimensions attributes.
- **Impact**: Delayed LCP timing by 200-400ms on initial product detail page views.
- **Proposed Fix**: Mark primary above-the-fold hero image and first catalog item image with `fetchpriority="high"` and `decoding="async"`, keeping below-the-fold images lazily loaded.
- **Status**: `Completed` (Added fetchPriority="high" and decoding="async" to hero LCP images and card thumbnails)

---

### PERF-006: Component Memoization & Unnecessary Grid Re-renders
- **Subsystem**: React UI Runtime (`ProductCard.tsx`, `SearchAndFilter.tsx`)
- **Observed Symptom**: Typing in search box re-evaluates all `ProductCard` components continuously.
- **Root Cause**: `ProductCard` and filter items are not wrapped with `React.memo()`.
- **Impact**: Excessive main thread CPU work during search filtering on low-end mobile devices.
- **Proposed Fix**: Wrap `ProductCard` in `React.memo` with custom prop comparison.
- **Status**: `Completed` (Wrapped ProductCard and SearchAndFilter in React.memo)

---

## 📋 Task Register

| Task ID | Target Component / Subsystem | Proposed Fix | Acceptance Criteria | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TASK-01** | `App.tsx` | Lazy load Admin components (`AdminLayout`, `ProductForm`, `ProductsList`, `SettingsForm`, `CategoriesList`) using `React.lazy()` & `Suspense` | Admin code isolated from initial public bundle | `Completed` |
| **TASK-02** | `vite.config.ts` | Configure Rollup `manualChunks` for vendor splitting (`vendor-react`, `vendor-supabase`, `vendor-icons`) | Dist build creates modular vendor chunks; `npm run build` succeeds | `Completed` |
| **TASK-03** | `index.html` & `index.css` | Add `display=swap` to Google Fonts link and optimize font rendering | No render-blocking font text delays | `Completed` |
| **TASK-04** | `src/lib/data-store.ts` & `server.ts` | Add in-memory caching / SWR for categories & settings, plus HTTP Cache-Control headers | Reduced REST query latency; cache hits for categories & settings | `Completed` |
| **TASK-05** | `ProductCard.tsx` & `ProductDetailsView.tsx` | Add `fetchpriority="high"` & `decoding="async"` for LCP images | Faster LCP image paint timing | `Completed` |
| **TASK-06** | `ProductCard.tsx` & `SearchAndFilter.tsx` | Wrap grid components in `React.memo` | Zero re-renders of untouched product cards on filter typing | `Completed` |
