# Tara — Master Development Plan

> **Single source of truth for the roadmap.** Every dev session reads this first,
> executes the current phase top-to-bottom, ticks items off, and appends to
> `worklog.md`. Do not skip phases; do not start a phase before the previous
> one's acceptance criteria pass.

- Version: 1.0
- Last updated: 2026-09-27
- Repo: https://github.com/nv1111/Aest
- Database: Supabase Postgres (live, single source of data)
- Stack: Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui · Prisma · socket.io (3003) · z-ai-web-dev-sdk

---

## 0. Executive Summary (Ek Nazar Me)

Tara ek **Indian astrology SAAS platform** hai — 3 products ek shared core pe:

| # | Product | User | Status |
|---|---------|------|--------|
| 1 | **User App** (jo abhi bana hai) | Customers — kundli, panchang, AI, astrologer chat/call, pooja booking | ~85% UI done, backend real |
| 2 | **Astrologer Console** | Pandits/jyotishis — consultation queue, earnings, availability | Phase 2-3 |
| 3 | **Super Admin Console** | Company — KYC, pooja ops, payments, analytics | Phase 2, 5 |

**Development strategy**: pehle sab kuch isi app me **role-switch demo mode** me banega (fast dev + testing), aur final production me teeno alag Vercel deployments banenge (security isolation). Ye standard multi-tenant SAAS pattern hai.

**Current live infra**: Supabase Postgres (migrated from SQLite ✓), GitHub repo (backup ✓), dev server port 3000, chat relay port 3003.

---

## 1. Current State (2026-09-27)

### ✅ Jo REAL hai
- **Database**: Supabase Postgres — 20 models (User, Session, OtpCode, BirthProfile, AstrologyCache, Astrologer, Review, Favorite, Consultation, Message, AiConversation, AiMessage, WalletAccount, WalletTransaction, Payment, Report, Notification, NotificationPreference, SupportTicket)
- **~40 API routes** real DB ke saath: auth (OTP+session cookies), profiles, astrology, consultations, messages, wallet, payments, reports, notifications, reviews, support, account
- **Real-time chat relay**: socket.io :3003, HMAC ticket auth, messages DB me persist
- **AI "Ask Tara"**: real LLM (z-ai-web-dev-sdk) + TTS + feedback loop
- **i18n**: English + हिन्दी (770 keys parity), Devanagari fonts
- **UI**: 25+ screens, responsive (430px mobile frame + desktop grid), polished design system

### ⚠️ Jo MOCK hai (production se pehle badlega)
1. **Astrology engine** — mean-longitude approximation (±1-2° error) → Phase 1 me real ephemeris
2. **Astrologers** — 12 seeded demo profiles, bot-simulated replies → Phase 2/3 me real
3. **Payments** — mock provider, paisa nahi jaata → Phase 6 me Razorpay
4. **OTP SMS** — dev me code return hota hai → Phase 6 me MSG91
5. **Pooja module** — exist nahi karta → Phase 4

---

## 2. Target Architecture

```
┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐
│  USER APP        │  │ ASTROLOGER CONSOLE│  │ SUPER ADMIN      │
│  tara.app        │  │ astro.tara.app    │  │ admin.tara.app   │
├──────────────────┤  ├───────────────────┤  ├──────────────────┤
│ Login/OTP        │  │ Pandit login+KYC  │  │ Company login    │
│ Kundli/Panchang  │  │ Consult queue     │  │ KYC approve      │
│ Dasha/Match      │  │ Chat/audio/video  │  │ Pooja catalog    │
│ AI "Ask Tara"    │  │ User ki kundli    │  │ Brahmin allocate │
│ Astrologer browse│  │  (auto, consent)  │  │ Payments/refunds │
│ Wallet/Payments  │  │ Earnings/payout   │  │ Disputes         │
│ Pooja booking    │  │ Availability      │  │ Analytics        │
│ Reports          │  │ Reminders         │  │ Support inbox    │
└────────┬─────────┘  └────────┬──────────┘  └────────┬─────────┘
         └──────────────┬──────┴──────────────────────┘
              ┌─────────▼──────────┐
              │   SHARED CORE      │
              │ • Supabase Postgres│
              │ • Astro engine     │
              │   (live ephemeris) │
              │ • Razorpay         │
              │ • SMS/WhatsApp     │
              │ • Socket relay     │
              └────────────────────┘
```

**Vercel deployment plan (Phase 6)**: monorepo → 3 Next.js apps (`apps/user`, `apps/astrologer`, `apps/admin`) + `packages/shared` (types, prisma, engine, i18n). Teen alag Vercel projects, teen alag domains. Kyun: security isolation (astrologer app me user-auth code hi nahi), blast-radius control, alag access policies, clean RBAC boundaries.

**Dev-time (Phase 2-5)**: teeno roles isi ek app me **role-switch demo mode** se — kyunki dev/testing fast hota hai, ek hi DB/API surface, aur demo me client ko poora product dikhta hai.

---

## 3. Phases

### Phase 0 — Infra & Foundation ✅ DONE (2026-09-27)

- [x] Supabase Postgres migration (schema push, 20 models)
- [x] Demo seed (12 astrologers + reviews) on live DB
- [x] `TARA_DATABASE_URL` runtime override (sandbox shell injection-proof)
- [x] E2E verify: OTP login → astrologers → astrology APIs on Supabase
- [x] Git repo + GitHub push (main)
- [x] `.gitignore` hardened (`.env*`, `db/*.db`, screenshots, logs)
- [x] This PLAN.md

**Acceptance**: ✅ app runs fully on live Supabase; all APIs 200/401-correct.

---

### Phase 1 — Real Astrology Engine 🎯 CURRENT

**Goal**: mock approximation ko replace karna with production-grade ephemeris. Ye platform ki credibility ka core hai — kundli GALAT nahi honi chahiye.

**Approach**: `astronomy-engine` (MIT, VSOP87-grade precision) ko `AstrologyProvider` interface ke peeche wrap karna. Custom logic (dasha, panchang, gun-milan) hum likhenge, planetary positions engine se.

**Tasks**:
- [ ] 1.1 Install `astronomy-engine`; new `src/lib/astrology/live/` module
- [ ] 1.2 Geocentric apparent longitudes: Sun…Saturn + Rahu (mean node), Ketu = Rahu+180°
- [ ] 1.3 Precise Lahiri ayanamsa (Chitrapaksha) formula/table
- [ ] 1.4 Sidereal positions → rashi, nakshatra, nakshatra-pada, retrograde (real second-derivative, not synodic mock)
- [ ] 1.5 Ascendant: proper sidereal-time + oblique-sphere formula (RAMC) — verify vs reference charts
- [ ] 1.6 Houses (whole-sign Parashari) + divisional charts D9 (Navamsa), D10 (Dashamsa)
- [ ] 1.7 **Vimshottari dasha**: Moon nakshatra se maha → antar → pratyantar periods (real, not mock)
- [ ] 1.8 **Panchang**: tithi (Sun-Moon 12°), nakshatra, yoga (27), karana (60/11), vara, sunrise/sunset (NOAA already good), moon phase, Rahu Kaal / Gulika / Abhijit muhurta
- [ ] 1.9 **Ashtakoota compatibility** (gun milan 36 points): Varna(1), Vashya(2), Tara(3), Yoni(4), Graha Maitri(5), Gana(6), Bhakoot(7), Nadi(8) + Mangal dosha check
- [ ] 1.10 Validation harness: 3-5 known reference birth charts + today's panchang vs drikpanchang.com — tolerance: planets ±0.05°, ascendant ±0.5°, nakshatra exact, dasha dates ±1 day
- [ ] 1.11 Provider switch: `ASTROLOGY_PROVIDER=live|mock` env; cache via existing `AstrologyCache` table
- [ ] 1.12 Hindi/English labels: engine numbers + keys return kare, UI i18n layer translate kare
- [ ] 1.13 Transits & daily horoscope: real current transits (gochar) — planet → natal house mapping

**DB**: no schema change (cache table already exists)

**Acceptance**: reference charts match; panchang aaj ka drikpanchang se match; kundli/dasha/matching screens live engine se; Devanagari + English dono me correct.

**Effort**: M-L (engine math + validation)

---

### Phase 2 — Role-Switch Demo Mode (3-in-1 App)

**Goal**: isi app me astrologer + admin consoles — dev aur client-demo ke liye. Production me split hoga (Phase 6).

**Tasks**:
- [ ] 2.1 **DB**: `role` on User (`user|astrologer|admin`), `AstrologerAccount` model (link User↔Astrologer, credentials, status), demo admin user seed
- [ ] 2.2 **Role switcher UI**: Profile → "Demo Mode" section (clearly labelled DEMO) → switch persona → console UI dikhe
- [ ] 2.3 **Astrologer Console screens**: dashboard (earnings, stats, queue), incoming consultation requests (accept/reject), chat interface (reuse), user kundli context panel (with consent flag), availability toggle, reviews
- [ ] 2.4 **Super Admin screens**: dashboard (metrics cards), astrologer KYC table (approve/reject/suspend), consultations list, support inbox, refunds
- [ ] 2.5 **APIs**: `/api/astrologer-console/*` + `/api/admin/*` with role guards
- [ ] 2.6 Simulated live astrologer: bot replies ko role-switch se replace — "astrologer" persona real typing + manual reply kar sake (demo me hum khush astrologer ban ke test karte hain)
- [ ] 2.7 Bottom nav / sidebar per-role dynamic

**Acceptance**: persona switch kar ke teeno consoles functional — astrologer chat reply kar sakta hai, admin KYC approve kar sakta hai, sab Supabase me persist ho.

**Effort**: M

---

### Phase 3 — Astrologer Side Full (Production Logic)

**Goal**: role-switch demo ko real production flows me convert.

**Tasks**:
- [ ] 3.1 Astrologer OTP login (reuse OtpCode) + KYC profile (docs upload, expertise, rates, languages)
- [ ] 3.2 Availability calendar (slots, online/away/offline auto by schedule)
- [ ] 3.3 Consultation lifecycle: request → accept/timeout → active (per-minute billing, server-side wallet debit every 60s) → end + summary; audio/video signaling via socket relay
- [ ] 3.4 Kundli context: consultation start pe user ke (consented) birth details + live engine chart automatically astrologer ko bhejna
- [ ] 3.5 Earnings ledger: per-consultation credit (company commission %), payout requests, history
- [ ] 3.6 Notifications: new request, accepted, ended, payout (in-app + push)
- [ ] 3.7 Chat relay hardening: astrologer-side socket auth, typing, read receipts, media (image) messages

**DB**: `AstrologerAccount` extend, `EarningsLedger`, `PayoutRequest`, `AvailabilitySlot` models

**Acceptance**: full user↔astrologer session E2E — request → accept → chat → per-minute billing → end → earnings credit → payout request.

**Effort**: L

---

### Phase 4 — Pooja Vidhi Module

**Goal**: Havan, Navchandi yagn, Rudrabhishek, Satyanarayan Katha type pooja booking — company poori zimmedari leti hai, brahmin allocate hota hai, reminders chalte hain.

**Tasks**:
- [ ] 4.1 **DB models**: `PoojaService` (catalog: name, desc, duration, base price, category, images), `PoojaOption` (samagri included/excluded, venue ghar/temple/center, size small/medium/grand, add-ons), `Brahmin` (KYC, skills, languages, rate, rating), `PoojaBooking` (user, service, options, date/slot, venue+address, status flow, amount), `BrahminAssignment` (booking↔brahmin, role: head/assistant), `ReminderLog`, `PoojaMedia` (photos/videos), `PoojaReview`
- [ ] 4.2 **Catalog UI (user)**: pooja browse/filter, detail page (what's included, samagri list, duration, FAQs), price calculator (options × date), booking calendar (available slots)
- [ ] 4.3 **Booking flow**: date+time+venue+address → samagri options → price summary → wallet payment → confirmation + receipt
- [ ] 4.4 Astrologer bhi user ke behalf pe book kar sake (consultation se)
- [ ] 4.5 **Admin allocation**: booking request board, brahmin availability match (date, skills, location), assign team (1 head + N assistants), status board (scheduled → assigned → in-progress → completed)
- [ ] 4.6 **Reminder engine**: T-3d, T-1d, day-of morning (pandit details + arrival time), post-completion (thank you + review ask) — in-app + notification + (Phase 6: WhatsApp/SMS)
- [ ] 4.7 Cancellation/refund policy: date-based sliding refund, brahmin re-allocation
- [ ] 4.8 Live-stream option placeholder (Phase 6: media provider)
- [ ] 4.9 Post-pooja: media gallery, prasad courier tracking placeholder, digital receipt (uiii), review prompt
- [ ] 4.10 Brahmlin side (role-switch me): assignment calendar, accept jobs, day-of checklist

**Acceptance**: user Navchandi book kare → payment → admin 2 brahmin allocate → reminders fire (mock push) → complete → media + receipt + review. Astrologer-initiated booking bhi E2E.

**Effort**: L

---

### Phase 5 — Super Admin Console Full

**Goal**: company ka pura control room.

**Tasks**:
- [ ] 5.1 Admin RBAC middleware (role checks all `/api/admin/*`), audit log table (`AuditLog`: who, what, when)
- [ ] 5.2 Astrologer KYC queue: docs viewer, verify/reject/suspend + reason
- [ ] 5.3 Brahmin network CRUD: add, skills, rates, availability, ratings
- [ ] 5.4 Pooja catalog management: CRUD + pricing + images + seasonal toggles
- [ ] 5.5 Bookings operations: full board, filters, manual assignment override, emergency re-assign
- [ ] 5.6 Payments: transactions, refunds (wallet credit), disputes, payout approvals (astrologer + brahmin)
- [ ] 5.7 Analytics dashboard: DAU, consultations by mode, revenue (gross/commission), pooja bookings funnel, top astrologers, ratings distribution — Recharts
- [ ] 5.8 Support inbox: tickets, replies, SLA badges
- [ ] 5.9 User management: search, block, consent logs view, data export/delete (DPDP)
- [ ] 5.10 Content: banners/announcements (home carousel), app config (commission %, min balance)

**DB**: `AuditLog`, `AppConfig`, `Banner`, extend `SupportTicket`

**Acceptance**: poora company ops admin console se ho sake — KYC, allocation, refunds, payouts, analytics.

**Effort**: L

---

### Phase 6 — Production Split & Hardening

**Goal**: 3 alag Vercel deployments + real integrations + security. **Ye tab hoga jab client 3 separate hosting confirm kare.**

**Tasks**:
- [ ] 6.1 Monorepo restructure: `apps/user`, `apps/astrologer`, `apps/admin`, `packages/{shared,db,engine,i18n}` — code move, imports fix
- [ ] 6.2 Vercel: 3 projects, 3 domains, env vars per app (Supabase URLs, secrets)
- [ ] 6.3 **Razorpay** integration: `PaymentProvider` ke peeche real gateway — orders API, checkout, webhook signature verify, refunds, settlement reports; server-side pricing only
- [ ] 6.4 **MSG91/Twilio** SMS OTP + **WhatsApp Business API** (pooja reminders, booking updates) — `CommunicationProvider` ke peeche
- [ ] 6.5 Supabase extras: RLS policies (user data isolation), Storage (pooja media, KYC docs), auth v2 (optional)
- [ ] 6.6 Security hardening: rate limits (per-IP per-route), PII columns encryption at rest, session rotation, audit alerts, CSP headers, dependency audit
- [ ] 6.7 DPDP Act 2023 compliance: consent ledger, purpose limitation, data retention policy, right-to-erasure flow, grievance officer contact
- [ ] 6.8 Observability: error tracking (Sentry), uptime, DB backups schedule, key metrics alerts
- [ ] 6.9 Load test + fix; SEO/ASO basics; app store wrappers (optional Capacitor) discussion

**Acceptance**: teen apps live; sandbox Razorpay payment E2E; real SMS OTP; security checklist pass.

**Effort**: XL (split risky hai — carefully, with feature freeze)

---

## 4. Dev Protocol (Agents Read This)

1. **Read order**: `PLAN.md` (this) → `worklog.md` (last 2 sections) → current phase tasks
2. **One phase at a time**, tasks top-to-bottom; tick `- [x]` here + append worklog section per session
3. **Never** regress passed acceptance criteria — QA via agent-browser before claiming done
4. **Env landmines**:
   - Shell injects stale `DATABASE_URL` (sqlite) on EVERY new command — app safe hai (`TARA_DATABASE_URL` wins in `src/lib/db.ts`), but direct prisma CLI/db scripts hamesha `.env` se chalte hain
   - `backups/` me purani SQLite hai — reference only, kabhi restore mat karna bina bole
   - Dev server restart: `pkill -f "next dev"; sleep 2; (cd /home/z/my-project && bun run dev >> dev.log 2>&1 &)`
   - Kabhi `bun run build` mat chalana; port 3000 only; testing via `http://localhost:81/` (gateway) or localhost:3000
5. **Sebha seed data re-runnable**: `bun db/seed.ts` idempotent hai (upsert by slug)
6. **Style**: shadcn/ui only, no indigo/blue, sticky footer, 44px touch targets, Hindi+English i18n for ALL new UI (770→N keys parity, per-feature files in `src/i18n/{en,hi}/`)
7. **APIs**: z-ai-web-dev-sdk backend-only; websocket via `io("/?XTransformPort=3003")` only

---

## 5. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Engine math errors | Kundli galat = credibility death | Phase 1.10 validation harness vs published charts, golden test files |
| Live astrologer bot replies fake feel | Demo me client confuse | Phase 2.6 manual persona mode; clear DEMO labelling (already `DemoDataBadge`) |
| Payment bugs | Paisa ka risk | Server-side pricing, webhooks, Razorpay test mode pe Phase 6 full E2E |
| Monorepo split breakage | Sab apps down | Phase 6 me feature freeze + gradual move + per-app smoke tests |
| Supabase free-tier limits | App down | Connection pooling already; monitor; upgrade plan on scale |
| PII/privacy leak | Legal (DPDP) | Consent ledger, encryption, access audit — Phase 6.7 |
| Single dev environment | Ek hi route `/` | Role-switch demo mode is DESIGNED for this; real split Phase 6 |

---

## 6. Decision Log

| # | Decision | Date | Kyun |
|---|---|---|---|
| D1 | SQLite → Supabase Postgres | 2026-09-27 | Single live DB, hamesha on, Vercel-ready, prod parity |
| D2 | Role-switch demo in one app | 2026-09-27 | Fast dev/test; split in Phase 6 (standard SAAS pattern) |
| D3 | astronomy-engine over swiss-eph | planned | MIT license (Swiss AGPL risk), npm-native, VSOP87-grade |
| D4 | Prisma String JSON columns retained | 2026-09-27 | Postgres me Json migration code-break karega; Phase 6 optional |
| D5 | Razorpay + MSG91 + WhatsApp API | planned | India-standard gateways, PCI handled, compliance ready |

---

*Plan update protocol: phase complete hone pe acceptance results ke saath section update karo; naya risk/decision aaye to table me add karo. Version bump karo.*
