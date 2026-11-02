'use client';

import { type FormEvent, type RefObject } from 'react';
import Button from '@/components/ui/Button';
import { money } from '@/lib/format';
import type { Customer } from './types';

type PosHeaderProps = {
  scanInputRef: RefObject<HTMLInputElement | null>;
  scanQuery: string;
  onScanQueryChange: (value: string) => void;
  scanQty: string;
  onScanQtyChange: (value: string) => void;
  onScanSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenProductSearch: () => void;
  onOpenPayment: () => void;
  onOpenParkedSales: () => void;
  onOpenCustomerSearch: () => void;
  onNewSale: () => void;
  onRequestClearCart: () => void;
  selectedCustomer: Customer | null;
  onClearCustomer: () => void;
  parkedSalesCount: number;
  cartItemCount: number;
  cartTotalUnits: number;
  totalAmount: number;
  currencySymbol: string;
  canCompleteSale: boolean;
  displayScale?: 'normal' | 'large' | 'xlarge';
  onDisplayScaleChange?: (scale: 'normal' | 'large' | 'xlarge') => void;
};

export default function PosHeader({
  scanInputRef,
  scanQuery,
  onScanQueryChange,
  scanQty,
  onScanQtyChange,
  onScanSubmit,
  onOpenProductSearch,
  onOpenPayment,
  onOpenParkedSales,
  onOpenCustomerSearch,
  onNewSale,
  onRequestClearCart,
  selectedCustomer,
  onClearCustomer,
  parkedSalesCount,
  cartItemCount,
  cartTotalUnits,
  totalAmount,
  currencySymbol,
  canCompleteSale,
  displayScale = 'normal',
  onDisplayScaleChange
}: PosHeaderProps) {
  const customerLabel = selectedCustomer
    ? selectedCustomer.businessName ||
      `${selectedCustomer.firstName ?? ''} ${selectedCustomer.lastName ?? ''}`.trim() ||
      'Cliente'
    : 'CONSUMIDOR FINAL';

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_420px]">
        {/* Left & Center Section */}
        <div className="flex flex-col justify-between gap-4">
          {/* Top toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRequestClearCart}
                title="Vaciar carrito [Alt + N]"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-red-200 bg-red-50 text-red-600 transition hover:border-red-400 hover:bg-red-600 hover:text-white active:scale-95"
              >
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>

              {/* Ventas en espera: Warm Amber Button */}
              <button
                type="button"
                onClick={onOpenParkedSales}
                className="flex h-11 items-center gap-2 rounded-2xl border border-amber-400 bg-amber-500 px-3.5 text-xs font-black uppercase tracking-wider text-white shadow-2xs transition hover:bg-amber-600 active:scale-95"
              >
                <span>Ventas en espera</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-950/40 px-1.5 text-[10px] font-black text-amber-100">
                  {parkedSalesCount}
                </span>
                <span className="hidden text-[10px] font-normal text-amber-100/90 sm:inline">[Alt+E]</span>
              </button>

              {/* Nueva venta: Distinct Dark Slate Button */}
              <button
                type="button"
                onClick={onNewSale}
                className="flex h-11 items-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-800 px-3.5 text-xs font-black uppercase tracking-wider text-white shadow-2xs transition hover:bg-slate-700 active:scale-95"
              >
                <span>Nueva venta</span>
                <span className="hidden text-[10px] font-normal text-slate-300 sm:inline">[Alt+N]</span>
              </button>
            </div>

            {/* Display scale toggle for tablet 11" 2560x1600 & high resolution */}
            <div className="flex flex-wrap items-center gap-2">
              {onDisplayScaleChange ? (
                <div className="flex items-center gap-1 rounded-2xl border border-stone-200 bg-stone-50 p-1 text-xs">
                  <span className="hidden px-2 text-[10px] font-black uppercase tracking-wider text-stone-500 xl:inline">
                    Pantalla:
                  </span>
                  <button
                    type="button"
                    onClick={() => onDisplayScaleChange('normal')}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                      displayScale === 'normal'
                        ? 'bg-white text-stone-900 shadow-2xs font-black'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                    title="Escala 100% estándar"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisplayScaleChange('large')}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                      displayScale === 'large'
                        ? 'bg-sky-600 text-white shadow-2xs font-black'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                    title="Escala 120% optimizada para tableta de 11 pulgadas (2560x1600)"
                  >
                    120% Tableta
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisplayScaleChange('xlarge')}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold transition active:scale-95 ${
                      displayScale === 'xlarge'
                        ? 'bg-sky-600 text-white shadow-2xs font-black'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                    title="Escala 135% extra grande"
                  >
                    135%
                  </button>
                </div>
              ) : null}

              {/* Customer selector bar */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onOpenCustomerSearch}
                  className="flex h-11 items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/80 px-3.5 text-xs font-bold text-indigo-950 transition hover:border-indigo-400 hover:bg-indigo-100 active:scale-95"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-indigo-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span className="max-w-36 truncate sm:max-w-56">{customerLabel}</span>
                  <span className="rounded bg-indigo-200/80 px-1.5 py-0.5 text-[10px] font-black text-indigo-900">[Ctrl+K]</span>
                </button>

                {selectedCustomer ? (
                  <button
                    type="button"
                    onClick={onClearCustomer}
                    title="Restablecer a Consumidor Final"
                    className="flex h-11 w-9 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700 active:scale-95"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Center Brand / Customer Display Banner */}
          <div className="text-center py-1">
            <span className="text-xl font-black tracking-wide text-orange-600 sm:text-2xl">
              {customerLabel.toUpperCase()}
            </span>
            {selectedCustomer?.receivableBalance && Number(selectedCustomer.receivableBalance) > 0 ? (
              <span className="ml-3 rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                Saldo Deudor: {money(selectedCustomer.receivableBalance, currencySymbol)}
              </span>
            ) : null}
          </div>

          {/* Product quick scan inputs */}
          <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">
            {/* Buscar producto: High-Visibility Sky Blue Button */}
            <button
              type="button"
              onClick={onOpenProductSearch}
              className="flex h-12 shrink-0 items-center gap-2 rounded-2xl border-2 border-sky-500 bg-sky-600 px-4 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-sky-900/20 transition hover:bg-sky-500 active:scale-95"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Buscar producto</span>
              <span className="rounded-lg bg-sky-800/70 px-1.5 py-0.5 text-[10px] text-sky-100 font-bold">[Ctrl+B / /]</span>
            </button>

            <form onSubmit={onScanSubmit} className="flex min-w-0 flex-1 items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  ref={scanInputRef}
                  type="text"
                  placeholder="CÓDIGO DE BARRAS O CÓD. INTERNO"
                  value={scanQuery}
                  onChange={(e) => onScanQueryChange(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-12 w-full rounded-2xl border-2 border-stone-300 bg-stone-50/50 px-4 text-sm font-bold tracking-wider text-stone-900 placeholder:text-stone-400 focus:border-sky-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="w-24 shrink-0 sm:w-28">
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  placeholder="CANT."
                  value={scanQty}
                  onChange={(e) => onScanQtyChange(e.target.value)}
                  className="h-12 w-full rounded-2xl border-2 border-stone-300 bg-stone-50/50 px-3 text-center text-sm font-black text-stone-900 placeholder:text-stone-400 focus:border-sky-600 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="flex h-12 shrink-0 items-center justify-center rounded-2xl border-2 border-stone-800 bg-stone-900 px-5 text-sm font-black text-white shadow-xs transition hover:bg-stone-800 active:scale-95"
              >
                Agregar
              </button>
            </form>
          </div>
        </div>

        {/* Right Section: Big Total Card & Cobrar Button */}
        <div className="flex min-w-[280px] flex-col justify-between rounded-3xl border border-slate-800 bg-[#0f172a] p-5 text-white shadow-xl sm:min-w-[320px] 2xl:min-w-[380px] 2xl:p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black tracking-widest text-amber-400 2xl:text-base">
              TOTAL {currencySymbol}
            </span>
            <button
              type="button"
              onClick={onOpenPayment}
              disabled={!canCompleteSale}
              className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow-lg transition active:scale-95 2xl:px-6 2xl:py-3 2xl:text-sm ${
                canCompleteSale
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-950/40 ring-2 ring-emerald-400/30'
                  : 'cursor-not-allowed bg-slate-800 text-slate-500'
              }`}
            >
              <span className="text-sm 2xl:text-base">Cobrar</span>
              <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200 2xl:text-xs">[Ctrl+Enter]</span>
            </button>
          </div>

          <div className="my-3 text-right">
            <div className="text-3xl font-black tracking-tight text-white sm:text-4xl 2xl:text-5xl tabular-nums">
              {money(totalAmount, currencySymbol).replace(currencySymbol, '')}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-2.5 text-xs font-bold text-amber-400/90 2xl:text-sm">
            <span>Artículos: {cartItemCount}</span>
            <span>Cantidad: {Number(cartTotalUnits.toFixed(3))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
