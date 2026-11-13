# 01. Documento de Requisitos de Producto (PRD)

**Producto:** Fiambrería Costanera POS (`vertex-pos`)  
**Versión de referencia:** `2.0.0`  
**Idioma de la interfaz:** Español (`es-MX` / `es`)

---

## 1. Resumen de la idea general

**Fiambrería Costanera POS** es un sistema integral de **Punto de Venta (POS), gestión de inventario, compras, cuentas corrientes, control de caja y analítica operativa** diseñado para comercios minoristas y especialmente optimizado para **fiambrerías y almacenes** (soporte nativo para venta por peso con balanzas comerciales Systel, lotes, vencimientos FEFO, variantes y unidades de medida).

El sistema opera bajo un modelo **multi-sucursal (multi-tenant)** donde un mismo propietario o empleado puede pertenecer a una o varias sucursales (`Shop`), cada una con su propio catálogo, stock, caja, configuración fiscal, numeración de comprobantes y reglas operativas.

### Propuesta de valor
1. **Cobro rápido y resiliente:** Interfaz POS pensada para mostrador y tablets de alta resolución, con búsqueda por código de barras, pesaje directo desde balanza por puerto serie, carritos retenidos/cotizaciones y cola de ventas **offline** idempotente.
2. **Control estricto de dinero y mercadería:** Apertura y cierre de caja con arqueo por denominaciones y corte Z imprimible; movimientos de inventario auditados; conteos físicos (ciegos o asistidos); y trazabilidad completa de anulaciones, reembolsos y cambios.
3. **Ciclo comercial completo:** Desde la orden de compra a proveedores, recepción parcial/total, facturas y cuentas por pagar, hasta la venta al cliente, cuenta corriente (fiado/crédito) y cobranzas.

---

## 2. Usuarios, roles y permisos

El acceso a cada sucursal se controla mediante la membresía `UserShop` con **3 roles jerárquicos** y **7 permisos granulares** personalizables por usuario (`customPermissions`).

### Jerarquía de roles
| Rol | Nivel | Perfil operativo |
| :--- | :---: | :--- |
| **`ADMIN`** | 3 | Propietario o administrador general. Acceso total: reportes financieros, gestión de personal, configuración, inventario y operaciones. |
| **`MANAGER`** | 2 | Encargado de sucursal. Gestiona catálogo, clientes, proveedores, compras, inventario, transferencias, actividad y configuración operativa. |
| **`CASHIER`** | 1 | Cajero de mostrador. Opera el POS, abre/cierra su caja, consulta ventas, carritos guardados, conteos asignados y devoluciones permitidas. |

### Permisos granulares (`lib/permissions.ts`)
| Clave | Etiqueta en UI | Rol por defecto | Qué habilita |
| :--- | :--- | :--- | :--- |
| `VIEW_REPORTS` | Ver reportes | `ADMIN`, `MANAGER` | Acceso a `/reports` y analítica del propietario. |
| `EDIT_PRODUCTS` | Editar productos | `ADMIN`, `MANAGER` | Crear, editar, archivar y restaurar productos. |
| `VOID_SALES` | Anular ventas | `ADMIN`, `MANAGER`, `CASHIER` | Iniciar anulaciones de ventas (`/sales/[id]/void`). |
| `REFUND_SALES` | Reembolsar ventas | `ADMIN`, `MANAGER`, `CASHIER` | Iniciar reembolsos y cambios (`/sales/[id]/refund`). |
| `ADJUST_INVENTORY` | Ajustar inventario | `ADMIN`, `MANAGER` | Registrar ajustes manuales en `/inventory`. |
| `VIEW_PURCHASE_COSTS` | Ver costos de compra | `ADMIN`, `MANAGER` | Visualizar costos de compra y márgenes. |
| `MANAGE_STAFF` | Gestionar personal | `ADMIN` | Crear empleados, asignar roles, PIN y reseteo de clave. |

---

## 3. Catálogo exacto de funcionalidades construidas

### 3.1 Autenticación, Onboarding y Multi-sucursal
- Inicio de sesión con correo y contraseña (`NextAuth v5` / Credentials), bloqueo automático de **15 minutos tras 5 intentos fallidos**, verificación de correo obligatoria (`emailVerifiedAt`) y soporte para reseteo forzado (`forcePasswordReset`).
- Flujo de registro (`/signup`), verificación de correo (`/verify-email`), recuperación y restablecimiento de contraseña (`/forgot-password`, `/reset-password`).
- **Onboarding (`/onboard`):** Creación guiada de la primera sucursal con datos del negocio, moneda, impuestos y configuración inicial.
- **Selector de sucursal activa:** Cambio rápido de sucursal desde la barra lateral (`POST /api/user-shops/active`).
- Auditoría de seguridad (`AuthAuditLog`) para logins exitosos, fallidos, bloqueos y cierres de sesión.

### 3.2 Punto de Venta (`/checkout`)
- **Búsqueda instantánea:** Por nombre, SKU o escaneo de código de barras (producto o variante).
- **Integración con balanza Systel (Web Serial API):** Lectura en vivo por puerto serie (`9600 8N1`) para productos pesables mediante `WeighProductModal`, detectando peso estable, tara/cero y conversión automática a gramos/kg.
- **Gestión de carrito:** Modificación de cantidades, selección de variantes (tamaño, color, sabor, modelo), descuentos y notas.
- **Carritos guardados y cotizaciones (`/parked-sales`):** Retener una venta en curso (`SAVED_CART`) o emitir una cotización imprimible (`QUOTE`) con fecha de vencimiento (`/print/quote/[id]`) y reanudarla en caja (`POST /api/parked-sales/[id]/resume`).
- **Cobro múltiple (`PaymentModal`):** Soporte para `Efectivo`, `Tarjeta`, `Billetera virtual`, `Transferencia bancaria`, **pago dividido (Split)** y **venta a crédito / cuenta corriente** (`isCreditSale` con fecha de vencimiento). Cálculo automático de vuelto.
- **Modo Offline Idempotente (`lib/offline-checkout.ts`):** Guardado de borradores y cola de ventas en `localStorage` cuando no hay conexión; reenvío automático a `/api/sales` usando `clientRequestId` para evitar duplicados, con detección de conflictos (stock insuficiente, cambio de precio, producto inactivo).
- **Impresión y hardware:** Vista previa de ticket térmico (`80mm` / `58mm`), impresión directa (`/print/receipt/[id]`) y apertura automática de **cajón de efectivo** (`lib/cash-drawer.ts` vía bridge de ventana, bridge HTTP o evento `CustomEvent`).
- **Escalado de pantalla POS:** Modos `normal`, `large` (112%) y `xlarge` (125%) pensados para tablets de alta resolución.

### 3.3 Control de Caja (`/register/*`)
- **Apertura de caja (`/register/open`):** Registro de sesión (`CashSession`) con fondo inicial (`openingFloat`) obligatorio u opcional según `ShopSetting`.
- **Movimientos de caja:** Registro de retiros (`CASH_DROP`), pagos/egresos (`PAYOUT`), caja chica (`PETTY_CASH`) y correcciones manuales (`MANUAL_CORRECTION`).
- **Cierre de caja (`/register/close`):** Arqueo detallado por denominaciones (`denominationBreakdown`), comparación entre efectivo esperado (`closingExpected`) y real (`closingActual`), cálculo de diferencia/variación (`variance`).
- **Revisión, reapertura e historial (`/register/history`):** Aprobación/revisión por supervisor, reapertura justificada de sesiones cerradas y emisión de **Corte Z** imprimible (`/print/register-z-read/[id]`).

### 3.4 Ventas y Post-Venta (`/sales`, `/returns`)
- Historial de ventas con filtros, detalle completo (`/sales/[id]`), reimpresión de recibo (`/sales/[id]/receipt`).
- **Anulación (`/sales/[id]/void`):** Reversión de venta completada con motivo obligatorio, restitución de stock y registro de `SaleAdjustment` (`VOID`).
- **Reembolsos y cambios (`/sales/[id]/refund`):** Devolución parcial o total de ítems con disposición (`RESTOCK`, `DAMAGED`, `EXCHANGE`), generación de nueva venta de cambio vinculada (`exchangeSaleId`), pagos de reembolso (`RefundPayment`) y comprobante imprimible (`/print/refund/[id]`).

### 3.5 Catálogo, Variantes, UOM y Etiquetas (`/products`, `/categories`)
- **Categorías jerárquicas:** Árbol padre/hijo con slug único por sucursal.
- **Productos:** Precio, costo, SKU, código de barras, punto de reposición (`reorderPoint`), imágenes con compresión en cliente (`/api/uploads/products`), e historial automático de cambios de precio (`ProductPriceHistory`) y costo (`ProductCostHistory`).
- **Variantes:** Atributos (`color`, `size`, `flavor`, `model`), SKU/código de barras propio y sobrescritura de precio/costo.
- **Unidades de medida (UOM):** Unidad base por producto y factores de conversión para compras/ventas (`ProductUomConversion`).
- **Etiquetas de código de barras:** Generación e impresión en `/print/barcode-labels`.

### 3.6 Inventario, Lotes, Conteos y Transferencias (`/inventory`, `/stock-counts`, `/transfers`)
- **Kardex / Movimientos de inventario:** Trazabilidad completa de entradas y salidas (`PURCHASE_RECEIVED`, `SALE_COMPLETED`, `SALE_VOIDED`, `RETURN_RESTOCKED`, `STOCK_COUNT_POSTED`, `MANUAL_ADJUSTMENT`, `TRANSFER_OUT`, `TRANSFER_IN`, etc.) con motivos configurables (`InventoryReason`) y exportación CSV/reporte (`/api/inventory/export`).
- **Lotes y vencimientos (`ProductBatch`):** Control por número de lote, fecha de vencimiento y soporte para lógica FEFO (`fefoEnabled`) y alertas de vencimiento (`expiryAlertDays`).
- **Conteos físicos (`/stock-counts`):** Flujo formal `DRAFT` -> `IN_PROGRESS` -> `SUBMITTED` -> `APPROVED` -> `POSTED` (incluyendo **conteos ciegos** `isBlind`) con cálculo de variaciones y ajuste automático al publicar.
- **Transferencias entre sucursales (`/transfers`):** Envío de mercadería desde una sucursal origen a una destino (`DRAFT` -> `IN_TRANSIT` -> `RECEIVED` / `CANCELLED`) descontando en origen y sumando en destino.

### 3.7 Proveedores, Compras y Cuentas por Pagar (`/suppliers`, `/purchases`)
- Directorio de proveedores con contacto, notas y estado activo.
- **Órdenes de compra (`PurchaseOrder`):** Estados `DRAFT` -> `SENT` -> `PARTIALLY_RECEIVED` -> `FULLY_RECEIVED` -> `CLOSED` / `CANCELLED`, con soporte de unidades de compra convertibles a unidad base.
- **Recepciones (`PurchaseReceipt`):** Recepción total o parcial por ítem incrementando stock.
- **Facturación y pagos (`SupplierInvoice`, `SupplierPayment`, `AccountsPayableEntry`):** Control de vencimientos y saldos pendientes a proveedores.
- **Devoluciones a proveedor (`SupplierReturn`):** Gestión de mercadería dañada, vencida o errónea con seguimiento de notas de crédito (`SupplierCreditMemoStatus`).

### 3.8 Clientes y Cuentas por Cobrar (`/customers`)
- Registro de clientes individuales (`INDIVIDUAL`) y empresas (`BUSINESS`) con datos fiscales (`taxId`), contacto y notas.
- **Cuenta corriente (`CustomerCreditLedger`, `ReceivablePayment`):** Registro de ventas a crédito, seguimiento de vencimientos (`OPEN`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`), cobros parciales/totales y estado de cuenta imprimible (`/print/customer-statement/[id]`).

### 3.9 Reportes, Auditoría, Personal, Configuración y Worker
- **Dashboard (`/dashboard`):** KPIs en vivo, ventas recientes, alertas de bajo stock y panel analítico para propietarios (`OwnerAnalyticsPanel`).
- **Reportes (`/reports`):** Vistas especializadas de **Ventas** (`/reports/sales`), **Ganancias** (`/reports/profit`), **Inventario** (`/reports/inventory`) y **Cajeros** (`/reports/cashier`).
- **Personal (`/staff`):** Alta de empleados, asignación de rol y permisos personalizados, configuración de PIN de staff (`/api/staff/[id]/pin`) y reseteo de contraseña.
- **Auditoría y notificaciones (`/activity`, `NotificationsBell`):** Registro inmutable de acciones (`ActivityLog`) y campana de alertas.
- **Configuración (`/settings`):** Moneda, zona horaria, modo e tasa de impuestos (`EXCLUSIVE`, `INCLUSIVE`, `NON_TAXABLE`), métodos de pago, denominaciones de efectivo, encabezado/pie y ancho de ticket, impresora, balanza/escáner, umbrales de stock bajo, lotes/vencimientos, políticas offline y prefijos de numeración.
- **Worker en segundo plano (`worker/index.ts`):** Ejecución periódica o bajo demanda (`/api/worker/run-now`, `/api/cron/worker`) para escaneo de stock bajo (`LOW_STOCK_SCAN`) y generación de resumen diario (`DAILY_SUMMARY`).
