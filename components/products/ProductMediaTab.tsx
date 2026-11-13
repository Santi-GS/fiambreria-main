'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import Link from 'next/link';
import BarcodeLabelPreview, { type BarcodeLabelSize } from '@/components/products/BarcodeLabelPreview';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { money, shortDate } from '@/lib/format';
import type { ImageDraft, Product, ProductFormData, VariantDraft } from './types';

export function emptyImage(sortOrder = 0): ImageDraft {
  return {
    imageUrl: '',
    altText: '',
    sortOrder: String(sortOrder)
  };
}

export default function ProductMediaTab({
  form,
  setForm,
  editingProduct,
  canViewPurchaseCosts,
  currencySymbol,
  labelSize,
  setLabelSize,
  selectClassName,
  uploadingImages,
  uploadStatusText,
  uploadInputRef,
  cameraInputRef,
  addUploadedImages,
  toVariantLabel
}: {
  form: ProductFormData;
  setForm: Dispatch<SetStateAction<ProductFormData>>;
  editingProduct: Product | null;
  canViewPurchaseCosts: boolean;
  currencySymbol: string;
  labelSize: BarcodeLabelSize;
  setLabelSize: (size: BarcodeLabelSize) => void;
  selectClassName: string;
  uploadingImages: boolean;
  uploadStatusText: string;
  uploadInputRef: RefObject<HTMLInputElement | null>;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  addUploadedImages: (files: FileList | null) => Promise<void>;
  toVariantLabel: (variant: VariantDraft) => string;
}) {
  function updateImageField<K extends keyof ImageDraft>(
    index: number,
    field: K,
    value: ImageDraft[K]
  ) {
    setForm((current) => ({
      ...current,
      images: current.images.map((img, i) => (i === index ? { ...img, [field]: value } : img))
    }));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-[24px] border border-stone-200 bg-stone-50/70 p-5">
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
                      onChange={(event) => updateImageField(index, 'imageUrl', event.target.value)}
                    />
                    <div className="grid gap-2 sm:grid-cols-[1fr_80px_auto]">
                      <Input
                        placeholder="Texto descriptivo (alt)"
                        value={image.altText}
                        onChange={(event) => updateImageField(index, 'altText', event.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Orden"
                        value={image.sortOrder}
                        onChange={(event) =>
                          updateImageField(index, 'sortOrder', event.target.value)
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

      <div className="space-y-4 rounded-[24px] border border-stone-200 bg-stone-50/70 p-5">
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

      {editingProduct && canViewPurchaseCosts ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-stone-200 bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Historial de precios
            </div>
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
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
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
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
  );
}
