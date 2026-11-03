'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { money } from '@/lib/format';
import { formatStock, isKgBaseProduct } from '@/lib/purchase-units';

export type PickerProduct = {
  id: string;
  name: string;
  cost: string;
  stockQty: number;
  barcode?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  baseUnitOfMeasure?: { code: string; name: string } | null;
};

type Props = {
  products: PickerProduct[];
  categories: Array<{ id: string; name: string }>;
  currencySymbol: string;
  /** Units already added per product id (to show a badge). */
  addedByProduct: Record<string, number>;
  onPick: (productId: string) => void;
  onClose: () => void;
};

export default function PurchaseProductPicker({ products, categories, currencySymbol, addedByProduct, onPick, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (category && product.categoryId !== category) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        Boolean(product.barcode?.toLowerCase().includes(term)) ||
        Boolean(product.sku?.toLowerCase().includes(term)) ||
        Boolean(product.categoryName?.toLowerCase().includes(term))
      );
    });
  }, [products, search, category]);

  const addedCount = Object.keys(addedByProduct).length;

  return (
    <div className="fixed inset-0 z-50 bg-white" role="dialog" aria-modal="true" aria-label="Agregar productos a la compra">
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 p-4">
          <div>
            <h3 className="text-xl font-black text-stone-900">Agregar productos</h3>
            <p className="text-sm text-stone-500">Tocá un producto para sumarlo (1 unidad). Ajustás cantidad y costo en la lista.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-600 hover:bg-stone-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 border-b border-stone-100 bg-stone-50/70 p-4">
          <input
            ref={inputRef}
            type="search"
            placeholder="Buscar por nombre, código de barras, código interno o categoría…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-14 w-full rounded-2xl border-2 border-stone-300 bg-white px-4 text-base font-semibold text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategory('')}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${
                !category ? 'bg-emerald-600 text-white' : 'border border-stone-200 bg-white text-stone-700'
              }`}
            >
              Todos ({products.length})
            </button>
            {categories.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setCategory(entry.id)}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${
                  category === entry.id ? 'bg-emerald-600 text-white' : 'border border-stone-200 bg-white text-stone-700'
                }`}
              >
                {entry.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => {
                const isKg = isKgBaseProduct(product);
                const added = addedByProduct[product.id];
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => onPick(product.id)}
                    className={`relative flex flex-col justify-between rounded-2xl border bg-white p-3.5 text-left shadow-2xs transition active:scale-[0.98] ${
                      added ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-stone-200 hover:border-emerald-400'
                    }`}
                  >
                    {added ? (
                      <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-black text-white">
                        ✓ en compra
                      </span>
                    ) : null}
                    <div className="flex items-start gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-stone-100 bg-stone-50">
                        {product.imageUrl ? (
                          <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-stone-400">SIN FOTO</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pr-14">
                        <div className="font-bold leading-tight text-stone-900">{product.name}</div>
                        <div className="mt-0.5 truncate text-xs text-stone-500">{product.categoryName ?? 'Sin categoría'}</div>
                        <div className="mt-1 text-[11px] text-stone-400">
                          {product.barcode ? `Cód.: ${product.barcode}` : product.sku ? `Cód. int.: ${product.sku}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 text-xs">
                      <span className="text-sm font-black text-stone-700">
                        Costo {money(product.cost, currencySymbol)}
                        {isKg ? <span className="ml-0.5 text-[10px] font-bold text-stone-500">/Kg</span> : null}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold ${
                          product.stockQty <= 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {product.stockQty <= 0 ? 'Agotado' : formatStock(product.stockQty, isKg, product.baseUnitOfMeasure?.name)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-stone-500">
              <p className="font-semibold text-stone-700">No se encontraron productos.</p>
              <p className="mt-1 text-sm">Probá con otros términos o revisá la categoría.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/50 p-3">
          <span className="text-sm text-stone-500">
            {filtered.length} producto(s) · {addedCount} en la compra
          </span>
          <button type="button" onClick={onClose} className="h-12 rounded-2xl bg-emerald-600 px-6 text-base font-bold text-white hover:bg-emerald-700">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

