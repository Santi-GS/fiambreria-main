'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { dateTime, shortDate } from '@/lib/format';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  stockQty: number;
  reorderPoint: number;
  trackBatches: boolean;
  trackExpiry: boolean;
  isActive: boolean;
};

type ProductBatch = {
  id: string;
  lotNumber: string;
  expiryDate: string | null;
  quantity: number;
  receivedAt: string;
  notes: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    trackBatches: boolean;
    trackExpiry: boolean;
  };
};

function batchTone(batch: ProductBatch, expiryAlertDays: number) {
  if (batch.quantity <= 0) {
    return 'stone';
  }

  if (batch.expiryDate) {
    const now = new Date();
    const expiry = new Date(batch.expiryDate);
    if (expiry.getTime() < now.getTime()) {
      return 'red';
    }

    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= expiryAlertDays) {
      return 'amber';
    }
  }

  return 'emerald';
}

function batchStatusLabel(batch: ProductBatch, expiryAlertDays: number) {
  if (batch.quantity <= 0) {
    return 'Agotado';
  }

  if (!batch.expiryDate) {
    return 'Sin caducidad';
  }

  const now = new Date();
  const expiry = new Date(batch.expiryDate);
  if (expiry.getTime() < now.getTime()) {
    return 'Vencido';
  }

  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= expiryAlertDays) {
    return 'Por vencer';
  }

  return 'Activo';
}

const selectClassName =
  'h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-900 shadow-xs outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';

export default function ProductBatchManager({
  products,
  initialBatches,
  inventoryFeatures
}: {
  products: Product[];
  initialBatches: ProductBatch[];
  inventoryFeatures: {
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    fefoEnabled: boolean;
    expiryAlertDays: number;
  };
}) {
  const router = useRouter();
  const trackedProducts = useMemo(
    () => products.filter((product) => product.isActive && (product.trackBatches || product.trackExpiry)),
    [products]
  );
  const [batches, setBatches] = useState(initialBatches);
  const [productId, setProductId] = useState(trackedProducts[0]?.id ?? '');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedProduct = trackedProducts.find((product) => product.id === productId);
  const sortedBatches = useMemo(
    () =>
      [...batches].sort((left, right) => {
        if (left.expiryDate && right.expiryDate) {
          return new Date(left.expiryDate).getTime() - new Date(right.expiryDate).getTime();
        }

        if (left.expiryDate) {
          return -1;
        }

        if (right.expiryDate) {
          return 1;
        }

        return new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime();
      }),
    [batches]
  );

  const expiryAlerts = useMemo(
    () =>
      sortedBatches.filter((batch) => {
        if (!batch.expiryDate || batch.quantity <= 0) {
          return false;
        }

        const now = new Date();
        const expiry = new Date(batch.expiryDate);
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= inventoryFeatures.expiryAlertDays;
      }),
    [inventoryFeatures.expiryAlertDays, sortedBatches]
  );

  async function createBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!productId) {
      setError('Selecciona un producto con seguimiento.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/products/${productId}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotNumber,
          expiryDate: expiryDate || null,
          quantity: Number(quantity),
          notes: notes || null
        })
      });

      const data = await response.json().catch(() => ({ error: 'No se pudo guardar el lote del producto.' }));
      setLoading(false);

      if (!response.ok || !data?.batch) {
        setError(data?.error ?? 'No se pudo guardar el lote del producto.');
        return;
      }

      setBatches((current) => [data.batch, ...current]);
      setLotNumber('');
      setExpiryDate('');
      setQuantity('0');
      setNotes('');
      setSuccess('Lote guardado con éxito. Las existencias se mantienen a nivel de producto y respaldan la rotación FEFO.');
      router.refresh();
    } catch {
      setLoading(false);
      setError('Error de conexión al guardar el lote del producto.');
    }
  }

  if (!inventoryFeatures.batchTrackingEnabled && !inventoryFeatures.expiryTrackingEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
        El seguimiento de lotes y caducidad está desactivado para esta sucursal.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado descriptivo */}
      <div>
        <h3 className="text-lg font-black text-stone-900">Gestión de lotes y fechas de vencimiento</h3>
        <p className="mt-1 text-xs text-stone-500">
          Supervisa números de lote, cantidades recibidas y caducidad manteniendo la rotación FEFO (First-Expired, First-Out).
        </p>
      </div>

      {/* Tarjetas informativas de FEFO y alertas de caducidad */}
      {inventoryFeatures.expiryTrackingEnabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-red-200 bg-red-50 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Alertas de caducidad</div>
            <div className="mt-1 text-2xl font-black text-stone-950">{expiryAlerts.length}</div>
            <div className="mt-1 text-xs text-red-800">
              Vencidos o próximos a vencer en {inventoryFeatures.expiryAlertDays} día(s)
            </div>
          </div>
          <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Prioridad FEFO</div>
            <div className="mt-1 text-base font-black text-stone-950">
              {inventoryFeatures.fefoEnabled ? '✓ Modo FEFO activado' : 'Revisión manual'}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              {inventoryFeatures.fefoEnabled
                ? 'Los productos se despachan priorizando la fecha de caducidad más cercana.'
                : 'Los lotes están disponibles para consulta manual.'}
            </div>
          </div>
        </div>
      ) : null}

      {/* Formulario de registro de lote táctil */}
      <form onSubmit={createBatch} className="space-y-4 rounded-[26px] border border-stone-200 bg-stone-50/70 p-4 sm:p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-stone-600">
          Registrar nuevo lote
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-stone-700">Producto</label>
            <select
              className={selectClassName}
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Seleccionar producto con seguimiento</option>
              {trackedProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku ?? 'Sin SKU'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-stone-700">N° de lote</label>
            <Input
              placeholder="Ej: LOTE-2026-A"
              value={lotNumber}
              onChange={(event) => setLotNumber(event.target.value)}
              className="h-12"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-stone-700">Fecha de caducidad</label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              className="h-12"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-stone-700">Cantidad en lote</label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="h-12"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label className="mb-1.5 block text-xs font-semibold text-stone-700">Notas de respaldo (opcional)</label>
            <Input
              placeholder="Proveedor, temperatura de recepción, etc."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="h-12"
            />
          </div>
        </div>

        {selectedProduct ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-3 text-xs text-stone-600 flex flex-wrap items-center gap-2">
            <span className="font-bold text-stone-900">{selectedProduct.name}</span>
            <span>•</span>
            <span>Stock total: <strong className="text-stone-900">{selectedProduct.stockQty}</strong></span>
            <span>•</span>
            <span className="text-stone-500">
              Tipo: {selectedProduct.trackExpiry ? 'Lote + Vencimiento' : 'Solo Lote'}
            </span>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            ⚠️ {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
            ✓ {success}
          </div>
        ) : null}

        <Button type="submit" disabled={loading || !trackedProducts.length} className="h-12 px-6 font-bold">
          {loading ? 'Guardando lote...' : 'Guardar lote'}
        </Button>
      </form>

      {/* Tabla de lotes a ancho completo */}
      <div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50/80 text-stone-500">
              <tr>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Producto</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Lote</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Caducidad</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Cantidad</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Estado</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Recepción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sortedBatches.map((batch) => (
                <tr key={batch.id} className="transition hover:bg-stone-50/70">
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-stone-900">{batch.product.name}</div>
                    <div className="text-[11px] text-stone-500">{batch.product.sku ?? 'Sin SKU'}</div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs font-bold text-stone-700 whitespace-nowrap">
                    {batch.lotNumber}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-stone-600 whitespace-nowrap">
                    {batch.expiryDate ? shortDate(batch.expiryDate) : <span className="text-stone-400">Sin caducidad</span>}
                  </td>
                  <td className={`px-4 py-3.5 font-black text-sm whitespace-nowrap ${
                    batch.quantity <= 0 ? 'text-stone-400' : 'text-stone-900'
                  }`}>
                    {batch.quantity}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <Badge tone={batchTone(batch, inventoryFeatures.expiryAlertDays)}>
                      {batchStatusLabel(batch, inventoryFeatures.expiryAlertDays)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-stone-600 whitespace-nowrap">
                    <div>{dateTime(batch.receivedAt)}</div>
                    {batch.notes ? <div className="text-[11px] text-stone-400 truncate max-w-xs">{batch.notes}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!sortedBatches.length ? (
          <div className="py-10 text-center text-xs font-medium text-stone-500">
            Aún no hay lotes registrados para los productos con seguimiento.
          </div>
        ) : null}
      </div>
    </div>
  );
}
