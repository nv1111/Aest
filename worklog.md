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
