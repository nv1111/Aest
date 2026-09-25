# AGENTS.md — Tara (Customer-Side Jyotish Web App)

Every change to this project MUST respect this file. When in doubt, read it again.

## 1. Project Purpose

Tara is the **customer/user-side** web application of a modern Indian astrology platform.
Philosophy: **TRUST + SIMPLICITY + PERSONALIZATION**.

- UX benchmark: ChatGPT-level conversational simplicity.
- Trust benchmark: a premium financial app — clear pricing, clear permissions, clear data ownership, transaction history, no hidden actions.
- Must NOT feel like a cheap mystical app. No fear-based copy, no fake urgency, no fake verification, no guaranteed outcomes, no jargon walls.
- A first-time smartphone user must be able to use it without knowing astrology terms.

**Out of scope forever (in this repo):** astrologer portal, super-admin panel.

**Stack reality (adaptation):** The product spec targets React Native/Expo/Supabase, but this
repo runs on the sandbox's mandated stack. Adaptation mapping (must be preserved):

| Spec | This repo |
| --- | --- |
| Expo Router | Single route `/` (src/app/page.tsx) + client-side screen registry (tab + stack navigation in a zustand store) |
| Supabase Postgres | Prisma ORM + SQLite (db/custom.db) |
| Supabase Auth | Phone OTP flow backed by `OtpCode` + `Session` tables, httpOnly cookie sessions |
| Supabase Realtime | socket.io mini-service (`mini-services/chat-service`, port 3003) via `io("/?XTransformPort=3003")` |
| Expo Secure Store | httpOnly cookies (never store tokens in localStorage) |
| React Native SVG | Inline SVG chart components |

## 2. Architecture Rules

1. **No astrology math in UI.** All astrology data flows: UI → services (`src/services`) → API (`src/app/api`) → `AstrologyProvider` (server-side) → engine. UI only renders normalized types.
2. **Provider abstraction is law.**
   - `src/lib/astrology/types.ts` — normalized interfaces (BirthChart, PlanetPosition, House, DashaLevel, TransitInfo, PanchangData, ChoghadiyaData, HoroscopeReading, CompatibilityResult, DivisionalChart…).
   - `src/lib/astrology/mock-provider.ts` — the ONLY engine wired today. Clearly a MOCK (deterministic, seeded by profile). `src/lib/astrology/index.ts` exposes `getAstrologyProvider()`.
   - Future: real engine implements the same interface; zero UI changes.
3. **Do not invent real astrology claims.** Mock outputs must be labeled. Any screen showing mock-computed astrology data shows the small `DemoDataBadge` ("Demo data — pending verified engine") when `providerInfo.mode === 'mock'`.
4. **AI keys never client-side.** All LLM calls via `z-ai-web-dev-sdk` in `/api/*` routes only. LLM interprets pre-computed chart context; LLM never does math.
5. **No secrets in client code.** No service-role keys, payment secrets, provider secrets. Mock payment/communication providers are clearly labeled demo.
6. **APIs, not server actions.** All backend logic lives in `src/app/api/**/route.ts`.
7. **Authorization:** every API route resolves the session user server-side via `src/lib/session.ts` (`requireUser()`). Users may only read/write their own rows. Astrologer private fields never leave the server.
8. **Single user-visible route:** `/`. Never add other page routes. Deep screens are client screens in the registry.
9. **Money:** wallet mutations only server-side. Client never computes final charges — only displays server-provided values (rate, duration, running meter from server timestamps).

## 3. Folder Structure (do not invent new top-level folders)

```
src/
  app/                    # Next.js: page.tsx (app shell), api/* routes ONLY
  components/
    ui/                   # shadcn/ui (existing — do not restyle globally)
    app/                  # app chrome: AppShell, BottomNav, ScreenHeader, registry
    shared/               # cross-feature design-system wrappers (SectionHeader, EmptyState,
                          #   ErrorState, ListRow, TrustNote, DemoDataBadge, Money, etc.)
  features/
    onboarding/ home/ ask/ astrology/ astrologers/ consultation/
    wallet/ reports/ profile/ notifications/
  services/               # typed client-side API services (one file per domain)
  lib/
    astrology/            # provider abstraction + mock engine + normalized types
    session.ts api.ts cache.ts cities.ts money.ts analytics.ts
  store/                  # zustand stores (app/navigation, session, ui)
  i18n/                   # t() + en/<feature>.ts dictionaries (no hard-coded UI strings)
  types/                  # shared cross-layer models
mini-services/
  chat-service/           # socket.io relay (port 3003), persistence stays in Next.js API
prisma/schema.prisma      # single source of truth for data
```

## 4. Naming & Code Standards

- TypeScript strict. **No `any`** (use `unknown` + narrowing, or document why).
- Files: `kebab-case.ts` for libs, `PascalCase.tsx` for components. Screens: `XxxScreen.tsx`.
- Screens register in `src/components/app/screens.tsx` (single registry file — coordinate edits).
- Client data fetching: TanStack Query with query keys namespaced per domain (`['chart', profileId]`).
- Local UI state: zustand. Server state: react-query. Never duplicate.
- Zod-validate all API inputs (`src/lib/api.ts` helpers: `ok()`, `fail()`, `parseBody()`).
- Money as `number` (INR) in APIs; always formatted via `src/lib/money.ts` (`formatINR`).
- Dates: ISO strings over the wire; birth dates stored as `YYYY-MM-DD` strings.
- All user-visible strings via `t()` from `src/i18n`. Feature dictionaries are feature-owned.
- Animations: subtle framer-motion (150–250ms). No flashing, no parallax cosmos.
- Minimum touch target 44px. Semantic HTML, aria labels on icon buttons.

## 5. Design System (Trust Aesthetic)

- Warm ivory background `--background`, deep warm charcoal text, **one accent: terracotta** (`--primary`). Never indigo/blue as primary. No gradients except the softest image-free washes.
- Radius scale via `--radius` (rounded cards where useful — not "cards everywhere").
- Serif display font (Fraunces) for brand/headlines, Geist Sans for UI text.
- Structure per screen: `ScreenHeader` (back/title) → content sections with `SectionHeader` (small caps label) → cards/list rows.
- Loading = skeletons (shadcn Skeleton). Empty = `EmptyState` with one clear CTA. Error = `ErrorState` with Retry. Never blank screens.
- Trust copy rules: no "Your future is in danger", no countdown urgency, no "guaranteed". Use "Traditional astrology interprets this as…". AI answers carry "Based on your chart" + "Why?" disclosure. Pricing always visible before any paid action. Every wallet line item has date/description/amount/status.

## 6. Data & Privacy Rules

- Birth profile: name, DOB (string), TOB, `timeAccuracy` (`exact|approximate|unknown` — never silently invent a time), place name, lat, lng, IANA timezone.
- `User`, `BirthProfile`, `WalletAccount`, `AiConversation`, `Consultation`, `Message`, `Report`, `Notification`, `SupportTicket` etc. — see prisma/schema.prisma. UUID ids. `createdAt`/`updatedAt` everywhere.
- Demo data is flagged `isDemo: true` in DB. Astrologer `isVerified` comes ONLY from the backend — never hard-code a "Verified" badge.
- Privacy center explains data stored / why / who sees it. Astrologer mock replies only see chart context the user consented to share for that consultation (stated in pre-consultation screen).
- Account deletion must remove user rows (cascades) — implemented in `/api/account/delete`.

## 7. Testing & Quality Bar

- Before considering any feature done: `bun run lint` clean, `bunx tsc --noEmit` clean, page loads in browser (agent-browser), empty/loading/error states verified.
- No test files required in this sandbox unless explicitly asked; prefer manual QA via agent-browser + dev.log inspection.
- Check `/home/z/my-project/dev.log` for runtime errors after every change batch (read only recent lines).

## 8. Demo Mode Contract

- `/api/auth/request-otp` returns `demoOtp` — UI must show it labeled "Demo mode: OTP shown because SMS is not connected".
- Mock astrologers reply via LLM persona — chat header shows "Demo astrologer — AI-simulated".
- Mock payment provider UI shows "Demo payment — no real money involved".
- Never present demo data as production data. Never fabricate: verification, live calls, real payments.

## 9. Realtime Rules (sandbox gateway)

- Socket.io client connects as `io("/", { path: "/", query... })` → always `io("/?XTransformPort=3003")` style via env helper. Never `http://localhost:PORT`.
- Message persistence happens in Next.js API routes; the socket service only relays events (`consultation:join`, `consultation:message`, `consultation:typing`, `consultation:read`, `astrologer:reply`).

## 10. Analytics

- `trackEvent(name, props?)` from `src/lib/analytics.ts` — console + queue only (privacy-conscious, no PII). Wire it on: app_opened, onboarding_completed, birth_profile_created, kundli_viewed, ai_question_asked, astrologer_viewed, consultation_started/completed, wallet_recharged, report_generated/downloaded.

## 11. Golden Rules (recap)

1. Don't fake production data. 2. Don't hard-code astrology in UI. 3. Don't put secrets or LLM calls client-side. 4. Don't touch other features' folders without coordination via worklog. 5. One accent color. 6. Calm > mystical. 7. Every screen: loading/empty/error. 8. Use the worklog: read before, append after.
