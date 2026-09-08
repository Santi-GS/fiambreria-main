import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { compactNumber, dateTime, money } from '@/lib/format';
import { getCashierReportData, getReportFilterOptions, parseReportFilters } from '@/lib/reporting';

export default async function CashierReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getCashierReportData(shopId, filters)
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Reportes de cajeros"
        subtitle="Revisa los ingresos gestionados, el comportamiento de los carritos, los reembolsos, las anulaciones y las sesiones de caja en una sola vista operativa."
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/cashier"
          fromValue={filters.fromValue}
          toValue={filters.toValue}
          cashierId={filters.cashierId}
          cashiers={options.cashiers}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">Ingresos gestionados</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.totalRevenue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Cantidad de ventas</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{compactNumber(report.summary.totalTransactions)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Cantidad de reembolsos</div>
          <div className="mt-2 text-3xl font-black text-amber-700">{compactNumber(report.summary.refundCount)}</div>
          <div className="mt-2 text-sm text-stone-500">{money(report.summary.refundTotal, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Cantidad de anulaciones</div>
          <div className="mt-2 text-3xl font-black text-red-700">{compactNumber(report.summary.voidCount)}</div>
          <div className="mt-2 text-sm text-stone-500">{money(report.summary.voidTotal, options.currencySymbol)}</div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-black text-stone-900">Rendimiento de cajeros</h2>
        <div className="mt-4 space-y-3">
          {report.topCashiers.length ? report.topCashiers.map((entry) => (
            <div key={entry.cashierId} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900">{entry.cashierName}</div>
                  <div className="text-sm text-stone-500">
                    {entry.salesCount} venta(s) / {entry.shiftCount} turno(s)
                  </div>
                  <div className="text-xs text-stone-500">
                    Reembolsos {entry.refundCount} / Anulaciones {entry.voidCount}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-stone-900">{money(entry.revenueHandled, options.currencySymbol)}</div>
                  <div className="text-sm text-stone-500">
                    Carrito promedio {entry.averageBasketSize.toFixed(1)} artículo(s)
                  </div>
                  <div className="text-xs text-stone-500">
                    Ticket promedio {money(entry.averageTicket, options.currencySymbol)}
                  </div>
                  {entry.shiftCount ? (
                    <div className="text-xs text-stone-500">
                      Real del turno {money(entry.shiftActual, options.currencySymbol)} / diferencia {money(entry.shiftVariance, options.currencySymbol)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )) : <div className="text-sm text-stone-500">Ninguna venta de cajero coincide con ese rango.</div>}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-stone-900">Totales de turnos</h2>
          <div className="text-sm text-stone-500">{report.summary.shiftCount} sesión(es)</div>
        </div>
        <div className="mt-4 space-y-3">
          {report.shiftSessions.length ? report.shiftSessions.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900">{entry.cashierName}</div>
                  <div className="text-sm text-stone-500">
                    Abierta {dateTime(entry.openedAt)}{entry.closedAt ? ` / Cerrada ${dateTime(entry.closedAt)}` : ' / Aún abierta'}
                  </div>
                  <div className="text-xs text-stone-500">Estado {entry.status}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-stone-500">Esperado {money(entry.closingExpected, options.currencySymbol)}</div>
                  <div className="font-black text-stone-900">Real {money(entry.closingActual, options.currencySymbol)}</div>
                  <div className={`text-xs ${entry.variance < 0 ? 'text-red-700' : 'text-stone-500'}`}>
                    Diferencia {money(entry.variance, options.currencySymbol)}
                  </div>
                </div>
              </div>
            </div>
          )) : <div className="text-sm text-stone-500">No se abrieron sesiones de caja en el rango seleccionado.</div>}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Reporte de reembolsos</h2>
          <div className="mt-4 space-y-3">
            {report.refunds.length ? report.refunds.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.adjustmentNumber} / {entry.saleNumber}</div>
                    <div className="text-sm text-stone-600">{entry.type} de {entry.cashierName}</div>
                    <div className="text-sm text-stone-500">{entry.reason}</div>
                    <div className="mt-1 text-xs text-stone-500">Aprobado por {entry.approvedByName} / {dateTime(entry.createdAt)}</div>
                  </div>
                  <div className="font-black text-amber-700">{money(entry.totalAmount, options.currencySymbol)}</div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No hay ajustes de reembolso o cambio en este rango.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Reporte de anulaciones</h2>
          <div className="mt-4 space-y-3">
            {report.voids.length ? report.voids.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.adjustmentNumber} / {entry.saleNumber}</div>
                    <div className="text-sm text-stone-600">Anulado por {entry.cashierName}</div>
                    <div className="text-sm text-stone-500">{entry.reason}</div>
                    <div className="mt-1 text-xs text-stone-500">Aprobado por {entry.approvedByName} / {dateTime(entry.createdAt)}</div>
                  </div>
                  <div className="font-black text-red-700">{money(entry.totalAmount, options.currencySymbol)}</div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No hay ajustes de anulación en este rango.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
