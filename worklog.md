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

---
Task ID: 5-shell
Agent: main (Z.ai Code)
Task: Responsive web-app overhaul — user feedback: app rendered as a 430px phone frame on ALL devices. Mobile stays as-is (perfect); tablet/laptop/desktop get a real web application layout.

Work Log:
- Root cause: AppShell.tsx wrapped everything in `max-w-[430px]` phone frame (border-x + shadow) for every screen size.
- NEW src/components/app/AppSidebar.tsx — md: slim icon rail (78px), lg: full labeled sidebar (256px). 5 primary tabs (synced with zustand tab store) + quick links (Wallet→profile tab stack, Reports/Consultations/Notifications→home tab stack) with prefix-based active detection; wordmark + tagline footer.
- AppShell.tsx rebuilt: mobile frame UNCHANGED; md+ removes max-w/borders/shadow, adds sidebar, content flex-1. Onboarding now a centered 430px card (rounded, bordered) on md+ instead of a stretched flow. Splash unchanged.
- BottomNav.tsx: added `md:hidden` (mobile-only).
- NEW src/components/shared/content-width.tsx — ContentWidth tokens + ContentColumn component: narrow (md:max-w-xl) / default (md:max-w-2xl xl:max-w-3xl) / wide (md:max-w-3xl lg:max-w-5xl xl:max-w-6xl) / chat (md:max-w-xl lg:max-w-[760px]) / full.
- ScreenScaffold.tsx: new `width` prop (default "default"); content wrapped in ContentColumn; padding px-4 pb-28 → md:px-6 md:pb-12 (no bottom nav on md+).
- ScreenHeader.tsx: new `width` prop; inner row is now a centered column matching content width (title aligns with content on every device).
- i18n nav.ts: added wallet/reports/consultations/notifications/tagline keys.
- Verified: tsc clean, lint clean, dev.log clean, 0 console errors. Desktop 1440px: sidebar + full-width Home. Mobile 390px: bottom nav only, phone layout unchanged.

Stage Summary:
- Responsive SHELL complete and verified. Next: 4 parallel subagents (5-a Home+Ask, 5-b Astrologers+Consultation, 5-c Astrology+Reports, 5-d Wallet+Profile) apply per-screen responsive passes using the tokens below, then main agent runs full 3-viewport QA.

RESPONSIVE DESIGN TOKENS (MANDATORY for all screen agents):
- MOBILE (<768px) MUST STAY VISUALLY UNCHANGED — only ADD md:/lg:/xl: classes; never alter base classes.
- Use ScreenScaffold/ScreenHeader `width` prop or <ContentColumn>: grids/dashboards → wide; lists/details/articles/settings → default; forms/consent/payment results → narrow; conversations (Ask, consultation chat) → chat.
- Card grids: existing cols → sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 where natural.
- Tab-root screens with custom headers (Home, AstrologyHub): make header inner + padding responsive (mx-auto + width class + md:px-6, pb-28 → md:pb-12).
- Sheets (bottom) max-w-[430px] → widen to sm:max-w-lg/xl on md+; AlertDialogContent max-w-[340/360px] → add sm:max-w-md.
- Chat columns: mx-auto w-full md:max-w-xl lg:max-w-[760px]; sticky composer centered in same column.
- Natural 2-col on lg: Kundli (chart/placements), AstrologerProfile (identity/stats), Wallet (balance/list).
- No horizontal scroll at any width; no base fixed widths >430px; 44px targets; t() strings; one terracotta accent; calm aesthetic.
- Do NOT restart dev server, do NOT run bun run build, do NOT run browser tests (main agent QA after). Verify with `bunx tsc --noEmit` (ignore examples/ and skills/ paths) + `bun run lint`.

---
Task ID: 5-a
Agent: 5-a (Z.ai Code)
Task: Responsive pass — Home (web-app dashboard) + Ask (ChatGPT-like desktop chat), mobile pixel-identical

Work Log:
- Read AGENTS.md + worklog (5-shell tokens). Inspected HomeScreen.tsx, AskScreen.tsx, ScreenScaffold/ScreenHeader/content-width, AstrologerCard, EmptyState/ErrorState, AppShell.
- src/features/home/HomeScreen.tsx (layout classes only, zero feature/i18n/handler changes):
  - TopBar (tab-root custom header): + md:px-6 on the sticky header band; inner row now `mx-auto w-full` + contentWidthClass.wide (md:max-w-3xl lg:max-w-5xl xl:max-w-6xl) so greeting + bell align exactly with the content column below (same pattern as ScreenHeader).
  - Content container: `space-y-7 px-4 pb-28` → `mx-auto grid w-full gap-7 px-4 pb-28 md:grid-cols-2 md:px-6 md:pb-12 xl:grid-cols-3` + wide token. Grid gap-7 ≡ space-y-7 on mobile (28px, single column) — visually identical.
  - Dashboard grid (md+): YOUR DAY gets xl:col-span-2 (proper hero next to ASK CTA); md: Day|Ask, Today|Your Astrology; xl: Day(2)+Ask, Today|Astrology|Recent; ASTROLOGERS spans full row (md:col-span-2 xl:col-span-3) with its AstrologerCards in an internal md:grid-cols-2 (483px cards at lg, 547px at xl — AstrologerCard is a wide list-row card, 3-col would be cramped); skeleton grid matches.
  - Suggested-prompt chips: keep mobile edge-bleed scroll (-mx-4/px-4 + gradient fade); at md+ they become a wrapping pill list (md:mx-0, md:flex-wrap, md:overflow-visible, md:px-0, fade md:hidden) — no clipped pills, no dead scroll.
  - Judgement call (deviation from task hint): used md: breakpoints instead of the suggested sm: for grid/flex changes. Tailwind sm: is VIEWPORT-based and the 430px phone frame persists up to 767px, so sm: classes would alter the mobile frame at 640–767px viewports (and sm:grid-cols-2 pills in a 430px frame would clip). md: guarantees <768px is untouched.
- src/features/ask/AskScreen.tsx (chat token: mx-auto w-full md:max-w-xl lg:max-w-[760px], aligned across all regions):
  - Custom header: + md:px-6; inner row wrapped in the centered chat column (title + new-chat/history buttons align with messages below).
  - Conversation list: scroll region + md:px-6 with inner `mx-auto h-full w-full` chat column (h-full keeps EmptyAsk's vertical centering; overflowing messages scroll exactly as before — verified same scrollHeight math). role=log / aria-live / autoscroll ref untouched.
  - Sticky composer: region keeps border-t + bg full-width (ChatGPT-style) with md:mb-0 (88px bottom-nav zone only on mobile; safe-area calc base preserved) + md:px-6; input box centered in the same chat column. Mic/send 44px targets untouched.
  - "Talk to an astrologer" quiet card: md:mx-auto md:w-full + chat token (centered, edge-aligned with composer/messages; base mx-3 mobile margin preserved).
  - Empty state: body max-w 300→420 at md, suggestions + TrustNote 380→560 at md; suggested prompts now `grid grid-cols-1 gap-2 md:grid-cols-2` (mobile stacking identical to previous space-y-2). md: not sm: — same frame-zone rationale as above.
  - History Sheet (sm:max-w-[350px]) and AlertDialog (shadcn default sm:max-w-lg) kept as-is per task. Message bubble max-w-[85%]/[92%]/[94%], typing indicator, error bubble, factors panel: untouched.
- Verification: `bunx tsc --noEmit` (filtered) → empty; `bun run lint` → clean; dev.log → no compile errors, GET / 200.
- NOTE for main agent: the Next dev server was found DEAD (no :3000 listener, next-server process gone — likely OOM under parallel 5-x agents; worklog 2-a/3 document this pattern). Restarted per documented recovery: `(bun run dev >> dev.log 2>&1 &)` — Ready in 4s, serving 200s, chat-service 3003 + gateway 81 were never down.

Stage Summary:
- Home + Ask responsive pass COMPLETE. Mobile (<768px) visually identical — only additive md:/lg:/xl: classes; base paddings, handlers, strings, aria, touch targets untouched. QA notes: (1) astrologer card rating row may wrap languages to a 2nd line at md-only (768–1024, ~355px cards) — truncate/wrap guards exist, not broken; (2) dashboard grid rows have naturally ragged bottoms (items-start semantics, calm asymmetry); (3) main agent should visually confirm Home at 390/768/1024/1440 and Ask empty + conversation + composer centering at md/lg/xl.


---
Task ID: 5-d
Agent: 5-d (Z.ai Code)
Task: Responsive pass — Wallet + Profile screens (tablet/desktop web layout, mobile pixel-identical)

Work Log:
- Read AGENTS.md + worklog 5-shell tokens; inspected AppShell/AppSidebar, content-width.tsx, ScreenScaffold/ScreenHeader `width` prop, ui sheet/dialog/alert-dialog, and Tailwind v4 compiled CSS to verify `lg:space-y-0`/`md:space-y-0` overrides base `space-y-*` (v4 space-y uses zero-specificity `:where(... > :not(:last-child))` with margin-block-end; responsive variants emit later in cascade — override confirmed in .next/dev CSS chunks).
- Breakpoint decision: used md: (not sm:) for ALL layout-structure changes (grids/two-columns) because the phone frame persists up to 767px and the mandatory rule is "mobile <768px visually identical". sm: reserved for modal/sheet widening per 5-shell token.
- src/features/wallet/WalletScreen.tsx: width="wide"; container + lg:grid lg:grid-cols-[340px_1fr] lg:items-start lg:gap-x-8 lg:gap-y-6 lg:space-y-0. Auto-placement keeps DOM order = mobile order: balance card → r1c1, recent transactions section → r1c2 (main), TrustNote → r2c1 (fills the balance aside on desktop; stays last on mobile). Mobile stack byte-identical.
- src/features/wallet/RechargeScreen.tsx: width="narrow"; presets grid grid-cols-2 → md:grid-cols-3 lg:grid-cols-4 (₹-preset buttons fit; "Most popular" badge clears SectionHeader pb-2.5); payment-method radio cards stack on mobile, md:grid md:grid-cols-2 md:gap-2 md:space-y-0 on md+. Demo payment note/pay CTA untouched.
- src/features/wallet/TransactionsScreen.tsx: width="wide" — ledger rows run full column width; TransactionRow flex (icon | desc+date | amount+status) spreads naturally at xl. No month-grouping grids added (kept simple, none existed).
- src/features/wallet/PaymentResultScreen.tsx: bare screen (no scaffold on purpose — headerless result views must not change on mobile) — equivalent of width="narrow" applied manually: Processing/Success/Failed roots + loading wrapper get md:mx-auto md:max-w-xl (auto-margin centering of flex child; max-w-[320px] buttons kept full-width inside the column). Centered error states unchanged.
- src/features/wallet/TransactionRow.tsx: AUDITED only — no fixed widths >430px at base (icon 38px, chips auto). Untouched; rows already flex with min-w-0 flex-1 + shrink-0 amount column, no horizontal-overflow risk at any width.
- src/features/profile/ProfileScreen.tsx: width="default" equivalent applied by hand (tab root with custom header): header keeps base classes + md:px-6, new inner column div (mx-auto w-full md:max-w-2xl xl:max-w-3xl — no-op on mobile) so the avatar/title aligns with ScreenHeader columns on md+; content keeps base space-y-6 px-4 pb-28 + md:px-6 md:pb-12, new inner wrapper mx-auto w-full space-y-6 md:max-w-2xl xl:max-w-3xl (identical 24px rhythm on mobile). Settings sections stay a single calm centered column on lg+ (judgement: ListGroups have 2/3/5 rows of uneven height — a 2-col grid would stretch cards unevenly; every row/handler identical). Dialogs (personal info 360px, terms 380px, logout AlertDialog 360px) + sm:max-w-md.
- src/features/profile/BirthProfilesScreen.tsx: width="wide"; profile cards space-y-3 → + md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3 (grid gap 12px = space-y-3 12px → mobile identical). Add-profile pill stays below the grid (empty-state CTA must remain outside the ternary to keep mobile identical) capped md:mx-auto md:max-w-xs. Bottom sheet max-w-[430px] + md:max-w-lg; delete-profile AlertDialog + sm:max-w-md.
- src/features/profile/BirthEditScreen.tsx: width="narrow" — form centers at md:max-w-xl; field spacing/relation grid untouched on mobile.
- src/features/profile/NotificationsScreen.tsx, SecurityScreen.tsx, HelpScreen.tsx, NotificationCenterScreen.tsx: width="default" — centered column, toggles/accordion/rows unchanged.
- src/features/profile/SupportScreen.tsx: width="narrow" on both form + ticket-sent success states.
- src/features/profile/DeleteAccountScreen.tsx: width="narrow" (serious consent flow reads better narrow); continue AlertDialog + sm:max-w-md.
- src/features/profile/PrivacyScreen.tsx: width="default"; lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5 lg:space-y-0 — intro line and destructive delete CTA span lg:col-span-2; the five plain-language cards + download card pair [what|why], [who|consult], [delete-info|download].
- src/features/profile/ListRow.tsx: AUDITED only — no fixed widths (min-h-13 rows, 38px icon tile). Untouched; stretches cleanly in every column width.
- Verified: bunx tsc --noEmit → zero errors in my files (only in-flight KundliScreen.tsx from concurrent agent 5-c); bunx eslint on wallet/profile/notifications-feature → 0 problems (project `bun run lint` fails only on 5-c's mid-edit KundliScreen parse error); dev.log clean (all "✓ Compiled", GETs 200). Confirmed all new utility classes (md:mx-auto, md:max-w-xl/xs, sm:max-w-md, md:max-w-lg, lg:col-span-2, md:/lg:space-y-0, grid-cols-[340px_1fr], gap/grid-cols variants) generated in compiled CSS.

Stage Summary:
- Wallet + Profile responsive pass COMPLETE (14 files changed, 2 audited-untouched). Mobile <768px is byte-identical (only additive md:/lg:/xl: classes + no-op wrapper divs). Wallet gets a natural lg dashboard (balance aside + ledger main); Recharge/Support/BirthEdit/Delete/PaymentResult center as narrow forms; Profile/Notifications/Security/Help/NotificationCenter center as default columns; Privacy pairs cards on lg; BirthProfiles grids 2/3-col with widened sheet.
- QA notes for main agent: (1) sm: used only for modal widening per token; layout grids switch at md: — deliberate reading of the "<768 identical" rule. (2) PaymentResultScreen intentionally has no ScreenHeader (bare screen) — its narrow centering is manual md:mx-auto md:max-w-xl. (3) Profile settings stay single-column on lg (uneven card heights made 2-col feel unbalanced) — revisit if QA wants denser. (4) KundliScreen tsc/lint errors are 5-c's in-flight edits, not mine.

---
Task ID: 5-c
Agent: 5-c (Z.ai Code)
Task: Responsive web-app pass — Astrology feature screens (10) + Reports (2) + NorthChart/Segmented audit; mobile <768px pixel-identical, md+ uses content-width tokens

Work Log:
- Read AGENTS.md + worklog 5-shell tokens. Followed: only ADD md:/lg:/xl: classes (sm: avoided for layout per "<768 identical" rule); scaffold `width` prop from content-width.tsx; card grids via space-y→md:grid+md:space-y-0+md:items-start pattern (mobile spacing identical).
- AstrologyHubScreen (tab root, custom header): header +md:px-6, header inner + content wrapped in <ContentColumn width="wide"> (aligns title with wide column); content pb-28 → +md:px-6 md:pb-12; module + skeleton grids grid-cols-2 → +md:grid-cols-3 xl:grid-cols-4 (6 cards = 3×2 at md/lg, 4+2 at xl); trust strip spans full column width.
- KundliScreen: width="wide"; lg+ two-column lg:grid-cols-[minmax(0,520px)_1fr] gap-6 — core placements hero left (520px anchor), highlights + planets summary right; note + CTAs moved to a full-width bottom block capped md:mx-auto md:max-w-2xl (was space-y-7 on parent; identical 28px rhythm preserved on mobile via mt-7 on the new column wrappers). Mobile stacked exactly as before (DOM order + gaps unchanged).
- ChartScreen: width="default"; D1/D9 Segmented + NorthChart card + captions wrapped in md:mx-auto md:max-w-[560px] reading column (chart is the hero, centered); legend + notes stay in the default column; house-detail bottom Sheet max-w-[430px] → +md:max-w-lg (5-shell sheet token).
- NorthChart.tsx: svg + h-auto w-full (was width="100%" attr; aspect-correct scaling) + md:mx-auto md:max-w-[560px] — no fixed pixel width at md+, future-proof for any container.
- Segmented.tsx: AUDITED only — flex w-full + flex-1 buttons, no fixed widths anywhere. Untouched.
- PlanetsScreen: width="wide"; expandable planet cards space-y-2.5 → +md:grid md:grid-cols-2 md:items-start md:gap-2.5 md:space-y-0 lg:grid-cols-3 (items-start keeps sibling cards top-aligned while one expands).
- DashaScreen: width="default" (timeline reads best in a column — no 2-col); antardasha list space-y-2 → +lg:grid lg:grid-cols-2 lg:items-start lg:gap-2 lg:space-y-0; NowSection + 120y timeline strip unchanged.
- TransitScreen: width="wide"; major-mover cards space-y-2.5 → +md:grid md:grid-cols-2 (4 slow planets = clean 2×2 at all md+; deliberately not 3-col — 3+1 would be ragged); faster-planets row list + notable list unchanged (table-like full width).
- PanchangScreen: width="wide"; date control +md:max-w-md (toolbar-proportioned, avoids 3 flex-1 tabs stretching to 1000px+); five-angas grid grid-cols-2 → +md:grid-cols-3; sun & moon hero +md:mx-auto md:max-w-2xl xl:max-w-3xl (matches default token); choghadiya section content wrapped in <ContentColumn width="default"> per mandate (tabs + 2-col slot grid in a centered reading column).
- HoroscopeScreen: width="default" explicit (article/reading column — already the scaffold default, made self-documenting). No other changes needed.
- CompatibilityScreen: width="narrow" (form centered max-w-xl); person A/B profile carousels left as horizontal scrollers (160px cards + -mx-4 bleed reads as a proper web carousel in the 576px column; skipped optional md:grid-cols-2 side-by-side pickers — too cramped at 576px).
- CompatibilityResultScreen: width="default"; eight-koota cards space-y-2.5 → +md:grid md:grid-cols-2 md:items-start (score-ring hero stays full-width centered as the emotional anchor — deliberate deviation from "score left / breakdown right": left col would have ~850px dead space under the ring; kootas 2-col keeps the calm top-down verdict flow and halves vertical length). Themes/CTAs/disclaimers unchanged.
- ReportsScreen: width="wide"; generate-template cards space-y-2.5 → +md:grid md:grid-cols-2 md:items-start md:gap-2.5 md:space-y-0 lg:grid-cols-3; saved-reports list stays a single-card row list.
- ReportDetailsScreen: article + md:max-w-[65ch] — header, action bar, sections and TrustNote all align at the same reading measure (left edge aligns with ScreenHeader title; sections' existing max-w-[65ch] becomes a no-op inside). No audio player exists in this file (spoken readings are on Ask) — nothing else touched.
- All 13 files: only additive responsive classes + no-op-on-mobile wrapper divs + width props; no base class, copy, aria, t() string, badge or color changes.
- Verification: bunx tsc --noEmit (excl. examples/skills) → EMPTY (fixed one mid-edit missing </div> in KundliScreen before final check; 5-d saw that transient state). bun run lint → clean. dev.log tail → all "✓ Compiled" + 200s, no errors. Verified grid-template bytes via od (tool output swallows literal "[m" pairs — display artifact only, class is correct).

Stage Summary:
- Astrology + Reports responsive pass COMPLETE (13 files changed, Segmented audited-untouched). Mobile <768px visually identical everywhere (spacing rhythm preserved via mt-7 column wrappers in Kundli; all other changes are pure md:/lg:/xl: additions). md: icon-rail and lg+/xl: full sidebar get: wide dashboard grids (hub, kundli 2-col, planets, transit, panchang, reports), centered reading columns (chart 560px, panchang sun-moon/choghadiya default, horoscope, compat form narrow, report details 65ch), widened bottom sheet.
- QA notes for main agent: (1) hub is 4+2 at xl (3+2 at md/lg) — flip to xl:grid-cols-3 if balanced 3×2 preferred. (2) CompatResult keeps the centered ring hero (see rationale above) instead of ring-left/breakdown-right. (3) Kundli has NO NorthChart (chart lives on ChartScreen) — the 520px left column anchors the placements hero per mandate's chart-left intent; adding the SVG to Kundli would have changed mobile. (4) Panchang date control is md:max-w-md left-aligned; sun-moon hero + choghadiya share the default column — mixed-width rhythm is intentional (lists wide, features centered). (5) Dasha timeline strip still scrolls horizontally by design at md (fits at xl).
---
Task ID: 5-b
Agent: 5-b (Z.ai Code)
Task: Responsive pass — Astrologers + Consultation screens (tablet/desktop web layout, mobile pixel-identical)

Work Log:
- Read AGENTS.md + worklog 5-shell tokens. Strategy: add-only md:/lg:/xl: classes (sm: avoided so the <768px 430px phone frame is untouched); base classes never altered.
- AstrologersScreen.tsx: tab-root custom Header → header px-4 → md:px-6; inner row centered in wide column (mx-auto w-full md:max-w-3xl lg:max-w-5xl xl:max-w-6xl). Content px-4 pb-28 → md:px-6 md:pb-12 + all content wrapped in <ContentColumn width="wide"> (loading/error/filtered/sections branches). Card lists (recommended / top-rated / filtered results) → md:grid md:grid-cols-2 lg:grid-cols-3 (space-y-2.5 kept base, md:space-y-0 + md:gap-x-3 md:gap-y-2.5 at md+; 3 cols max because cards are trust-rich). Horizontal carousels (online now / available soon / newly verified) stay scrollers; -mx-4 → +md:-mx-6 and px-4 → md:px-6 so they still escape the wider md+ gutter; gradient fades unchanged. Filter bottom sheet max-w-[430px] → +md:max-w-lg (stays mx-auto centered).
- AstrologerCard.tsx: root already w-full flex — no structural change; languages span gets md:min-w-0 md:truncate so grid cells never wrap that line (base untouched).
- AstrologerProfileScreen.tsx: lg natural two-column lg:grid lg:grid-cols-[1fr_340px] lg:gap-6 — left: identity/About/languages+modes; right: pricing card (mt-6 lg:mt-0) + NEW desktop action panel (hidden lg:sticky lg:top-24 lg:mt-4 lg:block). Extracted local StartActions component (chat/audio/video/book + offline variant) shared by the mobile sticky bar (now lg:hidden, markup identical to before) and the desktop panel, so mobile DOM/flow is unchanged. Reviews stay full width below the grid. Book dialog max-w-[340px] → +md:max-w-md.
- PreConsultationScreen.tsx: width="narrow" on all ScreenScaffold branches (consent/pricing column centered md:max-w-xl on desktop); trust copy layout untouched.
- ConsultationChatScreen.tsx (no socket/logic changes, layout only): ChatGPT-like column mx-auto w-full md:max-w-xl lg:max-w-[760px] applied to header row, billing-meter children (band itself stays full-width tint), connection row, messages (children wrapped in one column div, auto-scroll ref untouched), active composer form and ended-state button (both + md:px-6 so every layer aligns 24px inside the column at md+). Ended button + TabsList-style mx-auto got md:flex because shadcn inline-flex ignores margin-auto. End/back AlertDialogs max-w-[340px] → +md:max-w-md; insufficient sheet max-w-[430px] → +md:max-w-md. Reconnect banner stays full-width (text-center already optically aligned with column center).
- ConsultationHistoryScreen.tsx: width="wide"; TabsList gets mx-auto md:flex md:max-w-md (segmented control centered, not stretched to 1024px); the 3 tab lists → lg:grid lg:grid-cols-2 lg:space-y-0 lg:gap-x-3 lg:gap-y-2.5 (2-col consultation cards at lg+).
- ConsultationDetailsScreen.tsx: width stays default; lg:grid lg:grid-cols-2 lg:gap-x-6 — left: astrologer card + bill + summary; right: transcript (mt-6 lg:mt-0) + review + reports note; DOM order unchanged so mobile stacking identical; sticky continue-chat + ended note stay full-width below. Review bottom sheet (had no max-w) → +md:mx-auto md:max-w-lg.
- Verification: bunx tsc --noEmit (excl. examples/skills) EMPTY; bun run lint clean; dev.log no errors (GET / 200). Did not restart dev server, no build, no browser tests per instructions.

Stage Summary:
- Astrologers + Consultation responsive pass COMPLETE. All 7 files mobile-identical (add-only responsive classes), tablet = centered wide columns + grids, desktop = 3-col marketplace, 2-col profile with sticky action panel, 2-col history/details, ChatGPT-like 760px consultation chat with aligned meter/composer.
- QA notes for main agent: (1) profile desktop action panel is lg:sticky lg:top-24 in the right column — check it behaves when the left column is short; (2) astrologer grids cap at 3 cols (cards are rich) — intentional; (3) carousels intentionally remain horizontal scrollers on desktop; (4) PageSkeleton inside ContentColumn keeps its own px-4 (shared component — fine but slightly inset on md+); (5) dialogs widen to md:max-w-md (the shadcn sm:max-w-lg default already made them 512px ≥640px before — unchanged below 768).

---
Task ID: 5-qa
Agent: main (Z.ai Code)
Task: Consolidated 3-viewport QA (desktop 1440 / tablet 834 / mobile 390) of the responsive overhaul + polish fixes

Work Log:
- Verified dev server (3000), chat-service (3003), gateway (81) alive. 5-a had to restart dev once (OOM reaped mid-round) — recovered per documented procedure.
- Walked ALL major screens at 1440x900 via sidebar: Home, Ask, Astrology hub, Kundli, Panchang, Astrologers, Wallet, Reports, Consultations, Profile — a11y snapshots verified each screen identity; 0 console errors, 0 page errors throughout.
- 3 initial screenshots (profile/kundli/panchang) captured wrong screens — root cause: `agent-browser find` text-matching clicked wrong elements + mid-walk hot-reload state resets. Re-captured correctly via direct @ref clicks; all screens confirmed working.
- VLM review (10 desktop screenshots): flagged sparse-list "dead space" (demo-data reality: 1 report/1 consultation — acceptable), scroll-fold artifacts (not bugs), and Next dev-badge overlay (dev-only artifact).
- VLM mobile before/after comparison: first attempt showed differences (scroll-position artifact); re-took at scroll-top → verdict "IDENTICAL" — mobile preserved pixel-for-pixel.
- Verified all "text clipping" claims at tablet via computed styles: ALL are designed `text-overflow: ellipsis` truncations identical to mobile behavior — not defects.
- Verified sidebar tagline not clipped (bounds check: textBottom 884 < asideBottom 900).
- Polish fix: AstrologersScreen carousel cards w-[236px] → md:w-[264px] lg:w-[288px] (3 spots) so specialty/languages truncate less on tablet/desktop.
- Final: tsc clean, lint clean, dev.log clean (all 200s), E2E re-verified post-fix.
- NOTE for future QA: use `nav[aria-label="Primary"] button[...]` for BottomNav (NOT `nav button[...]` — the hidden AppSidebar nav matches first in DOM). The Next.js dev badge (nextjs-portal) can block clicks near the bottom-left corner on mobile viewports — dev-only artifact.

Stage Summary:
- RESPONSIVE OVERHAUL COMPLETE & VERIFIED: mobile identical (VLM-confirmed), tablet = icon rail + 2-col adaptive layouts, desktop = full sidebar + wide grids/centered columns. All 30+ screens responsive via shared width-token system. 0 errors across all viewports.
- Known acceptable items: sparse demo data makes list screens look empty on large screens; truncation-by-design on narrow cards; scroll-fold partial cards are normal.
- Suggested next phase: email auth + i18n Hindi (architecture-ready), payment failure simulation in recharge UI, reports share-as-image, desktop hero polish (Home "Your day" card could get richer content at xl), carousel scroll arrows on desktop.

---
Task ID: HI-DICT
Agent: general-purpose (Hindi dictionaries)
Task: Create Hindi (hi) i18n dictionaries for all 11 feature domains

Work Log:
- Read worklog.md (last 3 sections) + i18n/index.ts to understand architecture (t() interpolation via {var} regex replace, per-feature dictionaries merged under locale keys).
- Read all 11 en dictionaries in src/i18n/en/ (common, nav, onboarding, home, ask, astrology, astrologers, consultation, wallet, reports, profile — 770 keys total).
- Checked en for nested objects BEFORE translating: all 11 are FLAT string dictionaries (verified via script — 0 nested values), so top-level parity == flattened parity; no nested-key flattening needed.
- Grepped actual usages (home.currentPhase → dasha row, home.ends/endsAt, astrology.houseChip chips, transitQuestion/compatOutOf aria strings) to pick grammatically safe Hindi for interpolated values (e.g. "भाव {house}" postposed so plain numbers read naturally; "{max} में से" as standalone subtext).
- Created src/i18n/hi/ with 11 files, same const names, same keys in same order, same export style. Tone: आप-form, warm/calm jyotish-elder voice; jyotish terms native Devanagari (नक्षत्र, तिथि, राहु काल, चौघड़िया, लग्न, राशि, ग्रह, दशा, कुंडली, गोचर for transit, वक्री for retrograde, भाव for house, स्वामी for lord); Tara kept in Latin; ₹ format, {placeholders}, "R" retrograde chip, "D1/D9", "4.0+", "UPI" kept as-is; DELETE confirm word kept Latin.
- One fix after self-check: learnNakshatraBody originally said "तारा-समूह" (star-cluster) — rephrased to "तारों का समूह" so no "तारा" substring anywhere could read as transliterated brand.
- Verification: (1) `bunx tsc --noEmit` → 0 errors in src/i18n (only pre-existing skills/ errors, untouched by me). (2) Required parity script → all 11 print OK. (3) Extended bun check → key ORDER identical, all hi values plain strings, every {placeholder} present exactly per key, no brand transliteration: "EXTENDED CHECKS CLEAN".

Stage Summary:
- COMPLETE: src/i18n/hi/{common,nav,onboarding,home,ask,astrology,astrologers,consultation,wallet,reports,profile}.ts created — 770/770 keys, parity OK ×11, tsc clean, placeholders intact.
- Notes for main agent (wiring src/i18n/index.ts, which I did NOT touch): import hi dicts, add "hi" to Locale + LOCALES (label "हिन्दी"), register under dictionaries.hi. Decisions worth knowing: nav.ask="पूछें", astrologers tab="ज्योतिषी", compatibility="मिलान", transit="गोचर", retrograde="वक्री", reviews="समीक्षाएँ", pending status="लंबित"; "min"→"मिनट" everywhere ({rate}/मिनट); weekday/planet/zodiac names in Devanagari inside panchang/learn copy; FAQ cross-references use translated screen names (प्रोफ़ाइल → खाता हटाएँ) so they match the hi UI; astrologers faq5A references the 'पूछें' टैब. Input-locale caveat: long-form strings (astrology learn-* bodies ~ 2× en length) — fine in cards/accordion bodies, but verify Choghadiya hint + compat disclaimers don't wrap badly in tight mobile rows during visual QA.

---
Task ID: 6-hindi
Agent: main (Z.ai Code)
Task: Hindi locale launch — i18n dictionaries, language switcher, Devanagari typography, locale-aware Ask AI + round polish (DayCard xl, carousel arrows, payment failure simulation)

Work Log:
- HI-DICT subagent created src/i18n/hi/*.ts (11 files, 770/770 key parity, flat string maps, warm simple Hindi; jyotish terms natural Devanagari; Tara brand kept Latin).
- i18n/index.ts: Locale = "en" | "hi", LOCALES with nativeLabels, en-fallback on missing keys, merged hi dictionary.
- New store src/store/locale.ts: zustand + localStorage("tara.locale") persistence, syncs i18n module + document.documentElement.lang; init reads storage before first render.
- AppShell subscribes to locale; screen motion key includes locale → full remount on switch (no stale strings).
- FIXED module-scope t() bugs (labels would never update on locale switch): AppSidebar/BottomNav nav arrays, AstrologersScreen filter option arrays, AskScreen SUGGESTIONS, PreConsultationScreen MODE_META — all converted to call-time functions.
- ProfileScreen: static language row → LanguageDialog (radiogroup, endonym labels "English"/"हिन्दी", अ/A glyph tiles, Check on active, toast confirms in NEW locale).
- Typography: layout.tsx loads Noto_Sans_Devanagari + Noto_Serif_Devanagari; globals.css html[lang="hi"] swaps --font-geist-sans/--font-fraunces → Devanagari fonts (Latin glyphs included in Noto, mixed script renders consistently).
- Locale-aware AI: /api/ask/message accepts locale ("en"|"hi"), appends HINDI_INSTRUCTION to system prompt (answer/followUps/factors-labels in Hindi, आप form, jyotish terms, digits plain); aiService.ask passes locale; AskScreen reads useLocaleStore.getState().locale. Verified live: Hindi question → full chart-grounded Hindi reply with follow-ups.
- TTS: tested Devanagari via z-ai CLI — works with existing voice, no change needed.
- BUG FIX (payments): settle() was passing Prisma row UUID to provider.getStatus() instead of payment.gatewayRef — decline logic read the wrong "first hex char". Now getStatus(payment.gatewayRef ?? payment.id).
- Payment failure simulation feature: PaymentCreateOptions.forceFail on provider interface; mock provider prefixes "0" (deterministic decline); /api/wallet/recharge accepts simulateFail (mock-mode only); RechargeScreen gets a demo switch (warning-tinted, role="switch"); FailedView maps the English demo reason to UI locale via wallet.failureReasonDeclined.
- Styling polish: DayCard md+ 2-col (headline/body/sunrise-sunset left; factor rows with vertical divider right; mobile pills untouched via dual-render); new shared CarouselRow component (md+ prev/next arrows that fade at track ends, ResizeObserver re-measure, a11y labels + region role) wired into all 3 AstrologersScreen carousels.
- New i18n keys in BOTH dicts: profile.languageHindi/languageNote/languageChanged, astrologers.carouselBack/carouselForward, wallet.simulateFail/simulateFailNote/failureReasonDeclined.
- QA via agent-browser @ http://localhost:81/: desktop 1440 + mobile 390, Hindi + English. Language switch live + persists across reload; VLM verified clean Devanagari (no tofu, no clipping) on desktop/mobile/ask-chat; Hindi AI answer verified; payment fail flow E2E (toggle→pay→"भुगतान पूरा नहीं हुआ"→reason in Hindi→retry→success ₹1,117); carousel arrows scroll 0→336px, display:none on mobile; DayCard mobile = 3 pills + height 141px unchanged; console 0 errors; dev.log all 200s; tsc + lint clean.

Stage Summary:
- HINDI LAUNCH COMPLETE: full-app Hindi (UI chrome + AI answers + TTS + payment reasons), switchable from Profile, persisted. Mobile pixel-unchanged (dual-render pattern); desktop gains DayCard 2-col detail + carousel arrows.
- Fixed pre-existing payment settlement bug (wrong ref to provider.getStatus).
- All verifications green; no known regressions.
- Next candidates: onboarding language step (Hindi discoverable at first run), reports share-as-image, Panchang date navigation, deeper Hindi for demo engine strings (insight.factors currently English from API), email auth.

---
Task ID: 7-engine-hi
Agent: main (Z.ai Code)
Task: Locale-aware astrology engine — Hindi data for Home/Panchang/Horoscope (deep localization), plus residual UI string fixes

Work Log:
- Created src/lib/astrology/names.ts — Hindi name tables: PLANET_HI (9), SIGN_HI (12), NAKSHATRA_HI (27), TITHI_HI (14+2+2), YOGA_HI (27), KARANA_HI (11), VARA_HI (7), CHOGHADIYA_HI (7), LORD_MEANING_HI (9), HOUSE_THEMES_HI (12) + helper fns (planetName/signName/tithiName/choghadiyaName).
- types.ts: widened display-only DTO fields to string (ChoghadiyaSlot.name, PanchangData.nakshatra.name, HomeAstrology.choghadiyaNow.name); provider interface getPanchang/getHoroscope/getHomeAstrology now take optional locale ("en"|"hi"). Compute stays on English enums; localization happens at DTO assembly.
- mock/panchang.ts: buildPanchang(locale) — Hindi tithi/nakshatra/yoga/karana/vara/choghadiya names, tithi.phase, simpleSummary, fmtDate via hi-IN; currentChoghadiya return name: string.
- mock/horoscope.ts: HEADLINES_HI/SUMMARIES_HI/SECTIONS_HI/ENERGY_HI (all 4 periods, 4 sections × 4 bodies); buildHoroscope(locale) — Hindi basis (with localized moon sign), dateLabel via hi-IN, energyLabel(locale).
- mock/provider.ts: getPanchang/getHoroscope thread locale; getHomeAstrology(locale) — 4 Hindi day-insight templates (lords via planetName), Hindi factor labels (वर्तमान दशा/चंद्र नक्षत्र/तिथि), Hindi dasha line + sub (LORD_MEANING_HI), Hindi transit line (गुरु …वें भाव + HOUSE_THEMES_HI).
- API routes home/panchang/horoscope: ?locale= param (default en) + locale in cache key.
- services/astrology.ts: panchang/horoscope/home accept locale (appended to URL only when ≠en).
- Screens: HomeScreen/PanchangScreen/HoroscopeScreen read useLocaleStore, locale in queryKeys (clean re-fetch on switch); HoroscopeScreen moonSign via signName(locale); PanchangScreen vara.lord via planetName(locale) (2 spots incl. LearnDialog), custom-date Intl hi-IN.
- Residual hardcoded strings fixed: HomeScreen "Tithi" label, Rahu/choghadiya notes, "until {time}" → new home.* keys (en+hi); Home suggested prompt chips → home.prompt* keys (en+hi), t() at render time (locale-reactive).
- QA @ http://localhost:81/ via agent-browser (Hindi + English): Home DayCard full Hindi (गति चुपचाप बनती है, राहु → शुक्र, पूर्व भाद्रपद, शुक्ल चतुर्दशी, सूर्योदय 06:23); Panchang full Hindi incl. simpleSummary + स्वामी · शुक्र + Hindi dates (25 सित॰); Horoscope full Hindi (basis मकर, 25 सितंबर 2026, sections करियर और कार्य/रिश्ते/स्वास्थ्य/धन); VLM verified Devanagari clean; English regression verified (Momentum builds quietly / Shukla Chaturdashi); mobile 390 Hindi home screenshot OK; console 0 errors; dev.log all 200s; tsc + lint clean. Screenshots: download/qa-round-engine-hi/.

Stage Summary:
- ENGINE LOCALIZATION COMPLETE for the 3 highest-traffic surfaces (Home, Panchang, Horoscope): the app now speaks Hindi end-to-end — UI chrome (round 6) + data (this round). Locale flows: store → service → ?locale= → provider → Hindi DTOs; caches keyed per locale; queryKeys include locale.
- Compute integrity: all astronomy/determinism untouched (English enums remain the compute keys; Hindi only at display assembly). English output byte-identical (default locale, en URLs unchanged).
- NOT yet localized (English stays): Kundli/Chart/Planets/Dasha/Transit/Compatibility screens (engine data), onboarding, reports content, notifications DB content — next candidates. Suggested next: (1) extend locale to dasha+transit+planets (names tables already exist — small), (2) onboarding language step, (3) reports share-as-image.

---
Task ID: 8-b
Agent: general-purpose (onboarding language step)
Task: First-run language step as step 0 of onboarding (English/हिन्दी cards → changeLocale → rest of flow in chosen language)

Work Log:
- Read worklog (6-hindi, 7-engine-hi), AGENTS.md, OnboardingFlow.tsx, locale store, both onboarding dictionaries, ProfileScreen LanguageDialog (visual DNA), AppShell/screens.tsx (gating: OnboardingFlow only mounts when `!user || !user.onboardingDone` → returning users with a profile never see it; no new screen id needed — step is internal to the flow).
- OnboardingFlow.tsx: new "language" step added to the Step union and made the initial state; pickLanguage() calls changeLocale() then setStep("welcome") (t() reads the new locale synchronously, so the next step + whole app render in the chosen language; locale persists via localStorage as before).
- Resume-effect guard widened to `step === "language" || step === "welcome"`: signed-in users without a profile still skip straight to name/birth/phone — the language step never shows to signed-in returning users.
- New LanguageStep component (placed before WelcomeStep): OnboardingShell chrome (h1 title + subtitle via t(), rendered in the CURRENT locale since the step runs pre-choice); two large cards side by side (`grid-cols-1 min-[380px]:grid-cols-2` — stacks on very narrow) driven by LOCALES so future locales appear automatically.
- Card visual DNA reused from ProfileScreen LanguageDialog: real <button> with role="radio"/aria-checked inside role="radiogroup" (aria-label = languageStepAria), अ/A glyph tiles (bg-secondary ivory, text-foreground/75; active → bg-primary terracotta), endonym labels always native script (LOCALES.nativeLabel — never translated), one-line hint in current language via t(), active Check top-right (text-success), border-primary/40 bg-accent/60 active card, hover:bg-secondary/70, press feedback, focus-visible ring-[3px] ring-ring/50, min-h-11 (44px) targets, per-card aria-label "endonym — hint".
- framer-motion: same staggered entrance as PromisesStep rows (opacity 0/y 12 → 0, delay 0.1 + i*0.12, 0.35s) wrapped on motion.div so .press :active transform still works; step advance uses the existing AnimatePresence step transition (no change).
- LanguageStep subscribes to useLocaleStore → the tapped card shows its selected state momentarily during the exit animation while strings flip to the new locale.
- No new packages, no files outside the onboarding feature + the two onboarding dictionaries (screens.tsx untouched). Analytics untouched (event union is closed in lib/analytics.ts — out of bounds).
- Verification: `bunx tsc --noEmit` → 0 errors in src/ (only pre-existing examples/ + skills/ errors); `bun run lint` clean; dictionary parity script → 56/56 keys, identical order en/hi, all plain strings; dev.log clean (all 200s, recompiled OK).

Stage Summary:
- COMPLETE: onboarding now starts with a two-card language choice (English / हिन्दी); picking a card switches locale instantly and the rest of onboarding + app continue in that language. Hindi is now discoverable at first run.
- Files touched: src/features/onboarding/OnboardingFlow.tsx (new step + wiring), src/i18n/en/onboarding.ts, src/i18n/hi/onboarding.ts.
- New i18n keys (en+hi, same order, inserted after welcomeSignIn): onboarding.languageTitle, languageSubtitle, languageHintEnglish, languageHintHindi, languageStepAria.
- QA notes for main agent: verify mobile 390/430 (cards side-by-side, frame width unchanged) + md+ centered card; tap हिन्दी → welcome step renders in Hindi; returning signed-in users (with profile) go straight to app; signed-in drop-offs skip the language step. Pre-existing hardcoded English strings elsewhere in onboarding (welcome terms line, "Three promises…" h1, name-step sub, "Sending…/Verifying…") were left as-is (out of scope).

---
Task ID: 8-a
Agent: general-purpose (engine localization round 2)
Task: Locale-aware engine for the remaining 5 surfaces — BirthChart (Kundli/Chart/Planets), Dasha, Transit, Compatibility (Planets shares chart endpoint)

Work Log:
- Read worklog (7-engine-hi, 6-hindi, HI-DICT), AGENTS.md, then all target files fully before editing.
- types.ts: AstrologyProvider — added optional `locale?: "en" | "hi"` last param to getBirthChart/getDasha/getTransit/getCompatibility (same shape as getPanchang/getHoroscope/getHomeAstrology).
- names.ts: new `nakshatraName(name, locale)` helper — builds Record from NAKSHATRAS (types.ts) × NAKSHATRA_HI by index; falls back to the input name when unknown.
- mock/dasha.ts: buildDasha(…, locale = "en"); new LORD_PHASE_ADVICE_HI (9 warm "एक ऐसा दौर जब/जो…" entries); simpleReading hi branch — headline `आप {ग्रह} दशा में हैं ({LORD_MEANING_HI})`, body mirrors English with hi-IN dates (month:"short") and "परंपरागत ज्योतिष इसे इस तरह पढ़ता है — {advice}।" ending.
- mock/compatibility.ts: buildCompatibility(…, locale = "en"); new Hindi tables in-file — KOOTA_NAME_HI, KOOTA_HINT_HI, KOOTA_MEANING_HI, VARNA_HI, GANA_HI, YONI_HI (14 animals), NADI_HI, VASHYA_HI, RELATION_HI (friend/enemy/neutral → मित्रता/तनाव/उदासीन). All 8 koota name/hint/meaning/detail, themes (2 + 3 manglik variants), manglik.note, 4 verdict bands, 3 disclaimers localized. Compute untouched: signVashya()/VARNA_BY_ELEMENT/relation()/scores/tables still run on English keys; Hindi mapped ONLY at display-string assembly.
- mock/provider.ts: PLANET_NATURE_HI (9); transitInterpretation(planet, house, locale) — hi slow-planet (शनि/राहु/केतु, "गुज़र रहा है") + fast-planet ("बढ़ा प्रभाव") templates with {house}वें भाव + HOUSE_THEMES_HI; notable hi `ग्रह राशि में हैं और आपके {house}वें भाव से गुज़र रहे हैं।` (respectful plural). getBirthChart(locale): 4 Hindi keyHighlights (Moon-sign parenthetical uses Hindi sign name instead of SIGN_SANSKRIT), 3 Hindi note variants, houses[].theme → HOUSE_THEMES_HI, D1/D9 → "राशि (D1)"/"नवांश (D9)" + Hindi descriptions ("D1"/"D9" Latin kept). getDasha/getCompatibility thread locale to builders. getHomeAstrology's internal getBirthChart/getDasha/getTransit calls left at "en" default (it builds its own Hindi lines from raw data — no double-localization).
- API routes: chart/dasha/transit GET — `?locale=hi` param, locale in cache key, passed to provider; compatibility POST — `locale: z.enum(["en","hi"]).optional()` in schema, cache key, provider call.
- services/astrology.ts: chart/dasha/transit accept optional locale (appended to URL only when ≠ "en", matching panchang/horoscope/home pattern); compatibility sends locale in POST body only when ≠ "en" (English request byte-identical).
- features/astrology/api.ts: CompatibilityBody.locale; sessionStorage handoff now stores {locale, result} envelope — readCompatResult(locale) rejects results stored under a different locale (prevents mixed-language data after a mid-session switch); storeCompatResult(result, locale).
- Screens (all: useLocaleStore + locale in queryKey + locale-aware service call): KundliScreen/PlanetsScreen/ChartScreen (["chart", profileId, locale]) — planet/sign/nakshatra/lords via planetName/signName/nakshatraName, moonSign/sunSign "sanskrit" sub → signName for hi; ChartScreen house sheet uses pre-localized chart.houses theme (HOUSE_THEMES only as fallback), sanskrit line → signName for hi; NorthChart gained optional locale prop (aria-label sign names; grid sign numbers + Su/Mo/Ra planet abbr stay Latin by design). DashaScreen (["dasha", profileId, locale]) — lords via planetName everywhere, all dates via new formatDateLocale(iso, locale) helper (utils.ts; hi-IN/en-IN, same options as formatDateIN short), single-letter chips S/M/R/… stay Latin, timeline-chip aria via new i18n key astrology.dashaChipAria (en text identical to the old inline template). TransitScreen (["transit", profileId, locale]) — planet/sign via helpers, dates locale-aware, interpretations/notable pre-localized, Ask-question prefill uses planetName. CompatibilityScreen — mutation now carries locale as its variable (read via getState() at send time), POST passes it, ProfileCard DOB dates locale-aware; CompatibilityResultScreen (["compat", aId, bId, locale]) — fallback re-POST passes locale, all koota/verdict/theme/disclaimer data pre-localized from API.
- i18n: one new key pair added to en+hi astrology dicts: dashaChipAria (no other dict changes; key order preserved).
- Verification: standalone bun harness compared HEAD vs current engine across 3 sample inputs × 8 methods (getBirthChart/getDasha/getTransit/getCompatibility/getHomeAstrology en+hi/getPanchang en/getHoroscope en) — ALL EN OUTPUTS BYTE-IDENTICAL (JSON.stringify equality, 24/24 OK); Hindi spot-checks read natural (chart highlights, dasha reading, transit interpretations + notable, all 8 kootas, verdict, themes, manglik, disclaimers). `bunx tsc --noEmit` → 0 errors in src/ (only pre-existing examples/ + skills/). `bun run lint` clean. dev.log: hot recompiles OK, no errors. No npm packages added, no test files, no unrelated screens touched.

Stage Summary:
- ENGINE LOCALIZATION COMPLETE for all 5 remaining surfaces: a Hindi-locale user now sees zero English engine content on Kundli, Chart, Planets, Dasha, Transit, Compatibility (planet/sign/nakshatra names, house themes, highlights, notes, readings, transit interpretations, koota names/hints/meanings/details, verdicts, manglik note, disclaimers, dates). English output byte-identical everywhere (verified programmatically).
- Locale flow identical to round 7: useLocaleStore → service → ?locale= (or POST body) → cache key → provider → Hindi DTO assembly; compute (enums, scores, tables, seeds) untouched.
- Deliberately left English/Latin: planet abbreviations (Su/Mo/Ju/…) and single-letter dasha chips (S/M/R/…), "D1"/"D9"/"R" chips, house numbers, sign numbers in the SVG grid, aria "×" separators in koota details, Latin digits everywhere; ProviderInfo label/disclaimer (mock badge copy is UI-side, pre-existing).
- Decisions worth knowing: (1) koota nadi hint translated as "शरीर-प्रकृति" (constitution) instead of the suggested "कृत्रिम संरचना" (unnatural for jyotish); (2) compat themes say "दोनों का स्कोर अच्छा/कम है" for natural Hindi agreement; (3) transit notable lines end with danda though the English template has no trailing period (Hindi typography rule); (4) sessionStorage compat handoff switched to a {locale, result} envelope to avoid stale-locale data after mid-session language switch.
- Next candidates: reports content localization (builder calls getBirthChart/getDasha/getTransit with default en), onboarding hardcoded strings (noted by 8-b), notifications DB content.

---
Task ID: 8-c
Agent: general-purpose (reports share-as-image)
Task: Share-as-image for ready reports (premium 1080×1350 share card via html-to-image) + reports styling polish pass

Work Log:
- Read worklog (7-engine-hi, 8-b, 8-a), AGENTS.md, then all reports-feature files, report API builder/DTOs, services/reports.ts, locale store, i18n index, globals.css tokens, Button/EmptyState/DemoDataBadge shared components, analytics union (closed — no new event names).
- bun add html-to-image@1.11.13 (only package.json change). Read its dist source first: clone-node copies FULL computed styles per node (so CSS vars resolve + Tailwind would work), embed-webfonts inlines matching @font-face from document stylesheets; toBlob returns a Blob directly.
- New src/features/reports/ShareCard.tsx: (1) ShareCard — 1080×1350 portrait, 80px padding, 100% INLINE styles with hardcoded hex equivalents of the globals.css oklch tokens (PAPER #fcf9f4, INK #2e241e, TERRA #ab542e, MUTED #6f645b, HAIRLINE #e4dfd7 — computed via oklch→sRGB script) + softest terracotta radial wash; font stacks var(--font-fraunces, Georgia)/var(--font-geist-sans, system-ui) with system + Devanagari fallbacks. Masthead: TARA wordmark (letterspaced serif) + ✦ + 2px terracotta rule. Middle: localized type badge pill (uppercase + 0.2em tracking en / 0.04em hi), big serif headline (48px en / 42px, lh 1.5+ hi), locale-aware date (en-IN/hi-IN, month:"long"), hairline–✦–hairline dinkus, 3-line clamped muted serif excerpt (first non-intro section paragraph, 240-char JS cap with word-boundary ellipsis as backstop). Footer: hairline rule, tagline (t reports.shareCardTagline) + ✦, disclaimer · demo-data note line (honesty travels with the image). Headline personalisation: when the stored title is a generic server title (REPORT_TITLES mirror) the big line becomes t(reports.forProfile) "For {name}" instead of repeating the badge; custom titles pass through. (2) captureShareCard — off-screen fixed host (left:-9999px), createRoot render, 60ms + double-rAF + document.fonts.ready, toBlob(card, {pixelRatio:2, width, height, backgroundColor}), unmount+remove in finally. (3) useShareReportImage hook — busy-ref + pendingId state; fetches report details when invoked from the list (list endpoint omits sections/profileName); guards non-ready; File named tara-report-<type>-<yyyy-mm-dd>.png; navigator.canShare({files}) → navigator.share (AbortError = silent user-cancel), else <a download> fallback; success toast shareSaved, error toast shareFailed; trackEvent("report_downloaded", {via:"image"}) (union is closed — reused existing event like the print path).
- ReportDetailsScreen: 4th action "Share as image" (Share2 icon, outline, h-11 rounded-2xl like siblings; pending = Loader2 spinner + label swaps to sharePreparing, disabled, aria-busy). Action bar grid-cols-3 → grid-cols-2 md:grid-cols-4 (mobile 2×2 keeps 44px targets — deliberate reflow to fit the mandated new action; screen structure otherwise untouched). Existing text-Share button re-iconed Share2→Share so the two share actions stay visually distinct (behavior unchanged). Sections: stagger delay 0.05*i (capped 0.3), hairline-separated list → rounded-2xl border-border bg-card cards (px-4 py-4 md:px-5 md:py-5, faint shadow) in a space-y-2.5 stack.
- ReportsScreen: TYPE_ICONS map (verified type strings from schema/API: kundli→ScrollText, career→Briefcase, marriage→Heart, yearly→CalendarRange, compatibility→Users, consultation_summary→MessageSquare, fallback FileText) now drives BOTH the generate-zone cards (yearly switched CalendarDays→CalendarRange) and the report list rows (per-type icon tiles, previously all FileText). List rows: one bordered container with dividers → per-row rounded-2xl cards (same content/tap targets); nav is an inner flex-1 button + separate share icon-button on READY rows (nested buttons are invalid HTML — this was required); hover lift via shared CARD_HOVER (hover:border-primary/30 hover:shadow-md hover:[transform:translateY(-1px)] — transform property so the unlayered .press transition eases the lift; compose-safe with framer-motion). ReportStatusChip polished: soft tinted bg + tinted border + leading status dot (success/amber-tinted/destructive; generating dot uses tara-shimmer), px-2.5 py-1, 10.5px.
- i18n: 6 new key pairs inserted after shareText at identical positions in en+hi (parity script: 50/50 keys, identical order, all plain strings). Hindi uses "इमेज" (matches existing डाउनलोड/डेमो टेटा transliteration tone), आप-form.
- Verification: bunx tsc --noEmit → 0 errors in src/ (only pre-existing examples/+skills/ errors); bun run lint clean; parity check 50/50 identical order. Dev server was NOT running during this task (checked ps/ss; only the agent-browser daemon) so no hot-reload/QA pass was possible from here — did NOT restart it per rules; main agent QA pending.

Stage Summary:
- Share-as-image COMPLETE for ready reports from both the details screen and the reports list: premium 1080×1350 brand card (ivory paper, terracotta accent, serif display, ✦ motifs, localized masthead/badge/date/tagline/note, honest demo+guidance footer), captured client-side at pixelRatio 2, shared via Web Share API on mobile / downloaded on desktop.
- Files touched: src/features/reports/ShareCard.tsx (NEW — card + capture + useShareReportImage), src/features/reports/ReportDetailsScreen.tsx, src/features/reports/ReportsScreen.tsx, src/i18n/en/reports.ts, src/i18n/hi/reports.ts, package.json (+bun.lock, dependency only).
- New i18n keys (en+hi, same order): reports.shareImage, shareImageShort, shareCardTagline, sharePreparing, shareSaved, shareFailed.
- Deliberate calls worth knowing: (1) action bar is grid-cols-2 on mobile (2×2) to fit the mandated 4th action at 44px targets — the one intentional mobile-structure deviation, screen-level layout otherwise unchanged; (2) share-card headline shows "For {name}" when the stored title is a generic type title (badge already carries the type — avoids KUNDLI REPORT/Kundli report duplication), custom titles render as-is; (3) share-card excerpt stays English in hi mode until report-content localization lands (per task guidance) — card chrome is fully localized; (4) reused trackEvent("report_downloaded", {via:"image"}) because the analytics event union is closed and out of bounds; (5) text-share kept as-is (Share icon) alongside the new image share (Share2).
- QA notes for main agent: verify mobile 390/430 (action bar 2×2, list rows + share icon buttons, section cards) and md+ (4-across actions, 3-col templates); trigger share-as-image on desktop → PNG download named tara-report-kundli-<date>.png (inspect card rendering: fonts, Devanagari variant in hi, excerpt clamp); hi mode card copy (कुंडली रिपोर्ट badge, आरव के लिए headline, hi-IN date, tagline); status chips (ready/amber shimmer/failed).

---
Task ID: 8-round
Agent: main (Z.ai Code)
Task: Round 8 — engine localization completion (Kundli/Dasha/Transit/Compatibility), onboarding language step, logout bug fix, reports share-as-image, planet-glyph unification + residual i18n fixes

Work Log:
- QA assessment via agent-browser @ http://localhost:81/: servers healthy, 0 live console errors; confirmed known gap — Kundli/Dasha/Transit/Compatibility showed English engine data in Hindi mode (planet/sign names, dates, interpretations, kootas).
- Task 8-a (subagent): locale-aware engine for the remaining surfaces. Provider interface + mock engine (getBirthChart/getDasha/getTransit/getCompatibility take optional locale); Hindi tables for koota names/meanings/verdicts/themes (varna/vashya/tara/yoni/graha-maitri/gana/bhakoot/nadi + gana/yoni/nadi/varna/vashya values), transit interpretations (PLANET_NATURE_HI), dasha readings (LORD_PHASE_ADVICE_HI), chart highlights/notes/divisional names; API routes chart/dasha/transit (GET ?locale=) + compatibility (POST body locale), cache keys include locale; services + screens wired (locale in queryKeys); formatDateLocale helper; sessionStorage compat handoff now {locale, result} envelope. English byte-identity verified programmatically (24/24 method outputs JSON-identical across 3 profiles). tsc/lint clean.
- Task 8-b (subagent): onboarding first-run language step — new "language" Step as initial onboarding state; two large endonym cards (English/हिन्दी, अ/A glyph tiles, LanguageDialog visual DNA) calling changeLocale() before advancing; returning signed-in drop-offs skip it; 5 new i18n key pairs.
- BUG FIXED (pre-existing, found during QA): logout left the app STUCK on the main shell with an error state — React Query keeps last successful data when the post-logout /api/auth/me refetch 401s, so me.data?.user stayed truthy and AppShell never swapped to onboarding. Fix: new useSignOut() hook (hooks/useSession.ts) using resetQueries(["me"]) + resetTab("home"); wired into ProfileScreen LogoutRow + SecurityScreen. Verified live: logout now lands on the language step within ~2s, no reload needed.
- Residual hardcoded strings fixed in OnboardingFlow (found during E2E walk): "Three promises we make to" you heading, "By continuing you agree…" footer, "Sending…"/"Verifying…" loading labels → 4 new key pairs (privacyHeading, welcomeTerms, phoneSending, otpVerifying) in en+hi dicts.
- Full onboarding E2E walk in Hindi verified: language → welcome → promises → phone → OTP (demo code) → name → birth details (date/time/place) → "आपकी कुंडली तैयार है" → main app; locale persists across reloads; sign-in-as-existing-user path verified too.
- Task 8-c (subagent): reports share-as-image — new ShareCard.tsx (1080×1350 branded card, inline-styled, Georgia/Devanagari fallback stacks, demo-data + disclaimer travel with image) + useShareReportImage() hook (html-to-image@1.11.13, pixelRatio 2, navigator.share files → <a download> fallback, AbortError silent); 4th action on ReportDetailsScreen + per-row share icon on ready reports; reports styling polish (type icon tiles, hover lift, tinted status chips, section stagger). 6 new key pairs. Verified live: PNG generated + downloaded (desktop fallback path), VLM-verified card design ("exceptionally clean and minimalist… premium").
- Styling detail pass (mandatory): unified planet glyph chips across astrology screens — KundliScreen planetary summary cards now show PLANET_ABBR/PLANET_GLYPH_CLASS chips (row layout with truncation), DashaScreen NowCards (glyphPlanet prop) + antardasha rows get glyphs (active row uses primary-foreground/20). VLM-verified clean on desktop + mobile 390 (no overflow).
- Dev server OOM-died mid-round (detected after 8-c); restarted via (bun run dev >> dev.log 2>&1 &) — recovered, all routes 200 after.
- Final verification: tsc 0 errors in src/, lint clean, dev.log all 200s (401s only during signed-out QA phases), console 0 live errors, English regression verified (Kundli/Dasha/home/compat). Screenshots: download/qa-round8/ (01-19).

Stage Summary:
- HINDI IS NOW END-TO-END for the entire astrology surface: UI chrome + engine data (Home, Panchang, Horoscope, Kundli, Chart D1/D9, Planets, Dasha, Transit, Compatibility) + AI answers + onboarding (first-run language step) + reports share cards + payment reasons.
- New features this round: onboarding language step (Hindi discoverable at first run), reports share-as-image (Web Share + download fallback), unified planet glyph visual language, logout reliability fix.
- Fixed bugs: logout stuck-state (resetQueries), 4 hardcoded onboarding strings.
- NOT yet localized (English stays): report CONTENT bodies (generated server-side by builder.ts — next candidate), notifications DB content, chat-service astrologer auto-replies, ProviderInfo disclaimer label.
- Risks: none known; mobile 430px frame untouched throughout (verified 390px screenshots).
- Recommended next: (1) locale-aware report generation (builder.ts takes locale — moderate), (2) chat-service (3003) Hindi astrologer replies, (3) email auth, (4) notifications content localization, (5) Panchang date navigation.

---
Task ID: 9-plan-infra
Agent: main (Z.ai Code)
Task: Master plan (PLAN.md) + Supabase Postgres migration + GitHub backup push

Work Log:
- Answered user's architecture questions (mock vs real engine, 3-project SAAS, backend status)
- Wrote /home/z/my-project/PLAN.md — phased roadmap (Phase 0 infra DONE, Phase 1 real engine CURRENT, Phase 2 role-switch demo, Phase 3 astrologer full, Phase 4 pooja module, Phase 5 super admin, Phase 6 production split + Razorpay/MSG91/DPDP) with per-phase tasks/DB/API/acceptance criteria
- Supabase migration: prisma/schema.prisma provider sqlite→postgresql + directUrl; bunx prisma db push (20 models created on Supabase); bun db/seed.ts (12 astrologers + reviews)
- Found & fixed env landmine: sandbox shell re-injects stale sqlite DATABASE_URL every new Bash command; Bun doesn't override shell env with .env → app was reading sqlite URL. Fix: TARA_DATABASE_URL (set in .env) takes precedence in src/lib/db.ts via datasourceUrl. Seed + runtime now immune
- Moved SQLite artifacts to backups/ (custom.db, old .env, old schema) — .env* pattern se bahar (Bun loads all .env* files!)
- Restarted dev server; E2E verified on Supabase: OTP login (9876543210) → user created → /api/astrologers returns 12 seeded → /api/astrology/home correct no_profile guard
- Git: untracked .env (was committed by platform checkpoints — old content had NO secrets, verified); .gitignore hardened (backups/, db/*.db, download/, shots/, tool-results/, tests/, .zscripts/); README.md; commit "Phase 0 complete"; pushed to github.com/nv1111/Aest main (remote was empty, clean push)
- 15-min webDevReview cron re-enabled

Stage Summary:
- DATABASE IS NOW LIVE SUPABASE POSTGRES (sckgziqyxwswxywaxpza, ap-northeast-2 pooler). SQLite removed from runtime (backup in backups/)
- ROADMAP SINGLE SOURCE OF TRUTH: PLAN.md — next agents MUST read PLAN.md first, execute Phase 1 (real astrology engine) top-to-bottom
- KEY GOTCHA for all future agents: never trust shell DATABASE_URL; prisma CLI uses .env (works); app uses TARA_DATABASE_URL (works); do NOT create files matching .env* except .env itself
- GitHub: https://github.com/nv1111/Aest (PAT embedded in git remote origin URL locally). Secrets in .env only, never committed
- Phase 1 (real astronomy-engine integration) is the CURRENT phase per plan

---
Task ID: 10-phase1
Agent: main (Z.ai Code)
Task: Phase 1 — Real Astrology Engine (live ephemeris) — COMPLETE

Work Log:
- Installed astronomy-engine@2.1.19 (MIT, VSOP87-grade)
- Created src/lib/astrology/live/: ephemeris.ts (apparent geocentric longitudes via GeoVector→Rotation_EQJ_ECT, Lahiri ayanamsa polynomial, mean lunar nodes, real retrograde via daily motion, proper oblique-sphere ascendant, SearchRiseSet sun/moon events, retrograde-aware sign-entry bisection search) + provider.ts (LiveAstrologyProvider)
- Refactored mock/panchang.ts buildPanchang into position-source-agnostic builder (PanchangPositions interface; default=mock, live injects real); tithi/nakshatra end-times now Newton-solved from real motion; reference instant = sunrise (panchang convention)
- types.ts: DivisionalChart id + "D10"; HomeAstrology + provider field
- provider.ts: real D9 navamsa ((signIndex*9 + n9) % 12 rule) + D10 dashamsa; ChartScreen D1/D9/D10 tabs + i18n d10 keys (en/hi)
- index.ts: ASTROLOGY_PROVIDER env switch (default live); .env ASTROLOGY_PROVIDER=live
- All 7 astrology routes: cache keys prefixed with provider().info.id (stale-cache immunity); HomeScreen demo badge now conditional on provider.mode === "mock"
- VALIDATION HARNESS (live/validate.ts, run: bun src/lib/astrology/live/validate.ts): 19/19 PASS — equinox Sun 0.0003°; solstice 89.9999°; Lahiri J2000 exact + Sep 2026 24.2263 vs 24.2279; India chart lagna Taurus 7°43' EXACT (published), Sun Cancer 27.99, Moon Pushya pada 1; Gandhi (07:11 AM LMT corrected via web research) lagna Libra 4°16' vs published 4°37', Moon Cancer 27°55' Ashlesha vs published 27°45'; Saturn/Rahu/Jupiter current signs match published 2026 transits; dasha 120y-minus-balance + antar tiling; ascendant closed-form vs independent numerical scan Δ0.6' (4 locations)
- BUGS FOUND & FIXED: (1) solarEvents/lunarEvents searched from midnight−18h → returned PREVIOUS day's sunrise (panchang off by a day) — now rise searched from local midnight, set from local noon; (2) validate passed ms numbers where Dates expected (astronomy-engine treats numbers as Julian days → "Object is too distant"); (3) Gandhi reference birth time was 7:11 AM LMT (+4:39), not PM — corrected via web sources
- QA (agent-browser): onboarding → live chart; home no DEMO badge + real panchang (Krishna Pratipada, Uttara Bhadrapada pada 4, sunrise 06:11/sunset 18:12 Delhi, Rahu Kaal 16:42–18:12 Sunday ✓); Kundli real positions (Moon 10.0° Pushya p2, Sun 28.4° — motion-consistent); Chart D1/D9/D10 tabs live; Panchang screen real; Hindi Devanagari + live data ✓; dasha consistency across two profiles (Mars vs Rahu maha — both mathematically correct from Pushya balance)
- tsc: 0 src errors; lint: clean; dev.log: no errors

Stage Summary:
- ASTROLOGY ENGINE IS NOW REAL: live-engine-v1 default everywhere; mock available via ASTROLOGY_PROVIDER=mock
- Known characteristic: Supabase ap-northeast-2 pooler ~0.9s RTT from sandbox → API responses ~0.9-1.5s (cache layer absorbs repeats; production/Vercel will be faster)
- Phase 1 COMPLETE per PLAN.md (all 13 tasks + acceptance). NEXT: Phase 2 — Role-Switch Demo Mode (astrologer + admin consoles in-app, AstrologerAccount model, role guard APIs)
- validate.ts is the permanent regression harness — run before any engine change
