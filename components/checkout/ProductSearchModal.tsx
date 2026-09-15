'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { money } from '@/lib/format';
import type { Category, Product } from './types';

type ProductSearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  currencySymbol: string;
  onSelectProduct: (product: Product) => void;
};

function ProductSearchDialog({
  onClose,
  products,
  categories,
  currencySymbol,
  onSelectProduct
}: Omit<ProductSearchModalProps, 'isOpen'>) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
      if (!matchesCategory) return false;
      if (!term) return true;

      return (
        product.name.toLowerCase().includes(term) ||
        Boolean(product.variantLabel?.toLowerCase().includes(term)) ||
        Boolean(product.barcode?.toLowerCase().includes(term)) ||
        Boolean(product.sku?.toLowerCase().includes(term)) ||
        Boolean(product.category?.name.toLowerCase().includes(term))
      );
    });
  }, [products, search, selectedCategory]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col rounded-3xl border border-stone-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-stone-900">Buscar Producto en Catálogo</h3>
              <p className="text-xs text-stone-500">Seleccione un producto para agregarlo a la venta actual</p>
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

        {/* Search Bar & Categories */}
        <div className="border-b border-stone-100 bg-stone-50/70 p-4 space-y-3">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nombre, código de barras, SKU o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 w-full rounded-2xl border-2 border-stone-300 bg-white px-4 text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:border-sky-600 focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-xs text-stone-400 hover:text-stone-700"
              >
                Limpiar
              </button>
            ) : null}
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                !selectedCategory
                  ? 'bg-sky-700 text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-100'
              }`}
            >
              Todos ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  selectedCategory === cat.id
                    ? 'bg-sky-700 text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Results List/Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stockQty <= 0;

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      onSelectProduct(product);
                      onClose();
                    }}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-3.5 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-stone-100 bg-stone-50">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-stone-400">
                            PROD
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-stone-900">{product.name}</div>
                        <div className="mt-0.5 truncate text-xs text-stone-500">
                          {product.variantLabel ?? product.category?.name ?? 'Estándar'}
                        </div>
                        <div className="mt-1 text-[11px] text-stone-400">
                          {product.barcode ? `Cód: ${product.barcode}` : product.sku ? `SKU: ${product.sku}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 text-xs">
                      <span className="text-base font-black text-emerald-700">
                        {money(product.price, currencySymbol)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold ${
                          isOutOfStock
                            ? 'bg-red-50 text-red-700'
                            : product.stockQty <= 5
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {isOutOfStock ? 'Agotado' : `${product.stockQty} disp.`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-stone-500">
              <p className="font-semibold text-stone-700">No se encontraron productos coincidentes.</p>
              <p className="mt-1 text-xs">Pruebe con otros términos o revise los filtros de categoría.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/50 px-5 py-3 text-xs text-stone-500">
          <span>{filteredProducts.length} producto(s) encontrado(s)</span>
          <span>Presione <kbd className="rounded bg-stone-200 px-1.5 py-0.5 font-mono text-[10px]">Escape</kbd> para cerrar</span>
        </div>
      </div>
    </div>
  );
}

export default function ProductSearchModal({ isOpen, ...props }: ProductSearchModalProps) {
  if (!isOpen) return null;
  return <ProductSearchDialog {...props} />;
}
