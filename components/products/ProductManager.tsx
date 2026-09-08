'use client';

import { type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import BarcodeLabelPreview, { type BarcodeLabelSize } from '@/components/products/BarcodeLabelPreview';
import { money, shortDate } from '@/lib/format';
import { getStockLevel, stockLevelLabel } from '@/lib/inventory';
import {
  buildVariantLabel,
  getMarginSummary
} from '@/lib/product-merchandising';
import { summarizeConversions } from '@/lib/uom';

type Category = { id: string; name: string; parentId: string | null };
type UnitOfMeasure = { id: string; code: string; name: string; isBase: boolean };
type Variant = {
  id: string;
  color: string | null;
  size: string | null;
  flavor: string | null;
  model: string | null;
  sku: string | null;
  barcode: string | null;
  priceOverride: string | null;
  costOverride: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type ProductImage = {
  id: string;
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
  createdAt: string;
};
type HistoryUser = { id: string; name: string | null; email: string };
type PriceHistory = {
  id: string;
  previousPrice: string;
  newPrice: string;
  effectiveDate: string;
  createdAt: string;
  note: string | null;
  changedByUser: HistoryUser;
};
type CostHistory = {
  id: string;
  previousCost: string;
  newCost: string;
  effectiveDate: string;
  createdAt: string;
  note: string | null;
  changedByUser: HistoryUser;
};
type Product = {
  id: string;
  categoryId: string | null;
  baseUnitOfMeasureId: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  cost: string;
  price: string;
  stockQty: number;
  reorderPoint: number;
  trackBatches: boolean;
  trackExpiry: boolean;
  isActive: boolean;
  baseUnitOfMeasure?: UnitOfMeasure | null;
  uomConversions: Array<{
    id: string;
    unitOfMeasureId: string;
    ratioToBase: number;
    unitOfMeasure: UnitOfMeasure;
  }>;
  variants: Variant[];
  images: ProductImage[];
  priceHistory: PriceHistory[];
  costHistory: CostHistory[];
  batches: Array<{
    id: string;
    lotNumber: string;
    expiryDate: string | null;
    quantity: number;
  }>;
  category?: { id: string; name: string } | null;
};
type VariantDraft = {
  color: string;
  size: string;
  flavor: string;
  model: string;
  sku: string;
  barcode: string;
  priceOverride: string;
  costOverride: string;
  isActive: boolean;
};
type ImageDraft = {
  imageUrl: string;
  altText: string;
  sortOrder: string;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-sm font-semibold text-stone-700">{children}</label>;
}

function emptyVariant(): VariantDraft {
  return {
    color: '',
    size: '',
    flavor: '',
    model: '',
    sku: '',
    barcode: '',
    priceOverride: '',
    costOverride: '',
    isActive: true
  };
}

function emptyImage(sortOrder = 0): ImageDraft {
  return {
    imageUrl: '',
    altText: '',
    sortOrder: String(sortOrder)
  };
}

function toVariantLabel(variant: VariantDraft | Variant) {
  return buildVariantLabel({
    color: variant.color,
    size: variant.size,
    flavor: variant.flavor,
    model: variant.model
  });
}

async function uploadProductImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/uploads/products', {
    method: 'POST',
    body: formData
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || typeof payload?.imageUrl !== 'string') {
    throw new Error(payload?.error || 'No se pudo subir la imagen.');
  }

  return payload.imageUrl as string;
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
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [labelSize, setLabelSize] = useState<BarcodeLabelSize>('medium');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    categoryId: '',
    baseUnitOfMeasureId: units.find((unit) => unit.code === 'PIECE')?.id ?? units[0]?.id ?? '',
    sku: '',
    barcode: '',
    name: '',
    description: '',
    cost: '0.00',
    price: '0.00',
    stockQty: '0',
    reorderPoint: '5',
    trackBatches: inventoryDefaults.batchTrackingEnabled,
    trackExpiry: inventoryDefaults.expiryTrackingEnabled,
    changeNote: '',
    uomConversions: [] as Array<{ unitOfMeasureId: string; ratioToBase: string }>,
    variants: [] as VariantDraft[],
    images: [] as ImageDraft[],
    isActive: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

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
  const selectedBaseUnit = units.find((unit) => unit.id === form.baseUnitOfMeasureId) ?? null;
  const currentMargin = getMarginSummary(Number(form.price || 0), Number(form.cost || 0));

  function resetForm() {
    setEditingId(null);
    setForm({
      categoryId: '',
      baseUnitOfMeasureId: units.find((unit) => unit.code === 'PIECE')?.id ?? units[0]?.id ?? '',
      sku: '',
      barcode: '',
      name: '',
      description: '',
      cost: '0.00',
      price: '0.00',
      stockQty: '0',
      reorderPoint: '5',
      trackBatches: inventoryDefaults.batchTrackingEnabled,
      trackExpiry: inventoryDefaults.expiryTrackingEnabled,
      changeNote: '',
      uomConversions: [],
      variants: [],
      images: [],
      isActive: true
    });
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  }

  function beginEdit(product: Product) {
    setEditingId(product.id);
    setError('');
    setSuccess('');
    setForm({
      categoryId: product.categoryId ?? '',
      baseUnitOfMeasureId: product.baseUnitOfMeasureId ?? units.find((unit) => unit.code === 'PIECE')?.id ?? '',
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      name: product.name,
      description: product.description ?? '',
      cost: product.cost,
      price: product.price,
      stockQty: String(product.stockQty),
      reorderPoint: String(product.reorderPoint),
      trackBatches: product.trackBatches,
      trackExpiry: product.trackExpiry,
      changeNote: '',
      uomConversions: product.uomConversions.map((conversion) => ({
        unitOfMeasureId: conversion.unitOfMeasureId,
        ratioToBase: String(conversion.ratioToBase)
      })),
      variants: product.variants.map((variant) => ({
        color: variant.color ?? '',
        size: variant.size ?? '',
        flavor: variant.flavor ?? '',
        model: variant.model ?? '',
        sku: variant.sku ?? '',
        barcode: variant.barcode ?? '',
        priceOverride: variant.priceOverride ?? '',
        costOverride: variant.costOverride ?? '',
        isActive: variant.isActive
      })),
      images: product.images.map((image) => ({
        imageUrl: image.imageUrl,
        altText: image.altText ?? '',
        sortOrder: String(image.sortOrder)
      })),
      isActive: product.isActive
    });
  }

  async function addUploadedImages(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const remainingSlots = Math.max(0, 6 - form.images.length);
    if (!remainingSlots) {
      setError('Solo puedes agregar hasta 6 imágenes por producto.');
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    setUploadingImages(true);
    setError('');

    try {
      const uploadedImageUrls = await Promise.all(selectedFiles.map((file) => uploadProductImage(file)));
      setForm((current) => ({
        ...current,
        images: [
          ...current.images,
          ...uploadedImageUrls.map((imageUrl, index) => ({
            ...emptyImage(current.images.length + index),
            imageUrl
          }))
        ]
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo subir una o más imágenes.');
    } finally {
      setUploadingImages(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError('El nombre del producto es obligatorio.');
      return;
    }

    if (Number(form.cost) < 0 || Number(form.price) < 0) {
      setError('El costo y el precio de venta no pueden ser negativos.');
      return;
    }

    if (!editingId && Number(form.stockQty) < 0) {
      setError('El stock inicial no puede ser negativo.');
      return;
    }

    if (Number(form.reorderPoint) < 0) {
      setError('El nivel de reposición por stock bajo no puede ser negativo.');
      return;
    }

    if (!form.baseUnitOfMeasureId) {
      setError('Selecciona una unidad base.');
      return;
    }

    for (const conversion of form.uomConversions) {
      if (!conversion.unitOfMeasureId || !conversion.ratioToBase) {
        setError('Completa o elimina las filas de conversión de unidades en blanco.');
        return;
      }

      if (Number(conversion.ratioToBase) <= 0) {
        setError('Los factores de conversión deben ser mayores a cero.');
        return;
      }
    }

    for (const variant of form.variants) {
      if (![variant.color, variant.size, variant.flavor, variant.model, variant.sku, variant.barcode].some(Boolean)) {
        setError('Cada variante necesita al menos un descriptor, SKU o código de barras.');
        return;
      }

      if (variant.priceOverride && Number(variant.priceOverride) < 0) {
        setError('El precio específico de la variante no puede ser negativo.');
        return;
      }

      if (variant.costOverride && Number(variant.costOverride) < 0) {
        setError('El costo específico de la variante no puede ser negativo.');
        return;
      }
    }

    for (const image of form.images) {
      if (!image.imageUrl.trim()) {
        setError('Elimina las filas de imagen en blanco o sube una imagen.');
        return;
      }
    }

    setLoading(true);

    const payload = {
      ...form,
      categoryId: form.categoryId || null,
      sku: form.sku || null,
      barcode: form.barcode || null,
      description: form.description || null,
      changeNote: form.changeNote || null,
      cost: Number(form.cost),
      price: Number(form.price),
      reorderPoint: Number(form.reorderPoint),
      uomConversions: form.uomConversions.map((conversion) => ({
        unitOfMeasureId: conversion.unitOfMeasureId,
        ratioToBase: Number(conversion.ratioToBase)
      })),
      variants: form.variants.map((variant) => ({
        color: variant.color || null,
        size: variant.size || null,
        flavor: variant.flavor || null,
        model: variant.model || null,
        sku: variant.sku || null,
        barcode: variant.barcode || null,
        priceOverride: variant.priceOverride ? Number(variant.priceOverride) : null,
        costOverride: variant.costOverride ? Number(variant.costOverride) : null,
        isActive: variant.isActive
      })),
      images: form.images.map((image, index) => ({
        imageUrl: image.imageUrl.trim(),
        altText: image.altText || null,
        sortOrder: Number(image.sortOrder || index)
      })),
      ...(editingId ? {} : { stockQty: Number(form.stockQty) })
    };

    const response = await fetch(editingId ? `/api/products/${editingId}` : '/api/products', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({ error: 'No se pudo guardar el producto.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'No se pudo guardar el producto.');
      return;
    }

    const product = {
      ...data.product,
      cost: String(data.product.cost),
      price: String(data.product.price),
      baseUnitOfMeasure: data.product.baseUnitOfMeasure,
      uomConversions: data.product.uomConversions ?? [],
      variants: data.product.variants ?? [],
      images: data.product.images ?? [],
      priceHistory: data.product.priceHistory ?? [],
      costHistory: data.product.costHistory ?? [],
      batches: editingId
        ? products.find((item) => item.id === editingId)?.batches ?? []
        : []
    };

    setProducts((currentProducts) =>
      editingId
        ? currentProducts.map((item) => (item.id === editingId ? product : item))
        : [product, ...currentProducts]
    );

    setSuccess(editingId ? 'Producto actualizado con éxito.' : 'Producto creado con éxito.');
    resetForm();
  }

  async function toggleArchive(product: Product) {
    const confirmed = window.confirm(`¿Deseas ${product.isActive ? 'archivar' : 'restaurar'} ${product.name}?`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isActive: !product.isActive
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.product) {
      setError(data?.error ?? 'No se pudo actualizar el estado del producto.');
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.map((item) =>
        item.id === product.id
          ? { ...item, isActive: data.product.isActive }
          : item
      )
    );
  }

  return (
    <div className="space-y-6">
      {canEditProducts ? (
      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Editor de catálogo</div>
            <div id="new-product" className="mt-2 text-2xl font-black text-stone-900">
              {editingId ? 'Editar producto' : 'Añadir producto'}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Configura precios, variantes estructuradas, imágenes y detalles comerciales manteniendo los cambios de inventario bajo control auditado.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Activos</div>
              <div className="mt-1 text-xl font-black text-stone-950">{activeCount}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Stock bajo</div>
              <div className="mt-1 text-xl font-black text-amber-700">{lowStockCount}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Archivados</div>
              <div className="mt-1 text-xl font-black text-stone-950">{archivedCount}</div>
            </div>
          </div>
        </div>

        <form onSubmit={saveProduct} className="space-y-6">
          <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Detalles principales</div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <FieldLabel>Nombre del producto</FieldLabel>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </div>
              <div>
                <FieldLabel>Categoría</FieldLabel>
                <select className={selectClassName} value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
                  <option value="">Sin categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Unidad base de venta</FieldLabel>
                <select
                  className={selectClassName}
                  value={form.baseUnitOfMeasureId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      baseUnitOfMeasureId: event.target.value,
                      uomConversions: current.uomConversions.filter((conversion) => conversion.unitOfMeasureId !== event.target.value)
                    }))
                  }
                >
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>SKU</FieldLabel>
                <Input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} />
              </div>
              <div>
                <FieldLabel>Código de barras</FieldLabel>
                <Input value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} />
              </div>
              {canViewPurchaseCosts ? (
                <div>
                  <FieldLabel>Precio de costo</FieldLabel>
                  <Input type="number" step="0.01" value={form.cost} onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))} />
                </div>
              ) : null}
              <div>
                <FieldLabel>Precio de venta</FieldLabel>
                <Input type="number" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
              </div>
              <div>
                <FieldLabel>{editingId ? 'Existencias actuales' : 'Cantidad inicial de existencias'}</FieldLabel>
                <Input type="number" value={form.stockQty} onChange={(event) => setForm((current) => ({ ...current, stockQty: event.target.value }))} disabled={Boolean(editingId)} />
              </div>
              <div>
                <FieldLabel>Nivel de reposición por existencias bajas</FieldLabel>
                <Input type="number" value={form.reorderPoint} onChange={(event) => setForm((current) => ({ ...current, reorderPoint: event.target.value }))} />
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <FieldLabel>Descripción</FieldLabel>
                <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div>
                <FieldLabel>Nota del cambio</FieldLabel>
                <Input value={form.changeNote} onChange={(event) => setForm((current) => ({ ...current, changeNote: event.target.value }))} placeholder="Motivo opcional de cambios de precio o costo" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
              <div className={`rounded-[20px] border px-4 py-3 text-sm ${currentMargin.tone === 'red' ? 'border-red-200 bg-red-50 text-red-700' : currentMargin.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                Revisión del margen: {currentMargin.message} Margen actual {currentMargin.percentage.toFixed(1)}%.
              </div>
              <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
                Unidad base: <span className="font-semibold text-stone-900">{selectedBaseUnit?.name ?? 'Sin seleccionar'}</span>
                {' / '}
                Alertas de la sucursal en {inventoryDefaults.expiryAlertDays} día(s)
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Operaciones</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-3 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={form.trackBatches}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trackBatches: event.target.checked,
                      trackExpiry: event.target.checked ? current.trackExpiry : false
                    }))
                  }
                />
                Registrar lotes
              </label>
              <label className="inline-flex items-center gap-3 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={form.trackExpiry}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trackExpiry: event.target.checked,
                      trackBatches: event.target.checked ? true : current.trackBatches
                    }))
                  }
                />
                Seguimiento de caducidad
              </label>
            </div>

            <div className="mt-4 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              {inventoryDefaults.batchTrackingEnabled ? 'El seguimiento de lotes está activo por defecto en esta sucursal.' : 'El seguimiento de lotes es opcional en esta sucursal.'}
              {' '}
              {inventoryDefaults.expiryTrackingEnabled ? 'El seguimiento de caducidad está activo por defecto.' : 'El seguimiento de caducidad es opcional.'}
            </div>

            <div className="mt-4 rounded-[20px] border border-stone-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-stone-900">Conversiones de paquetes</div>
              <div className="space-y-3">
                {units
                  .filter((unit) => unit.id !== form.baseUnitOfMeasureId)
                  .map((unit) => {
                    const conversion = form.uomConversions.find((entry) => entry.unitOfMeasureId === unit.id);

                    return (
                      <div key={unit.id} className="grid gap-3 sm:grid-cols-[1fr_180px] sm:items-center">
                        <div className="text-sm text-stone-600">
                          1 <span className="font-semibold text-stone-900">{unit.name.toLowerCase()}</span>
                          {' = '}
                          <span className="font-semibold text-stone-900">{conversion?.ratioToBase || '...'}</span>
                          {' '}
                          {selectedBaseUnit?.name.toLowerCase() ?? 'unidad base'}{conversion?.ratioToBase === '1' ? '' : 's'}
                        </div>
                        <Input
                          type="number"
                          min="1"
                          value={conversion?.ratioToBase ?? ''}
                          onChange={(event) =>
                            setForm((current) => {
                              const nextValue = event.target.value;
                              const remaining = current.uomConversions.filter((entry) => entry.unitOfMeasureId !== unit.id);

                              if (!nextValue) {
                                return { ...current, uomConversions: remaining };
                              }

                              return {
                                ...current,
                                uomConversions: [...remaining, { unitOfMeasureId: unit.id, ratioToBase: nextValue }]
                              };
                            })
                          }
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Variantes</div>
                <div className="mt-1 text-lg font-black text-stone-900">Opciones de variantes estructuradas</div>
              </div>
              <Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, emptyVariant()] }))}>
                Añadir variante
              </Button>
            </div>

            <div className="space-y-4">
              {form.variants.length ? form.variants.map((variant, index) => (
                <div key={`variant-${index}`} className="rounded-[22px] border border-stone-200 bg-stone-50/80 p-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Input placeholder="Color" value={variant.color} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, color: event.target.value } : entry) }))} />
                    <Input placeholder="Talla / Tamaño" value={variant.size} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, size: event.target.value } : entry) }))} />
                    <Input placeholder="Sabor" value={variant.flavor} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, flavor: event.target.value } : entry) }))} />
                    <Input placeholder="Modelo" value={variant.model} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, model: event.target.value } : entry) }))} />
                    <Input placeholder="SKU de variante" value={variant.sku} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, sku: event.target.value } : entry) }))} />
                    <Input placeholder="Código de barras de variante" value={variant.barcode} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, barcode: event.target.value } : entry) }))} />
                    <Input type="number" step="0.01" placeholder="Precio específico" value={variant.priceOverride} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, priceOverride: event.target.value } : entry) }))} />
                    <Input type="number" step="0.01" placeholder="Costo específico" value={variant.costOverride} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, costOverride: event.target.value } : entry) }))} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-stone-600">
                      <input
                        type="checkbox"
                        checked={variant.isActive}
                        onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, isActive: event.target.checked } : entry) }))}
                      />
                      Variante activa
                    </label>
                    <div className="text-xs text-stone-500">{toVariantLabel(variant) || 'La etiqueta de la variante se generará con los campos anteriores.'}</div>
                    <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, variants: current.variants.filter((_, entryIndex) => entryIndex !== index) }))}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              )) : (
                <div className="rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                  Aún no hay variantes. Añade colores, tallas, sabores o modelos solo si el producto los requiere.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Imágenes</div>
                  <div className="mt-1 text-lg font-black text-stone-900">Archivos multimedia del producto</div>
                </div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => void addUploadedImages(event.target.files)}
                />
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => uploadInputRef.current?.click()} disabled={uploadingImages || form.images.length >= 6}>
                    {uploadingImages ? 'Subiendo…' : 'Subir imagen'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, images: [...current.images, emptyImage(current.images.length)] }))}>
                    Añadir URL
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {form.images.length ? form.images.map((image, index) => (
                  <div key={`image-${index}`} className="rounded-[22px] border border-stone-200 bg-stone-50/80 p-4">
                    <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                      <div className="overflow-hidden rounded-[18px] border border-stone-200 bg-white">
                        {image.imageUrl ? (
                          <img src={image.imageUrl} alt={image.altText || form.name || 'Imagen del producto'} className="h-28 w-full object-cover" />
                        ) : (
                          <div className="flex h-28 items-center justify-center text-xs text-stone-400">Sin imagen</div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <Input placeholder="URL de la imagen o ruta del archivo" value={image.imageUrl} onChange={(event) => setForm((current) => ({ ...current, images: current.images.map((entry, entryIndex) => entryIndex === index ? { ...entry, imageUrl: event.target.value } : entry) }))} />
                        <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                          <Input placeholder="Texto alternativo" value={image.altText} onChange={(event) => setForm((current) => ({ ...current, images: current.images.map((entry, entryIndex) => entryIndex === index ? { ...entry, altText: event.target.value } : entry) }))} />
                          <Input type="number" placeholder="Orden" value={image.sortOrder} onChange={(event) => setForm((current) => ({ ...current, images: current.images.map((entry, entryIndex) => entryIndex === index ? { ...entry, sortOrder: event.target.value } : entry) }))} />
                          <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, images: current.images.filter((_, entryIndex) => entryIndex !== index) }))}>
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                    Aún no hay imágenes. Sube una imagen o usa una URL directa.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Etiquetas de código de barras</div>
                  <div className="mt-1 text-lg font-black text-stone-900">Vista previa e impresión</div>
                </div>
                <select className={selectClassName} value={labelSize} onChange={(event) => setLabelSize(event.target.value as BarcodeLabelSize)}>
                  <option value="small">Pequeña</option>
                  <option value="medium">Mediana</option>
                  <option value="large">Grande</option>
                </select>
              </div>

              <div className="mt-4 space-y-4">
                <BarcodeLabelPreview code={form.barcode || form.sku} productName={form.name || 'Producto'} sku={form.sku || null} size={labelSize} />
                {form.variants.filter((variant) => variant.barcode || variant.sku).slice(0, 2).map((variant, index) => (
                  <BarcodeLabelPreview
                    key={`barcode-preview-${index}`}
                    code={variant.barcode || variant.sku}
                    productName={form.name || 'Producto'}
                    variantLabel={toVariantLabel(variant)}
                    sku={variant.sku || null}
                    size={labelSize}
                  />
                ))}
              </div>

              {editingId ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/print/barcode-labels?productId=${editingId}&size=${labelSize}`} target="_blank">
                    <Button type="button">Imprimir etiquetas del producto</Button>
                  </Link>
                  {products
                    .find((product) => product.id === editingId)
                    ?.variants.filter((variant) => variant.barcode || variant.sku)
                    .slice(0, 2)
                    .map((variant) => (
                      <Link key={variant.id} href={`/print/barcode-labels?productId=${editingId}&variantId=${variant.id}&size=${labelSize}`} target="_blank">
                        <Button type="button" variant="secondary">
                          Imprimir {toVariantLabel(variant) || 'variante'}
                        </Button>
                      </Link>
                    ))}
                </div>
              ) : null}
            </div>
          </div>

          {editingId ? (
            <div className="grid gap-6 xl:grid-cols-2">
              {canViewPurchaseCosts ? (
                <>
                  <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Historial de precios</div>
                    <div className="mt-1 text-lg font-black text-stone-900">Cambios de precio recientes</div>
                    <div className="mt-4 space-y-3">
                      {(products.find((product) => product.id === editingId)?.priceHistory ?? []).length ? (
                        products.find((product) => product.id === editingId)!.priceHistory.map((entry) => (
                          <div key={entry.id} className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                            <div className="font-semibold text-stone-900">
                              {money(entry.previousPrice, currencySymbol)} a {money(entry.newPrice, currencySymbol)}
                            </div>
                            <div className="mt-1 text-xs text-stone-500">
                              {shortDate(entry.effectiveDate)} por {entry.changedByUser.name ?? entry.changedByUser.email}
                            </div>
                            {entry.note ? <div className="mt-2 text-xs text-stone-500">{entry.note}</div> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                          No se han registrado cambios de precio aún.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Historial de costos</div>
                    <div className="mt-1 text-lg font-black text-stone-900">Cambios de costo recientes</div>
                    <div className="mt-4 space-y-3">
                      {(products.find((product) => product.id === editingId)?.costHistory ?? []).length ? (
                        products.find((product) => product.id === editingId)!.costHistory.map((entry) => (
                          <div key={entry.id} className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                            <div className="font-semibold text-stone-900">
                              {money(entry.previousCost, currencySymbol)} a {money(entry.newCost, currencySymbol)}
                            </div>
                            <div className="mt-1 text-xs text-stone-500">
                              {shortDate(entry.effectiveDate)} por {entry.changedByUser.name ?? entry.changedByUser.email}
                            </div>
                            {entry.note ? <div className="mt-2 text-xs text-stone-500">{entry.note}</div> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                          No se han registrado cambios de costo aún.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando producto...' : editingId ? 'Actualizar producto' : 'Guardar producto'}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
      ) : (
      <Card>
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Acceso al catálogo</div>
        <div className="mt-2 text-2xl font-black text-stone-900">Vista de producto de solo lectura</div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
          Esta cuenta puede consultar el catálogo{canViewPurchaseCosts ? ' y los costos de compra' : ''}, pero no tiene permisos para crear, editar, archivar ni restaurar productos.
        </p>
      </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-stone-900">Catálogo de productos</h2>
            <p className="text-sm text-stone-500">Busca, filtra y gestiona productos comerciales con sus variantes y cambios recientes.</p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <Input placeholder="Buscar productos o variantes..." value={query} onChange={(event) => setQuery(event.target.value)} className="md:w-72" />
            <select className={`${selectClassName} md:w-56`} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5">Producto</th>
                  <th className="px-4 py-3.5">Categoría</th>
                  <th className="px-4 py-3.5">Datos comerciales</th>
                  <th className="px-4 py-3.5">Variantes</th>
                  <th className="px-4 py-3.5">Precios</th>
                  <th className="px-4 py-3.5">Existencias</th>
                  <th className="px-4 py-3.5">Estado</th>
                  <th className="px-4 py-3.5">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const level = getStockLevel(product.stockQty, product.reorderPoint, lowStockThreshold);
                  const margin = getMarginSummary(Number(product.price), Number(product.cost));
                  const nextExpiryBatch = product.batches.find((batch) => batch.expiryDate && batch.quantity > 0) ?? null;

                  return (
                    <tr key={product.id} className="border-t border-stone-200 bg-white transition hover:bg-stone-50/70">
                      <td className="px-4 py-4">
                        <div className="flex gap-3">
                          <div className="h-14 w-14 overflow-hidden rounded-[18px] border border-stone-200 bg-stone-50">
                            {product.images[0] ? (
                              <img src={product.images[0].imageUrl} alt={product.images[0].altText ?? product.name} className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <div className="font-semibold text-stone-900">{product.name}</div>
                            <div className="mt-1 text-xs text-stone-500">{product.description ?? 'Sin descripción'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">{product.category?.name ?? 'Sin categoría'}</td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>{product.sku || 'N/A'} / {product.barcode || 'N/A'}</div>
                        <div className="mt-2 text-xs text-stone-500">
                          Base: {product.baseUnitOfMeasure?.name ?? 'Unidad no asignada'}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">
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
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="blue">{product.variants.length} variante(s)</Badge>
                          {product.images.length ? <Badge tone="stone">{product.images.length} imagen(es)</Badge> : null}
                        </div>
                        <div className="mt-2 text-xs text-stone-500">
                          {product.variants.slice(0, 2).map((variant) => toVariantLabel(variant) || variant.sku || variant.barcode || 'Variante').join(' | ') || 'Sin variantes'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{money(product.price, currencySymbol)}</div>
                        {canViewPurchaseCosts ? (
                          <>
                            <div className="text-xs text-stone-500">Costo {money(product.cost, currencySymbol)}</div>
                            <div className={`mt-2 text-xs ${margin.tone === 'red' ? 'text-red-700' : margin.tone === 'amber' ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {margin.message}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-stone-500">La visualización de costos está restringida para esta cuenta.</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{product.stockQty}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {nextExpiryBatch?.expiryDate
                            ? `Próximo vencimiento: ${shortDate(nextExpiryBatch.expiryDate)}`
                            : product.batches.length
                              ? `${product.batches.length} lote(s) registrado(s)`
                              : 'Sin lotes registrados'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={product.isActive ? 'emerald' : 'stone'}>{product.isActive ? 'Activo' : 'Archivado'}</Badge>
                          <Badge tone={level === 'OUT_OF_STOCK' ? 'red' : level === 'LOW_STOCK' ? 'amber' : 'blue'}>
                            {stockLevelLabel(level)}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {canEditProducts ? (
                          <div className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={() => beginEdit(product)}>
                              Editar
                            </Button>
                            <Button type="button" variant="ghost" className="text-xs uppercase tracking-[0.14em]" onClick={() => toggleArchive(product)}>
                              {product.isActive ? 'Archivar' : 'Restaurar'}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-500">Sin acceso de edición</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!filtered.length ? (
            <div className="border-t border-stone-200 bg-stone-50 py-10 text-center text-sm text-stone-500">
              Ningún producto coincide con el filtro seleccionado.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
