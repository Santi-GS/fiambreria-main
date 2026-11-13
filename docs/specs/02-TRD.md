# 02. Documento de Requisitos Técnicos (TRD)

Este documento define el stack, la arquitectura, las convenciones obligatorias y el mapa de APIs de **Fiambrería Costanera POS (`vertex-pos`)** para que cualquier agente o desarrollador tome decisiones consistentes sin adivinar.

---

## 1. Stack Tecnológico

| Capa | Tecnología / Versión | Uso en el proyecto |
| :--- | :--- | :--- |
| **Framework** | Next.js `16.1.1` (App Router) | Renderizado híbrido (RSC + Client Components) y Route Handlers en `app/api/**`. |
| **UI / Runtime** | React `19.2.3`, TypeScript `5` | Tipado estricto (`tsc --noEmit` con exclusión de `tests/`). |
| **Estilos** | Tailwind CSS `4.1.18` (`@tailwindcss/postcss`) | CSS-first en `app/globals.css` con `@import "tailwindcss";` (sin `tailwind.config.js`). |
| **Animaciones** | Framer Motion `12.26.2` | Transiciones de sidebar móvil y feedback visual en componentes interactivos. |
| **Base de Datos / ORM** | PostgreSQL + Prisma `6.19.2` (`@prisma/client`) | Esquema multi-tenant en `prisma/schema.prisma`, transacciones interactivas y `Decimal(12,2)`. |
| **Autenticación** | NextAuth `5.0.0-beta.22` (Auth.js v5) | Estrategia `jwt`, proveedor `Credentials` (`bcryptjs`), protección vía `proxy.ts`. |
| **Validación** | Zod `3.25.76` | Validación de payloads en API routes y formularios (`lib/auth/validation.ts`, etc.). |
| **Correo** | Nodemailer `7.0.7` | Envío de verificación de email y reseteo de contraseña (`lib/email.ts`). |
| **Testing** | Vitest `4.1.2` (`@vitest/coverage-v8`) | Tests unitarios y de rutas en entorno `node` con mocks de Prisma/Email/Audit. |
| **Infraestructura** | Node 20+, Docker, `worker/index.ts` | Despliegue con `Dockerfile`, `docker-compose.yml`, `install.sh` y worker de tareas. |

---

## 2. Arquitectura y Convenciones Críticas

### 2.1 Enrutamiento y Proxy (Next.js 16)
- Se utiliza **`proxy.ts`** en la raíz (`export { auth as proxy } from '@/auth'`) en lugar de `middleware.ts`, siguiendo la convención de Next.js 16.
- Grupos de rutas en `app/`:
  - `app/(auth)/`: Páginas públicas de autenticación (`/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`).
  - `app/(app)/`: Espacio de trabajo autenticado con `AppSidebar` y `AppHeader`.
  - `app/onboard/`: Configuración inicial de sucursal cuando el usuario no tiene tienda activa.
  - `app/print/`: Vistas limpias optimizadas para impresión (tickets, corte Z, cotizaciones, etiquetas, estados de cuenta).
  - `app/api/`: Endpoints REST internos.

### 2.2 Multi-tenancy y Autorización (`lib/authz.ts`, `lib/api.ts`)
- Toda entidad de negocio está aislada por `shopId`.
- **En Server Components (`app/(app)/**/page.tsx`):**
  - `requirePageRole('MANAGER')` o `requirePagePermission('VIEW_REPORTS')` -> redirige automáticamente a `/login`, `/onboard` o `/dashboard` si falla.
- **En API Route Handlers (`app/api/**/route.ts`):**
  - `const { shopId, userId, role, permissions } = await requireRole('CASHIER')` o `requirePermission(...)`.
  - Envolver el handler en `try { ... } catch (error) { return apiErrorResponse(error, 'Mensaje'); }`:
    - `AuthenticationError` -> `401`
    - `AuthorizationError` -> `403`
    - `ShopContextError` -> `403` (acceso perdido) o `409` (sin tienda asignada)
    - Error inesperado -> `500`

### 2.3 Reglas de Datos y Serialización
1. **Serialización de `Prisma.Decimal` y `Date`:** Los campos monetarios y cantidades decimales son instancias de `Decimal`. Nunca pasar objetos `Decimal` crudos desde Server Components a Client Components; usar los serializadores en `lib/serializers/` (`dashboard.ts`, `register.ts`, `staff.ts`) o convertir explícitamente con `.toString()` / `.toISOString()`.
2. **Numeración secuencial segura:** Todo número de venta, recibo, compra, devolución, conteo o transferencia debe generarse **dentro de `prisma.$transaction`** usando `getNextDocumentNumber(tx, { shopId, type, prefix })` (`lib/document-sequence.ts`) sobre la tabla `DocumentSequence`.
3. **Idempotencia en ventas:** `POST /api/sales` acepta `clientRequestId` (único por `[shopId, clientRequestId]`) para garantizar que los reintentos de la cola offline no dupliquen ventas.
4. **Localización y moneda:** UI y textos de negocio en **español** (`es-MX` en `lib/format.ts`). Símbolo de moneda por defecto `₱` (configurable por sucursal en `ShopSetting.currencySymbol` y `currencyCode`).

---

## 3. Mapa Completo de API Routes (`app/api/**`)

| Dominio | Endpoints | Propósito principal |
| :--- | :--- | :--- |
| **Auth** | `GET/POST /api/auth/[...nextauth]`<br>`POST /api/auth/register`<br>`POST /api/auth/verify-email`<br>`POST /api/auth/resend-verification`<br>`POST /api/auth/request-password-reset`<br>`POST /api/auth/reset-password` | Autenticación NextAuth, registro, verificación de correo y recuperación de contraseña. |
| **Sucursales** | `POST /api/onboard`<br>`GET /api/user-shops`<br>`POST /api/user-shops/active` | Alta de primera sucursal, listado de membresías y cambio de sucursal activa. |
| **POS & Ventas** | `GET/POST /api/sales`<br>`GET /api/sales/[id]`<br>`POST /api/sales/[id]/void`<br>`POST /api/sales/[id]/refund` | Creación idempotente de ventas, consulta, anulación y reembolsos/cambios. |
| **Carritos / Cotiz.** | `GET/POST /api/parked-sales`<br>`GET/PATCH/DELETE /api/parked-sales/[id]`<br>`POST /api/parked-sales/[id]/resume` | Guardar carritos o cotizaciones, consultar/cancelar y reanudar en caja. |
| **Caja** | `GET/POST /api/register/sessions`<br>`POST /api/register/sessions/[id]/close`<br>`POST /api/register/sessions/[id]/movements`<br>`POST /api/register/sessions/[id]/review`<br>`POST /api/register/sessions/[id]/reopen` | Apertura, movimientos de efectivo, cierre con arqueo, revisión y reapertura de caja. |
| **Catálogo** | `GET/POST /api/products`<br>`GET/PATCH/DELETE /api/products/[id]`<br>`GET/POST /api/products/[id]/batches`<br>`GET/POST /api/categories`<br>`PATCH/DELETE /api/categories/[id]`<br>`POST /api/uploads/products` | CRUD de productos, variantes, UOM, lotes, categorías y carga de imágenes. |
| **Inventario** | `POST /api/inventory/adjust`<br>`GET /api/inventory/adjustments`<br>`GET /api/inventory/export`<br>`GET/POST /api/stock-counts`<br>`GET/PATCH /api/stock-counts/[id]`<br>`GET/POST /api/transfers`<br>`GET/PATCH /api/transfers/[id]` | Ajustes manuales, historial, exportación, conteos físicos y transferencias entre sucursales. |
| **Compras y Prov.** | `GET/POST /api/suppliers`, `PATCH /api/suppliers/[id]`<br>`GET/POST /api/suppliers/returns`, `GET/PATCH /api/suppliers/returns/[id]`<br>`GET/POST /api/purchases`, `GET/PATCH /api/purchases/[id]` | Proveedores, órdenes de compra, recepciones, devoluciones a proveedor y facturas/pagos. |
| **Clientes** | `GET/POST /api/customers`<br>`GET/PATCH /api/customers/[id]` | Gestión de clientes y cobros de cuenta corriente. |
| **Personal y Config.** | `GET/POST /api/staff`, `GET/PATCH /api/staff/[id]`<br>`POST /api/staff/[id]/pin`, `POST /api/staff/[id]/reset-password`<br>`GET/PATCH /api/settings` | Gestión de empleados, permisos, PIN, reseteo de clave y configuración de sucursal. |
| **Reportes y Sistema** | `GET /api/reports/summary`<br>`GET /api/notifications`, `PATCH /api/notifications/[id]`<br>`POST /api/worker/run-now`, `POST /api/cron/worker` | Resúmenes analíticos, notificaciones y disparo manual/cron del worker. |

---

## 4. Integraciones de Hardware y Entorno

1. **Balanza Comercial Systel (`lib/scale/systel-protocol.ts`, `lib/scale/web-scale-connection.ts`):**
   - Comunicación mediante **Web Serial API** del navegador (`9600 bps`, `8` bits de datos, `1` bit de parada, sin paridad).
   - Soporta comandos `ENQ` (`0x05`) y petición `'P'` (`0x50`), interpretando tramas `STX`/`ETX` o líneas `CR`/`LF` con detección de estabilidad (`ST`/`US`), peso en kg/gramos y tara negativa.
2. **Cajón de Efectivo (`lib/cash-drawer.ts`):**
   - Prioridad 1: Bridge de ventana (`window.VertexPOS.openCashDrawer` o `window.__VERTEX_POS_BRIDGE__.openCashDrawer`).
   - Prioridad 2: Bridge HTTP local (`NEXT_PUBLIC_CASH_DRAWER_BRIDGE_URL` + `NEXT_PUBLIC_CASH_DRAWER_BRIDGE_TOKEN`).
   - Prioridad 3: Fallback del navegador emitiendo `CustomEvent('vertex-pos:cash-drawer-kick')`.
3. **Impresión Térmica:**
   - Rutas dedicadas en `app/print/*` con soporte para anchos `80mm` y `58mm`, modo seguro de impresora (`printerSafeMode`) y marca opcional (`receiptShowBrandMark`).
4. **Worker en Segundo Plano (`worker/index.ts`):**
   - Ejecuta trabajos `LOW_STOCK_SCAN` y `DAILY_SUMMARY` sobre la cola `WorkerJob`.

---

## 5. Secuencia de Verificación Obligatoria (CI)

Antes de dar por cerrado cualquier cambio en el código, ejecutar en este orden exacto:
```bash
npm run prisma:generate   # 1. Regenerar Prisma Client si cambió el schema o en entorno limpio
npm run lint              # 2. ESLint 9 flat config
npm run typecheck         # 3. tsc --noEmit (valida código de aplicación; excluye tests/)
npm test                  # 4. Vitest run (TZ=Asia/Manila fijada en tests/setup/env.ts)
```
