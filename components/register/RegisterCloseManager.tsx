'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import {
  calculateDenominationTotal,
  createEmptyDenominationSnapshot,
  getCashMovementLabel,
  REGISTER_DENOMINATIONS,
  type RegisterDenominationItem,
  type RegisterDenominationSnapshot
} from '@/lib/register';
import { dateTime, money } from '@/lib/format';
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

function varianceTone(variance: number) {
  if (variance > 0) return 'emerald';
  if (variance < 0) return 'red';
  return 'stone';
}

function movementTone(type: string) {
  if (type === 'CASH_SALE' || type === 'OPENING_FLOAT' || type === 'CLOSING_COUNT') {
    return 'emerald';
  }

  if (type === 'REFUND') {
    return 'red';
  }

  return 'amber';
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

  async function closeSession(session: SerializedActiveCashSession) {
    const form = forms[session.id];
    setError('');

    if (!form) return;

    if (session.canOverride && !form.notes.trim()) {
      setError('Agregue una nota de anulación antes de cerrar la sesión de caja de otro cajero.');
      return;
    }

    if (form.countMethod === 'MANUAL' && (!form.closingActual || Number(form.closingActual) < 0)) {
      setError('Ingrese un monto de cierre manual válido.');
      return;
    }

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
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Última sesión cerrada</div>
            <div className="mt-2 text-lg font-black text-emerald-800">
              {result.cashierName} / Diferencia: {money(result.variance, currencySymbol)}
            </div>
            <div className="mt-1 text-sm text-emerald-700">
              Cerrada {result.closedAt ? dateTime(result.closedAt) : 'recién'} con esperado {money(result.closingExpected, currencySymbol)} y real {money(result.closingActual, currencySymbol)}.
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/print/register-z-read/${result.id}?autoprint=1`}>
                <Button type="button">Imprimir reporte Z</Button>
              </Link>
              <Link href="/register/history">
                <Button type="button" variant="secondary">Ver historial de caja</Button>
              </Link>
            </div>
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Cierre de turno</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">Cerrar sesiones de caja activas</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Cuente las denominaciones, registre movimientos de efectivo no comerciales, compare el efectivo esperado contra el real y obtenga un reporte Z para revisión del supervisor.
            </p>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            {sessionCountLabel}
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
      </Card>

      {sessions.map((session) => {
        const form = forms[session.id];
        const countedTotal = calculateDenominationTotal(form?.denominationBreakdown ?? createEmptyDenominationSnapshot(denominations), denominations);
        const actual = Number(form?.closingActual ?? 0);
        const expected = Number(session.expectedCash);
        const variance = Number((actual - expected).toFixed(2));

        return (
          <Card key={session.id}>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={session.canOverride ? 'amber' : 'emerald'}>
                    {session.canOverride ? 'Cierre administrativo' : 'Sesión propia'}
                  </Badge>
                  <Badge tone="stone">{session.status === 'OPEN' ? 'Abierta' : session.status}</Badge>
                  {session.reopenedAt ? <Badge tone="amber">Turno reabierto</Badge> : null}
                </div>
                <h3 className="mt-3 text-2xl font-black text-stone-950">{session.cashierName}</h3>
                <p className="mt-1 text-sm text-stone-500">{session.cashierEmail ?? 'Cuenta de cajero'}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Apertura</div>
                  <div className="mt-1 text-sm font-semibold text-stone-900">{dateTime(session.openedAt)}</div>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Fondo inicial</div>
                  <div className="mt-1 text-lg font-black text-stone-950">{money(session.openingFloat, currencySymbol)}</div>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Efectivo esperado</div>
                  <div className="mt-1 text-lg font-black text-emerald-700">{money(session.expectedCash, currencySymbol)}</div>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Diferencia</div>
                  <div className={`mt-1 text-lg font-black ${variance > 0 ? 'text-emerald-700' : variance < 0 ? 'text-red-700' : 'text-stone-950'}`}>
                    {money(variance, currencySymbol)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
              <div className="space-y-4">
                <div className="rounded-[26px] border border-stone-200 bg-stone-50/85 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Efectivo contado</div>
                      <div className="mt-1 text-xl font-black text-stone-950">{money(actual, currencySymbol)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateForm(session.id, { countMethod: 'DENOMINATION', closingActual: countedTotal.toFixed(2) })}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${form.countMethod === 'DENOMINATION' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}
                      >
                        Conteo por billetes/monedas
                      </button>
                      <button
                        type="button"
                        onClick={() => updateForm(session.id, { countMethod: 'MANUAL' })}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${form.countMethod === 'MANUAL' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}
                      >
                        Monto manual
                      </button>
                      {form.countMethod === 'DENOMINATION' ? (
                        <button
                          type="button"
                          onClick={() => clearDenominations(session.id)}
                          className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-100"
                          title="Poner todos los billetes contados en cero"
                        >
                          Reiniciar conteo
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Total por denominación</div>
                      <div className="mt-1 text-lg font-black text-stone-950">{money(countedTotal, currencySymbol)}</div>
                    </div>
                    <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Sobrante / Faltante</div>
                      <div className={`mt-1 text-lg font-black ${variance > 0 ? 'text-emerald-700' : variance < 0 ? 'text-red-700' : 'text-stone-950'}`}>
                        {money(variance, currencySymbol)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {denominations.map((denomination) => {
                      const key = denomination.value.toFixed(2);
                      const count = form.denominationBreakdown[key] ?? 0;
                      return (
                        <div key={key} className="rounded-[22px] border border-stone-200 bg-white px-4 py-3">
                          <div className="text-sm font-semibold text-stone-900">{denomination.label}</div>
                          <div className="mt-1 text-xs text-stone-500">{money(denomination.value, currencySymbol)} c/u</div>
                          <div className="mt-3 flex items-center gap-3">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={String(count)}
                              onChange={(event) => updateDenomination(session.id, key, event.target.value)}
                            />
                            <div className="min-w-[88px] text-right text-sm font-semibold text-stone-700">
                              {money(denomination.value * count, currencySymbol)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-stone-700">Efectivo real contado</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.countMethod === 'DENOMINATION' ? countedTotal.toFixed(2) : form.closingActual}
                        onChange={(event) => updateForm(session.id, { closingActual: event.target.value })}
                        disabled={form.countMethod === 'DENOMINATION'}
                        required
                      />
                      <div className="mt-2 text-xs text-stone-500">
                        {form.countMethod === 'DENOMINATION'
                          ? 'El total del cierre proviene del desglose de denominaciones.'
                          : 'Use el conteo manual solo cuando el desglose por denominación no sea práctico.'}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-stone-700">Notas de cierre</label>
                      <Input
                        value={form.notes}
                        onChange={(event) => updateForm(session.id, { notes: event.target.value })}
                        placeholder={session.canOverride ? 'Motivo del cierre administrativo' : 'Notas de caja para revisión'}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Movimientos de efectivo (no ventas)</div>
                      <h4 className="mt-2 text-lg font-black text-stone-900">Retiros, depósitos y caja chica</h4>
                      <p className="mt-1 text-sm text-stone-500">Registre el efectivo que sale o entra a la caja antes del cierre para mantener la precisión del efectivo esperado.</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {MOVEMENT_OPTIONS.map((type) => (
                        <div key={type} className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                          {getCashMovementLabel(type)}
                          <div className="mt-1 font-semibold text-stone-900">
                            {money(session.summary.movementTotals[type], currencySymbol)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,1.4fr)_auto]">
                    <select
                      className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-emerald-500"
                      value={form.movementType}
                      onChange={(event) => updateForm(session.id, { movementType: event.target.value as MovementType })}
                    >
                      {MOVEMENT_OPTIONS.map((type) => (
                        <option key={type} value={type}>{getCashMovementLabel(type)}</option>
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
                      placeholder="Motivo o nota"
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

              <div className="space-y-4">
                <div className="rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,245,244,0.94))] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Resumen del turno</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Cantidad de ventas</div>
                      <div className="mt-1 text-2xl font-black text-stone-950">{session.summary.salesCount}</div>
                    </div>
                    <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Ventas brutas</div>
                      <div className="mt-1 text-2xl font-black text-stone-950">{money(session.summary.grossSalesTotal, currencySymbol)}</div>
                    </div>
                    <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Ventas en efectivo</div>
                      <div className="mt-1 text-2xl font-black text-emerald-700">{money(session.summary.cashSalesTotal, currencySymbol)}</div>
                    </div>
                    <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Reembolsos en efectivo</div>
                      <div className={`mt-1 text-2xl font-black ${Number(session.summary.refundCashTotal) > 0 ? 'text-red-700' : 'text-stone-950'}`}>{money(session.summary.refundCashTotal, currencySymbol)}</div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-stone-200 bg-white px-4 py-4">
                    <div className="text-sm font-semibold text-stone-900">Desglose de pagos</div>
                    <div className="mt-3 space-y-2">
                      {session.summary.paymentBreakdown.length ? session.summary.paymentBreakdown.map((entry) => (
                        <div key={entry.method} className="flex items-center justify-between rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
                          <span className="text-stone-600">{entry.method === 'Cash' ? 'Efectivo' : entry.method === 'Card' ? 'Tarjeta' : entry.method === 'E-Wallet' ? 'Billetera digital' : entry.method === 'Bank Transfer' ? 'Transferencia bancaria' : entry.method}</span>
                          <span className="font-semibold text-stone-900">{money(entry.amount, currencySymbol)}</span>
                        </div>
                      )) : (
                        <div className="rounded-[18px] border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-sm text-stone-500">
                          Aún no se han registrado pagos en esta sesión.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-stone-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Cronología de movimientos de efectivo</div>
                      <h4 className="mt-2 text-lg font-black text-stone-900">Registro de efectivo del turno</h4>
                    </div>
                    <Badge tone={varianceTone(variance)}>
                      {variance > 0 ? 'Sobrante' : variance < 0 ? 'Faltante' : 'Cuadrado'}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    {session.summary.timeline.map((entry) => (
                      <div key={entry.id} className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={movementTone(entry.type)}>{entry.label}</Badge>
                              {entry.reference ? <span className="text-xs text-stone-500">{entry.reference}</span> : null}
                            </div>
                            <div className="mt-2 text-sm text-stone-500">
                              {dateTime(entry.occurredAt)}
                              {entry.userName ? ` / ${entry.userName}` : ''}
                            </div>
                            {entry.note ? <div className="mt-2 text-sm text-stone-700">{entry.note}</div> : null}
                          </div>
                          <div className={`text-right text-lg font-black ${Number(entry.amount) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {Number(entry.amount) >= 0 ? '+' : ''}
                            {money(entry.amount, currencySymbol)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                disabled={loadingId === session.id}
                onClick={() => void closeSession(session)}
              >
                {loadingId === session.id
                  ? 'Cerrando caja...'
                  : session.canOverride
                    ? 'Cierre administrativo forzado'
                    : 'Cerrar caja'}
              </Button>
              <Link href="/register/history">
                <Button type="button" variant="secondary">Ver historial</Button>
              </Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
