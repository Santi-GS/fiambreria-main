'use client';

import Button from '@/components/ui/Button';
import { dateTime, money } from '@/lib/format';
import type { ParkedSale } from './types';

type ParkedSalesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  parkedSales: ParkedSale[];
  currencySymbol: string;
  resumeLoadingId: string | null;
  cancelLoadingId: string | null;
  onResume: (parkedSale: ParkedSale) => Promise<boolean>;
  onCancel: (parkedSale: ParkedSale) => Promise<void>;
  onSaveCurrentCart: (type: 'SAVED_CART' | 'QUOTE') => Promise<void>;
  holding: 'SAVED_CART' | 'QUOTE' | null;
  canSaveCurrent: boolean;
};

export default function ParkedSalesModal({
  isOpen,
  onClose,
  parkedSales,
  currencySymbol,
  resumeLoadingId,
  cancelLoadingId,
  onResume,
  onCancel,
  onSaveCurrentCart,
  holding,
  canSaveCurrent
}: ParkedSalesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col rounded-3xl border border-stone-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-stone-900">Ventas en Espera y Cotizaciones</h3>
              <p className="text-xs text-stone-500">Suspenda la venta actual o retome carritos pendientes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-500 transition hover:bg-stone-200 hover:text-stone-800"
            title="Cerrar [Escape]"
          >
            ✕
          </button>
        </div>

        {/* Action bar to suspend current cart */}
        <div className="border-b border-stone-100 bg-stone-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-stone-600">Acciones sobre el carrito actual:</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!canSaveCurrent || Boolean(holding)}
                onClick={() => void onSaveCurrentCart('SAVED_CART')}
                className="text-xs h-9"
              >
                {holding === 'SAVED_CART' ? 'Guardando...' : 'Poner en Espera'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!canSaveCurrent || Boolean(holding)}
                onClick={() => void onSaveCurrentCart('QUOTE')}
                className="text-xs h-9"
              >
                {holding === 'QUOTE' ? 'Guardando...' : 'Guardar Cotización'}
              </Button>
            </div>
          </div>
        </div>

        {/* List of Parked Sales */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {parkedSales.length > 0 ? (
            parkedSales.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        entry.type === 'QUOTE'
                          ? 'border border-sky-200 bg-sky-50 text-sky-700'
                          : 'border border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {entry.type === 'QUOTE' ? 'Cotización' : 'En Espera'}
                    </span>
                    <span className="text-xs font-bold text-stone-500">{entry.itemCount} artículo(s)</span>
                  </div>

                  <div className="mt-1.5 text-base font-black text-stone-900">
                    {money(entry.totalAmount, currencySymbol)}
                  </div>
                  <div className="text-xs text-stone-500">
                    Cajero: {entry.cashierName} {entry.customerName ? `| Cliente: ${entry.customerName}` : ''}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    Creado: {dateTime(entry.createdAt)}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    disabled={resumeLoadingId === entry.id || cancelLoadingId === entry.id}
                    onClick={async () => {
                      const success = await onResume(entry);
                      if (success) onClose();
                    }}
                    className="h-9 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    {resumeLoadingId === entry.id ? 'Cargando...' : 'Reanudar'}
                  </Button>

                  <Button
                    type="button"
                    variant="danger"
                    disabled={resumeLoadingId === entry.id || cancelLoadingId === entry.id}
                    onClick={() => void onCancel(entry)}
                    className="h-9 px-3 text-xs"
                  >
                    {cancelLoadingId === entry.id ? 'Cancelando...' : 'Cancelar'}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-stone-500">
              <p className="font-semibold text-stone-700">No hay ventas en espera ni cotizaciones activas.</p>
              <p className="mt-1 text-xs">Puede suspender carritos activos para atender a otro cliente inmediatamente.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-stone-100 bg-stone-50/50 p-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar [Escape]
          </Button>
        </div>
      </div>
    </div>
  );
}
