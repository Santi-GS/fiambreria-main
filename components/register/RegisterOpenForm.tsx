'use client';

import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money } from '@/lib/format';
import { SerializedCashSession } from '@/lib/serializers/register';

export default function RegisterOpenForm({
  currencySymbol,
  activeSession,
  openingFloatRequired,
  openingFloatAmount
}: {
  currencySymbol: string;
  activeSession: SerializedCashSession | null;
  openingFloatRequired: boolean;
  openingFloatAmount: string;
}) {
  const [openingFloat, setOpeningFloat] = useState(openingFloatAmount);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function openRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await fetch('/api/register/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openingFloat: Number(openingFloat),
        notes: notes || null
      })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo abrir la caja.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? 'No se pudo abrir la caja.');
      return;
    }

    window.location.href = '/register/close';
  }

  if (activeSession) {
    return (
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Caja ya abierta</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">El turno actual está activo</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Ya tiene una sesión de caja activa, por lo que no se puede abrir una segunda para esta tienda.
            </p>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            Abierta el {dateTime(activeSession.openedAt)}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Fondo inicial</div>
            <div className="mt-2 text-2xl font-black text-stone-950">
              {money(activeSession.openingFloat, currencySymbol)}
            </div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Estado</div>
            <div className="mt-2 text-2xl font-black text-emerald-700">{activeSession.status === 'OPEN' ? 'Abierta' : activeSession.status}</div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Notas</div>
            <div className="mt-2 text-sm leading-6 text-stone-600">{activeSession.notes ?? 'Sin notas de apertura.'}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/register/close">
            <Button>Ir al cierre de caja</Button>
          </Link>
          <Link href="/register/history">
            <Button variant="secondary">Ver historial de caja</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Abrir caja</div>
          <h2 className="mt-2 text-2xl font-black text-stone-950">Iniciar turno de caja</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Al abrir la caja se registra el fondo inicial en efectivo y comienza el turno activo del cajero para esta sucursal.
          </p>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
          {openingFloatRequired
            ? `Esta sucursal requiere al menos ${money(openingFloatAmount, currencySymbol)} antes de poder iniciar un turno de caja.`
            : 'Un cajero solo puede tener una sesión de caja activa en la tienda a la vez.'}
        </div>
      </div>

      <form onSubmit={openRegister} className="mt-6 space-y-6">
        {openingFloatRequired ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Requisito de fondo inicial: mínimo {money(openingFloatAmount, currencySymbol)} para cada nuevo turno de caja en esta sucursal.
          </div>
        ) : null}

        <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Detalles de apertura</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">Fondo inicial</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={(event) => setOpeningFloat(event.target.value)}
                placeholder={openingFloatAmount}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">Notas</label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notas opcionales de apertura"
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={loading}>
            {loading ? 'Abriendo caja...' : 'Abrir caja'}
          </Button>
          <Link href="/register/history">
            <Button type="button" variant="secondary">Ver historial</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
