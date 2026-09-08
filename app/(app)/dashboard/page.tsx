import Link from 'next/link';
import DashboardStats from '@/components/dashboard/DashboardStats';
import LowStockCard from '@/components/dashboard/LowStockCard';
import OwnerAnalyticsPanel from '@/components/dashboard/OwnerAnalyticsPanel';
import RecentSalesCard from '@/components/dashboard/RecentSalesCard';
import Card from '@/components/ui/Card';
import { getInventoryMovementTypeLabel } from '@/lib/business-labels';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { dateTime, money, shortDate } from '@/lib/format';
import { getOwnerAnalyticsData } from '@/lib/owner-analytics';
import { prisma } from '@/lib/prisma';
import {
  lowStockCardProductSelect,
  recentSaleCardSelect,
  serializeLowStockProduct,
  serializeRecentSale
} from '@/lib/serializers/dashboard';

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default async function DashboardPage() {
  const { shopId, shop, role, userId } = await getActiveShopContext();
  const showBackOfficeInsights = role !== 'CASHIER';
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 6);

  const [
    totalProducts,
    lowStockCount,
    lowStockProducts,
    recentSales,
    todaySales,
    todayRefunds,
    todaySaleCount,
    weeklySales,
    weeklyRefunds,
    pendingPurchases,
    recentMovements,
    recentAuthEvents,
    ownerAnalytics
  ] = await Promise.all([
    prisma.product.count({ where: { shopId, isActive: true } }),
    prisma.product.count({
      where: {
        shopId,
        isActive: true,
        stockQty: { lte: settings?.lowStockThreshold ?? 5 }
      }
    }),
    prisma.product.findMany({
      where: {
        shopId,
        isActive: true,
        stockQty: { lte: settings?.lowStockThreshold ?? 5 }
      },
      select: lowStockCardProductSelect,
      orderBy: [{ stockQty: 'asc' }, { name: 'asc' }],
      take: 8
    }),
    prisma.sale.findMany({
      where: { shopId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: recentSaleCardSelect
    }),
    prisma.sale.aggregate({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: todayStart } },
      _sum: { totalAmount: true }
    }),
    prisma.saleAdjustment.aggregate({
      where: { shopId, createdAt: { gte: todayStart } },
      _sum: { totalAmount: true }
    }),
    prisma.sale.count({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: todayStart } }
    }),
    prisma.sale.aggregate({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: weekStart } },
      _sum: { totalAmount: true }
    }),
    prisma.saleAdjustment.aggregate({
      where: { shopId, createdAt: { gte: weekStart } },
      _sum: { totalAmount: true }
    }),
    showBackOfficeInsights
      ? prisma.purchaseOrder.count({
          where: {
            shopId,
            status: { in: ['DRAFT', 'SENT', 'PARTIALLY_RECEIVED'] }
          }
        })
      : Promise.resolve(0),
    showBackOfficeInsights
      ? prisma.inventoryMovement.findMany({
          where: { shopId },
          include: {
            product: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 6
        })
      : Promise.resolve([]),
    prisma.authAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 6
    }),
    showBackOfficeInsights ? getOwnerAnalyticsData(shopId) : Promise.resolve(null)
  ]);

  const currency = settings?.currencySymbol ?? '₱';
  const todaySalesValue = Number(todaySales._sum.totalAmount ?? 0) - Number(todayRefunds._sum.totalAmount ?? 0);
  const weeklySalesValue = Number(weeklySales._sum.totalAmount ?? 0) - Number(weeklyRefunds._sum.totalAmount ?? 0);
  const averageTicket = todaySaleCount > 0 ? todaySalesValue / todaySaleCount : 0;
  const stockCoverage =
    totalProducts > 0 ? Math.max(0, Math.round(((totalProducts - lowStockCount) / totalProducts) * 100)) : 100;
  const criticalLowStockCount = lowStockProducts.filter(
    (product) => product.stockQty <= Math.max(1, Math.floor(product.reorderPoint / 2))
  ).length;
  const nextSteps = [
    totalProducts === 0
      ? {
          href: '/products',
          title: 'Añade tus primeros productos',
          description: 'El punto de venta, la búsqueda por código de barras y las alertas de inventario se activan en cuanto se carga el catálogo.'
        }
      : null,
    recentSales.length === 0
      ? {
          href: '/checkout',
          title: 'Realiza la primera venta',
          description: 'Realiza un cobro para generar recibos, historial de ventas, métricas de caja y resúmenes diarios.'
        }
      : null,
    showBackOfficeInsights && pendingPurchases === 0
      ? {
          href: '/purchases',
          title: 'Registra actividad con proveedores',
          description: 'Las compras y recepciones mejoran la cobertura de stock, la valoración y las sugerencias de reposición.'
        }
      : null,
    showBackOfficeInsights && (!shop.address || !settings?.receiptHeader)
      ? {
          href: '/settings',
          title: 'Completa la configuración de la sucursal',
          description: 'Añade la identidad del recibo, datos de contacto y valores predeterminados para los comprobantes de tus clientes.'
        }
      : null
  ].filter((step): step is { href: string; title: string; description: string } => Boolean(step));

  const allowedQuickLinks =
    role === 'CASHIER'
      ? [
          { href: '/checkout', label: 'Iniciar venta' },
          { href: '/sales', label: 'Ver ventas' }
        ]
      : [
          { href: '/checkout', label: 'Iniciar venta' },
          { href: '/products', label: 'Añadir producto' },
          { href: '/purchases', label: 'Registrar compra' },
          { href: '/activity', label: 'Registro de actividad' }
        ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[34px] border border-white/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(255,255,255,0.96),rgba(239,246,255,0.92))] p-6 shadow-[0_32px_100px_-48px_rgba(28,25,23,0.34)] sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.18),_transparent_58%)] lg:block" />
        <div className="absolute left-10 top-10 h-28 w-28 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div>
            <div className="inline-flex rounded-full border border-emerald-200 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700 shadow-sm">
              {shortDate(now)} / Panel en vivo
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-stone-950 sm:text-[3.3rem]">Panel de control</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600 sm:text-lg">
              Te damos la bienvenida. {shop.name} está listo para las operaciones de hoy, con cobros, control de inventario y reportes conectados.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {allowedQuickLinks.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-full border border-white/90 bg-white/92 px-5 py-3 text-sm font-semibold text-stone-900 shadow-[0_16px_32px_-24px_rgba(28,25,23,0.35)] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  {action.label}
                </Link>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/80 bg-white/82 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Ticket promedio</div>
                <div className="mt-2 text-2xl font-black text-stone-950">{money(averageTicket, currency)}</div>
                <div className="mt-1 text-sm text-stone-500">Basado en las ventas completadas de hoy.</div>
              </div>
              <div className="rounded-[28px] border border-white/80 bg-white/82 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Últimos 7 días</div>
                <div className="mt-2 text-2xl font-black text-stone-950">{money(weeklySalesValue, currency)}</div>
                <div className="mt-1 text-sm text-stone-500">Resumen semanal de ingresos acumulados.</div>
              </div>
              {showBackOfficeInsights ? (
                <div className="rounded-[28px] border border-white/80 bg-white/82 p-4 backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Compras pendientes</div>
                  <div className="mt-2 text-2xl font-black text-stone-950">{pendingPurchases}</div>
                  <div className="mt-1 text-sm text-stone-500">Órdenes de compra abiertas en proceso de envío o recepción.</div>
                </div>
              ) : null}
            </div>
          </div>

          <Card className="border-white/70 bg-white/88">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Estado operativo</div>
                <h2 className="mt-2 text-2xl font-black text-stone-950">Lo que requiere atención</h2>
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">En vivo</div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-[26px] bg-[linear-gradient(135deg,#0f172a,#111827,#1f2937)] p-5 text-white shadow-[0_24px_50px_-34px_rgba(15,23,42,0.8)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-300">Ventas de hoy</div>
                <div className="mt-2 text-3xl font-black">{money(todaySalesValue, currency)}</div>
                <div className="mt-2 text-sm text-stone-300">{pluralize(todaySaleCount, 'venta')} completadas hasta ahora.</div>
              </div>

              <div className={`grid gap-3 ${showBackOfficeInsights ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
                <div className="rounded-[24px] border border-stone-200 bg-stone-50/90 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Presión de reposición</div>
                  <div className="mt-2 text-2xl font-black text-stone-950">{pluralize(lowStockCount, 'producto')}</div>
                  <div className="mt-2 text-sm text-stone-500">
                    {criticalLowStockCount > 0
                      ? `${pluralize(criticalLowStockCount, 'artículo')} están en la zona crítica.`
                      : 'Nada ha entrado todavía en la zona crítica.'}
                  </div>
                </div>

                {showBackOfficeInsights ? (
                  <div className="rounded-[24px] border border-stone-200 bg-stone-50/90 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Cola de recepción</div>
                    <div className="mt-2 text-2xl font-black text-stone-950">{pendingPurchases}</div>
                    <div className="mt-2 text-sm text-stone-500">
                      {pendingPurchases > 0 ? 'Hay órdenes de compra pendientes de acciones del proveedor.' : 'No hay órdenes de compra abiertas pendientes.'}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-4">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  <span>Estado del catálogo</span>
                  <span>{stockCoverage}% estable</span>
                </div>
                <div className="mt-3 h-2.5 rounded-full bg-stone-200">
                  <div className="h-full rounded-full bg-emerald-500 shadow-[0_10px_20px_-12px_rgba(16,185,129,0.9)]" style={{ width: `${stockCoverage}%` }} />
                </div>
                <div className="mt-3 text-sm text-stone-500">
                  Vigila la cola de reposición para que el área de ventas esté lista durante todo el día.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <DashboardStats
        totalProducts={totalProducts}
        lowStockCount={lowStockCount}
        pendingPurchases={pendingPurchases}
        todaySales={money(todaySalesValue, currency)}
        todaySaleCount={todaySaleCount}
        stockCoverage={stockCoverage}
        showPendingPurchases={showBackOfficeInsights}
      />

      {showBackOfficeInsights && ownerAnalytics ? (
        <OwnerAnalyticsPanel analytics={ownerAnalytics} />
      ) : null}

      {nextSteps.length ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Configuración guiada</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">Qué hacer a continuación</h2>
              <p className="mt-1 text-sm text-stone-500">Estos accesos aparecen mientras la sucursal necesite algunos registros básicos.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {nextSteps.map((step) => (
              <Link key={step.href} href={step.href} className="rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.92))] p-5 transition hover:-translate-y-0.5 hover:border-emerald-200">
                <div className="text-lg font-black text-stone-900">{step.title}</div>
                <div className="mt-2 text-sm leading-6 text-stone-500">{step.description}</div>
                <div className="mt-4 text-sm font-semibold text-emerald-700">Abrir tarea</div>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <RecentSalesCard
          sales={recentSales.map(serializeRecentSale)}
          currencySymbol={currency}
        />
        <LowStockCard
          products={lowStockProducts.map(serializeLowStockProduct)}
          currencySymbol={currency}
        />
      </div>

      {showBackOfficeInsights ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Control de movimientos</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">Movimientos recientes de inventario</h2>
            </div>
            <Link href="/inventory" className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
              Abrir inventario
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentMovements.length ? (
              recentMovements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.86))] p-4 transition hover:border-stone-300">
                  <div>
                    <div className="font-semibold text-stone-900">{movement.product.name}</div>
                    <div className="mt-1 text-sm text-stone-500">
                      {getInventoryMovementTypeLabel(movement.type)} / {dateTime(movement.createdAt)}
                    </div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-lg font-black ${movement.qtyChange >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {movement.qtyChange > 0 ? `+${movement.qtyChange}` : movement.qtyChange}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
                Aún no se ha registrado ningún movimiento de inventario.
              </div>
            )}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Control de sesiones</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">Eventos recientes de dispositivos y sesiones</h2>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {recentAuthEvents.length ? (
            recentAuthEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-[24px] border border-stone-200 bg-white p-4">
                <div>
                  <div className="font-semibold text-stone-900">{event.action.replaceAll('_', ' ')}</div>
                  <div className="mt-1 text-sm text-stone-500">
                    {dateTime(event.createdAt)} / {event.ipAddress ?? 'IP no disponible'}
                  </div>
                </div>
                <div className="max-w-md text-right text-xs text-stone-500">{event.userAgent ?? 'Navegador no disponible'}</div>
              </div>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
              Aún no se han registrado eventos de autenticación recientes para esta cuenta.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
