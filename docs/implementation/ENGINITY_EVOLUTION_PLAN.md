# ENGINITY Marketplace — Autonomous Evolution Plan & Architecture Audit

## 1. Phase Zero: Architecture & Product Audit (T001)

### 1.1 Frontend Routes & Major Components
- **Framework**: React 19 SPA with TypeScript, Vite 8, and Tailwind CSS 4.
- **Routing (`src/App.tsx`)**:
  - `/` -> Redirects to `/ar` (Arabic-first default).
  - `/ar` and `/en` -> Public Storefront (Hero, SearchAndFilter, ProductCard Grid / Single-Product Spotlight, HowItWorks, AuthorCard, GeneralFaq, Footer, FloatingWhatsApp).
  - `/ar/products/:slug` and `/en/products/:slug` -> Public Product Details (`ProductDetailsView.tsx`), including interactive diagram zoom lightbox, YouTube privacy-enhanced video embed, requirements, workflow steps, FAQs, and sticky purchase/waitlist panel.
  - `/admin` -> Private Admin Workspace (`AdminLogin.tsx`, `AdminLayout.tsx`, `ProductsList.tsx`, `ProductForm.tsx`, `CategoriesList.tsx`, `SettingsForm.tsx`).

### 1.2 Backend Services & Data-Access Patterns
- **Express Server (`server.ts`)**:
  - Serves `/api/*` REST endpoints with Zod input validation, rate limiting (`adminRateLimiter`), Helmet-style security headers, Content-Security-Policy, and SSR metadata/OpenGraph tag injection.
  - Endpoints:
    - Public: `GET /api/categories`, `GET /api/settings`, `GET /api/products`, `GET /api/products/:slug`, `POST /api/waitlist/register`, `GET /sitemap.xml`, `GET /robots.txt`.
    - Admin (`requireAdmin` middleware): `POST /api/admin/login`, `GET /api/admin/me`, `POST /api/admin/logout`, CRUD for `/api/admin/products`, `/api/admin/categories`, `/api/admin/settings`, `GET /api/admin/waitlist/:productId`, `POST /api/admin/products/:productId/launch`, `POST /api/admin/upload-image`.
- **Dual-Mode Data Store (`src/lib/data-store.ts`)**:
  - Calls `/api/*` endpoints first and gracefully falls back to direct Supabase SDK operations if deployed to a static-only host where `/api/*` returns HTTP 404/405.

### 1.3 Database Entities, Relationships & RLS Boundaries
- **Provider**: Supabase PostgreSQL (`https://zqiieksqbbvlfzejbetq.supabase.co`). No Shopify backend is used; Supabase is the single source of truth for products, categories, waitlists, and store settings.
- **Existing Tables**:
  1. `public.categories`: Public `SELECT`; Admin `INSERT/UPDATE/DELETE` via `public.is_admin()`.
  2. `public.products`: Public `SELECT` for `status IN ('published', 'coming_soon')`; Admin full CRUD.
  3. `public.settings`: Single-row (`id = 1`) store settings; Public `SELECT`; Admin `UPDATE`. Dynamic integration settings are stored inside `social_links` JSONB.
  4. `public.admins`: Maps `auth.users(id)` to admin privileges; checked via `public.is_admin()` SECURITY DEFINER function.
  5. `public.product_waitlist`: Public `INSERT` for `coming_soon` products with `waitlist_enabled = true`; Admin-only `SELECT/UPDATE/DELETE` (prevents public harvesting of customer emails and WhatsApp numbers).
- **Storage Buckets**:
  - `product-media` (public read, admin write).
  - `private-crm` (private bucket, `public: false`; anonymous read blocked by RLS, accessible only via authenticated admin/system client).

### 1.4 Product Publication, Checkout & Notification Lifecycle
- **Available Products (`status = 'published'`)**: Purchased via validated HTTPS XPay checkout links (`xpay_url`).
- **Upcoming Products (`status = 'coming_soon'`)**: Visitors register via `WaitlistModal.tsx` with explicit channel consent (`email_consent`, `whatsapp_consent`).
- **Launch Notification Dispatch**: Admin triggers launch via `ProductsList.tsx` -> dispatches full product & subscriber payload to configured n8n webhook (`https://n8n-enginity.duckdns.org/webhook/send-email-from-user-product-publish`) and optional Resend/WhatsApp APIs, then updates subscriber status to `sent`.

### 1.5 Baseline Build, Tests & Existing Defects (T002)
- `npm run build` (`vite build`) and `npm run lint` (`tsc --noEmit`) pass cleanly.
- **Baseline Defect Identified in `tests/smoke.test.ts`**:
  - `isAllowedImageUrl('http://i.ibb.co/insecure.jpg')` in `src/lib/utils.ts` line 18 had `if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;`, which erroneously permitted insecure `http:` URLs and caused Test 4 in `tests/smoke.test.ts` to fail.
  - **Fix required in T002**: Restrict `isAllowedImageUrl` strictly to `parsed.protocol === 'https:'` (plus `data:image/` and local `/uploads/`).

---

## 2. Architectural Decision Records (ADRs) (T003 & T004)

### ADR-001: Catalog Source of Truth for AI Shopping Assistant
- **Context**: Feature A requires a catalog retrieval tool for the AI Shopping Assistant. The prompt notes evaluating whether Supabase or Shopify powers the catalog.
- **Evaluated Options**:
  - *Option A*: Introduce Shopify Storefront API integration.
  - *Option B*: Build a read-only Supabase catalog retrieval tool (`searchCatalogProducts`) querying live `public.products` (`status IN ('published', 'coming_soon')`) and `public.categories`.
- **Decision**: **Option B**.
- **Rationale**: Inspection proves ENGINITY's catalog is 100% powered by Supabase (`public.products`) and checkout uses XPay links. Introducing Shopify would be artificial and break the single source of truth. The catalog tool must be strictly read-only, filter out `draft` and `archived` products, and validate all product URLs, prices, and statuses against the real database records before returning them to the client.

### ADR-002: AI Shopping Assistant Orchestration & Security Boundary
- **Context**: Visitors need an intelligent bilingual (Arabic/English) conversational assistant that understands business problems, asks concise clarifying questions when needed, searches the live ENGINITY catalog, explains why products match (and their limitations), and connects users to Waitlist, Custom Automation Requests, Product Suggestions, or WhatsApp human support.
- **Evaluated Options**:
  - *Option A*: Direct browser-to-n8n or browser-to-LLM calls. (Rejected: exposes credentials/keys, vulnerable to abuse and CORS failures).
  - *Option B*: Server-side `/api/assistant/chat` endpoint in `server.ts` with rate limiting, input validation, read-only catalog retrieval tool, optional forwarding to an authenticated n8n AI Agent webhook (`N8N_ASSISTANT_WEBHOOK_URL`) if configured, server-side `@google/genai` (`gemini-3.8-flash`) tool-calling agent when `GEMINI_API_KEY` is configured, AND a deterministic semantic catalog-matching engine fallback when external AI/n8n endpoints are unconfigured or unreachable.
- **Decision**: **Option B (Multi-Layered Server-Side Agent + Deterministic Catalog Matcher Fallback)**.
- **Rationale**:
  1. Never exposes API keys (`GEMINI_API_KEY`, n8n secrets, or Supabase service keys) to the browser.
  2. Uses `@google/genai` (`gemini-3.8-flash`) with function calling (`search_catalog`, `get_product_details`) on the server side when `GEMINI_API_KEY` is available, or routes to `N8N_ASSISTANT_WEBHOOK_URL` if configured.
  3. Includes a smart bilingual intent & catalog-scoring engine that guarantees 100% uptime and accurate, hallucination-free recommendations from the live Supabase catalog even if an external LLM key or n8n AI workflow is temporarily offline or unconfigured.
  4. Hard-validates every recommended product card against live catalog rows so the assistant can never hallucinate product IDs, slugs, prices, or availability.

### ADR-003: Persistence & Privacy for Custom Automation Requests & Product Suggestions
- **Context**: Feature B (Custom Automation Requests) and Feature C (Customer Product Suggestions & Demand Validation) require storing customer submissions, preventing duplicates/spam, protecting private contact details and admin notes from public users, and providing admin management & analytics dashboards.
- **Evaluated Options**:
  - *Option A*: Only create SQL migration `0004` for `public.custom_automation_requests` and `public.product_suggestions`. (Risk: Until the database owner manually runs `0004` in the remote Supabase SQL Editor, PostgREST returns `PGRST205` and live submissions would fail).
  - *Option B*: Create additive SQL migration `0004_add_custom_requests_and_product_suggestions.sql` with full RLS policies (`PUBLIC INSERT`, `ADMIN SELECT/UPDATE/DELETE`), AND implement a transparent **Dual-Tier Cloud Persistence Adapter** that uses the native SQL tables first and automatically falls back to the private, RLS-protected Supabase Storage bucket (`private-crm/custom_requests.json` and `private-crm/product_suggestions.json`) via the authenticated system admin client on the server.
- **Decision**: **Option B**.
- **Rationale**: Guarantees immediate production functionality on the live Supabase project while maintaining strict privacy (anonymous users are blocked by Supabase Storage RLS from reading `private-crm`), full durability across restarts, and seamless forward-compatibility once migration `0004` is executed in SQL Editor.

---

## 3. Prioritized Task Backlog

| Task ID | Phase | Description | Priority | Dependencies | Target Files | Status | Verification Results |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **T001** | Phase 0 | Audit repository, database, integrations, and production environment | P0 | None | `docs/implementation/ENGINITY_EVOLUTION_PLAN.md` | `VERIFIED` | Audited all routes, `server.ts`, `data-store.ts`, Supabase tables (`categories`, `products`, `settings`, `admins`, `product_waitlist`) and storage buckets. |
| **T002** | Phase 0 | Establish baseline build, tests, and fix existing `isAllowedImageUrl` HTTP defect | P0 | T001 | `src/lib/utils.ts`, `tests/smoke.test.ts` | `VERIFIED` | Fixed `isAllowedImageUrl` to reject `http:` links; `npx tsx tests/smoke.test.ts` passed all 5 baseline tests. |
| **T003** | Phase 0 | Create persistent backlog and architecture decision records | P0 | T001 | `docs/implementation/ENGINITY_EVOLUTION_PLAN.md` | `VERIFIED` | Documented ADRs 001–003 and task table in `docs/implementation/ENGINITY_EVOLUTION_PLAN.md`. |
| **T004** | Phase 0 | Define shared security, rate limiting, error handling, and notification conventions | P0 | T002 | `server.ts`, `src/types/index.ts` | `VERIFIED` | Implemented `publicSubmissionRateLimiter` (25 req/min/IP), Zod payload validation, and public-safe response sanitization in `server.ts`. |
| **T010** | Phase 1 | Design & write additive migration `0004` for `custom_automation_requests` + dual-tier cloud storage adapter | P1 | T004 | `supabase/migrations/0004_add_custom_requests_and_product_suggestions.sql`, `src/lib/crm-store.ts`, `server.ts`, `src/lib/data-store.ts` | `VERIFIED` | Created migration `0004` with RLS (`PUBLIC INSERT`, `ADMIN SELECT/UPDATE/DELETE`) and `src/lib/crm-store.ts` with private `private-crm` storage fallback + write-through cache. |
| **T011** | Phase 1 | Implement customer-facing Custom Automation Request modal (`CustomRequestModal.tsx`) | P1 | T010 | `src/components/CustomRequestModal.tsx`, `src/i18n/ar.ts`, `src/i18n/en.ts` | `VERIFIED` | Built bilingual RTL/LTR modal with tool selector, budget/timeframe dropdowns, explicit consent validation, and prefill support. |
| **T012** | Phase 1 | Implement Admin Custom Requests management dashboard (`CustomRequestsList.tsx`) with status, notes & quote tracking | P1 | T010 | `src/components/admin/CustomRequestsList.tsx`, `src/components/admin/AdminLayout.tsx`, `src/App.tsx` | `VERIFIED` | Built split-pane Admin manager with status filter, search, click-to-email/WhatsApp, quote EGP input, and private internal notes. |
| **T013** | Phase 1 | Implement idempotent request notifications (n8n webhook / email) and automated tests for custom requests | P1 | T011, T012 | `src/lib/crm-store.ts`, `tests/evolution.test.ts` | `VERIFIED` | Verified valid creation, invalid rejection, 10-minute duplicate idempotency, admin quote/status updates, and anonymous read block in `tests/evolution.test.ts`. |
| **T020** | Phase 2 | Implement Product Suggestion schema, purchase-intent & budget fields, duplicate prevention, and API endpoints | P1 | T010 | `src/lib/crm-store.ts`, `server.ts`, `src/lib/data-store.ts`, `src/types/index.ts` | `VERIFIED` | Implemented `createProductSuggestion`, `fingerprint_hash` duplicate prevention, and `computeDemandAnalytics` in `src/lib/crm-store.ts` & `server.ts`. |
| **T021** | Phase 2 | Implement customer-facing Product Suggestion & Demand Validation form (`ProductSuggestionModal.tsx`) | P1 | T020 | `src/components/ProductSuggestionModal.tsx`, `src/i18n/ar.ts`, `src/i18n/en.ts` | `VERIFIED` | Built customer suggestion modal with explicit self-reported purchase likelihood (`very_likely`, `likely`, `not_sure`, `unlikely`) and price range. |
| **T022** | Phase 2 | Implement Admin Demand Analytics & Prioritization view (`ProductSuggestionsList.tsx`) with convert-to-Coming-Soon action | P1 | T020 | `src/components/admin/ProductSuggestionsList.tsx`, `src/components/admin/AdminLayout.tsx`, `src/App.tsx` | `VERIFIED` | Built Demand Analytics dashboard showing total submissions, distinct contacts, high-intent count, top integrations, grouped ideas, and 1-click conversion to a `coming_soon` catalog product. |
| **T023** | Phase 2 | Verify duplicate prevention, privacy safeguards, and demand aggregation calculations with automated tests | P1 | T021, T022 | `tests/evolution.test.ts` | `VERIFIED` | Verified in `tests/evolution.test.ts` Group 3: invalid rejection, `fingerprint_hash` deduplication, and 100% accurate demand analytics aggregation. |
| **T030** | Phase 3 | Define AI Shopping Assistant contract, security boundaries, rate limits, and read-only catalog retrieval tool | P1 | T004 | `src/lib/assistant-engine.ts`, `server.ts`, `src/types/index.ts` | `VERIFIED` | Implemented `searchLiveCatalog`, `validateRecommendationsAgainstCatalog`, and `checkSecurityGuardrails` in `src/lib/assistant-engine.ts`. |
| **T031** | Phase 3 | Implement server-side AI Agent (`/api/assistant/chat`) with `@google/genai` (`gemini-3.8-flash`), optional n8n agent webhook, and deterministic catalog-matching fallback | P1 | T030 | `src/lib/assistant-engine.ts`, `server.ts` | `VERIFIED` | Implemented `processAssistantTurn` with strict anti-hallucination catalog validation and resilient fallback. |
| **T034** | Phase 3 | Implement accessible, RTL/LTR bilingual AI Shopping Assistant UI (`AiShoppingAssistant.tsx`) with structured product cards | P1 | T031 | `src/components/AiShoppingAssistant.tsx`, `src/i18n/ar.ts`, `src/i18n/en.ts` | `VERIFIED` | Built floating launcher & drawer with starter prompts, clarifying questions, verified product cards, and next-step action buttons. |
| **T040** | Phase 4 | Connect AI Assistant to real Product Detail pages, Coming Soon Waitlist modal, Custom Request modal, Product Suggestion modal, and WhatsApp human escalation | P1 | T034, T011, T021 | `src/components/AiShoppingAssistant.tsx`, `src/App.tsx` | `VERIFIED` | Wired assistant actions to navigate to `/:lang/products/:slug`, prefill `CustomRequestModal`, prefill `ProductSuggestionModal`, or open WhatsApp support. |
| **T050** | Phase 5 | Improve Storefront UX: unified acquisition CTAs in Hero/Catalog/Footer, and clean visual hierarchy | P2 | T040 | `src/components/Hero.tsx`, `src/components/Footer.tsx`, `src/App.tsx` | `VERIFIED` | Added AI Advisor & Custom System CTAs to Hero, acquisition banner below catalog grid, empty-search fallbacks, and Footer quick links. |
| **T051** | Phase 5 | Run full automated regression, security, assistant accuracy, and demand analytics test suite | P0 | T050 | `tests/smoke.test.ts`, `tests/evolution.test.ts` | `VERIFIED` | `npx tsx tests/smoke.test.ts`, `npx tsx tests/evolution.test.ts`, `npm run lint`, and `npm run build` all passed with 0 errors. |

