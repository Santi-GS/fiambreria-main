import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { money, shortDate } from '@/lib/format';
import { getProfitReportData, getReportFilterOptions, parseReportFilters } from '@/lib/reporting';

export default async function ProfitReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getProfitReportData(shopId, filters)
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Reportes de ganancias"
        subtitle="La ganancia bruta usa la mejor base de costos disponible para cada fecha de venta: el historial coincidente cuando existe y, si no, el costo anterior o actual más antiguo del producto."
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/profit"
          fromValue={filters.fromValue}
          toValue={filters.toValue}
          categoryId={filters.categoryId}
          productId={filters.productId}
          categories={options.categories}
          products={options.products}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">Base de ingresos netos</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.revenue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Costo estimado de mercancía</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.costOfGoods, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Ganancia bruta</div>
          <div className="mt-2 text-3xl font-black text-emerald-700">{money(report.summary.grossProfit, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Margen bruto</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{report.summary.grossMarginPercent.toFixed(2)}%</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Ganancia por día</h2>
          <div className="mt-4 space-y-3">
            {report.dailyProfit.length ? report.dailyProfit.map((entry) => (
              <div key={entry.key} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.label}</div>
                    <div className="text-sm text-stone-500">
                      Ingresos {money(entry.revenue, options.currencySymbol)} / Costo {money(entry.cost, options.currencySymbol)}
                    </div>
                  </div>
                  <div className={`font-black ${entry.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {money(entry.profit, options.currencySymbol)}
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No hay datos de tendencia de ganancias en este rango.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Ganancia por mes</h2>
          <div className="mt-4 space-y-3">
            {report.monthlyProfit.length ? report.monthlyProfit.map((entry) => (
              <div key={entry.key} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.label}</div>
                    <div className="text-sm text-stone-500">
                      Ingresos {money(entry.revenue, options.currencySymbol)} / Costo {money(entry.cost, options.currencySymbol)}
                    </div>
                  </div>
                  <div className={`font-black ${entry.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {money(entry.profit, options.currencySymbol)}
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No hay datos mensuales de ganancias para este rango.</div>}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-black text-stone-900">Ganancia por venta</h2>
        <div className="mt-4 space-y-3">
          {report.profitPerSale.length ? report.profitPerSale.map((entry) => (
            <div key={entry.saleId} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900">{entry.saleNumber}</div>
                  <div className="text-sm text-stone-500">
                    Fecha de venta {shortDate(entry.saleDate)} / Neto {entry.qty} unidad(es)
                  </div>
                  {entry.returnCount ? (
                    <div className="text-xs text-amber-700">{entry.returnCount} ajuste(s) de devolución afectaron esta venta en el periodo seleccionado.</div>
                  ) : null}
                </div>
                <div className="text-right">
                  <div className="font-black text-emerald-700">{money(entry.profit, options.currencySymbol)}</div>
                  <div className="text-sm text-stone-500">
                    Ingresos {money(entry.revenue, options.currencySymbol)} / Margen {entry.marginPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          )) : <div className="text-sm text-stone-500">Ningún dato de rentabilidad de ventas coincide con los filtros actuales.</div>}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Ganancia por categoría</h2>
          <div className="mt-4 space-y-3">
            {report.profitPerCategory.length ? report.profitPerCategory.map((entry) => (
              <div key={entry.name} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">
                      Ingresos {money(entry.revenue, options.currencySymbol)} / Costo {money(entry.cost, options.currencySymbol)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black ${entry.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {money(entry.profit, options.currencySymbol)}
                    </div>
                    <div className="text-sm text-stone-500">{entry.marginPercent.toFixed(2)}% de margen</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">Ningún dato de rentabilidad por categoría coincide con los filtros actuales.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Ganancia por producto</h2>
          <div className="mt-4 space-y-3">
            {report.profitPerItem.length ? report.profitPerItem.map((entry) => (
              <div key={entry.productId} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">{entry.categoryName} / Neto {entry.qty} unidad(es)</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black ${entry.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {money(entry.profit, options.currencySymbol)}
                    </div>
                    <div className="text-sm text-stone-500">{entry.marginPercent.toFixed(2)}% de margen</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">Ningún dato de rentabilidad por producto coincide con los filtros actuales.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
