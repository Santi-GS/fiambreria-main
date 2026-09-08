'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { getStockCountStatusLabel } from '@/lib/business-labels';
import { dateTime, shortDate } from '@/lib/format';

type StockCountSummary = {
  id: string;
  referenceNumber: string;
  title: string | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'CANCELLED';
  isBlind: boolean;
  notes: string | null;
  createdAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  createdBy: string;
  approvedBy: string | null;
  itemCount: number;
  countedItemCount: number;
};

function toneForStatus(status: StockCountSummary['status']) {
  switch (status) {
    case 'POSTED':
      return 'emerald';
    case 'APPROVED':
      return 'blue';
    case 'SUBMITTED':
      return 'amber';
    case 'CANCELLED':
      return 'red';
    default:
      return 'stone';
  }
}

export default function StockCountsManager({
  stockCounts
}: {
  stockCounts: StockCountSummary[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isBlind, setIsBlind] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredCounts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return stockCounts;
    }

    return stockCounts.filter((count) =>
      [
        count.referenceNumber,
        count.title ?? '',
        count.status,
        count.createdBy,
        count.approvedBy ?? ''
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [query, stockCounts]);

  const submittedCount = stockCounts.filter((count) => count.status === 'SUBMITTED').length;
  const activeCount = stockCounts.filter((count) => ['DRAFT', 'IN_PROGRESS'].includes(count.status)).length;
  const postedCount = stockCounts.filter((count) => count.status === 'POSTED').length;

  async function createStockCount() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/stock-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          notes,
          isBlind
        })
      });
      const data = await response.json().catch(() => ({ error: 'No se pudo crear el conteo de inventario.' }));

      setLoading(false);
      if (!response.ok || !data?.stockCount?.id) {
        setError(data?.error ?? 'No se pudo crear el conteo de inventario.');
        return;
      }

      router.push(`/stock-counts/${data.stockCount.id}`);
      router.refresh();
    } catch {
      setLoading(false);
      setError('No se pudo crear el conteo de inventario.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="space-y-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Nuevo conteo de inventario</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">Iniciar una hoja de conteo formal</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Crea un conteo de toda la tienda, registra las cantidades reales producto por producto y envía la variación a aprobación antes de afectar el inventario.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Activos</div>
              <div className="mt-2 text-3xl font-black text-stone-950">{activeCount}</div>
              <div className="mt-1 text-sm text-stone-500">Borrador o en curso</div>
            </div>
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Pendientes de aprobación</div>
              <div className="mt-2 text-3xl font-black text-stone-950">{submittedCount}</div>
              <div className="mt-1 text-sm text-amber-800">Conteos enviados</div>
            </div>
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Registrados</div>
              <div className="mt-2 text-3xl font-black text-stone-950">{postedCount}</div>
              <div className="mt-1 text-sm text-emerald-800">Variación ya registrada</div>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Título del conteo o turno (opcional)"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notas para este conteo (opcional)"
              className="min-h-28 w-full rounded-[24px] border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
            <label className="flex items-start gap-3 rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={isBlind}
                onChange={(event) => setIsBlind(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                <span className="block font-semibold text-stone-900">Conteo ciego</span>
                <span className="mt-1 block">Oculta las cantidades esperadas hasta enviar el conteo para conciliación.</span>
              </span>
            </label>
          </div>

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <Button type="button" disabled={loading} onClick={() => void createStockCount()}>
            {loading ? 'Creando conteo...' : 'Crear conteo'}
          </Button>
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Historial de conteos</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">Conteos operativos de inventario</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Revisa conteos en curso, estados de aprobación y si cada hoja ya registró su variación en el inventario.
              </p>
            </div>
            <div className="w-full max-w-xs">
              <Input
                placeholder="Buscar referencia, título o usuario"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-stone-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-stone-50 text-stone-500">
                  <tr>
                    <th className="px-4 py-3.5">Referencia</th>
                    <th className="px-4 py-3.5">Estado</th>
                    <th className="px-4 py-3.5">Progreso</th>
                    <th className="px-4 py-3.5">Usuarios</th>
                    <th className="px-4 py-3.5">Fechas</th>
                    <th className="px-4 py-3.5">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCounts.map((count) => (
                    <tr key={count.id} className="border-t border-stone-200 bg-white transition hover:bg-stone-50/70">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{count.referenceNumber}</div>
                        <div className="mt-1 text-sm text-stone-600">{count.title ?? 'Conteo de inventario sin título'}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone={toneForStatus(count.status)}>{getStockCountStatusLabel(count.status)}</Badge>
                          {count.isBlind ? <Badge tone="stone">Ciego</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>{count.notes ?? 'Sin notas registradas.'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">
                          {count.countedItemCount} / {count.itemCount}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">Productos contados</div>
                      </td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>{count.createdBy}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {count.approvedBy ? `Aprobado por ${count.approvedBy}` : 'Aprobación pendiente'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>Creado: {shortDate(count.createdAt)}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {count.postedAt
                            ? `Asentado: ${dateTime(count.postedAt)}`
                            : count.submittedAt
                              ? `Enviado: ${dateTime(count.submittedAt)}`
                              : count.startedAt
                                ? `Iniciado: ${dateTime(count.startedAt)}`
                                : 'No iniciado'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/stock-counts/${count.id}`}
                          className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600"
                        >
                          Abrir conteo
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!filteredCounts.length ? (
              <div className="border-t border-stone-200 bg-stone-50 py-8 text-center text-sm text-stone-500">
                Ningún conteo de inventario coincide con la búsqueda actual.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
