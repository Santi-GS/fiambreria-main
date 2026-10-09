'use client';

import Link from 'next/link';
import { type FormEvent, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { summarizeConversions } from '@/lib/uom';
import { buildVariantLabel } from '@/lib/product-merchandising';

type Product = {
  id: string;
  name: string;
  stockQty: number;
  reorderPoint: number;
  baseUnitOfMeasure?: { id: string; code: string; name: string; isBase: boolean } | null;
  variants: Array<{
    id: string;
    color: string | null;
    size: string | null;
    flavor: string | null;
    model: string | null;
    sku: string | null;
    barcode: string | null;
  }>;
  uomConversions: Array<{
    id: string;
    unitOfMeasureId: string;
    ratioToBase: number;
    unitOfMeasure: { id: string; code: string; name: string; isBase: boolean };
  }>;
  isActive: boolean;
};

type InventoryReason = {
  id: string;
  code: string;
  label: string;
};

const selectClassName =
  'h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-900 shadow-xs outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';

export default function AdjustmentForm({
  products,
  reasons
}: {
  products: Product[];
  reasons: InventoryReason[];
}) {
  const activeProducts = useMemo(() => products.filter((product) => product.isActive), [products]);
  const [productId, setProductId] = useState(activeProducts[0]?.id ?? '');
  const [reasonId, setReasonId] = useState(reasons[0]?.id ?? '');
  const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'REMOVE'>('ADD');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [productFilter, setProductFilter] = useState('');

  const filteredProducts = useMemo(() => {
    if (!productFilter.trim()) return activeProducts;
    const term = productFilter.toLowerCase().trim();
    return activeProducts.filter((p) => p.name.toLowerCase().includes(term));
  }, [activeProducts, productFilter]);

  const selectedProduct = useMemo(
    () => activeProducts.find((product) => product.id === productId),
    [activeProducts, productId]
  );

  function adjustQty(amount: number) {
    const current = Number(qty) || 0;
    const next = Math.max(1, current + amount);
    setQty(String(next));
  }

  function setDirectQty(amount: number) {
    setQty(String(amount));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const parsedQty = Number(qty);

    if (!productId) {
      setError('Por favor, selecciona un producto.');
      return;
    }

    if (!reasonId) {
      setError('Por favor, selecciona un motivo de ajuste.');
      return;
    }

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError('La cantidad del ajuste debe ser mayor a 0.');
      return;
    }

    if (adjustmentType === 'REMOVE' && selectedProduct && parsedQty > selectedProduct.stockQty) {
      setError(`No se puede retirar ${parsedQty} unidades: el stock actual es de solo ${selectedProduct.stockQty}.`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId,
          reasonId,
          qtyChange: adjustmentType === 'REMOVE' ? parsedQty * -1 : parsedQty,
          notes: notes.trim() || null
        })
      });

      const data = await response.json().catch(() => ({
        error: 'No se pudo guardar la corrección de inventario.'
      }));

      setLoading(false);

      if (!response.ok) {
        setError(data.error ?? 'No se pudo guardar la corrección de inventario.');
        return;
      }

      setSuccess('Corrección de inventario registrada con éxito. Actualiza o consulta la pestaña de movimientos para verificar.');
      setQty('1');
      setNotes('');
    } catch {
      setLoading(false);
      setError('Error de conexión al procesar la corrección de inventario.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-4xl">
      {!activeProducts.length ? (
        <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600">
          <div className="font-bold text-stone-900">Aún no hay productos activos listos para correcciones.</div>
          <div className="mt-2 text-xs text-stone-500">Crea productos en el catálogo antes de registrar correcciones o mermas.</div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/products" className="font-bold text-emerald-700 hover:text-emerald-800 text-xs">
              Ir a Productos
            </Link>
            <Link href="/stock-counts" className="font-bold text-stone-700 hover:text-stone-900 text-xs">
              Iniciar conteo de inventario
            </Link>
          </div>
        </div>
      ) : null}

      {/* 1. Tipo de corrección táctil (Botones Segmentados Grandes) */}
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-600">
          Tipo de Corrección
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAdjustmentType('ADD')}
            className={`flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl border p-3 text-sm font-black transition active:scale-98 ${
              adjustmentType === 'ADD'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-base">
              +
            </span>
            <div className="text-left">
              <div className="leading-tight">Agregar stock</div>
              <div className="text-[10px] font-medium text-emerald-700">Incrementa existencias</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAdjustmentType('REMOVE')}
            className={`flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl border p-3 text-sm font-black transition active:scale-98 ${
              adjustmentType === 'REMOVE'
                ? 'border-red-500 bg-red-50 text-red-800 shadow-sm ring-2 ring-red-500/20'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-600 text-white font-bold text-base">
              −
            </span>
            <div className="text-left">
              <div className="leading-tight">Retirar stock (Merma)</div>
              <div className="text-[10px] font-medium text-red-700">Disminuye existencias</div>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Selector de Producto con filtro rápido */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
            Producto a ajustar
          </label>
          <span className="text-[11px] text-stone-400">{activeProducts.length} producto(s) disponibles</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <select
            className={selectClassName}
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            {filteredProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} (Stock: {product.stockQty})
              </option>
            ))}
          </select>

          <Input
            placeholder="Filtrar lista..."
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="h-12 text-xs"
          />
        </div>

        {/* Tarjeta de contexto del producto seleccionado */}
        {selectedProduct ? (
          <div className="rounded-[22px] border border-stone-200 bg-stone-50/80 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider">Seleccionado:</span>{' '}
                <span className="text-sm font-black text-stone-900">{selectedProduct.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">Existencias actuales:</span>
                <span className="rounded-xl bg-white border border-stone-200 px-3 py-1 font-mono text-sm font-black text-stone-900">
                  {selectedProduct.stockQty} {selectedProduct.baseUnitOfMeasure?.name.toLowerCase() ?? 'unid.'}
                </span>
              </div>
            </div>

            {selectedProduct.uomConversions.length > 0 ? (
              <div className="mt-2 text-[11px] text-stone-500">
                {summarizeConversions(
                  selectedProduct.uomConversions.map((c) => ({
                    unitName: c.unitOfMeasure.name,
                    ratioToBase: c.ratioToBase
                  })),
                  selectedProduct.baseUnitOfMeasure?.name
                )}
              </div>
            ) : null}

            {selectedProduct.variants.length > 0 ? (
              <div className="mt-1 text-[11px] text-stone-400">
                Variantes: {selectedProduct.variants.map((v) => buildVariantLabel(v) || v.sku || 'Variante').join(' • ')}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 3. Motivo y Cantidad con Stepper Táctil */}
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-600">
            Motivo del ajuste
          </label>
          <select
            className={selectClassName}
            value={reasonId}
            onChange={(event) => setReasonId(event.target.value)}
          >
            {reasons.map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.label} ({reason.code})
              </option>
            ))}
          </select>
        </div>

        {/* Stepper numérico táctil */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-600">
            Cantidad a ajustar
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustQty(-1)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-100 text-lg font-black text-stone-700 transition hover:bg-stone-200 active:scale-95"
              title="Restar 1"
            >
              −
            </button>
            <Input
              type="number"
              min="1"
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              className="h-12 text-center text-lg font-black text-stone-900"
            />
            <button
              type="button"
              onClick={() => adjustQty(1)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-100 text-lg font-black text-stone-700 transition hover:bg-stone-200 active:scale-95"
              title="Sumar 1"
            >
              +
            </button>
          </div>

          {/* Accesos rápidos de cantidad táctiles */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-stone-400 mr-1">Rápido:</span>
            {[1, 5, 10, 25, 50].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setDirectQty(num)}
                className={`min-h-[32px] rounded-xl px-2.5 text-xs font-bold transition active:scale-95 ${
                  Number(qty) === num
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => adjustQty(10)}
              className="min-h-[32px] rounded-xl bg-emerald-100 px-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-200"
            >
              +10
            </button>
          </div>
        </div>
      </div>

      {/* 4. Notas */}
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-600">
          Notas de respaldo (Opcional)
        </label>
        <Input
          placeholder="Ej: Pérdida por rotura de envase, vencimiento en góndola o corrección de carga inicial"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="h-12"
        />
      </div>

      {/* Alertas y avisos */}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          ⚠️ {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-700">
          ✓ {success}
        </div>
      ) : null}

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-900">
        💡 <strong>Recomendación:</strong> Usa conteos de inventario para diferencias periódicas y transferencias para envíos entre locales. Este formulario está reservado para mermas extraordinarias y saldos iniciales.
      </div>

      {/* Botón de Guardado Táctil */}
      <Button
        type="submit"
        disabled={loading || !activeProducts.length}
        className="h-13 w-full sm:w-auto px-8 text-base font-bold shadow-md shadow-emerald-900/10 active:scale-98"
      >
        {loading
          ? 'Guardando corrección...'
          : adjustmentType === 'ADD'
            ? 'Confirmar ingreso de stock (+)'
            : 'Confirmar retiro de stock (−)'}
      </Button>
    </form>
  );
}
