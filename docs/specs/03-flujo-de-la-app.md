# 03. Flujo de la App

Este documento mapea las fases de uso del sistema, la navegación según el rol del usuario y qué ocurre exactamente al pulsar cada botón o completar una acción, indicando qué pantalla o modal sigue.

---

## 1. Fases del Sistema y Enrutamiento Inicial

```
Usuario ingresa a "/"
  ├── Sesión activa? ──NO──▶ Landing ("/") ──[Iniciar sesión]──▶ "/login"
  │
  └── SÍ ──▶ Redirect a "/dashboard"
               ├── ¿Tiene sucursal activa (UserShop)? ──NO──▶ "/onboard"
               └── SÍ ──▶ Workspace autenticado ("/(app)/*")
```

### Fases operativas del día a día
1. **Fase 1 — Acceso y Contexto:** Login (`/login`), verificación de correo si aplica (`/verify-email`), creación/selección de sucursal (`/onboard` o selector del sidebar).
2. **Fase 2 — Apertura de Turno:** Abrir caja (`/register/open`) declarando el fondo inicial.
3. **Fase 3 — Operación en Mostrador (POS):** Vender en `/checkout`, pesar en balanza Systel, retener carritos/cotizaciones en `/parked-sales`, cobrar y entregar recibo.
4. **Fase 4 — Gestión de Backoffice (Manager/Admin):** Cargar productos/categorías, registrar compras a proveedores, ajustar inventario, realizar conteos y transferencias, gestionar clientes y personal.
5. **Fase 5 — Cierre y Control:** Cerrar caja (`/register/close`) con arqueo de billetes, emitir Corte Z, revisar reportes (`/reports/*`) y auditoría (`/activity`).

---

## 2. Mapa de Navegación por Rol (`AppSidebar` + `CommandPalette`)

El menú lateral (`components/layout/AppSidebar.tsx`) filtra dinámicamente las secciones según `ROLE_WEIGHT` (`CASHIER: 1`, `MANAGER: 2`, `ADMIN: 3`) y `permissions`:

| Sección | Opción | Ruta | Rol mínimo / Permiso |
| :--- | :--- | :--- | :--- |
| **Resumen** | Panel | `/dashboard` | `CASHIER` |
| | Ventas | `/sales` | `CASHIER` |
| | Devoluciones | `/returns` | `CASHIER` |
| | Conteos de inventario | `/stock-counts` | `CASHIER` |
| **Operaciones** | Punto de venta | `/checkout` | `CASHIER` |
| | Carritos guardados | `/parked-sales` | `CASHIER` |
| | Abrir caja | `/register/open` | `CASHIER` |
| | Cerrar caja | `/register/close` | `CASHIER` |
| | Historial de caja | `/register/history` | `CASHIER` |
| | Inventario | `/inventory` | `MANAGER` + `ADJUST_INVENTORY` |
| | Transferencias | `/transfers` | `MANAGER` |
| | Compras | `/purchases` | `MANAGER` |
| | Actividad | `/activity` | `MANAGER` |
| | Personal | `/staff` | `ADMIN` + `MANAGE_STAFF` |
| **Catálogo** | Productos | `/products` | `MANAGER` |
| | Categorías | `/categories` | `MANAGER` |
| | Clientes | `/customers` | `MANAGER` |
| | Proveedores | `/suppliers` | `MANAGER` |
| **Espacio de trabajo** | Reportes | `/reports` | `ADMIN` + `VIEW_REPORTS` |
| | Configuración | `/settings` | `MANAGER` |

> **Atajo global:** La paleta de comandos (`CommandPalette` en `AppHeader`) permite saltar entre módulos sin usar el mouse.

---

## 3. Recorridos Detallados (Botón -> Acción -> Pantalla Siguiente)

### Flujo A: Autenticación, Registro y Recuperación
| Pantalla | Acción del usuario | Qué ocurre en el sistema | Resultado / Pantalla siguiente |
| :--- | :--- | :--- | :--- |
| **`/` (Landing)** | Pulsa **"Iniciar sesión"** | Navegación directa. | **`/login`** |
| **`/login`** | Completa email + clave y pulsa **"Iniciar sesión"** | `signIn('credentials')` valida en `auth.ts`: verifica bloqueo (`lockedUntil`), hash `bcryptjs`, `emailVerifiedAt` y `forcePasswordReset`. Si falla 5 veces, bloquea 15 min y registra `AuthAuditLog`. | Si es válido: **`/dashboard`** (o **`/onboard`** si no tiene tienda). Si falla: muestra alerta inline en `/login`. |
| **`/login`** | Pulsa **"Crear cuenta"** / enlace a registro | Navega al formulario de alta. | **`/signup`** |
| **`/signup`** | Envía registro | `POST /api/auth/register` crea `User` + `EmailVerificationToken` y envía email vía Nodemailer. | Mensaje de confirmación + enlace a **`/verify-email`**. |
| **`/verify-email`** | Ingresa/abre token y confirma | `POST /api/auth/verify-email` marca `emailVerifiedAt`. | Enlace/redirección a **`/login`**. |
| **`/login`** | Pulsa **"¿Olvidaste tu contraseña?"** | Navega a recuperación. | **`/forgot-password`** |
| **`/forgot-password`** | Ingresa email y pulsa **"Enviar enlace"** | `POST /api/auth/request-password-reset` genera token temporal y envía correo. | Confirmación en pantalla; el enlace del correo abre **`/reset-password?token=...`**. |
| **`/onboard`** | Completa nombre de tienda, tipo, moneda e impuesto y pulsa **"Crear tienda"** | `POST /api/onboard` crea `Shop`, `ShopSetting`, `UserShop` (`ADMIN`), `UnitOfMeasure` base y actualiza `defaultShopId`. | Redirige a **`/dashboard`**. |

### Flujo B: Apertura de Caja y Punto de Venta (`/register/open` -> `/checkout`)
| Pantalla / Modal | Acción del usuario | Qué ocurre en el sistema | Resultado / Pantalla siguiente |
| :--- | :--- | :--- | :--- |
| **`/register/open`** | Ingresa fondo inicial y pulsa **"Abrir caja"** | `POST /api/register/sessions` valida que no haya otra sesión `OPEN` del usuario y crea `CashSession`. | Redirige a **`/checkout`** (o habilita el cobro en POS). |
| **`/checkout`** | Escanea código de barras o escribe en buscador | Busca coincidencia exacta por SKU/código de barras (producto o variante). Si es único, agrega al carrito; si hay varios o pulsa buscar, abre modal. | Agrega línea a `PosCartTable` o abre **`ProductSearchModal`**. |
| **`/checkout`** | Selecciona un producto pesable / pulsa **"Pesar"** | Abre el modal de balanza conectado vía Web Serial (`lib/scale/web-scale-connection.ts`). | **`WeighProductModal`**: lee peso en vivo (`weightKg` / `weightGrams`), espera estabilidad y al pulsar **"Agregar peso"** inserta la cantidad en el carrito. |
| **`/checkout`** | Pulsa **"Cliente"** en `PosHeader` | Permite buscar o seleccionar un cliente registrado para asociar la venta o habilitar crédito. | **`CustomerSearchModal`** -> vuelve a **`/checkout`** con cliente asignado. |
| **`/checkout`** | Pulsa **"Guardar carrito"** o **"Cotización"** | `POST /api/parked-sales` guarda `ParkedSale` (`SAVED_CART` o `QUOTE`) con expiración y limpia el carrito actual. | Permanece en **`/checkout`** limpio; cotización imprimible en **`/print/quote/[id]`**. |
| **`/parked-sales`** | Pulsa **"Reanudar"** en un carrito retenido | `POST /api/parked-sales/[id]/resume` marca `RESUMED` y carga los ítems en el POS. | Redirige a **`/checkout`** con el carrito restaurado. |
| **`/checkout`** | Pulsa **"Cobrar"** | Abre el modal de pago con el total calculado (subtotal, impuestos según `TaxMode`, descuentos). | **`PaymentModal`**. |
| **`PaymentModal`** | Elige método (`Efectivo`, `Tarjeta`, `Billetera`, `Transferencia`, `Split` o `Crédito`), ingresa monto/referencia y pulsa **"Confirmar venta"** | **Con conexión:** `POST /api/sales` ejecuta transacción atómica (genera `saleNumber` y `receiptNumber` con `DocumentSequence`, descuenta `stockQty`, crea `Sale`, `SaleItem`, `SalePayment`, `InventoryMovement` y `CustomerCreditLedger` si es crédito).<br>**Sin conexión:** guarda en cola `localStorage` (`lib/offline-checkout.ts`) con `clientRequestId` para sincronizar luego. | Abre **`ReceiptPreviewModal`** con opción de imprimir (**`/print/receipt/[id]`**) y disparar apertura de **cajón de efectivo** (`openCashDrawer`). Al cerrar el modal, vuelve a **`/checkout`** listo para el siguiente cliente. |

### Flujo C: Cierre de Caja y Corte Z (`/register/close` -> `/register/history`)
| Pantalla | Acción del usuario | Qué ocurre en el sistema | Resultado / Pantalla siguiente |
| :--- | :--- | :--- | :--- |
| **`/register/close`** | Registra un ingreso/egreso rápido (ej. retiro o caja chica) | `POST /api/register/sessions/[id]/movements` crea `CashMovement` y recalcula el efectivo esperado. | Actualiza el resumen en **`/register/close`**. |
| **`/register/close`** | Carga el conteo de billetes/monedas (`denominationBreakdown`) y pulsa **"Cerrar caja"** | `POST /api/register/sessions/[id]/close` compara `closingActual` vs `closingExpected`, calcula `variance` y cambia estado a `CLOSED`. | Muestra resultado del cierre y enlace a **`/print/register-z-read/[id]`** o **`/register/history`**. |
| **`/register/history`** | Supervisor pulsa **"Aprobar/Revisar"** o **"Reabrir"** | `POST /api/register/sessions/[id]/review` o `.../reopen` registra auditoría y motivo. | Actualiza estado en **`/register/history`**. |

### Flujo D: Post-Venta (Anulación, Reembolso y Cambio)
| Pantalla | Acción del usuario | Qué ocurre en el sistema | Resultado / Pantalla siguiente |
| :--- | :--- | :--- | :--- |
| **`/sales`** | Pulsa sobre una venta de la tabla | Navega al detalle de la transacción. | **`/sales/[id]`** |
| **`/sales/[id]`** | Pulsa **"Ver / Imprimir recibo"** | Abre vista de ticket. | **`/sales/[id]/receipt`** o **`/print/receipt/[id]`** |
| **`/sales/[id]`** | Pulsa **"Anular venta"** (requiere `VOID_SALES`) | Navega a confirmación de anulación. | **`/sales/[id]/void`** |
| **`/sales/[id]/void`** | Ingresa motivo y pulsa **"Confirmar anulación"** | `POST /api/sales/[id]/void` marca `Sale.status = VOIDED`, restituye inventario (`SALE_VOIDED`) y crea `SaleAdjustment`. | Redirige a **`/sales/[id]`** (o **`/returns`**). |
| **`/sales/[id]`** | Pulsa **"Reembolsar / Cambiar"** (requiere `REFUND_SALES`) | Abre asistente de devolución parcial/total o cambio. | **`/sales/[id]/refund`** |
| **`/sales/[id]/refund`** | Selecciona ítems, disposición (`RESTOCK`/`DAMAGED`/`EXCHANGE`), método de reembolso y confirma | `POST /api/sales/[id]/refund` crea `SaleAdjustment`, `RefundPayment`, movimientos de stock y venta de cambio si aplica. | Muestra comprobante imprimible en **`/print/refund/[id]`**. |

### Flujo E: Reposición, Conteos y Transferencias
| Módulo | Secuencia de acciones y pantallas |
| :--- | :--- |
| **Compras (`/purchases`)** | 1. **"Nueva compra"** -> selecciona proveedor (`QuickSupplierModal` si es nuevo) y productos con UOM (`PurchaseProductPicker`) -> `POST /api/purchases` (`DRAFT`/`SENT`).<br>2. **"Recibir mercadería"** -> ingresa cantidades recibidas -> `PATCH /api/purchases/[id]` crea `PurchaseReceipt`, suma `stockQty` y genera `InventoryMovement` (`PURCHASE_RECEIVED`).<br>3. Registra factura de proveedor y pagos (`SupplierInvoice`, `SupplierPayment`). |
| **Conteos (`/stock-counts`)** | 1. **"Nuevo conteo"** (normal o ciego `isBlind`) -> **`/stock-counts/[id]`**.<br>2. Carga cantidades contadas -> **"Enviar"** (`SUBMITTED`) -> **"Aprobar"** (`APPROVED`) -> **"Publicar"** (`POSTED`), ajustando el stock con `STOCK_COUNT_POSTED`. |
| **Transferencias (`/transfers`)** | 1. **"Nueva transferencia"** (sucursal origen -> sucursal destino) -> `POST /api/transfers` (`DRAFT`).<br>2. **"Enviar"** -> pasa a `IN_TRANSIT` y descuenta stock en origen (`TRANSFER_OUT`).<br>3. En sucursal destino, **"Recibir"** -> pasa a `RECEIVED` y suma stock en destino (`TRANSFER_IN`). |
