import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { money } from '@/lib/format';
import { getReportFilterOptions, getReportsOverviewData, parseReportFilters } from '@/lib/reporting';

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, overview] = await Promise.all([
    getReportFilterOptions(shopId),
    getReportsOverviewData(shopId, filters)
  ]);

  const sections = [
    {
      href: '/reports/sales',
      title: 'Reportes de ventas',
      description: 'Visibilidad diaria, mensual y por hora de artículos principales, categorías y medios de pago.'
    },
    {
      href: '/reports/inventory',
      title: 'Reportes de inventario',
      description: 'Valoración y visibilidad de movimientos bajos y existencias inmovilizadas.'
    },
    {
      href: '/reports/profit',
      title: 'Reportes de ganancias',
      description: 'Tendencias estimadas de ganancia bruta y visibilidad de artículos con alto margen.'
    },
    {
      href: '/reports/cashier',
      title: 'Reportes de cajeros',
      description: 'Rendimiento de cajeros, reembolsos, anulaciones y excepciones que requieren aprobación.'
    }
  ];

  return (
    <div className="space-y-6">
      <AppHeader
        title="Reportes del propietario"
        subtitle="Los reportes sensibles están limitados al acceso administrativo. Usa las pestañas para revisar ventas, inventario, ganancias y rendimiento de cajeros."
      />

      <ReportsNav />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">Ingresos del periodo</div>
          <div className="mt-2 text-3xl font-black text-stone-900">
            {money(overview.revenue, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">{overview.transactionCount} venta(s) completada(s)</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Ganancia bruta estimada</div>
          <div className="mt-2 text-3xl font-black text-emerald-700">
            {money(overview.grossProfit, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">Usa el costo actual del producto como base disponible.</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Valoración del inventario</div>
          <div className="mt-2 text-3xl font-black text-stone-900">
            {money(overview.inventoryValuation, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">Cantidad actual multiplicada por el costo unitario actual.</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Reembolsos y anulaciones</div>
          <div className="mt-2 text-3xl font-black text-red-700">
            {money(overview.refundTotal + overview.voidTotal, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">
            Reembolsos {money(overview.refundTotal, options.currencySymbol)} / Anulaciones {money(overview.voidTotal, options.currencySymbol)}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:border-emerald-200">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Módulo de reportes</div>
              <h2 className="mt-2 text-2xl font-black text-stone-900">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">{section.description}</p>
              <div className="mt-6 text-sm font-semibold text-emerald-700">Abrir reporte</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
