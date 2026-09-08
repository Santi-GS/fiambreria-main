import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { compactNumber, money } from '@/lib/format';
import { stockLevelLabel } from '@/lib/inventory';
import { getInventoryReportData, getReportFilterOptions, parseReportFilters } from '@/lib/reporting';

export default async function InventoryReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getInventoryReportData(shopId, filters)
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Reportes de inventario"
        subtitle="Revisa el valor actual de las existencias a costo y precio de venta, identifica el valor en riesgo por bajo stock y mantén visibles las existencias de baja rotación o inmovilizadas."
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/inventory"
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
          <div className="text-sm text-stone-500">Existencias actuales</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{compactNumber(report.summary.totalUnitsOnHand)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Valor a costo</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.costValue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Valor de venta</div>
          <div className="mt-2 text-3xl font-black text-emerald-700">{money(report.summary.sellValue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Valor en riesgo por bajo stock</div>
          <div className="mt-2 text-3xl font-black text-amber-700">{money(report.summary.lowStockValueAtRisk, options.currencySymbol)}</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Valoración del inventario</h2>
          <div className="mt-4 space-y-3">
            {report.valuationRows.length ? report.valuationRows.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">
                      {entry.categoryName} / {entry.stockQty} disponibles / {stockLevelLabel(entry.stockLevel)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-900">{money(entry.costValue, options.currencySymbol)}</div>
                    <div className="text-sm text-stone-500">Venta {money(entry.sellValue, options.currencySymbol)}</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">Ningún dato de valoración coincide con los filtros actuales.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Valor en riesgo por bajo stock</h2>
          <div className="mt-4 space-y-3">
            {report.lowStockRisk.length ? report.lowStockRisk.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">
                      {entry.categoryName} / Punto de reposición {entry.reorderPoint} / {entry.stockQty} restantes
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-amber-700">{money(entry.sellValue, options.currencySymbol)}</div>
                    <div className="text-sm text-stone-500">Costo {money(entry.costValue, options.currencySymbol)}</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">Ninguna exposición por bajo stock coincide con los filtros actuales.</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Productos de baja rotación</h2>
          <div className="mt-4 space-y-3">
            {report.lowMovement.length ? report.lowMovement.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">{entry.categoryName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-amber-700">{entry.soldQty} vendidos</div>
                    <div className="text-sm text-stone-500">
                      Ingresos {money(entry.soldRevenue, options.currencySymbol)} / Valor a costo {money(entry.costValue, options.currencySymbol)}
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No hay productos de baja rotación en este rango.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Existencias inmovilizadas</h2>
          <div className="mt-4 space-y-3">
            {report.deadStock.length ? report.deadStock.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">{entry.categoryName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-red-700">{entry.stockQty} aún disponibles</div>
                    <div className="text-sm text-stone-500">
                      Costo {money(entry.costValue, options.currencySymbol)} / Venta {money(entry.sellValue, options.currencySymbol)}
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No hay existencias inmovilizadas en el periodo seleccionado.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
