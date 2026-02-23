# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Run all apps in development (Turborepo)
npm run dev

# Run individual apps
cd apps/api && npm run dev      # API on Cloudflare Workers (wrangler dev)
cd apps/dashboard && npm run dev # Next.js dashboard (with Turbopack)

# Type checking
npm run typecheck               # All workspaces
cd apps/api && npm run typecheck
cd apps/dashboard && npm run typecheck

# Linting
npm run lint

# Testing
cd apps/api && npm run test      # Run API tests (vitest)
cd apps/api && npm run test:watch # Run tests in watch mode

# Database operations (from packages/db)
npm run db:generate             # Generate Drizzle migrations
npm run db:migrate:local        # Apply migrations to local D1
npm run db:migrate:remote       # Apply migrations to remote D1
cd packages/db && npm run db:studio  # Open Drizzle Studio

# Deployment
cd apps/api && npm run deploy       # Deploy API to Cloudflare Workers
cd apps/dashboard && npm run build && npm run deploy  # Build with OpenNext, deploy dashboard
```

## Architecture

This is a Turborepo monorepo for a property valuation API platform deployed on Cloudflare.

### Workspaces

- **apps/api** - Hono REST API on Cloudflare Workers
- **apps/dashboard** - Next.js 15 dashboard (deployed via OpenNext on Cloudflare)
- **packages/db** - Shared Drizzle ORM schema and D1 database utilities

### API Structure (apps/api)

```
src/
├── index.ts           # Hono app entry, route mounting, global middleware
├── types.ts           # All TypeScript types (Env, API responses, CoreLogic types)
├── middleware/
│   └── auth.ts        # API key authentication, quota checking, usage logging, rate limit headers
├── routes/
│   ├── health.ts      # Health check endpoints (no auth)
│   ├── property.ts    # Property search and details
│   ├── comparables.ts # Comparable sales lookup
│   └── valuation.ts   # ARV calculation and property analysis
└── services/
    ├── corelogic.ts   # CoreLogic Property API client with key rotation
    └── calculations.ts # ARV/valuation calculations, rehab cost estimates
```

### Authentication Flow

- **Dashboard auth**: Better Auth (email/password) with sessions in D1
- **API auth**: Bearer token with SHA-256 hashed API keys stored in `api_keys` table
- All `/v1/*` routes require auth middleware; `/health` routes are public
- Rate limit headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Database Schema (packages/db/src/schema.ts)

Key tables: `user`, `session`, `account`, `verification` (Better Auth), `apiKeys`, `apiUsageLogs`, `savedReports`, `subscriptions`

Plan limits defined in `PLAN_LIMITS` constant: free (100 req/mo, 1 key), pro (5000 req/mo, 5 keys), enterprise (unlimited)

### External Services

- **CoreLogic API**: Property data, comparables, flood zone. Client in `services/corelogic.ts` supports multiple API keys with automatic rotation on rate limits (429) or auth failures.
- **Cloudflare D1**: SQLite database, accessed via Drizzle ORM

## Environment Variables

**apps/api/.dev.vars:**
```
# CoreLogic API Keys (with rotation support - 100 calls/day each)
CORELOGIC_CLIENT_ID_0=
CORELOGIC_CLIENT_SECRET_0=
CORELOGIC_CLIENT_ID_1=
CORELOGIC_CLIENT_SECRET_1=
# ... up to _6
```

**apps/dashboard/.dev.vars:**
```
BETTER_AUTH_SECRET=
```

Database bindings are configured in `wrangler.toml` files (D1 database named `flowstate-api-db`).
