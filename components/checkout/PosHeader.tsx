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
  canCompleteSale
}: PosHeaderProps) {
  const customerLabel = selectedCustomer
    ? selectedCustomer.businessName ||
      `${selectedCustomer.firstName ?? ''} ${selectedCustomer.lastName ?? ''}`.trim() ||
      'Cliente'
    : 'CONSUMIDOR FINAL';

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
        {/* Left & Center Section */}
        <div className="flex flex-col justify-between gap-4">
          {/* Top toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRequestClearCart}
                title="Vaciar carrito [Alt + N]"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
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

              <button
                type="button"
                onClick={onOpenParkedSales}
                className="flex h-10 items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3 text-xs font-bold uppercase tracking-wider text-stone-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
              >
                <span>Ventas en espera</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-200 px-1.5 text-[10px] font-black text-amber-900">
                  {parkedSalesCount}
                </span>
                <span className="hidden text-[10px] font-normal text-stone-400 sm:inline">[Alt+E]</span>
              </button>

              <button
                type="button"
                onClick={onNewSale}
                className="flex h-10 items-center gap-1.5 rounded-2xl border border-stone-200 bg-stone-50 px-3 text-xs font-bold uppercase tracking-wider text-stone-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <span>Nueva venta</span>
                <span className="hidden text-[10px] font-normal text-stone-400 sm:inline">[Alt+N]</span>
              </button>
            </div>

            {/* Customer selector bar */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenCustomerSearch}
                className="flex h-10 items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3 text-xs font-medium text-stone-700 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-stone-500"
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
                <span className="text-[10px] font-bold text-sky-700">[Ctrl+K]</span>
              </button>

              {selectedCustomer ? (
                <button
                  type="button"
                  onClick={onClearCustomer}
                  title="Restablecer a Consumidor Final"
                  className="flex h-10 w-8 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-400 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>

          {/* Center Brand / Customer Display Banner */}
          <div className="text-center">
            <span className="text-xl font-black tracking-wide text-orange-600 sm:text-2xl">
              {customerLabel.toUpperCase()}
            </span>
            {selectedCustomer?.receivableBalance && Number(selectedCustomer.receivableBalance) > 0 ? (
              <span className="ml-3 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                Saldo Deudor: {money(selectedCustomer.receivableBalance, currencySymbol)}
              </span>
            ) : null}
          </div>

          {/* Product quick scan inputs */}
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <button
              type="button"
              onClick={onOpenProductSearch}
              className="flex h-12 shrink-0 items-center gap-2 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 px-4 text-xs font-bold uppercase tracking-wider text-sky-800 shadow-sm transition hover:border-sky-500 hover:bg-sky-100"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Buscar producto</span>
              <span className="rounded-lg bg-sky-200 px-1.5 py-0.5 text-[10px] text-sky-900">[Ctrl+B / /]</span>
            </button>

            <form onSubmit={onScanSubmit} className="flex min-w-0 flex-1 items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  ref={scanInputRef}
                  type="text"
                  placeholder="CÓDIGO DE BARRAS / SKU"
                  value={scanQuery}
                  onChange={(e) => onScanQueryChange(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-12 w-full rounded-2xl border-2 border-stone-300 bg-stone-50/50 px-4 text-sm font-semibold tracking-wider text-stone-900 placeholder:text-stone-400 focus:border-sky-600 focus:bg-white focus:outline-none"
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
                  className="h-12 w-full rounded-2xl border-2 border-stone-300 bg-stone-50/50 px-3 text-center text-sm font-bold text-stone-900 placeholder:text-stone-400 focus:border-sky-600 focus:bg-white focus:outline-none"
                />
              </div>

              <Button type="submit" variant="secondary" className="h-12 shrink-0 rounded-2xl px-4 font-bold">
                Agregar
              </Button>
            </form>
          </div>
        </div>

        {/* Right Section: Big Total Card */}
        <div className="flex min-w-[280px] flex-col justify-between rounded-2xl border border-slate-800 bg-[#0f172a] p-5 text-white shadow-lg sm:min-w-[320px]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black tracking-widest text-amber-400">TOTAL $</span>
            <button
              type="button"
              onClick={onOpenPayment}
              disabled={!canCompleteSale}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold uppercase tracking-wider shadow transition ${
                canCompleteSale
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95'
                  : 'cursor-not-allowed bg-slate-800 text-slate-500'
              }`}
            >
              <span>Cobrar</span>
              <span className="rounded bg-black/30 px-1 py-0.5 text-[10px]">[Ctrl+Enter]</span>
            </button>
          </div>

          <div className="my-3 text-right">
            <div className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              {money(totalAmount, currencySymbol).replace(currencySymbol, '')}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-xs font-semibold text-amber-400/90">
            <span>Items: {cartItemCount}</span>
            <span>Prod: {Number(cartTotalUnits.toFixed(3))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
