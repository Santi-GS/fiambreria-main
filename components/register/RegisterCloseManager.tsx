'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { getRegisterSessionStatusLabel } from '@/lib/business-labels';
import { dateTime, money } from '@/lib/format';
import {
  calculateDenominationTotal,
  createEmptyDenominationSnapshot,
  getCashMovementDisplayLabel,
  getRegisterTimelineDisplayLabel,
  REGISTER_DENOMINATIONS,
  type RegisterDenominationItem,
  type RegisterDenominationSnapshot
} from '@/lib/register';
import { SerializedActiveCashSession, SerializedCashSession } from '@/lib/serializers/register';

type CountMethod = 'DENOMINATION' | 'MANUAL';
type MovementType = 'PAYOUT' | 'CASH_DROP' | 'PETTY_CASH';

type SessionForm = {
  countMethod: CountMethod;
  closingActual: string;
  notes: string;
  denominationBreakdown: RegisterDenominationSnapshot;
  movementType: MovementType;
  movementAmount: string;
  movementNote: string;
};

type SessionForms = Record<string, SessionForm>;

const MOVEMENT_OPTIONS: MovementType[] = ['PAYOUT', 'CASH_DROP', 'PETTY_CASH'];

function createInitialForm(
  session: SerializedActiveCashSession,
  denoms: readonly RegisterDenominationItem[] | RegisterDenominationItem[] = REGISTER_DENOMINATIONS
): SessionForm {
  const denominationBreakdown =
    session.denominationBreakdown && Object.values(session.denominationBreakdown).some((value) => value > 0)
      ? session.denominationBreakdown
      : createEmptyDenominationSnapshot(denoms);

  return {
    countMethod: 'DENOMINATION',
    closingActual: session.expectedCash,
    notes: '',
    denominationBreakdown,
    movementType: 'PAYOUT',
    movementAmount: '',
    movementNote: ''
  };
}

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

export default function RegisterCloseManager({
  initialSessions,
  currencySymbol,
  denominations = REGISTER_DENOMINATIONS
}: {
  initialSessions: SerializedActiveCashSession[];
  currencySymbol: string;
  denominations?: readonly RegisterDenominationItem[] | RegisterDenominationItem[];
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [forms, setForms] = useState<SessionForms>(
    Object.fromEntries(initialSessions.map((session) => [session.id, createInitialForm(session, denominations)]))
  );
  const [result, setResult] = useState<SerializedCashSession | null>(null);
  const [error, setError] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [movementLoadingId, setMovementLoadingId] = useState<string | null>(null);
  const [confirmingSession, setConfirmingSession] = useState<SerializedActiveCashSession | null>(null);

  const sessionCountLabel = useMemo(
    () => `${sessions.length} sesión(es) activa(s) lista(s) para el cierre.`,
    [sessions.length]
  );

  function updateForm(sessionId: string, patch: Partial<SessionForm>) {
    setForms((current) => ({
      ...current,
      [sessionId]: {
        ...current[sessionId],
        ...patch
      }
    }));
  }

  function updateDenomination(
    sessionId: string,
    denominationKey: string,
    value: string
  ) {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    setForms((current) => {
      const form = current[sessionId];
      const nextBreakdown = {
        ...form.denominationBreakdown,
        [denominationKey]: count
      };
      const countedTotal = calculateDenominationTotal(nextBreakdown, denominations).toFixed(2);

      return {
        ...current,
        [sessionId]: {
          ...form,
          denominationBreakdown: nextBreakdown,
          closingActual: form.countMethod === 'DENOMINATION' ? countedTotal : form.closingActual
        }
      };
    });
  }

  function adjustDenomination(
    sessionId: string,
    denominationKey: string,
    delta: number
  ) {
    setForms((current) => {
      const form = current[sessionId];
      const currentCount = form.denominationBreakdown[denominationKey] ?? 0;
      const nextCount = Math.max(0, currentCount + delta);
      const nextBreakdown = {
        ...form.denominationBreakdown,
        [denominationKey]: nextCount
      };
      const countedTotal = calculateDenominationTotal(nextBreakdown, denominations).toFixed(2);

      return {
        ...current,
        [sessionId]: {
          ...form,
          denominationBreakdown: nextBreakdown,
          closingActual: form.countMethod === 'DENOMINATION' ? countedTotal : form.closingActual
        }
      };
    });
  }

  function clearDenominations(sessionId: string) {
    setForms((current) => {
      const form = current[sessionId];
      const nextBreakdown = createEmptyDenominationSnapshot(denominations);
      return {
        ...current,
        [sessionId]: {
          ...form,
          denominationBreakdown: nextBreakdown,
          closingActual: form.countMethod === 'DENOMINATION' ? '0.00' : form.closingActual
        }
      };
    });
  }

  async function recordMovement(session: SerializedActiveCashSession) {
    const form = forms[session.id];
    setError('');

    if (!form?.movementAmount || Number(form.movementAmount) <= 0) {
      setError('Ingrese un monto de movimiento de efectivo mayor a cero.');
      return;
    }

    if (!form.movementNote.trim()) {
      setError('Agregue una nota para que el movimiento de efectivo sea auditable.');
      return;
    }

    setMovementLoadingId(session.id);

    const response = await fetch(`/api/register/sessions/${session.id}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: form.movementType,
        amount: Number(form.movementAmount),
        note: form.movementNote
      })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo registrar el movimiento de efectivo.' }));
    setMovementLoadingId(null);

    if (!response.ok || !data?.summary) {
      setError(data?.error ?? 'No se pudo registrar el movimiento de efectivo.');
      return;
    }

    setSessions((current) =>
      current.map((entry) =>
        entry.id === session.id
          ? {
              ...entry,
              expectedCash: data.summary.expectedCash,
              summary: data.summary
            }
          : entry
      )
    );
    updateForm(session.id, { movementAmount: '', movementNote: '' });
  }

  function initiateCloseSession(session: SerializedActiveCashSession) {
    const form = forms[session.id];
    setError('');

    if (!form) return;

    if (session.canOverride && !form.notes.trim()) {
      setError('Agregue una nota de anulación antes de cerrar la sesión de caja de otro cajero.');
      return;
    }

    if (form.countMethod === 'MANUAL' && (!form.closingActual || Number(form.closingActual) < 0)) {
      setError('Ingrese un monto de cierre manual válido mayor o igual a cero.');
      return;
    }

    setConfirmingSession(session);
  }

  async function executeCloseSession(session: SerializedActiveCashSession) {
    const form = forms[session.id];
    setError('');

    if (!form) return;

    setLoadingId(session.id);

    const response = await fetch(`/api/register/sessions/${session.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closingActual: Number(form.closingActual),
        denominationBreakdown:
          form.countMethod === 'DENOMINATION' ? form.denominationBreakdown : null,
        notes: form.notes || null
      })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo cerrar la sesión de caja.' }));
    setLoadingId(null);
    setConfirmingSession(null);

    if (!response.ok || !data?.session) {
      setError(data?.error ?? 'No se pudo cerrar la sesión de caja.');
      return;
    }

    setResult(data.session);
    setSessions((current) => current.filter((entry) => entry.id !== session.id));
  }

  if (!sessions.length) {
    return (
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Cierre de caja</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">No hay sesiones activas para cerrar</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              No hay sesiones de caja abiertas disponibles para cerrar en este momento.
            </p>
          </div>

          <Link href="/register/open">
            <Button>Abrir una caja</Button>
          </Link>
        </div>

        {result ? (
          <div className="mt-6 rounded-[26px] border border-emerald-200 bg-emerald-50 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Última sesión cerrada
            </div>
            <div className="mt-2 text-lg font-black text-emerald-950">
              {result.cashierName} / Diferencia: <span className="tabular-nums">{money(result.variance, currencySymbol)}</span>
            </div>
            <div className="mt-1 text-sm text-emerald-800">
              Cerrada {result.closedAt ? dateTime(result.closedAt) : 'recién'} con esperado{' '}
              <span className="font-bold tabular-nums">{money(result.closingExpected, currencySymbol)}</span> y real{' '}
              <span className="font-bold tabular-nums">{money(result.closingActual, currencySymbol)}</span>.
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/print/register-z-read/${result.id}?autoprint=1`}>
                <Button type="button">Imprimir reporte Z</Button>
              </Link>
              <Link href="/register/history">
                <Button type="button" variant="secondary">
                  Ver historial de caja
                </Button>
              </Link>
            </div>
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado descriptivo de la vista */}
      <Card>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Cierre de turno</div>
            <h2 className="mt-1 text-2xl font-black text-stone-950">Cerrar sesiones de caja activas</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">
              Cuente las denominaciones, registre movimientos de efectivo no comerciales, compare el efectivo esperado contra el real y obtenga un reporte Z para revisión del supervisor.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-700 self-start xl:self-auto">
            {sessionCountLabel}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}
      </Card>

      {/* Tarjetas de sesiones activas */}
      {sessions.map((session) => {
        const form = forms[session.id];
        const countedTotal = calculateDenominationTotal(
          form?.denominationBreakdown ?? createEmptyDenominationSnapshot(denominations),
          denominations
        );
        const actual = Number(form?.closingActual ?? 0);
        const expected = Number(session.expectedCash);
        const variance = Number((actual - expected).toFixed(2));

        return (
          <Card key={session.id}>
            {/* Cabecera de la sesión */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={session.canOverride ? 'amber' : 'emerald'}>
                    {session.canOverride ? 'Cierre administrativo' : 'Sesión propia'}
                  </Badge>
                  <Badge tone="stone">{getRegisterSessionStatusLabel(session.status)}</Badge>
                  {session.reopenedAt ? <Badge tone="amber">Turno reabierto</Badge> : null}
                </div>
                <h3 className="mt-2 text-2xl font-black text-stone-950">{session.cashierName}</h3>
                <p className="mt-0.5 text-sm text-stone-600">{session.cashierEmail ?? 'Cuenta de cajero'}</p>
              </div>

              {/* 4 Bloques de datos de apertura y balance */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 w-full lg:w-auto">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">Apertura</div>
                  <div className="mt-1 text-sm font-bold text-stone-900">{dateTime(session.openedAt)}</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">Fondo inicial</div>
                  <div className="mt-1 text-base font-black tabular-nums text-stone-950">
                    {money(session.openingFloat, currencySymbol)}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">Efectivo esperado</div>
                  <div className="mt-1 text-base font-black tabular-nums text-emerald-800">
                    {money(session.expectedCash, currencySymbol)}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
                    {variance > 0 ? 'Sobrante' : variance < 0 ? 'Faltante' : 'Diferencia'}
                  </div>
                  <div
                    className={`mt-1 text-base font-black tabular-nums ${
                      variance > 0 ? 'text-emerald-700' : variance < 0 ? 'text-red-700' : 'text-stone-950'
                    }`}
                  >
                    {variance > 0 ? `+${money(variance, currencySymbol)}` : money(variance, currencySymbol)}
                  </div>
                </div>
              </div>
            </div>

            {/* Grilla principal de 2 columnas balanceadas */}
            <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              {/* Columna Izquierda: Arqueo, Billetes y Movimientos */}
              <div className="space-y-5">
                {/* Caja de Conteo */}
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-4">
                  {/* Selector de modo y botones */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
                        Efectivo contado
                      </div>
                      <div className="mt-0.5 text-2xl font-black tabular-nums text-stone-950">
                        {money(actual, currencySymbol)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateForm(session.id, {
                            countMethod: 'DENOMINATION',
                            closingActual: countedTotal.toFixed(2)
                          })
                        }
                        className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                          form.countMethod === 'DENOMINATION'
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        Conteo por billetes
                      </button>
                      <button
                        type="button"
                        onClick={() => updateForm(session.id, { countMethod: 'MANUAL' })}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                          form.countMethod === 'MANUAL'
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        Monto manual
                      </button>
                      {form.countMethod === 'DENOMINATION' ? (
                        <button
                          type="button"
                          onClick={() => clearDenominations(session.id)}
                          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
                          title="Poner todos los billetes contados en cero"
                        >
                          Reiniciar
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Resumen de totales contados */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
                        Total por denominación
                      </div>
                      <div className="mt-1 text-lg font-black tabular-nums text-stone-950">
                        {money(countedTotal, currencySymbol)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
                        {variance > 0 ? 'Sobrante' : variance < 0 ? 'Faltante' : 'Estado de caja'}
                      </div>
                      <div
                        className={`mt-1 text-lg font-black tabular-nums ${
                          variance > 0 ? 'text-emerald-700' : variance < 0 ? 'text-red-700' : 'text-stone-950'
                        }`}
                      >
                        {variance === 0
                          ? 'Cuadrada exacta'
                          : variance > 0
                            ? `+${money(variance, currencySymbol)}`
                            : money(variance, currencySymbol)}
                      </div>
                    </div>
                  </div>

                  {/* Lista de Denominaciones con controles estrictamente alineados */}
                  {form.countMethod === 'DENOMINATION' ? (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {denominations.map((denomination) => {
                        const key = denomination.value.toFixed(2);
                        const count = form.denominationBreakdown[key] ?? 0;
                        const subtotal = denomination.value * count;

                        return (
                          <div
                            key={key}
                            className="rounded-xl border border-stone-200 bg-white p-3 space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-bold text-stone-900">{denomination.label}</div>
                                <div className="text-xs text-stone-500">{money(denomination.value, currencySymbol)} c/u</div>
                              </div>
                              <div className="text-right text-sm font-black tabular-nums text-stone-900">
                                {money(subtotal, currencySymbol)}
                              </div>
                            </div>

                            {/* Fila de controles con anchos y alturas fijas */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => adjustDenomination(session.id, key, -1)}
                                disabled={count <= 0}
                                className="h-10 w-10 shrink-0 rounded-lg border border-stone-200 bg-stone-50 font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-30 disabled:pointer-events-none transition text-sm flex items-center justify-center"
                                title="Restar 1"
                                aria-label={`Restar 1 a ${denomination.label}`}
                              >
                                -1
                              </button>

                              <input
                                type="number"
                                min="0"
                                step="1"
                                className="h-10 w-16 shrink-0 rounded-lg border border-stone-200 bg-white text-center font-bold text-base tabular-nums text-stone-950 outline-none focus:border-emerald-500"
                                value={String(count)}
                                onChange={(event) => updateDenomination(session.id, key, event.target.value)}
                                aria-label={`Cantidad para ${denomination.label}`}
                              />

                              <button
                                type="button"
                                onClick={() => adjustDenomination(session.id, key, 1)}
                                className="h-10 w-10 shrink-0 rounded-lg border border-stone-200 bg-stone-50 font-bold text-stone-700 hover:bg-stone-100 transition text-sm flex items-center justify-center"
                                title="Sumar 1"
                                aria-label={`Sumar 1 a ${denomination.label}`}
                              >
                                +1
                              </button>

                              <button
                                type="button"
                                onClick={() => adjustDenomination(session.id, key, 10)}
                                className="h-10 w-14 shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 font-bold text-emerald-800 hover:bg-emerald-100 transition text-xs flex items-center justify-center"
                                title="Sumar fajo de 10"
                                aria-label={`Sumar fajo de 10 a ${denomination.label}`}
                              >
                                +10
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* Campos de Efectivo real y Notas */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Efectivo real contado
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.countMethod === 'DENOMINATION' ? countedTotal.toFixed(2) : form.closingActual}
                        onChange={(event) => updateForm(session.id, { closingActual: event.target.value })}
                        disabled={form.countMethod === 'DENOMINATION'}
                        required
                      />
                      <div className="mt-1 text-xs text-stone-500">
                        {form.countMethod === 'DENOMINATION'
                          ? 'Calculado automáticamente por denominaciones.'
                          : 'Ingrese el total contado manualmente.'}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Notas de cierre
                      </label>
                      <Input
                        value={form.notes}
                        onChange={(event) => updateForm(session.id, { notes: event.target.value })}
                        placeholder={
                          session.canOverride
                            ? 'Motivo del cierre administrativo'
                            : 'Observaciones de caja para auditoría'
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Movimientos de Efectivo (no ventas) */}
                <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
                        Movimientos de efectivo (no ventas)
                      </div>
                      <h4 className="mt-0.5 text-base font-black text-stone-900">
                        Retiros, depósitos a caja fuerte y caja chica
                      </h4>
                      <p className="mt-0.5 text-xs text-stone-600">
                        Registre egresos o ingresos de efectivo antes del cierre para mantener la precisión del efectivo esperado.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {MOVEMENT_OPTIONS.map((type) => (
                        <div key={type} className="rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 truncate">
                            {getCashMovementDisplayLabel(type)}
                          </div>
                          <div className="mt-0.5 text-xs font-bold tabular-nums text-stone-900">
                            {money(session.summary.movementTotals[type], currencySymbol)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Formulario de movimiento alineado */}
                  <div className="grid gap-2.5 sm:grid-cols-[1fr_0.9fr_1.4fr_auto]">
                    <select
                      className="h-11 rounded-2xl border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-emerald-500"
                      value={form.movementType}
                      onChange={(event) => updateForm(session.id, { movementType: event.target.value as MovementType })}
                    >
                      {MOVEMENT_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {getCashMovementDisplayLabel(type)}
                        </option>
                      ))}
                    </select>

                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Monto"
                      value={form.movementAmount}
                      onChange={(event) => updateForm(session.id, { movementAmount: event.target.value })}
                    />

                    <Input
                      placeholder="Motivo o concepto"
                      value={form.movementNote}
                      onChange={(event) => updateForm(session.id, { movementNote: event.target.value })}
                    />

                    <Button
                      type="button"
                      variant="secondary"
                      disabled={movementLoadingId === session.id}
                      onClick={() => void recordMovement(session)}
                    >
                      {movementLoadingId === session.id ? 'Guardando...' : 'Registrar'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Resumen de Turno, Pagos y Cronología */}
              <div className="space-y-5">
                {/* Resumen Operativo */}
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-4">
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

                  {/* Desglose de pagos */}
                  <div className="rounded-xl border border-stone-200 bg-white p-3.5 space-y-2">
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
                            <span className="text-stone-700 font-medium">{formatPaymentMethod(entry.method)}</span>
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

                {/* Cronología de auditoría */}
                <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
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

                  <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                    {session.summary.timeline.length ? (
                      session.summary.timeline.map((entry) => {
                        const translatedLabel = getRegisterTimelineDisplayLabel(entry.type, entry.label);
                        const isPositive = Number(entry.amount) >= 0;

                        return (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-stone-150 bg-stone-50 px-3.5 py-2.5 transition"
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge tone={movementTone(entry.type)}>{translatedLabel}</Badge>
                                  {entry.reference ? (
                                    <span className="text-xs text-stone-500">#{entry.reference}</span>
                                  ) : null}
                                </div>
                                <div className="mt-1 text-xs text-stone-500 font-medium">
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

                {/* Botones de acción principales */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={loadingId === session.id}
                    onClick={() => initiateCloseSession(session)}
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
            </div>
          </Card>
        );
      })}

      {/* Modal de confirmación limpio */}
      {confirmingSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-black text-stone-950">¿Confirmar cierre de caja?</h3>
              <p className="mt-1 text-xs text-stone-500">
                {confirmingSession.cashierName} &mdash; Apertura: {dateTime(confirmingSession.openedAt)}
              </p>
            </div>

            {(() => {
              const form = forms[confirmingSession.id];
              const actual = Number(form?.closingActual ?? 0);
              const expected = Number(confirmingSession.expectedCash);
              const variance = Number((actual - expected).toFixed(2));

              return (
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
                        {money(actual, currencySymbol)}
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

                  {form.notes ? (
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Notas</div>
                      <div className="mt-0.5 text-xs text-stone-700">{form.notes}</div>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmingSession(null)}
              >
                Volver a revisar
              </Button>

              <Button
                type="button"
                className="flex-1"
                disabled={loadingId === confirmingSession.id}
                onClick={() => void executeCloseSession(confirmingSession)}
              >
                {loadingId === confirmingSession.id ? 'Cerrando caja...' : 'Confirmar y cerrar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
