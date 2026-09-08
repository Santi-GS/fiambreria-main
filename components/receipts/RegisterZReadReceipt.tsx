'use client';

import { useEffect } from 'react';
import Button from '@/components/ui/Button';
import { dateTime, money } from '@/lib/format';
import { SerializedCashSession, SerializedRegisterSessionSummary } from '@/lib/serializers/register';

export default function RegisterZReadReceipt({
  session,
  summary,
  shop,
  currencySymbol,
  autoprint = false
}: {
  session: SerializedCashSession;
  summary: SerializedRegisterSessionSummary;
  shop: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  currencySymbol: string;
  autoprint?: boolean;
}) {
  useEffect(() => {
    if (!autoprint) return;
    const timer = setTimeout(() => window.print(), 450);
    return () => clearTimeout(timer);
  }, [autoprint]);

  return (
    <div className="space-y-4">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          body * {
            visibility: hidden;
          }

          .zread-root,
          .zread-root * {
            visibility: visible;
          }

          .zread-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .zread-print-hide {
            display: none !important;
          }
        }
      `}</style>

      <div className="zread-print-hide">
        <Button type="button" onClick={() => window.print()}>
          Imprimir resumen Z
        </Button>
      </div>

      <div className="zread-root mx-auto max-w-5xl rounded-[32px] border border-stone-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 border-b border-dashed border-stone-300 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Resumen Z de caja</div>
            <h1 className="mt-2 text-3xl font-black text-stone-950">{shop.name}</h1>
            <div className="mt-2 space-y-1 text-sm text-stone-600">
              {shop.address ? <div>{shop.address}</div> : null}
              <div>
                {shop.phone || 'Sin teléfono'}
                {shop.email ? ` / ${shop.email}` : ''}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Cajero</div>
              <div className="mt-1 text-lg font-black text-stone-950">{session.cashierName}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Estado</div>
              <div className="mt-1 text-lg font-black text-stone-950">{session.status}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Apertura</div>
              <div className="mt-1 text-sm font-semibold text-stone-900">{dateTime(session.openedAt)}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Cierre</div>
              <div className="mt-1 text-sm font-semibold text-stone-900">{session.closedAt ? dateTime(session.closedAt) : 'Aún abierta'}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Fondo inicial</div>
            <div className="mt-2 text-2xl font-black text-stone-950">{money(session.openingFloat, currencySymbol)}</div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Efectivo esperado</div>
            <div className="mt-2 text-2xl font-black text-emerald-700">{money(session.closingExpected ?? summary.expectedCash, currencySymbol)}</div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Efectivo real</div>
            <div className="mt-2 text-2xl font-black text-stone-950">{money(session.closingActual, currencySymbol)}</div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Diferencia</div>
            <div className={`mt-2 text-2xl font-black ${Number(session.variance ?? 0) > 0 ? 'text-emerald-700' : Number(session.variance ?? 0) < 0 ? 'text-red-700' : 'text-stone-950'}`}>
              {money(session.variance, currencySymbol)}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <section className="rounded-[26px] border border-stone-200 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Resumen de ventas</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Cantidad de ventas</div>
                  <div className="mt-1 text-2xl font-black text-stone-950">{summary.salesCount}</div>
                </div>
                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Ventas brutas</div>
                  <div className="mt-1 text-2xl font-black text-stone-950">{money(summary.grossSalesTotal, currencySymbol)}</div>
                </div>
                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Ventas en efectivo</div>
                  <div className="mt-1 text-2xl font-black text-emerald-700">{money(summary.cashSalesTotal, currencySymbol)}</div>
                </div>
                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Reembolsos en efectivo</div>
                  <div className={`mt-1 text-2xl font-black ${Number(summary.refundCashTotal) > 0 ? 'text-red-700' : 'text-stone-950'}`}>{money(summary.refundCashTotal, currencySymbol)}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[26px] border border-stone-200 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Desglose por medio de pago</div>
              <div className="mt-4 space-y-2">
                {summary.paymentBreakdown.length ? summary.paymentBreakdown.map((entry) => (
                  <div key={entry.method} className="flex items-center justify-between rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
                    <span className="text-stone-600">
                      {entry.method === 'Cash'
                        ? 'Efectivo'
                        : entry.method === 'Card'
                        ? 'Tarjeta'
                        : entry.method === 'E-Wallet'
                        ? 'Billetera virtual'
                        : entry.method === 'Bank Transfer'
                        ? 'Transferencia bancaria'
                        : entry.method}
                    </span>
                    <span className="font-semibold text-stone-900">{money(entry.amount, currencySymbol)}</span>
                  </div>
                )) : (
                  <div className="rounded-[18px] border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-stone-500">
                    No se registraron ventas completadas en este turno.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[26px] border border-stone-200 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Salidas de efectivo</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Pagos / Retiros</div>
                  <div className="mt-1 text-xl font-black text-stone-950">{money(summary.movementTotals.PAYOUT, currencySymbol)}</div>
                </div>
                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Remesas de caja</div>
                  <div className="mt-1 text-xl font-black text-stone-950">{money(summary.movementTotals.CASH_DROP, currencySymbol)}</div>
                </div>
                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Caja chica</div>
                  <div className="mt-1 text-xl font-black text-stone-950">{money(summary.movementTotals.PETTY_CASH, currencySymbol)}</div>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[26px] border border-stone-200 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Cronología de movimientos de efectivo</div>
              <div className="mt-4 space-y-3">
                {summary.timeline.map((entry) => (
                  <div key={entry.id} className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-stone-900">
                          {entry.label}
                          {entry.reference ? ` / ${entry.reference}` : ''}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">
                          {dateTime(entry.occurredAt)}
                          {entry.userName ? ` / ${entry.userName}` : ''}
                        </div>
                        {entry.note ? <div className="mt-2 text-sm text-stone-600">{entry.note}</div> : null}
                      </div>
                      <div className={`text-right text-lg font-black ${Number(entry.amount) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {Number(entry.amount) >= 0 ? '+' : ''}
                        {money(entry.amount, currencySymbol)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[26px] border border-stone-200 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Controles de gerencia y auditoría</div>
              <div className="mt-4 space-y-3 text-sm text-stone-600">
                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="font-semibold text-stone-900">Revisión</div>
                  <div className="mt-1">
                    {session.reviewedAt
                      ? `Aprobado el ${dateTime(session.reviewedAt)}${session.reviewedByName ? ` por ${session.reviewedByName}` : ''}.`
                      : 'En espera de revisión de gerencia.'}
                  </div>
                  {session.reviewNote ? <div className="mt-2">{session.reviewNote}</div> : null}
                </div>
                <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="font-semibold text-stone-900">Historial de reapertura</div>
                  <div className="mt-1">
                    {session.reopenedAt
                      ? `Reabierto el ${dateTime(session.reopenedAt)}${session.reopenedByName ? ` por ${session.reopenedByName}` : ''}.`
                      : 'Sin actividad de reapertura registrada para este turno.'}
                  </div>
                  {session.reopenReason ? <div className="mt-2">{session.reopenReason}</div> : null}
                </div>
                {session.notes ? (
                  <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3">
                    <div className="font-semibold text-stone-900">Notas</div>
                    <div className="mt-2 whitespace-pre-wrap">{session.notes}</div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
