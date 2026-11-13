# 06. Plan de Implementación (Secuencia de Construcción)

Este documento define el **orden exacto paso a paso** en el que se construye y evoluciona el sistema, respetando las dependencias técnicas entre capas (base de datos -> autenticación -> configuración/catálogo -> POS/caja -> post-venta/clientes -> compras/inventario -> reportes/worker -> tests/despliegue).

---

## Fase 0: Base del Proyecto y Esquema de Datos
1. **Inicializar proyecto Next.js 16 + TypeScript + Tailwind CSS v4:**
   - Configurar `tsconfig.json` (alias `@/*`, exclusión de `tests/`), `app/globals.css` (`@import "tailwindcss";` y escalas POS) y `app/layout.tsx` (`Geist` + `Geist_Mono`, `lang="es"`).
2. **Definir esquema de base de datos (`prisma/schema.prisma`):**
   - Configurar `postgresql`, todos los `enum` de dominio y los modelos multi-tenant con `shopId`.
   - Crear cliente singleton en `lib/prisma.ts` y utilidades base (`lib/api.ts`, `lib/format.ts`, `lib/slug.ts`, `lib/document-sequence.ts`).
3. **Script de semilla y bootstrap:**
   - Implementar `prisma/seed.ts` (tiendas, categorías, productos, cuentas `owner@vertexpos.local`, `manager@vertexpos.local`, `cashier@vertexpos.local`) y `prisma/bootstrap-admin.ts`.
   - **Verificación:** `npm run prisma:generate` y `npm run typecheck`.

## Fase 1: Autenticación, Multi-Tenancy y Layout Base
1. **Autenticación (`auth.ts`, `proxy.ts`, `lib/auth/*`):**
   - Configurar NextAuth v5 (`Credentials`, JWT), hashing `bcryptjs`, bloqueo tras 5 intentos fallidos, verificación de email y tokens de reseteo de clave.
   - Registrar eventos en `AuthAuditLog` (`lib/auth/audit.ts`).
2. **Autorización multi-sucursal (`lib/auth/get-active-shop.ts`, `lib/authz.ts`, `lib/permissions.ts`):**
   - Implementar `requireRole`, `requirePermission`, `requirePageRole`, `requirePagePermission` y la matriz de 7 permisos granulares.
3. **Pantallas públicas, Auth y Onboarding:**
   - Construir `app/page.tsx`, `app/(auth)/*` (`/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`), `app/onboard/page.tsx` y endpoints `/api/auth/*`, `/api/onboard`, `/api/user-shops/*`.
4. **Shell del Workspace y UI Kit:**
   - Crear `components/ui/*` (`Card`, `Button`, `Input`, `Badge`) y `components/layout/*` (`AppSidebar` con filtrado por rol y cambio de sucursal, `AppHeader`, `CommandPalette`, `NotificationsBell`).

## Fase 2: Configuración de Sucursal y Catálogo
1. **Configuración (`app/(app)/settings`, `/api/settings`, `lib/shop-settings.ts`):**
   - Moneda, zona horaria, modo e tasa de impuestos, métodos de pago, denominaciones de efectivo, impresora y prefijos de documentos.
2. **Categorías y Unidades de Medida (`app/(app)/categories`, `/api/categories`, `lib/uom.ts`):**
   - Árbol de categorías y UOM base por tienda.
3. **Productos, Variantes, Imágenes y Lotes (`app/(app)/products`, `/api/products`, `/api/uploads/products`, `lib/product-images.ts`):**
   - CRUD de productos, variantes, conversiones UOM, historial de precios/costos, compresión de imágenes en cliente y etiquetas (`/print/barcode-labels`).

## Fase 3: Control de Caja, Punto de Venta, Balanza y Offline
1. **Control de Caja (`app/(app)/register/*`, `/api/register/sessions/*`, `lib/register.ts`, `lib/serializers/register.ts`):**
   - Apertura de turno, movimientos de efectivo (`CashMovement`), cierre con arqueo por denominaciones, revisión/reapertura y Corte Z (`/print/register-z-read/[id]`).
2. **Motor POS (`/checkout`, `/api/sales`, `lib/payments.ts`, `lib/pos-stock.ts`):**
   - Carrito (`PosCartTable`), búsqueda de productos (`ProductSearchModal`), cálculo de impuestos/descuentos, cobro simple/dividido/crédito (`PaymentModal`) y transacción atómica con `DocumentSequence`.
3. **Balanza Systel y Hardware:**
   - Implementar protocolo serie (`lib/scale/systel-protocol.ts`, `lib/scale/web-scale-connection.ts`) y `WeighProductModal`.
   - Implementar apertura de cajón (`lib/cash-drawer.ts`) y vista previa/impresión térmica (`ReceiptPreviewModal`, `ThermalReceipt`, `/print/receipt/[id]`).
4. **Carritos Guardados y Modo Offline:**
   - Implementar `ParkedSale` (`/parked-sales`, `/api/parked-sales/*`, `/print/quote/[id]`) y cola offline idempotente en `localStorage` (`lib/offline-checkout.ts`).

## Fase 4: Post-Venta, Clientes y Cuentas por Cobrar
1. **Historial y Detalle de Ventas (`app/(app)/sales/*`):**
   - Listado, detalle (`/sales/[id]`), reimpresión de recibo.
2. **Anulaciones, Reembolsos y Cambios (`/sales/[id]/void`, `/sales/[id]/refund`, `/returns`, `lib/sale-adjustments.ts`):**
   - Flujo completo de `SaleAdjustment`, restitución/descarte de stock, venta de reemplazo y comprobante `/print/refund/[id]`.
3. **Clientes y Cuenta Corriente (`app/(app)/customers`, `/api/customers/*`, `lib/customers.ts`, `lib/customer-operations.ts`):**
   - Directorio de clientes, `CustomerCreditLedger`, cobranzas (`ReceivablePayment`) y estado de cuenta (`/print/customer-statement/[id]`).

## Fase 5: Inventario, Conteos, Transferencias y Compras
1. **Inventario y Lotes (`app/(app)/inventory`, `/api/inventory/*`, `lib/inventory.ts`, `lib/inventory-reasons.ts`):**
   - Ajustes manuales, Kardex (`InventoryMovement`), gestión de lotes (`ProductBatchManager`) y exportación.
2. **Conteos Físicos (`app/(app)/stock-counts/*`, `/api/stock-counts/*`, `lib/stock-counts.ts`):**
   - Flujo `DRAFT` -> `IN_PROGRESS` -> `SUBMITTED` -> `APPROVED` -> `POSTED` (incluyendo conteos ciegos).
3. **Transferencias entre Sucursales (`app/(app)/transfers`, `/api/transfers/*`, `lib/stock-transfers.ts`):**
   - Envío y recepción entre `fromShopId` y `toShopId`.
4. **Proveedores, Compras y Cuentas por Pagar (`app/(app)/suppliers`, `app/(app)/purchases`, `/api/suppliers/*`, `/api/purchases/*`):**
   - Órdenes de compra, recepciones parciales/totales, devoluciones a proveedor, facturas y pagos (`AccountsPayableEntry`).

## Fase 6: Dashboard, Reportes, Personal, Auditoría y Worker
1. **Dashboard y Reportes (`app/(app)/dashboard`, `app/(app)/reports/*`, `lib/reporting.ts`, `lib/owner-analytics.ts`, `lib/serializers/dashboard.ts`):**
   - KPIs en vivo, reportes de ventas, ganancias, inventario y cajeros.
2. **Personal y Auditoría (`app/(app)/staff/*`, `app/(app)/activity`, `lib/staff.ts`, `lib/activity.ts`):**
   - Alta de staff, permisos personalizados, PIN, reseteo de clave y visor de `ActivityLog`.
3. **Worker en Segundo Plano (`worker/index.ts`, `lib/worker.ts`, `/api/worker/run-now`, `/api/cron/worker`):**
   - Escaneo diario de stock bajo (`LOW_STOCK_SCAN`) y resumen diario (`DAILY_SUMMARY`) generando `Notification`.

## Fase 7: Verificación, Tests y Despliegue
1. **Suite de Pruebas (`tests/lib/*`, `tests/routes/*`):**
   - Tests unitarios y de rutas con Vitest mockeando Prisma, Email y Audit.
2. **Pipeline de Verificación Local / CI:**
   - Ejecutar `npm run prisma:generate && npm run lint && npm run typecheck && npm test`.
3. **Despliegue:**
   - Build de producción (`npm run build`), migraciones (`npm run prisma:deploy`), Docker (`Dockerfile`, `docker-compose.yml`) o servidor Ubuntu (`instalacion-ubuntu-server.md`, `install.sh`, `update.sh`).
