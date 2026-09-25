# Project Worklog — "Tara" Indian Astrology Platform (Customer-Side Web App)

Shared worklog for all agents. Append sections below; never overwrite.

---

Task ID: 1
Agent: main (Z.ai Code)
Task: Project kickoff — inspect workspace, define architecture, AGENTS.md, design system foundation

Work Log:
- Inspected workspace: Next.js 16 + App Router, Tailwind 4, shadcn/ui (full set), Prisma/SQLite (db/custom.db), zustand, @tanstack/react-query, z-ai-web-dev-sdk, framer-motion, socket.io example in /examples.
- Dev server already running on port 3000 (verified 200 OK).
- KEY ADAPTATION: original spec asked React Native/Expo/Supabase. Environment mandates Next.js 16 single-route web app + Prisma/SQLite. Decision: build mobile-first premium WEB app at route `/` with SPA-style client navigation (tab + stack), Prisma+SQLite replaces Supabase Postgres, DB-backed OTP session cookies replace Supabase Auth, socket.io mini-service replaces Supabase Realtime. All provider abstractions (AstrologyProvider, CommunicationProvider, PaymentProvider, MediaProvider, ReportProvider) preserved so real services can replace mocks.
- Product name: **Tara** ("star"). Positioning: personal, calm, trustworthy jyotish guide. Not a mystical cluttered app.
- Design tokens: warm ivory background, deep warm charcoal text, single restrained terracotta accent, serif display (Fraunces) + Geist Sans body.

Stage Summary:
- Foundation phase started. Next: AGENTS.md, theme, Prisma schema, mock astrology engine, app shell.

---
Task ID: 2-foundation
Agent: main (Z.ai Code)
Task: Foundation — schema, design system, provider, app shell, auth, onboarding, home, astrology APIs, seed, avatars

Work Log:
- prisma/schema.prisma: 16 models (User, Session, OtpCode, BirthProfile, AstrologyCache, Astrologer, Review, Favorite, Consultation, Message, AiConversation, AiMessage, WalletAccount, WalletTransaction, Payment, Report, Notification, NotificationPreference, SupportTicket) — pushed, LOCKED for subagents.
- Design system: globals.css warm ivory/terracotta tokens, success/warning, Fraunces display font (layout.tsx), Providers (react-query + sonner toaster).
- AstrologyProvider: src/lib/astrology/types.ts (all normalized interfaces) + mock/ engine (positions, dasha, panchang, compatibility, horoscope, provider) + index factory + server.ts (resolveProfileInput, buildChartContext for AI). Deterministic, demo-labeled. Verified: correct sidereal Sun, sunrise/sunset, Rahu Kaal timings.
- Cache: src/lib/cache.ts DB+memory keyed by profile+updatedAt.
- Auth: /api/auth/{request-otp,verify-otp,logout,me} — OTP demo mode returns code (labeled), sessions httpOnly cookie. Full flow curl-tested OK.
- Profiles: /api/profiles (GET/POST), /api/profiles/[id] (PATCH/DELETE, primary promotion), complete-onboarding. Onboarding: first profile auto-completes onboarding.
- Astrology APIs: chart/dasha/transit/panchang/horoscope/compatibility(POST incl. inline profileB)/home/places — all session-guarded + cached. /api/astrologers list (sections online/soon/top) — fixed filter-after-take bug.
- App shell: AppShell (430px centered frame, desktop side brand), BottomNav (5 tabs), screens.tsx registry (ALL screens registered with placeholders), zustand nav store (tab+stack, push/pop/openInTab), framer transitions, Splash.
- Shared kit: ScreenScaffold, ScreenHeader, SectionHeader, EmptyState, ErrorState, DemoDataBadge, TrustNote, InfoRow, PageSkeleton, AstrologerCard(+AvailabilityBadge).
- i18n: t() + en dictionaries (common, nav, onboarding, home, ask, astrology, astrologers, consultation, wallet, reports, profile).
- Services: auth, profiles, astrology (client) + http wrapper + api.ts server helpers.
- Onboarding flow: Welcome → Promises → Phone → OTP (demo label + code) → Name → Birth (PlaceSearch city resolver, time accuracy exact/approx/unknown) → Ready.
- Home: greeting, Your Day insight (demo badge), Ask CTA + suggested prompts, Today (tithi/nakshatra/rahu/choghadiya), Your Astrology (dasha/transit rows), Astrologers online, Recent (consultation/report — APIs pending from 2-c/2-d), empty no-profile state.
- Seed: db/seed.ts — 12 demo astrologers + reviews (isDemo true), avatars generated to public/avatars/ast-01..12.png.
- lint clean; tsc clean (only pre-existing examples/skills errors); dev server OK; GET / 200.

Stage Summary:
- Foundation COMPLETE. Parallel feature phase starts: 2-a Ask AI, 2-b Astrology screens, 2-c Astrologers+Consultation (socket.io mini-service port 3003), 2-d Wallet/Reports/Profile/Notifications/Support.
- Home expects: GET /api/consultations?limit=1 → {consultations:[{id, astrologer:{displayName}, totalAmount, ...}]} (2-c) and GET /api/reports?limit=1 → {reports:[{id,title,status,...}]} (2-d).
- Registry/screens already cover every planned screen id — subagents replace placeholder files only.

---
Task ID: 2-a
Agent: 2-a (Z.ai Code)
Task: "Ask Your Chart" AI assistant — conversational screen + ask APIs (LLM server-side only)

Work Log:
- src/i18n/en/ask.ts: extended dictionary (~45 keys: prompts, history, feedback, voice, confirm-clear, disclosure strings).
- src/services/ai.ts: aiService (conversations/messages/ask/feedback/clearAll/interpret) + AskMessageDTO (AiMessageDTO + optional failed flag). ask() uses a local postWithSignal() (same envelope/error conventions as lib/http) because lib/http does not expose AbortSignal — needed for the Stop button. Recommend adding signal passthrough to http.post (shared follow-up).
- API routes (all requireUser, zod-validated, ok/fail envelope):
  - POST /api/ask/message {message 1..500, conversationId?} → 409 no_profile if buildChartContext null; creates conversation (title = first 48 chars); persists user msg; LLM via ZAI (system prompt as assistant role + chart-context JSON + last 10 prior turns + question; thinking disabled; retry once); STRICT-JSON defensive parse (strip fences, extract outer object, typed narrowing); fallback factors derived from context (mahadasha/antardasha + Jupiter/Saturn transit); on total LLM failure persists graceful fallback text (t("ask.readingFailed")) + failed:true in response DTO. Returns {conversationId, messages:[userMsg, assistantMsg]}.
  - GET /api/ask/conversations → own conversations, newest first, max 30, with messageCount (_count).
  - GET /api/ask/messages?conversationId= → own conversation messages asc, max 100; failed flag re-derived via factorsJson-null + content match.
  - POST /api/ask/feedback {messageId, feedback ±1} → updates AiMessage.feedback only if message belongs to user's conversation.
  - POST /api/ask/conversations/clear → deleteMany user's conversations (cascade).
  - POST /api/ask/interpret → no-op placeholder ok({ok:true}) for future deep-linking.
  - Shared DTO helpers in src/app/api/ask/_lib/dto.ts (underscore folder = non-routed). NOTE: imports t() from @/i18n server-side (pure module, no client APIs) so persisted fallback text stays dictionary-owned.
- src/features/ask/AskScreen.tsx (replaced placeholder): bare full-height layout; header (conversation title, new-chat + history icon buttons 44px); ChatGPT-style flow — user bubbles right (primary), assistant cards left with "Based on your chart" + Why? toggle → animated factors panel (framer height) with DemoDataBadge, follow-up chips (tap = send), copy/share (navigator.share fallback clipboard), thumbs feedback, retry link on failed readings; thinking state "Reading your chart…" with pulse dots + Stop (AbortController); failed exchange → inline error bubble + retry; composer pinned above the 88px bottom-nav zone (mb-[calc(88px+env(safe-area-inset-bottom))]) with auto-growing textarea (max ~4 rows), primary send circle, mic via webkitSpeechRecognition (en-IN, appends transcript; graceful toast when unavailable); params.q from Home auto-sends once on mount (prefills input if no profile); no-profile → EmptyState CTA push profile.birthEdit {mode:create}; history Sheet (side right) with relative dates (date-fns), message counts, load-on-tap, Clear-all with AlertDialog confirm; "Talk to an astrologer" quiet card above composer after first assistant reply → openInTab astrologers.list; active conversation persisted in sessionStorage (tara_ask_conversation) + 404 soft-reset; auto-scroll (instant on far jump, smooth near bottom); role="log" aria-live="polite", aria-labels everywhere; trackEvent("ai_question_asked") on success.
- QA: curl-tested all endpoints (401/409/404/422 paths + cross-user guards + LLM answers strictly JSON-grounded: "Moon mahadasha until 2035", "Jupiter transiting 10th house"); agent-browser e2e: empty state → suggestion → thinking → answer → Why? factors → follow-up chip → composer Enter → feedback/copy toasts → history load/clear-all confirm → new chat → mic-unavailable toast. lint clean; tsc: no errors in my files (remaining errors are concurrent agents' in-flight files + pre-existing examples/skills).

Issues found / coordination:
- Dev server (port 3000) DIED mid-QA (~08:52, likely OOM under concurrent agents + browsers). No auto-restart after 15 min wait. I restarted it via nohup `bunx next dev -p 3000 >> dev.log` (append, no truncate) — it is serving again (GET / 200). Watch memory pressure; two duplicate `bun run dev` chat-service instances (PIDs under mini-services/chat-service) are also running from 2-c.
- Transient GET / 500 during QA caused by 2-d's SecurityScreen importing non-existent `MessageSquareCheck` from lucide-react — fixed by that agent shortly after; not from my files.
- SHARED CHANGE REQUEST (not made, files are read-only to me): add optional `signal?: AbortSignal` to http.post/get in src/lib/http.ts so services don't need local fetch copies (my postWithSignal in src/services/ai.ts can then be deleted).
- tsc currently shows duplicate-key errors in src/i18n/en/astrology.ts (2-b's file, mid-edit) and lazy default-export errors for wallet screens (2-d's placeholders) — both outside my ownership.
- DemoDataBadge in the factors panel is always shown (engine is mock today); when a live provider lands, gate it on providerInfo.mode — the Ask answer DTO does not carry provider mode.

Stage Summary:
- Ask feature COMPLETE (2-a). Suggested prompts on Home deep-link via params.q and work end-to-end. /api/ask/interpret is live as a no-op for future contextual deep-links from astrology/reports features.

---
Task ID: 3
Agent: main (Z.ai Code)
Task: Integration & end-to-end QA of all feature work (2-a..2-d) — fixes, browser verification, visual review

Work Log:
- All 4 subagents' work landed (their report messages timed out but files were complete). Verified: ask API+UI (5 routes), astrology screens (10), astrologers/consultation (APIs + socket service on 3003), wallet/payments/reports/profile/notifications/support (all APIs).
- FIXED: AppShell render oscillation — logged-out `me` query errored, onboarding mounted a new observer, refetchOnMount flipped status back to pending → isLoading true → Splash swapped in → unmount → infinite 40 req/s loop. Fix: `booted` latch in AppShell (splash only until first settle) — src/components/app/AppShell.tsx.
- FIXED: AppShell gate now requires `user.onboardingDone` (not just session) so birth details can never be skipped after OTP.
- FIXED: NameStep persists the name via POST /api/user (greeting was "Welcome" instead of the name).
- FIXED: Onboarding "ready" celebration step shows before the me-refresh reveals the app.
- FIXED: Vimshottari sub-period math (factor-12 bug — antardashas outlived their mahadasha). Now exact: Rahu maha 18y → Rahu-Venus antar exactly 3y → Venus-Moon pratyantar exactly 3mo. Cleared AstrologyCache (DB + memory) — restart dev server after schema-level cache changes.
- FIXED: orphan screens — added Wallet entry (balance card in Profile), Consultation history (Profile row + History icon in Astrologers header), Reports (Profile row). Everything is now reachable.
- Process lessons: sandbox kills `setsid/nohup` background processes between tool calls — start long-running services as plain `(cmd &)` subshells. Dev server OOM'd twice under parallel agents (next-server 2GB) — killed stale chrome instances, now stable.
- Socket.io realtime works THROUGH THE GATEWAY (localhost:81 / preview URL with ?XTransformPort=3003). Direct localhost:3000 browsing shows "Connecting…" — not a bug; the external preview routes correctly.
- E2E browser-verified (agent-browser on localhost:81): full onboarding (welcome→promises→phone→OTP demo→name→birth Pune→chart created→home) → Home all sections → Ask (LLM answer grounded in real chart + Why? factors + follow-ups + feedback) → Kundli/D1/D9+house sheets/Dasha timeline/Transit/Panchang/Horoscope/Compatibility (18.5/36 result with 8 kootas, manglik, themes) → Astrologers (cards, filters) → Profile with verified badge → Pre-consultation (rate/consent/balance gating) → recharge ₹199 (demo payment processing→success) → live consultation with AI astrologer (socket Connected, billing meter, realtime replies) → End & settle (4m26s→₹80, LLM summary, transaction) → history → details → wallet ledger (₹119, itemised) → reports (Kundli generated from chart) → notifications (6 events) → privacy centre.
- VLM visual review: "production-ready… premium, trustworthy… no critical layout breaks" (after fixing the splash-loop screenshot confusion).
- lint clean, tsc clean (excluding pre-existing examples/skills), dev.log clean, both servers (3000, 3003) running as plain background jobs.

Stage Summary:
- Customer-side app COMPLETE and browser-verified end-to-end. All 20 product capabilities functional with provider abstractions (AstrologyProvider mock, PaymentProvider mock, CommunicationProvider=socket.io+LLM personas, report service) per AGENTS.md.
- Demo data honestly labeled everywhere (DemoDataBadge, demo OTP, demo payment notes, AI-simulated astrologer disclosure).
- Known minor items for next phase: Kundli chart house text density (VLM nitpick), bold key Panchang takeaway, payment failure path is API-level only (hash ~1/8), no email auth (architecture-ready), i18n English only (architecture-ready), push notifications web-context note only.
- To restart services after a sandbox reset: `(bun run dev &)` in /home/z/my-project and `(bun run dev &)` in mini-services/chat-service.

---

Task ID: 4
Agent: main (Z.ai Code)
Task: Round 2 — QA assessment, post-consultation review flow, TTS "Listen" on Ask readings, full styling polish pass

Work Log:
- Assessed project state: all services alive (3000/3003/81), dev.log clean. Walked the full app via agent-browser through the gateway (localhost:81): home, ask (LLM grounded answer), astrology hub, kundli, astrologers list/detail, consultation history/details, wallet, reports, profile — zero console errors.
- VLM visual review of 8 screenshots → concrete findings list (cramped Your Day, weak greeting, no scroll indicators, wall-of-text answers, weak chips, Kundli grid misalignment + monotonous highlight cards, hub dead space, /min weight, outline CTA affordance). Confirmed feature gap: NO way for users to rate their consultations (Review model existed but was write-less).
- FEATURE — Post-consultation review flow:
  - prisma: Review += consultationId String? @unique + @@index([userId]); db:push (dev server restart required — in-memory Prisma client doesn't see new fields until restart; this caused a transient 500 on GET /api/consultations/[id] until restart).
  - POST /api/reviews (new route): zod-validated {consultationId, rating 1-5, text?}; own+ended consultation only; one review per consultation (409 already_reviewed); authorName derived "First L." (privacy-safe fallback "Tara member"); isDemo false (genuine UGC); transactional astrologer aggregate update (incremental fold: (rating*count+new)/(count+1) — seeded platform totals preserved).
  - GET /api/consultations/[id] now returns `review` (own review or null); consultationsService.get typed accordingly + submitReview() added.
  - ConsultationDetailsScreen: ReviewSection — CTA card (star icon, 5 muted stars teaser) → bottom Sheet with radiogroup stars (44px targets), optional 500-char comment, Skip/Submit; after submit shows "You rated this consultation" card (stars + comment + date). Invalidates consultation + astrologer queries; toast thanks; trackEvent reading_rated.
  - e2e verified: rate 5★ + comment on Ananya's consultation → aggregates 156→157 reviews → review visible on astrologer public profile as "Ananya"; error paths 401/404/422 curl-tested; cross-user 404.
- FEATURE — TTS "Listen" on Ask readings:
  - POST /api/ask/speak: own-conversation assistant messages only (not failed fallbacks); prepareForSpeech (strip markdown symbols) + sentence-boundary truncation at 1000 chars; z-ai-web-dev-sdk TTS voice "jam"; **response_format must be "wav" — mp3 is NOT served by the current TTS backend (error 1214)**; server LRU audio cache (24 entries, message content is immutable); returns binary audio/wav.
  - aiService.speak(messageId) → blob URL with client-side cache (24 entries, revokes old URLs).
  - AskScreen: shared Audio element (one voice at a time), speakToken guard for superseded loads, stop-on-unmount; Listen button (Headphones) → loading (Loader2 spin) → playing (stop square + animated soundbar keyframes in globals.css); toast on failure; trackEvent reading_listened.
  - e2e verified: first generation 12s (cache cold), replay instant from client cache (no re-POST); stop works; 401/404/422 paths curl-tested.
- STYLING POLISH (all browser-verified, VLM re-review: 7/8 previously-flagged issues FIXED, #8 improved after follow-up):
  - Ask: answer line-height 1.7; HighlightedText bolds planets/houses/dasha/nakshatra/ascendant/transits via matchAll regex (react-hooks/immutability forbids lastIndex mutation — use matchAll); follow-up chips terracotta-tinted with hover; action bar gap/spacing; disclaimer left-border accent.
  - Home: greeting 13px medium foreground/75; DayCard factor pills px-3 py-1.5 gap-2; Today section bold key takeaway line (success dot = favourable choghadiya / warning dot = Rahu Kaal window, i18n todayHighlightGood/todayHighlightRahu); TodayItem py-3.5 with mt-1 rhythm; suggested prompts wrapped with right-edge gradient fade hint.
  - Kundli: overview grid grid-rows-2 gap-y-6 with consistent mt-1 baselines; first highlight card is the feature (border-primary/25 bg-primary/6), rest quiet; body 13px.
  - NorthChart: corner houses (2,3,5,6,8,9,11,12) pair planets per row earlier (3+ planets → 2/row), font 11.5 in small houses, ROW_HEIGHT 17 — fixes text density in small triangles.
  - Astrology hub: trust strip "Where these numbers come from" below the 6 cards (fills the fold, on-brand honesty); fragment wrapper needed (two siblings in ternary branch).
  - Astrologers: horizontal carousels wrapped with gradient fade; profile /min 15px semibold; outline CTAs bg-secondary/50 fill; shared card /min font-medium.
  - Panchang: simpleSummary promoted to prominent takeaway block (border-primary/25 bg-primary/6, "TODAY IN ONE LINE" label, 13.5px medium).
  - i18n: +review keys (consultation.ts), +listen keys (ask.ts), +todayHighlight* (home.ts), +hubTrust* + panchangTakeaway (astrology.ts); analytics: reading_listened, reading_rated events added.
- Process notes: dev server restart needed after prisma field additions; Edit tool MultiEdit is NOT atomic in practice (a failing mid-batch edit can leave earlier edits applied — verify state after failures); killed and restarted dev server as plain (cmd &) subshell.

Stage Summary:
- Round 2 COMPLETE: 2 new trust/simplicity features (post-consultation reviews, spoken readings) + comprehensive styling polish across 8 screens. lint clean, tsc clean (excluding pre-existing examples/skills), dev.log clean, all services running.
- Known items: TTS first-generation latency (~10-12s cold, instant cached); TTS backend wav-only (documented in route); VLM noted minor items (small info-icon touch targets in Panchang angas cards, subtle active-tab indicator) — acceptable, low priority.
- Suggested next phase: email auth + i18n Hindi (both architecture-ready), payment failure simulation in recharge UI, reports share-as-image, pre-warm TTS cache on first render of a reading.
