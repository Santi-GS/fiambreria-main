# 05. Esquema del Backend y Modelo de Datos

Este documento describe cómo se autentican los usuarios, cómo se resuelve el contexto multi-sucursal y cómo se organizan todas las tablas, columnas clave y relaciones en PostgreSQL mediante Prisma (`prisma/schema.prisma`).

---

## 1. Flujo de Autenticación y Autorización

```
[Cliente /login]
   │ POST credentials (email, password)
   ▼
[auth.ts -> Credentials.authorize]
   ├─ 1. Valida formato con Zod (loginSchema)
   ├─ 2. Busca User por email + memberships activas (UserShop)
   ├─ 3. ¿lockedUntil > now? ──SÍ──▶ Log LOGIN_BLOCKED_LOCKED -> Deniega
   ├─ 4. verifyPassword() (bcryptjs)
   │     └─ Inválida: incrementa failedLoginAttempts; si >= 5, bloquea 15 min
   ├─ 5. ¿emailVerifiedAt == null? ──SÍ──▶ Log LOGIN_BLOCKED_UNVERIFIED -> Deniega
   ├─ 6. ¿forcePasswordReset == true? ──SÍ──▶ Log LOGIN_BLOCKED_PASSWORD_RESET_REQUIRED -> Deniega
   └─ 7. Resetea intentos, actualiza lastLoginAt, emite JWT (sub, role, defaultShopId)
   │
   ▼
[proxy.ts + lib/auth/get-active-shop.ts + lib/authz.ts]
   ├─ proxy.ts protege rutas privadas (públicas: /, /login, /verify-email, /reset-password, /api/auth/*)
   ├─ resolveActiveShopContext() resuelve la sucursal activa (User.defaultShopId o primera UserShop activa)
   ├─ Calcula permisos efectivos: customPermissions ?? DEFAULT_ROLE_PERMISSIONS[role]
   └─ requireRole() / requirePermission() / requirePageRole() aplican el control de acceso
```

---

## 2. Tablas por Dominio (42 modelos en `prisma/schema.prisma`)

### 2.1 Identidad, Seguridad y Multi-Sucursal
| Tabla | Columnas clave | Relaciones y restricciones |
| :--- | :--- | :--- |
| **`User`** | `id` (cuid), `email` (unique), `name`, `passwordHash`, `failedLoginAttempts`, `lockedUntil`, `emailVerifiedAt`, `forcePasswordReset`, `lastLoginAt`, `defaultShopId` | `defaultShop` (`Shop`), `ownedShops`, `memberships` (`UserShop`), ventas, sesiones de caja y auditorías. |
| **`Shop`** | `id`, `name`, `legalBusinessName`, `slug` (unique), `posType` (`ShopType`), `phone`, `email`, `address`, `taxId`, `ownerId` | Pertenece a `owner` (`User`). Centraliza el `shopId` de todas las entidades operativas. |
| **`UserShop`** | `id`, `userId`, `shopId`, `role` (`ShopRole`), `customPermissions` (Json), `isActive`, `assignedAt`, `disabledAt`, `staffPinHash`, `pinSetAt` | `@@unique([userId, shopId])`. Une usuarios con sucursales y define su rol/permisos. |
| **`EmailVerificationToken`** | `id`, `userId`, `tokenHash` (unique), `expiresAt`, `usedAt` | Pertenece a `User` (`onDelete: Cascade`). |
| **`PasswordResetToken`** | `id`, `userId`, `shopId`, `createdById`, `tokenHash` (unique), `expiresAt`, `usedAt` | Pertenece a `User` (`PasswordResetTokenUser`), opcionalmente creado por un admin (`createdById`). |
| **`AuthAuditLog`** | `id`, `userId`, `shopId`, `action`, `email`, `ipAddress`, `userAgent`, `metadata` (Json), `createdAt` | Registro de seguridad de accesos y bloqueos. |
| **`ShopSetting`** | `id`, `shopId` (unique), `currencyCode`, `timezone`, `taxMode` (`TaxMode`), `currencySymbol`, `taxRate`, `defaultPaymentMethods`, `cashDenominations`, `receiptHeader`, `receiptFooter`, `receiptWidth`, `receiptShowBrandMark`, `printerSafeMode`, `printerName`, `printerConnection`, `cashDrawerKickEnabled`, `lowStockEnabled`, `lowStockThreshold`, `reorderSafetyStock`, `offlineStockStrict`, `offlineStockMaxAgeMinutes`, `openingFloatRequired`, `openingFloatAmount`, `batchTrackingEnabled`, `expiryTrackingEnabled`, `fefoEnabled`, `expiryAlertDays`, `salePrefix`, `receiptPrefix`, `purchasePrefix` | Configuración 1:1 con `Shop`. |

### 2.2 Catálogo, Unidades, Variantes y Lotes
| Tabla | Columnas clave | Relaciones y restricciones |
| :--- | :--- | :--- |
| **`Category`** | `id`, `shopId`, `parentId`, `name`, `slug`, `isActive` | Auto-relación `CategoryTree` (`parent`/`children`). `@@unique([shopId, slug])`, `@@unique([shopId, name])`. |
| **`UnitOfMeasure`** | `id`, `shopId`, `code`, `name`, `isBase`, `isActive` | `@@unique([shopId, code])`. Unidad base o alternativa por sucursal. |
| **`Product`** | `id`, `shopId`, `categoryId`, `baseUnitOfMeasureId`, `sku`, `barcode`, `name`, `description`, `cost` (Decimal 12,2), `price` (Decimal 12,2), `stockQty` (Int), `reorderPoint` (Int), `trackBatches`, `trackExpiry`, `isActive` | `@@unique([shopId, sku])`, `@@unique([shopId, barcode])`. Pertenece a `Shop`, `Category`, `UnitOfMeasure`. |
| **`ProductUomConversion`** | `id`, `productId`, `unitOfMeasureId`, `ratioToBase` (Int) | `@@unique([productId, unitOfMeasureId])`. |
| **`ProductVariant`** | `id`, `productId`, `color`, `size`, `flavor`, `model`, `sku`, `barcode`, `priceOverride`, `costOverride`, `isActive` | `@@unique([productId, sku])`, `@@unique([productId, barcode])`. |
| **`ProductBatch`** | `id`, `shopId`, `productId`, `lotNumber`, `expiryDate`, `quantity`, `receivedAt`, `notes` | `@@unique([productId, lotNumber])`. Índice por `[shopId, expiryDate]`. |
| **`ProductImage`** | `id`, `productId`, `imageUrl`, `altText`, `sortOrder` | Pertenece a `Product`. |
| **`ProductPriceHistory`** / **`ProductCostHistory`** | `id`, `productId`, `previousPrice`/`previousCost`, `newPrice`/`newCost`, `effectiveDate`, `changedByUserId`, `note` | Historial auditable de cambios de precio y costo. |

### 2.3 Punto de Venta, Caja y Carritos Guardados
| Tabla | Columnas clave | Relaciones y restricciones |
| :--- | :--- | :--- |
| **`CashSession`** | `id`, `shopId`, `userId`, `openedAt`, `openingFloat`, `closedAt`, `closedByUserId`, `closingExpected`, `closingActual`, `variance`, `denominationBreakdown` (Json), `reviewedByUserId`, `reviewedAt`, `reviewNote`, `reopenedByUserId`, `reopenedAt`, `reopenReason`, `status` (`OPEN`/`CLOSED`/`OVERRIDE_CLOSED`) | Relacionada con `Shop`, `User` (cajero, cierre, revisión, reapertura) y `CashMovement[]`. |
| **`CashMovement`** | `id`, `shopId`, `cashSessionId`, `type` (`PAYOUT`/`CASH_DROP`/`PETTY_CASH`/`MANUAL_CORRECTION`), `amount`, `note`, `createdByUserId` | Pertenece a `CashSession` y `Shop`. |
| **`Sale`** | `id`, `shopId`, `cashierUserId`, `customerId`, `saleNumber`, `receiptNumber`, `clientRequestId`, `status` (`COMPLETED`/`VOIDED`), `customerName`, `customerPhone`, `subtotal`, `taxAmount`, `discountAmount`, `totalAmount`, `changeDue`, `paymentMethod`, `isCreditSale`, `notes`, `cashierName`, `voidReason` | `@@unique([shopId, saleNumber])`, `@@unique([shopId, receiptNumber])`, `@@unique([shopId, clientRequestId])`. |
| **`SaleItem`** | `id`, `saleId`, `productId`, `productVariantId`, `productName`, `variantLabel`, `variantSkuSnapshot`, `variantBarcodeSnapshot`, `qty`, `unitPrice`, `lineTotal` | Snapshot de precio y producto al momento de la venta. |
| **`SalePayment`** | `id`, `saleId`, `method`, `amount`, `referenceNumber`, `createdAt` | Soporta pagos múltiples/divididos por venta. |
| **`SaleAdjustment`** | `id`, `shopId`, `saleId`, `exchangeSaleId`, `adjustmentNumber`, `type` (`VOID`/`REFUND`/`EXCHANGE`), `reason`, `notes`, `subtotal`, `totalAmount`, `approvedByUserId`, `createdByUserId` | `@@unique([shopId, adjustmentNumber])`. Vincula venta original y venta de cambio opcional. |
| **`SaleAdjustmentItem`** | `id`, `saleAdjustmentId`, `saleItemId`, `productId`, `itemType` (`RETURN`/`REPLACEMENT`), `productName`, `qty`, `unitPrice`, `lineTotal`, `disposition` (`RESTOCK`/`DAMAGED`/`EXCHANGE`) | Detalle de ítems devueltos o reemplazados. |
| **`RefundPayment`** | `id`, `saleAdjustmentId`, `method`, `amount`, `referenceNumber` | Pagos emitidos en devoluciones. |
| **`ParkedSale`** | `id`, `shopId`, `cashierUserId`, `customerId`, `title`, `quoteReference`, `type` (`SAVED_CART`/`QUOTE`), `subtotal`, `taxAmount`, `discountAmount`, `totalAmount`, `status` (`HELD`/`RESUMED`/`CANCELLED`/`EXPIRED`), `expiresAt`, `resumedAt`, `cancelledAt` | `@@unique([shopId, quoteReference])`. Contiene `ParkedSaleItem[]`. |
| **`ParkedSaleItem`** | `id`, `parkedSaleId`, `productId`, `productVariantId`, `productName`, `variantLabel`, `qty`, `unitPrice`, `lineTotal` | Ítems del carrito guardado o cotización. |

### 2.4 Inventario, Conteos y Transferencias
| Tabla | Columnas clave | Relaciones y restricciones |
| :--- | :--- | :--- |
| **`InventoryReason`** | `id`, `shopId`, `code`, `label`, `isActive` | `@@unique([shopId, code])`. Motivos de ajuste manual. |
| **`InventoryMovement`** | `id`, `shopId`, `productId`, `reasonId`, `type` (`InventoryMovementType`), `qtyChange`, `referenceId`, `notes`, `userId`, `createdAt` | Kardex inmutable de cada variación de stock. |
| **`StockCount`** | `id`, `shopId`, `createdByUserId`, `approvedByUserId`, `referenceNumber`, `title`, `status` (`DRAFT`/`IN_PROGRESS`/`SUBMITTED`/`APPROVED`/`POSTED`/`CANCELLED`), `isBlind`, `startedAt`, `submittedAt`, `approvedAt`, `postedAt` | `@@unique([shopId, referenceNumber])`. Contiene `StockCountItem[]`. |
| **`StockCountItem`** | `id`, `stockCountId`, `productId`, `productNameSnapshot`, `skuSnapshot`, `expectedQty`, `actualQty`, `varianceQty`, `note` | `@@unique([stockCountId, productId])`. |
| **`StockTransfer`** | `id`, `fromShopId`, `toShopId`, `createdByUserId`, `receivedByUserId`, `transferNumber`, `status` (`DRAFT`/`IN_TRANSIT`/`RECEIVED`/`CANCELLED`), `sentAt`, `receivedAt` | `@@unique([fromShopId, transferNumber])`. Conecta dos `Shop`. |
| **`StockTransferItem`** | `id`, `stockTransferId`, `fromProductId`, `toProductId`, `productNameSnapshot`, `destinationProductNameSnapshot`, `qty` | Mapea producto origen y producto destino entre sucursales. |

### 2.5 Proveedores, Compras y Cuentas por Pagar
| Tabla | Columnas clave | Relaciones y restricciones |
| :--- | :--- | :--- |
| **`Supplier`** | `id`, `shopId`, `name`, `contactName`, `email`, `phone`, `address`, `notes`, `isActive` | `@@unique([shopId, name])`. |
| **`PurchaseOrder`** | `id`, `shopId`, `supplierId`, `purchaseNumber`, `status` (`PurchaseStatus`), `totalAmount`, `notes`, `receivedAt` | `@@unique([shopId, purchaseNumber])`. |
| **`PurchaseItem`** | `id`, `purchaseId`, `productId`, `unitOfMeasureId`, `unitCode`, `unitName`, `productName`, `qty`, `ratioToBase`, `receivedBaseQty`, `unitCost`, `lineTotal` | Convierte cantidad de compra a unidad base. |
| **`PurchaseReceipt`** / **`PurchaseReceiptItem`** | `PurchaseReceipt`: `id`, `shopId`, `purchaseId`, `receivedByUserId`, `receivedAt`.<br>`PurchaseReceiptItem`: `purchaseReceiptId`, `purchaseItemId`, `productId`, `qtyReceived` | `@@unique([purchaseReceiptId, purchaseItemId])`. Registra recepciones parciales o totales. |
| **`SupplierReturn`** / **`SupplierReturnItem`** | `SupplierReturn`: `id`, `shopId`, `supplierId`, `returnNumber`, `status`, `reasonSummary`, `creditMemoNumber`, `creditAmount`, `creditMemoStatus`, `postedAt`.<br>`SupplierReturnItem`: `productId`, `qty`, `unitCost`, `lineTotal`, `reason`, `disposition` | `@@unique([shopId, returnNumber])`. |
| **`SupplierInvoice`** | `id`, `shopId`, `supplierId`, `purchaseId` (unique), `invoiceNumber`, `invoiceDate`, `dueDate`, `totalAmount`, `paymentStatus` (`PayableStatus`) | `@@unique([supplierId, invoiceNumber])`. |
| **`SupplierPayment`** | `id`, `shopId`, `supplierInvoiceId`, `method`, `amount`, `referenceNumber`, `paidAt`, `createdByUserId` | Pagos aplicados a facturas de proveedor. |
| **`AccountsPayableEntry`** | `id`, `shopId`, `supplierId`, `supplierInvoiceId` (unique), `amountDue`, `amountPaid`, `balance`, `status` (`PayableStatus`), `dueDate` | Libro auxiliar de cuentas por pagar. |

### 2.6 Clientes y Cuentas por Cobrar
| Tabla | Columnas clave | Relaciones y restricciones |
| :--- | :--- | :--- |
| **`Customer`** | `id`, `shopId`, `type` (`INDIVIDUAL`/`BUSINESS`), `firstName`, `lastName`, `businessName`, `contactPerson`, `taxId`, `phone`, `email`, `address`, `notes`, `isActive` | Relacionado con `Sale`, `ParkedSale` y `CustomerCreditLedger`. |
| **`CustomerCreditLedger`** | `id`, `shopId`, `customerId`, `saleId` (unique), `dueDate`, `originalAmount`, `balance`, `status` (`OPEN`/`PARTIALLY_PAID`/`PAID`/`OVERDUE`/`VOIDED`) | Registra deuda generada por venta a crédito. |
| **`ReceivablePayment`** | `id`, `shopId`, `customerCreditLedgerId`, `amount`, `method`, `referenceNumber`, `paidAt`, `createdByUserId` | Abonos recibidos del cliente. |

### 2.7 Sistema, Auditoría, Secuencias y Worker
| Tabla | Columnas clave | Relaciones y restricciones |
| :--- | :--- | :--- |
| **`DocumentSequence`** | `id`, `shopId`, `type` (`SALE`/`RECEIPT`/`PURCHASE`/`RETURN`/`STOCK_COUNT`/`TRANSFER`), `dateKey`, `value` | `@@unique([shopId, type, dateKey])`. Garantiza numeración correlativa atómica. |
| **`Notification`** | `id`, `shopId`, `type` (`LOW_STOCK`/`DAILY_SUMMARY`/`SYSTEM`), `title`, `message`, `isRead` | Alertas visibles en `NotificationsBell`. |
| **`ActivityLog`** | `id`, `shopId`, `userId`, `action`, `entityType`, `entityId`, `description`, `metadata` (Json) | Bitácora operativa visible en `/activity`. |
| **`WorkerJob`** | `id`, `shopId`, `type` (`LOW_STOCK_SCAN`/`DAILY_SUMMARY`), `status` (`QUEUED`/`RUNNING`/`COMPLETED`/`FAILED`), `payload`, `error`, `runAt`, `startedAt`, `finishedAt`, `createdById` | Cola persistente para `worker/index.ts`. |
