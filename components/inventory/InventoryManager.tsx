'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AdjustmentForm from '@/components/inventory/AdjustmentForm';
import InventoryMovementTable from '@/components/inventory/InventoryMovementTable';
import ProductBatchManager from '@/components/inventory/ProductBatchManager';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { money } from '@/lib/format';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
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
  trackBatches: boolean;
  trackExpiry: boolean;
  batches: Array<{
    id: string;
    lotNumber: string;
    expiryDate: string | null;
    quantity: number;
  }>;
  isActive: boolean;
};

type InventoryReason = {
  id: string;
  code: string;
  label: string;
};

type Batch = {
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

type Movement = {
  id: string;
  type: string;
  qtyChange: number;
  referenceId: string | null;
  notes: string | null;
  reasonLabel: string | null;
  reasonCode: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
  };
};

type ReorderSuggestion = {
  productId: string;
  productName: string;
  sku: string | null;
  currentStock: number;
  avgDailySales: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  targetStock: number;
  suggestedQty: number;
  unitCost: number;
  suggestedCost: number;
  supplierId: string | null;
  supplierName: string;
  stockoutEvents: number;
  sellThroughPercent: number;
  baseUnitOfMeasureId: string;
  baseUnitName: string;
};

type ReorderGroup = {
  supplierId: string | null;
  supplierName: string;
  totalUnits: number;
  totalCost: number;
  items: ReorderSuggestion[];
};

type ReorderSuggestions = {
  generatedAt: string;
  safetyStock: number;
  summary: {
    itemsNeedingAction: number;
    suppliersImpacted: number;
    projectedCost: number;
    projectedUnits: number;
  };
  items: ReorderSuggestion[];
  groups: ReorderGroup[];
};

type InventoryTab = 'movements' | 'adjustments' | 'batches' | 'reorder';

export default function InventoryManager({
  products,
  reasons,
  batches,
  movements,
  lowStockThreshold,
  currencySymbol,
  reorderSuggestions,
  inventoryFeatures
}: {
  products: Product[];
  reasons: InventoryReason[];
  batches: Batch[];
  movements: Movement[];
  lowStockThreshold: number;
  currencySymbol: string;
  reorderSuggestions: ReorderSuggestions;
  inventoryFeatures: {
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    fefoEnabled: boolean;
    expiryAlertDays: number;
  };
}) {
  const [activeTab, setActiveTab] = useState<InventoryTab>('movements');
  const [busySupplierId, setBusySupplierId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [createdSupplierIds, setCreatedSupplierIds] = useState<string[]>([]);

  // Count of batches with expiry alerts
  const expiryAlertCount = useMemo(() => {
    const now = new Date();
    return batches.filter((b) => {
      if (!b.expiryDate || b.quantity <= 0) return false;
      const expiry = new Date(b.expiryDate);
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= inventoryFeatures.expiryAlertDays;
    }).length;
  }, [batches, inventoryFeatures.expiryAlertDays]);

  async function createSuggestedPurchase(group: ReorderGroup) {
    if (!group.supplierId) {
      setError('Este grupo de recomendación aún no tiene historial de proveedores, por lo que no se puede generar una orden de compra segura.');
      return;
    }

    setBusySupplierId(group.supplierId);
    setError('');
    setSuccess('');

    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: group.supplierId,
        status: 'DRAFT',
        notes: `Borrador de reposición inteligente generado desde la cola de inventario el ${new Date().toLocaleDateString('es-ES')}.`,
        items: group.items.map((item) => ({
          productId: item.productId,
          unitOfMeasureId: item.baseUnitOfMeasureId,
          qty: item.suggestedQty,
          unitCost: item.unitCost
        }))
      })
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo crear la orden de compra sugerida.' }));
    setBusySupplierId(null);

    if (!response.ok) {
      setError(data.error ?? 'No se pudo crear la orden de compra sugerida.');
      return;
    }

    setCreatedSupplierIds((current) => [...new Set([...current, group.supplierId!])]);
    setSuccess(`Borrador de compra ${data.purchase?.purchaseNumber ?? ''} creado para ${group.supplierName}.`);
  }

  return (
    <div className="space-y-6">
      {/* Barra de métricas y selector de pestañas táctil a ancho completo */}
      <Card>
        <div className="flex flex-col gap-5">
          {/* Métricas rápidas táctiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Movimientos</div>
              <div className="mt-1 text-xl font-black text-stone-900">{movements.length}</div>
              <div className="mt-0.5 text-[11px] text-stone-500">registrados</div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Productos activos</div>
              <div className="mt-1 text-xl font-black text-stone-900">{products.filter((p) => p.isActive).length}</div>
              <div className="mt-0.5 text-[11px] text-stone-500">en catálogo</div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Por vencer / alertas</div>
              <div className="mt-1 text-xl font-black text-amber-700">{expiryAlertCount}</div>
              <div className="mt-0.5 text-[11px] text-stone-500">lotes prioritarios</div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Reposición</div>
              <div className="mt-1 text-xl font-black text-emerald-700">{reorderSuggestions.summary.itemsNeedingAction}</div>
              <div className="mt-0.5 text-[11px] text-stone-500">sugerencias activas</div>
            </div>
          </div>

          {/* Navegación por pestañas a ancho completo con scroll suave y targets amplios (48px) */}
          <div className="flex overflow-x-auto rounded-2xl border border-stone-200 bg-stone-100/80 p-1.5 gap-1.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('movements')}
              className={`flex flex-1 min-w-[170px] min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition active:scale-98 whitespace-nowrap ${
                activeTab === 'movements'
                  ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-950/5'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Movimientos
              <span className="rounded-full bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-700">
                {movements.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('adjustments')}
              className={`flex flex-1 min-w-[170px] min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition active:scale-98 whitespace-nowrap ${
                activeTab === 'adjustments'
                  ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-950/5'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Correcciones y mermas
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('batches')}
              className={`flex flex-1 min-w-[170px] min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition active:scale-98 whitespace-nowrap ${
                activeTab === 'batches'
                  ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-950/5'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Lotes y vencimientos
              {expiryAlertCount > 0 ? (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                  {expiryAlertCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reorder')}
              className={`flex flex-1 min-w-[170px] min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition active:scale-98 whitespace-nowrap ${
                activeTab === 'reorder'
                  ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-950/5'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Reposición inteligente
              {reorderSuggestions.summary.itemsNeedingAction > 0 ? (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  {reorderSuggestions.summary.itemsNeedingAction}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </Card>

      {/* CONTENIDO DE LA PESTAÑA ACTIVA (A ANCHO COMPLETO) */}
      {/* 1. MOVIMIENTOS */}
      {activeTab === 'movements' && (
        <Card>
          <div className="mb-5">
            <h2 className="text-xl font-black text-stone-900">Historial de movimientos de inventario</h2>
            <p className="mt-1 text-xs sm:text-sm text-stone-500">
              Auditoría completa de compras, ventas, variaciones de conteo, mermas y ajustes con códigos de motivo.
            </p>
          </div>
          <InventoryMovementTable movements={movements} lowStockThreshold={lowStockThreshold} />
        </Card>
      )}

      {/* 2. CORRECCIONES Y MERMAS */}
      {activeTab === 'adjustments' && (
        <Card>
          <div className="mb-5">
            <h2 className="text-xl font-black text-stone-900">Correcciones de inventario y mermas</h2>
            <p className="mt-1 text-xs sm:text-sm text-stone-500">
              Registra bajas extraordinarias, autoconsumo o saldos de inventario inicial con controles táctiles optimizados.
            </p>
          </div>
          <AdjustmentForm products={products} reasons={reasons} />
        </Card>
      )}

      {/* 3. LOTES Y VENCIMIENTOS */}
      {activeTab === 'batches' && (
        <Card>
          <ProductBatchManager
            products={products}
            initialBatches={batches}
            inventoryFeatures={inventoryFeatures}
          />
        </Card>
      )}

      {/* 4. REPOSICIÓN INTELIGENTE */}
      {activeTab === 'reorder' && (
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between border-b border-stone-100 pb-5">
            <div>
              <h2 className="text-xl font-black text-stone-900">Sugerencias inteligentes de reposición</h2>
              <p className="mt-1 max-w-3xl text-xs sm:text-sm text-stone-500">
                Las cantidades sugeridas combinan velocidad de venta diaria, tiempo de entrega del proveedor, stock de seguridad y urgencia de desabastecimiento.
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3.5 text-xs text-stone-600 sm:text-right">
              <div className="font-bold text-stone-900">{reorderSuggestions.summary.itemsNeedingAction} producto(s) para reposición</div>
              <div className="mt-0.5">
                {reorderSuggestions.summary.projectedUnits} unidades proyectadas ({money(reorderSuggestions.summary.projectedCost, currencySymbol)})
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Stock de seguridad</div>
              <div className="mt-1.5 text-2xl font-black text-stone-950">{reorderSuggestions.safetyStock}</div>
              <div className="mt-0.5 text-xs text-stone-500">predeterminado de sucursal</div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Proveedores involucrados</div>
              <div className="mt-1.5 text-2xl font-black text-stone-950">{reorderSuggestions.summary.suppliersImpacted}</div>
              <div className="mt-0.5 text-xs text-stone-500">con recomendaciones listas</div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Última actualización</div>
              <div className="mt-1.5 text-lg font-black text-stone-950">
                {new Date(reorderSuggestions.generatedAt).toLocaleDateString('es-ES')}
              </div>
              <div className="mt-0.5 text-xs text-stone-500">análisis predictivo activo</div>
            </div>
          </div>

          {success ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center justify-between">
              <span>✓ {success}</span>
              <Link href="/purchases" className="font-bold underline">
                Ver en Compras →
              </Link>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
              ⚠️ {error}
            </div>
          ) : null}

          <div className="mt-6 space-y-5">
            {reorderSuggestions.groups.length ? (
              reorderSuggestions.groups.map((group) => {
                const alreadyCreated = Boolean(group.supplierId && createdSupplierIds.includes(group.supplierId));

                return (
                  <div
                    key={`${group.supplierId ?? 'none'}-${group.supplierName}`}
                    className="rounded-[28px] border border-stone-200 bg-stone-50/60 p-4 sm:p-6 space-y-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          Paquete de reposición de proveedor
                        </div>
                        <h3 className="mt-1 text-lg font-black text-stone-900">{group.supplierName}</h3>
                        <div className="mt-0.5 text-xs text-stone-500">
                          {group.items.length} ítem(s) • {group.totalUnits} unidades • {money(group.totalCost, currencySymbol)}
                        </div>
                      </div>

                      {group.supplierId ? (
                        <Button
                          type="button"
                          onClick={() => createSuggestedPurchase(group)}
                          disabled={busySupplierId === group.supplierId || alreadyCreated}
                          className="h-11 px-5 text-xs font-bold self-start sm:self-auto shadow-xs active:scale-95"
                        >
                          {alreadyCreated
                            ? '✓ Borrador creado'
                            : busySupplierId === group.supplierId
                              ? 'Creando borrador...'
                              : 'Generar borrador de orden'}
                        </Button>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
                          Sin proveedor asignado
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {group.items.map((item) => (
                        <div
                          key={item.productId}
                          className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-2xs"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="font-bold text-stone-900 text-sm sm:text-base">{item.productName}</div>
                              <div className="text-xs text-stone-500">
                                {item.sku ? `SKU: ${item.sku} • ` : ''}
                                Unidad base: {item.baseUnitName}
                              </div>
                            </div>
                            <div className="sm:text-right">
                              <span className="text-xs text-stone-500 mr-2 sm:block sm:mr-0">Cant. sugerida:</span>
                              <span className="text-xl font-black text-emerald-700">{item.suggestedQty}</span>
                            </div>
                          </div>

                          {/* 6 Métricas clave a ancho completo, sin compresión ni desfasaje */}
                          <div className="mt-3.5 grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                            <div className="rounded-xl border border-stone-100 bg-stone-50 p-2.5">
                              <div className="text-[10px] font-bold uppercase text-stone-400">En mano</div>
                              <div className="mt-1 font-mono text-sm font-black text-stone-900">{item.currentStock}</div>
                            </div>
                            <div className="rounded-xl border border-stone-100 bg-stone-50 p-2.5">
                              <div className="text-[10px] font-bold uppercase text-stone-400">Velocidad</div>
                              <div className="mt-1 font-mono text-sm font-black text-stone-900">{item.avgDailySales.toFixed(1)} / día</div>
                            </div>
                            <div className="rounded-xl border border-stone-100 bg-stone-50 p-2.5">
                              <div className="text-[10px] font-bold uppercase text-stone-400">Tiempo entrega</div>
                              <div className="mt-1 font-mono text-sm font-black text-stone-900">{item.leadTimeDays} día(s)</div>
                            </div>
                            <div className="rounded-xl border border-stone-100 bg-stone-50 p-2.5">
                              <div className="text-[10px] font-bold uppercase text-stone-400">Pto. reposición</div>
                              <div className="mt-1 font-mono text-sm font-black text-stone-900">{item.reorderPoint}</div>
                            </div>
                            <div className="rounded-xl border border-stone-100 bg-stone-50 p-2.5">
                              <div className="text-[10px] font-bold uppercase text-stone-400">Quiebres stock</div>
                              <div className="mt-1 font-mono text-sm font-black text-stone-900">{item.stockoutEvents}</div>
                            </div>
                            <div className="rounded-xl border border-stone-100 bg-stone-50 p-2.5">
                              <div className="text-[10px] font-bold uppercase text-stone-400">Costo proyectado</div>
                              <div className="mt-1 font-mono text-sm font-black text-stone-900 whitespace-nowrap">
                                {money(item.suggestedCost, currencySymbol)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5 text-[11px] text-stone-400">
                            Rotación: <strong>{item.sellThroughPercent.toFixed(1)}%</strong> • Stock objetivo: <strong>{item.targetStock}</strong> • Seguridad: <strong>{item.safetyStock}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-xs font-semibold text-stone-500">
                Ningún producto requiere orden de reposición en este momento.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
