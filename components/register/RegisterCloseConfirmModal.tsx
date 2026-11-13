'use client';

import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import { dateTime, money } from '@/lib/format';
import type { SerializedActiveCashSession } from '@/lib/serializers/register';

export default function RegisterCloseConfirmModal({
  session,
  closingActual,
  notes,
  currencySymbol,
  isClosing,
  onCancel,
  onConfirm
}: {
  session: SerializedActiveCashSession | null;
  closingActual: number;
  notes: string;
  currencySymbol: string;
  isClosing: boolean;
  onCancel: () => void;
  onConfirm: (session: SerializedActiveCashSession) => Promise<void>;
}) {
  if (!session || typeof document === 'undefined') {
    return null;
  }

  const expected = Number(session.expectedCash);
  const variance = Number((closingActual - expected).toFixed(2));

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-black text-stone-950">¿Confirmar cierre de caja?</h3>
          <p className="mt-1 text-xs text-stone-500">
            {session.cashierName} &mdash; Apertura: {dateTime(session.openedAt)}
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-center">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Esperado</div>
              <div className="mt-0.5 text-sm font-black tabular-nums text-stone-900">
                {money(expected, currencySymbol)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Contado</div>
              <div className="mt-0.5 text-sm font-black tabular-nums text-stone-900">
                {money(closingActual, currencySymbol)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Diferencia</div>
              <div
                className={`mt-0.5 text-sm font-black tabular-nums ${
                  variance > 0 ? 'text-emerald-700' : variance < 0 ? 'text-red-700' : 'text-stone-900'
                }`}
              >
                {variance > 0 ? `+${money(variance, currencySymbol)}` : money(variance, currencySymbol)}
              </div>
            </div>
          </div>

          {variance !== 0 ? (
            <div
              className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                variance > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {variance > 0
                ? `Se detectó un sobrante de ${money(variance, currencySymbol)}.`
                : `Atención: Se detectó un faltante de ${money(Math.abs(variance), currencySymbol)}.`}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              La caja se encuentra exactamente cuadrada.
            </div>
          )}

          {notes ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Notas</div>
              <div className="mt-0.5 text-xs text-stone-700">{notes}</div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
            Volver a revisar
          </Button>

          <Button
            type="button"
            className="flex-1"
            disabled={isClosing}
            onClick={() => void onConfirm(session)}
          >
            {isClosing ? 'Cerrando caja...' : 'Confirmar y cerrar'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
