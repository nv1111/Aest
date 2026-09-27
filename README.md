# Tara (Aest) — Indian Astrology Platform

Next.js 16 · TypeScript · Tailwind 4 · shadcn/ui · Prisma + Supabase Postgres · socket.io · z-ai-web-dev-sdk

User-side jyotish app: kundli, panchang, dasha, matching, AI assistant, astrologer consultations, wallet, reports. English + हिन्दी.

**Development roadmap**: see [PLAN.md](./PLAN.md) — phased plan (engine, astrologer console, pooja module, admin console, production split).

## Dev

```bash
bun install
bun run db:push     # schema → Supabase
bun db/seed.ts      # demo data
bun run dev         # port 3000
```

Env vars in `.env` (Supabase Postgres pooler URLs, keys) — see `.env.example` structure inside PLAN.md / worklog.
