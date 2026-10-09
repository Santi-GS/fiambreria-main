'use client';

import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import BarcodeLabelPreview, { type BarcodeLabelSize } from '@/components/products/BarcodeLabelPreview';
import { money, shortDate } from '@/lib/format';
import { buildVariantLabel, getMarginSummary } from '@/lib/product-merchandising';
import { compressProductImage } from '@/lib/client-image-compression';
import type {
  Category,
  ImageDraft,
  Product,
  ProductFormData,
  UnitOfMeasure,
  VariantDraft
} from './types';

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-600">
      {children}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
    </label>
  );
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

function toVariantLabel(variant: VariantDraft) {
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

type TabKey = 'details' | 'operations' | 'variants' | 'media';

type ProductFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  categories: Category[];
  units: UnitOfMeasure[];
  canViewPurchaseCosts: boolean;
  currencySymbol: string;
  inventoryDefaults: {
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    expiryAlertDays: number;
  };
  onSaved: (product: Product, isNew: boolean) => void;
};

export default function ProductFormModal({
  isOpen,
  onClose,
  editingProduct,
  categories,
  units,
  canViewPurchaseCosts,
  currencySymbol,
  inventoryDefaults,
  onSaved
}: ProductFormModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [labelSize, setLabelSize] = useState<BarcodeLabelSize>('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const defaultBaseUnitId = units.find((unit) => unit.code === 'PIECE')?.id ?? units[0]?.id ?? '';

  const initialFormState = useMemo<ProductFormData>(() => {
    if (editingProduct) {
      return {
        categoryId: editingProduct.categoryId ?? '',
        baseUnitOfMeasureId: editingProduct.baseUnitOfMeasureId ?? defaultBaseUnitId,
        sku: editingProduct.sku ?? '',
        barcode: editingProduct.barcode ?? '',
        name: editingProduct.name,
        description: editingProduct.description ?? '',
        cost: editingProduct.cost,
        price: editingProduct.price,
        stockQty: String(editingProduct.stockQty),
        reorderPoint: String(editingProduct.reorderPoint),
        trackBatches: editingProduct.trackBatches,
        trackExpiry: editingProduct.trackExpiry,
        changeNote: '',
        uomConversions: editingProduct.uomConversions.map((conversion) => ({
          unitOfMeasureId: conversion.unitOfMeasureId,
          ratioToBase: String(conversion.ratioToBase)
        })),
        variants: editingProduct.variants.map((variant) => ({
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
        images: editingProduct.images.map((image) => ({
          imageUrl: image.imageUrl,
          altText: image.altText ?? '',
          sortOrder: String(image.sortOrder)
        })),
        isActive: editingProduct.isActive
      };
    }

    return {
      categoryId: '',
      baseUnitOfMeasureId: defaultBaseUnitId,
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
    };
  }, [editingProduct, defaultBaseUnitId, inventoryDefaults]);

  const [form, setForm] = useState<ProductFormData>(initialFormState);

  // Sync form when editingProduct or isOpen changes
  useEffect(() => {
    if (isOpen) {
      setForm(initialFormState);
      setError('');
      setActiveTab('details');
      // Focus name input shortly after open
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialFormState]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const selectedBaseUnit = units.find((unit) => unit.id === form.baseUnitOfMeasureId) ?? null;
  const currentMargin = getMarginSummary(Number(form.price || 0), Number(form.cost || 0));

  async function addUploadedImages(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const remainingSlots = Math.max(0, 6 - form.images.length);
    if (!remainingSlots) {
      setError('Solo puedes agregar hasta 6 imágenes por producto.');
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    setUploadingImages(true);
    setUploadStatusText('Optimizando imágenes…');
    setError('');

    try {
      const compressedFiles = await Promise.all(
        selectedFiles.map((file) =>
          compressProductImage(file, {
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 0.82
          })
        )
      );

      setUploadStatusText('Subiendo…');

      const uploadedImageUrls = await Promise.all(
        compressedFiles.map((file) => uploadProductImage(file))
      );

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir una o más imágenes.');
    } finally {
      setUploadingImages(false);
      setUploadStatusText('');
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setActiveTab('details');
      setError('El nombre del producto es obligatorio.');
      return;
    }

    if (Number(form.cost) < 0 || Number(form.price) < 0) {
      setActiveTab('details');
      setError('El costo y el precio de venta no pueden ser negativos.');
      return;
    }

    if (!editingProduct && Number(form.stockQty) < 0) {
      setActiveTab('details');
      setError('El stock inicial no puede ser negativo.');
      return;
    }

    if (Number(form.reorderPoint) < 0) {
      setActiveTab('details');
      setError('El nivel de reposición por stock bajo no puede ser negativo.');
      return;
    }

    if (!form.baseUnitOfMeasureId) {
      setActiveTab('details');
      setError('Selecciona una unidad base de medida.');
      return;
    }

    for (const conversion of form.uomConversions) {
      if (!conversion.unitOfMeasureId || !conversion.ratioToBase) {
        setActiveTab('operations');
        setError('Completa o elimina las filas de conversión de unidades en blanco.');
        return;
      }

      if (Number(conversion.ratioToBase) <= 0) {
        setActiveTab('operations');
        setError('Los factores de conversión deben ser mayores a cero.');
        return;
      }
    }

    for (const variant of form.variants) {
      if (![variant.color, variant.size, variant.flavor, variant.model, variant.sku, variant.barcode].some(Boolean)) {
        setActiveTab('variants');
        setError('Cada variante necesita al menos un descriptor, SKU o código de barras.');
        return;
      }

      if (variant.priceOverride && Number(variant.priceOverride) < 0) {
        setActiveTab('variants');
        setError('El precio específico de la variante no puede ser negativo.');
        return;
      }

      if (variant.costOverride && Number(variant.costOverride) < 0) {
        setActiveTab('variants');
        setError('El costo específico de la variante no puede ser negativo.');
        return;
      }
    }

    for (const image of form.images) {
      if (!image.imageUrl.trim()) {
        setActiveTab('media');
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
      ...(editingProduct ? {} : { stockQty: Number(form.stockQty) })
    };

    try {
      const response = await fetch(editingProduct ? `/api/products/${editingProduct.id}` : '/api/products', {
        method: editingProduct ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({ error: 'No se pudo guardar el producto.' }));
      setLoading(false);

      if (!response.ok) {
        setError(data.error ?? 'No se pudo guardar el producto.');
        return;
      }

      const savedProduct: Product = {
        ...data.product,
        cost: String(data.product.cost),
        price: String(data.product.price),
        baseUnitOfMeasure: data.product.baseUnitOfMeasure,
        uomConversions: data.product.uomConversions ?? [],
        variants: data.product.variants ?? [],
        images: data.product.images ?? [],
        priceHistory: data.product.priceHistory ?? [],
        costHistory: data.product.costHistory ?? [],
        batches: editingProduct?.batches ?? []
      };

      onSaved(savedProduct, !editingProduct);
      onClose();
    } catch {
      setLoading(false);
      setError('Ocurrió un error inesperado al procesar la solicitud.');
    }
  }

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-2 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-form-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-950/60 transition-opacity duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative z-10 flex h-[94vh] max-h-[96vh] w-[96vw] max-w-7xl flex-col rounded-2xl sm:rounded-[32px] border border-stone-200 bg-white shadow-2xl transition-all duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3.5 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="product-form-modal-title" className="text-xl font-black text-stone-900">
                  {editingProduct ? 'Editar producto' : 'Añadir producto'}
                </h2>
                {editingProduct ? (
                  <Badge tone={editingProduct.isActive ? 'emerald' : 'stone'}>
                    {editingProduct.isActive ? 'Activo' : 'Archivado'}
                  </Badge>
                ) : (
                  <Badge tone="blue">Nuevo en catálogo</Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-stone-500">
                {editingProduct
                  ? `Modificando detalles comerciales de ${editingProduct.name}`
                  : 'Configura precios, variantes, imágenes y existencias de forma segura.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-500 transition hover:bg-stone-200 hover:text-stone-900 active:scale-95"
            aria-label="Cerrar modal"
            title="Cerrar [Esc]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex shrink-0 overflow-x-auto border-b border-stone-100 bg-stone-50/70 px-4 py-2 sm:px-6 sm:py-2.5 gap-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-95 ${
              activeTab === 'details'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Detalles principales
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('operations')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-95 ${
              activeTab === 'operations'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Operaciones
            {form.trackBatches || form.trackExpiry || form.uomConversions.length > 0 ? (
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('variants')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-95 ${
              activeTab === 'variants'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Variantes
            {form.variants.length > 0 ? (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-800">
                {form.variants.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('media')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-95 ${
              activeTab === 'media'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Imágenes y Códigos
            {form.images.length > 0 ? (
              <span className="rounded-full bg-stone-200 px-1.5 py-0.5 text-[10px] font-black text-stone-800">
                {form.images.length}
              </span>
            ) : null}
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 min-h-0">
            {/* Error banner */}
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 font-medium">{error}</div>
              </div>
            ) : null}

            {/* TAB 1: DETALLES PRINCIPALES */}
            {activeTab === 'details' && (
              <div className="space-y-6">
                <div className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-5 space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400">
                    Identificación básica
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <FieldLabel required>Nombre del producto</FieldLabel>
                      <Input
                        ref={nameInputRef}
                        placeholder="Ej: Jamón Cocido Natural"
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <FieldLabel>Categoría</FieldLabel>
                      <select
                        className={selectClassName}
                        value={form.categoryId}
                        onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
                      >
                        <option value="">Sin categoría</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel required>Unidad base de venta</FieldLabel>
                      <select
                        className={selectClassName}
                        value={form.baseUnitOfMeasureId}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            baseUnitOfMeasureId: event.target.value,
                            uomConversions: current.uomConversions.filter(
                              (conversion) => conversion.unitOfMeasureId !== event.target.value
                            )
                          }))
                        }
                      >
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name} ({unit.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>SKU</FieldLabel>
                      <Input
                        placeholder="Código interno"
                        value={form.sku}
                        onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
                      />
                    </div>
                    <div>
                      <FieldLabel>Código de barras</FieldLabel>
                      <Input
                        placeholder="EAN-13, UPC o numérico"
                        value={form.barcode}
                        onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-5 space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400">
                    Precios e inventario
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <FieldLabel required>Precio de venta</FieldLabel>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={form.price}
                        onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                        required
                      />
                    </div>
                    {canViewPurchaseCosts ? (
                      <div>
                        <FieldLabel>Precio de costo</FieldLabel>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={form.cost}
                          onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))}
                        />
                      </div>
                    ) : null}
                    <div>
                      <FieldLabel>
                        {editingProduct ? 'Existencias actuales' : 'Stock inicial'}
                      </FieldLabel>
                      <Input
                        type="number"
                        value={form.stockQty}
                        onChange={(event) => setForm((current) => ({ ...current, stockQty: event.target.value }))}
                        disabled={Boolean(editingProduct)}
                      />
                      {editingProduct ? (
                        <p className="mt-1 text-[11px] text-stone-400">
                          Ajusta stock desde movimientos o compras.
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <FieldLabel>Punto de reposición</FieldLabel>
                      <Input
                        type="number"
                        min="0"
                        value={form.reorderPoint}
                        onChange={(event) => setForm((current) => ({ ...current, reorderPoint: event.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Resumen de Margen */}
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div
                      className={`rounded-2xl border px-4 py-3 text-xs font-semibold ${
                        currentMargin.tone === 'red'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : currentMargin.tone === 'amber'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      Margen proyectado: {currentMargin.message} ({currentMargin.percentage.toFixed(1)}%)
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs text-stone-600 flex items-center">
                      Unidad base: <span className="ml-1 font-bold text-stone-900">{selectedBaseUnit?.name ?? 'Sin seleccionar'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel>Descripción</FieldLabel>
                    <Input
                      placeholder="Breve reseña o información comercial"
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    />
                  </div>
                  <div>
                    <FieldLabel>Nota del cambio</FieldLabel>
                    <Input
                      placeholder="Motivo de cambio de precio/costo (opcional)"
                      value={form.changeNote}
                      onChange={(event) => setForm((current) => ({ ...current, changeNote: event.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: OPERACIONES */}
            {activeTab === 'operations' && (
              <div className="space-y-6">
                <div className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-5 space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400">
                    Control de inventario y lotes
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 cursor-pointer transition hover:border-stone-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                        checked={form.trackBatches}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            trackBatches: event.target.checked,
                            trackExpiry: event.target.checked ? current.trackExpiry : false
                          }))
                        }
                      />
                      <div>
                        <div className="text-sm font-bold text-stone-900">Registrar lotes</div>
                        <div className="text-xs text-stone-500">Permite controlar ingresos por número de lote.</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 cursor-pointer transition hover:border-stone-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                        checked={form.trackExpiry}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            trackExpiry: event.target.checked,
                            trackBatches: event.target.checked ? true : current.trackBatches
                          }))
                        }
                      />
                      <div>
                        <div className="text-sm font-bold text-stone-900">Seguimiento de caducidad</div>
                        <div className="text-xs text-stone-500">Genera alertas anticipadas de vencimiento.</div>
                      </div>
                    </label>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-600">
                    {inventoryDefaults.batchTrackingEnabled
                      ? '✓ El seguimiento de lotes está activo por defecto en esta sucursal.'
                      : 'El seguimiento de lotes es opcional en esta sucursal.'}{' '}
                    {inventoryDefaults.expiryTrackingEnabled
                      ? '✓ El seguimiento de caducidad está activo por defecto.'
                      : 'El seguimiento de caducidad es opcional.'}
                  </div>
                </div>

                <div className="rounded-[24px] border border-stone-200 bg-white p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-stone-900">Conversiones de unidades (UOM)</div>
                      <p className="text-xs text-stone-500">
                        Define factores de conversión para vender por piezas, cajas, kilos o fracciones.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {units
                      .filter((unit) => unit.id !== form.baseUnitOfMeasureId)
                      .map((unit) => {
                        const conversion = form.uomConversions.find((entry) => entry.unitOfMeasureId === unit.id);

                        return (
                          <div
                            key={unit.id}
                            className="grid gap-3 rounded-2xl border border-stone-100 bg-stone-50/70 p-3 sm:grid-cols-[1fr_160px] sm:items-center"
                          >
                            <div className="text-xs text-stone-700">
                              1 <span className="font-bold text-stone-900">{unit.name}</span>
                              {' = '}
                              <span className="font-bold text-emerald-700">{conversion?.ratioToBase || '—'}</span>
                              {' '}
                              {selectedBaseUnit?.name.toLowerCase() ?? 'unidad base'}
                              {conversion?.ratioToBase === '1' ? '' : 's'}
                            </div>
                            <Input
                              type="number"
                              min="0.01"
                              step="any"
                              placeholder="Ratio base"
                              value={conversion?.ratioToBase ?? ''}
                              onChange={(event) =>
                                setForm((current) => {
                                  const nextValue = event.target.value;
                                  const remaining = current.uomConversions.filter(
                                    (entry) => entry.unitOfMeasureId !== unit.id
                                  );

                                  if (!nextValue) {
                                    return { ...current, uomConversions: remaining };
                                  }

                                  return {
                                    ...current,
                                    uomConversions: [
                                      ...remaining,
                                      { unitOfMeasureId: unit.id, ratioToBase: nextValue }
                                    ]
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
            )}

            {/* TAB 3: VARIANTES */}
            {activeTab === 'variants' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-stone-900">Variantes estructuradas</h3>
                    <p className="text-xs text-stone-500">
                      Define opciones por color, tamaño, sabor o modelo con precios y códigos específicos.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        variants: [...current.variants, emptyVariant()]
                      }))
                    }
                  >
                    + Añadir variante
                  </Button>
                </div>

                <div className="space-y-4">
                  {form.variants.length ? (
                    form.variants.map((variant, index) => (
                      <div
                        key={`variant-${index}`}
                        className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4 space-y-3"
                      >
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                          <Input
                            placeholder="Color (ej: Rojo)"
                            value={variant.color}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, color: event.target.value } : v
                                )
                              }))
                            }
                          />
                          <Input
                            placeholder="Talle / Tamaño (ej: Grande)"
                            value={variant.size}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, size: event.target.value } : v
                                )
                              }))
                            }
                          />
                          <Input
                            placeholder="Sabor (ej: Ahumado)"
                            value={variant.flavor}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, flavor: event.target.value } : v
                                )
                              }))
                            }
                          />
                          <Input
                            placeholder="Modelo (ej: Premium)"
                            value={variant.model}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, model: event.target.value } : v
                                )
                              }))
                            }
                          />
                          <Input
                            placeholder="SKU de variante"
                            value={variant.sku}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, sku: event.target.value } : v
                                )
                              }))
                            }
                          />
                          <Input
                            placeholder="Código de barras"
                            value={variant.barcode}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, barcode: event.target.value } : v
                                )
                              }))
                            }
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Precio específico"
                            value={variant.priceOverride}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, priceOverride: event.target.value } : v
                                )
                              }))
                            }
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Costo específico"
                            value={variant.costOverride}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, costOverride: event.target.value } : v
                                )
                              }))
                            }
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3">
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700">
                            <input
                              type="checkbox"
                              checked={variant.isActive}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  variants: current.variants.map((v, i) =>
                                    i === index ? { ...v, isActive: event.target.checked } : v
                                  )
                                }))
                              }
                            />
                            Variante activa
                          </label>

                          <div className="text-xs text-stone-500 font-medium">
                            Etiqueta:{' '}
                            <span className="font-bold text-stone-900">
                              {toVariantLabel(variant) || 'Se generará automáticamente'}
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            className="text-xs text-red-600 hover:text-red-700"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.filter((_, i) => i !== index)
                              }))
                            }
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-xs text-stone-500">
                      No hay variantes configuradas. Añade colores, tallas o modelos si el producto los requiere.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: IMÁGENES Y CÓDIGOS */}
            {activeTab === 'media' && (
              <div className="space-y-6">
                {/* Sección Multimedia */}
                <div className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-5 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-black text-stone-900">Imágenes del producto</h3>
                      <p className="text-xs text-stone-500">Hasta 6 fotos por producto con compresión optimizada.</p>
                    </div>

                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => void addUploadedImages(event.target.files)}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => void addUploadedImages(event.target.files)}
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={uploadingImages || form.images.length >= 6}
                        title="Tomar foto directa con la cámara"
                      >
                        📷 {uploadingImages ? uploadStatusText || 'Procesando…' : 'Tomar foto'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => uploadInputRef.current?.click()}
                        disabled={uploadingImages || form.images.length >= 6}
                      >
                        🖼️ {uploadingImages ? uploadStatusText || 'Subiendo…' : 'Subir archivo'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            images: [...current.images, emptyImage(current.images.length)]
                          }))
                        }
                      >
                        + URL
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {form.images.length ? (
                      form.images.map((image, index) => (
                        <div
                          key={`image-${index}`}
                          className="rounded-[22px] border border-stone-200 bg-white p-3.5"
                        >
                          <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
                            <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                              {image.imageUrl ? (
                                <img
                                  src={image.imageUrl}
                                  alt={image.altText || form.name || 'Foto del producto'}
                                  className="h-24 w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-24 items-center justify-center text-xs text-stone-400">
                                  Sin imagen
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Input
                                placeholder="URL de la imagen"
                                value={image.imageUrl}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    images: current.images.map((img, i) =>
                                      i === index ? { ...img, imageUrl: event.target.value } : img
                                    )
                                  }))
                                }
                              />
                              <div className="grid gap-2 sm:grid-cols-[1fr_80px_auto]">
                                <Input
                                  placeholder="Texto descriptivo (alt)"
                                  value={image.altText}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      images: current.images.map((img, i) =>
                                        i === index ? { ...img, altText: event.target.value } : img
                                      )
                                    }))
                                  }
                                />
                                <Input
                                  type="number"
                                  placeholder="Orden"
                                  value={image.sortOrder}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      images: current.images.map((img, i) =>
                                        i === index ? { ...img, sortOrder: event.target.value } : img
                                      )
                                    }))
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="text-xs text-red-600 hover:text-red-700"
                                  onClick={() =>
                                    setForm((current) => ({
                                      ...current,
                                      images: current.images.filter((_, i) => i !== index)
                                    }))
                                  }
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-stone-300 bg-white p-6 text-center text-xs text-stone-500">
                        Aún no hay fotos añadidas.
                      </div>
                    )}
                  </div>
                </div>

                {/* Sección Códigos de Barras */}
                <div className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-stone-900">Etiquetas de código de barras</h3>
                      <p className="text-xs text-stone-500">Vista previa para impresión térmica o adhesiva.</p>
                    </div>
                    <select
                      className={`${selectClassName} w-36`}
                      value={labelSize}
                      onChange={(event) => setLabelSize(event.target.value as BarcodeLabelSize)}
                    >
                      <option value="small">Pequeña</option>
                      <option value="medium">Mediana</option>
                      <option value="large">Grande</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <BarcodeLabelPreview
                      code={form.barcode || form.sku}
                      productName={form.name || 'Producto'}
                      sku={form.sku || null}
                      size={labelSize}
                    />

                    {form.variants
                      .filter((variant) => variant.barcode || variant.sku)
                      .slice(0, 2)
                      .map((variant, index) => (
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

                  {editingProduct ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Link
                        href={`/print/barcode-labels?productId=${editingProduct.id}&size=${labelSize}`}
                        target="_blank"
                      >
                        <Button type="button" variant="secondary">
                          🖨️ Imprimir etiquetas del producto
                        </Button>
                      </Link>
                    </div>
                  ) : null}
                </div>

                {/* Historial en modo edición */}
                {editingProduct && canViewPurchaseCosts ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-stone-200 bg-white p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Historial de precios
                      </div>
                      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                        {editingProduct.priceHistory.length ? (
                          editingProduct.priceHistory.map((entry) => (
                            <div key={entry.id} className="rounded-xl border border-stone-100 bg-stone-50 p-2.5 text-xs">
                              <div className="font-bold text-stone-900">
                                {money(entry.previousPrice, currencySymbol)} → {money(entry.newPrice, currencySymbol)}
                              </div>
                              <div className="text-[11px] text-stone-500">
                                {shortDate(entry.effectiveDate)} por {entry.changedByUser.name ?? entry.changedByUser.email}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-stone-400">Sin cambios de precio registrados.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-stone-200 bg-white p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Historial de costos
                      </div>
                      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                        {editingProduct.costHistory.length ? (
                          editingProduct.costHistory.map((entry) => (
                            <div key={entry.id} className="rounded-xl border border-stone-100 bg-stone-50 p-2.5 text-xs">
                              <div className="font-bold text-stone-900">
                                {money(entry.previousCost, currencySymbol)} → {money(entry.newCost, currencySymbol)}
                              </div>
                              <div className="text-[11px] text-stone-500">
                                {shortDate(entry.effectiveDate)} por {entry.changedByUser.name ?? entry.changedByUser.email}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-stone-400">Sin cambios de costo registrados.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="flex shrink-0 flex-col sm:flex-row items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/90 px-4 py-3 sm:px-6 sm:py-4">
            <div className="text-xs text-stone-500">
              {activeTab === 'details' && 'Paso 1 de 4: Información básica'}
              {activeTab === 'operations' && 'Paso 2 de 4: Operaciones y conversión'}
              {activeTab === 'variants' && `Paso 3 de 4: ${form.variants.length} variante(s)`}
              {activeTab === 'media' && `Paso 4 de 4: ${form.images.length} imagen(es)`}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando producto…' : editingProduct ? 'Actualizar producto' : 'Guardar producto'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
