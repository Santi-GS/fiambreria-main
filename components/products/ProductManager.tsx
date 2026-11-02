'use client';

import { useEffect, useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import ProductFormModal from '@/components/products/ProductFormModal';
import { money, shortDate } from '@/lib/format';
import { getStockLevel, stockLevelLabel } from '@/lib/inventory';
import { buildVariantLabel, getMarginSummary } from '@/lib/product-merchandising';
import { summarizeConversions } from '@/lib/uom';
import type { Category, Product, UnitOfMeasure, Variant } from './types';

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

function toVariantLabel(variant: Variant) {
  return buildVariantLabel({
    color: variant.color,
    size: variant.size,
    flavor: variant.flavor,
    model: variant.model
  });
}

export default function ProductManager({
  initialProducts,
  categories,
  units,
  canEditProducts,
  canViewPurchaseCosts,
  currencySymbol,
  lowStockThreshold,
  inventoryDefaults
}: {
  initialProducts: Product[];
  categories: Category[];
  units: UnitOfMeasure[];
  canEditProducts: boolean;
  canViewPurchaseCosts: boolean;
  currencySymbol: string;
  lowStockThreshold: number;
  inventoryDefaults: {
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    expiryAlertDays: number;
  };
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Support for Command Palette link `/products#new-product`
  useEffect(() => {
    function checkHash() {
      if (typeof window !== 'undefined' && window.location.hash === '#new-product' && canEditProducts) {
        setEditingProduct(null);
        setIsModalOpen(true);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [canEditProducts]);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();

    return products.filter((product) => {
      const variantSearch = product.variants
        .map((variant) => [variant.sku ?? '', variant.barcode ?? '', toVariantLabel(variant)].join(' '))
        .join(' ');
      const matchesTerm =
        !term ||
        [product.name, product.sku ?? '', product.barcode ?? '', product.category?.name ?? '', variantSearch]
          .join(' ')
          .toLowerCase()
          .includes(term);

      const matchesCategory = !categoryFilter || product.categoryId === categoryFilter;
      return matchesTerm && matchesCategory;
    });
  }, [products, query, categoryFilter]);

  const activeCount = products.filter((product) => product.isActive).length;
  const archivedCount = products.length - activeCount;
  const lowStockCount = products.filter(
    (product) => getStockLevel(product.stockQty, product.reorderPoint, lowStockThreshold) !== 'IN_STOCK'
  ).length;

  function handleOpenCreateModal() {
    setEditingProduct(null);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(product: Product) {
    setEditingProduct(product);
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingProduct(null);
  }

  function handleProductSaved(savedProduct: Product, isNew: boolean) {
    setProducts((currentProducts) =>
      isNew
        ? [savedProduct, ...currentProducts]
        : currentProducts.map((item) => (item.id === savedProduct.id ? savedProduct : item))
    );
  }

  async function toggleArchive(product: Product) {
    const actionLabel = product.isActive ? 'archivar' : 'restaurar';
    const confirmed = window.confirm(`¿Deseas ${actionLabel} "${product.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !product.isActive
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.product) {
        alert(data?.error ?? 'No se pudo actualizar el estado del producto.');
        return;
      }

      setProducts((currentProducts) =>
        currentProducts.map((item) =>
          item.id === product.id ? { ...item, isActive: data.product.isActive } : item
        )
      );
    } catch {
      alert('Error de conexión al cambiar el estado del producto.');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-stone-900">Catálogo de productos</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span>{filtered.length} de {products.length} producto(s)</span>
              <span>•</span>
              <span className="font-semibold text-emerald-700">{activeCount} activos</span>
              {lowStockCount > 0 ? (
                <>
                  <span>•</span>
                  <span className="font-bold text-amber-700">{lowStockCount} stock bajo</span>
                </>
              ) : null}
              {archivedCount > 0 ? (
                <>
                  <span>•</span>
                  <span className="text-stone-400">{archivedCount} archivados</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Buscar productos o variantes..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full sm:w-64 h-11"
            />
            <select
              className={`${selectClassName} w-full sm:w-52`}
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {canEditProducts ? (
              <Button
                type="button"
                onClick={handleOpenCreateModal}
                className="h-11 px-5 gap-2 text-sm font-bold shadow-xs active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Añadir producto
              </Button>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Producto</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Categoría</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Datos comerciales</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Variantes</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Precios</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Existencias</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((product) => {
                  const level = getStockLevel(product.stockQty, product.reorderPoint, lowStockThreshold);
                  const margin = getMarginSummary(Number(product.price), Number(product.cost));
                  const nextExpiryBatch = product.batches.find((batch) => batch.expiryDate && batch.quantity > 0) ?? null;

                  return (
                    <tr key={product.id} className="bg-white transition hover:bg-stone-50/70">
                      <td className="px-4 py-4">
                        <div className="flex gap-3">
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[18px] border border-stone-200 bg-stone-50">
                            {product.images[0] ? (
                              <img
                                src={product.images[0].imageUrl}
                                alt={product.images[0].altText ?? product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900">{product.name}</div>
                            <div className="mt-1 text-xs text-stone-500 line-clamp-1">
                              {product.description ?? 'Sin descripción'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold text-stone-600">
                        {product.category?.name ?? 'Sin categoría'}
                      </td>
                      <td className="px-4 py-4 text-stone-600">
                        <div className="text-xs font-medium">
                          {product.sku || 'S/SKU'} · {product.barcode || 'S/CB'}
                        </div>
                        <div className="mt-1 text-[11px] text-stone-500">
                          Base: {product.baseUnitOfMeasure?.name ?? 'Unidad no asignada'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-stone-400">
                          {summarizeConversions(
                            product.uomConversions.map((conversion) => ({
                              unitName: conversion.unitOfMeasure.name,
                              ratioToBase: conversion.ratioToBase
                            })),
                            product.baseUnitOfMeasure?.name
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone="blue">{product.variants.length} variante(s)</Badge>
                          {product.images.length ? (
                            <Badge tone="stone">{product.images.length} foto(s)</Badge>
                          ) : null}
                        </div>
                        <div className="mt-1.5 text-[11px] text-stone-500 line-clamp-1">
                          {product.variants
                            .slice(0, 2)
                            .map((variant) => toVariantLabel(variant) || variant.sku || variant.barcode || 'Variante')
                            .join(' | ') || 'Sin variantes'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-stone-900">{money(product.price, currencySymbol)}</div>
                        {canViewPurchaseCosts ? (
                          <>
                            <div className="text-xs text-stone-500">Costo {money(product.cost, currencySymbol)}</div>
                            <div
                              className={`mt-1 text-[11px] font-semibold ${
                                margin.tone === 'red'
                                  ? 'text-red-700'
                                  : margin.tone === 'amber'
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                              }`}
                            >
                              {margin.message}
                            </div>
                          </>
                        ) : (
                          <div className="text-[11px] text-stone-400">Costo restringido</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-stone-900">
                          {product.baseUnitOfMeasure?.code === 'KG'
                            ? `${(product.stockQty / 1000).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} Kg`
                            : `${product.stockQty} unid.`}
                        </div>
                        <div className="mt-1 text-[11px] text-stone-500">
                          {nextExpiryBatch?.expiryDate
                            ? `Vence: ${shortDate(nextExpiryBatch.expiryDate)}`
                            : product.batches.length
                              ? `${product.batches.length} lote(s)`
                              : 'Sin lotes'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5">
                          <Badge tone={product.isActive ? 'emerald' : 'stone'}>
                            {product.isActive ? 'Activo' : 'Archivado'}
                          </Badge>
                          <Badge
                            tone={
                              level === 'OUT_OF_STOCK'
                                ? 'red'
                                : level === 'LOW_STOCK'
                                  ? 'amber'
                                  : 'blue'
                            }
                          >
                            {stockLevelLabel(level)}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {canEditProducts ? (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              className="text-xs font-bold"
                              onClick={() => handleOpenEditModal(product)}
                            >
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-xs uppercase tracking-wider text-stone-500 hover:text-stone-900"
                              onClick={() => toggleArchive(product)}
                            >
                              {product.isActive ? 'Archivar' : 'Restaurar'}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400">Solo lectura</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!filtered.length ? (
            <div className="border-t border-stone-200 bg-stone-50 py-12 text-center text-xs font-semibold text-stone-500">
              Ningún producto coincide con el filtro seleccionado.
            </div>
          ) : null}
        </div>
      </Card>

      {/* Modal / Pop-up para Añadir o Editar Producto */}
      {canEditProducts ? (
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          editingProduct={editingProduct}
          categories={categories}
          units={units}
          canViewPurchaseCosts={canViewPurchaseCosts}
          currencySymbol={currencySymbol}
          inventoryDefaults={inventoryDefaults}
          onSaved={handleProductSaved}
        />
      ) : null}
    </div>
  );
}
