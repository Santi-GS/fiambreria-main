'use client';

import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { dateTime, money } from '@/lib/format';
import { getRegisterTimelineDisplayLabel } from '@/lib/register';
import type { SerializedActiveCashSession } from '@/lib/serializers/register';

function varianceTone(variance: number): 'emerald' | 'red' | 'stone' {
  if (variance > 0) return 'emerald';
  if (variance < 0) return 'red';
  return 'stone';
}

function movementTone(type: string): 'emerald' | 'red' | 'amber' | 'stone' {
  if (type === 'CASH_SALE' || type === 'OPENING_FLOAT' || type === 'CLOSING_COUNT') {
    return 'emerald';
  }
  if (type === 'REFUND') {
    return 'red';
  }
  if (type === 'PAYOUT' || type === 'CASH_DROP' || type === 'PETTY_CASH') {
    return 'amber';
  }
  return 'stone';
}

function formatPaymentMethod(method: string): string {
  const normalized = method.toLowerCase().trim();
  switch (normalized) {
    case 'cash':
      return 'Efectivo';
    case 'card':
      return 'Tarjeta';
    case 'e-wallet':
    case 'ewallet':
      return 'Billetera digital';
    case 'bank transfer':
    case 'bank_transfer':
      return 'Transferencia bancaria';
    case 'split':
      return 'Pago mixto';
    default:
      return method;
  }
}

export default function RegisterShiftSummaryPanel({
  session,
  currencySymbol,
  variance,
  loadingId,
  deletingMovementId,
  onRemoveMovement,
  onInitiateClose
}: {
  session: SerializedActiveCashSession;
  currencySymbol: string;
  variance: number;
  loadingId: string | null;
  deletingMovementId: string | null;
  onRemoveMovement: (session: SerializedActiveCashSession, movementId: string) => Promise<void>;
  onInitiateClose: (session: SerializedActiveCashSession) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
          Resumen del turno
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Cantidad de ventas</div>
            <div className="mt-0.5 text-xl font-black tabular-nums text-stone-950">
              {session.summary.salesCount}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Ventas brutas</div>
            <div className="mt-0.5 text-xl font-black tabular-nums text-stone-950">
              {money(session.summary.grossSalesTotal, currencySymbol)}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Ventas en efectivo</div>
            <div className="mt-0.5 text-xl font-black tabular-nums text-emerald-800">
              {money(session.summary.cashSalesTotal, currencySymbol)}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Reembolsos en efectivo</div>
            <div
              className={`mt-0.5 text-xl font-black tabular-nums ${
                Number(session.summary.refundCashTotal) > 0 ? 'text-red-700' : 'text-stone-950'
              }`}
            >
              {money(session.summary.refundCashTotal, currencySymbol)}
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-3.5">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Desglose de pagos
          </div>
          <div className="space-y-1.5">
            {session.summary.paymentBreakdown.length ? (
              session.summary.paymentBreakdown.map((entry) => (
                <div
                  key={entry.method}
                  className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-stone-700">{formatPaymentMethod(entry.method)}</span>
                  <span className="font-bold tabular-nums text-stone-900">
                    {money(entry.amount, currencySymbol)}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-3 text-center text-xs text-stone-500">
                Aún no se han registrado pagos en esta sesión.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-2.5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
              Cronología de movimientos
            </div>
            <h4 className="text-base font-black text-stone-900">Registro de efectivo del turno</h4>
          </div>
          <Badge tone={varianceTone(variance)}>
            {variance > 0 ? 'Sobrante' : variance < 0 ? 'Faltante' : 'Cuadrada'}
          </Badge>
        </div>

        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {session.summary.timeline.length ? (
            session.summary.timeline.map((entry) => {
              const translatedLabel = getRegisterTimelineDisplayLabel(entry.type, entry.label);
              const isPositive = Number(entry.amount) >= 0;
              const isMovement =
                entry.type === 'PAYOUT' ||
                entry.type === 'CASH_DROP' ||
                entry.type === 'PETTY_CASH' ||
                entry.type === 'MANUAL_CORRECTION';
              const rawMovementId = entry.id.startsWith('movement-')
                ? entry.id.replace('movement-', '')
                : entry.id;

              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 transition"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={movementTone(entry.type)}>{translatedLabel}</Badge>
                        {entry.reference ? (
                          <span className="text-xs text-stone-500">#{entry.reference}</span>
                        ) : null}
                        {isMovement ? (
                          <button
                            type="button"
                            disabled={deletingMovementId === rawMovementId}
                            onClick={() => void onRemoveMovement(session, rawMovementId)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 transition hover:bg-red-100 active:scale-95 disabled:opacity-50"
                            title="Quitar este movimiento de efectivo antes de cerrar la caja"
                          >
                            {deletingMovementId === rawMovementId ? 'Quitando...' : 'Quitar'}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs font-medium text-stone-500">
                        {dateTime(entry.occurredAt)}
                        {entry.userName ? ` / ${entry.userName}` : ''}
                      </div>
                      {entry.note ? <div className="mt-1 text-xs text-stone-700">{entry.note}</div> : null}
                    </div>

                    <div
                      className={`text-right text-base font-bold tabular-nums ${
                        isPositive ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {money(entry.amount, currencySymbol)}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-stone-200 p-4 text-center text-xs text-stone-500">
              No hay movimientos registrados en la cronología.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-1 sm:flex-row">
        <Button
          type="button"
          className="flex-1"
          disabled={loadingId === session.id}
          onClick={() => onInitiateClose(session)}
        >
          {loadingId === session.id
            ? 'Cerrando caja...'
            : session.canOverride
              ? 'Cierre administrativo forzado'
              : 'Cerrar caja'}
        </Button>

        <Link href="/register/history">
          <Button type="button" variant="secondary">
            Ver historial
          </Button>
        </Link>
      </div>
    </div>
  );
}
