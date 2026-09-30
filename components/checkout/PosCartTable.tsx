'use client';

import { money } from '@/lib/format';
import type { CartItem } from './types';

type PosCartTableProps = {
  cart: CartItem[];
  currencySymbol: string;
  onUpdateQty: (productId: string, action: 'increase' | 'decrease' | 'set', value?: number) => void;
  onRemoveItem: (productId: string) => void;
  onOpenProductSearch: () => void;
};

export default function PosCartTable({
  cart,
  currencySymbol,
  onUpdateQty,
  onRemoveItem,
  onOpenProductSearch
}: PosCartTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#1e3a5f] text-xs font-black uppercase tracking-wider text-white 2xl:text-sm">
              <th className="py-4 pl-6 pr-4 2xl:py-5">Descripción</th>
              <th className="px-4 py-4 text-center 2xl:py-5">Cant</th>
              <th className="px-4 py-4 text-right 2xl:py-5">Precio</th>
              <th className="py-4 pl-4 pr-6 text-right 2xl:py-5">Importe</th>
              <th className="w-14 py-4 pr-4 text-center 2xl:py-5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-sm 2xl:text-base">
            {cart.length > 0 ? (
              cart.map((item, index) => {
                const lineTotal = Number(item.price) * item.qty;
                const isEven = index % 2 === 0;

                return (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-sky-50/60 ${isEven ? 'bg-white' : 'bg-stone-50/40'}`}
                  >
                    {/* Description */}
                    <td className="py-4 pl-6 pr-4 2xl:py-5">
                      <div className="text-sm font-black uppercase tracking-tight text-stone-950 sm:text-base 2xl:text-lg">
                        {item.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-stone-500 2xl:text-sm">
                        {item.variantLabel ? (
                          <span className="font-bold text-sky-700">{item.variantLabel}</span>
                        ) : null}
                        {item.barcode ? <span>Cód: {item.barcode}</span> : null}
                        {item.sku ? <span>SKU: {item.sku}</span> : null}
                      </div>
                    </td>

                    {/* Quantity with fast touch-friendly controls */}
                    <td className="px-4 py-4 text-center 2xl:py-5">
                      <div className="inline-flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 'decrease')}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-base font-black text-stone-800 transition hover:bg-stone-200 active:scale-95"
                          title="Disminuir"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={item.qty}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              onUpdateQty(item.id, 'set', val);
                            }
                          }}
                          className="w-16 text-center text-base font-black text-stone-900 focus:outline-none tabular-nums sm:w-20 2xl:text-lg"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 'increase')}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-base font-black text-stone-800 transition hover:bg-stone-200 active:scale-95"
                          title="Aumentar"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Unit Price */}
                    <td className="px-4 py-4 text-right font-bold text-stone-700 tabular-nums 2xl:py-5 2xl:text-base">
                      {money(item.price, currencySymbol)}
                    </td>

                    {/* Line Total */}
                    <td className="py-4 pl-4 pr-6 text-right text-base font-black text-stone-950 tabular-nums 2xl:py-5 2xl:text-lg">
                      {money(lineTotal, currencySymbol)}
                    </td>

                    {/* Delete Action */}
                    <td className="py-4 pr-4 text-center">
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-transparent text-stone-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95"
                        title="Quitar artículo"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="mx-auto max-w-md space-y-3">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-7 w-7"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    </div>
                    <div className="text-base font-bold text-stone-800">El carrito está vacío</div>
                    <p className="text-xs text-stone-500">
                      Escanee un código de barras con el lector láser o presione{' '}
                      <button
                        type="button"
                        onClick={onOpenProductSearch}
                        className="font-bold text-sky-700 underline underline-offset-2 hover:text-sky-800"
                      >
                        Buscar producto [Ctrl+B / /]
                      </button>{' '}
                      para seleccionar del catálogo.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
