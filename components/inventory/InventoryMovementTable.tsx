'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import { getInventoryMovementTypeLabel } from '@/lib/business-labels';
import { dateTime } from '@/lib/format';

type Movement = {
  id: string;
  type: string;
  qtyChange: number;
  referenceId?: string | null;
  notes?: string | null;
  reasonLabel?: string | null;
  reasonCode?: string | null;
  createdAt: string;
  product: {
    name: string;
  };
};

function toneForType(type: string) {
  const normalized = type.toUpperCase();

  if (normalized.includes('SALE')) {
    return 'red';
  }

  if (normalized.includes('PURCHASE') || normalized.includes('OPENING')) {
    return 'emerald';
  }

  if (normalized.includes('COUNT')) {
    return 'blue';
  }

  return 'stone';
}

export default function InventoryMovementTable({
  movements
}: {
  movements: Movement[];
  lowStockThreshold: number;
}) {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const filteredMovements = useMemo(() => {
    const term = search.toLowerCase().trim();

    return movements.filter((movement) => {
      // Type filter
      if (filterType !== 'ALL') {
        const norm = movement.type.toUpperCase();
        if (filterType === 'SALE' && !norm.includes('SALE')) return false;
        if (filterType === 'PURCHASE' && !norm.includes('PURCHASE')) return false;
        if (filterType === 'ADJUSTMENT' && !norm.includes('ADJUSTMENT')) return false;
        if (filterType === 'COUNT' && !norm.includes('COUNT')) return false;
      }

      // Text search
      if (term) {
        const matchesProduct = movement.product.name.toLowerCase().includes(term);
        const matchesRef = movement.referenceId?.toLowerCase().includes(term);
        const matchesReason = movement.reasonLabel?.toLowerCase().includes(term);
        const matchesNotes = movement.notes?.toLowerCase().includes(term);
        return Boolean(matchesProduct || matchesRef || matchesReason || matchesNotes);
      }

      return true;
    });
  }, [movements, filterType, search]);

  if (!movements.length) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-sm text-stone-500">
        Aún no hay registros de movimientos de inventario.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de herramientas táctil y filtros rápidos */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`min-h-[40px] rounded-xl px-3.5 text-xs font-bold transition active:scale-95 ${
              filterType === 'ALL'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            Todos ({movements.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('SALE')}
            className={`min-h-[40px] rounded-xl px-3.5 text-xs font-bold transition active:scale-95 ${
              filterType === 'SALE'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            Ventas
          </button>
          <button
            type="button"
            onClick={() => setFilterType('PURCHASE')}
            className={`min-h-[40px] rounded-xl px-3.5 text-xs font-bold transition active:scale-95 ${
              filterType === 'PURCHASE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            Compras
          </button>
          <button
            type="button"
            onClick={() => setFilterType('ADJUSTMENT')}
            className={`min-h-[40px] rounded-xl px-3.5 text-xs font-bold transition active:scale-95 ${
              filterType === 'ADJUSTMENT'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            Correcciones
          </button>
          <button
            type="button"
            onClick={() => setFilterType('COUNT')}
            className={`min-h-[40px] rounded-xl px-3.5 text-xs font-bold transition active:scale-95 ${
              filterType === 'COUNT'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            Conteos
          </button>
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Buscar por producto o ref..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 text-xs"
          />
        </div>
      </div>

      {/* Tabla con scroll horizontal optimizado y padding táctil */}
      <div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50/80 text-stone-500">
              <tr>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Fecha y hora</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Producto</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Motivo</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Variación</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Referencia</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredMovements.map((movement) => (
                <tr key={movement.id} className="transition hover:bg-stone-50/70">
                  <td className="px-4 py-3.5 text-xs text-stone-600 whitespace-nowrap">
                    {dateTime(movement.createdAt)}
                  </td>
                  <td className="px-4 py-3.5 font-bold text-stone-900">
                    {movement.product.name}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <Badge tone={toneForType(movement.type)}>
                      {getInventoryMovementTypeLabel(movement.type)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-stone-600">
                    {movement.reasonLabel ? (
                      <div>
                        <div className="font-semibold text-stone-900">{movement.reasonLabel}</div>
                        <div className="text-[10px] uppercase tracking-wider text-stone-400">
                          {movement.reasonCode?.replaceAll('_', ' ') ?? ''}
                        </div>
                      </div>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className={`px-4 py-3.5 font-black text-sm whitespace-nowrap ${
                    movement.qtyChange >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {movement.qtyChange > 0 ? `+${movement.qtyChange}` : movement.qtyChange}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-stone-600 font-mono whitespace-nowrap">
                    {movement.referenceId || <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-stone-500 max-w-xs truncate">
                    {movement.notes || <span className="text-stone-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredMovements.length ? (
          <div className="py-10 text-center text-xs font-medium text-stone-500">
            Ningún movimiento coincide con los filtros seleccionados.
          </div>
        ) : null}
      </div>
    </div>
  );
}
