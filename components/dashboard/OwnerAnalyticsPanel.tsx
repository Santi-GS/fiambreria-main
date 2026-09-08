import Link from 'next/link';
import { getOwnerAnalyticsData } from '@/lib/owner-analytics';
import { money } from '@/lib/format';
import Card from '@/components/ui/Card';

type OwnerAnalytics = Awaited<ReturnType<typeof getOwnerAnalyticsData>>;

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function heatColor(intensity: number) {
  if (intensity >= 0.85) return 'bg-emerald-700 text-white';
  if (intensity >= 0.65) return 'bg-emerald-600 text-white';
  if (intensity >= 0.45) return 'bg-emerald-500 text-white';
  if (intensity >= 0.25) return 'bg-emerald-200 text-emerald-950';
  if (intensity > 0) return 'bg-emerald-100 text-emerald-800';
  return 'bg-stone-100 text-stone-400';
}

export default function OwnerAnalyticsPanel({
  analytics
}: {
  analytics: OwnerAnalytics;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Analítica del propietario
          </div>
          <h2 className="mt-2 text-2xl font-black text-stone-950">Señales comerciales que requieren acción</h2>
          <p className="mt-2 max-w-3xl text-sm text-stone-500">
            Estos datos se basan en los registros actuales de inventario, compras, ventas, reembolsos y
            movimientos de la sucursal para {analytics.periodLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/inventory"
            className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            Abrir cola de reposición
          </Link>
          <Link
            href="/reports"
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
          >
            Abrir reportes
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-4">
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Rotación de ventas
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">{percent(analytics.summary.sellThroughPercent)}</div>
          <div className="mt-2 text-sm text-stone-500">Unidades vendidas recientemente frente a las vendidas más el stock actual.</div>
        </div>
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Fuga de margen
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">
            {money(analytics.summary.marginLeakageValue, analytics.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">Indicadores de descuentos, reembolsos y presión entre precio y costo que conviene revisar.</div>
        </div>
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(14,165,233,0.14),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Antigüedad del stock
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">
            {analytics.summary.averageStockAgeDays.toFixed(1)} días
          </div>
          <div className="mt-2 text-sm text-stone-500">Ponderada por el stock actual usando la última fecha de entrada comprobable.</div>
        </div>
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(120,113,108,0.14),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Cola de reposición
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">{analytics.summary.reorderCount}</div>
          <div className="mt-2 text-sm text-stone-500">
            {money(analytics.summary.reorderCost, analytics.currencySymbol)} de costo proyectado de reposición.
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                Mapa de calor de ventas
              </div>
              <div className="mt-1 text-lg font-black text-stone-950">Patrón de demanda por hora y día</div>
            </div>
            <div className="text-xs text-stone-500">{analytics.periodLabel}</div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[80px_repeat(24,minmax(24px,1fr))] gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                <div />
                {analytics.heatmap.hours.map((hour) => (
                  <div key={hour.hour} className="text-center">
                    {hour.label.replace(':00', '')}
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1">
                {analytics.heatmap.rows.map((row) => (
                  <div
                    key={row.dayLabel}
                    className="grid grid-cols-[80px_repeat(24,minmax(24px,1fr))] gap-1"
                  >
                    <div className="flex items-center text-xs font-semibold text-stone-500">
                      {row.dayLabel}
                    </div>
                    {row.cells.map((cell) => (
                      <div
                        key={`${row.dayLabel}-${cell.hour}`}
                        className={`flex h-9 items-center justify-center rounded-md text-[10px] font-semibold ${heatColor(cell.intensity)}`}
                        title={`${row.dayLabel} ${analytics.heatmap.hours[cell.hour]?.label}: ${money(cell.revenue, analytics.currencySymbol)} en ${cell.count} venta(s)`}
                      >
                        {cell.count > 0 ? cell.count : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Puntos de presión
          </div>
          <div className="mt-3 space-y-3 text-sm">
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">Tendencia de reembolsos</div>
              <div className="mt-1 text-stone-500">
                {money(analytics.summary.totalRefunds, analytics.currencySymbol)} reembolsados en el periodo seleccionado.
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">Tendencia de merma</div>
              <div className="mt-1 text-stone-500">
                {money(analytics.summary.totalShrinkageValue, analytics.currencySymbol)} dados de baja mediante correcciones negativas y variaciones de conteo.
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">Plazo del proveedor</div>
              <div className="mt-1 text-stone-500">
                {analytics.summary.averageLeadTimeDays.toFixed(1)} días promedio desde la creación de la compra hasta la recepción.
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">Eventos de falta de stock</div>
              <div className="mt-1 text-stone-500">
                {analytics.summary.stockoutEvents} transición(es) de falta de stock reconstruida(s) desde el historial de movimientos.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Alta rotación
          </div>
          <div className="mt-4 space-y-3">
            {analytics.fastMovers.length ? (
              analytics.fastMovers.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="text-xs text-stone-500">{item.soldQty} vendidos / {item.currentStock} restantes</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-950">{item.avgDailySales.toFixed(1)}</div>
                    <div className="text-xs text-stone-500">unidades/día</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">Aún no hay ventas completadas en este periodo analítico.</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Baja rotación
          </div>
          <div className="mt-4 space-y-3">
            {analytics.slowMovers.length ? (
              analytics.slowMovers.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="text-xs text-stone-500">{item.currentStock} disponibles</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-950">{item.avgDailySales.toFixed(1)}</div>
                    <div className="text-xs text-stone-500">unidades/día</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">Aún no hay stock de baja rotación visible.</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Antigüedad del stock
          </div>
          <div className="mt-4 space-y-3">
            {analytics.stockAging.length ? (
              analytics.stockAging.map((item) => (
                <div key={item.productId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="font-semibold text-stone-900">{item.productName}</div>
                  <div className="mt-1 text-xs text-stone-500">
                    {item.stockQty} disponibles / última entrada {item.lastInboundAt.toLocaleDateString('es-MX')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-stone-900">{item.ageDays} día(s) de antigüedad</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">Aún no hay inventario con antigüedad disponible.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Reporte de fuga de margen
          </div>
          <div className="mt-4 space-y-3">
            {analytics.marginLeakage.length ? (
              analytics.marginLeakage.map((item) => (
                <div key={item.productId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="font-semibold text-stone-900">{item.productName}</div>
                  <div className="mt-2 flex justify-between text-xs text-stone-500">
                    <span>Descuentos</span>
                    <span>{money(item.discountLeak, analytics.currencySymbol)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-stone-500">
                    <span>Reembolsos</span>
                    <span>{money(item.refundLeak, analytics.currencySymbol)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-stone-500">
                    <span>Presión de margen</span>
                    <span>{money(item.marginSqueeze, analytics.currencySymbol)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm font-semibold text-stone-900">
                    <span>Fuga total</span>
                    <span>{money(item.totalLeak, analytics.currencySymbol)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">Aún no hay señales relevantes de fuga.</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Tendencia de reembolsos y merma
          </div>
          <div className="mt-4 space-y-3">
            {analytics.refundTrend.length ? (
              analytics.refundTrend.slice(-6).map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
                  <div>
                    <div className="font-semibold text-stone-900">{item.label}</div>
                    <div className="text-xs text-stone-500">{item.count} ajuste(s) de reembolso o cambio</div>
                  </div>
                  <div className="font-semibold text-stone-900">{money(item.total, analytics.currencySymbol)}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No se registraron reembolsos ni cambios en este periodo.</div>
            )}
            {analytics.shrinkageTrend.length ? (
              analytics.shrinkageTrend.slice(-6).map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-red-50/60 px-4 py-3 text-sm">
                  <div>
                    <div className="font-semibold text-stone-900">{item.label}</div>
                    <div className="text-xs text-stone-500">{item.qty} unidad(es) dadas de baja</div>
                  </div>
                  <div className="font-semibold text-red-700">{money(item.value, analytics.currencySymbol)}</div>
                </div>
              ))
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Plazos de compra
          </div>
          <div className="mt-4 space-y-3">
            {analytics.purchaseLeadTimes.length ? (
              analytics.purchaseLeadTimes.map((item) => (
                <div key={item.supplierId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="font-semibold text-stone-900">{item.supplierName}</div>
                  <div className="mt-1 text-xs text-stone-500">
                    {item.receiptCount} recibo(s) / última recepción {item.lastReceivedAt.toLocaleDateString('es-MX')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-stone-900">
                    {item.avgLeadTimeDays.toFixed(1)} día(s) de plazo promedio
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">El reporte de plazos aparecerá después de recibir compras.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Frecuencia de falta de stock
          </div>
          <div className="mt-4 space-y-3">
            {analytics.stockoutFrequency.length ? (
              analytics.stockoutFrequency.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="text-xs text-stone-500">
                      {item.currentStock} restantes / punto de reposición {item.reorderPoint}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-950">{item.stockoutEvents}</div>
                    <div className="text-xs text-stone-500">evento(s) de falta de stock</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No se reconstruyeron transiciones de falta de stock en este periodo.</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                Vista previa del motor de reposición
              </div>
              <div className="mt-1 text-lg font-black text-stone-950">Sugerencias prioritarias de reposición</div>
            </div>
            <Link
              href="/inventory"
              className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-white"
            >
              Revisar cola
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {analytics.reorderPreview.length ? (
              analytics.reorderPreview.map((item) => (
                <div key={item.productId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-stone-900">{item.productName}</div>
                      <div className="text-xs text-stone-500">
                        {item.supplierName} / plazo de entrega {item.leadTimeDays} día(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-stone-950">{item.suggestedQty}</div>
                      <div className="text-xs text-stone-500">sugeridas</div>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-stone-500">
                    <span>Punto de reposición {item.reorderPoint}</span>
                    <span>{money(item.suggestedCost, analytics.currencySymbol)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">Ningún producto necesita actualmente una reposición inteligente.</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
