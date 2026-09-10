# AGENTS.md

Practical guidelines and repo-specific quirks for AI agents working in `vertex-pos` (`fiambreria-main`).

---

## 1. Quick Reference Commands

### Required CI / Verification Order
When verifying changes, run in this sequence:
```bash
npm run prisma:generate   # 1. MUST run first if schema changed or on fresh install
npm run lint              # 2. ESLint 9 flat config (eslint .)
npm run typecheck         # 3. tsc --noEmit (note: tests are excluded from tsconfig.json)
npm test                  # 4. Vitest run
```

### Targeted Testing
Vitest v4 runs in `node` environment (`vitest.config.mts`):
```bash
# Run a single test file
npx vitest run tests/lib/format.test.ts

# Run tests matching a pattern
npx vitest run -t "getPaymentSummary"

# Watch mode
npm run test:watch
```

### Background Worker & Seed
```bash
# Run a single worker polling cycle (low-stock scans, daily summary notifications)
npm run worker:once

# Run worker continuously
npm run worker

# Seed database with sample stores, catalog, and test staff accounts
npm run seed

# Database migrations
npm run prisma:migrate    # local development (migrate dev)
npm run prisma:deploy     # staging/production (migrate deploy)
```

---

## 2. Environment & Testing Quirks

- **No live DB needed for unit/route tests**: Vitest tests mock `@/lib/prisma`, `@/lib/email`, and `@/lib/auth/audit` via `vi.mock`. Tests run entirely in-memory and pass without PostgreSQL or SMTP running.
- **Fixed Timezone**: Test setup (`tests/setup/env.ts`) sets `process.env.TZ = 'Asia/Manila'`. Date formatting tests expect this timezone.
- **`tsconfig.json` excludes tests**: `tests/`, `__tests__/`, and `test-runner.ts` are excluded from the main TypeScript build config. Running `npm run typecheck` checks application code only.
- **Node version**: Targets Node 20+ (CI uses Node 20 / Node 22).

---

## 3. Architecture & Entrypoints

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5.
- **Proxy/Middleware**: Uses `proxy.ts` (`export { auth as proxy } from '@/auth'`) at the repository root following Next.js 16 proxy conventions instead of `middleware.ts`.
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss` and `@import "tailwindcss";` in `app/globals.css`. There is no `tailwind.config.js`.
- **UI Language**: The application UI, status badges, and business labels are localized in **Spanish** (`es-MX` locale in `lib/format.ts`, terminology: "Completada", "Anulada", "Caja abierta", "Merma", etc.). Never replace Spanish UI text or labels with English unless explicitly requested. Default currency symbol is `₱` (configurable per shop in `ShopSetting`).
- **Path alias**: `@/*` maps to the project root (`./*`).

---

## 4. Multi-Tenant & Authorization Patterns

Every business operation belongs to an active shop (`shopId`).

### Page Guards (Server Components)
Import from `@/lib/authz`:
```ts
// Enforces minimum role and handles redirects (/login, /onboard, /dashboard)
const { session, shopId, role } = await requirePageRole('MANAGER');

// Enforces granular permission
await requirePagePermission('VIEW_REPORTS');
```

### Route Handlers (API Routes)
Import from `@/lib/authz` and `@/lib/api`:
```ts
import { requireRole, requirePermission } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('CASHIER');
    // ... logic ...
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to process request');
  }
}
```
`apiErrorResponse` automatically maps:
- `AuthenticationError` -> `401`
- `AuthorizationError` -> `403`
- `ShopContextError` -> `403` (inactive access) or `409` (no shop)
- Unknown errors -> `500`

### Role Hierarchy & Permissions
- Hierarchy: `ADMIN` (3) > `MANAGER` (2) > `CASHIER` (1).
- Granular permissions defined in `lib/permissions.ts` (`VIEW_REPORTS`, `EDIT_PRODUCTS`, `VOID_SALES`, `REFUND_SALES`, `ADJUST_INVENTORY`, `VIEW_PURCHASE_COSTS`, `MANAGE_STAFF`).
- User memberships can have custom permission overrides stored in `UserShop.customPermissions`.

---

## 5. Domain & Data Gotchas

### Prisma Decimal Serialization Across RSC Boundaries
- Money and quantity fields in Prisma are `Decimal` instances (`@prisma/client/runtime/library`).
- Passing raw Decimal objects from Server Components to Client Components triggers serialization errors.
- Always serialize data before passing to client components using helpers in `lib/serializers/` (`register.ts`, `dashboard.ts`, `staff.ts`) or convert Decimals (`.toString()`) and Dates (`.toISOString()`).

### Sequential Document Numbers
Receipt, sale, and transfer document numbers must be generated inside a Prisma interactive transaction:
```ts
import { getNextDocumentNumber } from '@/lib/document-sequence';

await prisma.$transaction(async (tx) => {
  const invoiceNo = await getNextDocumentNumber(tx, {
    shopId,
    type: 'SALE_INVOICE',
    prefix: 'INV'
  });
});
```

### Auth Requirements & Seed Accounts
- Auth is handled via Auth.js / NextAuth v5 credentials provider (`auth.ts`).
- Users must have `emailVerifiedAt` set and `forcePasswordReset: false` to log in.
- Accounts are locked for 15 minutes after 5 consecutive failed login attempts.
- Default seeded accounts (`prisma/seed.ts`, all password `password123`):
  - `owner@vertexpos.local` (`ADMIN`)
  - `manager@vertexpos.local` (`MANAGER`)
  - `cashier@vertexpos.local` (`CASHIER`)

### Hardware & Cash Drawer Integration
- Receipt print and cash drawer kicks (`lib/cash-drawer.ts`) support:
  1. Window bridge: `window.VertexPOS.openCashDrawer` or `window.__VERTEX_POS_BRIDGE__.openCashDrawer`
  2. HTTP bridge: `NEXT_PUBLIC_CASH_DRAWER_BRIDGE_URL` with optional `NEXT_PUBLIC_CASH_DRAWER_BRIDGE_TOKEN`
  3. Browser fallback: dispatches `vertex-pos:cash-drawer-kick` CustomEvent on `window`

### Offline Checkout Idempotency
- Cart drafts and queued sales are stored in browser `localStorage` (`lib/offline-checkout.ts`).
- Queued sales replayed on reconnection send `clientRequestId` to `/api/sales` to guarantee idempotent processing.
