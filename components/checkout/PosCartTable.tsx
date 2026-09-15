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
            <tr className="bg-[#1e3a5f] text-xs font-black uppercase tracking-wider text-white">
              <th className="py-3.5 pl-6 pr-4">Descripción</th>
              <th className="px-4 py-3.5 text-center">Cant</th>
              <th className="px-4 py-3.5 text-right">Precio</th>
              <th className="py-3.5 pl-4 pr-6 text-right">Importe</th>
              <th className="w-12 py-3.5 pr-4 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-sm">
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
                    <td className="py-3.5 pl-6 pr-4">
                      <div className="font-extrabold uppercase text-stone-900">{item.name}</div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-stone-500">
                        {item.variantLabel ? (
                          <span className="font-medium text-sky-700">{item.variantLabel}</span>
                        ) : null}
                        {item.barcode ? <span>Cód: {item.barcode}</span> : null}
                        {item.sku ? <span>SKU: {item.sku}</span> : null}
                      </div>
                    </td>

                    {/* Quantity with fast controls */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 'decrease')}
                          className="flex h-7 w-7 items-center justify-center rounded-xl bg-stone-100 font-bold text-stone-700 transition hover:bg-stone-200 active:scale-90"
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
                          className="w-16 text-center text-sm font-black text-stone-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 'increase')}
                          className="flex h-7 w-7 items-center justify-center rounded-xl bg-stone-100 font-bold text-stone-700 transition hover:bg-stone-200 active:scale-90"
                          title="Aumentar"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Unit Price */}
                    <td className="px-4 py-3.5 text-right font-semibold text-stone-700">
                      {money(item.price, currencySymbol)}
                    </td>

                    {/* Line Total */}
                    <td className="py-3.5 pl-4 pr-6 text-right font-black text-stone-950">
                      {money(lineTotal, currencySymbol)}
                    </td>

                    {/* Delete Action */}
                    <td className="py-3.5 pr-4 text-center">
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Quitar artículo"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
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
