import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { compactNumber, money } from '@/lib/format';
import { getReportFilterOptions, getSalesReportData, parseReportFilters } from '@/lib/reporting';

export default async function SalesReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getSalesReportData(shopId, filters)
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Reportes de ventas"
        subtitle="Revisa el rendimiento diario y mensual, los patrones horarios, la combinación de medios de pago y los productos con movimiento real."
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/sales"
          fromValue={filters.fromValue}
          toValue={filters.toValue}
          cashierId={filters.cashierId}
          paymentMethod={filters.paymentMethod}
          cashiers={options.cashiers}
          paymentMethods={options.paymentMethods}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">Ingresos</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.revenue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Transacciones</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{compactNumber(report.summary.transactionCount)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Ticket promedio</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.averageTicket, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Ventas a crédito</div>
          <div className="mt-2 text-3xl font-black text-amber-700">{money(report.summary.creditSales, options.currencySymbol)}</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Ventas diarias</h2>
          <div className="mt-4 space-y-3">
            {report.dailySales.length ? report.dailySales.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.label}</div>
                  <div className="text-sm text-stone-500">{entry.count} venta(s)</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">Ninguna venta completada coincide con ese rango.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Ventas mensuales</h2>
          <div className="mt-4 space-y-3">
            {report.monthlySales.length ? report.monthlySales.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.label}</div>
                  <div className="text-sm text-stone-500">{entry.count} venta(s)</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">No hay totales mensuales para ese rango.</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Distribución horaria de ventas</h2>
          <div className="mt-4 space-y-3">
            {report.hourlySales.map((entry) => (
              <div key={entry.hour} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.label}</div>
                  <div className="text-sm text-stone-500">{entry.count} venta(s)</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Totales por medio de pago</h2>
          <div className="mt-4 space-y-3">
            {report.paymentMethodTotals.length ? report.paymentMethodTotals.map((entry) => (
              <div key={entry.method} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div className="font-semibold text-stone-900">
                  {entry.method === 'Cash'
                    ? 'Efectivo'
                    : entry.method === 'Card'
                    ? 'Tarjeta'
                    : entry.method === 'E-Wallet'
                    ? 'Billetera virtual'
                    : entry.method === 'Bank Transfer'
                    ? 'Transferencia bancaria'
                    : entry.method}
                </div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">Ningún total de pago coincide con esos filtros.</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Productos principales</h2>
          <div className="mt-4 space-y-3">
            {report.topItems.length ? report.topItems.map((entry) => (
              <div key={entry.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.name}</div>
                  <div className="text-sm text-stone-500">{entry.qty} unidad(es)</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.revenue, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">Aún no hay productos principales para este rango.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Categorías principales</h2>
          <div className="mt-4 space-y-3">
            {report.topCategories.length ? report.topCategories.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.name}</div>
                  <div className="text-sm text-stone-500">{entry.qty} unidad(es)</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.revenue, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">Aún no hay datos de rendimiento por categoría.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
