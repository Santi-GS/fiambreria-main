# 04. Brief de Diseño

Este documento define la identidad visual, paleta de colores, tipografía, componentes y estructura de pantallas de **Fiambrería Costanera POS**, para que cualquier nueva vista o componente mantenga exactamente la misma estética y ergonomía.

---

## 1. Aspecto y Sensación (Look & Feel)

- **Concepto visual:** **"Warm Stone & Emerald"** — una estética limpia, luminosa y táctil de vidrio esmerilado ligero (`backdrop-blur`), bordes suaves muy redondeados y sombras cálidas difusas sobre un fondo piedra natural.
- **Sensación operativa:** Diseñado para largas jornadas frente al mostrador y uso en **tablets de alta resolución** (como pantallas de 11" `2560x1600`): botones altos (`h-11` o mayores), alto contraste en totales y estados, y retroalimentación visual inmediata en cobros y validaciones.
- **Esquema de color:** Modo claro (`color-scheme: light`) con gradientes ambientales sutiles en el `body` (esmeralda, cielo y ámbar al 8–12% de opacidad).

---

## 2. Paleta de Colores (`app/globals.css` y `components/ui/*`)

| Rol | Token / Valor | Uso principal |
| :--- | :--- | :--- |
| **Fondo base** | `--background: #f3f5f1`<br>Gradiente `#f6f8f4` -> `#eef2ec` | Lienzo principal de la aplicación con brillos radiales suaves (emerald, sky, amber). |
| **Texto principal** | `--foreground: #1f2937` / `stone-950` / `stone-900` | Títulos, montos, etiquetas primarias. |
| **Texto secundario** | `stone-600`, `stone-500`, `stone-400` | Descripciones, placeholders (`#a8a29e`), encabezados de sección. |
| **Superficies (Cards)** | `rgba(255,255,255,0.96)` -> `rgba(255,255,255,0.9)`<br>Borde `border-white/80` | Tarjetas elevadas (`Card`), sidebar y modales. |
| **Acento primario (Emerald)** | `#059669` -> `#047857` (`emerald-600` / `emerald-700`) | Botón primario, ítem activo del sidebar, foco en inputs, estados completados. |
| **Acento secundario / Info** | `sky-100` / `sky-700` / `border-sky-200` | Badges informativos (`blue` tone). |
| **Advertencia (Amber)** | `amber-100` / `amber-700` / `border-amber-200` | Stock bajo, sesiones pendientes o alertas de atención. |
| **Peligro / Error (Red)** | `#dc2626` -> `#b91c1c` (`red-600` / `#ef4444`) | Botón `danger`, anulaciones, animación `.payment-empty-pulse`. |
| **Neutro (Stone)** | `stone-100`, `stone-200`, `stone-300` | Bordes de inputs, botones secundarios, badges neutros. |

---

## 3. Tipografía y Escalas POS

### Fuentes (`app/layout.tsx`)
- **Principal (Sans):** `Geist` (`--font-geist-sans`, fallback `"Segoe UI", sans-serif`).
- **Monoespaciada (Mono):** `Geist_Mono` (`--font-geist-mono`) — usada para códigos SKU, códigos de barras, números de comprobante, montos alineados y tickets térmicos.

### Jerarquía tipográfica
- **Títulos de página / Hero:** `font-black tracking-tight text-stone-950` (`text-3xl` a `text-6xl`).
- **Etiquetas de sección (Overlines):** `text-[11px] font-semibold uppercase tracking-[0.2em]` a `0.24em` en `emerald-700` o `stone-400`.
- **Cuerpo / Tablas:** `text-sm` (`14px`) y `text-xs` (`12px`) para metadatos.

### Escalas táctiles para POS (`app/globals.css`)
El punto de venta soporta 3 modos de escala configurables para adaptarse a pantallas de escritorio o tablets de alta densidad:
- `.pos-scale-normal`: Escala base (`1rem`).
- `.pos-scale-large`: Base `1.12rem`, controles `h-11` crecen a `3.25rem`, `text-4xl` a `2.75rem`.
- `.pos-scale-xlarge`: Base `1.25rem`, controles `h-11` crecen a `3.65rem`, `text-4xl` a `3.25rem`.

---

## 4. Componentes Base y Patrones de Interacción

| Componente | Archivo | Especificación visual |
| :--- | :--- | :--- |
| **`Card`** | `components/ui/Card.tsx` | `rounded-[30px]`, `border-white/80`, fondo blanco translúcido con gradiente vertical, `p-6 sm:p-7`, sombra `0_24px_70px_-36px_rgba(28,25,23,0.25)` y `backdrop-blur-sm`. |
| **`Button`** | `components/ui/Button.tsx` | Altura `h-11`, `rounded-2xl`, `px-4 text-sm font-semibold`, micro-elevación `hover:-translate-y-0.5`. Variantes: `primary` (gradiente esmeralda), `secondary` (blanco/stone), `danger` (gradiente rojo), `ghost` (transparente). |
| **`Input`** | `components/ui/Input.tsx` | Altura `h-11`, `rounded-2xl`, `border-stone-200`, `bg-white/88`, foco `border-emerald-500` con anillo `ring-4 ring-emerald-500/10`. |
| **`Badge`** | `components/ui/Badge.tsx` | Píldora `rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]`. Tonos: `stone`, `emerald`, `amber`, `red`, `blue`. |
| **`AppSidebar`** | `components/layout/AppSidebar.tsx` | En desktop: fija (`lg:sticky lg:top-0 lg:h-screen`), colapsable (`lg:w-[320px]` <-> `lg:w-28`), tarjeta superior de marca (`FC` en bloque oscuro `#111827`) con selector de sucursal y bloque inferior **"Linea rápida"** (3 accesos rápidos). En móvil: drawer animado con `framer-motion`. |
| **Estados de pago** | `app/globals.css` | `.payment-empty-pulse` (borde rojo pulsante cuando falta monto) y `.payment-filled-success` (borde esmeralda sólido cuando el pago cubre el total). |

---

## 5. Diseño Esperado por Pantalla

1. **Landing (`/`) y Auth (`/(auth)/*`):**
   - Landing dividida en 2 columnas en desktop: titular grande a la izquierda con píldora esmeralda y CTA primario; 3 tarjetas apiladas de características a la derecha.
   - Pantallas de login/registro/recuperación centradas dentro de un `Card` limpio sobre el fondo ambiental piedra.
2. **Dashboard (`/dashboard`):**
   - Encabezado con contexto de sucursal (`AppHeader` + campana `NotificationsBell`).
   - Grilla superior de tarjetas KPI (`StatsGrid` / `DashboardStats`) con variaciones e íconos.
   - Panel analítico para propietarios (`OwnerAnalyticsPanel`) y dos tarjetas operativas: **Ventas recientes** (`RecentSalesCard`) y **Alertas de bajo stock** (`LowStockCard`).
3. **Punto de Venta (`/checkout`):**
   - Barra superior (`PosHeader`) con buscador/escáner, selector de cliente, estado de conexión/cola offline, acceso a balanza y selector de escala POS.
   - Área principal dividida: tabla/lista de ítems del carrito (`PosCartTable`) con controles grandes de cantidad y eliminación; panel lateral/inferior de resumen financiero (subtotal, impuestos, descuento, total destacado) y botones de acción rápida (**Guardar carrito**, **Cotización**, **Cobrar**).
   - Modales dedicados sobre overlay oscuro: `ProductSearchModal`, `WeighProductModal` (lectura de peso en vivo con indicador de estabilidad), `CustomerSearchModal`, `PaymentModal` y `ReceiptPreviewModal`.
4. **Módulos de Gestión (`/products`, `/inventory`, `/purchases`, `/customers`, `/suppliers`, `/sales`, `/staff`):**
   - Cabecera con título, descripción breve y botón primario de creación/acción.
   - Barra de filtros/búsqueda dentro de un `Card`.
   - Tabla responsiva con `Badge` de estado, acciones por fila y modales o subpáginas de detalle.
5. **Vistas de Impresión (`/print/*`):**
   - Sin sidebar ni header de navegación. Fondo blanco puro (`#ffffff`), tipografía monoespaciada/alta legibilidad y formato adaptado a rollo térmico (`80mm` / `58mm`) o hoja A4 (estados de cuenta, etiquetas de código de barras).
