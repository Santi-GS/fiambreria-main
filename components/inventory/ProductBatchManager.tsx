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
      setSuccess('Lote guardado con éxito. Las existencias se mantienen a nivel de producto, y los datos del lote respaldan la vista FEFO y la revisión de caducidad.');
      router.refresh();
    } catch {
      setLoading(false);
      setError('No se pudo guardar el lote del producto.');
    }
  }

  if (!inventoryFeatures.batchTrackingEnabled && !inventoryFeatures.expiryTrackingEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
        El seguimiento de lotes y caducidad está desactivado para este tipo de negocio.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-stone-900">Lotes y vencimientos</h2>
        <p className="mt-2 text-sm text-stone-500">
          Mantén visibles los números de lote, cantidades y fechas de caducidad sin alterar el motor de existencias a nivel de producto.
        </p>
      </div>

      {inventoryFeatures.expiryTrackingEnabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700">Alertas de caducidad</div>
            <div className="mt-2 text-3xl font-black text-stone-950">{expiryAlerts.length}</div>
            <div className="mt-1 text-sm text-red-800">Vencidos o por vencer en {inventoryFeatures.expiryAlertDays} día(s)</div>
          </div>
          <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Modo FEFO</div>
            <div className="mt-2 text-lg font-black text-stone-950">
              {inventoryFeatures.fefoEnabled ? 'Priorizado' : 'Disponible'}
            </div>
            <div className="mt-1 text-sm text-stone-500">
              {inventoryFeatures.fefoEnabled ? 'Los lotes se ordenan primero por la fecha de caducidad más cercana.' : 'Los datos de caducidad están visibles para revisión manual.'}
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={createBatch} className="space-y-4 rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Registrar lote con seguimiento</div>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none transition focus:border-emerald-500"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">Seleccionar producto con seguimiento</option>
            {trackedProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} / {product.sku ?? 'Sin SKU'}
              </option>
            ))}
          </select>
          <Input placeholder="Número de lote" value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} />
          <Input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
          <Input type="number" min="0" placeholder="Cantidad en lote" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </div>
        <Input placeholder="Notas de respaldo (opcional)" value={notes} onChange={(event) => setNotes(event.target.value)} />

        {selectedProduct ? (
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
            <span className="font-semibold text-stone-900">{selectedProduct.name}</span>
            {' / '}Stock del producto: <span className="font-semibold text-stone-900">{selectedProduct.stockQty}</span>
            {' / '}Seguimiento: <span className="font-semibold text-stone-900">{selectedProduct.trackExpiry ? 'Lote + caducidad' : 'Solo lote'}</span>
          </div>
        ) : null}

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

        <Button type="submit" disabled={loading || !trackedProducts.length}>
          {loading ? 'Guardando lote...' : 'Guardar lote'}
        </Button>
      </form>

      <div className="overflow-hidden rounded-[24px] border border-stone-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-4 py-3.5">Producto</th>
                <th className="px-4 py-3.5">Lote</th>
                <th className="px-4 py-3.5">Caducidad</th>
                <th className="px-4 py-3.5">Cant.</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5">Recepción</th>
              </tr>
            </thead>
            <tbody>
              {sortedBatches.map((batch) => (
                <tr key={batch.id} className="border-t border-stone-200 bg-white">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-stone-900">{batch.product.name}</div>
                    <div className="mt-1 text-xs text-stone-500">{batch.product.sku ?? 'Sin SKU'}</div>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-700">{batch.lotNumber}</td>
                  <td className="px-4 py-4 text-stone-600">{batch.expiryDate ? shortDate(batch.expiryDate) : 'Sin caducidad'}</td>
                  <td className={`px-4 py-4 font-semibold ${batch.quantity <= 0 ? 'text-stone-500' : 'text-stone-900'}`}>{batch.quantity}</td>
                  <td className="px-4 py-4">
                    <Badge tone={batchTone(batch, inventoryFeatures.expiryAlertDays)}>
                      {batchStatusLabel(batch, inventoryFeatures.expiryAlertDays)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    <div>{dateTime(batch.receivedAt)}</div>
                    <div className="mt-1 text-xs text-stone-500">{batch.notes ?? 'Sin notas'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!sortedBatches.length ? (
          <div className="border-t border-stone-200 bg-stone-50 py-8 text-center text-sm text-stone-500">
            No tracked batches recorded yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
