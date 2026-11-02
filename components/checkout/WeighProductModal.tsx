'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { money } from '@/lib/format';
import { evaluateWeightAgainstStock } from '@/lib/pos-stock';
import type { Product } from './types';

type WeighUnit = 'kg' | 'g';

type WeighProductModalProps = {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  currencySymbol: string;
  /** Available stock in grams (already subtracting other lines of the same product in the cart) */
  availableStockGrams: number;
  /** Grams of this product already reserved in other cart lines */
  reservedInCartGrams?: number;
  /** Pre-filled weight in Kg when editing an existing cart line */
  initialWeightKg?: number | null;
  /** Whether adding a new weighted line or editing an existing cart line */
  mode?: 'add' | 'edit';
  /** Unique key to reset form state per open operation */
  modalKey?: string;
  onConfirm: (product: Product, weightKg: number) => void;
};

const QUICK_WEIGHTS = [
  { label: '100 g', grams: 100 },
  { label: '250 g', grams: 250 },
  { label: '500 g', grams: 500 },
  { label: '1 Kg', grams: 1000 }
] as const;

function formatKgLabel(grams: number) {
  return `${(grams / 1000).toFixed(3).replace('.', ',')} Kg`;
}

function WeighDialog({
  onClose,
  product,
  currencySymbol,
  availableStockGrams,
  reservedInCartGrams = 0,
  initialWeightKg = null,
  mode = 'add',
  onConfirm
}: {
  onClose: () => void;
  product: Product;
  currencySymbol: string;
  availableStockGrams: number;
  reservedInCartGrams?: number;
  initialWeightKg?: number | null;
  mode?: 'add' | 'edit';
  onConfirm: (product: Product, weightKg: number) => void;
}) {
  const initialGrams =
    initialWeightKg !== null && initialWeightKg > 0 ? Math.round(initialWeightKg * 1000) : 0;

  const [weighUnit, setWeighUnit] = useState<WeighUnit>('g');
  const [weightInput, setWeightInput] = useState(() =>
    initialGrams > 0 ? String(initialGrams) : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus (and select when editing) input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (initialGrams > 0) {
        inputRef.current.select();
      }
    }
  }, [initialGrams]);

  // ESC to close
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const safeReservedGrams = Math.max(0, Math.round(reservedInCartGrams));

  // Calculate weight in Kg and grams from the input
  const rawValue = parseFloat(weightInput);
  const numericValue = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;
  const weightKg = weighUnit === 'g' ? numericValue / 1000 : numericValue;
  const weightGrams = Math.round(weighUnit === 'g' ? numericValue : numericValue * 1000);

  // Stock validations
  const {
    safeAvailableGrams,
    isOutOfStock,
    exceedsStock,
    isValidWeight
  } = evaluateWeightAgainstStock(weightGrams, availableStockGrams);

  // Calculate total price
  const pricePerKg = Number(product.price);
  const totalPrice = weightKg * pricePerKg;

  function handleConfirm() {
    if (!isValidWeight) return;
    onConfirm(product, weightGrams / 1000);
    onClose();
  }

  function applyQuickWeight(grams: number) {
    if (weighUnit === 'g') {
      setWeightInput(String(grams));
    } else {
      setWeightInput(String(grams / 1000));
    }
    inputRef.current?.focus();
  }

  function applyMaxAvailableWeight() {
    if (safeAvailableGrams <= 0) return;
    if (weighUnit === 'g') {
      setWeightInput(String(safeAvailableGrams));
    } else {
      setWeightInput((safeAvailableGrams / 1000).toString());
    }
    inputRef.current?.focus();
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={`${mode === 'edit' ? 'Editar peso de' : 'Pesar'} ${product.name}`}
      >
        {/* IMPORTE Header */}
        <div className="relative bg-[#1e3a5f] px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/75">
              {mode === 'edit' ? 'Editar peso • Importe' : 'Importe calculado'}
            </span>
          </div>
          <div className="mt-1 text-3xl font-black tabular-nums text-white sm:text-4xl">
            {money(totalPrice, currencySymbol)}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white/80 transition hover:bg-white/20 hover:text-white active:scale-95"
            title="Cerrar [Esc]"
            aria-label="Cerrar ventana de pesaje"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Product Image (compact when no photo) */}
          {product.imageUrl ? (
            <div className="flex items-center justify-center bg-stone-50 px-6 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-28 w-28 rounded-2xl object-cover shadow-sm sm:h-32 sm:w-32"
              />
            </div>
          ) : null}

          {/* Product Name Band */}
          <div className="bg-[#1e3a5f] px-6 py-2.5 text-center">
            <div className="text-base font-black uppercase tracking-wider text-[#f59e0b] sm:text-lg">
              {product.name}
            </div>
            {product.variantLabel ? (
              <div className="text-xs font-semibold text-sky-200">{product.variantLabel}</div>
            ) : null}
          </div>

          {/* Price per Kg & Available Stock Band */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#264974] bg-[#1a3252] px-5 py-2 text-xs">
            <span className="font-bold tracking-wide text-white">
              PRECIO: {money(pricePerKg, currencySymbol)} / Kg
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-extrabold ${
                isOutOfStock
                  ? 'bg-red-500/25 text-red-200 border border-red-400/40'
                  : safeAvailableGrams <= 1000
                    ? 'bg-amber-400/20 text-amber-200 border border-amber-300/30'
                    : 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/30'
              }`}
            >
              {isOutOfStock
                ? 'Sin stock disponible'
                : `Disponible: ${formatKgLabel(safeAvailableGrams)}`}
            </span>
          </div>

          {/* Weighing Card */}
          <div className="p-4 sm:p-5">
            <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
              {/* Header: Pesaje + active scale badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-stone-600">
                  {mode === 'edit' ? 'Nuevo peso a vender' : 'Pesaje'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Balanza activa
                </span>
              </div>

              {safeReservedGrams > 0 ? (
                <div className="mt-1.5 text-[11px] font-semibold text-amber-800">
                  Ya reservado en otras líneas del carrito: {formatKgLabel(safeReservedGrams)} ({safeReservedGrams} g)
                </div>
              ) : null}

              {/* Unit selector tabs (Kg / g) */}
              <div className="mt-3 flex rounded-xl bg-stone-200/70 p-1">
                <button
                  type="button"
                  onClick={() => {
                    if (weighUnit === 'kg') return;
                    setWeighUnit('kg');
                    if (weightInput) {
                      const g = parseFloat(weightInput) || 0;
                      setWeightInput(g > 0 ? (g / 1000).toString() : '');
                    }
                    inputRef.current?.focus();
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                    weighUnit === 'kg'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Kilogramos (Kg)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (weighUnit === 'g') return;
                    setWeighUnit('g');
                    if (weightInput) {
                      const kg = parseFloat(weightInput) || 0;
                      setWeightInput(kg > 0 ? Math.round(kg * 1000).toString() : '');
                    }
                    inputRef.current?.focus();
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                    weighUnit === 'g'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Gramos (g)
                </button>
              </div>

              {/* Weight Input */}
              <div className="mt-3 relative">
                <input
                  ref={inputRef}
                  type="number"
                  step={weighUnit === 'g' ? '1' : '0.001'}
                  min="0"
                  disabled={isOutOfStock}
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValidWeight) {
                      e.preventDefault();
                      handleConfirm();
                    }
                  }}
                  placeholder={weighUnit === 'g' ? 'Ej. 350' : 'Ej. 0.350'}
                  aria-invalid={exceedsStock || isOutOfStock}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-right text-3xl font-black tabular-nums outline-none transition disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 ${
                    exceedsStock
                      ? 'border-red-500 bg-red-50/50 text-red-900 focus:border-red-600 focus:ring-4 focus:ring-red-500/15'
                      : 'border-stone-300 bg-white text-stone-900 focus:border-[#1e3a5f] focus:ring-4 focus:ring-[#1e3a5f]/10'
                  }`}
                />
                <span
                  className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold uppercase ${
                    exceedsStock ? 'text-red-500' : 'text-stone-400'
                  }`}
                >
                  {weighUnit === 'g' ? 'g' : 'Kg'}
                </span>
              </div>

              {/* Weight in opposite unit & remaining stock preview */}
              <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-stone-500">
                <span>
                  Equivalente:{' '}
                  <strong className="font-bold text-stone-700">
                    {weighUnit === 'g'
                      ? `${weightKg.toFixed(3)} Kg`
                      : `${weightGrams} g`}
                  </strong>
                </span>
                {!isOutOfStock ? (
                  <span>
                    Máx.:{' '}
                    <strong className="font-bold text-stone-700">
                      {weighUnit === 'g'
                        ? `${safeAvailableGrams} g`
                        : `${(safeAvailableGrams / 1000).toFixed(3)} Kg`}
                    </strong>
                  </span>
                ) : null}
              </div>

              {/* Out-of-stock or Exceeds-stock Warning Alert */}
              {isOutOfStock ? (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border-2 border-red-300 bg-red-50 p-3 text-xs text-red-900"
                >
                  <div className="flex items-start gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <p className="font-black text-red-800">Sin stock disponible</p>
                      <p className="mt-0.5 leading-snug text-red-700">
                        {safeReservedGrams > 0
                          ? `Todo el stock disponible (${formatKgLabel(safeReservedGrams)}) ya fue agregado al carrito.`
                          : 'Este producto no tiene existencias cargadas en inventario.'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : exceedsStock ? (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border-2 border-red-400 bg-red-50 p-3 text-xs text-red-900 animate-in fade-in duration-150"
                >
                  <div className="flex items-start gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="font-black text-red-800">
                        La cantidad supera el stock disponible
                      </p>
                      <p className="mt-0.5 leading-snug text-red-700">
                        Ingresaste <strong>{formatKgLabel(weightGrams)}</strong> ({weightGrams} g), pero solo hay{' '}
                        <strong>{formatKgLabel(safeAvailableGrams)}</strong> ({safeAvailableGrams} g) disponibles
                        {safeReservedGrams > 0
                          ? ` (${formatKgLabel(safeReservedGrams)} ya en el carrito)`
                          : ''}
                        .
                      </p>
                      <button
                        type="button"
                        onClick={applyMaxAvailableWeight}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[11px] font-extrabold text-red-800 shadow-2xs transition hover:bg-red-100 active:scale-95"
                      >
                        <span>
                          Usar máximo disponible ({formatKgLabel(safeAvailableGrams)})
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Quick weight shortcuts */}
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {QUICK_WEIGHTS.map(({ label, grams }) => {
                  const presetOverStock = grams > safeAvailableGrams;
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => applyQuickWeight(grams)}
                      title={
                        presetOverStock
                          ? `Supera el stock disponible (${formatKgLabel(safeAvailableGrams)})`
                          : `Cargar ${label}`
                      }
                      className={`rounded-lg border py-1.5 text-xs font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                        presetOverStock
                          ? 'border-stone-200 bg-stone-100/70 text-stone-400 hover:border-red-300 hover:text-red-600'
                          : 'border-stone-300 bg-white text-stone-700 hover:border-[#1e3a5f] hover:bg-stone-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border-2 border-stone-300 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-stone-700 transition hover:border-stone-400 hover:bg-stone-100 active:scale-95 sm:text-sm"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isValidWeight}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#1e3a5f] bg-[#1e3a5f] px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-[#263f5e] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:py-3 sm:text-sm"
          >
            <span>{mode === 'edit' ? 'Actualizar peso' : 'Agregar'}</span>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WeighProductModal({
  isOpen,
  onClose,
  product,
  currencySymbol,
  availableStockGrams,
  reservedInCartGrams = 0,
  initialWeightKg = null,
  mode = 'add',
  modalKey,
  onConfirm
}: WeighProductModalProps) {
  if (!isOpen || !product || typeof document === 'undefined') return null;

  return createPortal(
    <WeighDialog
      key={modalKey ?? product.id}
      onClose={onClose}
      product={product}
      currencySymbol={currencySymbol}
      availableStockGrams={availableStockGrams}
      reservedInCartGrams={reservedInCartGrams}
      initialWeightKg={initialWeightKg}
      mode={mode}
      onConfirm={onConfirm}
    />,
    document.body
  );
}
