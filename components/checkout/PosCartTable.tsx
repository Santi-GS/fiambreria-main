'use client';

import { money } from '@/lib/format';
import type { CartItem } from './types';

type PosCartTableProps = {
  cart: CartItem[];
  currencySymbol: string;
  onUpdateQty: (productId: string, action: 'increase' | 'decrease' | 'set', value?: number) => void;
  onEditWeightedItem: (item: CartItem) => void;
  onRemoveItem: (productId: string) => void;
  onOpenProductSearch: () => void;
};

export default function PosCartTable({
  cart,
  currencySymbol,
  onUpdateQty,
  onEditWeightedItem,
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
              <th className="px-4 py-4 text-center 2xl:py-5">Cantidad</th>
              <th className="px-4 py-4 text-right 2xl:py-5">Precio unit.</th>
              <th className="py-4 pl-4 pr-6 text-right 2xl:py-5">Importe</th>
              <th className="w-14 py-4 pr-4 text-center 2xl:py-5">
                <span className="sr-only">Quitar</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-sm 2xl:text-base">
            {cart.length > 0 ? (
              cart.map((item, index) => {
                const isWeighted = item.baseUnitCode === 'KG';
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
                        {isWeighted ? (
                          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            Pesable (x Kg)
                          </span>
                        ) : null}
                        {item.barcode ? <span>Código: {item.barcode}</span> : null}
                        {item.sku ? <span>Cód. int.: {item.sku}</span> : null}
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-4 text-center 2xl:py-5">
                      {isWeighted ? (
                        /* Weighted items: clickable button with pencil icon to reopen WeighProductModal */
                        <button
                          type="button"
                          onClick={() => onEditWeightedItem(item)}
                          title="Haga clic para editar el peso"
                          aria-label={`Editar peso de ${item.name} (${item.qty.toFixed(3)} Kg)`}
                          className="group inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 px-3.5 py-2 shadow-2xs transition hover:border-amber-500 hover:bg-amber-100/80 active:scale-95"
                        >
                          <span className="text-base font-black tabular-nums text-stone-900 2xl:text-lg">
                            {item.qty.toFixed(3).replace('.', ',')}
                          </span>
                          <span className="text-xs font-bold text-amber-800">Kg</span>
                          <span className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-lg bg-amber-200/70 text-amber-900 transition group-hover:bg-amber-500 group-hover:text-white">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3.5 w-3.5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </span>
                        </button>
                      ) : (
                        /* Unit items: standard +/- controls */
                        <div className="inline-flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white p-1 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.id, 'decrease')}
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-base font-black text-stone-800 transition hover:bg-stone-200 active:scale-95"
                            title="Disminuir cantidad"
                            aria-label={`Disminuir cantidad de ${item.name}`}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={item.qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val > 0) {
                                onUpdateQty(item.id, 'set', val);
                              }
                            }}
                            aria-label={`Cantidad de ${item.name}`}
                            className="w-16 text-center text-base font-black text-stone-900 focus:outline-none tabular-nums sm:w-20 2xl:text-lg"
                          />
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.id, 'increase')}
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-base font-black text-stone-800 transition hover:bg-stone-200 active:scale-95"
                            title="Aumentar cantidad"
                            aria-label={`Aumentar cantidad de ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Unit Price */}
                    <td className="px-4 py-4 text-right font-bold text-stone-700 tabular-nums 2xl:py-5 2xl:text-base">
                      {money(item.price, currencySymbol)}
                      {isWeighted ? (
                        <span className="ml-0.5 text-[10px] font-semibold text-stone-400">/Kg</span>
                      ) : null}
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
                        title="Quitar artículo del carrito"
                        aria-label={`Quitar ${item.name} del carrito`}
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
                      Escanee un código de barras con el lector o presione{' '}
                      <button
                        type="button"
                        onClick={onOpenProductSearch}
                        className="font-bold text-sky-700 underline underline-offset-2 hover:text-sky-800"
                      >
                        Buscar producto [Ctrl+B]
                      </button>{' '}
                      para elegir del catálogo.
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
