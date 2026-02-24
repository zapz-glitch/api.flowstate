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

This is a Turborepo monorepo for a **real estate underwriting/valuation API platform** deployed on Cloudflare.

### Workspaces

- **apps/api** - Hono REST API on Cloudflare Workers
- **apps/dashboard** - Next.js 15 dashboard (deployed via OpenNext on Cloudflare)
- **packages/db** - Shared Drizzle ORM schema and D1 database utilities

### API Structure (apps/api)

```
src/
├── index.ts              # Hono app entry, route mounting, global middleware
├── types.ts              # All TypeScript types (Env, API responses)
├── middleware/
│   └── auth.ts           # API key authentication, quota checking, usage logging
├── routes/
│   ├── health.ts         # Health check endpoints (no auth)
│   ├── property.ts       # Property search and details
│   ├── comparables.ts    # Comparable sales lookup
│   ├── valuation.ts      # ARV calculation and property analysis
│   └── analyze.ts        # Main analysis endpoint (async queue-based)
├── durable-objects/
│   ├── analysis-job.ts   # Durable Object for job state & WebSocket streaming
│   └── rate-limit-coordinator.ts  # Coordinates rate limits across keys
├── queues/
│   └── analysis-processor.ts  # Queue consumer for async analysis jobs
└── services/
    ├── property-api/     # CoreLogic Property API client with key rotation (9 keys)
    ├── appraisal/        # Appraisal rules engine (filters & adjustments)
    ├── classification/   # Property classification (As-Is vs After-Renovation)
    ├── analysis/         # Shared analysis logic & response building
    ├── valuation/        # ARV/valuation calculations, rehab cost estimates
    ├── comp-selection/   # LLM-based comp selection (optional)
    ├── vision/           # Photo analysis for property classification
    └── photo-provider/   # Photo fetching from multiple sources
```

## Core Domain Concepts

### Property Classification System

Properties are classified into three categories based on condition:

| Classification | Description | Use Case |
|---------------|-------------|----------|
| **as_is** | Distressed, needs work | Current market value |
| **after_renovation** | Recently renovated, turnkey | Target ARV for flips |
| **transitional** | Partially updated | Blended valuation |

Classification is determined by:
1. **Vision analysis** (photos) - Preferred method
2. **MLS remarks parsing** - Keywords like "investor special", "move-in ready"
3. **Data signals** - Recent permits, sale history, price/sqft anomalies

### Appraisal Rules Engine

Located in `services/appraisal/`. Evaluates comps using:

**Filters** (pass/fail criteria):
- `subdivision_match` - Same subdivision as subject
- `sale_age` - Days since sale (default: 180 days)
- `sqft_diff` - Square footage difference percentage (default: 20%)
- `year_built_diff` - Year built difference (default: 10 years)
- `distance` - Miles from subject (default: 1 mile)

**Adjustments** (price modifications):
- Square footage adjustment ($50/sqft difference)
- Bedroom/bathroom adjustments
- Age adjustments
- Pool/garage adjustments

### Weighted ARV Algorithm (Expert Underwriter Methodology)

Located in `services/appraisal/index.ts` - `calculateWeightedARV()`.

**Tier System**:
| Tier | Match Type | Weight |
|------|-----------|--------|
| Tier 1 | Same classification as subject | 60-80% |
| Tier 2 | Transitional comps | 15-30% |
| Tier 3 | Opposite classification | 5-15% (spread analysis) |

**Weight Factors** (multiplicative):
1. **Classification Match** (0.0-2.0) - **CRITICAL FACTOR**
2. **Filter Pass Rate** (0.5-1.5) - Appraisal rule compliance
3. **Distance** (0.3-2.0) - Closer is better
4. **Sqft Similarity** (0.5-1.5)
5. **Recency** (0.6-1.4) - Recent sales weighted higher
6. **Confidence Bonus** (0.8-1.2) - Classification confidence

**Investment Scenarios Generated**:
- **Flip** - Based on after-renovation comps with spread analysis
- **Wholesale** - Based on as-is current market value
- **Rental** - Conservative 40% of spread for cosmetic updates

### Analysis Response Structure

The `/v1/analyze` endpoint returns:

```typescript
{
  subject: {
    address, county, bedsBaths, squareFeet, yearBuilt,
    subdivision, lastSale, taxAssessment, photos,
    classification: { type, confidence, reasoning }
  },
  valuation: {
    arv, arvSource, arvMethodology, arvPerSqft,
    asIsValue, afterRenovationValue, spread,
    spreadAnalysis: { asIsToArv, potentialProfit },
    investmentScenarios: [{ strategy, targetArv, confidence, notes }],
    buyPrice, rehabCost, projectedProfit, projectedROI,
    recommendation, recommendationReason
  },
  comps: {
    total, enabledCount, disabledCount,
    asIsCompIds, afterRenovationCompIds, transitionalCompIds,
    items: [{
      id, address, salePrice, adjustedPrice, qualityScore,
      classification, weightInArv, isEnabled, disableReasons,
      appraisalRules: { passedFilters, filters[], adjustments[] }
    }]
  },
  riskFlags, permits, floodZone, meta
}
```

## Async Analysis Flow

The analysis endpoint uses Cloudflare Queues for async processing:

1. **POST /v1/analyze** - Enqueues job, returns `jobId`
2. **GET /v1/analyze/:jobId** - Poll for status or connect WebSocket
3. **WebSocket** - Real-time progress streaming via Durable Object

```
Client -> POST /analyze -> Queue -> Consumer -> Durable Object -> WebSocket
                              |
                              v
                    Property API (CoreLogic)
                              |
                              v
                    Appraisal + Classification
                              |
                              v
                    Weighted ARV Calculation
```

## Authentication Flow

- **Dashboard auth**: Better Auth (email/password) with sessions in D1
- **API auth**: Bearer token with SHA-256 hashed API keys stored in `api_keys` table
- All `/v1/*` routes require auth middleware; `/health` routes are public
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Database Schema (packages/db/src/schema.ts)

Key tables: `user`, `session`, `account`, `verification` (Better Auth), `apiKeys`, `apiUsageLogs`, `savedReports`, `subscriptions`

Plan limits defined in `PLAN_LIMITS` constant: free (100 req/mo, 1 key), pro (5000 req/mo, 5 keys), enterprise (unlimited)

## External Services

- **CoreLogic API**: Property data, comparables, flood zone. Client in `services/property-api/` supports 9 API keys with automatic rotation on rate limits (429) or auth failures.
- **Cloudflare D1**: SQLite database, accessed via Drizzle ORM
- **Cloudflare Queues**: Async job processing for analysis
- **Cloudflare Durable Objects**: Job state management and WebSocket streaming
- **OpenAI/Claude**: Optional LLM-based comp selection and vision analysis

## Environment Variables

**apps/api/.dev.vars:**
```
# CoreLogic API Keys (with rotation support - 100 calls/day each)
CORELOGIC_CLIENT_ID_0=
CORELOGIC_CLIENT_SECRET_0=
# ... up to _8 (9 keys total)

# Optional: LLM for comp selection
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

**apps/dashboard/.dev.vars:**
```
BETTER_AUTH_SECRET=
```

Database bindings are configured in `wrangler.toml` files (D1 database named `flowstate-api-db`).

## Key Implementation Files

| Feature | Primary File(s) |
|---------|----------------|
| Analysis endpoint | `routes/analyze.ts` |
| Queue processor | `queues/analysis-processor.ts` |
| Appraisal rules | `services/appraisal/index.ts`, `services/appraisal/evaluator.ts` |
| Weighted ARV | `services/appraisal/index.ts` - `calculateWeightedARV()` |
| Property classification | `services/classification/index.ts` |
| Response building | `services/analysis/index.ts` - `buildAnalysisResponse()` |
| Comp quality scoring | `services/analysis/index.ts` - `calculateCompQualityScore()` |
| CoreLogic client | `services/property-api/corelogic-client.ts` |
| Job state (DO) | `durable-objects/analysis-job.ts` |
